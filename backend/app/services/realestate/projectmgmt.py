"""Modules 8 & 9 — WBS scheduling (critical path), progress roll-up, milestones, budgets and project costing."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import contractors as K
from app.models.realestate import core as C
from app.models.realestate import land as L
from app.models.realestate import projects as P
from app.models.realestate import supply as S

from .common import Ctx, D, audit, get_owned, jsonable, money_q

EPS = Decimal("0.005")


def _f(v: Any) -> float:
    return float(D(v))


# ═══ WBS ════════════════════════════════════════════════════════════════════════════════════

async def wbs_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[P.ReWbsTask] = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    project_id = val("project_id")
    if obj is not None and "project_id" in data and data["project_id"] != obj.project_id:
        raise HTTPException(status_code=409, detail="A task cannot move to another project")
    if int(val("duration_days") or 0) < 0:
        raise HTTPException(status_code=422, detail="duration_days cannot be negative")
    if not 0 <= D(val("progress_percent")) <= 100:
        raise HTTPException(status_code=422, detail="progress_percent must be between 0 and 100")
    if val("parent_id"):
        parent = await ctx.db.get(P.ReWbsTask, val("parent_id"))
        if parent is None or parent.vendor_id != ctx.vendor_id or parent.project_id != project_id:
            raise HTTPException(status_code=422, detail="The parent task must belong to the same project")
        if obj is not None and parent.id == obj.id:
            raise HTTPException(status_code=422, detail="A task cannot be its own parent")
    preds = val("predecessor_ids") or []
    if not isinstance(preds, list):
        raise HTTPException(status_code=422, detail="predecessor_ids must be a list of task ids")
    clean: list[str] = []
    for pid in preds:
        try:
            pu = UUID(str(pid))
        except ValueError:
            # accept a task code (e.g. "WBS-26-00003") as a convenience when typing dependencies by hand
            found = (await ctx.db.execute(select(P.ReWbsTask.id).where(
                P.ReWbsTask.vendor_id == ctx.vendor_id, P.ReWbsTask.project_id == project_id,
                P.ReWbsTask.code == str(pid)))).scalar_one_or_none()
            if found is None:
                raise HTTPException(status_code=422, detail=f"Unknown predecessor {pid}")
            pu = found
        if obj is not None and pu == obj.id:
            raise HTTPException(status_code=422, detail="A task cannot precede itself")
        t = await ctx.db.get(P.ReWbsTask, pu)
        if t is None or t.vendor_id != ctx.vendor_id or t.project_id != project_id:
            raise HTTPException(status_code=422, detail="Predecessors must be tasks of the same project")
        clean.append(str(pu))
    if "predecessor_ids" in data:
        data["predecessor_ids"] = clean
        if obj is not None and clean:
            graph = {t.id: [UUID(x) for x in (t.predecessor_ids or [])] for t in (await ctx.db.execute(
                select(P.ReWbsTask).where(P.ReWbsTask.project_id == project_id))).scalars().all()}
            seen: set[UUID] = set()
            stack = [UUID(x) for x in clean]
            while stack:
                n = stack.pop()
                if n == obj.id:
                    raise HTTPException(status_code=422, detail="That dependency would create a cycle")
                if n in seen:
                    continue
                seen.add(n)
                stack.extend(graph.get(n, []))
    start, dur = val("planned_start"), int(val("duration_days") or 0)
    if start:
        data["planned_end"] = start + timedelta(days=max(dur - 1, 0)) if dur else start
    if val("actual_start") and val("actual_end") and val("actual_end") < val("actual_start"):
        raise HTTPException(status_code=422, detail="actual_end cannot be before actual_start")


def apply_progress(task: P.ReWbsTask, percent: Decimal | float, on: Optional[date] = None) -> None:
    """Move a task's progress (never backwards) and keep status / actual dates consistent."""
    pct = max(D(percent), D(task.progress_percent))
    pct = min(pct, Decimal(100))
    task.progress_percent = pct
    on = on or date.today()
    if pct > 0 and task.status == "not_started":
        task.status = "in_progress"
        task.actual_start = task.actual_start or on
    if pct >= 100:
        task.status = "completed"
        task.actual_start = task.actual_start or on
        task.actual_end = task.actual_end or on


