"""Module 6 — payment schedule, demands, receipts, overdue tracking and collection reports."""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import receivables as R

from . import finance_bridge as gl
from . import messaging
from .common import Ctx, D, audit, get_owned, jsonable, money_q, next_number, notify, row_dict
from .pricing import TDS_194IA_RATE, TDS_194IA_THRESHOLD, tds_194ia
from .templates import render_template

RERA_PRE_AGREEMENT_CAP_PERCENT = Decimal(10)  # RERA s.13(1): max 10% advance before a registered agreement for sale
MILESTONE_NOTICE_DAYS = 15
CLEARING_MODES = ("cheque", "dd")  # need bank clearance before they count
ACTIVE_BOOKING = ("confirmed", "allotted", "agreement_signed", "registered", "handed_over")
PRE_AGREEMENT = ("confirmed", "allotted")
_TRIGGER_REACHED = {
    "on_agreement": ("agreement_signed", "registered", "handed_over"),
    "on_registration": ("registered", "handed_over"),
    "on_possession": ("handed_over",),
}
_STAGE_TRIGGERS = {
    "agreement_signed": ("on_agreement",),
    "registered": ("on_agreement", "on_registration"),
    "handed_over": ("on_agreement", "on_registration", "on_possession"),
}
EPS = Decimal("0.005")


def _f(v: Any) -> float:
    return float(D(v))


def payable_total(booking) -> Decimal:
    """What the developer collects through the payment schedule (agreement value + GST)."""
    return money_q(D(booking.agreement_value) + D(booking.gst_amount))


# ═══ schedule ═══════════════════════════════════════════════════════════════════════════════

async def _stages_for(db: AsyncSession, vendor_id: UUID, booking, plan_id: Optional[UUID] = None):
    pid = plan_id or booking.payment_plan_id
    plan = None
    if pid:
        plan = await get_owned(db, C.RePaymentPlan, vendor_id, pid, "payment plan")
    else:
        for cond in (C.RePaymentPlan.project_id == booking.project_id, C.RePaymentPlan.project_id.is_(None)):
            plan = (
                await db.execute(
                    select(C.RePaymentPlan)
                    .where(C.RePaymentPlan.vendor_id == vendor_id, cond, C.RePaymentPlan.is_default.is_(True),
                           C.RePaymentPlan.is_active.is_(True))
                    .limit(1)
                )
            ).scalars().first()
            if plan is not None:
                break
    if plan is None:
        return None, []
    stages = (
        await db.execute(
            select(C.RePaymentPlanStage).where(C.RePaymentPlanStage.plan_id == plan.id).order_by(C.RePaymentPlanStage.seq)
        )
    ).scalars().all()
    return plan, list(stages)


def _initial_state(booking, st) -> tuple[Optional[date], str, Optional[date]]:
    t = st.trigger_type
    bdate = booking.booking_date or date.today()
    if t == "on_booking":
        return bdate, "due", None
    if t in ("days_after_booking", "fixed_date"):
        return bdate + timedelta(days=int(st.trigger_days or 0)), "due", None
    if booking.status in _TRIGGER_REACHED.get(t, ()):
        return date.today() + timedelta(days=MILESTONE_NOTICE_DAYS), "due", date.today()
    return None, "scheduled", None


async def generate_schedule(ctx: Ctx, booking, plan_id: Optional[UUID] = None) -> list[R.ReScheduleItem]:
    """(Re)build the instalment schedule from the payment plan. Refused once demands or receipts exist."""
    existing = (
        await ctx.db.execute(select(R.ReScheduleItem).where(R.ReScheduleItem.booking_id == booking.id))
    ).scalars().all()
    if any(i.demand_id or D(i.paid_amount) > 0 for i in existing):
        raise HTTPException(status_code=409, detail="The schedule already has demands or payments and cannot be regenerated")
    plan, stages = await _stages_for(ctx.db, ctx.vendor_id, booking, plan_id)
    if plan is not None and plan_id:
        booking.payment_plan_id = plan.id
    if not stages:
        stages = [SimpleNamespace(seq=1, name="Full consideration", percent=Decimal(100),
                                  trigger_type="days_after_booking", trigger_days=30, milestone_name=None)]
    total_pct = sum((D(s.percent) for s in stages), Decimal(0))
    if abs(total_pct - 100) > Decimal("0.001"):
        raise HTTPException(
            status_code=422,
            detail=f"Payment plan '{plan.name if plan else 'default'}' stages add up to {total_pct}%; they must total 100%",
        )
    for i in existing:
        await ctx.db.delete(i)
    await ctx.db.flush()

    agreement, gst_total = D(booking.agreement_value), D(booking.gst_amount)
    used_amt = used_gst = Decimal(0)
    items: list[R.ReScheduleItem] = []
    for idx, st in enumerate(stages):
        last = idx == len(stages) - 1
        amt = agreement - used_amt if last else money_q(agreement * D(st.percent) / 100)
        gst = gst_total - used_gst if last else money_q(amt * D(booking.gst_rate) / 100)
        used_amt += amt
        used_gst += gst
        due, status, trig = _initial_state(booking, st)
        item = R.ReScheduleItem(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, booking_id=booking.id, seq=idx + 1, name=st.name,
            percent=D(st.percent), trigger_type=st.trigger_type, trigger_days=int(st.trigger_days or 0),
            milestone_name=getattr(st, "milestone_name", None), due_date=due, amount=amt, gst_amount=gst,
            total_due=amt + gst, paid_amount=Decimal(0), status=status, triggered_on=trig,
        )
        ctx.db.add(item)
        items.append(item)
    await ctx.db.flush()
    await audit(ctx, "booking", booking.id, "schedule", ref=booking.booking_no, changes={"stages": len(items)})
    return items


