"""Posts the physical stock movements for a Production Order on completion.

  completed        -> post_production_completion()   consume leaf materials
                       (from the material_requirements snapshot taken at
                       confirm time) + receive finished goods into stock.
  completed -> ...  -> reverse_production_completion() undoes the postings
                       when a completed order is re-opened.

Both are idempotent (guarded by ProductionOrder.inventory_posted_at) and
store-scoped (all movements are against StoreInventory for order.store_id,
which is the authoritative on-hand quantity — see app/services/mrp_service.py
for why global Product.quantity is only a derived rollup here).

Posting snapshot
----------------
Every posting records exactly what it moved in ``ProductionOrder.inventory_posting``
(store, per-location component allocations, finished-goods lines). The reversal
replays that record instead of re-deriving it from the order's current fields, so
it always undoes what was really posted — even for legacy orders (no snapshot)
where it falls back to the old derivation.

Components are drawn down across *all* storage locations of the business unit
(default/unassigned location first, then largest balance first) — matching how
MRP availability is computed (sum across locations) — and each allocation is
recorded so a reversal restores stock to the same bins.

Reversal is strict: if finished goods (or their batches) have already moved on,
the re-open is refused instead of silently leaving stock inflated.
"""
from __future__ import annotations

import copy
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID
import uuid as uuid_mod

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryMovement
from app.models.mrp import StockReservation
from app.models.production import ProductionOrder
from app.models.store import StoreInventory
from app.services.mrp_service import lock_product_scope
from app.services.production_accounting import post_completion_accounting, reverse_completion_accounting
from app.services.production_costing import (
    freeze_operation_rates,
    recalculate_labor_cost,
    unfreeze_operation_rates,
)
from app.services.production_valuation import (
    apply_valuation,
    dec,
    q_cost,
    q_money,
    refresh_cached_cost,
    resolve_unit_cost,
)
from app.services.store_inventory_service import (
    apply_store_inventory_delta,
    get_store_inventory_row,
    sync_product_quantity_from_stores,
)

ORDER_TYPE = "production_order"


def _finished_goods(order: ProductionOrder) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in order.items or []:
        if not isinstance(item, dict) or item.get("item_type") not in (None, "product"):
            continue
        pid = item.get("product_id")
        qty = item.get("qty")
        if not pid or not qty:
            continue
        try:
            qty_int = int(Decimal(str(qty)))
        except (ValueError, TypeError, ArithmeticError):
            continue
        if qty_int <= 0:
            continue
        out.append({"product_id": pid, "qty": qty_int, "name": item.get("name")})
    return out


def _append_audit(order: ProductionOrder, action: str, detail: str, lines: list[str]) -> None:
    if not lines:
        return
    log = list(order.audit_log or [])
    log.append({
        "id": f"{action}-{uuid_mod.uuid4().hex[:8]}",
        "action": action,
        "actor": "System",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detail": detail,
        "meta": {"lines": lines},
    })
    order.audit_log = log


def _component_qty(comp: dict[str, Any]) -> int:
    try:
        return int(Decimal(str(comp.get("reserve_qty") or comp.get("required_qty") or 0)))
    except (ValueError, TypeError, ArithmeticError):
        return 0


async def _draw_down_component(
    db: AsyncSession, vendor_id: UUID, store_id: UUID, product_id: UUID, qty: int,
) -> list[dict[str, Any]]:
    """Take ``qty`` units of a component out of the business unit's stock,
    spreading across storage locations. Raises ValueError when short."""
    rows = (
        await db.execute(
            select(StoreInventory)
            .where(
                StoreInventory.vendor_id == vendor_id,
                StoreInventory.store_id == store_id,
                StoreInventory.product_id == product_id,
                StoreInventory.variant_id.is_(None),
                StoreInventory.quantity > 0,
            )
            .with_for_update()
        )
    ).scalars().all()
    rows = sorted(rows, key=lambda r: (r.storage_location_id is not None, -(r.quantity or 0)))
    available = sum(int(r.quantity or 0) for r in rows)
    if available < qty:
        raise ValueError(f"Insufficient stock at this business unit. Available: {available}, required: {qty}")

    remaining = qty
    allocations: list[dict[str, Any]] = []
    for row in rows:
        if remaining <= 0:
            break
        before = int(row.quantity or 0)
        take = min(remaining, before)
        row.quantity = before - take
        allocations.append({
            "storage_location_id": str(row.storage_location_id) if row.storage_location_id else None,
            "qty": take,
            "before": before,
        })
        remaining -= take
    return allocations


