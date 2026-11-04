"""Standard routings: copy a product's routing steps onto a production order when it is confirmed."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import ProductionOrder
from app.models.production_routing import ProductionOperation, ProductRoutingStep
from app.services.production_costing import recalculate_labor_cost
from app.services.production_inventory import _finished_goods, _uuid_or_none
from app.services.production_lifecycle import append_audit


async def apply_standard_routing(db: AsyncSession, vendor_id: UUID, order: ProductionOrder, *, actor: str) -> int:
    """Create operations from the standard routings of the order's products.

    Does nothing when the order already has operations (a hand-made routing wins) or no
    product has a standard routing. Returns the number of operations created."""
    existing = (await db.execute(
        select(func.count()).select_from(ProductionOperation).where(
            ProductionOperation.production_order_id == order.id, ProductionOperation.vendor_id == vendor_id,
        )
    )).scalar() or 0
    if existing:
        return 0

    qty_by_product: dict[UUID, int] = {}
    names: dict[UUID, str] = {}
    for fg in _finished_goods(order):
        pid = _uuid_or_none(fg["product_id"])
        if pid:
            qty_by_product[pid] = qty_by_product.get(pid, 0) + fg["qty"]
            names[pid] = fg.get("name") or "product"
    if not qty_by_product:
        return 0

    steps = (await db.execute(
        select(ProductRoutingStep).where(
            ProductRoutingStep.vendor_id == vendor_id, ProductRoutingStep.product_id.in_(list(qty_by_product)),
        ).order_by(ProductRoutingStep.sequence, ProductRoutingStep.created_at)
    )).scalars().all()
    if not steps:
        return 0

    multi = len({s.product_id for s in steps}) > 1
    seq = 0
    for pid in qty_by_product:
        for step in [s for s in steps if s.product_id == pid]:
            seq += 10
            hours = Decimal(str(step.setup_hours or 0)) + Decimal(str(step.hours_per_unit or 0)) * qty_by_product[pid]
            db.add(ProductionOperation(
                vendor_id=vendor_id, production_order_id=order.id, work_center_id=step.work_center_id,
                sequence=seq, status="pending", notes=step.notes,
                name=f"{step.name} — {names[pid]}" if multi else step.name,
                planned_hours=hours.quantize(Decimal("0.01")),
            ))
    await db.flush()
    await recalculate_labor_cost(db, vendor_id, order.id)
    append_audit(order, "routing_applied", f"{seq // 10} operation(s) copied from the standard routing", actor=actor)
    return seq // 10
