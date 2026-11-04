"""Module 14 — GST summary, TDS 194-IA tracking, RERA 70% account and tax reconciliation."""
from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import receivables as R
from app.models.realestate.admin import ReGlFailure

from .common import Ctx, D, audit, jsonable, money_q
from .payments import ACTIVE_BOOKING, EPS, payable_total

RERA_RESERVE_PERCENT = Decimal(70)  # RERA s.4(2)(l)(D)


def _f(v: Any) -> float:
    return float(D(v))


def _period(d: Optional[date], start: bool) -> date:
    return d or (date(2000, 1, 1) if start else date(2999, 12, 31))


# ═══ GST ════════════════════════════════════════════════════════════════════════════════════

async def gst_summary(
    db: AsyncSession, vendor_id: UUID, *, date_from: Optional[date] = None, date_to: Optional[date] = None,
    project_id: Optional[UUID] = None,
) -> dict:
    """GST on instalments: invoiced (demands) and received (receipts), per month and per project.

    Supply is assumed intra-state (CGST + SGST split); inter-state supplies would be IGST.
    """
    lo, hi = _period(date_from, True), _period(date_to, False)
    dq = (
        select(R.ReDemand, C.ReBooking)
        .join(C.ReBooking, C.ReBooking.id == R.ReDemand.booking_id)
        .where(R.ReDemand.vendor_id == vendor_id, R.ReDemand.status != "cancelled",
               R.ReDemand.demand_date >= lo, R.ReDemand.demand_date <= hi)
    )
    rq = (
        select(R.ReReceipt, C.ReBooking)
        .join(C.ReBooking, C.ReBooking.id == R.ReReceipt.booking_id)
        .where(R.ReReceipt.vendor_id == vendor_id, R.ReReceipt.status == "cleared",
               R.ReReceipt.receipt_date >= lo, R.ReReceipt.receipt_date <= hi)
    )
    if project_id:
        dq, rq = dq.where(C.ReBooking.project_id == project_id), rq.where(C.ReBooking.project_id == project_id)
    names = {p.id: p.name for p in (await db.execute(select(C.ReProject).where(C.ReProject.vendor_id == vendor_id))).scalars().all()}
    months: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    projects: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    inv_taxable = inv_gst = rec_gross = rec_gst = Decimal(0)
    for d, b in (await db.execute(dq)).all():
        m = d.demand_date.strftime("%Y-%m")
        for bucket in (months[m], projects[names.get(b.project_id, "?")]):
            bucket["invoiced_taxable"] += D(d.amount)
            bucket["invoiced_gst"] += D(d.gst_amount)
        inv_taxable += D(d.amount)
        inv_gst += D(d.gst_amount)
    for r, b in (await db.execute(rq)).all():
        pay = payable_total(b)
        share = D(b.gst_amount) / pay if pay > 0 else Decimal(0)
        gst = money_q(D(r.gross_amount) * share)
        m = r.receipt_date.strftime("%Y-%m")
        for bucket in (months[m], projects[names.get(b.project_id, "?")]):
            bucket["received_gross"] += D(r.gross_amount)
            bucket["received_gst"] += gst
        rec_gross += D(r.gross_amount)
        rec_gst += gst

    def fmt(d: dict) -> dict:
        return {k: _f(v) for k, v in d.items()}

    return {
        "from": jsonable(date_from), "to": jsonable(date_to),
        "invoiced": {"taxable_value": _f(inv_taxable), "gst": _f(inv_gst), "cgst": _f(inv_gst / 2), "sgst": _f(inv_gst / 2)},
        "received": {"gross": _f(rec_gross), "gst": _f(rec_gst)},
        "gst_receivable_on_unbilled_receipts": _f(max(Decimal(0), rec_gst - inv_gst)),
        "by_month": [{"month": m, **fmt(v)} for m, v in sorted(months.items())],
        "by_project": [{"project": p, **fmt(v)} for p, v in sorted(projects.items())],
        "note": "Intra-state supply assumed (CGST + SGST). Time of supply is the earlier of invoice and receipt.",
    }


# ═══ TDS 194-IA ═════════════════════════════════════════════════════════════════════════════

def tds_deposit_due(deducted_on: date) -> date:
    """Form 26QB: deposit within 30 days from the end of the month of deduction."""
    last = date(deducted_on.year, deducted_on.month, calendar.monthrange(deducted_on.year, deducted_on.month)[1])
    return last + timedelta(days=30)


async def mark_tds_deposited(ctx: Ctx, entry: R.ReTdsEntry, *, challan_no: str, challan_date: Optional[date], ack_no: Optional[str]) -> R.ReTdsEntry:
    if entry.status != "pending_deposit":
        raise HTTPException(status_code=409, detail=f"TDS entry is {entry.status}")
    entry.status = "deposited"
    entry.challan_no = challan_no
    entry.challan_date = challan_date or date.today()
    entry.ack_no_26qb = ack_no
    await audit(ctx, "tds_entry", entry.id, "deposit", ref=challan_no)
    return entry