async def _items(db: AsyncSession, booking_id: UUID) -> list[R.ReScheduleItem]:
    return list(
        (await db.execute(select(R.ReScheduleItem).where(R.ReScheduleItem.booking_id == booking_id).order_by(R.ReScheduleItem.seq))).scalars().all()
    )


async def trigger_stage(ctx: Ctx, booking, trigger_types: tuple[str, ...], milestone_name: Optional[str] = None) -> list[R.ReScheduleItem]:
    """Make 'scheduled' instalments due when their trigger is reached (agreement, registration, milestone ...)."""
    n: list[R.ReScheduleItem] = []
    for it in await _items(ctx.db, booking.id):
        if it.status != "scheduled" or it.trigger_type not in trigger_types:
            continue
        if it.trigger_type == "milestone" and (milestone_name or "").strip().lower() != (it.milestone_name or "").strip().lower():
            continue
        it.status = "due"
        it.triggered_on = date.today()
        it.due_date = date.today() + timedelta(days=MILESTONE_NOTICE_DAYS)
        n.append(it)
    if n:
        await ctx.db.flush()
    return n


async def trigger_milestone(ctx: Ctx, project_id: UUID, milestone_name: str) -> dict:
    """Milestone completed on site: every booking waiting on it becomes due and gets its demand letter."""
    bookings = (
        await ctx.db.execute(
            select(C.ReBooking).where(C.ReBooking.vendor_id == ctx.vendor_id, C.ReBooking.project_id == project_id,
                                      C.ReBooking.status.in_(ACTIVE_BOOKING))
        )
    ).scalars().all()
    triggered, demands, skipped = 0, 0, []
    for b in bookings:
        hit = await trigger_stage(ctx, b, ("milestone",), milestone_name)
        if hit:
            triggered += len(hit)
            res = await _demand_items(ctx, b, hit)
            demands += len(res["created"])
            skipped.extend(res["skipped"])
    return {"bookings": len(bookings), "instalments_triggered": triggered, "demands_created": demands, "skipped": skipped}


async def on_booking_stage(ctx: Ctx, booking, stage: str) -> None:
    """Called when a booking reaches agreement_signed / registered / handed_over."""
    from .commissions import refresh_eligibility

    hit = await trigger_stage(ctx, booking, _STAGE_TRIGGERS.get(stage, ()))
    await _demand_items(ctx, booking, hit)
    await generate_demands(ctx, booking_id=booking.id)
    await refresh_eligibility(ctx, booking)


# ═══ demands ════════════════════════════════════════════════════════════════════════════════

async def _demanded_total(db: AsyncSession, booking_id: UUID) -> Decimal:
    return D(
        (await db.execute(
            select(func.coalesce(func.sum(R.ReDemand.total_amount), 0)).where(
                R.ReDemand.booking_id == booking_id, R.ReDemand.status != "cancelled")
        )).scalar_one()
    )


async def _interest_rate(db: AsyncSession, booking) -> Decimal:
    project = await db.get(C.ReProject, booking.project_id)
    return D(project.delay_interest_rate) if project is not None else Decimal(0)


def _fmt(v: Any) -> str:
    return f"{D(v):,.2f}"


