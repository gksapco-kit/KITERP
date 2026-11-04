"""Work centers + routing operations for Production Orders (Phase 5)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, get_current_vendor_user, require_permission
from app.api.v1.production_access import production_view, production_manage
from app.models.plant import Plant
from app.models.production import ProductionOrder
from app.models.production_routing import WorkCenter, ProductionOperation
from app.services.production_costing import recalculate_labor_cost, recalculate_labor_for_work_center
from app.services.production_lifecycle import TERMINAL_STATUSES

router = APIRouter(dependencies=[Depends(production_view)])

_OP_STATUSES = ("pending", "in_progress", "completed", "skipped")


def _num(v: Any) -> Optional[float]:
    return float(v) if v is not None else None


def _iso(v: Any) -> Optional[str]:
    return v.isoformat() if isinstance(v, datetime) else v


def _serialize_wc(row: WorkCenter) -> dict:
    return {
        "id": str(row.id),
        "vendor_id": str(row.vendor_id),
        "plant_id": str(row.plant_id) if row.plant_id else None,
        "code": row.code,
        "name": row.name,
        "description": row.description,
        "capacity_per_day": _num(row.capacity_per_day),
        "cost_per_hour": _num(row.cost_per_hour) or 0,
        "is_active": bool(row.is_active),
        "sort_order": row.sort_order or 0,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _serialize_op(row: ProductionOperation) -> dict:
    return {
        "id": str(row.id),
        "vendor_id": str(row.vendor_id),
        "production_order_id": str(row.production_order_id),
        "work_center_id": str(row.work_center_id) if row.work_center_id else None,
        "sequence": row.sequence or 0,
        "name": row.name,
        "status": row.status,
        "planned_hours": _num(row.planned_hours) or 0,
        "actual_hours": _num(row.actual_hours),
        "rate_applied": _num(row.rate_applied),
        "planned_start": _iso(row.planned_start),
        "planned_end": _iso(row.planned_end),
        "started_at": _iso(row.started_at),
        "completed_at": _iso(row.completed_at),
        "notes": row.notes,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


async def _next_wc_code(db: AsyncSession, vendor_id: UUID) -> str:
    count = (await db.execute(
        select(sa_func.count()).select_from(WorkCenter).where(WorkCenter.vendor_id == vendor_id)
    )).scalar_one() or 0
    for attempt in range(count + 1, count + 50):
        candidate = f"WC-{attempt:03d}"
        exists = (await db.execute(
            select(WorkCenter.id).where(WorkCenter.vendor_id == vendor_id, WorkCenter.code == candidate)
        )).scalar_one_or_none()
        if not exists:
            return candidate
    return f"WC-{count + 1:03d}-{uuid_hex()}"


def uuid_hex() -> str:
    import uuid as _uuid
    return _uuid.uuid4().hex[:6]


async def _get_work_center_or_404(db: AsyncSession, vendor_id: UUID, wc_id: UUID) -> WorkCenter:
    row = (await db.execute(
        select(WorkCenter).where(WorkCenter.id == wc_id, WorkCenter.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Work center not found")
    return row


async def _get_order_or_404(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> ProductionOrder:
    row = (await db.execute(
        select(ProductionOrder).where(ProductionOrder.id == order_id, ProductionOrder.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Production order not found")
    return row


async def _get_order_for_edit(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> ProductionOrder:
    """Load the order row-locked and refuse edits once it is completed or cancelled.

    Locking serialises operation edits against completion (which freezes rates and
    reads the routing), so labor cost can never change underneath a posting."""
    row = (await db.execute(
        select(ProductionOrder)
        .where(ProductionOrder.id == order_id, ProductionOrder.vendor_id == vendor_id)
        .with_for_update()
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Production order not found")
    if (row.status or "draft") in TERMINAL_STATUSES:
        raise HTTPException(
            409,
            f"The order is {row.status}; its operations are read-only. Re-open the order to change them.",
        )
    return row


async def _live_rate(db: AsyncSession, vendor_id: UUID, wc_id: Optional[UUID]) -> Decimal:
    if not wc_id:
        return Decimal("0")
    rate = (await db.execute(
        select(WorkCenter.cost_per_hour).where(WorkCenter.id == wc_id, WorkCenter.vendor_id == vendor_id)
    )).scalar_one_or_none()
    return Decimal(str(rate or 0))


class WorkCenterCreate(BaseModel):
    code: Optional[str] = None
    name: str
    description: Optional[str] = None
    plant_id: Optional[UUID] = None
    capacity_per_day: Optional[float] = None
    cost_per_hour: float = 0
    is_active: bool = True
    sort_order: int = 0


class WorkCenterUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    plant_id: Optional[UUID] = None
    capacity_per_day: Optional[float] = None
    cost_per_hour: Optional[float] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class OperationCreate(BaseModel):
    name: str = "Operation"
    work_center_id: Optional[UUID] = None
    sequence: Optional[int] = None
    status: str = Field("pending", pattern="^(pending|in_progress|completed|skipped)$")
    planned_hours: Optional[float] = 0
    actual_hours: Optional[float] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    notes: Optional[str] = None


class OperationUpdate(BaseModel):
    name: Optional[str] = None
    work_center_id: Optional[UUID] = None
    sequence: Optional[int] = None
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|completed|skipped)$")
    planned_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    notes: Optional[str] = None


class OperationReorder(BaseModel):
    ids: List[UUID]


# ── Work Centers ──────────────────────────────────────────────────────────

@router.get("/work-centers")
async def list_work_centers(
    is_active: Optional[bool] = Query(None),
    plant_id: Optional[UUID] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(WorkCenter).where(WorkCenter.vendor_id == vendor_id)
    if is_active is not None:
        q = q.where(WorkCenter.is_active == is_active)
    if plant_id:
        q = q.where(WorkCenter.plant_id == plant_id)
    q = q.order_by(WorkCenter.sort_order, WorkCenter.name)
    rows = (await db.execute(q)).scalars().all()
    return {"items": [_serialize_wc(r) for r in rows], "total": len(rows)}


@router.post("/work-centers", status_code=201, dependencies=[Depends(production_manage)])
async def create_work_center(
    body: WorkCenterCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    if body.plant_id:
        plant = (await db.execute(
            select(Plant).where(Plant.id == body.plant_id, Plant.vendor_id == vendor_id)
        )).scalar_one_or_none()
        if not plant:
            raise HTTPException(400, "Invalid plant for this vendor")

    code = (body.code or "").strip() or await _next_wc_code(db, vendor_id)
    existing = (await db.execute(
        select(WorkCenter.id).where(WorkCenter.vendor_id == vendor_id, WorkCenter.code == code)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, f"Work center code {code} already exists")

    row = WorkCenter(
        vendor_id=vendor_id,
        plant_id=body.plant_id,
        code=code,
        name=body.name,
        description=body.description,
        capacity_per_day=body.capacity_per_day,
        cost_per_hour=body.cost_per_hour or 0,
        is_active=body.is_active,
        sort_order=body.sort_order,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _serialize_wc(row)


@router.put("/work-centers/{wc_id}", dependencies=[Depends(production_manage)])
async def update_work_center(
    wc_id: UUID,
    body: WorkCenterUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_work_center_or_404(db, vendor_id, wc_id)
    data = body.model_dump(exclude_unset=True)

    if "plant_id" in data and data["plant_id"]:
        plant = (await db.execute(
            select(Plant).where(Plant.id == data["plant_id"], Plant.vendor_id == vendor_id)
        )).scalar_one_or_none()
        if not plant:
            raise HTTPException(400, "Invalid plant for this vendor")

    if "code" in data:
        new_code = (data["code"] or "").strip()
        if not new_code:
            raise HTTPException(400, "Code cannot be empty")
        if new_code != row.code:
            existing = (await db.execute(
                select(WorkCenter.id).where(WorkCenter.vendor_id == vendor_id, WorkCenter.code == new_code)
            )).scalar_one_or_none()
            if existing:
                raise HTTPException(400, f"Work center code {new_code} already exists")
        data["code"] = new_code

    old_rate = Decimal(str(row.cost_per_hour or 0))
    if "cost_per_hour" in data and data["cost_per_hour"] is None:
        raise HTTPException(400, "cost_per_hour cannot be empty")
    if "cost_per_hour" in data and data["cost_per_hour"] < 0:
        raise HTTPException(400, "cost_per_hour cannot be negative")
    for k, v in data.items():
        setattr(row, k, v)
    await db.flush()
    # Orders still on the live rate pick up the new rate; frozen (completed) ones keep theirs.
    if "cost_per_hour" in data and Decimal(str(data["cost_per_hour"])) != old_rate:
        await recalculate_labor_for_work_center(db, vendor_id, wc_id)
    await db.commit()
    await db.refresh(row)
    return _serialize_wc(row)


@router.delete("/work-centers/{wc_id}", status_code=204, dependencies=[Depends(production_manage)])
async def delete_work_center(
    wc_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_work_center_or_404(db, vendor_id, wc_id)

    ops = (await db.execute(
        select(ProductionOperation, ProductionOrder.status, ProductionOrder.ref)
        .join(ProductionOrder, ProductionOrder.id == ProductionOperation.production_order_id)
        .where(ProductionOperation.work_center_id == wc_id, ProductionOperation.vendor_id == vendor_id)
    )).all()
    open_refs = sorted({ref for _op, status, ref in ops if (status or "draft") not in TERMINAL_STATUSES})
    if open_refs:
        shown = ", ".join(open_refs[:5]) + ("…" if len(open_refs) > 5 else "")
        raise HTTPException(
            409,
            f"This work center is used by open production orders ({shown}). "
            "Reassign those operations first, or mark the work center inactive instead.",
        )
    # Completed/cancelled orders keep their historical cost: pin the rate before the link goes.
    for op, _status, _ref in ops:
        if op.rate_applied is None:
            op.rate_applied = Decimal(str(row.cost_per_hour or 0))
    await db.flush()
    await db.delete(row)
    await db.commit()
    return None


# ── Production Operations (routing steps of a Production Order) ──────────

@router.get("/production-orders/{order_id}/operations")
async def list_operations(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_or_404(db, vendor_id, order_id)
    rows = (await db.execute(
        select(ProductionOperation)
        .where(ProductionOperation.production_order_id == order_id, ProductionOperation.vendor_id == vendor_id)
        .order_by(ProductionOperation.sequence, ProductionOperation.created_at)
    )).scalars().all()
    return {"items": [_serialize_op(r) for r in rows], "total": len(rows)}


async def _get_operation_or_404(db: AsyncSession, vendor_id: UUID, order_id: UUID, op_id: UUID) -> ProductionOperation:
    row = (await db.execute(
        select(ProductionOperation).where(
            ProductionOperation.id == op_id,
            ProductionOperation.production_order_id == order_id,
            ProductionOperation.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Operation not found")
    return row


async def _validate_work_center(db: AsyncSession, vendor_id: UUID, wc_id: Optional[UUID]) -> None:
    if not wc_id:
        return
    exists = (await db.execute(
        select(WorkCenter.id).where(WorkCenter.id == wc_id, WorkCenter.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not exists:
        raise HTTPException(400, "Invalid work center for this vendor")


@router.post("/production-orders/{order_id}/operations", status_code=201, dependencies=[Depends(production_manage)])
async def create_operation(
    order_id: UUID,
    body: OperationCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_for_edit(db, vendor_id, order_id)
    await _validate_work_center(db, vendor_id, body.work_center_id)
    if body.planned_hours is not None and body.planned_hours < 0:
        raise HTTPException(400, "planned_hours cannot be negative")
    if body.actual_hours is not None and body.actual_hours < 0:
        raise HTTPException(400, "actual_hours cannot be negative")

    sequence = body.sequence
    if sequence is None:
        max_seq = (await db.execute(
            select(sa_func.max(ProductionOperation.sequence)).where(
                ProductionOperation.production_order_id == order_id
            )
        )).scalar_one_or_none()
        sequence = (max_seq or 0) + 10

    now = datetime.utcnow()
    row = ProductionOperation(
        vendor_id=vendor_id,
        production_order_id=order_id,
        work_center_id=body.work_center_id,
        sequence=sequence,
        name=body.name or "Operation",
        status=body.status,
        planned_hours=body.planned_hours or 0,
        actual_hours=body.actual_hours,
        planned_start=body.planned_start,
        planned_end=body.planned_end,
        notes=body.notes,
        started_at=now if body.status == "in_progress" else None,
        completed_at=now if body.status == "completed" else None,
        rate_applied=(await _live_rate(db, vendor_id, body.work_center_id)) if body.status == "completed" else None,
    )
    db.add(row)
    await recalculate_labor_cost(db, vendor_id, order_id)
    await db.commit()
    await db.refresh(row)
    return _serialize_op(row)


@router.put("/production-orders/{order_id}/operations/{op_id}", dependencies=[Depends(production_manage)])
async def update_operation(
    order_id: UUID,
    op_id: UUID,
    body: OperationUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_for_edit(db, vendor_id, order_id)
    row = await _get_operation_or_404(db, vendor_id, order_id, op_id)
    data = body.model_dump(exclude_unset=True)

    if "work_center_id" in data:
        await _validate_work_center(db, vendor_id, data["work_center_id"])
    for hours_field in ("planned_hours", "actual_hours"):
        if data.get(hours_field) is not None and data[hours_field] < 0:
            raise HTTPException(400, f"{hours_field} cannot be negative")

    old_status = row.status
    for k, v in data.items():
        setattr(row, k, v)

    new_status = data.get("status", old_status)
    if new_status != old_status:
        now = datetime.utcnow()
        if new_status == "in_progress" and not row.started_at:
            row.started_at = now
        if new_status == "completed" and not row.completed_at:
            row.completed_at = now
        if new_status not in ("completed",) and old_status == "completed":
            # Re-opened — clear the completion stamp so it can be re-derived later.
            row.completed_at = None

    # A completed operation locks the rate it ran at; anything else follows the live rate.
    if row.status == "completed":
        if row.rate_applied is None or "work_center_id" in data:
            row.rate_applied = await _live_rate(db, vendor_id, row.work_center_id)
    else:
        row.rate_applied = None

    if {"planned_hours", "actual_hours", "work_center_id", "status"} & set(data):
        await db.flush()
        await recalculate_labor_cost(db, vendor_id, order_id)
    await db.commit()
    await db.refresh(row)
    return _serialize_op(row)


@router.delete("/production-orders/{order_id}/operations/{op_id}", status_code=204, dependencies=[Depends(production_manage)])
async def delete_operation(
    order_id: UUID,
    op_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_for_edit(db, vendor_id, order_id)
    row = await _get_operation_or_404(db, vendor_id, order_id, op_id)
    await db.delete(row)
    await db.flush()
    await recalculate_labor_cost(db, vendor_id, order_id)
    await db.commit()
    return None


@router.put("/production-orders/{order_id}/operations/reorder/apply", dependencies=[Depends(production_manage)])
async def reorder_operations(
    order_id: UUID,
    body: OperationReorder,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_for_edit(db, vendor_id, order_id)
    rows = (await db.execute(
        select(ProductionOperation).where(
            ProductionOperation.production_order_id == order_id,
            ProductionOperation.vendor_id == vendor_id,
        )
    )).scalars().all()
    by_id = {r.id: r for r in rows}
    missing = [str(i) for i in body.ids if i not in by_id]
    if missing:
        raise HTTPException(400, f"Unknown operation id(s): {', '.join(missing)}")
    if len(set(body.ids)) != len(body.ids):
        raise HTTPException(400, "Each operation may appear only once in the new order")
    if set(body.ids) != set(by_id):
        raise HTTPException(
            400,
            "The new order must list every operation of this production order "
            f"(got {len(body.ids)} of {len(by_id)}).",
        )

    for idx, op_id in enumerate(body.ids):
        by_id[op_id].sequence = (idx + 1) * 10
    await db.commit()
    refreshed = (await db.execute(
        select(ProductionOperation)
        .where(ProductionOperation.production_order_id == order_id, ProductionOperation.vendor_id == vendor_id)
        .execution_options(populate_existing=True)
    )).scalars().all()
    fresh = {r.id: r for r in refreshed}
    return {"items": [_serialize_op(fresh[i]) for i in body.ids]}


# ── Planning aids ─────────────────────────────────────────────────────────

@router.get("/production-orders/{order_id}/shortages")
async def order_shortages(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Materials this order is short of (after other orders' reservations)."""
    from app.services.production_procurement import compute_shortages

    order = await _get_order_or_404(db, vendor_id, order_id)
    items = await compute_shortages(db, vendor_id, order)
    return {"items": items, "total": len(items)}