async def wbs_before_update(ctx: Ctx, obj: P.ReWbsTask, data: dict[str, Any]) -> None:
    await wbs_validate(ctx, data, obj)
    if "progress_percent" in data and D(data["progress_percent"]) < D(obj.progress_percent):
        raise HTTPException(status_code=409, detail="Progress cannot go backwards; correct it through a new daily report")
    if data.get("status") == "completed" and "progress_percent" not in data:
        data["progress_percent"] = Decimal(100)
        data.setdefault("actual_end", obj.actual_end or date.today())
        data.setdefault("actual_start", obj.actual_start or date.today())
    if "progress_percent" in data and D(data["progress_percent"]) >= 100 and "status" not in data:
        data["status"] = "completed"
        data.setdefault("actual_end", obj.actual_end or date.today())
        data.setdefault("actual_start", obj.actual_start or date.today())
    elif "progress_percent" in data and D(data["progress_percent"]) > 0 and obj.status == "not_started" and "status" not in data:
        data["status"] = "in_progress"
        data.setdefault("actual_start", obj.actual_start or date.today())


async def wbs_before_delete(ctx: Ctx, obj: P.ReWbsTask) -> None:
    kids = (await ctx.db.execute(select(func.count()).select_from(P.ReWbsTask).where(P.ReWbsTask.parent_id == obj.id))).scalar_one()
    if kids:
        raise HTTPException(status_code=409, detail="Delete or move the sub-tasks first")
    tasks = (await ctx.db.execute(select(P.ReWbsTask).where(
        P.ReWbsTask.project_id == obj.project_id, P.ReWbsTask.id != obj.id))).scalars().all()
    if any(str(obj.id) in (t.predecessor_ids or []) for t in tasks):
        raise HTTPException(status_code=409, detail="Other tasks depend on this one; remove the dependency first")


def _topo(ids: list[UUID], preds: dict[UUID, list[UUID]]) -> list[UUID]:
    indeg = {i: 0 for i in ids}
    succ: dict[UUID, list[UUID]] = defaultdict(list)
    for i in ids:
        for p in preds.get(i, []):
            if p in indeg:
                indeg[i] += 1
                succ[p].append(i)
    order, queue = [], [i for i in ids if indeg[i] == 0]
    while queue:
        n = queue.pop(0)
        order.append(n)
        for s in succ[n]:
            indeg[s] -= 1
            if indeg[s] == 0:
                queue.append(s)
    if len(order) != len(ids):
        raise HTTPException(status_code=422, detail="The task dependencies contain a cycle")
    return order