async def create_demand(ctx: Ctx, booking, item: R.ReScheduleItem, *, due_date: Optional[date] = None) -> R.ReDemand:
    if booking.status not in ACTIVE_BOOKING:
        raise HTTPException(status_code=409, detail=f"Booking is {booking.status}")
    if item.status != "due":
        raise HTTPException(status_code=409, detail=f"Instalment '{item.name}' is {item.status}, only 'due' instalments can be demanded")
    if booking.status in PRE_AGREEMENT:
        cap = money_q(payable_total(booking) * RERA_PRE_AGREEMENT_CAP_PERCENT / 100)
        if await _demanded_total(ctx.db, booking.id) + D(item.total_due) > cap + EPS:
            raise HTTPException(
                status_code=409,
                detail=(f"RERA s.13: no more than {RERA_PRE_AGREEMENT_CAP_PERCENT}% (₹{cap:,.2f}) may be demanded before the "
                        "agreement for sale is signed"),
            )
    from .booking import booking_context

    demand_no = await next_number(ctx.db, ctx.vendor_id, "demand")
    due = due_date or item.due_date or date.today()
    demand = R.ReDemand(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, demand_no=demand_no, booking_id=booking.id,
        customer_id=booking.customer_id, schedule_item_id=item.id, stage_name=item.name,
        demand_date=date.today(), due_date=due, amount=item.amount, gst_amount=item.gst_amount,
        total_amount=item.total_due, paid_amount=Decimal(0), status="issued", issued_at=_now(),
    )
    values = await booking_context(ctx.db, booking)
    values.update({
        "demand_no": demand_no, "stage_name": item.name, "due_date": due.strftime("%d %b %Y"),
        "amount": _fmt(item.amount), "gst_amount": _fmt(item.gst_amount), "interest": "0.00",
        "total": _fmt(item.total_due), "interest_rate": f"{await _interest_rate(ctx.db, booking):g}",
    })
    demand.letter_html = (await render_template(ctx.db, ctx.vendor_id, "demand_letter", values))["html"]
    ctx.db.add(demand)
    item.demand_id = demand.id
    item.status = "demanded"
    await ctx.db.flush()
    demand.gl_entry_id = await gl.post_demand(
        ctx.db, ctx.vendor_id, demand_id=demand.id, total=demand.total_amount, gst=demand.gst_amount,
        customer_id=None, narration=f"Demand {demand_no} · {booking.booking_no} · {item.name}", entry_date=demand.demand_date,
    )
    await apply_unallocated(ctx.db, booking)
    await audit(ctx, "demand", demand.id, "issue", ref=demand_no, changes={"total": demand.total_amount, "due": due})
    await notify(ctx.db, ctx.vendor_id, "Demand issued", f"{demand_no} for {booking.booking_no} ({item.name}) due {due:%d %b %Y}.",
                 reference_type="demand", reference_id=demand.id)
    await messaging.on_demand_issued(ctx.db, ctx.vendor_id, booking, demand)
    return demand


async def generate_demands(
    ctx: Ctx, *, booking_id: Optional[UUID] = None, project_id: Optional[UUID] = None,
    as_of: Optional[date] = None, advance_days: int = 0,
) -> dict[str, list]:
    """Raise demands for every 'due' instalment whose due date has arrived (idempotent)."""
    horizon = (as_of or date.today()) + timedelta(days=max(0, advance_days))
    q = (
        select(R.ReScheduleItem, C.ReBooking)
        .join(C.ReBooking, C.ReBooking.id == R.ReScheduleItem.booking_id)
        .where(R.ReScheduleItem.vendor_id == ctx.vendor_id, R.ReScheduleItem.status == "due",
               R.ReScheduleItem.due_date.is_not(None), R.ReScheduleItem.due_date <= horizon,
               C.ReBooking.status.in_(ACTIVE_BOOKING))
        .order_by(C.ReBooking.booking_no, R.ReScheduleItem.seq)
    )
    if booking_id:
        q = q.where(R.ReScheduleItem.booking_id == booking_id)
    if project_id:
        q = q.where(C.ReBooking.project_id == project_id)
    created, skipped = [], []
    for item, booking in (await ctx.db.execute(q)).all():
        try:
            async with ctx.db.begin_nested():
                demand = await create_demand(ctx, booking, item)
            created.append({"id": str(demand.id), "demand_no": demand.demand_no, "booking_no": booking.booking_no,
                            "total": _f(demand.total_amount)})
        except HTTPException as exc:
            skipped.append({"booking_no": booking.booking_no, "stage": item.name, "reason": str(exc.detail)})
    return {"created": created, "skipped": skipped}


async def _demand_items(ctx: Ctx, booking, items: list[R.ReScheduleItem]) -> dict[str, list]:
    """Issue demands right away for instalments that just fell due (the customer gets the notice period)."""
    created, skipped = [], []
    for item in items:
        try:
            async with ctx.db.begin_nested():
                demand = await create_demand(ctx, booking, item)
            created.append({"id": str(demand.id), "demand_no": demand.demand_no, "booking_no": booking.booking_no,
                            "total": _f(demand.total_amount)})
        except HTTPException as exc:
            skipped.append({"booking_no": booking.booking_no, "stage": item.name, "reason": str(exc.detail)})
    return {"created": created, "skipped": skipped}


