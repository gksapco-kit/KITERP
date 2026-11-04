"""Module 16 — broker commission rules, accrual, clawback, incentives and settlements."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import receivables as R
from app.models.realestate.admin import ReApprovalRequest

from . import finance_bridge as gl
from .approvals import register_handler, request_approval
from .common import Ctx, D, audit, get_owned, jsonable, money_q, next_number

EPS = Decimal("0.005")
_AGREEMENT_STATES = ("agreement_signed", "registered", "handed_over")


def _f(v) -> float:
    return float(D(v))


async def pick_rule(db: AsyncSession, vendor_id: UUID, booking, broker) -> Optional[R.ReCommissionRule]:
    """Most specific active rule: broker-specific beats generic, project-specific beats generic."""
    bdate = booking.booking_date or date.today()
    rules = (
        await db.execute(
            select(R.ReCommissionRule).where(
                R.ReCommissionRule.vendor_id == vendor_id, R.ReCommissionRule.is_active.is_(True),
                or_(R.ReCommissionRule.broker_id.is_(None), R.ReCommissionRule.broker_id == broker.id),
                or_(R.ReCommissionRule.project_id.is_(None), R.ReCommissionRule.project_id == booking.project_id),
            )
        )
    ).scalars().all()
    av = D(booking.agreement_value)
    best, best_key = None, None
    for r in rules:
        if r.effective_from and bdate < r.effective_from:
            continue
        if r.effective_to and bdate > r.effective_to:
            continue
        if av < D(r.slab_min) or (D(r.slab_max) > 0 and av >= D(r.slab_max)):
            continue
        key = ((2 if r.broker_id else 0) + (1 if r.project_id else 0), D(r.slab_min), r.created_at)
        if best_key is None or key > best_key:
            best, best_key = r, key
    return best


def _is_eligible(rule: Optional[R.ReCommissionRule], booking) -> bool:
    if rule is None or rule.payout_trigger == "on_booking":
        return True
    if rule.payout_trigger == "on_agreement":
        return booking.status in _AGREEMENT_STATES
    payable = D(booking.agreement_value) + D(booking.gst_amount)
    pct = (D(booking.paid_amount) / payable * 100) if payable > 0 else Decimal(0)
    return pct + EPS >= D(rule.trigger_percent)


async def accrue_for_booking(ctx: Ctx, booking) -> Optional[R.ReCommission]:
    if not booking.broker_id:
        return None
    exists = (
        await ctx.db.execute(
            select(R.ReCommission.id).where(
                R.ReCommission.booking_id == booking.id, R.ReCommission.kind == "commission", R.ReCommission.status != "reversed")
        )
    ).first()
    if exists:
        return None
    broker = await ctx.db.get(C.ReBroker, booking.broker_id)
    if broker is None or broker.status != "active":
        return None
    rule = await pick_rule(ctx.db, ctx.vendor_id, booking, broker)
    if rule is None:
        return None
    if rule.basis == "fixed_per_unit":
        basis, rate, gross = D(booking.agreement_value), Decimal(0), money_q(D(rule.fixed_amount))
    else:
        basis = D(booking.basic_amount) if rule.basis == "percent_of_basic" else D(booking.agreement_value)
        rate = D(rule.rate)
        gross = money_q(basis * rate / 100)
    gst = money_q(gross * D(rule.gst_percent) / 100) if (broker.gstin or "").strip() else Decimal(0)
    tds = money_q(gross * D(broker.tds_percent) / 100)
    eligible = _is_eligible(rule, booking)
    com = R.ReCommission(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, booking_id=booking.id, broker_id=broker.id, rule_id=rule.id,
        kind="commission", basis_amount=basis, rate=rate, gross_amount=gross, gst_amount=gst,
        tds_percent=D(broker.tds_percent), tds_amount=tds, net_amount=gross + gst - tds,
        status="eligible" if eligible else "accrued", accrued_on=date.today(), eligible_on=date.today() if eligible else None,
    )
    ctx.db.add(com)
    await ctx.db.flush()
    com.gl_entry_id = await gl.post_commission_accrual(
        ctx.db, ctx.vendor_id, commission_id=com.id, amount=gross + gst, broker_id=broker.id,
        narration=f"Brokerage {broker.name} · {booking.booking_no}",
    )
    await audit(ctx, "commission", com.id, "accrue", ref=booking.booking_no, changes={"gross": gross, "broker": broker.name})
    return com


async def refresh_eligibility(ctx: Ctx, booking) -> int:
    rows = (
        await ctx.db.execute(
            select(R.ReCommission).where(
                R.ReCommission.booking_id == booking.id, R.ReCommission.kind == "commission", R.ReCommission.status == "accrued")
        )
    ).scalars().all()
    n = 0
    for c in rows:
        rule = await ctx.db.get(R.ReCommissionRule, c.rule_id) if c.rule_id else None
        if _is_eligible(rule, booking):
            c.status = "eligible"
            c.eligible_on = date.today()
            n += 1
    if n:
        await ctx.db.flush()
    return n


async def reverse_for_booking(ctx: Ctx, booking) -> None:
    """Booking cancelled: undo unsettled commission, claw back what was already paid."""
    rows = (
        await ctx.db.execute(
            select(R.ReCommission).where(R.ReCommission.booking_id == booking.id, R.ReCommission.kind == "commission")
        )
    ).scalars().all()
    for c in rows:
        if c.status in ("accrued", "eligible"):
            c.settlement_id = None
            c.status = "reversed"
            await gl.void_posted(ctx.db, ctx.vendor_id, "commission_accrual", c.id)
        elif c.status == "settled":
            dup = (
                await ctx.db.execute(
                    select(R.ReCommission.id).where(
                        R.ReCommission.booking_id == booking.id, R.ReCommission.kind == "clawback",
                        R.ReCommission.broker_id == c.broker_id)
                )
            ).first()
            if dup:
                continue
            ctx.db.add(R.ReCommission(
                id=uuid.uuid4(), vendor_id=ctx.vendor_id, booking_id=booking.id, broker_id=c.broker_id, rule_id=c.rule_id,
                kind="clawback", basis_amount=c.basis_amount, rate=c.rate, gross_amount=-D(c.gross_amount),
                gst_amount=-D(c.gst_amount), tds_percent=c.tds_percent, tds_amount=-D(c.tds_amount),
                net_amount=-D(c.net_amount), status="eligible", accrued_on=date.today(), eligible_on=date.today(),
                remarks=f"Clawback: booking {booking.booking_no} cancelled after commission was paid",
            ))
    await ctx.db.flush()


# ═══ settlements ════════════════════════════════════════════════════════════════════════════

async def create_settlement(
    ctx: Ctx, broker_id: UUID, *, commission_ids: Optional[list[UUID]] = None, include_incentives: bool = True,
    mode: str = "neft", remarks: Optional[str] = None, settlement_date: Optional[date] = None,
) -> R.ReSettlement:
    broker = await get_owned(ctx.db, C.ReBroker, ctx.vendor_id, broker_id, "broker")
    cq = select(R.ReCommission).where(
        R.ReCommission.vendor_id == ctx.vendor_id, R.ReCommission.broker_id == broker.id,
        R.ReCommission.status == "eligible", R.ReCommission.settlement_id.is_(None),
    )
    if commission_ids:
        cq = cq.where(R.ReCommission.id.in_(commission_ids))
    commissions = list((await ctx.db.execute(cq)).scalars().all())
    incentives = []
    if include_incentives:
        incentives = list((await ctx.db.execute(
            select(R.ReIncentive).where(
                R.ReIncentive.vendor_id == ctx.vendor_id, R.ReIncentive.broker_id == broker.id,
                R.ReIncentive.status == "approved", R.ReIncentive.settlement_id.is_(None))
        )).scalars().all())
    if not commissions and not incentives:
        raise HTTPException(status_code=409, detail="Nothing is eligible for settlement for this broker")
    gross = sum((D(c.gross_amount) for c in commissions), Decimal(0)) + sum((D(i.amount) for i in incentives), Decimal(0))
    gst = sum((D(c.gst_amount) for c in commissions), Decimal(0))
    tds = sum((D(c.tds_amount) for c in commissions), Decimal(0)) + sum((D(i.tds_amount) for i in incentives), Decimal(0))
    clawback = sum((-D(c.net_amount) for c in commissions if c.kind == "clawback"), Decimal(0))
    net = gross + gst - tds
    if net <= 0:
        raise HTTPException(status_code=409, detail=f"Net payable is ₹{net:,.2f}; clawbacks carry forward until more commission is eligible")
    s = R.ReSettlement(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, settlement_no=await next_number(ctx.db, ctx.vendor_id, "settlement"),
        broker_id=broker.id, settlement_date=settlement_date or date.today(), gross_amount=gross, gst_amount=gst,
        tds_amount=tds, clawback_amount=clawback, net_amount=net, mode=mode, status="draft", remarks=remarks,
    )
    ctx.db.add(s)
    await ctx.db.flush()
    for c in commissions:
        c.settlement_id = s.id
    for i in incentives:
        i.settlement_id = s.id
    approval = await request_approval(
        ctx, "settlement", s.id, ref=s.settlement_no, value=net, field="amount",
        title=f"Broker settlement {s.settlement_no} — {broker.name}", reason=f"Net payable ₹{net:,.2f}",
    )
    if approval is not None:
        s.status = "pending_approval"
        s.approval_request_id = approval.id
    else:
        s.status = "approved"
    await audit(ctx, "settlement", s.id, "create", ref=s.settlement_no, changes={"net": net, "items": len(commissions) + len(incentives)})
    return s


async def _release(db: AsyncSession, settlement_id: UUID) -> None:
    for model in (R.ReCommission, R.ReIncentive):
        for row in (await db.execute(select(model).where(model.settlement_id == settlement_id))).scalars().all():
            row.settlement_id = None


@register_handler("settlement")
async def _settlement_approval(ctx: Ctx, entity_id: UUID, approved: bool, req: ReApprovalRequest) -> None:
    s = await ctx.db.get(R.ReSettlement, entity_id)
    if s is None or s.vendor_id != ctx.vendor_id or s.status != "pending_approval":
        return
    if approved:
        s.status = "approved"
    else:
        s.status = "cancelled"
        await _release(ctx.db, s.id)


async def pay_settlement(
    ctx: Ctx, s: R.ReSettlement, *, mode: str, reference_no: Optional[str], paid_on: Optional[date],
) -> R.ReSettlement:
    if s.status != "approved":
        raise HTTPException(status_code=409, detail=f"Settlement is {s.status}; only approved settlements can be paid")
    if mode not in C.PAYMENT_MODES:
        raise HTTPException(status_code=422, detail=f"mode must be one of {', '.join(C.PAYMENT_MODES)}")
    s.status = "paid"
    s.mode = mode
    s.reference_no = reference_no
    s.paid_on = paid_on or date.today()
    for c in (await ctx.db.execute(select(R.ReCommission).where(R.ReCommission.settlement_id == s.id))).scalars().all():
        c.status = "settled"
    for i in (await ctx.db.execute(select(R.ReIncentive).where(R.ReIncentive.settlement_id == s.id))).scalars().all():
        i.status = "paid"
    broker = await ctx.db.get(C.ReBroker, s.broker_id)
    s.gl_entry_id = await gl.post_commission_payment(
        ctx.db, ctx.vendor_id, settlement_id=s.id, amount=s.net_amount, broker_id=s.broker_id,
        narration=f"Settlement {s.settlement_no} · {broker.name if broker else ''}", entry_date=s.paid_on,
    )
    await ctx.db.flush()
    await audit(ctx, "settlement", s.id, "pay", ref=s.settlement_no, changes={"net": s.net_amount, "mode": mode})
    return s


async def cancel_settlement(ctx: Ctx, s: R.ReSettlement, reason: str = "") -> R.ReSettlement:
    if s.status not in ("draft", "pending_approval", "approved"):
        raise HTTPException(status_code=409, detail=f"Settlement is {s.status}")
    s.status = "cancelled"
    s.remarks = f"Cancelled: {reason}"[:500] if reason else s.remarks
    await _release(ctx.db, s.id)
    await audit(ctx, "settlement", s.id, "cancel", ref=s.settlement_no)
    return s


async def broker_statement(db: AsyncSession, vendor_id: UUID, broker: C.ReBroker) -> dict:
    coms = (await db.execute(
        select(R.ReCommission).where(R.ReCommission.vendor_id == vendor_id, R.ReCommission.broker_id == broker.id)
        .order_by(R.ReCommission.created_at.desc())
    )).scalars().all()
    totals: dict[str, float] = {}
    for c in coms:
        totals[c.status] = totals.get(c.status, 0.0) + _f(c.net_amount)
    bookings = {b.id: b.booking_no for b in (await db.execute(select(C.ReBooking).where(C.ReBooking.broker_id == broker.id))).scalars().all()}
    settlements = (await db.execute(
        select(R.ReSettlement).where(R.ReSettlement.broker_id == broker.id).order_by(R.ReSettlement.settlement_date.desc()).limit(20)
    )).scalars().all()
    return {
        "broker": broker.name, "bookings": len(bookings), "net_by_status": {k: round(v, 2) for k, v in totals.items()},
        "payable_now": round(totals.get("eligible", 0.0), 2), "paid_to_date": round(totals.get("settled", 0.0), 2),
        "pending_trigger": round(totals.get("accrued", 0.0), 2),
        "commissions": [
            {"booking_no": bookings.get(c.booking_id, ""), "kind": c.kind, "gross": _f(c.gross_amount), "net": _f(c.net_amount),
             "status": c.status, "accrued_on": jsonable(c.accrued_on)} for c in coms[:50]
        ],
        "settlements": [
            {"settlement_no": s.settlement_no, "date": jsonable(s.settlement_date), "net": _f(s.net_amount), "status": s.status}
            for s in settlements
        ],
    }
