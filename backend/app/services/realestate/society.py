"""Society management (module 20): residents, maintenance plans and bills, visitors and notices."""
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

from . import finance_bridge
from .common import Ctx, D, audit, get_owned, money_q, next_number
from .leasing import EPS, _age_bucket, month_first, outstanding
from .postsales import add_months


def _f(v: Any) -> float:
    return float(D(v))


# ═══ residents ══════════════════════════════════════════════════════════════════════════════

async def _check_primary(ctx: Ctx, unit_id: UUID, exclude: Optional[UUID] = None) -> None:
    q = select(func.count()).select_from(O.ReResident).where(
        O.ReResident.unit_id == unit_id, O.ReResident.status == "active", O.ReResident.is_primary.is_(True))
    if exclude:
        q = q.where(O.ReResident.id != exclude)
    if (await ctx.db.execute(q)).scalar_one():
        raise HTTPException(status_code=409, detail="This unit already has a primary resident; move them out or untick “primary” first")


async def resident_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, data["unit_id"], "unit")
    data["project_id"] = unit.project_id
    data.update(status="active", moved_out_on=None)
    data.setdefault("moved_in_on", date.today())
    if data.get("is_primary"):
        await _check_primary(ctx, unit.id)


async def resident_before_update(ctx: Ctx, obj: O.ReResident, data: dict[str, Any]) -> None:
    if "unit_id" in data and data["unit_id"] != obj.unit_id:
        raise HTTPException(status_code=409, detail="A resident cannot be moved to another unit; move out and add a new record")
    if data.get("is_primary"):
        await _check_primary(ctx, obj.unit_id, exclude=obj.id)


async def resident_move_out(ctx: Ctx, r: O.ReResident, on: Optional[date]) -> O.ReResident:
    if r.status != "active":
        raise HTTPException(status_code=409, detail="This resident has already moved out")
    on = on or date.today()
    if r.moved_in_on and on < r.moved_in_on:
        raise HTTPException(status_code=422, detail="The move-out date is before the move-in date")
    r.status, r.moved_out_on, r.is_primary = "moved_out", on, False
    await audit(ctx, "resident", r.id, "move_out", ref=r.name)
    return r


# ═══ maintenance plans ══════════════════════════════════════════════════════════════════════

def _check_plan(d: dict[str, Any]) -> None:
    if D(d.get("rate")) < 0 or D(d.get("sinking_fund_rate")) < 0:
        raise HTTPException(status_code=422, detail="Rates cannot be negative")
    if D(d.get("rate")) == 0 and D(d.get("sinking_fund_rate")) == 0:
        raise HTTPException(status_code=422, detail="Set a maintenance or sinking-fund rate")
    if not 1 <= int(d.get("due_day", 10)) <= 28:
        raise HTTPException(status_code=422, detail="Due day must be between 1 and 28")
    if not 0 <= D(d.get("gst_rate")) <= 28:
        raise HTTPException(status_code=422, detail="GST rate must be between 0% and 28%")


async def _one_active(ctx: Ctx, project_id: UUID, exclude: Optional[UUID] = None) -> None:
    q = select(func.count()).select_from(O.ReMaintenancePlan).where(
        O.ReMaintenancePlan.project_id == project_id, O.ReMaintenancePlan.is_active.is_(True))
    if exclude:
        q = q.where(O.ReMaintenancePlan.id != exclude)
    if (await ctx.db.execute(q)).scalar_one():
        raise HTTPException(status_code=409, detail="This project already has an active maintenance plan; switch it off first so units are not billed twice")


async def plan_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await get_owned(ctx.db, C.ReProject, ctx.vendor_id, data["project_id"], "project")
    _check_plan(data)
    if data.get("is_active", True):
        await _one_active(ctx, data["project_id"])


async def plan_before_update(ctx: Ctx, obj: O.ReMaintenancePlan, data: dict[str, Any]) -> None:
    if "project_id" in data and data["project_id"] != obj.project_id:
        raise HTTPException(status_code=409, detail="A plan cannot move to another project")
    keys = ("rate", "sinking_fund_rate", "due_day", "gst_rate")
    _check_plan({k: data.get(k, getattr(obj, k)) for k in keys})
    if data.get("is_active") and not obj.is_active:
        await _one_active(ctx, obj.project_id, exclude=obj.id)


async def plan_before_delete(ctx: Ctx, obj: O.ReMaintenancePlan) -> None:
    n = (await ctx.db.execute(select(func.count()).select_from(O.ReMaintenanceBill).where(O.ReMaintenanceBill.plan_id == obj.id))).scalar_one()
    if n:
        raise HTTPException(status_code=409, detail="Bills were raised under this plan; switch it off instead")


def _area(u: C.ReUnit) -> Decimal:
    return D(u.super_area) or D(u.built_up_area) or D(u.carpet_area)