async def cancel_demand(ctx: Ctx, demand: R.ReDemand, reason: str = "") -> R.ReDemand:
    if demand.status == "cancelled":
        raise HTTPException(status_code=409, detail="Demand is already cancelled")
    if D(demand.paid_amount) > 0:
        raise HTTPException(status_code=409, detail="A demand with payments allocated cannot be cancelled")
    demand.status = "cancelled"
    demand.remarks = (reason or demand.remarks or "")[:500] or None
    if demand.schedule_item_id:
        item = await ctx.db.get(R.ReScheduleItem, demand.schedule_item_id)
        if item is not None and item.demand_id == demand.id:
            item.demand_id = None
            item.status = "due"
    await gl.void_posted(ctx.db, ctx.vendor_id, "invoice", demand.id)
    await audit(ctx, "demand", demand.id, "cancel", ref=demand.demand_no, changes={"reason": reason})
    return demand


# ═══ receipts & allocation ══════════════════════════════════════════════════════════════════

def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


async def _alloc_sums(db: AsyncSession, booking_id: UUID):
    rows = (
        await db.execute(
            select(R.ReReceiptAllocation.receipt_id, R.ReReceiptAllocation.demand_id, func.sum(R.ReReceiptAllocation.amount))
            .join(R.ReReceipt, R.ReReceipt.id == R.ReReceiptAllocation.receipt_id)
            .where(R.ReReceipt.booking_id == booking_id)
            .group_by(R.ReReceiptAllocation.receipt_id, R.ReReceiptAllocation.demand_id)
        )
    ).all()
    by_receipt: dict[UUID, Decimal] = defaultdict(Decimal)
    by_demand: dict[UUID, Decimal] = defaultdict(Decimal)
    for rid, did, amt in rows:
        by_receipt[rid] += D(amt)
        by_demand[did] += D(amt)
    return by_receipt, by_demand


async def apply_unallocated(db: AsyncSession, booking) -> None:
    """Allocate cleared receipt money to open demands, oldest due date first (advances wait for future demands)."""
    receipts = (
        await db.execute(
            select(R.ReReceipt).where(R.ReReceipt.booking_id == booking.id, R.ReReceipt.status == "cleared")
            .order_by(R.ReReceipt.receipt_date, R.ReReceipt.created_at)
        )
    ).scalars().all()
    demands = (
        await db.execute(
            select(R.ReDemand).where(R.ReDemand.booking_id == booking.id, R.ReDemand.status != "cancelled")
            .order_by(R.ReDemand.due_date, R.ReDemand.created_at)
        )
    ).scalars().all()
    by_receipt, by_demand = await _alloc_sums(db, booking.id)
    for r in receipts:
        avail = D(r.gross_amount) - by_receipt[r.id]
        for d in demands:
            if avail <= EPS:
                break
            need = D(d.total_amount) - by_demand[d.id]
            if need <= EPS:
                continue
            amt = min(avail, need)
            db.add(R.ReReceiptAllocation(
                id=uuid.uuid4(), vendor_id=booking.vendor_id, receipt_id=r.id, demand_id=d.id,
                schedule_item_id=d.schedule_item_id, amount=amt, allocated_on=date.today(),
            ))
            avail -= amt
            by_receipt[r.id] += amt
            by_demand[d.id] += amt
    await db.flush()
    await recompute_booking(db, booking)


async def recompute_booking(db: AsyncSession, booking) -> None:
    """Rebuild every paid/status roll-up from receipts and allocations (idempotent)."""
    by_receipt, by_demand = await _alloc_sums(db, booking.id)
    receipts = (await db.execute(select(R.ReReceipt).where(R.ReReceipt.booking_id == booking.id))).scalars().all()
    paid = Decimal(0)
    for r in receipts:
        r.allocated_amount = by_receipt.get(r.id, Decimal(0))
        if r.status == "cleared":
            paid += D(r.gross_amount)
    booking.paid_amount = money_q(paid)
    demands = (await db.execute(select(R.ReDemand).where(R.ReDemand.booking_id == booking.id))).scalars().all()
    by_item: dict[UUID, R.ReDemand] = {}
    for d in demands:
        d.paid_amount = by_demand.get(d.id, Decimal(0))
        if d.status != "cancelled":
            d.status = "paid" if D(d.paid_amount) >= D(d.total_amount) - EPS else "partial" if D(d.paid_amount) > EPS else "issued"
            if d.schedule_item_id:
                by_item[d.schedule_item_id] = d
    for it in await _items(db, booking.id):
        d = by_item.get(it.id)
        if d is not None:
            it.paid_amount = d.paid_amount
            it.status = d.status if d.status in ("paid", "partial") else "demanded"
    await db.flush()


