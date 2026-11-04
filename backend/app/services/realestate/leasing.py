"""Leasing & rentals (module 7): tenants, leases, escalation schedule, idempotent rent invoices, deposits and renewals."""
from __future__ import annotations

import uuid
from calendar import monthrange
from datetime import date, timedelta
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
from .postsales import add_months

EPS = Decimal("0.005")
MAX_BACKFILL_MONTHS = 60
COMMERCIAL_USES = ("commercial", "retail", "office", "industrial")


def _f(v: Any) -> float:
    return float(D(v))


def month_first(d: date) -> date:
    return d.replace(day=1)


def month_last(d: date) -> date:
    return d.replace(day=monthrange(d.year, d.month)[1])


def effective_end(lease: O.ReLease) -> date:
    return lease.terminated_on or lease.end_date


def outstanding(doc: Any) -> Decimal:
    return D(doc.total_amount) - D(doc.paid_amount)


# ═══ tenants ════════════════════════════════════════════════════════════════════════════════

async def tenant_before_delete(ctx: Ctx, obj: O.ReTenant) -> None:
    n = (await ctx.db.execute(select(func.count()).select_from(O.ReLease).where(O.ReLease.tenant_id == obj.id))).scalar_one()
    if n:
        raise HTTPException(status_code=409, detail="This tenant has lease records; mark them inactive instead of deleting")


# ═══ lease rules ════════════════════════════════════════════════════════════════════════════

def _validate_terms(d: dict[str, Any]) -> None:
    if d["end_date"] <= d["start_date"]:
        raise HTTPException(status_code=422, detail="The lease must end after it starts")
    if D(d.get("rent_amount")) <= 0:
        raise HTTPException(status_code=422, detail="Monthly rent must be more than zero")
    for k in ("maintenance_charge", "security_deposit"):
        if D(d.get(k)) < 0:
            raise HTTPException(status_code=422, detail=f"{k.replace('_', ' ')} cannot be negative")
    if not 1 <= int(d.get("rent_due_day", 5)) <= 28:
        raise HTTPException(status_code=422, detail="Rent due day must be between 1 and 28")
    if not 0 <= D(d.get("escalation_percent")) <= 100:
        raise HTTPException(status_code=422, detail="Escalation must be between 0% and 100%")
    if int(d.get("escalation_every_months", 12)) < 1:
        raise HTTPException(status_code=422, detail="Escalation interval must be at least 1 month")
    if not 0 <= D(d.get("gst_rate")) <= 28:
        raise HTTPException(status_code=422, detail="GST rate must be between 0% and 28%")
    months = (d["end_date"].year - d["start_date"].year) * 12 + d["end_date"].month - d["start_date"].month + 1
    if int(d.get("lock_in_months") or 0) > months:
        raise HTTPException(status_code=422, detail="Lock-in cannot be longer than the lease")


async def lease_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, data["unit_id"], "unit")
    tenant = await get_owned(ctx.db, O.ReTenant, ctx.vendor_id, data["tenant_id"], "tenant")
    if not tenant.is_active:
        raise HTTPException(status_code=409, detail="This tenant is inactive")
    full = {"rent_due_day": 5, "escalation_every_months": 12, "escalation_percent": 0, "maintenance_charge": 0,
            "security_deposit": 0, "lock_in_months": 0, "gst_rate": 0, **data}
    _validate_terms(full)
    if "gst_rate" not in data and data.get("use_type", "residential") in COMMERCIAL_USES:
        data["gst_rate"] = O.COMMERCIAL_GST_RATE  # letting of commercial property is taxable; residential is exempt
    data.update(project_id=unit.project_id, status="draft", deposit_received=0, deposit_deductions=0, deposit_refunded=0,
                deposit_status="pending")