async def schedule(db: AsyncSession, vendor_id: UUID, project_id: UUID) -> dict:
    """Critical-path schedule (finish-to-start, lag in days) for the project's leaf tasks."""
    tasks = list((await db.execute(
        select(P.ReWbsTask).where(P.ReWbsTask.vendor_id == vendor_id, P.ReWbsTask.project_id == project_id).order_by(P.ReWbsTask.code)
    )).scalars().all())
    by_id = {t.id: t for t in tasks}
    parents = {t.parent_id for t in tasks if t.parent_id}
    leaves = [t for t in tasks if t.id not in parents]
    leaf_ids = [t.id for t in leaves]
    preds: dict[UUID, list[UUID]] = {}
    for t in leaves:
        preds[t.id] = [UUID(p) for p in (t.predecessor_ids or []) if UUID(p) in by_id and UUID(p) in set(leaf_ids)]
    order = _topo(leaf_ids, preds)
    anchor = min((t.planned_start for t in leaves if t.planned_start), default=date.today())
    es: dict[UUID, date] = {}
    ef: dict[UUID, date] = {}
    for tid in order:
        t = by_id[tid]
        dur = max(int(t.duration_days or 0), 0)
        start = t.planned_start or anchor
        for p in preds[tid]:
            start = max(start, ef[p] + timedelta(days=1 + int(t.lag_days or 0)))
        es[tid] = start
        ef[tid] = start + timedelta(days=max(dur - 1, 0)) if dur else start
    project_finish = max(ef.values(), default=anchor)
    succ: dict[UUID, list[UUID]] = defaultdict(list)
    for tid, ps in preds.items():
        for p in ps:
            succ[p].append(tid)
    ls: dict[UUID, date] = {}
    lf: dict[UUID, date] = {}
    for tid in reversed(order):
        t = by_id[tid]
        dur = max(int(t.duration_days or 0), 0)
        finish = project_finish
        for s in succ[tid]:
            finish = min(finish, ls[s] - timedelta(days=1 + int(by_id[s].lag_days or 0)))
        lf[tid] = finish
        ls[tid] = finish - timedelta(days=max(dur - 1, 0)) if dur else finish
    today = date.today()
    out = []
    for t in tasks:
        row: dict[str, Any] = {
            "id": str(t.id), "code": t.code, "name": t.name, "parent_id": str(t.parent_id) if t.parent_id else None,
            "duration_days": t.duration_days, "progress_percent": _f(t.progress_percent), "status": t.status,
            "predecessor_ids": t.predecessor_ids or [], "is_summary": t.id in parents, "is_milestone": t.is_milestone,
            "actual_start": jsonable(t.actual_start), "actual_end": jsonable(t.actual_end),
        }
        if t.id in es:
            fl = (lf[t.id] - ef[t.id]).days
            row.update({
                "start": es[t.id].isoformat(), "end": ef[t.id].isoformat(), "late_start": ls[t.id].isoformat(),
                "late_finish": lf[t.id].isoformat(), "float_days": fl, "critical": fl <= 0 and D(t.progress_percent) < 100,
                "delayed": ef[t.id] < today and D(t.progress_percent) < 100,
            })
        out.append(row)
    # summary rows span their children
    kids: dict[UUID, list[UUID]] = defaultdict(list)
    for t in tasks:
        if t.parent_id:
            kids[t.parent_id].append(t.id)

    def descend(pid: UUID) -> list[UUID]:
        res: list[UUID] = []
        for c in kids.get(pid, []):
            res.extend(descend(c) if c in parents else [c])
        return res

    rows_by_id = {r["id"]: r for r in out}
    for pid in parents:
        leaves_of = [x for x in descend(pid) if x in es]
        if leaves_of:
            rows_by_id[str(pid)]["start"] = min(es[x] for x in leaves_of).isoformat()
            rows_by_id[str(pid)]["end"] = max(ef[x] for x in leaves_of).isoformat()
            total_w = sum((D(by_id[x].weight) or Decimal(1) for x in leaves_of), Decimal(0))
            rows_by_id[str(pid)]["progress_percent"] = _f(
                sum((D(by_id[x].progress_percent) * (D(by_id[x].weight) or Decimal(1)) for x in leaves_of), Decimal(0)) / total_w) if total_w else 0
    critical = [str(t) for t in order if str(t) in rows_by_id and rows_by_id[str(t)].get("critical")]
    total_w = sum((D(t.weight) or Decimal(1) for t in leaves), Decimal(0))
    progress = (sum((D(t.progress_percent) * (D(t.weight) or Decimal(1)) for t in leaves), Decimal(0)) / total_w) if total_w else Decimal(0)
    return {
        "project_id": str(project_id), "start": anchor.isoformat(), "finish": project_finish.isoformat() if leaves else None,
        "duration_days": (project_finish - anchor).days + 1 if leaves else 0,
        "progress_percent": round(_f(progress), 2), "critical_path": critical,
        "delayed_tasks": sum(1 for r in out if r.get("delayed")), "tasks": out,
    }


# ═══ milestones ═════════════════════════════════════════════════════════════════════════════

async def achieve_milestone(ctx: Ctx, ms: P.ReMilestone, completed_on: Optional[date], trigger_billing: bool) -> dict:
    if ms.status == "achieved":
        raise HTTPException(status_code=409, detail="Milestone is already achieved")
    ms.status = "achieved"
    ms.completed_on = completed_on or date.today()
    if ms.wbs_task_id:
        task = await ctx.db.get(P.ReWbsTask, ms.wbs_task_id)
        if task is not None:
            apply_progress(task, 100, ms.completed_on)
    billing = None
    if trigger_billing:
        if not (ctx.has("realestate.collections") or ctx.has("realestate.admin")):
            raise HTTPException(status_code=403, detail="Raising customer demands needs the collections permission")
        from .payments import trigger_milestone

        billing = await trigger_milestone(ctx, ms.project_id, ms.name)
        ms.billing_triggered = bool(billing["instalments_triggered"])
    await audit(ctx, "milestone", ms.id, "achieve", ref=ms.name, changes={"billing": bool(billing)})
    return {"billing": billing}


# ═══ budgets & costing ══════════════════════════════════════════════════════════════════════

