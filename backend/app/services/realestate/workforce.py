"""HR & workforce (module 22): site assignments, labour register, attendance and wage sheets."""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import operations as O
from app.models.realestate import workforce as W

from . import finance_bridge
from .common import Ctx, D, audit, get_owned, money_q, next_number

EPS = Decimal("0.005")
MAX_SHEET_DAYS = 31
PAID_DAY = {"present": Decimal(1), "half_day": Decimal("0.5")}


def _f(v: Any) -> float:
    return float(D(v))


# ═══ site assignments ═══════════════════════════════════════════════════════════════════════

async def assignment_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("employee_id"):
        from app.models.hr import EmployeeProfile

        emp = (await ctx.db.execute(select(EmployeeProfile).where(
            EmployeeProfile.id == data["employee_id"], EmployeeProfile.vendor_id == ctx.vendor_id))).scalar_one_or_none()
        if emp is None:
            raise HTTPException(status_code=422, detail="That employee was not found in HR")
        if emp.status == "exited":
            raise HTTPException(status_code=409, detail="This employee has left the company")
        data["employee_name"] = emp.full_name or data.get("employee_name")
        data["employee_code"] = emp.employee_code or data.get("employee_code")
    if not (data.get("employee_name") or "").strip():
        raise HTTPException(status_code=422, detail="Enter the employee's name")
    await _assignment_checks(ctx, data, None)
    data["status"] = "ended" if data.get("to_date") and data["to_date"] < date.today() else "active"


async def assignment_before_update(ctx: Ctx, obj: W.ReSiteAssignment, data: dict[str, Any]) -> None:
    merged = {k: data.get(k, getattr(obj, k)) for k in ("employee_id", "employee_name", "project_id", "from_date", "to_date")}
    await _assignment_checks(ctx, merged, obj)


async def _assignment_checks(ctx: Ctx, d: dict[str, Any], obj: Optional[W.ReSiteAssignment]) -> None:
    if d.get("to_date") and d["to_date"] < d["from_date"]:
        raise HTTPException(status_code=422, detail="The end date is before the start date")
    q = select(func.count()).select_from(W.ReSiteAssignment).where(
        W.ReSiteAssignment.vendor_id == ctx.vendor_id, W.ReSiteAssignment.project_id == d["project_id"],
        W.ReSiteAssignment.status == "active",
        or_(W.ReSiteAssignment.to_date.is_(None), W.ReSiteAssignment.to_date >= d["from_date"]))
    if d.get("to_date"):
        q = q.where(W.ReSiteAssignment.from_date <= d["to_date"])
    q = q.where(W.ReSiteAssignment.employee_id == d["employee_id"]) if d.get("employee_id") else \
        q.where(func.lower(W.ReSiteAssignment.employee_name) == str(d["employee_name"]).strip().lower())
    if obj is not None:
        q = q.where(W.ReSiteAssignment.id != obj.id)
    if (await ctx.db.execute(q)).scalar_one():
        raise HTTPException(status_code=409, detail="This person is already posted to that project for these dates")


async def assignment_end(ctx: Ctx, a: W.ReSiteAssignment, to_date: Optional[date]) -> W.ReSiteAssignment:
    if a.status != "active":
        raise HTTPException(status_code=409, detail="This assignment has already ended")
    to_date = to_date or date.today()
    if to_date < a.from_date:
        raise HTTPException(status_code=422, detail="The end date is before the start date")
    a.to_date, a.status = to_date, "ended"
    await audit(ctx, "site_assignment", a.id, "end", ref=a.employee_name)
    return a


# ═══ labour ═════════════════════════════════════════════════════════════════════════════════

def _check_labour(d: dict[str, Any]) -> None:
    if D(d.get("daily_wage")) <= 0:
        raise HTTPException(status_code=422, detail="Enter the daily wage")
    a = d.get("aadhaar_last4")
    if a and not (len(a) == 4 and a.isdigit()):
        raise HTTPException(status_code=422, detail="Aadhaar last 4 digits must be exactly four numbers")


async def labour_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    _check_labour(data)
    data.update(status="active", left_on=None)
    data.setdefault("joined_on", date.today())


