"""Production planning: link to sales orders and capacity-aware scheduling."""
from __future__ import annotations

from datetime import date
from decimal import ROUND_CEILING, Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_vendor_id, get_current_vendor_user
from app.api.v1.production_access import production_manage, production_view
from app.api.v1.vendor_production_ops import _get_order_for_edit
from app.database import get_db
from app.models.customer import Customer
from app.models.mrp import ProductBOMItem
from app.models.order import Order, OrderLine
from app.models.production import ProductionOrder
from app.repositories.production_repo import ProductionOrderRepo
from app.services.mrp_service import get_available_stock
from app.services.production_jobcard import build_job_card, build_pick_list
from app.services.production_lifecycle import TERMINAL_STATUSES, append_audit
from app.services.production_scheduling import apply_schedule, build_schedule

router = APIRouter(dependencies=[Depends(production_view)])

_CLOSED_SALES_STATUSES = ("cancelled", "refunded", "returned", "exchanged")


def _actor(user) -> str:
    return (getattr(user, "full_name", None) or getattr(user, "email", None) or "User").strip()


# ── Sales order → production order ────────────────────────────────────────

class FromSalesOrderIn(BaseModel):
    store_id: Optional[UUID] = None
    # Produce only what stock cannot cover (ordered qty minus available stock at the store).
    shortfall_only: bool = False


