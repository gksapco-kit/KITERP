"""Work centers + routing operations for Production Orders (Phase 5)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id
from app.models.plant import Plant
from app.models.production import ProductionOrder
from app.models.production_routing import WorkCenter, ProductionOperation
from app.services.production_costing import recalculate_labor_cost

router = APIRouter()

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


@router.post("/work-centers", status_code=201)
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


@router.put("/work-centers/{wc_id}")
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

    for k, v in data.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return _serialize_wc(row)


@router.delete("/work-centers/{wc_id}", status_code=204)
async def delete_work_center(
    wc_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_work_center_or_404(db, vendor_id, wc_id)
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


@router.post("/production-orders/{order_id}/operations", status_code=201)
async def create_operation(
    order_id: UUID,
    body: OperationCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_or_404(db, vendor_id, order_id)
    await _validate_work_center(db, vendor_id, body.work_center_id)

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
    )
    db.add(row)
    await recalculate_labor_cost(db, vendor_id, order_id)
    await db.commit()
    await db.refresh(row)
    return _serialize_op(row)


@router.put("/production-orders/{order_id}/operations/{op_id}")
async def update_operation(
    order_id: UUID,
    op_id: UUID,
    body: OperationUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_or_404(db, vendor_id, order_id)
    row = await _get_operation_or_404(db, vendor_id, order_id, op_id)
    data = body.model_dump(exclude_unset=True)

    if "work_center_id" in data:
        await _validate_work_center(db, vendor_id, data["work_center_id"])

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

    if "planned_hours" in data or "actual_hours" in data or "work_center_id" in data:
        await recalculate_labor_cost(db, vendor_id, order_id)
    await db.commit()
    await db.refresh(row)
    return _serialize_op(row)


@router.delete("/production-orders/{order_id}/operations/{op_id}", status_code=204)
async def delete_operation(
    order_id: UUID,
    op_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_or_404(db, vendor_id, order_id)
    row = await _get_operation_or_404(db, vendor_id, order_id, op_id)
    await db.delete(row)
    await db.flush()
    await recalculate_labor_cost(db, vendor_id, order_id)
    await db.commit()
    return None


@router.put("/production-orders/{order_id}/operations/reorder/apply")
async def reorder_operations(
    order_id: UUID,
    body: OperationReorder,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_order_or_404(db, vendor_id, order_id)
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

    for idx, op_id in enumerate(body.ids):
        by_id[op_id].sequence = (idx + 1) * 10
    await db.commit()
    return {"items": [_serialize_op(by_id[i]) for i in body.ids]}
