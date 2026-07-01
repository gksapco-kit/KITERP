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
"""
from __future__ import annotations

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
from app.services.mrp_service import lock_product_scope
from app.services.production_costing import recalculate_actual_material_cost
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
        except (ValueError, TypeError):
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


async def post_production_completion(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> ProductionOrder:
    """Consume reserved components and receive finished goods into StoreInventory.
    Idempotent via inventory_posted_at. Raises ValueError (caller should turn
    this into an HTTP 400) if the order has no business unit assigned, or if
    physical stock is insufficient to cover the consumption."""
    if order.inventory_posted_at:
        return order
    if not order.store_id:
        raise ValueError("Assign a business unit to this production order before completing it.")

    now = datetime.now(timezone.utc)
    lines: list[str] = []

    # 1. Consume leaf materials from the snapshot taken when materials were reserved.
    for comp in order.material_requirements or []:
        try:
            component_id = UUID(str(comp["component_id"]))
        except (KeyError, ValueError, TypeError):
            continue
        qty_int = int(Decimal(str(comp.get("reserve_qty") or comp.get("required_qty") or 0)))
        if qty_int <= 0:
            continue

        await lock_product_scope(db, vendor_id, order.store_id, component_id)
        existing = await get_store_inventory_row(db, order.store_id, component_id, None, None)
        qty_before = int(existing.quantity) if existing else 0

        try:
            await apply_store_inventory_delta(
                db, vendor_id, order.store_id, component_id, None, -qty_int, storage_location_id=None,
            )
        except ValueError as exc:
            raise ValueError(f"{comp.get('component_name', 'Component')}: {exc}") from exc
        await sync_product_quantity_from_stores(db, vendor_id, component_id, None)

        db.add(InventoryMovement(
            id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=component_id, variant_id=None,
            movement_type="production_consumption", quantity=-qty_int,
            quantity_before=qty_before, quantity_after=qty_before - qty_int,
            reason=f"Consumed for production order {order.ref}",
            reference_type="production_order", reference_id=order.id,
            store_id=order.store_id,
        ))
        lines.append(f"-{qty_int} x {comp.get('component_name', 'component')}")

        resv_result = await db.execute(select(StockReservation).where(
            StockReservation.vendor_id == vendor_id,
            StockReservation.order_type == ORDER_TYPE,
            StockReservation.order_id == str(order.id),
            StockReservation.product_id == component_id,
            StockReservation.status == "active",
        ))
        for resv in resv_result.scalars().all():
            resv.status = "consumed"
            resv.consumed_at = now

    # 2. Receive finished goods into the output storage location (or store default).
    output_location = order.output_storage_location_id
    for fg in _finished_goods(order):
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
        lines.append(f"+{qty_int} x {fg.get('name', 'product')}")

    order.inventory_posted_at = now
    recalculate_actual_material_cost(order)
    _append_audit(order, "inventory_posted", "Materials consumed and finished goods received", lines)
    await db.flush()
    return order


async def reverse_production_completion(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> ProductionOrder:
    """Undo the postings made by post_production_completion — used when a
    completed order is moved back to an earlier status. Best-effort: if
    finished goods were already sold/moved on and stock is short, that line's
    reversal is skipped (logged) rather than failing the whole re-open."""
    if not order.inventory_posted_at:
        return order
    if not order.store_id:
        order.inventory_posted_at = None
        return order

    now = datetime.now(timezone.utc)
    lines: list[str] = []

    output_location = order.output_storage_location_id
    for fg in _finished_goods(order):
        try:
            product_id = UUID(str(fg["product_id"]))
        except ValueError:
            continue
        qty_int = fg["qty"]

        await lock_product_scope(db, vendor_id, order.store_id, product_id)
        existing = await get_store_inventory_row(db, order.store_id, product_id, None, output_location)
        qty_before = int(existing.quantity) if existing else 0
        try:
            await apply_store_inventory_delta(
                db, vendor_id, order.store_id, product_id, None, -qty_int, storage_location_id=output_location,
            )
        except ValueError:
            lines.append(f"Could not reverse receipt of {fg.get('name', 'product')} — stock already moved")
            continue
        await sync_product_quantity_from_stores(db, vendor_id, product_id, None)
        db.add(InventoryMovement(
            id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=product_id, variant_id=None,
            movement_type="production_receipt_reversal", quantity=-qty_int,
            quantity_before=qty_before, quantity_after=qty_before - qty_int,
            reason=f"Re-opened production order {order.ref}",
            reference_type="production_order", reference_id=order.id,
            store_id=order.store_id, storage_location_id=output_location,
        ))
        lines.append(f"Reversed receipt of {qty_int} x {fg.get('name', 'product')}")

    for comp in order.material_requirements or []:
        try:
            component_id = UUID(str(comp["component_id"]))
        except (KeyError, ValueError, TypeError):
            continue
        qty_int = int(Decimal(str(comp.get("reserve_qty") or comp.get("required_qty") or 0)))
        if qty_int <= 0:
            continue

        await lock_product_scope(db, vendor_id, order.store_id, component_id)
        existing = await get_store_inventory_row(db, order.store_id, component_id, None, None)
        qty_before = int(existing.quantity) if existing else 0
        await apply_store_inventory_delta(
            db, vendor_id, order.store_id, component_id, None, qty_int, storage_location_id=None,
        )
        await sync_product_quantity_from_stores(db, vendor_id, component_id, None)
        db.add(InventoryMovement(
            id=uuid_mod.uuid4(), vendor_id=vendor_id, product_id=component_id, variant_id=None,
            movement_type="production_consumption_reversal", quantity=qty_int,
            quantity_before=qty_before, quantity_after=qty_before + qty_int,
            reason=f"Re-opened production order {order.ref}",
            reference_type="production_order", reference_id=order.id,
            store_id=order.store_id,
        ))
        lines.append(f"Reversed consumption of {qty_int} x {comp.get('component_name', 'component')}")

        resv_result = await db.execute(select(StockReservation).where(
            StockReservation.vendor_id == vendor_id,
            StockReservation.order_type == ORDER_TYPE,
            StockReservation.order_id == str(order.id),
            StockReservation.product_id == component_id,
            StockReservation.status == "consumed",
        ))
        for resv in resv_result.scalars().all():
            resv.status = "active"
            resv.consumed_at = None

    order.inventory_posted_at = None
    order.actual_material_cost = None
    _append_audit(order, "inventory_reversed", "Production completion reversed (order re-opened)", lines)
    await db.flush()
    return order