async def lease_before_update(ctx: Ctx, obj: O.ReLease, data: dict[str, Any]) -> None:
    if "unit_id" in data and data["unit_id"] != obj.unit_id:
        unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, data["unit_id"], "unit")
        data["project_id"] = unit.project_id
    if "tenant_id" in data:
        t = await get_owned(ctx.db, O.ReTenant, ctx.vendor_id, data["tenant_id"], "tenant")
        if not t.is_active:
            raise HTTPException(status_code=409, detail="This tenant is inactive")
    keys = ("start_date", "end_date", "rent_amount", "maintenance_charge", "security_deposit", "rent_due_day", "escalation_percent",
            "escalation_every_months", "gst_rate", "lock_in_months")
    merged = {k: data.get(k, getattr(obj, k)) for k in keys}
    _validate_terms(merged)


async def lease_before_delete(ctx: Ctx, obj: O.ReLease) -> None:
    n = (await ctx.db.execute(select(func.count()).select_from(O.ReRentInvoice).where(O.ReRentInvoice.lease_id == obj.id))).scalar_one()
    if n:
        raise HTTPException(status_code=409, detail="This lease already has invoices")


def rent_steps(lease: O.ReLease) -> list[tuple[date, Decimal, Decimal]]:
    """Step-ups as (effective_on, old_rent, new_rent). Steps fall on the 1st of the month, counted from the start month."""
    out: list[tuple[date, Decimal, Decimal]] = []
    pct = D(lease.escalation_percent)
    every = int(lease.escalation_every_months or 12)
    if pct <= 0:
        return out
    rent, k = money_q(lease.rent_amount), 1
    first = month_first(lease.start_date)
    while True:
        eff = add_months(first, k * every)
        if eff > effective_end(lease):
            break
        new = money_q(rent * (1 + pct / 100))
        out.append((eff, rent, new))
        rent, k = new, k + 1
    return out


def rent_for(lease: O.ReLease, on: date) -> Decimal:
    """Monthly rent in force for the month containing ``on`` (escalation compounds at each step)."""
    rent = money_q(lease.rent_amount)
    for eff, _old, new in rent_steps(lease):
        if eff <= month_first(on):
            rent = new
    return rent


async def _live_overlap(db: AsyncSession, lease: O.ReLease) -> int:
    return (await db.execute(select(func.count()).select_from(O.ReLease).where(
        O.ReLease.unit_id == lease.unit_id, O.ReLease.status == "active", O.ReLease.id != lease.id,
        O.ReLease.start_date <= lease.end_date, O.ReLease.end_date >= lease.start_date))).scalar_one()


async def _free_unit(ctx: Ctx, lease: O.ReLease) -> None:
    others = (await ctx.db.execute(select(func.count()).select_from(O.ReLease).where(
        O.ReLease.unit_id == lease.unit_id, O.ReLease.status == "active", O.ReLease.id != lease.id))).scalar_one()
    unit = await ctx.db.get(C.ReUnit, lease.unit_id)
    if unit is not None and unit.status == "leased" and not others:
        unit.status = "available"


async def lease_activate(ctx: Ctx, lease: O.ReLease) -> O.ReLease:
    if lease.status != "draft":
        raise HTTPException(status_code=409, detail=f"Lease is {lease.status}; only a draft can be activated")
    unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, lease.unit_id, "unit")
    if unit.status not in ("available", "leased"):
        raise HTTPException(status_code=409, detail=f"Unit {unit.unit_number} is {unit.status.replace('_', ' ')}; only available units can be leased")
    if await _live_overlap(ctx.db, lease):
        raise HTTPException(status_code=409, detail="The unit already has an active lease for these dates")
    tenant = await get_owned(ctx.db, O.ReTenant, ctx.vendor_id, lease.tenant_id, "tenant")
    if not tenant.is_active:
        raise HTTPException(status_code=409, detail="This tenant is inactive")
    lease.status, lease.activated_on = "active", date.today()
    unit.status = "leased"
    for eff, old, new in rent_steps(lease):
        ctx.db.add(O.ReLeaseEscalation(id=uuid.uuid4(), vendor_id=ctx.vendor_id, lease_id=lease.id, effective_on=eff,
                                       percent=lease.escalation_percent, old_rent=old, new_rent=new, status="scheduled"))
    if lease.renewed_from_id:
        prev = await ctx.db.get(O.ReLease, lease.renewed_from_id)
        if prev is not None and prev.vendor_id == ctx.vendor_id and prev.status in ("active", "expired"):
            if prev.status == "active":
                prev.status = "renewed"
            held = D(prev.deposit_received) - D(prev.deposit_deductions) - D(prev.deposit_refunded)
            if prev.deposit_status == "held" and held > 0:  # the deposit rolls over to the new lease
                lease.deposit_received = held
                lease.deposit_status = "held" if held + EPS >= D(lease.security_deposit) else "pending"
                prev.deposit_status = "transferred"
    await audit(ctx, "lease", lease.id, "activate", ref=lease.lease_no)
    return lease