async def _sales_order_plan(
    db: AsyncSession, vendor_id: UUID, sales_order: Order, store_id: Optional[UUID], shortfall_only: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    lines = (await db.execute(
        select(OrderLine).where(OrderLine.order_id == sales_order.id, OrderLine.vendor_id == vendor_id)
        .order_by(OrderLine.line_no)
    )).scalars().all()
    product_lines = [
        l for l in lines
        if l.product_id and (l.item_type or "product") == "product" and (l.line_type or "standard") == "standard"
    ]
    with_bom = set((await db.execute(
        select(ProductBOMItem.product_id).where(
            ProductBOMItem.vendor_id == vendor_id,
            ProductBOMItem.product_id.in_([l.product_id for l in product_lines] or [UUID(int=0)]),
            ProductBOMItem.is_byproduct.is_(False),
        )
    )).scalars().all())

    items: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    for l in product_lines:
        ordered = Decimal(str(l.ordered_qty or 0)).to_integral_value(rounding=ROUND_CEILING)
        if l.product_id not in with_bom:
            skipped.append({"name": l.item_name, "reason": "no bill of materials"})
            continue
        qty = ordered
        if shortfall_only:
            qty = max(ordered - await get_available_stock(db, vendor_id, l.product_id, store_id), Decimal("0"))
        if qty <= 0:
            skipped.append({"name": l.item_name, "reason": "stock already covers it" if shortfall_only else "zero quantity"})
            continue
        items.append({
            "item_type": "product", "product_id": str(l.product_id),
            "variant_id": str(l.variant_id) if l.variant_id else None,
            "name": l.item_name, "sku": l.item_sku, "qty": int(qty),
        })
    return items, skipped


@router.post("/production-orders/from-sales-order/{sales_order_id}", status_code=201, dependencies=[Depends(production_manage)])
async def create_from_sales_order(
    sales_order_id: UUID,
    body: FromSalesOrderIn = FromSalesOrderIn(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu=Depends(get_current_vendor_user),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Draft a make-to-order production order for the manufactured lines of a sales order."""
    so = (await db.execute(
        select(Order).where(Order.id == sales_order_id, Order.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not so:
        raise HTTPException(404, "Sales order not found")
    if (so.status or "") in _CLOSED_SALES_STATUSES:
        raise HTTPException(409, f"The sales order is {so.status}; nothing to produce.")

    linked = (await db.execute(
        select(ProductionOrder.ref).where(
            ProductionOrder.vendor_id == vendor_id, ProductionOrder.order_ref == so.order_number,
            ProductionOrder.status != "cancelled",
        )
    )).scalars().first()
    if linked:
        raise HTTPException(409, f"Sales order {so.order_number} already has production order {linked}.")

    store_id = body.store_id or so.store_id
    items, skipped = await _sales_order_plan(db, vendor_id, so, store_id, body.shortfall_only)
    if not items:
        raise HTTPException(400, "No manufactured lines to produce on this sales order "
                                 + ("(" + "; ".join(f"{s['name']}: {s['reason']}" for s in skipped) + ")" if skipped else ""))

    customer = await db.get(Customer, so.customer_id) if so.customer_id else None
    repo = ProductionOrderRepo(db)
    ref = await repo.next_ref(vendor_id, "mto")
    row = ProductionOrder(
        vendor_id=vendor_id, store_id=store_id, ref=ref, type="mto", template="Standard", status="draft",
        progress=0, priority="medium",
        customer_id=so.customer_id,
        customer_name=getattr(customer, "full_name", None), customer_phone=getattr(customer, "phone", None),
        customer_email=getattr(customer, "email", None),
        order_ref=so.order_number, delivery_deadline=so.requested_delivery_date,
        target_date=so.requested_delivery_date,
        notes=f"Created from sales order {so.order_number}",
        items=items, assignees=[], attachments=[], stock_dispatches=[], audit_log=[], created_by=vu.id,
    )
    try:
        row = await repo.create(row)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(400, "Could not create the production order; please try again")
    append_audit(
        row, "created", f"Order {ref} created from sales order {so.order_number}",
        actor=_actor(current_user), meta={"sales_order_id": str(so.id), "items": len(items)},
    )
    await db.commit()
    await db.refresh(row)
    return {"id": str(row.id), "ref": row.ref, "sales_order": so.order_number, "items": items, "skipped": skipped}


@router.get("/production-orders/by-sales-order/{sales_order_id}")
async def production_orders_of_sales_order(
    sales_order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Production orders raised for a sales order (matched on the sales order number)."""
    so = (await db.execute(
        select(Order).where(Order.id == sales_order_id, Order.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not so:
        raise HTTPException(404, "Sales order not found")
    rows = (await db.execute(
        select(ProductionOrder).where(
            ProductionOrder.vendor_id == vendor_id, ProductionOrder.order_ref == so.order_number,
        ).order_by(ProductionOrder.created_at)
    )).scalars().all()
    return {
        "sales_order": so.order_number,
        "items": [{"id": str(r.id), "ref": r.ref, "status": r.status, "progress": r.progress or 0} for r in rows],
        "total": len(rows),
    }


# ── Shop-floor documents ──────────────────────────────────────────────────

async def _order_or_404(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> ProductionOrder:
    order = (await db.execute(
        select(ProductionOrder).where(ProductionOrder.id == order_id, ProductionOrder.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Production order not found")
    return order


@router.get("/production-orders/{order_id}/pick-list")
async def pick_list(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Materials still to be drawn from stock for this order."""
    order = await _order_or_404(db, vendor_id, order_id)
    if (order.status or "draft") in TERMINAL_STATUSES:
        raise HTTPException(409, f"The order is {order.status}; there is nothing left to pick.")
    items = await build_pick_list(db, vendor_id, order)
    return {"ref": order.ref, "items": items, "total": len(items)}


@router.get("/production-orders/{order_id}/job-card")
async def job_card(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Printable shop-floor sheet: what to make, the routing, and the materials to pick."""
    return await build_job_card(db, vendor_id, await _order_or_404(db, vendor_id, order_id))


# ── Scheduling ────────────────────────────────────────────────────────────

class ScheduleIn(BaseModel):
    start: Optional[date] = None


@router.post("/production-orders/{order_id}/schedule")
async def preview_schedule(
    order_id: UUID,
    body: ScheduleIn = ScheduleIn(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Preview a forward schedule of the order's open operations on work-center capacity."""
    order = (await db.execute(
        select(ProductionOrder).where(ProductionOrder.id == order_id, ProductionOrder.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Production order not found")
    plan = await build_schedule(db, vendor_id, order, body.start)
    plan["applied"] = False
    return plan


@router.post("/production-orders/{order_id}/schedule/apply", dependencies=[Depends(production_manage)])
async def apply_order_schedule(
    order_id: UUID,
    body: ScheduleIn = ScheduleIn(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Store the forward schedule as each operation's planned start/end."""
    order = await _get_order_for_edit(db, vendor_id, order_id)
    plan = await build_schedule(db, vendor_id, order, body.start)
    plan["applied"] = await apply_schedule(db, vendor_id, order, plan) > 0
    if plan["applied"]:
        late = f" ({plan['late_by_days']} day(s) after the deadline)" if plan["late_by_days"] else ""
        append_audit(
            order, "scheduled", f"Operations scheduled until {plan['finish'][:10]}{late}",
            actor=_actor(current_user), meta={"finish": plan["finish"]},
        )
    await db.commit()
    return plan