def tds_suggestion(booking, payment: Decimal | float) -> Decimal:
    return tds_194ia(D(booking.agreement_value), D(payment))


async def lock_booking(db: AsyncSession, booking) -> None:
    """Take a row lock on the booking and reload it, so money checks see every receipt already committed."""
    await db.execute(select(C.ReBooking).where(C.ReBooking.id == booking.id).with_for_update()
                     .execution_options(populate_existing=True))


async def record_receipt(
    ctx: Ctx, booking, *, amount: Decimal | float, mode: str, receipt_date: Optional[date] = None,
    reference_no: Optional[str] = None, bank_name: Optional[str] = None, instrument_date: Optional[date] = None,
    tds_amount: Decimal | float = 0, remarks: Optional[str] = None,
) -> tuple[R.ReReceipt, list[str]]:
    await lock_booking(ctx.db, booking)  # serialise receipts per booking so two cannot both pass the balance check
    if booking.status not in ACTIVE_BOOKING:
        raise HTTPException(status_code=409, detail=f"Receipts cannot be recorded for a {booking.status} booking")
    if mode not in C.PAYMENT_MODES:
        raise HTTPException(status_code=422, detail=f"mode must be one of {', '.join(C.PAYMENT_MODES)}")
    amt, tds = money_q(D(amount)), money_q(D(tds_amount))
    if amt <= 0:
        raise HTTPException(status_code=422, detail="amount must be greater than zero")
    if tds < 0:
        raise HTTPException(status_code=422, detail="tds_amount cannot be negative")
    gross = amt + tds
    pending = D((await ctx.db.execute(
        select(func.coalesce(func.sum(R.ReReceipt.gross_amount), 0)).where(
            R.ReReceipt.booking_id == booking.id, R.ReReceipt.status == "received")
    )).scalar_one())
    balance = payable_total(booking) - D(booking.paid_amount) - pending
    if gross > balance + EPS:
        raise HTTPException(status_code=409, detail=f"Receipt of ₹{gross:,.2f} exceeds the balance payable (₹{max(balance, Decimal(0)):,.2f})")

    warnings: list[str] = []
    if tds > 0 and D(booking.agreement_value) < TDS_194IA_THRESHOLD:
        warnings.append("TDS u/s 194-IA applies only when the consideration is ₹50 lakh or more")
    if booking.status in PRE_AGREEMENT:
        cap = money_q(payable_total(booking) * RERA_PRE_AGREEMENT_CAP_PERCENT / 100)
        if D(booking.paid_amount) + pending + gross > cap + EPS:
            warnings.append(
                f"RERA s.13: more than {RERA_PRE_AGREEMENT_CAP_PERCENT}% is being accepted before the agreement for sale is registered"
            )

    clears_now = mode not in CLEARING_MODES
    receipt = R.ReReceipt(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, receipt_no=await next_number(ctx.db, ctx.vendor_id, "receipt"),
        booking_id=booking.id, customer_id=booking.customer_id, receipt_date=receipt_date or date.today(),
        amount=amt, tds_amount=tds, gross_amount=gross, mode=mode, reference_no=reference_no, bank_name=bank_name,
        instrument_date=instrument_date, status="cleared" if clears_now else "received",
        cleared_on=(receipt_date or date.today()) if clears_now else None, allocated_amount=Decimal(0), remarks=remarks,
    )
    ctx.db.add(receipt)
    await ctx.db.flush()
    if clears_now:
        await _on_cleared(ctx, booking, receipt)
    await audit(ctx, "receipt", receipt.id, "create", ref=receipt.receipt_no, changes={"amount": amt, "mode": mode, "status": receipt.status})
    return receipt, warnings


async def _on_cleared(ctx: Ctx, booking, receipt: R.ReReceipt) -> None:
    from .commissions import refresh_eligibility

    if D(receipt.tds_amount) > 0:
        customer = await ctx.db.get(C.ReCustomer, booking.customer_id)
        ctx.db.add(R.ReTdsEntry(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, booking_id=booking.id, customer_id=booking.customer_id,
            receipt_id=receipt.id, buyer_pan=getattr(customer, "pan", None), consideration=receipt.gross_amount,
            tds_percent=TDS_194IA_RATE, tds_amount=receipt.tds_amount, deducted_on=receipt.receipt_date,
            status="pending_deposit",
        ))
    if receipt.mode != "adjustment":
        receipt.gl_entry_id = await gl.post_receipt(
            ctx.db, ctx.vendor_id, receipt_id=receipt.id, amount=receipt.amount, customer_id=None,
            narration=f"Receipt {receipt.receipt_no} · {booking.booking_no}", entry_date=receipt.receipt_date,
        )
    await apply_unallocated(ctx.db, booking)
    await refresh_eligibility(ctx, booking)
    if receipt.mode != "adjustment":
        await messaging.on_receipt_cleared(ctx.db, ctx.vendor_id, booking, receipt)