async def lease_terminate(ctx: Ctx, lease: O.ReLease, terminated_on: date, reason: str, waive_lock_in: bool) -> dict:
    if lease.status != "active":
        raise HTTPException(status_code=409, detail=f"Lease is {lease.status}; only an active lease can be terminated")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Record the reason for termination")
    if not lease.start_date <= terminated_on <= lease.end_date:
        raise HTTPException(status_code=422, detail="The termination date must fall within the lease term")
    lock_end = add_months(lease.start_date, int(lease.lock_in_months or 0)) - timedelta(days=1) if lease.lock_in_months else None
    if lock_end and terminated_on <= lock_end and not waive_lock_in:
        raise HTTPException(status_code=409, detail=f"The lease is locked in until {lock_end:%d %b %Y}; confirm the lock-in waiver to terminate earlier")
    lease.status, lease.terminated_on, lease.termination_reason = "terminated", terminated_on, reason.strip()[:500]
    await _free_unit(ctx, lease)
    cancelled, kept = 0, 0
    invs = (await ctx.db.execute(select(O.ReRentInvoice).where(
        O.ReRentInvoice.lease_id == lease.id, O.ReRentInvoice.period_start > terminated_on,
        O.ReRentInvoice.status != "cancelled"))).scalars().all()
    for inv in invs:
        if D(inv.paid_amount) > 0:
            kept += 1
            continue
        inv.status = "cancelled"
        await finance_bridge.void_posted(ctx.db, ctx.vendor_id, "invoice", inv.id)
        cancelled += 1
    for e in (await ctx.db.execute(select(O.ReLeaseEscalation).where(
            O.ReLeaseEscalation.lease_id == lease.id, O.ReLeaseEscalation.effective_on > terminated_on,
            O.ReLeaseEscalation.status == "scheduled"))).scalars().all():
        e.status = "cancelled"
    await audit(ctx, "lease", lease.id, "terminate", ref=lease.lease_no,
                changes={"on": terminated_on, "lock_in_waived": waive_lock_in, "invoices_cancelled": cancelled})
    return {"cancelled_invoices": cancelled, "paid_invoices_after_exit": kept}


async def lease_renew(ctx: Ctx, old: O.ReLease, new_end: date, increase_percent: Decimal) -> O.ReLease:
    if old.status not in ("active", "expired"):
        raise HTTPException(status_code=409, detail=f"Lease is {old.status}; only an active or just-expired lease can be renewed")
    if increase_percent < 0 or increase_percent > 100:
        raise HTTPException(status_code=422, detail="Rent increase must be between 0% and 100%")
    start = old.end_date + timedelta(days=1)
    if new_end <= start:
        raise HTTPException(status_code=422, detail=f"The renewal must end after {start:%d %b %Y}")
    dup = (await ctx.db.execute(select(func.count()).select_from(O.ReLease).where(
        O.ReLease.renewed_from_id == old.id, O.ReLease.status.in_(("draft", "active"))))).scalar_one()
    if dup:
        raise HTTPException(status_code=409, detail="A renewal for this lease already exists")
    rent = money_q(rent_for(old, old.end_date) * (1 + increase_percent / 100))
    new = O.ReLease(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, lease_no=await next_number(ctx.db, ctx.vendor_id, "lease"),
        project_id=old.project_id, unit_id=old.unit_id, tenant_id=old.tenant_id, status="draft", use_type=old.use_type,
        start_date=start, end_date=new_end, rent_amount=rent, maintenance_charge=old.maintenance_charge,
        security_deposit=old.security_deposit, deposit_received=0, deposit_deductions=0, deposit_refunded=0, deposit_status="pending",
        rent_due_day=old.rent_due_day, escalation_percent=old.escalation_percent, escalation_every_months=old.escalation_every_months,
        gst_rate=old.gst_rate, lock_in_months=0, notice_period_days=old.notice_period_days, renewed_from_id=old.id,
        notes=f"Renewal of {old.lease_no}")
    ctx.db.add(new)
    await ctx.db.flush()
    await audit(ctx, "lease", new.id, "renew", ref=new.lease_no, changes={"from": old.lease_no, "rent": rent, "increase": increase_percent})
    return new


