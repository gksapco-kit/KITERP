"""Capacity-aware forward scheduling of a production order's operations.

A planning aid, deliberately simple (single queue per work center):

* operations run in routing order; one starts when the previous one has ended and its
  work center is free;
* a work center is busy until the latest planned end of the *other* open orders' operations
  queued on it;
* an operation lasts ``planned_hours / capacity_per_day`` days (8 h/day when the work center
  has no capacity set), so a 20 h job on an 8 h/day center takes 2.5 days.

It does not model shifts, holidays or splitting an operation across centers.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import ProductionOrder
from app.models.production_routing import ProductionOperation, WorkCenter
from app.services.production_lifecycle import TERMINAL_STATUSES

DEFAULT_HOURS_PER_DAY = Decimal("8")
OPEN_OP_STATUSES = ("pending", "in_progress")


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def build_schedule(
    db: AsyncSession, vendor_id: UUID, order: ProductionOrder, start: Optional[date] = None,
) -> dict[str, Any]:
    """Compute (but do not store) planned start/end for the order's open operations."""
    begin = datetime.combine(start or date.today(), time(0, 0), tzinfo=timezone.utc)
    ops = (await db.execute(
        select(ProductionOperation).where(
            ProductionOperation.production_order_id == order.id, ProductionOperation.vendor_id == vendor_id,
            ProductionOperation.status.in_(OPEN_OP_STATUSES),
        ).order_by(ProductionOperation.sequence, ProductionOperation.created_at)
    )).scalars().all()

    centers = {
        wc.id: wc for wc in (await db.execute(
            select(WorkCenter).where(WorkCenter.vendor_id == vendor_id)
        )).scalars().all()
    }

    # When each work center is next free: latest planned end of other live orders' open operations.
    busy_until: dict[UUID, datetime] = {}
    others = (await db.execute(
        select(ProductionOperation.work_center_id, ProductionOperation.planned_end)
        .join(ProductionOrder, ProductionOrder.id == ProductionOperation.production_order_id)
        .where(
            ProductionOperation.vendor_id == vendor_id,
            ProductionOperation.production_order_id != order.id,
            ProductionOperation.status.in_(OPEN_OP_STATUSES),
            ProductionOperation.work_center_id.is_not(None),
            ProductionOperation.planned_end.is_not(None),
            ProductionOrder.status.notin_(tuple(TERMINAL_STATUSES)),
        )
    )).all()
    for wc_id, planned_end in others:
        end = _utc(planned_end)
        if end > busy_until.get(wc_id, begin):
            busy_until[wc_id] = end

    steps: list[dict[str, Any]] = []
    prev_end = begin
    for op in ops:
        wc = centers.get(op.work_center_id) if op.work_center_id else None
        per_day = Decimal(str(wc.capacity_per_day)) if wc and wc.capacity_per_day else DEFAULT_HOURS_PER_DAY
        hours = Decimal(str(op.planned_hours or 0))
        op_start = max(prev_end, busy_until.get(op.work_center_id, begin)) if op.work_center_id else prev_end
        op_end = op_start + timedelta(days=float(hours / per_day)) if hours > 0 else op_start
        if op.work_center_id:
            busy_until[op.work_center_id] = op_end
        prev_end = op_end
        steps.append({
            "operation_id": str(op.id), "name": op.name, "work_center": wc.name if wc else None,
            "planned_hours": float(hours), "start": op_start.isoformat(), "end": op_end.isoformat(),
        })

    finish = prev_end if steps else None
    deadline = order.delivery_deadline or order.target_date
    late_days = None
    if finish is not None and deadline is not None and finish.date() > deadline:
        late_days = (finish.date() - deadline).days
    return {
        "start": begin.isoformat(), "finish": finish.isoformat() if finish else None,
        "deadline": deadline.isoformat() if deadline else None,
        "late_by_days": late_days, "steps": steps,
    }


async def apply_schedule(db: AsyncSession, vendor_id: UUID, order: ProductionOrder, plan: dict[str, Any]) -> int:
    by_id = {s["operation_id"]: s for s in plan["steps"]}
    if not by_id:
        return 0
    ops = (await db.execute(
        select(ProductionOperation).where(
            ProductionOperation.production_order_id == order.id, ProductionOperation.vendor_id == vendor_id,
        )
    )).scalars().all()
    n = 0
    for op in ops:
        s = by_id.get(str(op.id))
        if s:
            op.planned_start = datetime.fromisoformat(s["start"])
            op.planned_end = datetime.fromisoformat(s["end"])
            n += 1
    await db.flush()
    return n