async def clear_receipt(ctx: Ctx, receipt: R.ReReceipt, cleared_on: Optional[date] = None) -> R.ReReceipt:
    if receipt.status != "received":
        raise HTTPException(status_code=409, detail=f"Receipt is {receipt.status}")
    booking = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, receipt.booking_id, "booking")
    await lock_booking(ctx.db, booking)
    if receipt.status != "received":  # cleared / cancelled by someone else while we waited for the lock
        await ctx.db.refresh(receipt)
        if receipt.status != "received":
            raise HTTPException(status_code=409, detail=f"Receipt is {receipt.status}")
    if booking.status not in ACTIVE_BOOKING:
        raise HTTPException(status_code=409, detail=f"Booking is {booking.status}")
    receipt.status = "cleared"
    receipt.cleared_on = cleared_on or date.today()
    await ctx.db.flush()
    await _on_cleared(ctx, booking, receipt)
    await audit(ctx, "receipt", receipt.id, "clear", ref=receipt.receipt_no)
    return receipt


async def bounce_receipt(ctx: Ctx, receipt: R.ReReceipt, reason: str) -> R.ReReceipt:
    if receipt.status != "received":
        raise HTTPException(status_code=409, detail="Only receipts awaiting clearance can be marked bounced")
    receipt.status = "bounced"
    receipt.remarks = f"Bounced: {reason}"[:500]
    await audit(ctx, "receipt", receipt.id, "bounce", ref=receipt.receipt_no, changes={"reason": reason})
    await notify(ctx.db, ctx.vendor_id, "Cheque bounced", f"Receipt {receipt.receipt_no} ({receipt.reference_no or receipt.mode}) bounced: {reason}",
                 reference_type="receipt", reference_id=receipt.id)
    return receipt


async def cancel_receipt(ctx: Ctx, receipt: R.ReReceipt, reason: str) -> R.ReReceipt:
    if receipt.status != "received":
        raise HTTPException(status_code=409, detail="Cleared receipts cannot be cancelled — use refund or adjustment instead")
    receipt.status = "cancelled"
    receipt.remarks = f"Cancelled: {reason}"[:500]
    await audit(ctx, "receipt", receipt.id, "cancel", ref=receipt.receipt_no, changes={"reason": reason})
    return receipt


async def receipt_letter(db: AsyncSession, vendor_id: UUID, receipt: R.ReReceipt) -> dict:
    from .booking import booking_context

    booking = await db.get(C.ReBooking, receipt.booking_id)
    values = await booking_context(db, booking)
    values.update({
        "receipt_no": receipt.receipt_no, "amount": _fmt(receipt.gross_amount), "mode": receipt.mode.upper(),
        "reference_no": receipt.reference_no or "-", "date": receipt.receipt_date.strftime("%d %b %Y"),
    })
    return await render_template(db, vendor_id, "payment_receipt", values)


# ═══ summaries & overdue ════════════════════════════════════════════════════════════════════

async def _open_demands(db: AsyncSession, vendor_id: UUID, *, project_id: Optional[UUID] = None, booking_id: Optional[UUID] = None):
    q = (
        select(R.ReDemand, C.ReBooking)
        .join(C.ReBooking, C.ReBooking.id == R.ReDemand.booking_id)
        .where(R.ReDemand.vendor_id == vendor_id, R.ReDemand.status.in_(("issued", "partial")))
    )
    if project_id:
        q = q.where(C.ReBooking.project_id == project_id)
    if booking_id:
        q = q.where(R.ReDemand.booking_id == booking_id)
    return (await db.execute(q)).all()


def _bucket(days: int) -> str:
    return "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"


