"""Wires BOM/MRP explosion into the Production Order lifecycle.

Reservation flow:
  ...        -> confirmed   : reserve_materials()  (idempotent; snapshot taken once)
  confirmed  -> cancelled   : release_materials()  (idempotent; releases active holds)

Stock is only ever physically moved on completion — see
app.services.production_inventory. Reservations here are a soft hold used to
compute availability (via /mrp/calculate) for other orders in the meantime.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mrp import StockReservation
from app.models.production import ProductionOrder
from app.models.vendor_product import Product
from app.services.mrp_service import ceil_decimal, explode_bom, lock_product_scope
from app.services.production_costing import recalculate_planned_material_cost

ORDER_TYPE = "production_order"


def _finished_product_requests(order: ProductionOrder) -> list[dict[str, Any]]:
    """Output line items that are actual products (not services) — these are
    what get exploded through their BOM to derive raw-material requirements."""
    out: list[dict[str, Any]] = []
    for item in order.items or []:
        if not isinstance(item, dict):
            continue
        if item.get("item_type") not in (None, "product"):
            continue
        pid = item.get("product_id")
        qty = item.get("qty")
        if not pid or not qty:
            continue
        out.append({"product_id": pid, "qty": qty, "name": item.get("name")})
    return out


async def reserve_materials(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> ProductionOrder:
    """Explode the order's finished-product items through their BOM and create
    stock reservations for the resulting leaf materials. Idempotent — calling
    this again on an order that already has an active reservation snapshot is
    a no-op (release_materials must run first to reset it)."""
    if order.materials_reserved_at:
        return order

    now = datetime.now(timezone.utc)

    # If materials were already reserved for this order out-of-band (e.g. via
    # the manual MRP report modal before confirming), adopt those holds
    # instead of exploding the BOM again and creating a duplicate set.
    existing_result = await db.execute(select(StockReservation).where(
        StockReservation.vendor_id == vendor_id,
        StockReservation.order_type == ORDER_TYPE,
        StockReservation.order_id == str(order.id),
        StockReservation.status == "active",
    ))
    existing = existing_result.scalars().all()
    if existing:
        snapshot: list[dict[str, Any]] = []
        for resv in existing:
            prod = await db.get(Product, resv.product_id)
            snapshot.append({
                "component_id": str(resv.product_id),
                "component_name": prod.name if prod else "Unknown",
                "component_sku": prod.sku if prod else None,
                "component_uom": prod.uom if prod else None,
                "cost_price": float(prod.cost_price) if prod and prod.cost_price is not None else None,
                "required_qty": str(resv.reserved_qty),
                "reserve_qty": str(resv.reserved_qty),
                "no_bom": False,
                "source_items": [],
            })
            # Align store scoping so completion looks for stock in the right place.
            if resv.store_id is None and order.store_id is not None:
                resv.store_id = order.store_id
        order.material_requirements = snapshot
        order.materials_reserved_at = now
        order.materials_released_at = None
        recalculate_planned_material_cost(order)
        await db.flush()
        return order

    requests = _finished_product_requests(order)

    if not requests:
        # Nothing BOM-relevant to reserve (service-only order, or items without
        # a BOM) — mark as processed so later completion doesn't try again.
        order.material_requirements = []
        order.materials_reserved_at = now
        order.materials_released_at = None
        recalculate_planned_material_cost(order)
        return order

    component_requirements = await explode_bom(db, vendor_id, requests)

    snapshot: list[dict[str, Any]] = []
    for cid, entry in component_requirements.items():
        comp = entry["product_obj"]
        product_id = UUID(cid)
        required_qty = entry["required_qty"]
        reserve_qty = ceil_decimal(required_qty)

        await lock_product_scope(db, vendor_id, order.store_id, product_id)

        resv = StockReservation(
            vendor_id=vendor_id,
            order_type=ORDER_TYPE,
            order_id=str(order.id),
            store_id=order.store_id,
            storage_location_id=order.output_storage_location_id,
            product_id=product_id,
            reserved_qty=reserve_qty,
            status="active",
            notes=f"Auto-reserved for production order {order.ref}",
        )
        db.add(resv)

        snapshot.append({
            "component_id": cid,
            "component_name": comp.name if comp else "Unknown",
            "component_sku": comp.sku if comp else None,
            "component_uom": comp.uom if comp else None,
            "cost_price": float(comp.cost_price) if comp and comp.cost_price is not None else None,
            "required_qty": str(required_qty),
            "reserve_qty": str(reserve_qty),
            "no_bom": entry["no_bom"],
            "source_items": sorted(entry["source_items"]),
        })

    order.material_requirements = snapshot
    order.materials_reserved_at = now
    order.materials_released_at = None
    recalculate_planned_material_cost(order)
    await db.flush()
    return order


async def release_materials(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> ProductionOrder:
    """Release all active reservations held by this production order (cancel path).
    Idempotent — a second call simply finds no active reservations left."""
    result = await db.execute(
        select(StockReservation).where(
            StockReservation.vendor_id == vendor_id,
            StockReservation.order_type == ORDER_TYPE,
            StockReservation.order_id == str(order.id),
            StockReservation.status == "active",
        )
    )
    now = datetime.now(timezone.utc)
    for resv in result.scalars().all():
        resv.status = "released"
        resv.released_at = now

    order.materials_released_at = now
    await db.flush()
    return order
