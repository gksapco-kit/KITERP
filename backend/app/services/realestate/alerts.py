"""Operational alerts surfaced under Administration → Notifications (computed on read)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from sqlalchemy import func, select

from app.models.realestate.admin import ReApprovalRequest, ReDocument
from app.models.realestate.core import ReFollowup, ReUnitBlock

from .common import Ctx

Provider = Callable[[Ctx], Awaitable[list[dict[str, Any]]]]
PROVIDERS: list[Provider] = []


def provider(fn: Provider) -> Provider:
    PROVIDERS.append(fn)
    return fn


def alert(severity: str, title: str, detail: str, entity_type: str, entity_id: Any = None, due: Any = None) -> dict:
    return {
        "severity": severity, "title": title, "detail": detail, "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id else None, "due": due.isoformat() if due else None,
    }


@provider
async def _documents(ctx: Ctx) -> list[dict]:
    horizon = date.today() + timedelta(days=30)
    rows = (
        await ctx.db.execute(
            select(ReDocument).where(
                ReDocument.vendor_id == ctx.vendor_id, ReDocument.expires_on.is_not(None), ReDocument.expires_on <= horizon
            ).order_by(ReDocument.expires_on).limit(50)
        )
    ).scalars().all()
    out = []
    for d in rows:
        expired = d.expires_on < date.today()
        out.append(alert("critical" if expired else "warning", f"{'Expired' if expired else 'Expiring'}: {d.title}",
                         f"{d.doc_type} valid till {d.expires_on}", "document", d.id, d.expires_on))
    return out


@provider
async def _blocks(ctx: Ctx) -> list[dict]:
    soon = datetime.now(timezone.utc) + timedelta(hours=6)
    rows = (
        await ctx.db.execute(
            select(ReUnitBlock).where(
                ReUnitBlock.vendor_id == ctx.vendor_id, ReUnitBlock.status == "active",
                ReUnitBlock.expires_at.is_not(None), ReUnitBlock.expires_at <= soon,
            ).limit(50)
        )
    ).scalars().all()
    return [alert("warning", "Unit block expiring soon", f"Block {b.id} on unit expires within 6 hours",
                  "unit_block", b.id) for b in rows]


@provider
async def _followups(ctx: Ctx) -> list[dict]:
    rows = (
        await ctx.db.execute(
            select(ReFollowup).where(
                ReFollowup.vendor_id == ctx.vendor_id, ReFollowup.status == "pending",
                ReFollowup.due_at < datetime.now(timezone.utc),
            ).order_by(ReFollowup.due_at).limit(50)
        )
    ).scalars().all()
    return [alert("warning", "Overdue follow-up", (f.notes or f.followup_type), "followup", f.id) for f in rows]


@provider
async def _approvals(ctx: Ctx) -> list[dict]:
    count = (
        await ctx.db.execute(
            select(func.count()).select_from(ReApprovalRequest).where(
                ReApprovalRequest.vendor_id == ctx.vendor_id, ReApprovalRequest.status == "pending"
            )
        )
    ).scalar_one()
    return [alert("info", f"{count} approval(s) waiting", "Open Administration → Approvals inbox", "approval_request")] if count else []


@provider
async def _overdue_demands(ctx: Ctx) -> list[dict]:
    from app.models.realestate.receivables import ReDemand

    rows = (
        await ctx.db.execute(
            select(ReDemand).where(
                ReDemand.vendor_id == ctx.vendor_id, ReDemand.status.in_(("issued", "partial")), ReDemand.due_date < date.today(),
            ).order_by(ReDemand.due_date).limit(25)
        )
    ).scalars().all()
    return [
        alert("critical" if (date.today() - d.due_date).days > 30 else "warning", f"Overdue demand {d.demand_no}",
              f"{d.stage_name or 'Instalment'} — ₹{float(d.total_amount or 0) - float(d.paid_amount or 0):,.2f} unpaid since {d.due_date}",
              "demand", d.id, d.due_date)
        for d in rows
    ]


@provider
async def _filings(ctx: Ctx) -> list[dict]:
    from app.models.realestate.receivables import ReTaxFiling

    horizon = date.today() + timedelta(days=7)
    rows = (
        await ctx.db.execute(
            select(ReTaxFiling).where(
                ReTaxFiling.vendor_id == ctx.vendor_id, ReTaxFiling.status == "pending",
                ReTaxFiling.due_date.is_not(None), ReTaxFiling.due_date <= horizon,
            ).order_by(ReTaxFiling.due_date).limit(25)
        )
    ).scalars().all()
    return [
        alert("critical" if f.due_date < date.today() else "warning",
              f"{'Overdue' if f.due_date < date.today() else 'Due soon'}: {f.filing_type.upper()} {f.period}",
              f"Due {f.due_date}", "tax_filing", f.id, f.due_date)
        for f in rows
    ]


@provider
async def _tds_deposits(ctx: Ctx) -> list[dict]:
    from app.models.realestate.receivables import ReTdsEntry

    from .tax import tds_deposit_due

    rows = (
        await ctx.db.execute(
            select(ReTdsEntry).where(
                ReTdsEntry.vendor_id == ctx.vendor_id, ReTdsEntry.status == "pending_deposit", ReTdsEntry.deducted_on.is_not(None)
            ).limit(100)
        )
    ).scalars().all()
    out = []
    for t in rows:
        due = tds_deposit_due(t.deducted_on)
        if due <= date.today() + timedelta(days=7):
            out.append(alert("critical" if due < date.today() else "warning", "TDS 194-IA deposit (Form 26QB)",
                             f"₹{float(t.tds_amount or 0):,.2f} deducted {t.deducted_on}; deposit due {due}", "tds_entry", t.id, due))
    return out


@provider
async def _rera_reserve(ctx: Ctx) -> list[dict]:
    from .tax import rera_account

    view = await rera_account(ctx.db, ctx.vendor_id)
    return [
        alert("warning", f"RERA 70% reserve short — {r['project']}",
              f"Required ₹{r['required_reserve']:,.2f}, deposited ₹{r['deposited']:,.2f}", "project", r["project_id"])
        for r in view["projects"] if not r["compliant"] and r["collected"] > 0
    ]


@provider
async def _commissions_ready(ctx: Ctx) -> list[dict]:
    from app.models.realestate.receivables import ReCommission

    count = (
        await ctx.db.execute(
            select(func.count()).select_from(ReCommission).where(
                ReCommission.vendor_id == ctx.vendor_id, ReCommission.status == "eligible", ReCommission.settlement_id.is_(None))
        )
    ).scalar_one()
    return [alert("info", f"{count} broker commission(s) ready for settlement", "Open Broker Management → Settlements", "commission")] if count else []


@provider
async def _approvals_expiring(ctx: Ctx) -> list[dict]:
    from app.models.realestate.land import ReStatutoryApproval

    from .land import approval_state

    rows = (
        await ctx.db.execute(
            select(ReStatutoryApproval).where(
                ReStatutoryApproval.vendor_id == ctx.vendor_id, ReStatutoryApproval.status == "approved",
                ReStatutoryApproval.valid_until.is_not(None)).limit(200)
        )
    ).scalars().all()
    out = []
    for a in rows:
        st = approval_state(a)
        if st in ("expired", "renewal_due"):
            name = a.approval_type.replace("_", " ").title()
            out.append(alert("critical" if st == "expired" else "warning",
                             f"{'Expired' if st == 'expired' else 'Renewal due'}: {name}",
                             f"{a.authority or 'Authority'} · valid till {a.valid_until}", "statutory_approval", a.id, a.valid_until))
    return out


@provider
async def _title_checks(ctx: Ctx) -> list[dict]:
    from app.models.realestate.land import ReTitleCheck

    rows = (
        await ctx.db.execute(
            select(ReTitleCheck).where(ReTitleCheck.vendor_id == ctx.vendor_id, ReTitleCheck.status == "issues_found").limit(25)
        )
    ).scalars().all()
    return [alert("critical", f"Title issue: {t.check_type.replace('_', ' ')}", (t.findings or "Issues found")[:140],
                  "title_check", t.id) for t in rows]


@provider
async def _milestones_late(ctx: Ctx) -> list[dict]:
    from app.models.realestate.projects import ReMilestone

    rows = (
        await ctx.db.execute(
            select(ReMilestone).where(
                ReMilestone.vendor_id == ctx.vendor_id, ReMilestone.status != "achieved",
                ReMilestone.due_date.is_not(None), ReMilestone.due_date < date.today()).order_by(ReMilestone.due_date).limit(25)
        )
    ).scalars().all()
    return [alert("warning", f"Milestone overdue: {m.name}", f"Planned for {m.due_date}", "milestone", m.id, m.due_date) for m in rows]


@provider
async def _safety_open(ctx: Ctx) -> list[dict]:
    from app.models.realestate.projects import ReSafetyIncident

    rows = (
        await ctx.db.execute(
            select(ReSafetyIncident).where(
                ReSafetyIncident.vendor_id == ctx.vendor_id, ReSafetyIncident.status != "closed",
                ReSafetyIncident.severity.in_(("major", "fatal"))).limit(25)
        )
    ).scalars().all()
    return [alert("critical", f"Open {i.severity} safety incident", (i.description or "")[:140], "safety_incident", i.id,
                  i.incident_date) for i in rows]


@provider
async def _quality_open(ctx: Ctx) -> list[dict]:
    from app.models.realestate.projects import ReQualityCheck

    rows = (
        await ctx.db.execute(
            select(ReQualityCheck).where(
                ReQualityCheck.vendor_id == ctx.vendor_id, ReQualityCheck.status != "closed",
                ReQualityCheck.result.in_(("fail", "conditional"))).limit(25)
        )
    ).scalars().all()
    return [alert("warning", f"Quality {q.result}: {q.checklist_name}", (q.observations or "Rectification pending")[:140],
                  "quality_check", q.id, q.rectification_due) for q in rows]


@provider
async def _budget_overruns(ctx: Ctx) -> list[dict]:
    from .projectmgmt import budget_overruns

    return [alert("warning", f"Budget overrun — {o['project']} · {str(o['cost_head']).replace('_', ' ')}",
                  f"Forecast ₹{o['forecast']:,.2f} vs budget ₹{o['budget']:,.2f}", "project", o.get("project_id"))
            for o in (await budget_overruns(ctx.db, ctx.vendor_id))[:25]]


@provider
async def _low_stock(ctx: Ctx) -> list[dict]:
    from .inventory import stock_balance_report

    rep = await stock_balance_report(ctx.db, ctx.vendor_id)
    return [alert("warning", f"Low stock: {r['material']}", f"{r['quantity']:g} {r['unit']} left (reorder at {r['reorder_level']:g})",
                  "material", r.get("material_id")) for r in rep["rows"] if r["low_stock"]][:25]


@provider
async def _po_late(ctx: Ctx) -> list[dict]:
    from app.models.realestate.supply import RePurchaseOrder

    rows = (
        await ctx.db.execute(
            select(RePurchaseOrder).where(
                RePurchaseOrder.vendor_id == ctx.vendor_id, RePurchaseOrder.status.in_(("approved", "partially_received")),
                RePurchaseOrder.expected_date.is_not(None), RePurchaseOrder.expected_date < date.today()).limit(25)
        )
    ).scalars().all()
    return [alert("warning", f"Delivery overdue: {p.po_no}", f"Expected {p.expected_date}", "purchase_order", p.id, p.expected_date)
            for p in rows]


@provider
async def _tickets_sla(ctx: Ctx) -> list[dict]:
    from app.models.realestate.postsales import ReTicket

    from .postsales import sla_state

    rows = (
        await ctx.db.execute(
            select(ReTicket).where(ReTicket.vendor_id == ctx.vendor_id, ReTicket.status.notin_(("resolved", "closed"))).limit(200)
        )
    ).scalars().all()
    out = []
    for t in rows:
        st = sla_state(t)
        if st in ("breached", "at_risk"):
            out.append(alert("critical" if st == "breached" else "warning",
                             f"Ticket {t.ticket_no} {'breached its SLA' if st == 'breached' else 'is close to its SLA'}",
                             f"{t.subject[:100]} · due {t.due_at:%d %b %H:%M}" if t.due_at else t.subject[:100], "ticket", t.id))
    return out[:30]


@provider
async def _warranties_expiring(ctx: Ctx) -> list[dict]:
    from app.models.realestate.postsales import ReWarranty

    rows = (
        await ctx.db.execute(
            select(ReWarranty).where(
                ReWarranty.vendor_id == ctx.vendor_id, ReWarranty.status == "active",
                ReWarranty.ends_on <= date.today() + timedelta(days=60)).order_by(ReWarranty.ends_on).limit(25)
        )
    ).scalars().all()
    return [alert("info" if w.ends_on >= date.today() else "warning", f"{w.coverage.title()} warranty {'ends' if w.ends_on >= date.today() else 'ended'} {w.ends_on}",
                  "Defect-liability cover" + (" (statutory)" if w.statutory else ""), "warranty", w.id, w.ends_on) for w in rows]


@provider
async def _snags_overdue(ctx: Ctx) -> list[dict]:
    from app.models.realestate.postsales import ReSnag

    rows = (
        await ctx.db.execute(
            select(ReSnag).where(
                ReSnag.vendor_id == ctx.vendor_id, ReSnag.status.in_(("open", "in_progress")),
                ReSnag.due_date.is_not(None), ReSnag.due_date < date.today()).order_by(ReSnag.due_date).limit(25)
        )
    ).scalars().all()
    return [alert("critical" if s.severity == "critical" else "warning", f"Overdue {s.severity} snag", (s.description or "")[:120], "snag", s.id, s.due_date)
            for s in rows]


@provider
async def _leases_ending(ctx: Ctx) -> list[dict]:
    from app.models.realestate.operations import ReLease

    rows = (
        await ctx.db.execute(
            select(ReLease).where(
                ReLease.vendor_id == ctx.vendor_id, ReLease.status == "active",
                ReLease.end_date <= date.today() + timedelta(days=60)).order_by(ReLease.end_date).limit(25)
        )
    ).scalars().all()
    return [alert("critical" if l.end_date < date.today() else "warning",
                  f"Lease {l.lease_no} {'ended' if l.end_date < date.today() else 'ends'} {l.end_date}",
                  "Renew or let it lapse — open Leasing → Renewals", "lease", l.id, l.end_date) for l in rows]


@provider
async def _rent_overdue(ctx: Ctx) -> list[dict]:
    from app.models.realestate.operations import ReMaintenanceBill, ReRentInvoice

    out = []
    for model, label in ((ReRentInvoice, "Rent"), (ReMaintenanceBill, "Maintenance")):
        rows = (
            await ctx.db.execute(
                select(model).where(model.vendor_id == ctx.vendor_id, model.status.in_(("issued", "partial")),
                                    model.due_date < date.today()).order_by(model.due_date).limit(15)
            )
        ).scalars().all()
        for r in rows:
            late = (date.today() - r.due_date).days
            out.append(alert("critical" if late > 30 else "warning", f"{label} overdue {getattr(r, 'invoice_no', None) or r.bill_no}",
                             f"₹{float(r.total_amount or 0) - float(r.paid_amount or 0):,.2f} unpaid since {r.due_date}",
                             "rent_invoice" if model is ReRentInvoice else "maintenance_bill", r.id, r.due_date))
    return out


@provider
async def _facility_due(ctx: Ctx) -> list[dict]:
    from app.models.realestate.operations import ReFacilityWorkOrder, RePmSchedule, ReSecurityLog

    out = []
    wos = (
        await ctx.db.execute(
            select(ReFacilityWorkOrder).where(
                ReFacilityWorkOrder.vendor_id == ctx.vendor_id, ReFacilityWorkOrder.status.in_(("open", "assigned", "in_progress")),
                ReFacilityWorkOrder.due_date.is_not(None), ReFacilityWorkOrder.due_date < date.today()).limit(20)
        )
    ).scalars().all()
    out += [alert("critical" if w.priority in ("urgent", "high") else "warning", f"Overdue work order {w.wo_no}", w.title[:120],
                  "facility_work_order", w.id, w.due_date) for w in wos]
    pm = (
        await ctx.db.execute(
            select(RePmSchedule).where(RePmSchedule.vendor_id == ctx.vendor_id, RePmSchedule.is_active.is_(True),
                                       RePmSchedule.next_due_on <= date.today()).limit(20)
        )
    ).scalars().all()
    out += [alert("warning", f"Preventive maintenance due: {s.name}", f"Due {s.next_due_on}", "pm_schedule", s.id, s.next_due_on) for s in pm]
    sec = (
        await ctx.db.execute(
            select(ReSecurityLog).where(ReSecurityLog.vendor_id == ctx.vendor_id, ReSecurityLog.resolved.is_(False)).limit(10)
        )
    ).scalars().all()
    out += [alert("critical" if s.severity == "critical" else "warning", f"Unresolved security {s.log_type}", (s.details or "")[:120],
                  "security_log", s.id) for s in sec]
    return out


@provider
async def _assets_due(ctx: Ctx) -> list[dict]:
    from app.models.realestate.operations import ReAsset

    rows = (
        await ctx.db.execute(select(ReAsset).where(ReAsset.vendor_id == ctx.vendor_id, ReAsset.status != "disposed").limit(500))
    ).scalars().all()
    out, soon = [], date.today() + timedelta(days=30)
    for a in rows:
        if a.next_maintenance_on and a.next_maintenance_on <= soon:
            late = a.next_maintenance_on < date.today()
            out.append(alert("warning" if late else "info", f"{'Service overdue' if late else 'Service due'}: {a.name}", f"{a.asset_code} · {a.next_maintenance_on}",
                             "asset", a.id, a.next_maintenance_on))
        if a.amc_until and a.amc_until <= soon:
            out.append(alert("warning", f"AMC {'expired' if a.amc_until < date.today() else 'ending'}: {a.name}", f"{a.asset_code} · {a.amc_until}",
                             "asset", a.id, a.amc_until))
    return out[:30]


@provider
async def _wages_unpaid(ctx: Ctx) -> list[dict]:
    from app.models.realestate.workforce import ReWageSheet

    rows = (
        await ctx.db.execute(
            select(ReWageSheet).where(ReWageSheet.vendor_id == ctx.vendor_id, ReWageSheet.status == "approved",
                                      ReWageSheet.approved_on <= date.today() - timedelta(days=3)).limit(20)
        )
    ).scalars().all()
    return [alert("critical" if (date.today() - s.approved_on).days > 7 else "warning", f"Wages unpaid: {s.sheet_no}",
                  f"₹{float(s.total_net or 0):,.2f} for {s.workers} worker(s), approved {s.approved_on}", "wage_sheet", s.id, s.approved_on)
            for s in rows]


@provider
async def _system_health(ctx: Ctx) -> list[dict]:
    """The module's own plumbing: ledger postings that failed and customer messages that are stuck or failing."""
    from app.models.realestate.admin import ReGlFailure
    from app.models.realestate.core import ReCommunication

    out: list[dict] = []
    gl_open = (await ctx.db.execute(select(func.count()).select_from(ReGlFailure).where(
        ReGlFailure.vendor_id == ctx.vendor_id, ReGlFailure.status == "open"))).scalar_one()
    if gl_open:
        out.append(alert("critical", f"{gl_open} document(s) not posted to the ledger",
                         "Fix the Finance account setup or accounting period, then retry under Administration -> GL Posting Issues.",
                         "gl_failure"))
    failed = (await ctx.db.execute(select(func.count()).select_from(ReCommunication).where(
        ReCommunication.vendor_id == ctx.vendor_id, ReCommunication.status == "failed", ReCommunication.event.is_not(None)))).scalar_one()
    if failed:
        out.append(alert("warning", f"{failed} customer message(s) could not be delivered",
                         "Check the recipient details or the email / SMS provider, then retry from the Communication log.", "communication"))
    stuck = (await ctx.db.execute(select(func.count()).select_from(ReCommunication).where(
        ReCommunication.vendor_id == ctx.vendor_id, ReCommunication.status == "queued",
        ReCommunication.created_at < datetime.now(timezone.utc) - timedelta(minutes=30)))).scalar_one()
    if stuck:
        out.append(alert("warning", f"{stuck} customer message(s) waiting for over 30 minutes",
                         "The background worker may be down: check the Celery worker and beat processes.", "communication"))
    return out


async def collect(ctx: Ctx) -> list[dict]:
    items: list[dict] = []
    for p in PROVIDERS:
        try:
            items.extend(await p(ctx))
        except Exception:  # one broken provider must not hide the rest
            continue
    order = {"critical": 0, "warning": 1, "info": 2}
    items.sort(key=lambda a: (order.get(a["severity"], 3), a["due"] or ""))
    return items
