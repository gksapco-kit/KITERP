"""Shop-floor documents for a production order: the pick list and the job card."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import ProductionOrder
from app.models.production_routing import ProductionOperation, WorkCenter
from app.services.mrp_service import ceil_decimal, explode_bom, get_available_stock
from app.services.production_inventory import _finished_goods
from app.services.production_lifecycle import TERMINAL_STATUSES
from app.services.production_output import consumed_by_component


async def build_pick_list(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> list[dict[str, Any]]:
    """Materials still to be drawn from stock: requirement minus what recorded partial outputs
    already consumed, with the quantity currently on hand at the order's business unit."""
    goods = _finished_goods(order)
    if not goods:
        return []
    required = await explode_bom(
        db, vendor_id, [{"product_id": g["product_id"], "qty": g["qty"], "name": g.get("name")} for g in goods],
    )
    consumed = consumed_by_component(order)
    rows: list[dict[str, Any]] = []
    for cid, entry in required.items():
        if entry.get("no_bom"):
            continue
        need = int(ceil_decimal(entry["required_qty"]))
        already = consumed.get(cid, 0)
        to_pick = max(need - already, 0)
        on_hand = await get_available_stock(db, vendor_id, UUID(cid), order.store_id)
        product = entry.get("product_obj")
        rows.append({
            "component_id": cid,
            "name": product.name if product else "Unknown",
            "sku": getattr(product, "sku", None),
            "uom": getattr(product, "uom", None),
            "required": need, "already_issued": already, "to_pick": to_pick,
            "on_hand": float(on_hand), "short": float(max(Decimal(to_pick) - on_hand, Decimal("0"))),
        })
    rows.sort(key=lambda r: r["name"].lower())
    return rows


async def build_job_card(db: AsyncSession, vendor_id: UUID, order: ProductionOrder) -> dict[str, Any]:
    ops = (await db.execute(
        select(ProductionOperation, WorkCenter.name)
        .outerjoin(WorkCenter, WorkCenter.id == ProductionOperation.work_center_id)
        .where(ProductionOperation.production_order_id == order.id, ProductionOperation.vendor_id == vendor_id)
        .order_by(ProductionOperation.sequence, ProductionOperation.created_at)
    )).all()
    live = (order.status or "draft") not in TERMINAL_STATUSES
    return {
        "ref": order.ref, "type": order.type, "status": order.status, "priority": order.priority,
        "customer": order.customer_name, "sales_order": order.order_ref,
        "deadline": (order.delivery_deadline or order.target_date).isoformat()
        if (order.delivery_deadline or order.target_date) else None,
        "special_requirements": getattr(order, "special_requirements", None), "notes": order.notes or "",
        "items": [
            {"name": i.get("name"), "qty": i.get("qty"), "produced": i.get("produced") or 0}
            for i in (order.items or []) if isinstance(i, dict)
        ],
        "operations": [
            {
                "sequence": op.sequence, "name": op.name, "work_center": wc_name, "status": op.status,
                "planned_hours": float(op.planned_hours or 0),
                "planned_start": op.planned_start.isoformat() if op.planned_start else None,
                "planned_end": op.planned_end.isoformat() if op.planned_end else None,
            }
            for op, wc_name in ops
        ],
        "materials": await build_pick_list(db, vendor_id, order) if live else [],
    }
