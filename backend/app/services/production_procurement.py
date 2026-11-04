"""Turn a production order's material shortages into a purchase requisition."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mrp import StockReservation
from app.models.procurement_requisition import PurchaseRequisition, PurchaseRequisitionItem
from app.models.production import ProductionOrder
from app.repositories.procurement_requisition_repo import PurchaseRequisitionRepository
from app.services.mrp_service import ceil_decimal, explode_bom, get_available_stock
from app.services.production_inventory import _finished_goods
from app.services.production_lifecycle import append_audit

ORDER_TYPE = "production_order"


async def compute_shortages(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> list[dict[str, Any]]:
    """Leaf components whose unreserved stock at the order's business unit does not
    cover this order's requirement (reservations held by *other* orders are deducted)."""
    goods = _finished_goods(order)
    if not goods:
        return []
    required = await explode_bom(
        db, vendor_id,
        [{"product_id": g["product_id"], "qty": g["qty"], "name": g.get("name")} for g in goods],
    )
    shortages: list[dict[str, Any]] = []
    for cid, entry in required.items():
        if entry.get("no_bom"):
            continue  # a top-level product with no BOM has nothing to buy for production
        comp_id = UUID(cid)
        in_stock = await get_available_stock(db, vendor_id, comp_id, order.store_id)

        scope = [
            StockReservation.vendor_id == vendor_id,
            StockReservation.product_id == comp_id,
            StockReservation.status == "active",
            ~((StockReservation.order_type == ORDER_TYPE) & (StockReservation.order_id == str(order.id))),
        ]
        scope.append(
            StockReservation.store_id == order.store_id if order.store_id else StockReservation.store_id.is_(None)
        )
        others = Decimal(str((await db.execute(
            select(func.coalesce(func.sum(StockReservation.reserved_qty), 0)).where(*scope)
        )).scalar() or 0))

        need = ceil_decimal(entry["required_qty"])
        available = in_stock - others
        short = need - available
        if short > 0:
            product = entry["product_obj"]
            shortages.append({
                "component_id": cid,
                "component_name": product.name if product else "Unknown",
                "uom": product.uom if product else None,
                "required": float(need),
                "available": float(max(available, Decimal("0"))),
                "shortage": float(short),
                "estimated_price": float(product.cost_price or 0) if product else 0.0,
            })
    return shortages


async def create_requisition_for_shortages(
    db: AsyncSession,
    vendor_id: UUID,
    order: ProductionOrder,
    shortages: list[dict[str, Any]],
    *,
    requested_by: UUID | None,
    actor: str,
) -> PurchaseRequisition:
    pr_number = await PurchaseRequisitionRepository(db).get_next_pr_number(vendor_id)
    pr = PurchaseRequisition(
        vendor_id=vendor_id,
        pr_number=pr_number,
        status="draft",
        requested_by=requested_by,
        requisition_type="product",
        department="Production",
        priority="high" if (order.priority or "") in ("high", "urgent") else "medium",
        store_id=order.store_id,
        plant_id=order.plant_id,
        procurement_source="supplier",
        notes=f"Material shortage for production order {order.ref}",
    )
    for s in shortages:
        pr.items.append(PurchaseRequisitionItem(
            item_type="product",
            product_id=UUID(s["component_id"]),
            description=f"Needed for production order {order.ref}",
            quantity=Decimal(str(s["shortage"])),
            unit_of_measure=s.get("uom") or "piece",
            needed_by_date=order.target_date,
            plant_id=order.plant_id,
            estimated_price=Decimal(str(s.get("estimated_price") or 0)),
        ))
    db.add(pr)
    await db.flush()
    append_audit(
        order, "purchase_requisition_created",
        f"Purchase requisition {pr_number} created for {len(shortages)} short material(s)",
        actor=actor, meta={"pr_number": pr_number, "pr_id": str(pr.id)},
    )
    return pr
