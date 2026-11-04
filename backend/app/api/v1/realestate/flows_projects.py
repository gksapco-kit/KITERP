"""Workflow endpoints — Phase 4a: scheduling, milestones, costing and construction workflows."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.models.realestate import core as C
from app.models.realestate import projects as P
from app.services.realestate import projectmgmt as pm
from app.services.realestate.common import Ctx, audit, get_owned

from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
build = ctx_dep("realestate.construction")


class _Reason(BaseModel):
    reason: str = ""


# ═══ schedule & costing ═════════════════════════════════════════════════════════════════════

@router.get("/projects/{project_id}/schedule", summary="Critical-path schedule for the project's WBS")
async def project_schedule(project_id: uuid.UUID, ctx: Ctx = Depends(view)):
    await get_owned(ctx.db, C.ReProject, ctx.vendor_id, project_id, "project")
    return await pm.schedule(ctx.db, ctx.vendor_id, project_id)


@router.get("/projects/{project_id}/costing", summary="Budget vs committed vs actual by cost head")
async def project_costing(project_id: uuid.UUID, ctx: Ctx = Depends(view)):
    return await pm.project_costing(ctx.db, ctx.vendor_id, project_id)


class ProgressIn(BaseModel):
    percent: Decimal = Field(..., ge=0, le=100)
    on: Optional[date] = None


@router.post("/wbs/{task_id}/progress")
async def wbs_progress(task_id: uuid.UUID, body: ProgressIn, ctx: Ctx = Depends(build)):
    t = await get_owned(ctx.db, P.ReWbsTask, ctx.vendor_id, task_id, "task")
    if body.percent < t.progress_percent:
        raise HTTPException(status_code=409, detail=f"Progress is already {t.progress_percent:g}%; it cannot go backwards")
    pm.apply_progress(t, body.percent, body.on)
    await audit(ctx, "wbs_task", t.id, "progress", ref=t.code, changes={"percent": body.percent})
    await ctx.db.commit()
    return {"message": f"{t.code} is now {t.progress_percent:g}% complete"}


# ═══ milestones ═════════════════════════════════════════════════════════════════════════════

class AchieveIn(BaseModel):
    completed_on: Optional[date] = None
    trigger_billing: bool = True


@router.post("/milestones/{ms_id}/achieve")
async def milestone_achieve(ms_id: uuid.UUID, body: AchieveIn, ctx: Ctx = Depends(build)):
    ms = await get_owned(ctx.db, P.ReMilestone, ctx.vendor_id, ms_id, "milestone")
    res = await pm.achieve_milestone(ctx, ms, body.completed_on, body.trigger_billing)
    await ctx.db.commit()
    msg = f"{ms.name} achieved"
    if res["billing"]:
        msg += f"; {res['billing']['demands_created']} customer demand(s) issued"
    return {"message": msg, **res}


# ═══ work orders ════════════════════════════════════════════════════════════════════════════

async def _wo(ctx: Ctx, wo_id: uuid.UUID, allowed: tuple[str, ...], new: str) -> P.ReWorkOrder:
    wo = await get_owned(ctx.db, P.ReWorkOrder, ctx.vendor_id, wo_id, "work order")
    if wo.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Work order is {wo.status}; cannot move to {new}")
    wo.status = new
    await audit(ctx, "work_order", wo.id, new, ref=wo.wo_no)
    return wo


@router.post("/work-orders/{wo_id}/issue")
async def wo_issue(wo_id: uuid.UUID, ctx: Ctx = Depends(build)):
    wo = await _wo(ctx, wo_id, ("draft",), "issued")
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} issued"}


@router.post("/work-orders/{wo_id}/start")
async def wo_start(wo_id: uuid.UUID, ctx: Ctx = Depends(build)):
    wo = await _wo(ctx, wo_id, ("issued",), "in_progress")
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} started"}


class CompleteIn(BaseModel):
    completed_on: Optional[date] = None


@router.post("/work-orders/{wo_id}/complete")
async def wo_complete(wo_id: uuid.UUID, body: CompleteIn, ctx: Ctx = Depends(build)):
    wo = await _wo(ctx, wo_id, ("issued", "in_progress"), "completed")
    wo.completed_on = body.completed_on or date.today()
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} completed"}


@router.post("/work-orders/{wo_id}/cancel")
async def wo_cancel(wo_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(build)):
    wo = await _wo(ctx, wo_id, ("draft", "issued", "in_progress"), "cancelled")
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} cancelled"}


# ═══ quality / safety / inspections ═════════════════════════════════════════════════════════

@router.post("/quality-checks/{qc_id}/rectify")
async def qc_rectify(qc_id: uuid.UUID, ctx: Ctx = Depends(build)):
    q = await get_owned(ctx.db, P.ReQualityCheck, ctx.vendor_id, qc_id, "quality check")
    if q.status != "open":
        raise HTTPException(status_code=409, detail=f"Check is {q.status}")
    q.status = "rectified"
    await audit(ctx, "quality_check", q.id, "rectify", ref=q.checklist_name)
    await ctx.db.commit()
    return {"message": "Marked as rectified — re-inspect and close"}


@router.post("/quality-checks/{qc_id}/close")
async def qc_close(qc_id: uuid.UUID, ctx: Ctx = Depends(build)):
    q = await get_owned(ctx.db, P.ReQualityCheck, ctx.vendor_id, qc_id, "quality check")
    if q.status != "rectified":
        raise HTTPException(status_code=409, detail="Only rectified checks can be closed")
    q.status = "closed"
    q.closed_on = date.today()
    await audit(ctx, "quality_check", q.id, "close", ref=q.checklist_name)
    await ctx.db.commit()
    return {"message": "Quality check closed"}


@router.post("/safety-incidents/{inc_id}/investigate")
async def incident_investigate(inc_id: uuid.UUID, ctx: Ctx = Depends(build)):
    i = await get_owned(ctx.db, P.ReSafetyIncident, ctx.vendor_id, inc_id, "incident")
    if i.status != "open":
        raise HTTPException(status_code=409, detail=f"Incident is {i.status}")
    i.status = "investigating"
    await audit(ctx, "safety_incident", i.id, "investigate")
    await ctx.db.commit()
    return {"message": "Investigation started"}


@router.post("/safety-incidents/{inc_id}/close")
async def incident_close(inc_id: uuid.UUID, ctx: Ctx = Depends(build)):
    i = await get_owned(ctx.db, P.ReSafetyIncident, ctx.vendor_id, inc_id, "incident")
    if i.status == "closed":
        raise HTTPException(status_code=409, detail="Incident is already closed")
    if i.severity in ("major", "fatal") and not ((i.root_cause or "").strip() and (i.corrective_action or "").strip()):
        raise HTTPException(status_code=409, detail="A major / fatal incident needs the root cause and corrective action before closure")
    i.status = "closed"
    i.closed_on = date.today()
    await audit(ctx, "safety_incident", i.id, "close")
    await ctx.db.commit()
    return {"message": "Incident closed"}


class OutcomeIn(BaseModel):
    outcome: str = Field("passed", pattern="^(passed|failed)$")
    done_on: Optional[date] = None
    findings: Optional[str] = None
    certificate_ref: Optional[str] = None


@router.post("/inspections/{insp_id}/complete")
async def inspection_complete(insp_id: uuid.UUID, body: OutcomeIn, ctx: Ctx = Depends(build)):
    i = await get_owned(ctx.db, P.ReInspection, ctx.vendor_id, insp_id, "inspection")
    if i.status != "scheduled":
        raise HTTPException(status_code=409, detail=f"Inspection is {i.status}")
    if body.outcome == "failed" and not (body.findings or "").strip():
        raise HTTPException(status_code=422, detail="Record the findings for a failed inspection")
    i.status = "completed" if body.outcome == "passed" else "failed"
    i.done_on = body.done_on or date.today()
    if body.findings:
        i.findings = body.findings
    if body.certificate_ref:
        i.certificate_ref = body.certificate_ref
    await audit(ctx, "inspection", i.id, i.status, ref=i.title)
    await ctx.db.commit()
    return {"message": f"Inspection recorded as {body.outcome}"}


@router.post("/inspections/{insp_id}/cancel")
async def inspection_cancel(insp_id: uuid.UUID, ctx: Ctx = Depends(build)):
    i = await get_owned(ctx.db, P.ReInspection, ctx.vendor_id, insp_id, "inspection")
    if i.status != "scheduled":
        raise HTTPException(status_code=409, detail=f"Inspection is {i.status}")
    i.status = "cancelled"
    await ctx.db.commit()
    return {"message": "Inspection cancelled"}
