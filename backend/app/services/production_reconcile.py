"""Consistency checks between production orders, stock, reservations and the ledger.

``find_issues`` is read-only and safe to run any time (UI, scheduled job, CLI).
``repair_safe_issues`` only fixes what has an unambiguous correction — stale
reservations held by orders that no longer hold materials. Everything else is
reported for a person to decide (for example a cancelled order whose stock is
still posted needs a reversal, which may touch stock that has since moved).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinJournalEntry
from app.models.inventory import InventoryMovement
from app.models.mrp import StockReservation
from app.models.production import ProductionOrder
from app.services.production_accounting import SOURCE_TYPE, event_id
from app.services.production_lifecycle import LIVE_STATUSES

ORDER_TYPE = "production_order"
_CONSUMPTION = ("production_consumption", "production_consumption_reversal")
_RECEIPT = ("production_receipt", "production_receipt_reversal")
_RESERVING = ("confirmed", "in_production", "qc", "on_hold")


def _issue(code: str, severity: str, order, detail: str, fixable: bool = False) -> dict[str, Any]:
    return {
        "code": code, "severity": severity, "fixable": fixable, "detail": detail,
        "order_id": str(order.id) if order is not None else None,
        "ref": order.ref if order is not None else None,
    }


async def find_issues(db: AsyncSession, vendor_id: UUID, *, limit: int = 500) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []

    orders = (await db.execute(
        select(ProductionOrder).where(ProductionOrder.vendor_id == vendor_id)
        .order_by(ProductionOrder.created_at.desc())
    )).scalars().all()
    by_id = {str(o.id): o for o in orders}

    # Net movement per order from the stock ledger.
    movement_rows = (await db.execute(
        select(
            InventoryMovement.reference_id, InventoryMovement.movement_type, func.sum(InventoryMovement.quantity),
        ).where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.reference_type == ORDER_TYPE,
            InventoryMovement.movement_type.in_(_CONSUMPTION + _RECEIPT),
        ).group_by(InventoryMovement.reference_id, InventoryMovement.movement_type)
    )).all()
    consumed: dict[str, int] = {}
    received: dict[str, int] = {}
    for ref_id, mtype, qty in movement_rows:
        key = str(ref_id)
        if mtype in _CONSUMPTION:
            consumed[key] = consumed.get(key, 0) - int(qty or 0)
        else:
            received[key] = received.get(key, 0) + int(qty or 0)

    live_journals = {
        str(sid) for (sid,) in (await db.execute(
            select(FinJournalEntry.source_id).where(
                FinJournalEntry.vendor_id == vendor_id,
                FinJournalEntry.source_type == SOURCE_TYPE,
                FinJournalEntry.status == "posted",
                FinJournalEntry.reverses_id.is_(None),
                FinJournalEntry.reversed_by_id.is_(None),
            )
        )).all()
    }

    for o in orders:
        key = str(o.id)
        status = o.status or "draft"
        if status == "completed" and not o.inventory_posted_at:
            issues.append(_issue(
                "completed_without_posting", "error", o,
                "Order is completed but its stock was never posted (legacy data). "
                "Re-open and complete it again to post consumption and receipt.",
            ))
        if status != "completed" and o.inventory_posted_at:
            issues.append(_issue(
                "posted_but_not_completed", "error", o,
                f"Order is {status} but its completion postings are still in place — stock is "
                "inflated/deducted for an order that is not finished. Complete it, or re-open it to reverse them.",
            ))
        if status in _RESERVING and not o.materials_reserved_at:
            issues.append(_issue(
                "live_without_reservation", "warning", o,
                f"Order is {status} but holds no material reservation. Move it to draft and confirm again.",
            ))

        outputs = [x for x in (o.partial_outputs or []) if isinstance(x, dict)]
        if outputs and status != "completed":
            exp_c = sum(int(c.get("qty") or 0) for x in outputs for c in x.get("components", []))
            exp_r = sum(int(g.get("qty") or 0) for x in outputs for g in x.get("goods", []))
            if consumed.get(key, 0) != exp_c or received.get(key, 0) != exp_r:
                issues.append(_issue(
                    "stock_ledger_mismatch", "error", o,
                    f"Recorded output says {exp_c} consumed / {exp_r} received, but the stock ledger "
                    f"shows {consumed.get(key, 0)} / {received.get(key, 0)}.",
                ))

        posting = o.inventory_posting if isinstance(o.inventory_posting, dict) else None
        if status == "completed" and o.inventory_posted_at and posting:
            exp_consumed = sum(int(c.get("qty") or 0) for c in posting.get("components", []))
            exp_received = sum(int(g.get("qty") or 0) for g in posting.get("goods", []))
            if consumed.get(key, 0) != exp_consumed or received.get(key, 0) != exp_received:
                issues.append(_issue(
                    "stock_ledger_mismatch", "error", o,
                    f"Posting says {exp_consumed} consumed / {exp_received} received, but the stock ledger "
                    f"shows {consumed.get(key, 0)} / {received.get(key, 0)}.",
                ))
            accounting = posting.get("accounting") or {}
            if accounting.get("status") == "posted" and str(event_id(o.id)) not in live_journals:
                issues.append(_issue(
                    "journal_missing", "error", o,
                    f"Journal {accounting.get('entry_no')} was posted for this order but is no longer live in the ledger.",
                ))
            elif accounting.get("status") == "skipped":
                issues.append(_issue(
                    "journal_not_posted", "warning", o,
                    f"Completed without a ledger entry: {accounting.get('reason')}",
                ))

    # Reservations held by orders that do not hold materials any more.
    active = (await db.execute(
        select(StockReservation).where(
            StockReservation.vendor_id == vendor_id,
            StockReservation.order_type == ORDER_TYPE,
            StockReservation.status == "active",
        )
    )).scalars().all()
    stale_by_order: dict[str, int] = {}
    for r in active:
        order = by_id.get(str(r.order_id))
        if order is None or (order.status or "draft") not in LIVE_STATUSES:
            stale_by_order[str(r.order_id)] = stale_by_order.get(str(r.order_id), 0) + 1
    for order_id, n in stale_by_order.items():
        order = by_id.get(order_id)
        issues.append({
            "code": "stale_reservation", "severity": "warning", "fixable": True,
            "order_id": order_id, "ref": order.ref if order else None,
            "detail": f"{n} active reservation(s) held by an order that is "
                      f"{(order.status if order else 'deleted')} — stock is blocked for nothing.",
        })

    return issues[:limit]


async def repair_safe_issues(db: AsyncSession, vendor_id: UUID) -> dict[str, int]:
    """Release reservations that belong to orders which no longer hold materials."""
    live_ids = {
        str(i) for (i,) in (await db.execute(
            select(ProductionOrder.id).where(
                ProductionOrder.vendor_id == vendor_id, ProductionOrder.status.in_(tuple(LIVE_STATUSES)),
            )
        )).all()
    }
    active = (await db.execute(
        select(StockReservation).where(
            StockReservation.vendor_id == vendor_id,
            StockReservation.order_type == ORDER_TYPE,
            StockReservation.status == "active",
        )
    )).scalars().all()
    now = datetime.now(timezone.utc)
    released = 0
    for r in active:
        if str(r.order_id) not in live_ids:
            r.status = "released"
            r.released_at = now
            released += 1
    await db.flush()
    return {"released_reservations": released}