async def _restore_component(
    db: AsyncSession, vendor_id: UUID, store_id: UUID, product_id: UUID,
    location_id: UUID | None, qty: int,
) -> int:
    """Put stock back into a specific bin (creating the row if needed). Skips the
    active-location validation on purpose: a bin deactivated since posting must
    still be able to receive its stock back. Returns the quantity before."""
    row = await get_store_inventory_row(db, store_id, product_id, None, location_id, for_update=True)
    if row:
        before = int(row.quantity or 0)
        row.quantity = before + qty
        return before
    db.add(StoreInventory(
        store_id=store_id, vendor_id=vendor_id, product_id=product_id, variant_id=None,
        storage_location_id=location_id, quantity=qty,
    ))
    return 0


def _uuid_or_none(v: Any) -> UUID | None:
    if not v:
        return None
    try:
        return UUID(str(v))
    except (ValueError, TypeError):
        return None


async def _consume_reservations(
    db: AsyncSession, vendor_id: UUID, order: ProductionOrder, component_id: UUID, now: datetime,
) -> None:
    rows = (await db.execute(select(StockReservation).where(
        StockReservation.vendor_id == vendor_id,
        StockReservation.order_type == ORDER_TYPE,
        StockReservation.order_id == str(order.id),
        StockReservation.product_id == component_id,
        StockReservation.status == "active",
    ))).scalars().all()
    for resv in rows:
        resv.status = "consumed"
        resv.consumed_at = now