async def generate_bills(ctx: Ctx, plan: O.ReMaintenancePlan, month: date) -> dict:
    """Bill every occupied unit of the plan's project for the period starting in ``month`` (idempotent)."""
    if not plan.is_active:
        raise HTTPException(status_code=409, detail="This plan is switched off")
    first = month_first(month)
    months = 3 if plan.frequency == "quarterly" else 1
    if months == 3 and (first.month - 1) % 3:
        raise HTTPException(status_code=422, detail="Quarterly bills start in January, April, July or October")
    if plan.effective_from and add_months(first, months) <= plan.effective_from:
        raise HTTPException(status_code=422, detail=f"The plan takes effect on {plan.effective_from:%d %b %Y}")
    last = add_months(first, months) - timedelta(days=1)
    units = (await ctx.db.execute(select(C.ReUnit).where(
        C.ReUnit.project_id == plan.project_id, C.ReUnit.status.in_(O.OCCUPIED_UNIT_STATUSES)).order_by(C.ReUnit.unit_number))).scalars().all()
    created, skipped = [], []
    for u in units:
        dup = (await ctx.db.execute(select(O.ReMaintenanceBill.status).where(
            O.ReMaintenanceBill.plan_id == plan.id, O.ReMaintenanceBill.unit_id == u.id,
            O.ReMaintenanceBill.period_start == first).limit(1))).scalar_one_or_none()
        if dup:
            skipped.append({"unit": u.unit_number, "reason": "cancelled" if dup == "cancelled" else "already billed"})
            continue
        area = _area(u)
        if plan.basis == "per_sqft" and area <= 0:
            skipped.append({"unit": u.unit_number, "reason": "no area recorded"})
            continue
        mult = area if plan.basis == "per_sqft" else Decimal(1)
        maint = money_q(D(plan.rate) * mult * months)
        sink = money_q(D(plan.sinking_fund_rate) * mult * months)
        gst = money_q((maint + sink) * D(plan.gst_rate) / 100)
        resident = (await ctx.db.execute(select(O.ReResident).where(
            O.ReResident.unit_id == u.id, O.ReResident.status == "active").order_by(O.ReResident.is_primary.desc()).limit(1))).scalar_one_or_none()
        bill = O.ReMaintenanceBill(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, bill_no=await next_number(ctx.db, ctx.vendor_id, "maintenance_bill"),
            plan_id=plan.id, project_id=plan.project_id, unit_id=u.id, resident_id=resident.id if resident else None,
            period_start=first, period_end=last, due_date=first.replace(day=min(int(plan.due_day or 10), 28)), area=area,
            maintenance_amount=maint, sinking_fund=sink, utility_amount=0, gst_amount=gst, total_amount=maint + sink + gst,
            paid_amount=0, status="issued")
        ctx.db.add(bill)
        await ctx.db.flush()
        util = Decimal(0)
        readings = (await ctx.db.execute(select(O.ReMeterReading).where(
            O.ReMeterReading.unit_id == u.id, O.ReMeterReading.billed.is_(False), O.ReMeterReading.reading_on <= last))).scalars().all()
        for r in readings:
            r.billed, r.billed_bill_id = True, bill.id
            util += D(r.amount)
        if util:
            bill.utility_amount, bill.total_amount = money_q(util), bill.total_amount + money_q(util)
        await finance_bridge.post_demand(ctx.db, ctx.vendor_id, demand_id=bill.id, total=bill.total_amount, gst=gst, customer_id=None,
                                         narration=f"Maintenance {bill.bill_no}", entry_date=bill.due_date)
        created.append({"unit": u.unit_number, "bill_no": bill.bill_no, "total": _f(bill.total_amount), "utilities": _f(util)})
    await audit(ctx, "maintenance_plan", plan.id, "generate", ref=plan.name,
                changes={"period": first, "created": len(created), "skipped": len(skipped)})
    return {"period": first.strftime("%Y-%m"), "created": created, "skipped": skipped}


async def bill_before_update(ctx: Ctx, obj: O.ReMaintenanceBill, data: dict[str, Any]) -> None:
    if set(data) - {"due_date"}:
        raise HTTPException(status_code=409, detail="Only the due date of a bill can be changed")


async def cancel_bill(ctx: Ctx, bill: O.ReMaintenanceBill, reason: str) -> None:
    if bill.status == "cancelled":
        raise HTTPException(status_code=409, detail="Bill is already cancelled")
    if D(bill.paid_amount) > 0:
        raise HTTPException(status_code=409, detail="Payments were received against this bill; it cannot be cancelled")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Give a reason")
    bill.status = "cancelled"
    for r in (await ctx.db.execute(select(O.ReMeterReading).where(O.ReMeterReading.billed_bill_id == bill.id))).scalars().all():
        r.billed, r.billed_bill_id = False, None  # the utility charges go on the next bill instead
    await finance_bridge.void_posted(ctx.db, ctx.vendor_id, "invoice", bill.id)
    await audit(ctx, "maintenance_bill", bill.id, "cancel", ref=bill.bill_no, changes={"reason": reason})


# ═══ visitors ═══════════════════════════════════════════════════════════════════════════════