# ═══ expiry ═════════════════════════════════════════════════════════════════════════════════

async def expire_leases(db: AsyncSession, vendor_id: UUID) -> int:
    rows = (await db.execute(select(O.ReLease).where(
        O.ReLease.vendor_id == vendor_id, O.ReLease.status == "active", O.ReLease.end_date < date.today()))).scalars().all()
    for lease in rows:
        lease.status = "expired"
    await db.flush()
    for lease in rows:
        others = (await db.execute(select(func.count()).select_from(O.ReLease).where(
            O.ReLease.unit_id == lease.unit_id, O.ReLease.status == "active"))).scalar_one()
        unit = await db.get(C.ReUnit, lease.unit_id)
        if unit is not None and unit.status == "leased" and not others:
            unit.status = "available"
    return len(rows)


# ═══ rent invoicing ═════════════════════════════════════════════════════════════════════════

async def _bill_month(ctx: Ctx, lease: O.ReLease, first: date) -> Optional[O.ReRentInvoice]:
    """Create the invoice for one calendar month, or None if it already exists / the lease does not run in it."""
    last = month_last(first)
    start, end = max(first, lease.start_date), min(last, effective_end(lease))
    if start > end:
        return None
    exists = (await ctx.db.execute(select(func.count()).select_from(O.ReRentInvoice).where(
        O.ReRentInvoice.lease_id == lease.id, O.ReRentInvoice.period_start >= first,
        O.ReRentInvoice.period_start <= last))).scalar_one()  # cancelled months stay cancelled (never silently re-billed)
    if exists:
        return None
    days, dim = (end - start).days + 1, last.day
    factor = Decimal(days) / Decimal(dim)
    base = rent_for(lease, first)
    rent = money_q(base * factor)
    maint = money_q(D(lease.maintenance_charge) * factor)
    gst = money_q((rent + maint) * D(lease.gst_rate) / 100)
    due = max(first.replace(day=min(int(lease.rent_due_day or 5), 28)), start)
    inv = O.ReRentInvoice(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, invoice_no=await next_number(ctx.db, ctx.vendor_id, "rent_invoice"),
        lease_id=lease.id, tenant_id=lease.tenant_id, unit_id=lease.unit_id, project_id=lease.project_id,
        period_start=start, period_end=end, due_date=due, days_billed=days, days_in_month=dim, rent_amount=rent,
        maintenance_amount=maint, gst_amount=gst, total_amount=rent + maint + gst, paid_amount=0, status="issued")
    ctx.db.add(inv)
    await ctx.db.flush()
    for e in (await ctx.db.execute(select(O.ReLeaseEscalation).where(
            O.ReLeaseEscalation.lease_id == lease.id, O.ReLeaseEscalation.status == "scheduled",
            O.ReLeaseEscalation.effective_on <= first))).scalars().all():
        e.status = "applied"
    await finance_bridge.post_demand(ctx.db, ctx.vendor_id, demand_id=inv.id, total=inv.total_amount, gst=gst, customer_id=None,
                                     narration=f"Rent {inv.invoice_no}", entry_date=due)
    return inv