async def booking_finance_summary(db: AsyncSession, booking) -> dict:
    items = await _items(db, booking.id)
    demands = (await db.execute(select(R.ReDemand).where(R.ReDemand.booking_id == booking.id).order_by(R.ReDemand.demand_date))).scalars().all()
    receipts = (await db.execute(select(R.ReReceipt).where(R.ReReceipt.booking_id == booking.id).order_by(R.ReReceipt.receipt_date))).scalars().all()
    payable = payable_total(booking)
    live = [d for d in demands if d.status != "cancelled"]
    demanded = sum((D(d.total_amount) for d in live), Decimal(0))
    outstanding = sum((D(d.total_amount) - D(d.paid_amount) for d in live), Decimal(0))
    today = date.today()
    rate = await _interest_rate(db, booking)
    overdue = Decimal(0)
    interest = Decimal(0)
    for d in live:
        due = D(d.total_amount) - D(d.paid_amount)
        if due > EPS and d.due_date and d.due_date < today:
            overdue += due
            interest += money_q(due * rate / 100 * (today - d.due_date).days / 365)
    nxt = next((i for i in items if i.status in ("due", "demanded", "partial")), None)
    pending_clear = sum((D(r.gross_amount) for r in receipts if r.status == "received"), Decimal(0))
    return {
        "payable_total": _f(payable), "agreement_value": _f(booking.agreement_value), "gst_amount": _f(booking.gst_amount),
        "paid": _f(booking.paid_amount), "pending_clearance": _f(pending_clear),
        "balance": _f(max(Decimal(0), payable - D(booking.paid_amount))),
        "percent_paid": round(_f(D(booking.paid_amount) / payable * 100), 2) if payable > 0 else 0,
        "demanded": _f(demanded), "demanded_outstanding": _f(outstanding), "overdue": _f(overdue),
        "interest_accrued": _f(interest), "interest_rate": _f(rate),
        "next_due": {"name": nxt.name, "due_date": jsonable(nxt.due_date), "amount": _f(D(nxt.total_due) - D(nxt.paid_amount))} if nxt else None,
        "schedule": [row_dict(i) for i in items],
        "demands": [row_dict(d, exclude=("letter_html",)) for d in demands],
        "receipts": [row_dict(r) for r in receipts],
    }


async def overdue_report(db: AsyncSession, vendor_id: UUID, *, project_id: Optional[UUID] = None, as_of: Optional[date] = None) -> dict:
    today = as_of or date.today()
    rows = await _open_demands(db, vendor_id, project_id=project_id)
    cust_ids = {b.customer_id for _, b in rows}
    unit_ids = {b.unit_id for _, b in rows}
    customers = {c.id: c for c in (await db.execute(select(C.ReCustomer).where(C.ReCustomer.id.in_(cust_ids)))).scalars().all()} if cust_ids else {}
    units = {u.id: u for u in (await db.execute(select(C.ReUnit).where(C.ReUnit.id.in_(unit_ids)))).scalars().all()} if unit_ids else {}
    projects: dict[UUID, Decimal] = {}
    items, buckets, by_customer = [], defaultdict(lambda: {"count": 0, "amount": Decimal(0)}), defaultdict(lambda: Decimal(0))
    total = interest_total = Decimal(0)
    for d, b in rows:
        out = D(d.total_amount) - D(d.paid_amount)
        if out <= EPS or not d.due_date or d.due_date >= today:
            continue
        if b.project_id not in projects:
            projects[b.project_id] = await _interest_rate(db, b)
        days = (today - d.due_date).days
        interest = money_q(out * projects[b.project_id] / 100 * days / 365)
        cust = customers.get(b.customer_id)
        items.append({
            "demand_id": str(d.id), "demand_no": d.demand_no, "booking_id": str(b.id), "booking_no": b.booking_no,
            "customer": cust.full_name if cust else "", "phone": getattr(cust, "phone", None),
            "unit": units[b.unit_id].unit_number if b.unit_id in units else "", "stage": d.stage_name,
            "due_date": jsonable(d.due_date), "outstanding": _f(out), "days_overdue": days,
            "interest": _f(interest), "bucket": _bucket(days),
        })
        bk = buckets[_bucket(days)]
        bk["count"] += 1
        bk["amount"] += out
        by_customer[cust.full_name if cust else str(b.customer_id)] += out
        total += out
        interest_total += interest
    items.sort(key=lambda x: -x["days_overdue"])
    return {
        "as_of": today.isoformat(), "count": len(items), "total_overdue": _f(total), "total_interest": _f(interest_total),
        "buckets": {k: {"count": v["count"], "amount": _f(v["amount"])} for k, v in sorted(buckets.items())},
        "top_customers": sorted(({"customer": k, "outstanding": _f(v)} for k, v in by_customer.items()), key=lambda x: -x["outstanding"])[:10],
        "items": items,
    }


