"""Material + labor cost roll-up for Production Orders (Phase 7).

Material cost:
  planned_material_cost — Sum(required_qty * component.cost_price) over the
    BOM explosion snapshot (`material_requirements`), computed right after
    `reserve_materials()` populates that snapshot (at 'confirmed').
  actual_material_cost  — Same sum but using reserve_qty (the ceiling-rounded
    quantity actually deducted from StoreInventory), computed right after
    `post_production_completion()` consumes components (at 'completed').

Labor cost:
  planned_labor_cost / actual_labor_cost — Sum(hours * work_center.cost_per_hour)
    across the order's routing operations (planned_hours vs actual_hours).
    Recomputed live whenever an operation is created/updated/deleted/reordered,
    so it always reflects the current routing — unlike material cost, which is
    a point-in-time snapshot tied to the BOM explosion.

All three helpers only mutate in-memory attributes; callers are responsible
for flushing/committing (they already do, as part of the same transaction
as the reservation/posting/operation change that triggered the recalc).
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import ProductionOrder
from app.models.production_routing import ProductionOperation, WorkCenter


def _dec(v: Any) -> Decimal:
    if v is None:
        return Decimal("0")
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def _material_cost_from_snapshot(order: ProductionOrder, *, use_reserve_qty: bool) -> Decimal:
    total = Decimal("0")
    for comp in order.material_requirements or []:
        cost_price = comp.get("cost_price")
        if cost_price is None:
            continue
        qty_key = "reserve_qty" if use_reserve_qty else "required_qty"
        qty = _dec(comp.get(qty_key) if comp.get(qty_key) is not None else comp.get("required_qty"))
        total += qty * _dec(cost_price)
    return total


def recalculate_planned_material_cost(order: ProductionOrder) -> None:
    """Call right after reserve_materials() populates material_requirements."""
    order.planned_material_cost = (
        _material_cost_from_snapshot(order, use_reserve_qty=False) if order.material_requirements else None
    )


def recalculate_actual_material_cost(order: ProductionOrder) -> None:
    """Call right after post_production_completion() consumes components."""
    order.actual_material_cost = (
        _material_cost_from_snapshot(order, use_reserve_qty=True) if order.material_requirements else None
    )


async def recalculate_labor_cost(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> None:
    """Recompute planned/actual labor cost for a production order from its
    routing operations. Call after any create/update/delete/reorder of
    ProductionOperation rows for this order."""
    rows = (await db.execute(
        select(ProductionOperation, WorkCenter)
        .outerjoin(WorkCenter, ProductionOperation.work_center_id == WorkCenter.id)
        .where(
            ProductionOperation.production_order_id == order_id,
            ProductionOperation.vendor_id == vendor_id,
        )
    )).all()

    planned = Decimal("0")
    actual = Decimal("0")
    has_ops = False
    for op, wc in rows:
        has_ops = True
        rate = _dec(wc.cost_per_hour) if wc else Decimal("0")
        planned += _dec(op.planned_hours) * rate
        if op.actual_hours is not None:
            actual += _dec(op.actual_hours) * rate

    order = await db.get(ProductionOrder, order_id)
    if order is None:
        return
    order.planned_labor_cost = planned if has_ops else None
    order.actual_labor_cost = actual if has_ops else None
    await db.flush()