async def bill_lease(ctx: Ctx, lease: O.ReLease, upto: date) -> dict:
    if lease.status not in ("active", "expired", "terminated", "renewed"):
        raise HTTPException(status_code=409, detail=f"Lease is {lease.status}; activate it before billing rent")
    cur, last_month = month_first(lease.start_date), month_first(min(upto, effective_end(lease)))
    months = (last_month.year - cur.year) * 12 + last_month.month - cur.month + 1
    if months > MAX_BACKFILL_MONTHS:
        raise HTTPException(status_code=422, detail=f"That would bill {months} months at once; bill in shorter ranges")
    created, skipped = [], 0
    while cur <= last_month:
        inv = await _bill_month(ctx, lease, cur)
        if inv is None:
            skipped += 1
        else:
            created.append({"invoice_no": inv.invoice_no, "period": cur.strftime("%b %Y"), "total": _f(inv.total_amount)})
        cur = add_months(cur, 1)
    await audit(ctx, "lease", lease.id, "bill_rent", ref=lease.lease_no, changes={"created": len(created), "upto": upto})
    return {"created": created, "skipped": skipped}


async def bill_month(ctx: Ctx, month: date) -> dict:
    """Bill one month for every active lease running in it (idempotent: leases already billed are skipped)."""
    first, last = month_first(month), month_last(month)
    leases = (await ctx.db.execute(select(O.ReLease).where(
        O.ReLease.vendor_id == ctx.vendor_id, O.ReLease.status.in_(("active", "renewed", "expired")),
        O.ReLease.start_date <= last, O.ReLease.end_date >= first))).scalars().all()
    created, skipped = [], []
    for lease in leases:
        if lease.terminated_on and lease.terminated_on < first:
            continue
        inv = await _bill_month(ctx, lease, first)
        if inv is None:
            skipped.append(lease.lease_no)
        else:
            created.append({"lease_no": lease.lease_no, "invoice_no": inv.invoice_no, "total": _f(inv.total_amount)})
    await audit(ctx, "rent_invoice", None, "bill_month", ref=first.strftime("%Y-%m"), changes={"created": len(created), "skipped": len(skipped)})
    return {"month": first.strftime("%Y-%m"), "created": created, "skipped": skipped}


async def invoice_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    if set(data) - {"due_date"}:
        raise HTTPException(status_code=409, detail="Only the due date of an invoice can be changed")


async def cancel_invoice(ctx: Ctx, inv: O.ReRentInvoice, reason: str) -> None:
    if inv.status == "cancelled":
        raise HTTPException(status_code=409, detail="Invoice is already cancelled")
    if D(inv.paid_amount) > 0:
        raise HTTPException(status_code=409, detail="Payments were received against this invoice; it cannot be cancelled")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Give a reason")
    inv.status = "cancelled"
    await finance_bridge.void_posted(ctx.db, ctx.vendor_id, "invoice", inv.id)
    await audit(ctx, "rent_invoice", inv.id, "cancel", ref=inv.invoice_no, changes={"reason": reason})


# ═══ receipts (rent and maintenance share one) ══════════════════════════════════════════════

async def receive(ctx: Ctx, doc: Any, kind: str, amount: Decimal, paid_on: date, mode: str, reference: Optional[str]) -> O.ReOpsReceipt:
    if doc.status not in ("issued", "partial"):
        raise HTTPException(status_code=409, detail=f"This invoice is {doc.status}; nothing to collect")
    amount = money_q(amount)
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Enter an amount above zero")
    if amount > outstanding(doc) + EPS:
        raise HTTPException(status_code=409, detail=f"₹{amount:,.2f} is more than the ₹{outstanding(doc):,.2f} outstanding")
    if paid_on > date.today():
        raise HTTPException(status_code=422, detail="The payment date cannot be in the future")
    if mode not in O.RENT_PAYMENT_MODES:
        raise HTTPException(status_code=422, detail=f"Payment mode must be one of: {', '.join(O.RENT_PAYMENT_MODES)}")
    r = O.ReOpsReceipt(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, receipt_no=await next_number(ctx.db, ctx.vendor_id, "ops_receipt"), kind=kind,
        rent_invoice_id=doc.id if kind == "rent" else None, maintenance_bill_id=doc.id if kind == "maintenance" else None,
        amount=amount, paid_on=paid_on, mode=mode, reference=reference)
    ctx.db.add(r)
    doc.paid_amount = D(doc.paid_amount) + amount
    doc.status = "paid" if outstanding(doc) <= EPS else "partial"
    await ctx.db.flush()
    if mode != "adjustment":  # a deposit adjustment moves no cash
        await finance_bridge.post_receipt(ctx.db, ctx.vendor_id, receipt_id=r.id, amount=amount, customer_id=None,
                                          narration=f"{kind.title()} receipt {r.receipt_no}", entry_date=paid_on)
    await audit(ctx, "ops_receipt", r.id, "create", ref=r.receipt_no, changes={"kind": kind, "amount": amount})
    return r