async def collection_summary(db: AsyncSession, vendor_id: UUID, *, project_id: Optional[UUID] = None) -> dict:
    bq = select(C.ReBooking).where(C.ReBooking.vendor_id == vendor_id, C.ReBooking.status.in_(ACTIVE_BOOKING))
    if project_id:
        bq = bq.where(C.ReBooking.project_id == project_id)
    bookings = (await db.execute(bq)).scalars().all()
    ids = [b.id for b in bookings]
    names = {p.id: p.name for p in (await db.execute(select(C.ReProject).where(C.ReProject.vendor_id == vendor_id))).scalars().all()}
    per_project: dict[UUID, dict] = defaultdict(lambda: {"bookings": 0, "payable": Decimal(0), "collected": Decimal(0)})
    for b in bookings:
        p = per_project[b.project_id]
        p["bookings"] += 1
        p["payable"] += payable_total(b)
        p["collected"] += D(b.paid_amount)
    demanded = outstanding = Decimal(0)
    if ids:
        for d in (await db.execute(select(R.ReDemand).where(R.ReDemand.booking_id.in_(ids), R.ReDemand.status != "cancelled"))).scalars().all():
            demanded += D(d.total_amount)
            outstanding += D(d.total_amount) - D(d.paid_amount)
    monthly: dict[str, Decimal] = defaultdict(Decimal)
    if ids:
        for r in (await db.execute(select(R.ReReceipt).where(R.ReReceipt.booking_id.in_(ids), R.ReReceipt.status == "cleared"))).scalars().all():
            monthly[r.receipt_date.strftime("%Y-%m")] += D(r.gross_amount)
    overdue = await overdue_report(db, vendor_id, project_id=project_id)
    collected = sum((D(b.paid_amount) for b in bookings), Decimal(0))
    payable = sum((payable_total(b) for b in bookings), Decimal(0))
    return {
        "bookings": len(bookings), "payable_total": _f(payable), "collected": _f(collected),
        "collected_percent": round(_f(collected / payable * 100), 2) if payable > 0 else 0,
        "demanded": _f(demanded), "demanded_outstanding": _f(outstanding), "overdue": overdue["total_overdue"],
        "overdue_count": overdue["count"],
        "by_project": [
            {"project": names.get(pid, str(pid)), "bookings": v["bookings"], "payable": _f(v["payable"]), "collected": _f(v["collected"]),
             "percent": round(_f(v["collected"] / v["payable"] * 100), 2) if v["payable"] > 0 else 0}
            for pid, v in per_project.items()
        ],
        "monthly": [{"month": m, "collected": _f(v)} for m, v in sorted(monthly.items())],
    }


async def receivables_ageing(db: AsyncSession, vendor_id: UUID, *, as_of: Optional[date] = None) -> dict:
    """AR ageing by customer: outstanding demands (not yet due + overdue buckets)."""
    today = as_of or date.today()
    rows = await _open_demands(db, vendor_id)
    cust_ids = {b.customer_id for _, b in rows}
    customers = {c.id: c for c in (await db.execute(select(C.ReCustomer).where(C.ReCustomer.id.in_(cust_ids)))).scalars().all()} if cust_ids else {}
    table: dict[UUID, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    for d, b in rows:
        out = D(d.total_amount) - D(d.paid_amount)
        if out <= EPS:
            continue
        key = "not_due" if not d.due_date or d.due_date >= today else {"0-30": "d0_30", "31-60": "d31_60", "61-90": "d61_90", "90+": "d90_plus"}[_bucket((today - d.due_date).days)]
        table[b.customer_id][key] += out
        table[b.customer_id]["total"] += out
    out_rows = [
        {"customer_id": str(cid), "customer": customers[cid].full_name if cid in customers else str(cid),
         **{k: _f(v) for k, v in cols.items()}}
        for cid, cols in table.items()
    ]
    out_rows.sort(key=lambda r: -r.get("total", 0))
    totals = defaultdict(float)
    for r in out_rows:
        for k, v in r.items():
            if isinstance(v, float):
                totals[k] += v
    return {"as_of": today.isoformat(), "rows": out_rows, "totals": dict(totals)}


# ═══ hooks used by booking.py ═══════════════════════════════════════════════════════════════

async def on_booking_confirmed(ctx: Ctx, booking) -> None:
    from .commissions import accrue_for_booking

    await generate_schedule(ctx, booking)
    await generate_demands(ctx, booking_id=booking.id)
    await accrue_for_booking(ctx, booking)


async def on_booking_cancelled(ctx: Ctx, booking) -> None:
    from .commissions import reverse_for_booking

    items = await _items(ctx.db, booking.id)
    demands = (await ctx.db.execute(select(R.ReDemand).where(R.ReDemand.booking_id == booking.id))).scalars().all()
    for d in demands:
        if d.status in ("issued",) and D(d.paid_amount) <= EPS:
            d.status = "cancelled"
            await gl.void_posted(ctx.db, ctx.vendor_id, "invoice", d.id)
    for it in items:
        if D(it.paid_amount) <= EPS:
            it.status = "cancelled"
    await ctx.db.flush()
    await reverse_for_booking(ctx, booking)


async def brokerage_to_recover(db: AsyncSession, booking_id: UUID) -> Decimal:
    """Brokerage is clawed back from the broker's next settlement, never deducted from the customer."""
    return Decimal(0)