async def _byproduct_lines(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> list[dict[str, Any]]:
    """By-products the order yields on completion: effective by-product BOM lines of each
    finished product, scaled by the ordered quantity (rounded half up; zero is skipped)."""
    from datetime import date
    from sqlalchemy import or_
    from app.models.mrp import ProductBOMItem
    from app.models.vendor_product import Product as _Prod

    ordered: dict[UUID, int] = {}
    for fg in _finished_goods(order):
        pid = _uuid_or_none(fg["product_id"])
        if pid:
            ordered[pid] = ordered.get(pid, 0) + fg["qty"]
    if not ordered:
        return []
    today = date.today()
    rows = (await db.execute(
        select(ProductBOMItem).where(
            ProductBOMItem.vendor_id == vendor_id,
            ProductBOMItem.product_id.in_(list(ordered)),
            ProductBOMItem.is_byproduct.is_(True),
            or_(ProductBOMItem.valid_from.is_(None), ProductBOMItem.valid_from <= today),
            or_(ProductBOMItem.valid_to.is_(None), ProductBOMItem.valid_to >= today),
        )
    )).scalars().all()
    if not rows:
        return []
    names = {
        p.id: p.name for p in (await db.execute(
            select(_Prod).where(_Prod.id.in_([r.component_id for r in rows]))
        )).scalars().all()
    }
    out: list[dict[str, Any]] = []
    for r in rows:
        qty = int((dec(r.qty_per_unit) * ordered[r.product_id]).quantize(Decimal("1"), rounding="ROUND_HALF_UP"))
        if qty <= 0:
            continue
        out.append({
            "product_id": r.component_id, "name": names.get(r.component_id, "by-product"),
            "qty": qty, "share": dec(r.cost_share_pct),
        })
    return out


def _is_final(entry: dict[str, Any]) -> bool:
    """Entries of a completion posting that the re-open reverses (recorded partial outputs stay)."""
    return entry.get("batch") in (None, "final")


async def post_production_completion(
    db: AsyncSession, vendor_id: UUID, order: ProductionOrder, actor_id: UUID | None = None,
) -> ProductionOrder:
    """Consume reserved components and receive finished goods into StoreInventory,
    value both at actual cost and post the general-ledger journal.
    Idempotent via inventory_posted_at. Raises ValueError (caller should turn
    this into an HTTP 400) if the order has no business unit assigned, if
    physical stock is insufficient to cover the consumption, or if the journal
    cannot be posted (e.g. closed accounting period)."""
    if order.inventory_posted_at:
        return order
    if not order.store_id:
        raise ValueError("Assign a business unit to this production order before completing it.")

    now = datetime.now(timezone.utc)
    lines: list[str] = []
    # Component lots consumed this posting — linked into each FG batch for genealogy.
    consumed_component_links: list[dict[str, Any]] = []
    material_total = Decimal("0")
    posting: dict[str, Any] = {
        "version": 2,
        "posted_at": now.isoformat(),
        "store_id": str(order.store_id),
        "plant_id": str(order.plant_id) if order.plant_id else None,
        "output_storage_location_id": str(order.output_storage_location_id) if order.output_storage_location_id else None,
        "components": [],
        "goods": [],
    }

    # Output already received through partial outputs is part of this posting: its entries are
    # folded into the snapshot (tagged with the output id) and only the remainder is posted now.
    from app.services.production_output import consumed_by_component, outputs_of, produced_by_product
    prior_outputs = outputs_of(order)
    consumed_prior = consumed_by_component(order)
    produced_prior = produced_by_product(order)
    prior_material = sum((dec(o.get("material")) for o in prior_outputs), Decimal("0"))
    for o in prior_outputs:
        posting["components"].extend(copy.deepcopy(o.get("components", [])))
        posting["goods"].extend(copy.deepcopy(o.get("goods", [])))

    # 1. Consume leaf materials from the snapshot taken when materials were reserved.
    for comp in order.material_requirements or []:
        try:
            component_id = UUID(str(comp["component_id"]))
        except (KeyError, ValueError, TypeError):
            continue
        required_total = _component_qty(comp)
        qty_int = required_total - consumed_prior.get(str(component_id), 0)
        if qty_int <= 0:
            if required_total > 0:  # fully consumed by earlier outputs: just close the hold
                await _consume_reservations(db, vendor_id, order, component_id, now)
            continue
        name = comp.get("component_name", "Component")

        await lock_product_scope(db, vendor_id, order.store_id, component_id)
        try:
            allocations = await _draw_down_component(db, vendor_id, order.store_id, component_id, qty_int)
        except ValueError as exc:
            raise ValueError(f"{name}: {exc}") from exc
        await sync_product_quantity_from_stores(db, vendor_id, component_id, None)

        for alloc in allocations:
            db.add(InventoryMovement(
                id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=component_id, variant_id=None,
                movement_type="production_consumption", quantity=-alloc["qty"],
                quantity_before=alloc["before"], quantity_after=alloc["before"] - alloc["qty"],
                reason=f"Consumed for production order {order.ref}",
                reference_type="production_order", reference_id=order.id,
                store_id=order.store_id,
                storage_location_id=_uuid_or_none(alloc["storage_location_id"]),
            ))
        # Value the issue at the product's current valuation price (the price the
        # reservation snapshot captured is only a fallback).
        unit_cost = await resolve_unit_cost(
            db, vendor_id, component_id, order.plant_id, fallback=comp.get("cost_price"),
        )
        amount = q_money(unit_cost * qty_int)
        material_total += amount
        await apply_valuation(db, vendor_id, component_id, order.plant_id, Decimal(-qty_int), unit_cost)
        posting["components"].append({
            "component_id": str(component_id),
            "name": name,
            "qty": qty_int,
            "unit_cost": str(unit_cost),
            "amount": str(amount),
            "batch": "final",
            "allocations": [
                {"storage_location_id": a["storage_location_id"], "qty": a["qty"]} for a in allocations
            ],
        })
        lines.append(f"-{qty_int} x {name} @ {unit_cost} = {amount}")

        # Pharma: FEFO-consume GoodsBatch when component is batch-managed (hard fail).
        from app.models.vendor_product import Product as _Product
        from app.services.pharma_batch import consume_batches_for_production
        prod_row = (
            await db.execute(
                select(_Product).where(_Product.id == component_id, _Product.vendor_id == vendor_id)
            )
        ).scalar_one_or_none()
        if prod_row and getattr(prod_row, "batch_managed", False):
            batch_details = await consume_batches_for_production(
                db,
                vendor_id=vendor_id,
                product_id=component_id,
                quantity=Decimal(qty_int),
                production_order_id=order.id,
                plant_id=order.plant_id,
            )
            consumed_component_links.extend(batch_details)
            lot_bits = ", ".join(f"{d['batch_number']}({d['qty']})" for d in batch_details)
            lines.append(f"  lots: {lot_bits}")

        await _consume_reservations(db, vendor_id, order, component_id, now)

    # Cost of the run: materials actually issued + labor (actual hours, else planned).
    # Labor is absorbed by this (final) receipt; earlier partial outputs carried material only.
    await freeze_operation_rates(db, vendor_id, order.id)
    await recalculate_labor_cost(db, vendor_id, order.id)
    labor_total = q_money(dec(order.actual_labor_cost) if dec(order.actual_labor_cost) > 0 else dec(order.planned_labor_cost))
    final_cost = material_total + labor_total
    fg_list = _finished_goods(order)
    if prior_outputs:
        left: dict[str, int] = {}
        names: dict[str, Any] = {}
        for fg in fg_list:
            left[str(fg["product_id"])] = left.get(str(fg["product_id"]), 0) + fg["qty"]
            names[str(fg["product_id"])] = fg.get("name")
        fg_list = [
            {"product_id": pid, "qty": qty - produced_prior.get(pid, 0), "name": names.get(pid)}
            for pid, qty in left.items() if qty - produced_prior.get(pid, 0) > 0
        ]
    fg_qty_total = sum(fg["qty"] for fg in fg_list)
    # By-products carry their configured share of this receipt's cost; the main goods keep the rest.
    byproducts = await _byproduct_lines(db, vendor_id, order)
    share_total = min(sum((b["share"] for b in byproducts), Decimal("0")), Decimal("100"))
    byproduct_cost = q_money(final_cost * share_total / Decimal("100")) if byproducts else Decimal("0")
    fg_unit_cost = q_cost((final_cost - byproduct_cost) / fg_qty_total) if fg_qty_total > 0 else Decimal("0")
    all_material = material_total + prior_material
    total_cost = all_material + labor_total
    all_qty = fg_qty_total + sum(produced_prior.values())
    posting["costing"] = {
        "material": str(all_material),
        "labor": str(labor_total),
        "total": str(total_cost),
        "unit_cost": str(q_cost((total_cost - byproduct_cost) / all_qty)) if all_qty > 0 else "0",
        "labor_basis": "actual" if dec(order.actual_labor_cost) > 0 else "planned",
    }
    if prior_outputs:
        posting["costing"]["partial_outputs"] = len(prior_outputs)
        posting["costing"]["final_unit_cost"] = str(fg_unit_cost)
    if byproduct_cost > 0:
        posting["costing"]["byproduct_cost"] = str(byproduct_cost)
    lines.append(f"Cost: materials {all_material} + labor {labor_total} = {total_cost} ({posting['costing']['unit_cost']}/unit)")

    # 2. Receive finished goods into the output storage location (or store default).
    output_location = order.output_storage_location_id
    for fg in fg_list:
        try:
            product_id = UUID(str(fg["product_id"]))
        except ValueError:
            continue
        qty_int = fg["qty"]

        await lock_product_scope(db, vendor_id, order.store_id, product_id)
        existing = await get_store_inventory_row(db, order.store_id, product_id, None, output_location)
        qty_before = int(existing.quantity) if existing else 0

        await apply_store_inventory_delta(
            db, vendor_id, order.store_id, product_id, None, qty_int, storage_location_id=output_location,
        )
        await sync_product_quantity_from_stores(db, vendor_id, product_id, None)

        db.add(InventoryMovement(
            id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=product_id, variant_id=None,
            movement_type="production_receipt", quantity=qty_int,
            quantity_before=qty_before, quantity_after=qty_before + qty_int,
            reason=f"Received from production order {order.ref}",
            reference_type="production_order", reference_id=order.id,
            store_id=order.store_id, storage_location_id=output_location,
        ))
        await apply_valuation(db, vendor_id, product_id, order.plant_id, Decimal(qty_int), fg_unit_cost)
        await refresh_cached_cost(db, vendor_id, product_id, order.plant_id)
        posting["goods"].append({
            "product_id": str(product_id),
            "name": fg.get("name") or "product",
            "qty": qty_int,
            "unit_cost": str(fg_unit_cost),
            "batch": "final",
            "storage_location_id": str(output_location) if output_location else None,
        })
        lines.append(f"+{qty_int} x {fg.get('name', 'product')} @ {fg_unit_cost}")

        # Pharma: create FG GoodsBatch when product is batch-managed (hard fail + genealogy).
        from app.models.vendor_product import Product as _Product
        from app.services.pharma_batch import create_production_batch
        fg_prod = (
            await db.execute(
                select(_Product).where(_Product.id == product_id, _Product.vendor_id == vendor_id)
            )
        ).scalar_one_or_none()
        if fg_prod and getattr(fg_prod, "batch_managed", False):
            qc_req = bool(getattr(fg_prod, "qc_required_on_production", False))
            fg_batch = await create_production_batch(
                db,
                vendor_id=vendor_id,
                product_id=product_id,
                quantity=Decimal(qty_int),
                production_order_id=order.id,
                plant_id=order.plant_id,
                storage_location_id=output_location,
                qc_required=qc_req,
                component_links=consumed_component_links,
            )
            lines.append(f"  FG batch {fg_batch.batch_number} ({fg_batch.quality_status})")

    # 3. By-products received alongside the main goods.
    from app.models.vendor_product import Product as _Product
    for bp in byproducts:
        product_id = bp["product_id"]
        qty_int = bp["qty"]
        bp_prod = (await db.execute(
            select(_Product).where(_Product.id == product_id, _Product.vendor_id == vendor_id)
        )).scalar_one_or_none()
        if bp_prod is not None and getattr(bp_prod, "batch_managed", False):
            raise ValueError(
                f"By-product {bp_prod.name} is batch-managed, which is not supported for by-products."
            )
        unit_cost = (
            q_cost(byproduct_cost * (bp["share"] / share_total) / qty_int) if share_total > 0 else Decimal("0")
        )
        await lock_product_scope(db, vendor_id, order.store_id, product_id)
        existing = await get_store_inventory_row(db, order.store_id, product_id, None, output_location)
        qty_before = int(existing.quantity) if existing else 0
        await apply_store_inventory_delta(
            db, vendor_id, order.store_id, product_id, None, qty_int, storage_location_id=output_location,
        )
        await sync_product_quantity_from_stores(db, vendor_id, product_id, None)
        db.add(InventoryMovement(
            id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=product_id, variant_id=None,
            movement_type="production_receipt", quantity=qty_int,
            quantity_before=qty_before, quantity_after=qty_before + qty_int,
            reason=f"By-product received from production order {order.ref}",
            reference_type="production_order", reference_id=order.id,
            store_id=order.store_id, storage_location_id=output_location,
        ))
        await apply_valuation(db, vendor_id, product_id, order.plant_id, Decimal(qty_int), unit_cost)
        await refresh_cached_cost(db, vendor_id, product_id, order.plant_id)
        posting["goods"].append({
            "product_id": str(product_id), "name": bp["name"], "qty": qty_int, "unit_cost": str(unit_cost),
            "batch": "final", "byproduct": True,
            "storage_location_id": str(output_location) if output_location else None,
        })
        lines.append(f"+{qty_int} x {bp['name']} (by-product) @ {unit_cost}")

    order.actual_material_cost = all_material if posting["components"] else None

    # General ledger + Controlling bridge (same transaction: a failure undoes the stock moves).
    accounting = await post_completion_accounting(db, vendor_id, order, posting, actor_id)
    posting["accounting"] = accounting
    if accounting["status"] == "posted":
        lines.append(f"Journal {accounting.get('entry_no')} posted for {accounting['amount']}")
    else:
        lines.append(f"Journal not posted: {accounting.get('reason')}")

    order.inventory_posting = posting
    order.inventory_posted_at = now
    _append_audit(order, "inventory_posted", "Materials consumed and finished goods received", lines)
    await db.flush()
    return order


def _legacy_posting(order: ProductionOrder) -> dict[str, Any]:
    """Best-effort reconstruction for orders posted before snapshots existed."""
    return {
        "version": 1,
        "store_id": str(order.store_id) if order.store_id else None,
        "components": [
            {
                "component_id": str(c.get("component_id")),
                "name": c.get("component_name", "component"),
                "qty": _component_qty(c),
                "allocations": [{"storage_location_id": None, "qty": _component_qty(c)}],
            }
            for c in (order.material_requirements or [])
            if _component_qty(c) > 0
        ],
        "goods": [
            {
                "product_id": str(fg["product_id"]),
                "name": fg.get("name") or "product",
                "qty": fg["qty"],
                "storage_location_id": str(order.output_storage_location_id) if order.output_storage_location_id else None,
            }
            for fg in _finished_goods(order)
        ],
    }


async def reverse_production_completion(
    db: AsyncSession, vendor_id: UUID, order: ProductionOrder, actor_id: UUID | None = None,
) -> ProductionOrder:
    """Undo the postings made by post_production_completion — used when a
    completed order is moved back to an earlier status.

    Replays ``order.inventory_posting`` (what was actually moved). Strict: if the
    finished goods (or their batches) have already been used, raises ValueError
    and nothing is changed."""
    if not order.inventory_posted_at:
        return order

    posting = order.inventory_posting or _legacy_posting(order)
    store_id = _uuid_or_none(posting.get("store_id")) or order.store_id
    if not store_id:
        order.inventory_posted_at = None
        order.inventory_posting = None
        return order

    lines: list[str] = []

    # Journal + linked Controlling order first: refuses the re-open when COGS was already settled.
    await reverse_completion_accounting(db, vendor_id, order, actor_id)
    if (posting.get("accounting") or {}).get("status") == "posted":
        lines.append(f"Reversed journal {posting['accounting'].get('entry_no')}")

    # 0. Batches first (validates FG lots are untouched before anything moves).
    from app.services.pharma_batch import reverse_production_batches
    lines.extend(await reverse_production_batches(db, vendor_id=vendor_id, production_order_id=order.id))

    # 1. Take finished goods back out — must succeed in full. Output recorded earlier through
    #    partial outputs stays in stock (reverse those individually).
    for fg in [g for g in posting.get("goods", []) if _is_final(g)]:
        product_id = _uuid_or_none(fg.get("product_id"))
        qty_int = int(fg.get("qty") or 0)
        if not product_id or qty_int <= 0:
            continue
        location = _uuid_or_none(fg.get("storage_location_id"))

        await lock_product_scope(db, vendor_id, store_id, product_id)
        existing = await get_store_inventory_row(db, store_id, product_id, None, location)
        qty_before = int(existing.quantity) if existing else 0
        try:
            await apply_store_inventory_delta(
                db, vendor_id, store_id, product_id, None, -qty_int, storage_location_id=location,
            )
        except ValueError as exc:
            raise ValueError(
                f"Cannot re-open: {fg.get('name', 'finished goods')} from this order has already been "
                f"used or moved ({exc})"
            ) from exc
        await sync_product_quantity_from_stores(db, vendor_id, product_id, None)
        if fg.get("unit_cost") is not None:
            await apply_valuation(db, vendor_id, product_id, order.plant_id, Decimal(-qty_int), dec(fg["unit_cost"]))
            await refresh_cached_cost(db, vendor_id, product_id, order.plant_id)
        db.add(InventoryMovement(
            id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=product_id, variant_id=None,
            movement_type="production_receipt_reversal", quantity=-qty_int,
            quantity_before=qty_before, quantity_after=qty_before - qty_int,
            reason=f"Re-opened production order {order.ref}",
            reference_type="production_order", reference_id=order.id,
            store_id=store_id, storage_location_id=location,
        ))
        lines.append(f"Reversed receipt of {qty_int} x {fg.get('name', 'product')}")

    # 2. Put components back where they were taken from.
    for comp in [c for c in posting.get("components", []) if _is_final(c)]:
        component_id = _uuid_or_none(comp.get("component_id"))
        if not component_id:
            continue
        await lock_product_scope(db, vendor_id, store_id, component_id)
        restored = 0
        for alloc in comp.get("allocations", []):
            qty = int(alloc.get("qty") or 0)
            if qty <= 0:
                continue
            loc = _uuid_or_none(alloc.get("storage_location_id"))
            before = await _restore_component(db, vendor_id, store_id, component_id, loc, qty)
            db.add(InventoryMovement(
                id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=component_id, variant_id=None,
                movement_type="production_consumption_reversal", quantity=qty,
                quantity_before=before, quantity_after=before + qty,
                reason=f"Re-opened production order {order.ref}",
                reference_type="production_order", reference_id=order.id,
                store_id=store_id, storage_location_id=loc,
            ))
            restored += qty
        await sync_product_quantity_from_stores(db, vendor_id, component_id, None)
        if comp.get("unit_cost") is not None and restored > 0:
            await apply_valuation(db, vendor_id, component_id, order.plant_id, Decimal(restored), dec(comp["unit_cost"]))
        lines.append(f"Reversed consumption of {restored} x {comp.get('name', 'component')}")

    # The holds of the units still to be made become active again (they were closed on completion).
    consumed_holds = (await db.execute(select(StockReservation).where(
        StockReservation.vendor_id == vendor_id,
        StockReservation.order_type == ORDER_TYPE,
        StockReservation.order_id == str(order.id),
        StockReservation.status == "consumed",
    ))).scalars().all()
    for resv in consumed_holds:
        resv.status = "active"
        resv.consumed_at = None

    order.inventory_posted_at = None
    order.inventory_posting = None
    kept_material = sum((dec(o.get("material")) for o in (order.partial_outputs or []) if isinstance(o, dict)), Decimal("0"))
    order.actual_material_cost = kept_material if kept_material > 0 else None
    await unfreeze_operation_rates(db, vendor_id, order.id)
    await recalculate_labor_cost(db, vendor_id, order.id)
    _append_audit(order, "inventory_reversed", "Production completion reversed (order re-opened)", lines)
    await db.flush()
    return order
