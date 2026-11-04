"""Workflow endpoints — Phase 7: workforce actions and the reports & analytics module."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.models.realestate import core as C
from app.models.realestate import workforce as W
from app.services.realestate import analytics as an
from app.services.realestate import workforce as wf
from app.services.realestate.common import Ctx, audit, get_owned

from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
manage = ctx_dep("realestate.manage")
pay_dep = ctx_dep("realestate.construction")


async def _own(ctx: Ctx, model, id_: uuid.UUID, label: str):
    return await get_owned(ctx.db, model, ctx.vendor_id, id_, label)


class _Reason(BaseModel):
    reason: str = ""


# ═══ workforce ══════════════════════════════════════════════════════════════════════════════

@router.get("/workforce/overview", summary="Labour on site, attendance today and wages payable")
async def workforce_overview(ctx: Ctx = Depends(view)):
    s = await wf.summary(ctx.db, ctx.vendor_id)
    return {
        "title": "Workforce overview",
        "kpis": [an.kpi("Active workers", s["active_workers"]), an.kpi("Present today", s["present_today"]), an.kpi("Employees on site", s["assignments"]),
                 an.kpi("Draft wage sheets", s["draft_sheets"], "number", "warn" if s["draft_sheets"] else None),
                 an.kpi("Wages payable", s["wages_payable"], "money", "warn" if s["wages_payable"] else None),
                 an.kpi("Wages paid this month", s["paid_this_month"], "money")],
        "tables": [
            {"title": "Attendance today", "columns": [an.col("project", "Project"), an.col("present", "Present", "number"), an.col("half_day", "Half day", "number"),
                                                       an.col("absent", "Absent", "number"), an.col("leave", "On leave", "number"),
                                                       an.col("overtime_hours", "Overtime hrs", "number")], "rows": s["attendance_today"]},
            {"title": "Workers by trade", "columns": [an.col("trade", "Trade", "badge"), an.col("workers", "Workers", "number"), an.col("daily_cost", "Daily wage bill", "money")],
             "rows": s["by_trade"]},
            {"title": "Wage sheets awaiting action", "columns": [an.col("sheet_no", "Sheet"), an.col("project", "Project"), an.col("period", "Period"),
                                                                  an.col("workers", "Workers", "number"), an.col("net", "Net payable", "money"), an.col("status", "Status", "badge")],
             "rows": s["open_sheets"]},
        ],
    }


class _WageIn(BaseModel):
    period_from: date
    period_to: date
    contractor_id: Optional[uuid.UUID] = None


@router.post("/projects/{project_id}/generate-wages", status_code=201)
async def generate_wages(project_id: uuid.UUID, body: _WageIn, ctx: Ctx = Depends(pay_dep)):
    sheet = await wf.generate_sheet(ctx, project_id, body.period_from, body.period_to, body.contractor_id)
    await ctx.db.commit()
    return {"id": str(sheet.id), "sheet_no": sheet.sheet_no, "workers": sheet.workers, "total_gross": float(sheet.total_gross),
            "message": f"Wage sheet {sheet.sheet_no}: {sheet.workers} worker(s), gross ₹{float(sheet.total_gross):,.2f}"}


class _PresentIn(BaseModel):
    work_date: Optional[date] = None


@router.post("/projects/{project_id}/mark-present")
async def mark_present(project_id: uuid.UUID, body: _PresentIn, ctx: Ctx = Depends(manage)):
    await _own(ctx, C.ReProject, project_id, "project")
    day = body.work_date or date.today()
    workers = (await ctx.db.execute(select(W.ReLabour).where(
        W.ReLabour.vendor_id == ctx.vendor_id, W.ReLabour.project_id == project_id, W.ReLabour.status == "active"))).scalars().all()
    entries = []
    for w in workers:
        exists = (await ctx.db.execute(select(W.ReLabourAttendance.id).where(
            W.ReLabourAttendance.labour_id == w.id, W.ReLabourAttendance.work_date == day))).first()
        if not exists:
            entries.append({"labour_id": w.id, "status": "present", "overtime_hours": 0})
    out = await wf.attendance_bulk(ctx, project_id, day, entries)
    await ctx.db.commit()
    return {**out, "already_recorded": len(workers) - len(entries),
            "message": f"{out['created']} marked present for {day:%d %b %Y}; {len(workers) - len(entries)} already recorded, {len(out['rejected'])} rejected"}


class _AttendanceEntry(BaseModel):
    labour_id: uuid.UUID
    status: str = "present"
    overtime_hours: Decimal = Decimal(0)


class _BulkIn(BaseModel):
    project_id: uuid.UUID
    work_date: date
    entries: list[_AttendanceEntry] = Field(..., min_length=1, max_length=500)


@router.post("/labour-attendance/bulk", summary="Mark many workers in one call (creates or updates unlocked days)")
async def attendance_bulk(body: _BulkIn, ctx: Ctx = Depends(manage)):
    out = await wf.attendance_bulk(ctx, body.project_id, body.work_date, [e.model_dump() for e in body.entries])
    await ctx.db.commit()
    return {**out, "message": f"{out['created']} added, {out['updated']} updated, {len(out['rejected'])} rejected"}


class _EndIn(BaseModel):
    to_date: Optional[date] = None


@router.post("/site-assignments/{a_id}/end")
async def assignment_end(a_id: uuid.UUID, body: _EndIn, ctx: Ctx = Depends(manage)):
    a = await wf.assignment_end(ctx, await _own(ctx, W.ReSiteAssignment, a_id, "assignment"), body.to_date)
    await ctx.db.commit()
    return {"message": f"{a.employee_name}'s posting has ended"}


class _LeftIn(BaseModel):
    left_on: Optional[date] = None


@router.post("/labour/{l_id}/release")
async def labour_release(l_id: uuid.UUID, body: _LeftIn, ctx: Ctx = Depends(manage)):
    l = await wf.labour_release(ctx, await _own(ctx, W.ReLabour, l_id, "worker"), body.left_on)
    await ctx.db.commit()
    return {"message": f"{l.name} marked as left"}


@router.post("/wage-sheets/{s_id}/approve")
async def sheet_approve(s_id: uuid.UUID, ctx: Ctx = Depends(pay_dep)):
    s = await wf.sheet_approve(ctx, await _own(ctx, W.ReWageSheet, s_id, "wage sheet"))
    await ctx.db.commit()
    return {"message": f"{s.sheet_no} approved — net payable ₹{float(s.total_net):,.2f}"}


class _PayIn(BaseModel):
    mode: str = "neft"
    paid_on: Optional[date] = None
    reference: Optional[str] = None


@router.post("/wage-sheets/{s_id}/pay")
async def sheet_pay(s_id: uuid.UUID, body: _PayIn, ctx: Ctx = Depends(pay_dep)):
    s = await wf.sheet_pay(ctx, await _own(ctx, W.ReWageSheet, s_id, "wage sheet"), body.mode, body.reference, body.paid_on)
    await ctx.db.commit()
    return {"message": f"{s.sheet_no} paid — ₹{float(s.total_net):,.2f}"}


@router.post("/wage-sheets/{s_id}/cancel")
async def sheet_cancel(s_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(pay_dep)):
    s = await wf.sheet_cancel(ctx, await _own(ctx, W.ReWageSheet, s_id, "wage sheet"), body.reason)
    await ctx.db.commit()
    return {"message": f"{s.sheet_no} cancelled"}


# ═══ reports & analytics ════════════════════════════════════════════════════════════════════

@router.get("/reports/sales-mis")
async def report_sales(from_date: Optional[date] = None, to_date: Optional[date] = None, project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await an.sales_mis(ctx.db, ctx.vendor_id, from_date, to_date, project_id)


@router.get("/reports/collections")
async def report_collections(from_date: Optional[date] = None, to_date: Optional[date] = None, project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await an.collections(ctx.db, ctx.vendor_id, from_date, to_date, project_id)


@router.get("/reports/project-costing")
async def report_costing(project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await an.costing_report(ctx.db, ctx.vendor_id, project_id)


@router.get("/reports/profitability")
async def report_profitability(project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await an.profitability(ctx.db, ctx.vendor_id, project_id)


@router.get("/reports/occupancy")
async def report_occupancy(project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await an.occupancy(ctx.db, ctx.vendor_id, project_id)


@router.get("/reports/inventory-ageing")
async def report_ageing(project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await an.inventory_ageing(ctx.db, ctx.vendor_id, project_id)