async def project_costing(db: AsyncSession, vendor_id: UUID, project_id: UUID) -> dict:
    project = await db.get(C.ReProject, project_id)
    if project is None or project.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="project not found")
    heads = {h: {"budget": Decimal(0), "committed": Decimal(0), "actual": Decimal(0)} for h in P.COST_HEADS}

    for b in (await db.execute(select(P.ReProjectBudget).where(
            P.ReProjectBudget.vendor_id == vendor_id, P.ReProjectBudget.project_id == project_id))).scalars().all():
        heads[b.cost_head]["budget"] += D(b.revised_amount) if D(b.revised_amount) > 0 else D(b.budget_amount)

    # materials: committed = open PO balance (ex-GST), actual = posted GRNs
    pos = (await db.execute(select(S.RePurchaseOrder).where(
        S.RePurchaseOrder.vendor_id == vendor_id, S.RePurchaseOrder.project_id == project_id,
        S.RePurchaseOrder.status.in_(("approved", "partially_received"))))).scalars().all()
    for po in pos:
        for ln in (await db.execute(select(S.RePoLine).where(S.RePoLine.po_id == po.id))).scalars().all():
            heads["materials"]["committed"] += max(Decimal(0), D(ln.quantity) - D(ln.received_quantity)) * D(ln.rate)
    heads["materials"]["actual"] += D((await db.execute(
        select(func.coalesce(func.sum(S.ReGrn.total_value), 0)).where(
            S.ReGrn.vendor_id == vendor_id, S.ReGrn.project_id == project_id, S.ReGrn.status == "posted"))).scalar_one())

    # contractors: committed = unbilled contract value, actual = approved / paid bills
    for sc in (await db.execute(select(K.ReSubcontract).where(
            K.ReSubcontract.vendor_id == vendor_id, K.ReSubcontract.project_id == project_id,
            K.ReSubcontract.status.in_(("active", "completed"))))).scalars().all():
        heads[sc.cost_head]["actual"] += D(sc.billed_amount)
        if sc.status == "active":
            heads[sc.cost_head]["committed"] += max(Decimal(0), D(sc.contract_value) + D(sc.variation_amount) - D(sc.billed_amount))

    # direct labour paid through wage sheets (contractor labour is already inside subcontract bills)
    from .workforce import direct_labour_cost

    heads["labour"]["actual"] += await direct_labour_cost(db, vendor_id, project_id)

    # land
    for a in (await db.execute(select(L.ReAcquisition).where(
            L.ReAcquisition.vendor_id == vendor_id, L.ReAcquisition.project_id == project_id,
            L.ReAcquisition.status != "cancelled"))).scalars().all():
        heads["land"]["actual"] += D(a.paid_amount)
        heads["land"]["committed"] += max(Decimal(0), D(a.total_cost) - D(a.paid_amount))

    rows = []
    t_budget = t_committed = t_actual = Decimal(0)
    over: list[str] = []
    for h, v in heads.items():
        if not any(v.values()):
            continue
        forecast = v["committed"] + v["actual"]
        variance = v["budget"] - forecast
        rows.append({
            "cost_head": h, "budget": _f(v["budget"]), "committed": _f(v["committed"]), "actual": _f(v["actual"]),
            "forecast": _f(forecast), "variance": _f(variance),
            "variance_percent": round(_f(variance / v["budget"] * 100), 1) if v["budget"] > 0 else None,
            "over_budget": v["budget"] > 0 and forecast > v["budget"] + EPS,
            "unbudgeted": v["budget"] <= 0 and forecast > 0,
        })
        t_budget += v["budget"]
        t_committed += v["committed"]
        t_actual += v["actual"]
        if v["budget"] > 0 and forecast > v["budget"] + EPS:
            over.append(h)

    bookings = (await db.execute(select(C.ReBooking).where(
        C.ReBooking.vendor_id == vendor_id, C.ReBooking.project_id == project_id,
        C.ReBooking.status.in_(("confirmed", "allotted", "agreement_signed", "registered", "handed_over"))))).scalars().all()
    collected = sum((D(b.paid_amount) for b in bookings), Decimal(0))
    sales_value = sum((D(b.agreement_value) for b in bookings), Decimal(0))
    forecast_total = t_committed + t_actual
    return {
        "project_id": str(project_id), "project": project.name, "rows": rows,
        "totals": {
            "budget": _f(t_budget), "committed": _f(t_committed), "actual": _f(t_actual), "forecast": _f(forecast_total),
            "variance": _f(t_budget - forecast_total),
        },
        "over_budget_heads": over,
        "revenue": {"sales_value": _f(sales_value), "collected": _f(collected), "bookings": len(bookings)},
        "margin": {
            "collected_less_actual_cost": _f(collected - t_actual),
            "projected_margin": _f(sales_value - forecast_total) if sales_value else None,
        },
    }


async def budget_overruns(db: AsyncSession, vendor_id: UUID) -> list[dict]:
    out = []
    projects = (await db.execute(select(C.ReProject.id).where(
        C.ReProject.vendor_id == vendor_id,
        C.ReProject.id.in_(select(P.ReProjectBudget.project_id).where(P.ReProjectBudget.vendor_id == vendor_id))))).scalars().all()
    for pid in projects:
        c = await project_costing(db, vendor_id, pid)
        for r in c["rows"]:
            if r["over_budget"]:
                out.append({"project_id": pid, "project": c["project"], **r})
    return out
