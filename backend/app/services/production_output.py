"""Partial output: receive part of a production run into stock before the order is completed.

How it fits with completion
---------------------------
* ``record_output`` moves stock for *part* of the order right away: it receives the
  finished goods and consumes the matching share of every component (floor of
  ``required x done / ordered``; the final completion takes the remainder, so the
  total consumed always equals the requirement exactly).
* Each recorded output is kept in ``ProductionOrder.partial_outputs`` with the exact
  stock allocations, so it can be reversed on its own while the order is open.
* Completion posts the *remaining* quantity, folds the recorded outputs into the one
  ``inventory_posting`` snapshot (entries are tagged with the output id they belong
  to) and books a single journal for the whole run. Labor is absorbed by the final
  receipt, so earlier outputs carry material cost only.
* Re-opening a completed order reverses only the final receipt; recorded outputs
  stay in stock until they are reversed individually.
* Batch/lot-managed products are excluded: genealogy is per order, so they must be
  completed in one go.
"""
from __future__ import annotations

import copy
import uuid as uuid_mod
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryMovement
from app.models.mrp import StockReservation
from app.models.production import ProductionOrder
from app.models.vendor_product import Product
from app.services.mrp_service import lock_product_scope
from app.services.production_inventory import (
    ORDER_TYPE,
    _component_qty,
    _draw_down_component,
    _finished_goods,
    _restore_component,
    _uuid_or_none,
)
from app.services.production_lifecycle import append_audit
from app.services.production_materials import reserve_materials
from app.services.production_valuation import apply_valuation, dec, q_cost, q_money, refresh_cached_cost, resolve_unit_cost
from app.services.store_inventory_service import (
    apply_store_inventory_delta,
    get_store_inventory_row,
    sync_product_quantity_from_stores,
)

OUTPUT_STATUSES = frozenset({"in_production", "qc"})


class OutputError(ValueError):
    """The output cannot be recorded or reversed. ``status_code`` is the HTTP code to answer
    with: 400 for invalid input, 409 when the order's state or stock does not allow it."""

    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.status_code = status_code


# ── Helpers ───────────────────────────────────────────────────────────────

def outputs_of(order: ProductionOrder) -> list[dict[str, Any]]:
    return [o for o in (order.partial_outputs or []) if isinstance(o, dict)]


def produced_by_product(order: ProductionOrder) -> dict[str, int]:
    out: dict[str, int] = {}
    for o in outputs_of(order):
        for g in o.get("goods", []):
            out[str(g["product_id"])] = out.get(str(g["product_id"]), 0) + int(g.get("qty") or 0)
    return out


def consumed_by_component(order: ProductionOrder) -> dict[str, int]:
    out: dict[str, int] = {}
    for o in outputs_of(order):
        for c in o.get("components", []):
            out[str(c["component_id"])] = out.get(str(c["component_id"]), 0) + int(c.get("qty") or 0)
    return out


def ordered_by_product(order: ProductionOrder) -> dict[str, int]:
    out: dict[str, int] = {}
    for g in _finished_goods(order):
        out[str(g["product_id"])] = out.get(str(g["product_id"]), 0) + g["qty"]
    return out


def output_summary(order: ProductionOrder) -> dict[str, Any]:
    ordered = ordered_by_product(order)
    done = produced_by_product(order)
    names = {str(g["product_id"]): g.get("name") for g in _finished_goods(order)}
    return {
        "products": [
            {
                "product_id": pid, "name": names.get(pid), "ordered": qty,
                "produced": done.get(pid, 0), "remaining": max(qty - done.get(pid, 0), 0),
            }
            for pid, qty in ordered.items()
        ],
        "outputs": [
            {
                "id": o["id"], "recorded_at": o.get("recorded_at"), "actor": o.get("actor"),
                "notes": o.get("notes"), "qty": o.get("qty"), "material": o.get("material"),
                "goods": [{"product_id": g["product_id"], "name": g.get("name"), "qty": g["qty"]} for g in o.get("goods", [])],
            }
            for o in outputs_of(order)
        ],
    }


