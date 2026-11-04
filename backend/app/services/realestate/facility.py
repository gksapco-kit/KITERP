"""Facility management (module 19): work orders, preventive maintenance, utility meters, housekeeping and security."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import operations as O

from .assets import record_service
from .common import Ctx, D, audit, get_owned, money_q, next_number

DUE_DAYS = {"urgent": 1, "high": 3, "medium": 7, "low": 14}
LIVE_WO = ("open", "assigned", "in_progress")


def _f(v: Any) -> float:
    return float(D(v))


async def _derive_project(ctx: Ctx, data: dict[str, Any]) -> None:
    """Fill project from the unit or asset so a record never points at two different projects."""
    if data.get("unit_id"):
        unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, data["unit_id"], "unit")
        if data.get("project_id") and data["project_id"] != unit.project_id:
            raise HTTPException(status_code=422, detail="That unit belongs to a different project")
        data["project_id"] = unit.project_id
    if data.get("asset_id"):
        a = await get_owned(ctx.db, O.ReAsset, ctx.vendor_id, data["asset_id"], "asset")
        if a.status == "disposed":
            raise HTTPException(status_code=409, detail=f"{a.name} has been disposed of")
        data.setdefault("project_id", a.project_id)
        if not data.get("project_id"):
            data["project_id"] = a.project_id


# ═══ work orders ════════════════════════════════════════════════════════════════════════════

async def fwo_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await _derive_project(ctx, data)
    if not data.get("project_id") and not data.get("unit_id") and not data.get("asset_id"):
        raise HTTPException(status_code=422, detail="Say where the work is: choose a project, unit or asset")
    data.setdefault("requested_on", date.today())
    if not data.get("due_date"):
        data["due_date"] = data["requested_on"] + timedelta(days=DUE_DAYS.get(data.get("priority", "medium"), 7))
    if data["due_date"] < data["requested_on"]:
        raise HTTPException(status_code=422, detail="The due date is before the request date")
    data.update(status="open", labour_cost=0, material_cost=0, total_cost=0, started_on=None, completed_on=None)


async def fwo_before_update(ctx: Ctx, obj: O.ReFacilityWorkOrder, data: dict[str, Any]) -> None:
    if any(k in data for k in ("unit_id", "asset_id")):
        await _derive_project(ctx, data)


def _wo(wo: O.ReFacilityWorkOrder, allowed: tuple[str, ...], label: str) -> None:
    if wo.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Work order is {wo.status.replace('_', ' ')}; cannot {label}")


async def fwo_assign(ctx: Ctx, wo: O.ReFacilityWorkOrder, assigned_to: str, contractor_id: Optional[UUID]) -> O.ReFacilityWorkOrder:
    _wo(wo, ("open", "assigned"), "assign")
    if not (assigned_to or "").strip() and not contractor_id:
        raise HTTPException(status_code=422, detail="Name who will do the work")
    if contractor_id:
        from app.models.realestate.contractors import ReContractor

        await get_owned(ctx.db, ReContractor, ctx.vendor_id, contractor_id, "contractor")
        wo.contractor_id = contractor_id
    wo.assigned_to = (assigned_to or "").strip() or wo.assigned_to
    wo.status = "assigned"
    await audit(ctx, "facility_work_order", wo.id, "assign", ref=wo.wo_no, changes={"to": wo.assigned_to})
    return wo


async def fwo_start(ctx: Ctx, wo: O.ReFacilityWorkOrder) -> O.ReFacilityWorkOrder:
    _wo(wo, ("open", "assigned"), "start")
    wo.status, wo.started_on = "in_progress", date.today()
    await audit(ctx, "facility_work_order", wo.id, "start", ref=wo.wo_no)
    return wo


async def fwo_complete(ctx: Ctx, wo: O.ReFacilityWorkOrder, resolution: str, labour: Decimal, material: Decimal) -> O.ReFacilityWorkOrder:
    _wo(wo, ("open", "assigned", "in_progress"), "complete")
    if not (resolution or "").strip():
        raise HTTPException(status_code=422, detail="Describe the work done")
    labour, material = money_q(labour), money_q(material)
    if labour < 0 or material < 0:
        raise HTTPException(status_code=422, detail="Costs cannot be negative")
    today = date.today()
    wo.status, wo.completed_on, wo.resolution = "completed", today, resolution.strip()
    wo.started_on = wo.started_on or today
    wo.labour_cost, wo.material_cost, wo.total_cost = labour, material, labour + material
    if wo.pm_schedule_id:
        s = await ctx.db.get(O.RePmSchedule, wo.pm_schedule_id)
        if s is not None:
            s.last_done_on, s.next_due_on = today, today + timedelta(days=int(s.frequency_days or 30))
    if wo.asset_id:
        a = await ctx.db.get(O.ReAsset, wo.asset_id)
        if a is not None and a.status != "disposed":
            ctx.db.add(O.ReAssetMaintenance(
                id=uuid.uuid4(), vendor_id=ctx.vendor_id, asset_id=a.id, kind="preventive" if wo.pm_schedule_id else "breakdown",
                performed_on=today, performed_by=wo.assigned_to, cost=wo.total_cost, description=f"{wo.wo_no}: {wo.title}",
                next_due_on=None))
            await record_service(ctx, a, today, None)
    await audit(ctx, "facility_work_order", wo.id, "complete", ref=wo.wo_no, changes={"cost": wo.total_cost})
    return wo


async def fwo_close(ctx: Ctx, wo: O.ReFacilityWorkOrder) -> O.ReFacilityWorkOrder:
    _wo(wo, ("completed",), "close")
    wo.status = "closed"
    await audit(ctx, "facility_work_order", wo.id, "close", ref=wo.wo_no)
    return wo


async def fwo_cancel(ctx: Ctx, wo: O.ReFacilityWorkOrder, reason: str) -> O.ReFacilityWorkOrder:
    _wo(wo, LIVE_WO, "cancel")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Give a reason")
    wo.status = "cancelled"
    wo.resolution = f"Cancelled: {reason.strip()}"
    await audit(ctx, "facility_work_order", wo.id, "cancel", ref=wo.wo_no, changes={"reason": reason})
    return wo


# ═══ preventive maintenance ═════════════════════════════════════════════════════════════════

async def pm_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if int(data.get("frequency_days", 30)) < 1:
        raise HTTPException(status_code=422, detail="The interval must be at least one day")
    await _derive_project(ctx, data)
    if not data.get("project_id") and not data.get("unit_id") and not data.get("asset_id"):
        raise HTTPException(status_code=422, detail="Choose the project, unit or asset this schedule covers")


async def pm_before_update(ctx: Ctx, obj: O.RePmSchedule, data: dict[str, Any]) -> None:
    if "frequency_days" in data and int(data["frequency_days"]) < 1:
        raise HTTPException(status_code=422, detail="The interval must be at least one day")
    if any(k in data for k in ("unit_id", "asset_id")):
        await _derive_project(ctx, data)


async def _spawn_wo(ctx: Ctx, s: O.RePmSchedule) -> Optional[O.ReFacilityWorkOrder]:
    live = (await ctx.db.execute(select(func.count()).select_from(O.ReFacilityWorkOrder).where(
        O.ReFacilityWorkOrder.pm_schedule_id == s.id, O.ReFacilityWorkOrder.status.in_(LIVE_WO)))).scalar_one()
    if live:
        return None  # one open job per schedule
    wo = O.ReFacilityWorkOrder(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, wo_no=await next_number(ctx.db, ctx.vendor_id, "facility_work_order"),
        project_id=s.project_id, unit_id=s.unit_id, asset_id=s.asset_id, pm_schedule_id=s.id, category=s.category, priority="medium",
        title=f"Preventive maintenance: {s.name}", description=s.checklist, status="open", reported_by="PM schedule",
        assigned_to=s.assigned_to, requested_on=date.today(), due_date=max(s.next_due_on, date.today()),
        labour_cost=0, material_cost=0, total_cost=0)
    if s.assigned_to:
        wo.status = "assigned"
    ctx.db.add(wo)
    await ctx.db.flush()
    return wo


async def pm_generate(ctx: Ctx, s: O.RePmSchedule) -> O.ReFacilityWorkOrder:
    if not s.is_active:
        raise HTTPException(status_code=409, detail="This schedule is switched off")
    wo = await _spawn_wo(ctx, s)
    if wo is None:
        raise HTTPException(status_code=409, detail="A work order for this schedule is already open")
    await audit(ctx, "pm_schedule", s.id, "generate", ref=s.name, changes={"wo": wo.wo_no})
    return wo


async def pm_run_due(ctx: Ctx, as_of: date) -> dict:
    rows = (await ctx.db.execute(select(O.RePmSchedule).where(
        O.RePmSchedule.vendor_id == ctx.vendor_id, O.RePmSchedule.is_active.is_(True), O.RePmSchedule.next_due_on <= as_of)
        .order_by(O.RePmSchedule.next_due_on))).scalars().all()
    created, skipped = [], []
    for s in rows:
        wo = await _spawn_wo(ctx, s)
        (created if wo else skipped).append({"schedule": s.name, "wo_no": wo.wo_no if wo else None})
    await audit(ctx, "pm_schedule", None, "run_due", changes={"created": len(created), "skipped": len(skipped), "as_of": as_of})
    return {"created": created, "skipped": skipped}


# ═══ utility meters ═════════════════════════════════════════════════════════════════════════

async def meter_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if not data.get("project_id") and not data.get("unit_id"):
        raise HTTPException(status_code=422, detail="Choose the project or unit this meter serves")
    await _derive_project(ctx, data)
    if D(data.get("rate_per_unit")) < 0:
        raise HTTPException(status_code=422, detail="The rate cannot be negative")
    if D(data.get("multiplier", 1)) <= 0:
        raise HTTPException(status_code=422, detail="The multiplier must be more than zero")
    if D(data.get("opening_reading")) < 0:
        raise HTTPException(status_code=422, detail="The opening reading cannot be negative")
    data["last_reading"] = D(data.get("opening_reading"))
    data["last_reading_on"] = None


async def meter_before_update(ctx: Ctx, obj: O.ReUtilityMeter, data: dict[str, Any]) -> None:
    if "opening_reading" in data and obj.last_reading_on is not None:
        raise HTTPException(status_code=409, detail="Readings have been recorded; the opening reading can no longer change")
    if "rate_per_unit" in data and D(data["rate_per_unit"]) < 0:
        raise HTTPException(status_code=422, detail="The rate cannot be negative")
    if "multiplier" in data and D(data["multiplier"]) <= 0:
        raise HTTPException(status_code=422, detail="The multiplier must be more than zero")
    if "unit_id" in data:
        await _derive_project(ctx, data)


async def meter_before_delete(ctx: Ctx, obj: O.ReUtilityMeter) -> None:
    n = (await ctx.db.execute(select(func.count()).select_from(O.ReMeterReading).where(O.ReMeterReading.meter_id == obj.id))).scalar_one()
    if n:
        raise HTTPException(status_code=409, detail="This meter has readings; switch it off instead")


async def reading_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    m = await get_owned(ctx.db, O.ReUtilityMeter, ctx.vendor_id, data["meter_id"], "meter")
    if not m.is_active:
        raise HTTPException(status_code=409, detail="This meter is switched off")
    on = data.get("reading_on") or date.today()
    if on > date.today():
        raise HTTPException(status_code=422, detail="The reading date cannot be in the future")
    if m.last_reading_on and on <= m.last_reading_on:
        raise HTTPException(status_code=409, detail=f"A reading for {m.last_reading_on:%d %b %Y} already exists; enter a later date")
    if data.get("reading") is None:
        raise HTTPException(status_code=422, detail="Enter the meter reading")
    reading, prev = D(data["reading"]), D(m.last_reading)
    reset = bool(data.get("is_reset"))
    if reading < 0:
        raise HTTPException(status_code=422, detail="The reading cannot be negative")
    if reading < prev and not reset:
        raise HTTPException(status_code=422, detail=f"The reading is lower than the previous {prev:g}. If the meter was replaced or rolled over, tick “Meter reset”")
    consumption = (reading if reset else reading - prev) * D(m.multiplier)
    data.update(reading_on=on, previous_reading=prev, unit_id=m.unit_id, consumption=consumption.quantize(Decimal("0.001")),
                amount=money_q(consumption * D(m.rate_per_unit)), billed=False, billed_bill_id=None)


async def reading_after_create(ctx: Ctx, r: O.ReMeterReading) -> None:
    m = await ctx.db.get(O.ReUtilityMeter, r.meter_id)
    m.last_reading, m.last_reading_on = r.reading, r.reading_on


# ═══ housekeeping ═══════════════════════════════════════════════════════════════════════════

async def hk_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    data.update(status="scheduled", completed_on=None, checked_by=None, rating=None)


async def hk_complete(ctx: Ctx, h: O.ReHousekeepingLog, checked_by: Optional[str], rating: Optional[int], remarks: Optional[str]) -> O.ReHousekeepingLog:
    if h.status != "scheduled":
        raise HTTPException(status_code=409, detail=f"This task is already {h.status}")
    if rating is not None and not 1 <= int(rating) <= 5:
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 5")
    h.status, h.completed_on, h.checked_by = "done", date.today(), checked_by or h.checked_by
    h.rating = int(rating) if rating is not None else None
    if remarks:
        h.remarks = remarks[:500]
    return h


async def hk_miss(ctx: Ctx, h: O.ReHousekeepingLog, reason: str) -> O.ReHousekeepingLog:
    if h.status != "scheduled":
        raise HTTPException(status_code=409, detail=f"This task is already {h.status}")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Say why it was missed")
    h.status, h.remarks = "missed", reason.strip()[:500]
    return h


# ═══ security ═══════════════════════════════════════════════════════════════════════════════

async def security_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("occurred_at") is None:
        data["occurred_at"] = datetime.now(timezone.utc)
    elif data["occurred_at"].tzinfo is None:
        data["occurred_at"] = data["occurred_at"].replace(tzinfo=timezone.utc)
    if data["occurred_at"] > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise HTTPException(status_code=422, detail="The log time cannot be in the future")
    if "resolved" not in data:
        data["resolved"] = data.get("log_type") not in ("incident", "alarm") and data.get("severity", "info") != "critical"


async def security_resolve(ctx: Ctx, s: O.ReSecurityLog, action_taken: str) -> O.ReSecurityLog:
    if s.resolved:
        raise HTTPException(status_code=409, detail="This entry is already resolved")
    if not (action_taken or "").strip():
        raise HTTPException(status_code=422, detail="Describe the action taken")
    s.resolved, s.action_taken = True, action_taken.strip()[:500]
    await audit(ctx, "security_log", s.id, "resolve")
    return s


# ═══ overview ═══════════════════════════════════════════════════════════════════════════════

async def summary(db: AsyncSession, vendor_id: UUID) -> dict:
    today = date.today()
    wos = (await db.execute(select(O.ReFacilityWorkOrder).where(O.ReFacilityWorkOrder.vendor_id == vendor_id))).scalars().all()
    live = [w for w in wos if w.status in LIVE_WO]
    overdue = [w for w in live if w.due_date and w.due_date < today]
    done = [w for w in wos if w.status in ("completed", "closed") and w.completed_on]
    mttr = (sum((w.completed_on - w.requested_on).days for w in done) / len(done)) if done else 0
    by_cat: dict[str, dict] = {}
    for w in wos:
        c = by_cat.setdefault(w.category, {"category": w.category, "open": 0, "done": 0, "cost": Decimal(0)})
        if w.status in LIVE_WO:
            c["open"] += 1
        elif w.status in ("completed", "closed"):
            c["done"] += 1
            c["cost"] += D(w.total_cost)
    schedules = (await db.execute(select(O.RePmSchedule).where(O.RePmSchedule.vendor_id == vendor_id, O.RePmSchedule.is_active.is_(True)))).scalars().all()
    pm_due = [s for s in schedules if s.next_due_on <= today]
    unresolved = (await db.execute(select(func.count()).select_from(O.ReSecurityLog).where(
        O.ReSecurityLog.vendor_id == vendor_id, O.ReSecurityLog.resolved.is_(False)))).scalar_one()
    month_start = today.replace(day=1)
    hk = (await db.execute(select(O.ReHousekeepingLog.status, func.count()).where(
        O.ReHousekeepingLog.vendor_id == vendor_id, O.ReHousekeepingLog.scheduled_on >= month_start).group_by(O.ReHousekeepingLog.status))).all()
    hk_map = {s: n for s, n in hk}
    hk_total = sum(hk_map.values())
    util = (await db.execute(select(O.ReMeterReading.meter_id, func.sum(O.ReMeterReading.amount)).where(
        O.ReMeterReading.vendor_id == vendor_id, O.ReMeterReading.reading_on >= month_start).group_by(O.ReMeterReading.meter_id))).all()
    return {
        "open_work_orders": len(live), "overdue_work_orders": len(overdue), "avg_days_to_complete": round(mttr, 1),
        "maintenance_cost": _f(sum(D(w.total_cost) for w in wos if w.status in ("completed", "closed"))),
        "pm_schedules": len(schedules), "pm_due": len(pm_due), "unresolved_security": unresolved,
        "housekeeping_done_pct": round(100 * hk_map.get("done", 0) / hk_total, 1) if hk_total else None,
        "housekeeping_missed": hk_map.get("missed", 0), "utility_cost_month": _f(sum(D(a) for _m, a in util)),
        "by_category": [{**c, "cost": _f(c["cost"])} for c in sorted(by_cat.values(), key=lambda x: -(x["open"] + x["done"]))],
        "overdue": [{"wo_no": w.wo_no, "title": w.title, "priority": w.priority, "due_date": w.due_date.isoformat(), "assigned_to": w.assigned_to}
                    for w in sorted(overdue, key=lambda w: w.due_date)[:15]],
    }