async def labour_before_update(ctx: Ctx, obj: W.ReLabour, data: dict[str, Any]) -> None:
    _check_labour({"daily_wage": data.get("daily_wage", obj.daily_wage), "aadhaar_last4": data.get("aadhaar_last4", obj.aadhaar_last4)})


async def labour_before_delete(ctx: Ctx, obj: W.ReLabour) -> None:
    n = (await ctx.db.execute(select(func.count()).select_from(W.ReLabourAttendance).where(W.ReLabourAttendance.labour_id == obj.id))).scalar_one()
    if n:
        raise HTTPException(status_code=409, detail="This worker has attendance on record; mark them as left instead")


async def labour_release(ctx: Ctx, l: W.ReLabour, left_on: Optional[date]) -> W.ReLabour:
    if l.status != "active":
        raise HTTPException(status_code=409, detail="This worker has already left")
    left_on = left_on or date.today()
    if l.joined_on and left_on < l.joined_on:
        raise HTTPException(status_code=422, detail="The leaving date is before the joining date")
    last = (await ctx.db.execute(select(func.max(W.ReLabourAttendance.work_date)).where(W.ReLabourAttendance.labour_id == l.id))).scalar_one()
    if last and left_on < last:
        raise HTTPException(status_code=409, detail=f"Attendance is recorded up to {last:%d %b %Y}; the leaving date cannot be earlier")
    l.status, l.left_on = "left", left_on
    await audit(ctx, "labour", l.id, "release", ref=l.name)
    return l


# ═══ attendance ═════════════════════════════════════════════════════════════════════════════

def _check_day(l: W.ReLabour, work_date: date, status: str, ot: Decimal) -> None:
    if work_date > date.today():
        raise HTTPException(status_code=422, detail="Attendance cannot be marked for a future date")
    if l.joined_on and work_date < l.joined_on:
        raise HTTPException(status_code=422, detail=f"{l.name} joined on {l.joined_on:%d %b %Y}")
    if l.status == "left" and l.left_on and work_date > l.left_on:
        raise HTTPException(status_code=409, detail=f"{l.name} left on {l.left_on:%d %b %Y}")
    if not 0 <= ot <= W.MAX_OT_HOURS:
        raise HTTPException(status_code=422, detail=f"Overtime must be between 0 and {W.MAX_OT_HOURS} hours")
    if ot > 0 and status not in ("present", "half_day"):
        raise HTTPException(status_code=422, detail="Overtime can only be recorded against a day worked")


async def attendance_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    l = await get_owned(ctx.db, W.ReLabour, ctx.vendor_id, data["labour_id"], "worker")
    _check_day(l, data["work_date"], data.get("status", "present"), D(data.get("overtime_hours")))
    if (await ctx.db.execute(select(W.ReLabourAttendance.id).where(W.ReLabourAttendance.labour_id == l.id, W.ReLabourAttendance.work_date == data["work_date"]))).first():
        raise HTTPException(status_code=409, detail=f"Attendance for {l.name} on {data['work_date']:%d %b %Y} is already recorded; edit that entry instead")
    data["project_id"] = data.get("project_id") or l.project_id
    if not data["project_id"]:
        raise HTTPException(status_code=422, detail="Choose the project the worker was on")
    data.update(locked=False, wage_sheet_id=None)


async def attendance_before_update(ctx: Ctx, obj: W.ReLabourAttendance, data: dict[str, Any]) -> None:
    if "labour_id" in data and data["labour_id"] != obj.labour_id or "work_date" in data and data["work_date"] != obj.work_date:
        raise HTTPException(status_code=409, detail="Change the status or overtime only; delete and re-enter to change worker or date")
    l = await ctx.db.get(W.ReLabour, obj.labour_id)
    _check_day(l, obj.work_date, data.get("status", obj.status), D(data.get("overtime_hours", obj.overtime_hours)))