async def mark_tds_certificate(ctx: Ctx, entry: R.ReTdsEntry, *, certificate_no: str, certificate_date: Optional[date]) -> R.ReTdsEntry:
    if entry.status != "deposited":
        raise HTTPException(status_code=409, detail="Form 16B can be recorded only after the TDS is deposited")
    entry.status = "certificate_received"
    entry.certificate_no = certificate_no
    entry.certificate_date = certificate_date or date.today()
    await audit(ctx, "tds_entry", entry.id, "certificate", ref=certificate_no)
    return entry


# ═══ RERA designated account ════════════════════════════════════════════════════════════════

async def _rera_project_view(db: AsyncSession, project: C.ReProject) -> dict:
    bookings = (
        await db.execute(select(C.ReBooking.paid_amount).where(C.ReBooking.project_id == project.id, C.ReBooking.status.in_(ACTIVE_BOOKING)))
    ).scalars().all()
    collected = sum((D(p) for p in bookings), Decimal(0))
    entries = (await db.execute(select(R.ReReraEntry).where(R.ReReraEntry.project_id == project.id))).scalars().all()
    deposited = sum((D(e.amount) for e in entries if e.kind == "deposit" and e.status == "approved"), Decimal(0))
    withdrawn = sum((D(e.amount) for e in entries if e.kind == "withdrawal" and e.status == "approved"), Decimal(0))
    pending = sum((D(e.amount) for e in entries if e.kind == "withdrawal" and e.status == "requested"), Decimal(0))
    certified = max((D(e.certified_completion_percent) for e in entries if e.kind == "withdrawal" and e.status == "approved"), default=Decimal(0))
    required = money_q(collected * RERA_RESERVE_PERCENT / 100)
    return {
        "project_id": str(project.id), "project": project.name, "rera_number": project.rera_number,
        "collected": _f(collected), "required_reserve": _f(required), "deposited": _f(deposited),
        "shortfall": _f(max(Decimal(0), required - deposited)), "withdrawn": _f(withdrawn),
        "pending_withdrawals": _f(pending), "balance_in_account": _f(deposited - withdrawn),
        "last_certified_percent": _f(certified),
        "compliant": deposited + EPS >= required,
    }


async def rera_account(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID] = None) -> dict:
    q = select(C.ReProject).where(C.ReProject.vendor_id == vendor_id)
    if project_id:
        q = q.where(C.ReProject.id == project_id)
    projects = (await db.execute(q.order_by(C.ReProject.name))).scalars().all()
    rows = [await _rera_project_view(db, p) for p in projects]
    return {"reserve_percent": float(RERA_RESERVE_PERCENT), "projects": rows,
            "non_compliant": sum(1 for r in rows if not r["compliant"] and r["collected"] > 0)}


async def decide_rera_entry(ctx: Ctx, entry: R.ReReraEntry, approve: bool, remarks: Optional[str] = None) -> R.ReReraEntry:
    if entry.status != "requested":
        raise HTTPException(status_code=409, detail=f"Entry is already {entry.status}")
    if not approve:
        entry.status = "rejected"
        entry.remarks = (remarks or entry.remarks or "")[:500] or None
        await audit(ctx, "rera_entry", entry.id, "reject", ref=entry.reference_no or "")
        return entry
    if entry.kind != "withdrawal":
        entry.status = "approved"
        return entry
    if D(entry.certified_completion_percent) <= 0 or not (entry.certified_by or "").strip() or not (entry.certificate_ref or "").strip():
        raise HTTPException(status_code=422, detail="A withdrawal needs the certified completion %, the certifier (engineer / architect / CA) and certificate reference")
    project = await ctx.db.get(C.ReProject, entry.project_id)
    view = await _rera_project_view(ctx.db, project)
    cap_by_percent = D(view["deposited"]) * D(entry.certified_completion_percent) / 100 - D(view["withdrawn"])
    available = min(cap_by_percent, D(view["balance_in_account"]))
    if D(entry.amount) > available + EPS:
        raise HTTPException(
            status_code=409,
            detail=(f"Withdrawal ₹{D(entry.amount):,.2f} exceeds the eligible amount ₹{max(available, Decimal(0)):,.2f} "
                    f"({entry.certified_completion_percent}% certified completion of the deposited reserve, less prior withdrawals)"),
        )
    entry.status = "approved"
    await audit(ctx, "rera_entry", entry.id, "approve", ref=entry.certificate_ref or "", changes={"amount": entry.amount})
    return entry


# ═══ reconciliation ═════════════════════════════════════════════════════════════════════════

