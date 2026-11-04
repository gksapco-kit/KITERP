"""Resource definitions — Phase 4a: project management (module 8) and construction (module 9)."""
from typing import Any

from fastapi import HTTPException

from app.models.realestate import projects as P
from app.services.realestate import projectmgmt as pm
from app.services.realestate.common import Ctx, D, money_q

from .crud import Action, Resource
from .registry import P as Param
from .registry import add

CONSTRUCTION = "realestate.construction"


# ── hooks ───────────────────────────────────────────────────────────────────────────────────

async def wbs_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await pm.wbs_validate(ctx, data)
    data.setdefault("status", "not_started")
    if D(data.get("progress_percent")) >= 100:
        data["status"] = "completed"
    elif D(data.get("progress_percent")) > 0:
        data["status"] = "in_progress"


async def budget_validate(ctx: Ctx, data: dict[str, Any], obj: Any = None) -> None:
    for k in ("budget_amount", "revised_amount"):
        if k in data and D(data[k]) < 0:
            raise HTTPException(status_code=422, detail=f"{k} cannot be negative")


async def budget_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await budget_validate(ctx, data)


async def budget_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    await budget_validate(ctx, data, obj)


async def _task_in_project(ctx: Ctx, task_id, project_id) -> P.ReWbsTask:
    task = await ctx.db.get(P.ReWbsTask, task_id)
    if task is None or task.vendor_id != ctx.vendor_id or task.project_id != project_id:
        raise HTTPException(status_code=422, detail="The task does not belong to this project")
    return task


async def progress_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("wbs_task_id"):
        await _task_in_project(ctx, data["wbs_task_id"], data["project_id"])
    if data.get("progress_percent") is not None and not 0 <= D(data["progress_percent"]) <= 100:
        raise HTTPException(status_code=422, detail="progress_percent must be between 0 and 100")
    if int(data.get("labour_count") or 0) < 0:
        raise HTTPException(status_code=422, detail="labour_count cannot be negative")
    if data.get("progress_percent") is not None and not data.get("wbs_task_id"):
        raise HTTPException(status_code=422, detail="Choose the task this progress applies to")
    data.setdefault("reported_by_name", ctx.actor_name)


async def progress_after_create(ctx: Ctx, obj: P.ReSiteProgress) -> None:
    if obj.wbs_task_id and obj.progress_percent is not None:
        task = await ctx.db.get(P.ReWbsTask, obj.wbs_task_id)
        if task is not None:
            pm.apply_progress(task, obj.progress_percent, obj.report_date)