async def attendance_bulk(ctx: Ctx, project_id: UUID, work_date: date, entries: list[dict[str, Any]]) -> dict:
    await get_owned(ctx.db, C.ReProject, ctx.vendor_id, project_id, "project")
    created, updated, rejected = 0, 0, []
    for e in entries:
        lid = e["labour_id"]
        try:
            l = await get_owned(ctx.db, W.ReLabour, ctx.vendor_id, lid, "worker")
            status, ot = e.get("status", "present"), D(e.get("overtime_hours"))
            if status not in W.ATTENDANCE_STATUSES:
                raise HTTPException(status_code=422, detail=f"Status must be one of: {', '.join(W.ATTENDANCE_STATUSES)}")
            _check_day(l, work_date, status, ot)
            row = (await ctx.db.execute(select(W.ReLabourAttendance).where(
                W.ReLabourAttendance.labour_id == l.id, W.ReLabourAttendance.work_date == work_date))).scalar_one_or_none()
            if row is None:
                ctx.db.add(W.ReLabourAttendance(id=uuid.uuid4(), vendor_id=ctx.vendor_id, labour_id=l.id, project_id=project_id,
                                                work_date=work_date, status=status, overtime_hours=ot, locked=False))
                created += 1
            elif row.locked:
                raise HTTPException(status_code=409, detail="already paid in a wage sheet")
            else:
                row.status, row.overtime_hours, row.project_id = status, ot, project_id
                updated += 1
        except HTTPException as exc:
            rejected.append({"labour_id": str(lid), "reason": exc.detail})
    await ctx.db.flush()
    await audit(ctx, "labour_attendance", None, "bulk", changes={"date": work_date, "created": created, "updated": updated, "rejected": len(rejected)})
    return {"created": created, "updated": updated, "rejected": rejected}


# ═══ wage sheets ════════════════════════════════════════════════════════════════════════════