async def tax_reconciliation(
    db: AsyncSession, vendor_id: UUID, *, date_from: Optional[date] = None, date_to: Optional[date] = None,
) -> dict:
    lo, hi = _period(date_from, True), _period(date_to, False)
    gst = await gst_summary(db, vendor_id, date_from=date_from, date_to=date_to)
    filings = (
        await db.execute(
            select(R.ReTaxFiling).where(
                R.ReTaxFiling.vendor_id == vendor_id, R.ReTaxFiling.filing_type == "gstr3b", R.ReTaxFiling.status.in_(("filed", "late")),
                R.ReTaxFiling.due_date >= lo, R.ReTaxFiling.due_date <= hi)
        )
    ).scalars().all()
    filed_gst = sum((D(f.tax_amount) for f in filings), Decimal(0))
    issues: list[dict] = []
    diff = D(gst["invoiced"]["gst"]) - filed_gst
    if abs(diff) > Decimal("1"):
        issues.append({"severity": "warning", "title": "GST invoiced vs GSTR-3B filed differ",
                       "detail": f"Invoiced ₹{gst['invoiced']['gst']:,.2f}, filed ₹{filed_gst:,.2f}, difference ₹{diff:,.2f}"})

    tds_rows = (await db.execute(select(R.ReTdsEntry).where(R.ReTdsEntry.vendor_id == vendor_id,
                                                           R.ReTdsEntry.deducted_on >= lo, R.ReTdsEntry.deducted_on <= hi))).scalars().all()
    today = date.today()
    tds_by_status: dict[str, float] = defaultdict(float)
    overdue_deposits = []
    for t in tds_rows:
        tds_by_status[t.status] += _f(t.tds_amount)
        if t.status == "pending_deposit" and t.deducted_on and tds_deposit_due(t.deducted_on) < today:
            overdue_deposits.append(t)
    if overdue_deposits:
        issues.append({"severity": "critical", "title": "TDS 194-IA deposit overdue (Form 26QB)",
                       "detail": f"{len(overdue_deposits)} entr{'y' if len(overdue_deposits) == 1 else 'ies'} past the 30-day deposit window"})
    cert_pending = [t for t in tds_rows if t.status == "deposited"]
    if cert_pending:
        issues.append({"severity": "info", "title": "Form 16B not yet received",
                       "detail": f"{len(cert_pending)} deposited entr{'y' if len(cert_pending) == 1 else 'ies'} awaiting certificate"})

    receipts_with_tds = (await db.execute(
        select(func.count()).select_from(R.ReReceipt).where(
            R.ReReceipt.vendor_id == vendor_id, R.ReReceipt.status == "cleared", R.ReReceipt.tds_amount > 0)
    )).scalar_one()
    tds_entries_total = (await db.execute(
        select(func.count()).select_from(R.ReTdsEntry).where(R.ReTdsEntry.vendor_id == vendor_id)
    )).scalar_one()
    if receipts_with_tds != tds_entries_total:
        issues.append({"severity": "warning", "title": "TDS receipts and TDS entries do not match",
                       "detail": f"{receipts_with_tds} receipts carry TDS but {tds_entries_total} TDS entries exist"})

    rera = await rera_account(db, vendor_id)
    for r in rera["projects"]:
        if not r["compliant"] and r["collected"] > 0:
            issues.append({"severity": "critical", "title": f"RERA reserve short — {r['project']}",
                           "detail": f"70% reserve requires ₹{r['required_reserve']:,.2f}; deposited ₹{r['deposited']:,.2f}"})

    no_gl_demands = (await db.execute(select(func.count()).select_from(R.ReDemand).where(
        R.ReDemand.vendor_id == vendor_id, R.ReDemand.status != "cancelled", R.ReDemand.gl_entry_id.is_(None)))).scalar_one()
    no_gl_receipts = (await db.execute(select(func.count()).select_from(R.ReReceipt).where(
        R.ReReceipt.vendor_id == vendor_id, R.ReReceipt.status == "cleared", R.ReReceipt.mode != "adjustment",
        R.ReReceipt.gl_entry_id.is_(None)))).scalar_one()
    open_failures = (await db.execute(select(func.count()).select_from(ReGlFailure).where(
        ReGlFailure.vendor_id == vendor_id, ReGlFailure.status == "open"))).scalar_one()
    if no_gl_demands or no_gl_receipts or open_failures:
        issues.append({"severity": "warning", "title": "Documents not posted to the general ledger",
                       "detail": f"{no_gl_demands} demands and {no_gl_receipts} receipts have no journal entry; {open_failures} posting "
                                 "failures are waiting in Administration → GL Posting Issues (fix Finance account setup, then retry)"})

    return {
        "gst": {"invoiced": gst["invoiced"]["gst"], "received": gst["received"]["gst"], "filed_gstr3b": _f(filed_gst), "difference": _f(diff)},
        "tds": {"by_status": dict(tds_by_status), "entries": len(tds_rows), "overdue_deposits": len(overdue_deposits)},
        "rera": {"non_compliant_projects": rera["non_compliant"]},
        "gl_posting": {"demands_without_journal": no_gl_demands, "receipts_without_journal": no_gl_receipts,
                       "open_failures": open_failures},
        "issues": issues,
    }