# ═══ security deposit ═══════════════════════════════════════════════════════════════════════

async def deposit_receive(ctx: Ctx, lease: O.ReLease, amount: Decimal, paid_on: date, mode: str, reference: Optional[str]) -> dict:
    if lease.status not in ("draft", "active"):
        raise HTTPException(status_code=409, detail=f"Lease is {lease.status}; a deposit can no longer be received")
    amount = money_q(amount)
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Enter an amount above zero")
    if D(lease.deposit_received) + amount > D(lease.security_deposit) + EPS:
        raise HTTPException(status_code=409, detail=f"The agreed deposit is ₹{D(lease.security_deposit):,.2f}; ₹{D(lease.deposit_received):,.2f} is already received")
    if mode not in O.RENT_PAYMENT_MODES or mode == "adjustment":
        raise HTTPException(status_code=422, detail="Choose how the deposit was paid")
    lease.deposit_received = D(lease.deposit_received) + amount
    lease.deposit_status = "held" if D(lease.deposit_received) + EPS >= D(lease.security_deposit) else "pending"
    await audit(ctx, "lease", lease.id, "deposit_received", ref=lease.lease_no, changes={"amount": amount, "mode": mode, "reference": reference, "on": paid_on})
    return {"received": _f(lease.deposit_received), "agreed": _f(lease.security_deposit), "status": lease.deposit_status}


async def deposit_refund(ctx: Ctx, lease: O.ReLease, deductions: Decimal, reason: str, adjust_dues: bool) -> dict:
    if lease.status not in ("expired", "terminated", "renewed"):
        raise HTTPException(status_code=409, detail="The deposit is refunded after the lease has ended")
    if lease.deposit_status != "held":
        raise HTTPException(status_code=409, detail=f"Deposit is {lease.deposit_status}; nothing to refund")
    deductions = money_q(deductions)
    if deductions < 0:
        raise HTTPException(status_code=422, detail="Deductions cannot be negative")
    if deductions > 0 and not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Explain the deductions")
    balance = D(lease.deposit_received) - D(lease.deposit_deductions) - D(lease.deposit_refunded)
    if deductions > balance + EPS:
        raise HTTPException(status_code=409, detail=f"Deductions exceed the ₹{balance:,.2f} held")
    adjusted = Decimal(0)
    if adjust_dues:
        left = balance - deductions
        invs = (await ctx.db.execute(select(O.ReRentInvoice).where(
            O.ReRentInvoice.lease_id == lease.id, O.ReRentInvoice.status.in_(("issued", "partial")))
            .order_by(O.ReRentInvoice.due_date))).scalars().all()
        for inv in invs:
            if left <= EPS:
                break
            pay = min(left, outstanding(inv))
            await receive(ctx, inv, "rent", pay, date.today(), "adjustment", f"Deposit adjustment {lease.lease_no}")
            left -= pay
            adjusted += pay
    refund = balance - deductions - adjusted
    lease.deposit_deductions = D(lease.deposit_deductions) + deductions + adjusted
    lease.deposit_refunded = D(lease.deposit_refunded) + refund
    lease.deposit_status = "refunded"
    await audit(ctx, "lease", lease.id, "deposit_refund", ref=lease.lease_no,
                changes={"refund": refund, "deductions": deductions, "adjusted_against_dues": adjusted, "reason": reason})
    return {"refund": _f(refund), "deductions": _f(deductions), "adjusted_against_dues": _f(adjusted)}