def line_amounts(days: Decimal, ot_hours: Decimal, wage: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    basic = money_q(days * wage)
    ot = money_q(ot_hours * (wage / W.STANDARD_HOURS) * W.OT_MULTIPLE)
    return basic, ot, basic + ot


async def generate_sheet(ctx: Ctx, project_id: UUID, period_from: date, period_to: date, contractor_id: Optional[UUID]) -> W.ReWageSheet:
    await get_owned(ctx.db, C.ReProject, ctx.vendor_id, project_id, "project")
    if contractor_id:
        from app.models.realestate.contractors import ReContractor

        await get_owned(ctx.db, ReContractor, ctx.vendor_id, contractor_id, "contractor")
    if period_to < period_from:
        raise HTTPException(status_code=422, detail="The period ends before it starts")
    if (period_to - period_from).days + 1 > MAX_SHEET_DAYS:
        raise HTTPException(status_code=422, detail=f"A wage sheet covers at most {MAX_SHEET_DAYS} days")
    if period_to > date.today():
        raise HTTPException(status_code=422, detail="Wages can only be calculated for days that have passed")
    rows = (await ctx.db.execute(
        select(W.ReLabourAttendance, W.ReLabour).join(W.ReLabour, W.ReLabour.id == W.ReLabourAttendance.labour_id).where(
            W.ReLabourAttendance.vendor_id == ctx.vendor_id, W.ReLabourAttendance.project_id == project_id,
            W.ReLabourAttendance.work_date >= period_from, W.ReLabourAttendance.work_date <= period_to,
            W.ReLabourAttendance.locked.is_(False), W.ReLabourAttendance.status.in_(tuple(PAID_DAY)),
            (W.ReLabour.contractor_id == contractor_id) if contractor_id else W.ReLabour.contractor_id.is_(None))
        .order_by(W.ReLabour.name, W.ReLabourAttendance.work_date))).all()
    if not rows:
        raise HTTPException(status_code=409, detail="There is no unpaid attendance for this project, period and workforce")
    sheet = W.ReWageSheet(id=uuid.uuid4(), vendor_id=ctx.vendor_id, sheet_no=await next_number(ctx.db, ctx.vendor_id, "wage_sheet"),
                          project_id=project_id, contractor_id=contractor_id, period_from=period_from, period_to=period_to, status="draft",
                          workers=0, total_gross=0, total_deductions=0, total_net=0)
    ctx.db.add(sheet)
    await ctx.db.flush()
    per: dict[UUID, dict] = {}
    for att, lab in rows:
        p = per.setdefault(lab.id, {"labour": lab, "days": Decimal(0), "ot": Decimal(0)})
        p["days"] += PAID_DAY[att.status]
        p["ot"] += D(att.overtime_hours)
        att.locked, att.wage_sheet_id = True, sheet.id
    for p in per.values():
        lab = p["labour"]
        basic, ot_amt, gross = line_amounts(p["days"], p["ot"], D(lab.daily_wage))
        ctx.db.add(W.ReWageLine(id=uuid.uuid4(), vendor_id=ctx.vendor_id, sheet_id=sheet.id, labour_id=lab.id, days_worked=p["days"],
                                overtime_hours=p["ot"], daily_wage=lab.daily_wage, basic_amount=basic, overtime_amount=ot_amt,
                                gross_amount=gross, advance_recovery=0, other_deduction=0, net_amount=gross))
    await ctx.db.flush()
    await recompute_sheet(ctx.db, sheet)
    await audit(ctx, "wage_sheet", sheet.id, "generate", ref=sheet.sheet_no, changes={"workers": sheet.workers, "gross": sheet.total_gross})
    return sheet


async def recompute_sheet(db: AsyncSession, sheet: W.ReWageSheet) -> None:
    lines = (await db.execute(select(W.ReWageLine).where(W.ReWageLine.sheet_id == sheet.id))).scalars().all()
    sheet.workers = len(lines)
    sheet.total_gross = sum((D(l.gross_amount) for l in lines), Decimal(0))
    sheet.total_deductions = sum((D(l.advance_recovery) + D(l.other_deduction) for l in lines), Decimal(0))
    sheet.total_net = sum((D(l.net_amount) for l in lines), Decimal(0))


async def line_before_update(ctx: Ctx, obj: W.ReWageLine, data: dict[str, Any]) -> None:
    sheet = await ctx.db.get(W.ReWageSheet, obj.sheet_id)
    if sheet.status != "draft":
        raise HTTPException(status_code=409, detail=f"The wage sheet is {sheet.status}; deductions can only change while it is a draft")
    adv, other = money_q(D(data.get("advance_recovery", obj.advance_recovery))), money_q(D(data.get("other_deduction", obj.other_deduction)))
    if adv < 0 or other < 0:
        raise HTTPException(status_code=422, detail="Deductions cannot be negative")
    if adv + other > D(obj.gross_amount) + EPS:
        raise HTTPException(status_code=422, detail=f"Deductions of ₹{adv + other:,.2f} exceed the gross wage of ₹{D(obj.gross_amount):,.2f}")
    data["advance_recovery"], data["other_deduction"] = adv, other
    data["net_amount"] = D(obj.gross_amount) - adv - other


async def line_after_update(ctx: Ctx, obj: W.ReWageLine, data: dict[str, Any]) -> None:
    await recompute_sheet(ctx.db, await ctx.db.get(W.ReWageSheet, obj.sheet_id))


def _sheet(s: W.ReWageSheet, allowed: tuple[str, ...], label: str) -> None:
    if s.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Wage sheet is {s.status}; cannot {label}")


async def sheet_approve(ctx: Ctx, s: W.ReWageSheet) -> W.ReWageSheet:
    _sheet(s, ("draft",), "approve")
    if not s.workers:
        raise HTTPException(status_code=409, detail="The wage sheet has no workers")
    s.status, s.approved_on = "approved", date.today()
    await audit(ctx, "wage_sheet", s.id, "approve", ref=s.sheet_no, changes={"net": s.total_net})
    return s


async def sheet_pay(ctx: Ctx, s: W.ReWageSheet, mode: str, reference: Optional[str], paid_on: Optional[date]) -> W.ReWageSheet:
    _sheet(s, ("approved",), "pay")
    if mode not in O.RENT_PAYMENT_MODES or mode == "adjustment":
        raise HTTPException(status_code=422, detail=f"Payment mode must be one of: {', '.join(m for m in O.RENT_PAYMENT_MODES if m != 'adjustment')}")
    paid_on = paid_on or date.today()
    if paid_on > date.today() or paid_on < s.period_to:
        raise HTTPException(status_code=422, detail="The payment date must be after the wage period and not in the future")
    s.status, s.paid_on, s.payment_mode, s.payment_reference = "paid", paid_on, mode, reference
    await finance_bridge.post_vendor_payment(ctx.db, ctx.vendor_id, payment_id=s.id, amount=D(s.total_net), supplier_id=None,
                                             narration=f"Wages {s.sheet_no}", entry_date=paid_on)
    await audit(ctx, "wage_sheet", s.id, "pay", ref=s.sheet_no, changes={"net": s.total_net, "mode": mode})
    return s


async def sheet_cancel(ctx: Ctx, s: W.ReWageSheet, reason: str) -> W.ReWageSheet:
    _sheet(s, ("draft", "approved"), "cancel")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Give a reason")
    for a in (await ctx.db.execute(select(W.ReLabourAttendance).where(W.ReLabourAttendance.wage_sheet_id == s.id))).scalars().all():
        a.locked, a.wage_sheet_id = False, None  # the days become payable again
    s.status = "cancelled"
    await audit(ctx, "wage_sheet", s.id, "cancel", ref=s.sheet_no, changes={"reason": reason})
    return s


# ═══ overview ═══════════════════════════════════════════════════════════════════════════════

async def summary(db: AsyncSession, vendor_id: UUID) -> dict:
    today = date.today()
    labour = (await db.execute(select(W.ReLabour).where(W.ReLabour.vendor_id == vendor_id, W.ReLabour.status == "active"))).scalars().all()
    projects = {p.id: p.name for p in (await db.execute(select(C.ReProject).where(C.ReProject.vendor_id == vendor_id))).scalars().all()}
    att = (await db.execute(select(W.ReLabourAttendance).where(
        W.ReLabourAttendance.vendor_id == vendor_id, W.ReLabourAttendance.work_date == today))).scalars().all()
    by_proj: dict[Any, dict] = {}
    for a in att:
        r = by_proj.setdefault(a.project_id, {"project": projects.get(a.project_id, "—"), "present": 0, "half_day": 0, "absent": 0, "leave": 0, "overtime_hours": Decimal(0)})
        r[a.status] += 1
        r["overtime_hours"] += D(a.overtime_hours)
    trades: dict[str, dict] = {}
    for l in labour:
        t = trades.setdefault(l.trade, {"trade": l.trade, "workers": 0, "daily_cost": Decimal(0)})
        t["workers"] += 1
        t["daily_cost"] += D(l.daily_wage)
    sheets = (await db.execute(select(W.ReWageSheet).where(W.ReWageSheet.vendor_id == vendor_id, W.ReWageSheet.status.in_(("draft", "approved", "paid"))))).scalars().all()
    month_start = today.replace(day=1)
    assignments = (await db.execute(select(func.count()).select_from(W.ReSiteAssignment).where(
        W.ReSiteAssignment.vendor_id == vendor_id, W.ReSiteAssignment.status == "active"))).scalar_one()
    unpaid = sum((D(s.total_net) for s in sheets if s.status == "approved"), Decimal(0))
    return {
        "active_workers": len(labour), "present_today": sum(1 for a in att if a.status in PAID_DAY), "assignments": assignments,
        "draft_sheets": sum(1 for s in sheets if s.status == "draft"), "wages_payable": _f(unpaid),
        "paid_this_month": _f(sum((D(s.total_net) for s in sheets if s.status == "paid" and s.paid_on and s.paid_on >= month_start), Decimal(0))),
        "attendance_today": [{**r, "overtime_hours": _f(r["overtime_hours"])} for r in by_proj.values()],
        "by_trade": [{**t, "daily_cost": _f(t["daily_cost"])} for t in sorted(trades.values(), key=lambda x: -x["workers"])],
        "open_sheets": [{"sheet_no": s.sheet_no, "project": projects.get(s.project_id, "—"), "period": f"{s.period_from:%d %b} – {s.period_to:%d %b %Y}",
                         "workers": s.workers, "net": _f(s.total_net), "status": s.status} for s in sheets if s.status in ("draft", "approved")],
    }


async def direct_labour_cost(db: AsyncSession, vendor_id: UUID, project_id: UUID) -> Decimal:
    """Gross wages of approved / paid direct-labour sheets (contractor labour is already inside subcontract bills)."""
    return D((await db.execute(select(func.coalesce(func.sum(W.ReWageSheet.total_gross), 0)).where(
        W.ReWageSheet.vendor_id == vendor_id, W.ReWageSheet.project_id == project_id, W.ReWageSheet.contractor_id.is_(None),
        W.ReWageSheet.status.in_(("approved", "paid"))))).scalar_one())