@router.post(
    "/production-orders/{order_id}/purchase-requisition",
    status_code=201,
    dependencies=[Depends(production_manage), Depends(require_permission("procurement.manage"))],
)
async def create_requisition_from_shortages(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu=Depends(get_current_vendor_user),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Draft a purchase requisition for everything the order is short of."""
    from app.services.production_procurement import compute_shortages, create_requisition_for_shortages

    order = (await db.execute(
        select(ProductionOrder)
        .where(ProductionOrder.id == order_id, ProductionOrder.vendor_id == vendor_id)
        .with_for_update()
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Production order not found")
    if (order.status or "draft") in TERMINAL_STATUSES:
        raise HTTPException(409, f"The order is {order.status}; there is nothing left to buy for it.")

    shortages = await compute_shortages(db, vendor_id, order)
    if not shortages:
        raise HTTPException(400, "No shortages: stock covers every material this order needs.")
    pr = await create_requisition_for_shortages(
        db, vendor_id, order, shortages,
        requested_by=vu.id,
        actor=(getattr(current_user, "full_name", None) or getattr(current_user, "email", None) or "User").strip(),
    )
    await db.commit()
    return {"id": str(pr.id), "pr_number": pr.pr_number, "items": len(shortages), "shortages": shortages}


@router.get("/work-centers/load")
async def work_center_load(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Open planned hours per work center against its daily capacity (a planning aid:
    ``days_of_work`` is how long the queue takes at full daily capacity)."""
    centers = (await db.execute(
        select(WorkCenter).where(WorkCenter.vendor_id == vendor_id, WorkCenter.is_active.is_(True))
        .order_by(WorkCenter.sort_order, WorkCenter.name)
    )).scalars().all()
    rows = (await db.execute(
        select(ProductionOperation.work_center_id, sa_func.coalesce(sa_func.sum(ProductionOperation.planned_hours), 0),
               sa_func.count())
        .join(ProductionOrder, ProductionOrder.id == ProductionOperation.production_order_id)
        .where(
            ProductionOperation.vendor_id == vendor_id,
            ProductionOperation.status.in_(("pending", "in_progress")),
            ProductionOrder.status.notin_(tuple(TERMINAL_STATUSES)),
        )
        .group_by(ProductionOperation.work_center_id)
    )).all()
    load = {wc_id: (float(hours or 0), int(n)) for wc_id, hours, n in rows}

    out = []
    for wc in centers:
        hours, n_ops = load.get(wc.id, (0.0, 0))
        cap = _num(wc.capacity_per_day)
        out.append({
            "work_center_id": str(wc.id), "name": wc.name, "code": wc.code,
            "open_hours": round(hours, 2), "open_operations": n_ops,
            "capacity_per_day": cap,
            "days_of_work": round(hours / cap, 1) if cap else None,
        })
    return {"items": out, "unassigned_hours": round(load.get(None, (0.0, 0))[0], 2)}


# ── Standard routing (per product) ────────────────────────────────────────

class RoutingStepIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    work_center_id: Optional[UUID] = None
    setup_hours: float = Field(0, ge=0, le=100_000)
    hours_per_unit: float = Field(0, ge=0, le=100_000)
    notes: Optional[str] = Field(None, max_length=1000)


def _serialize_step(s) -> dict:
    return {
        "id": str(s.id), "product_id": str(s.product_id), "sequence": s.sequence, "name": s.name,
        "work_center_id": str(s.work_center_id) if s.work_center_id else None,
        "setup_hours": _num(s.setup_hours) or 0, "hours_per_unit": _num(s.hours_per_unit) or 0,
        "notes": s.notes,
    }


@router.get("/products/{product_id}/routing")
async def get_product_routing(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """The product's standard routing (copied onto orders when they are confirmed)."""
    from app.models.production_routing import ProductRoutingStep

    rows = (await db.execute(
        select(ProductRoutingStep).where(
            ProductRoutingStep.vendor_id == vendor_id, ProductRoutingStep.product_id == product_id,
        ).order_by(ProductRoutingStep.sequence)
    )).scalars().all()
    return {"items": [_serialize_step(r) for r in rows], "total": len(rows)}


@router.put("/products/{product_id}/routing", dependencies=[Depends(production_manage)])
async def replace_product_routing(
    product_id: UUID,
    steps: List[RoutingStepIn],
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Replace the product's standard routing. Existing orders keep the operations they already have."""
    from sqlalchemy import delete
    from app.models.production_routing import ProductRoutingStep
    from app.models.vendor_product import Product

    if not (await db.execute(
        select(Product.id).where(Product.id == product_id, Product.vendor_id == vendor_id)
    )).first():
        raise HTTPException(404, "Product not found")
    if len(steps) > 50:
        raise HTTPException(400, "A routing can have at most 50 steps")
    wc_ids = {s.work_center_id for s in steps if s.work_center_id}
    if wc_ids:
        found = set((await db.execute(
            select(WorkCenter.id).where(WorkCenter.vendor_id == vendor_id, WorkCenter.id.in_(wc_ids))
        )).scalars().all())
        if wc_ids - found:
            raise HTTPException(400, "Unknown work center in the routing")

    await db.execute(delete(ProductRoutingStep).where(
        ProductRoutingStep.vendor_id == vendor_id, ProductRoutingStep.product_id == product_id,
    ))
    rows = []
    for idx, s in enumerate(steps):
        row = ProductRoutingStep(
            vendor_id=vendor_id, product_id=product_id, work_center_id=s.work_center_id, sequence=(idx + 1) * 10,
            name=s.name.strip(), setup_hours=Decimal(str(s.setup_hours)),
            hours_per_unit=Decimal(str(s.hours_per_unit)), notes=s.notes,
        )
        db.add(row)
        rows.append(row)
    await db.commit()
    for r in rows:
        await db.refresh(r)
    return {"items": [_serialize_step(r) for r in rows], "total": len(rows)}


# ── Partial output ────────────────────────────────────────────────────────

class OutputLine(BaseModel):
    product_id: UUID
    qty: int = Field(..., gt=0, le=10_000_000)


class OutputIn(BaseModel):
    items: List[OutputLine] = Field(..., min_length=1, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)


def _actor_name(user) -> str:
    return (getattr(user, "full_name", None) or getattr(user, "email", None) or "User").strip()


@router.get("/production-orders/{order_id}/outputs")
async def list_outputs(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Quantities ordered/produced per product plus the recorded partial outputs."""
    from app.services.production_output import output_summary

    order = (await db.execute(
        select(ProductionOrder).where(ProductionOrder.id == order_id, ProductionOrder.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Production order not found")
    return output_summary(order)


@router.post("/production-orders/{order_id}/outputs", status_code=201, dependencies=[Depends(production_manage)])
async def record_partial_output(
    order_id: UUID,
    body: OutputIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Receive part of the order into stock now (consumes the matching share of materials)."""
    from app.services.production_output import OutputError, output_summary, record_output

    order = (await db.execute(
        select(ProductionOrder)
        .where(ProductionOrder.id == order_id, ProductionOrder.vendor_id == vendor_id)
        .with_for_update()
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Production order not found")
    quantities: dict[str, int] = {}
    for line in body.items:
        quantities[str(line.product_id)] = quantities.get(str(line.product_id), 0) + line.qty
    try:
        await record_output(db, vendor_id, order, quantities, actor=_actor_name(current_user), notes=body.notes)
        await db.commit()
    except OutputError as exc:
        await db.rollback()
        raise HTTPException(exc.status_code, str(exc))
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(400, str(exc))
    await db.refresh(order)
    return output_summary(order)


@router.delete("/production-orders/{order_id}/outputs/{output_id}", dependencies=[Depends(production_manage)])
async def reverse_partial_output(
    order_id: UUID,
    output_id: str,
    vendor_id: UUID = Depends(get_current_vendor_id),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Take a recorded output back out of stock (only while the order is open)."""
    from app.services.production_output import OutputError, output_summary, reverse_output

    order = (await db.execute(
        select(ProductionOrder)
        .where(ProductionOrder.id == order_id, ProductionOrder.vendor_id == vendor_id)
        .with_for_update()
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Production order not found")
    try:
        await reverse_output(db, vendor_id, order, output_id, actor=_actor_name(current_user))
        await db.commit()
    except OutputError as exc:
        await db.rollback()
        raise HTTPException(exc.status_code, str(exc))
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(409, str(exc))
    await db.refresh(order)
    return output_summary(order)