async def boq_validate(ctx: Ctx, data: dict[str, Any], obj: Any = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    if D(val("quantity")) < 0 or D(val("rate")) < 0:
        raise HTTPException(status_code=422, detail="quantity and rate cannot be negative")
    if val("wbs_task_id"):
        await _task_in_project(ctx, val("wbs_task_id"), val("project_id"))
    data["amount"] = money_q(D(val("quantity")) * D(val("rate")))


async def boq_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await boq_validate(ctx, data)


async def boq_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    await boq_validate(ctx, data, obj)
    if "quantity" in data and D(data["quantity"]) < D(obj.executed_quantity):
        raise HTTPException(status_code=409, detail="Quantity cannot go below what has already been executed")


async def wo_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("wbs_task_id"):
        await _task_in_project(ctx, data["wbs_task_id"], data["project_id"])
    data["status"] = "draft"


async def quality_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("wbs_task_id"):
        await _task_in_project(ctx, data["wbs_task_id"], data["project_id"])
    if data.get("result") in ("fail", "conditional") and not data.get("rectification_due"):
        raise HTTPException(status_code=422, detail="Give a rectification due date for a failed / conditional check")
    data["status"] = "closed" if data.get("result", "pass") == "pass" else "open"
    if data["status"] == "closed":
        data["closed_on"] = data.get("inspected_on")


async def incident_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if int(data.get("injured_count") or 0) < 0:
        raise HTTPException(status_code=422, detail="injured_count cannot be negative")
    data["status"] = "open"
    data.setdefault("reported_by_name", ctx.actor_name)


async def incident_after_create(ctx: Ctx, obj: P.ReSafetyIncident) -> None:
    if obj.severity in ("major", "fatal"):
        from app.services.realestate.common import notify

        await notify(ctx.db, ctx.vendor_id, f"{obj.severity.title()} safety incident",
                     (obj.description or "")[:200], reference_type="safety_incident", reference_id=obj.id)


async def inspection_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    data["status"] = "scheduled"


# ── Module 8 — Project Management ───────────────────────────────────────────────────────────

add(
    Resource(
        key="wbs", model=P.ReWbsTask, title="WBS / tasks",
        columns=["code", "name", "project_id", "parent_id", "planned_start", "duration_days", "planned_end", "progress_percent", "status"],
        search=["code", "name", "owner_name"], filters=["project_id", "status", "parent_id", "tower_id"],
        number=("wbs", "code"), order="code", json_fields=("predecessor_ids",), readonly=("planned_end",),
        write_perm="realestate.construction", before_create=wbs_before_create, before_update=pm.wbs_before_update,
        before_delete=pm.wbs_before_delete,
        actions=[Action("progress", "Update progress", "progress", params=[Param("percent", "Progress %", "number", required=True),
                                                                          Param("on", "As of", "date")],
                        when={"status": ["not_started", "in_progress", "on_hold"]}, style="primary")],
    ),
    Resource(
        key="milestones", model=P.ReMilestone, title="Milestones",
        columns=["project_id", "name", "due_date", "completed_on", "status", "billing_triggered"],
        search=["name"], filters=["project_id", "status"], order="due_date", write_perm="realestate.construction",
        readonly=("status", "completed_on", "billing_triggered"),
        actions=[Action("achieve", "Mark achieved", "achieve",
                        params=[Param("completed_on", "Completed on", "date"),
                                Param("trigger_billing", "Raise customer demands tied to this milestone", "boolean", default="true")],
                        when={"status": ["pending", "delayed"]}, style="primary",
                        confirm="Mark the milestone achieved? Customers waiting on it will be billed if you leave the box ticked.")],
    ),
    Resource(
        key="project-budgets", model=P.ReProjectBudget, title="Project budgets",
        columns=["project_id", "cost_head", "description", "budget_amount", "revised_amount"],
        search=["description"], filters=["project_id", "cost_head"], order="cost_head", write_perm="realestate.manage",
        before_create=budget_before_create, before_update=budget_before_update,
    ),
)

# ── Module 9 — Construction Management ──────────────────────────────────────────────────────

add(
    Resource(
        key="site-progress", model=P.ReSiteProgress, title="Daily progress reports",
        columns=["report_date", "project_id", "wbs_task_id", "labour_count", "progress_percent", "weather", "reported_by_name"],
        search=["work_done", "issues"], filters=["project_id", "wbs_task_id", "tower_id"], order="-report_date",
        json_fields=("photos",), write_perm=CONSTRUCTION, allow_edit=False, allow_delete=False,
        before_create=progress_before_create, after_create=progress_after_create,
    ),
    Resource(
        key="boq-items", model=P.ReBoqItem, title="Bill of quantities",
        columns=["item_code", "description", "project_id", "unit", "quantity", "rate", "amount", "executed_quantity", "cost_head"],
        search=["item_code", "description"], filters=["project_id", "wbs_task_id", "cost_head"], order="item_code",
        readonly=("amount", "executed_quantity"), write_perm=CONSTRUCTION,
        before_create=boq_before_create, before_update=boq_before_update,
    ),
    Resource(
        key="work-orders", model=P.ReWorkOrder, title="Work orders",
        columns=["wo_no", "title", "project_id", "assigned_to", "priority", "due_date", "status"],
        search=["wo_no", "title", "assigned_to"], filters=["project_id", "status", "priority", "wbs_task_id"],
        number=("work_order", "wo_no"), readonly=("status", "completed_on"), write_perm=CONSTRUCTION,
        before_create=wo_before_create, editable_when={"status": ["draft"]},
        actions=[
            Action("issue", "Issue", "issue", when={"status": ["draft"]}, style="primary"),
            Action("start", "Start work", "start", when={"status": ["issued"]}),
            Action("complete", "Complete", "complete", params=[Param("completed_on", "Completed on", "date")],
                   when={"status": ["issued", "in_progress"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", params=[Param("reason", "Reason", "text")],
                   when={"status": ["draft", "issued", "in_progress"]}, style="danger"),
        ],
    ),
    Resource(
        key="quality-checks", model=P.ReQualityCheck, title="Quality checks",
        columns=["inspected_on", "project_id", "checklist_name", "result", "rectification_due", "status", "inspector_name"],
        search=["checklist_name", "observations"], filters=["project_id", "result", "status"], order="-inspected_on",
        readonly=("status", "closed_on"), write_perm=CONSTRUCTION, before_create=quality_before_create,
        editable_when={"status": ["open"]},
        actions=[
            Action("rectify", "Mark rectified", "rectify", when={"status": ["open"]}, style="primary"),
            Action("close", "Close", "close", when={"status": ["rectified"]}),
        ],
    ),
    Resource(
        key="safety-incidents", model=P.ReSafetyIncident, title="Safety incidents",
        columns=["incident_date", "project_id", "severity", "description", "injured_count", "status"],
        search=["description", "location"], filters=["project_id", "severity", "status"], order="-incident_date",
        readonly=("status", "closed_on"), write_perm=CONSTRUCTION, before_create=incident_before_create,
        after_create=incident_after_create, allow_delete=False,
        actions=[
            Action("investigate", "Start investigation", "investigate", when={"status": ["open"]}),
            Action("close", "Close", "close", when={"status": ["open", "investigating"]}, style="primary"),
        ],
    ),
    Resource(
        key="inspections", model=P.ReInspection, title="Inspections",
        columns=["title", "project_id", "inspection_type", "inspector", "scheduled_on", "done_on", "status", "certificate_ref"],
        search=["title", "inspector", "certificate_ref"], filters=["project_id", "inspection_type", "status"],
        order="-scheduled_on", readonly=("status", "done_on"), write_perm=CONSTRUCTION, before_create=inspection_before_create,
        editable_when={"status": ["scheduled"]},
        actions=[
            Action("complete", "Record outcome", "complete",
                   params=[Param("outcome", "Outcome", "select", required=True, choices=["passed", "failed"], default="passed"),
                           Param("done_on", "Done on", "date"), Param("findings", "Findings", "text"),
                           Param("certificate_ref", "Certificate ref.", "text")],
                   when={"status": ["scheduled"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", when={"status": ["scheduled"]}, style="danger"),
        ],
    ),
)