async def visitor_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("unit_id"):
        unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, data["unit_id"], "unit")
        data["project_id"] = unit.project_id
    if data.get("resident_id"):
        r = await get_owned(ctx.db, O.ReResident, ctx.vendor_id, data["resident_id"], "resident")
        if data.get("unit_id") and r.unit_id != data["unit_id"]:
            raise HTTPException(status_code=422, detail="That resident does not live in the chosen unit")
        data.setdefault("unit_id", r.unit_id)
        data["project_id"] = r.project_id
    if not data.get("unit_id"):
        raise HTTPException(status_code=422, detail="Choose the unit being visited")
    data.update(status="expected", check_in_at=None, check_out_at=None)


def _visit(v: O.ReVisitor, allowed: tuple[str, ...], label: str) -> None:
    if v.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Visitor is {v.status.replace('_', ' ')}; cannot {label}")


async def visitor_check_in(ctx: Ctx, v: O.ReVisitor) -> O.ReVisitor:
    _visit(v, ("expected",), "check in")
    v.status, v.check_in_at = "checked_in", datetime.now(timezone.utc)
    return v


async def visitor_check_out(ctx: Ctx, v: O.ReVisitor) -> O.ReVisitor:
    _visit(v, ("checked_in",), "check out")
    v.status, v.check_out_at = "checked_out", datetime.now(timezone.utc)
    return v


async def visitor_deny(ctx: Ctx, v: O.ReVisitor, reason: str) -> O.ReVisitor:
    _visit(v, ("expected",), "deny entry to")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Give a reason")
    v.status, v.remarks = "denied", reason.strip()[:255]
    return v


# ═══ notices ════════════════════════════════════════════════════════════════════════════════

async def notice_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("valid_until") and data["valid_until"] < date.today():
        raise HTTPException(status_code=422, detail="The notice would already have expired")
    data.update(is_published=False, posted_on=None)


async def notice_publish(ctx: Ctx, n: O.ReNotice) -> O.ReNotice:
    if n.is_published:
        raise HTTPException(status_code=409, detail="This notice is already published")
    if n.valid_until and n.valid_until < date.today():
        raise HTTPException(status_code=409, detail="This notice has expired; edit its validity first")
    n.is_published, n.posted_on = True, date.today()
    await audit(ctx, "notice", n.id, "publish", ref=n.title)
    return n


async def notice_unpublish(ctx: Ctx, n: O.ReNotice) -> O.ReNotice:
    if not n.is_published:
        raise HTTPException(status_code=409, detail="This notice is not published")
    n.is_published = False
    await audit(ctx, "notice", n.id, "unpublish", ref=n.title)
    return n


# ═══ overview ═══════════════════════════════════════════════════════════════════════════════

async def summary(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID] = None) -> dict:
    today = date.today()
    q = select(O.ReMaintenanceBill).where(O.ReMaintenanceBill.vendor_id == vendor_id, O.ReMaintenanceBill.status != "cancelled")
    if project_id:
        q = q.where(O.ReMaintenanceBill.project_id == project_id)
    bills = (await db.execute(q)).scalars().all()
    billed = sum(D(b.total_amount) for b in bills)
    collected = sum(D(b.paid_amount) for b in bills)
    open_ = [b for b in bills if b.status in ("issued", "partial")]
    buckets = {"current": Decimal(0), "1-30": Decimal(0), "31-60": Decimal(0), "61-90": Decimal(0), "90+": Decimal(0)}
    by_unit: dict[Any, Decimal] = {}
    for b in open_:
        out = outstanding(b)
        buckets[_age_bucket((today - b.due_date).days)] += out
        if b.due_date < today:
            by_unit[b.unit_id] = by_unit.get(b.unit_id, Decimal(0)) + out
    defaulters = []
    for uid, amt in sorted(by_unit.items(), key=lambda kv: -kv[1])[:15]:
        u = await db.get(C.ReUnit, uid)
        res = (await db.execute(select(O.ReResident).where(O.ReResident.unit_id == uid, O.ReResident.status == "active")
                                .order_by(O.ReResident.is_primary.desc()).limit(1))).scalar_one_or_none()
        defaulters.append({"unit": u.unit_number if u else "", "resident": res.name if res else "—", "phone": res.phone if res else None, "overdue": _f(amt)})
    rq = select(func.count()).select_from(O.ReResident).where(O.ReResident.vendor_id == vendor_id, O.ReResident.status == "active")
    vq = select(func.count()).select_from(O.ReVisitor).where(O.ReVisitor.vendor_id == vendor_id, O.ReVisitor.status == "checked_in")
    nq = select(func.count()).select_from(O.ReNotice).where(
        O.ReNotice.vendor_id == vendor_id, O.ReNotice.is_published.is_(True),
        (O.ReNotice.valid_until.is_(None)) | (O.ReNotice.valid_until >= today))
    return {
        "billed": _f(billed), "collected": _f(collected), "outstanding": _f(billed - collected),
        "collection_pct": round(float(collected / billed * 100), 1) if billed else None,
        "overdue": _f(sum(v for k, v in buckets.items() if k != "current")), "aging": {k: _f(v) for k, v in buckets.items()},
        "defaulters": defaulters, "active_residents": (await db.execute(rq)).scalar_one(),
        "visitors_inside": (await db.execute(vq)).scalar_one(), "live_notices": (await db.execute(nq)).scalar_one(),
    }