# ═══ views ══════════════════════════════════════════════════════════════════════════════════

def _age_bucket(days: int) -> str:
    return "current" if days <= 0 else "1-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"


async def renewals(db: AsyncSession, vendor_id: UUID, days: int = 90) -> list[dict]:
    horizon = date.today() + timedelta(days=days)
    leases = (await db.execute(select(O.ReLease).where(
        O.ReLease.vendor_id == vendor_id, O.ReLease.status.in_(("active", "expired")), O.ReLease.end_date <= horizon)
        .order_by(O.ReLease.end_date))).scalars().all()
    out = []
    for ls in leases:
        if ls.status == "expired" and (date.today() - ls.end_date).days > 60:
            continue  # long gone; not a renewal candidate any more
        nxt = (await db.execute(select(O.ReLease).where(
            O.ReLease.renewed_from_id == ls.id, O.ReLease.status.in_(("draft", "active"))).limit(1))).scalar_one_or_none()
        tenant, unit = await db.get(O.ReTenant, ls.tenant_id), await db.get(C.ReUnit, ls.unit_id)
        left = (ls.end_date - date.today()).days
        out.append({
            "lease_id": str(ls.id), "lease_no": ls.lease_no, "tenant": tenant.name if tenant else "", "unit": unit.unit_number if unit else "",
            "end_date": ls.end_date.isoformat(), "days_left": left, "current_rent": _f(rent_for(ls, ls.end_date)),
            "status": ls.status, "renewal": (nxt.lease_no if nxt else None),
            "stage": "renewal_in_progress" if nxt else ("overdue" if left < 0 else "notice_due" if left <= int(ls.notice_period_days or 30) else "upcoming"),
        })
    return out


async def summary(db: AsyncSession, vendor_id: UUID) -> dict:
    await expire_leases(db, vendor_id)
    today = date.today()
    leases = (await db.execute(select(O.ReLease).where(O.ReLease.vendor_id == vendor_id))).scalars().all()
    by_status: dict[str, int] = {}
    for ls in leases:
        by_status[ls.status] = by_status.get(ls.status, 0) + 1
    active = [ls for ls in leases if ls.status == "active"]
    roll = sum(rent_for(ls, today) + D(ls.maintenance_charge) for ls in active)
    held = sum(D(ls.deposit_received) - D(ls.deposit_deductions) - D(ls.deposit_refunded)
               for ls in leases if ls.deposit_status == "held")
    invs = (await db.execute(select(O.ReRentInvoice).where(
        O.ReRentInvoice.vendor_id == vendor_id, O.ReRentInvoice.status.in_(("issued", "partial"))))).scalars().all()
    buckets = {"current": Decimal(0), "1-30": Decimal(0), "31-60": Decimal(0), "61-90": Decimal(0), "90+": Decimal(0)}
    tenants: dict[Any, Decimal] = {}
    for i in invs:
        out = outstanding(i)
        buckets[_age_bucket((today - i.due_date).days)] += out
        tenants[i.tenant_id] = tenants.get(i.tenant_id, Decimal(0)) + out
    overdue = sum(v for k, v in buckets.items() if k != "current")
    top = []
    for tid, amt in sorted(tenants.items(), key=lambda kv: -kv[1])[:10]:
        t = await db.get(O.ReTenant, tid) if tid else None
        top.append({"tenant": t.name if t else "—", "outstanding": _f(amt)})
    ren = await renewals(db, vendor_id, 90)
    return {
        "leases_by_status": by_status, "active_leases": len(active), "monthly_rent_roll": _f(roll), "deposits_held": _f(held),
        "receivable": _f(sum(outstanding(i) for i in invs)), "overdue": _f(overdue),
        "aging": {k: _f(v) for k, v in buckets.items()}, "top_arrears": top, "renewals": ren,
        "expiring_90d": len([r for r in ren if r["status"] == "active"]),
    }
