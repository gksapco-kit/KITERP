"""Single entry point for Production Order status changes.

Every status change — API update, create-as-confirmed, import — goes through
``transition_order`` so stock side-effects are always consistent:

  * leaving ``completed``     -> reverse the stock postings first
  * entering draft/cancelled  -> release material holds (and reset the marker so a
                                 later confirmation re-reserves from a fresh BOM)
  * entering any live status  -> make sure materials are reserved
  * entering ``completed``    -> post consumption + finished-goods receipt

Only the transitions in ``ALLOWED_TRANSITIONS`` are possible; anything else raises
``TransitionError`` (HTTP 409 at the API layer).
"""
from __future__ import annotations

import uuid as uuid_mod
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import ProductionOrder
from app.models.vendor_product import Product
from app.services.production_inventory import (
    post_production_completion,
    reverse_production_completion,
)
from app.services.production_materials import release_materials, reserve_materials

STATUSES: tuple[str, ...] = (
    "draft", "confirmed", "in_production", "qc", "on_hold", "completed", "cancelled",
)

# Statuses in which the order holds materials against stock.
LIVE_STATUSES = frozenset({"confirmed", "in_production", "qc", "on_hold", "completed"})
# Statuses that are read-only apart from notes/attachments (re-open to edit).
TERMINAL_STATUSES = frozenset({"completed", "cancelled"})

ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"confirmed", "cancelled"}),
    "confirmed": frozenset({"draft", "in_production", "completed", "on_hold", "cancelled"}),
    "in_production": frozenset({"confirmed", "qc", "completed", "on_hold", "cancelled"}),
    "qc": frozenset({"in_production", "completed", "on_hold", "cancelled"}),
    "on_hold": frozenset({"confirmed", "in_production", "qc", "cancelled"}),
    # Re-opening a completed order reverses its stock postings. Cancelling or
    # un-confirming it directly is not allowed: re-open first, then cancel.
    "completed": frozenset({"in_production", "qc"}),
    "cancelled": frozenset({"draft", "confirmed"}),
}


class TransitionError(ValueError):
    """The requested status change is not allowed from the current status."""


def append_audit(
    order: ProductionOrder,
    action: str,
    detail: str,
    *,
    actor: str,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    """Server-side audit entry. Actor always comes from the authenticated user."""
    log = list(order.audit_log or [])
    event: dict[str, Any] = {
        "id": f"{action}-{uuid_mod.uuid4().hex[:8]}",
        "action": action,
        "actor": actor,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detail": detail,
    }
    if meta:
        event["meta"] = meta
    log.append(event)
    order.audit_log = log


async def _products_requiring_qc(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> list[str]:
    """Names of finished products flagged ``qc_required_on_production``."""
    ids: list[UUID] = []
    for item in order.items or []:
        if isinstance(item, dict) and item.get("item_type") in (None, "product") and item.get("product_id"):
            try:
                ids.append(UUID(str(item["product_id"])))
            except (ValueError, TypeError):
                continue
    if not ids:
        return []
    rows = (await db.execute(
        select(Product.name).where(
            Product.vendor_id == vendor_id,
            Product.id.in_(ids),
            Product.qc_required_on_production.is_(True),
        )
    )).scalars().all()
    return sorted(set(rows))


async def transition_order(
    db: AsyncSession,
    vendor_id: UUID,
    order: ProductionOrder,
    new_status: str,
    *,
    actor: str = "System",
    actor_id: Optional[UUID] = None,
) -> None:
    """Move ``order`` to ``new_status`` applying all stock side-effects.

    Raises TransitionError for illegal moves and ValueError (e.g. insufficient
    stock, no business unit, finished goods already used) when a side-effect
    cannot be applied. The caller must roll back the session on any exception —
    changes made before the failure are not undone here.
    """
    old_status = order.status or "draft"
    if new_status == old_status:
        return
    if new_status not in STATUSES:
        raise TransitionError(f"Unknown status '{new_status}'.")
    allowed = ALLOWED_TRANSITIONS.get(old_status)
    if allowed is None or new_status not in allowed:
        options = ", ".join(sorted(allowed)) if allowed else "none"
        raise TransitionError(
            f"Cannot move a production order from '{old_status}' to '{new_status}'. "
            f"Allowed: {options}."
        )

    if new_status == "completed" and old_status != "qc":
        needs_qc = await _products_requiring_qc(db, vendor_id, order)
        if needs_qc:
            raise TransitionError(
                f"{', '.join(needs_qc)} require a quality check before completion. "
                "Move the order to QC first, then complete it."
            )

    if new_status in ("draft", "cancelled") and old_status != "completed" and order.partial_outputs:
        units = sum(int(o.get("qty") or 0) for o in order.partial_outputs if isinstance(o, dict))
        raise TransitionError(
            f"{units} unit(s) from this order are already in stock. Reverse the recorded output "
            f"(Stock tab) before moving the order to {new_status}."
        )

    if old_status == "completed":
        await reverse_production_completion(db, vendor_id, order, actor_id)

    if new_status in ("draft", "cancelled"):
        await release_materials(db, vendor_id, order)
    else:
        await reserve_materials(db, vendor_id, order)
        if old_status == "draft":
            from app.services.production_routing_templates import apply_standard_routing
            await apply_standard_routing(db, vendor_id, order, actor=actor)
        if new_status == "completed":
            await post_production_completion(db, vendor_id, order, actor_id)
            from app.services.production_output import mark_items_produced
            mark_items_produced(order)
            order.progress = 100

    order.status = new_status
    append_audit(
        order,
        "status_changed",
        f"Status changed from {old_status} to {new_status}",
        actor=actor,
        meta={"from": old_status, "to": new_status, "progress": order.progress or 0},
    )