def _bump_produced(order: ProductionOrder, product_id: str, delta: int) -> None:
    """Add (or remove) produced units on the order's item lines for a product."""
    items = copy.deepcopy(list(order.items or []))
    remaining = delta
    for it in items:
        if remaining == 0:
            break
        if not isinstance(it, dict) or str(it.get("product_id")) != product_id or it.get("variant_id"):
            continue
        if it.get("item_type") not in (None, "product"):
            continue
        cur = float(it.get("produced") or 0)
        qty = float(it.get("qty") or 0)
        if remaining > 0:
            step = min(remaining, max(qty - cur, 0))
        else:
            step = -min(-remaining, cur)
        it["produced"] = cur + step
        remaining -= int(step)
    order.items = items


def mark_items_produced(order: ProductionOrder) -> None:
    """On completion every product line counts as fully produced."""
    items = copy.deepcopy(list(order.items or []))
    for it in items:
        if isinstance(it, dict) and it.get("item_type") in (None, "product") and it.get("product_id"):
            it["produced"] = it.get("qty") or 0
    order.items = items


# ── Record ────────────────────────────────────────────────────────────────

async def record_output(
    db: AsyncSession,
    vendor_id: UUID,
    order: ProductionOrder,
    quantities: dict[str, int],
    *,
    actor: str,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    status = order.status or "draft"
    if status not in OUTPUT_STATUSES:
        raise OutputError(
            f"Output can only be recorded while the order is in production or in QC (it is {status})."
        )
    if not order.store_id:
        raise OutputError("Assign a business unit to this production order before recording output.")

    ordered = ordered_by_product(order)
    if not ordered:
        raise OutputError("This order has no products to receive into stock.")
    done = produced_by_product(order)

    req = {pid: int(q) for pid, q in quantities.items() if int(q) > 0}
    if not req:
        raise OutputError("Enter a quantity greater than zero.", 400)
    for pid, q in req.items():
        if pid not in ordered:
            raise OutputError("That product is not part of this order.", 400)
        if done.get(pid, 0) + q > ordered[pid]:
            raise OutputError(
                f"Only {ordered[pid] - done.get(pid, 0)} unit(s) of this product remain to be produced.", 400,
            )
    total_q = sum(req.values())
    total_ordered = sum(ordered.values())
    total_done = sum(done.values())
    if total_done + total_q >= total_ordered:
        raise OutputError(
            "This would deliver the whole order. Complete the order instead — it posts the last "
            "units together with labor and the journal.", 400,
        )

    # Lot-managed items need one genealogy per order.
    flagged_ids: list[UUID] = [UUID(p) for p in ordered]
    flagged_ids += [UUID(str(c["component_id"])) for c in (order.material_requirements or []) if c.get("component_id")]
    managed = (await db.execute(
        select(Product.name).where(
            Product.vendor_id == vendor_id, Product.id.in_(flagged_ids), Product.batch_managed.is_(True),
        )
    )).scalars().all()
    if managed:
        raise OutputError(
            f"{', '.join(sorted(set(managed)))} is batch-managed; complete the order in one go instead of partial output."
        )

    await reserve_materials(db, vendor_id, order)

    now = datetime.now(timezone.utc)
    out_id = f"out-{uuid_mod.uuid4().hex[:8]}"
    consumed_before = consumed_by_component(order)
    lines: list[str] = []
    comp_entries: list[dict[str, Any]] = []
    material_total = Decimal("0")

    for comp in order.material_requirements or []:
        try:
            component_id = UUID(str(comp["component_id"]))
        except (KeyError, ValueError, TypeError):
            continue
        required = _component_qty(comp)
        if required <= 0:
            continue
        take = required * (total_done + total_q) // total_ordered - consumed_before.get(str(component_id), 0)
        if take <= 0:
            continue
        name = comp.get("component_name", "Component")

        await lock_product_scope(db, vendor_id, order.store_id, component_id)
        try:
            allocations = await _draw_down_component(db, vendor_id, order.store_id, component_id, take)
        except ValueError as exc:
            raise OutputError(f"{name}: {exc}") from exc
        await sync_product_quantity_from_stores(db, vendor_id, component_id, None)
        for alloc in allocations:
            db.add(InventoryMovement(
                id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=component_id, variant_id=None,
                movement_type="production_consumption", quantity=-alloc["qty"],
                quantity_before=alloc["before"], quantity_after=alloc["before"] - alloc["qty"],
                reason=f"Consumed for partial output of production order {order.ref}",
                reference_type="production_order", reference_id=order.id,
                store_id=order.store_id, storage_location_id=_uuid_or_none(alloc["storage_location_id"]),
            ))
        unit_cost = await resolve_unit_cost(db, vendor_id, component_id, order.plant_id, fallback=comp.get("cost_price"))
        amount = q_money(unit_cost * take)
        material_total += amount
        await apply_valuation(db, vendor_id, component_id, order.plant_id, Decimal(-take), unit_cost)

        # The soft hold shrinks by what has physically left stock.
        released = 0
        resvs = (await db.execute(select(StockReservation).where(
            StockReservation.vendor_id == vendor_id, StockReservation.order_type == ORDER_TYPE,
            StockReservation.order_id == str(order.id), StockReservation.product_id == component_id,
            StockReservation.status == "active",
        ))).scalars().all()
        left = Decimal(take)
        for r in resvs:
            cut = min(left, dec(r.reserved_qty))
            r.reserved_qty = dec(r.reserved_qty) - cut
            left -= cut
            released += int(cut)
            if left <= 0:
                break

        comp_entries.append({
            "component_id": str(component_id), "name": name, "qty": take,
            "unit_cost": str(unit_cost), "amount": str(amount), "batch": out_id,
            "reservation_released": released,
            "allocations": [{"storage_location_id": a["storage_location_id"], "qty": a["qty"]} for a in allocations],
        })
        lines.append(f"-{take} x {name} @ {unit_cost} = {amount}")

    unit_cost_fg = q_cost(material_total / total_q) if total_q else Decimal("0")
    output_location = order.output_storage_location_id
    goods_entries: list[dict[str, Any]] = []
    names = {str(g["product_id"]): g.get("name") for g in _finished_goods(order)}
    for pid, q in req.items():
        product_id = UUID(pid)
        await lock_product_scope(db, vendor_id, order.store_id, product_id)
        existing = await get_store_inventory_row(db, order.store_id, product_id, None, output_location)
        before = int(existing.quantity) if existing else 0
        await apply_store_inventory_delta(
            db, vendor_id, order.store_id, product_id, None, q, storage_location_id=output_location,
        )
        await sync_product_quantity_from_stores(db, vendor_id, product_id, None)
        db.add(InventoryMovement(
            id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=product_id, variant_id=None,
            movement_type="production_receipt", quantity=q, quantity_before=before, quantity_after=before + q,
            reason=f"Partial output from production order {order.ref}",
            reference_type="production_order", reference_id=order.id,
            store_id=order.store_id, storage_location_id=output_location,
        ))
        await apply_valuation(db, vendor_id, product_id, order.plant_id, Decimal(q), unit_cost_fg)
        await refresh_cached_cost(db, vendor_id, product_id, order.plant_id)
        goods_entries.append({
            "product_id": pid, "name": names.get(pid) or "product", "qty": q,
            "unit_cost": str(unit_cost_fg), "batch": out_id,
            "storage_location_id": str(output_location) if output_location else None,
        })
        _bump_produced(order, pid, q)
        lines.append(f"+{q} x {names.get(pid) or 'product'} @ {unit_cost_fg}")

    entry = {
        "id": out_id, "recorded_at": now.isoformat(), "actor": actor, "notes": (notes or "").strip() or None,
        "qty": total_q, "material": str(material_total),
        "store_id": str(order.store_id), "components": comp_entries, "goods": goods_entries,
    }
    order.partial_outputs = [*outputs_of(order), entry]
    order.progress = max(order.progress or 0, min(99, round(100 * (total_done + total_q) / total_ordered)))
    append_audit(
        order, "output_recorded",
        f"{total_q} unit(s) received into stock ({total_done + total_q} of {total_ordered})",
        actor=actor, meta={"output_id": out_id, "qty": total_q, "lines": lines},
    )
    await db.flush()
    return entry


# ── Reverse ───────────────────────────────────────────────────────────────

async def reverse_output(
    db: AsyncSession, vendor_id: UUID, order: ProductionOrder, output_id: str, *, actor: str,
) -> None:
    status = order.status or "draft"
    if status == "completed":
        raise OutputError("Re-open the completed order before reversing its output.")
    entry = next((o for o in outputs_of(order) if o.get("id") == output_id), None)
    if entry is None:
        raise OutputError("Output record not found.", 404)
    store_id = _uuid_or_none(entry.get("store_id")) or order.store_id
    if not store_id:
        raise OutputError("The output has no business unit.")

    lines: list[str] = []
    for g in entry.get("goods", []):
        product_id = _uuid_or_none(g.get("product_id"))
        q = int(g.get("qty") or 0)
        if not product_id or q <= 0:
            continue
        loc = _uuid_or_none(g.get("storage_location_id"))
        await lock_product_scope(db, vendor_id, store_id, product_id)
        existing = await get_store_inventory_row(db, store_id, product_id, None, loc)
        before = int(existing.quantity) if existing else 0
        try:
            await apply_store_inventory_delta(db, vendor_id, store_id, product_id, None, -q, storage_location_id=loc)
        except ValueError as exc:
            raise OutputError(
                f"Cannot reverse: {g.get('name', 'the finished goods')} from this output have already been used or moved ({exc})"
            ) from exc
        await sync_product_quantity_from_stores(db, vendor_id, product_id, None)
        if g.get("unit_cost") is not None:
            await apply_valuation(db, vendor_id, product_id, order.plant_id, Decimal(-q), dec(g["unit_cost"]))
            await refresh_cached_cost(db, vendor_id, product_id, order.plant_id)
        db.add(InventoryMovement(
            id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=product_id, variant_id=None,
            movement_type="production_receipt_reversal", quantity=-q, quantity_before=before, quantity_after=before - q,
            reason=f"Partial output reversed on production order {order.ref}",
            reference_type="production_order", reference_id=order.id,
            store_id=store_id, storage_location_id=loc,
        ))
        _bump_produced(order, str(product_id), -q)
        lines.append(f"Reversed receipt of {q} x {g.get('name', 'product')}")

    for c in entry.get("components", []):
        component_id = _uuid_or_none(c.get("component_id"))
        if not component_id:
            continue
        await lock_product_scope(db, vendor_id, store_id, component_id)
        restored = 0
        for alloc in c.get("allocations", []):
            qty = int(alloc.get("qty") or 0)
            if qty <= 0:
                continue
            loc = _uuid_or_none(alloc.get("storage_location_id"))
            before = await _restore_component(db, vendor_id, store_id, component_id, loc, qty)
            db.add(InventoryMovement(
                id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=component_id, variant_id=None,
                movement_type="production_consumption_reversal", quantity=qty,
                quantity_before=before, quantity_after=before + qty,
                reason=f"Partial output reversed on production order {order.ref}",
                reference_type="production_order", reference_id=order.id,
                store_id=store_id, storage_location_id=loc,
            ))
            restored += qty
        await sync_product_quantity_from_stores(db, vendor_id, component_id, None)
        if c.get("unit_cost") is not None and restored > 0:
            await apply_valuation(db, vendor_id, component_id, order.plant_id, Decimal(restored), dec(c["unit_cost"]))
        lines.append(f"Reversed consumption of {restored} x {c.get('name', 'component')}")

        give_back = int(c.get("reservation_released") or 0)
        if give_back > 0:
            resv = (await db.execute(select(StockReservation).where(
                StockReservation.vendor_id == vendor_id, StockReservation.order_type == ORDER_TYPE,
                StockReservation.order_id == str(order.id), StockReservation.product_id == component_id,
                StockReservation.status == "active",
            ))).scalars().first()
            if resv is not None:
                resv.reserved_qty = dec(resv.reserved_qty) + Decimal(give_back)

    order.partial_outputs = [o for o in outputs_of(order) if o.get("id") != output_id]
    remaining_total = sum(produced_by_product(order).values())
    ordered_total = sum(ordered_by_product(order).values()) or 1
    order.progress = min(99, round(100 * remaining_total / ordered_total))
    append_audit(
        order, "output_reversed", f"Output of {entry.get('qty')} unit(s) reversed",
        actor=actor, meta={"output_id": output_id, "lines": lines},
    )
    await db.flush()
