"""Unit blocking, booking, allotment, cancellation and refund business rules."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate.admin import ReApprovalRequest
from app.models.realestate.core import (
    ReAllotment, ReBooking, ReBookingApplicant, ReCancellation, ReCustomer, ReLead, ReProject,
    ReRefund, ReTower, ReUnit, ReUnitBlock,
)

from .approvals import register_handler, request_approval
from .common import Ctx, D, audit, get_owned, money_q, next_number
from .pricing import cost_sheet
from .templates import render_template

ACTIVE_BOOKING = ("draft", "pending_approval", "confirmed", "allotted", "agreement_signed", "registered", "handed_over")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── blocking ────────────────────────────────────────────────────────────────────────────────

async def release_expired_blocks(db: AsyncSession, vendor_id: UUID) -> int:
    """Expire time-boxed blocks whose hold window has elapsed and free the units."""
    stale = (
        await db.execute(
            select(ReUnitBlock).where(
                ReUnitBlock.vendor_id == vendor_id,
                ReUnitBlock.status == "active",
                ReUnitBlock.expires_at.is_not(None),
                ReUnitBlock.expires_at < _now(),
            )
        )
    ).scalars().all()
    for block in stale:
        block.status = "expired"
        block.released_at = _now()
        unit = await db.get(ReUnit, block.unit_id)
        if unit is not None and unit.status == "blocked":
            unit.status = "available"
    if stale:
        await db.flush()
    return len(stale)


async def _lock_unit(ctx: Ctx, unit_id: UUID) -> ReUnit:
    unit = (
        await ctx.db.execute(
            select(ReUnit).where(ReUnit.id == unit_id, ReUnit.vendor_id == ctx.vendor_id).with_for_update()
        )
    ).scalar_one_or_none()
    if unit is None:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


async def block_unit(
    ctx: Ctx, unit_id: UUID, *, lead_id: Optional[UUID] = None, customer_id: Optional[UUID] = None,
    hours: int = 48, token_amount: Decimal | float = 0, reason: str = "",
) -> ReUnitBlock:
    await release_expired_blocks(ctx.db, ctx.vendor_id)
    unit = await _lock_unit(ctx, unit_id)
    if unit.status != "available":
        raise HTTPException(status_code=409, detail=f"Unit {unit.unit_number} is {unit.status} and cannot be blocked")
    if hours <= 0 or hours > 24 * 30:
        raise HTTPException(status_code=422, detail="hours must be between 1 and 720")
    for table, rid in ((ReLead, lead_id), (ReCustomer, customer_id)):
        if rid is not None:
            await get_owned(ctx.db, table, ctx.vendor_id, rid)
    block = ReUnitBlock(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, unit_id=unit.id, lead_id=lead_id, customer_id=customer_id,
        status="active", blocked_at=_now(), expires_at=_now() + timedelta(hours=hours),
        blocked_by_name=ctx.actor_name, reason=reason or None, token_amount=D(token_amount),
    )
    unit.status = "blocked"
    ctx.db.add(block)
    await ctx.db.flush()
    await audit(ctx, "unit", unit.id, "block", ref=unit.unit_number, changes={"hours": hours})
    return block


async def release_block(ctx: Ctx, block: ReUnitBlock, status: str = "released") -> None:
    if block.status != "active":
        raise HTTPException(status_code=409, detail=f"Block is already {block.status}")
    block.status = status
    block.released_at = _now()
    unit = await ctx.db.get(ReUnit, block.unit_id)
    if unit is not None and unit.status == "blocked":
        unit.status = "available"
    await audit(ctx, "unit", block.unit_id, "release_block", ref=getattr(unit, "unit_number", ""))


# ── booking ─────────────────────────────────────────────────────────────────────────────────

async def _active_block(db: AsyncSession, unit_id: UUID) -> Optional[ReUnitBlock]:
    return (
        await db.execute(
            select(ReUnitBlock).where(ReUnitBlock.unit_id == unit_id, ReUnitBlock.status == "active")
        )
    ).scalars().first()


async def create_booking(ctx: Ctx, body: dict[str, Any]) -> ReBooking:
    await release_expired_blocks(ctx.db, ctx.vendor_id)
    unit = await _lock_unit(ctx, body["unit_id"])
    customer = await get_owned(ctx.db, ReCustomer, ctx.vendor_id, body["customer_id"], "customer")
    project = await ctx.db.get(ReProject, unit.project_id)
    lead_id = body.get("lead_id")
    for table, rid in ((ReLead, lead_id), ):
        if rid is not None:
            await get_owned(ctx.db, table, ctx.vendor_id, rid)
    if body.get("broker_id"):
        from app.models.realestate.core import ReBroker

        await get_owned(ctx.db, ReBroker, ctx.vendor_id, body["broker_id"], "broker")
    if body.get("payment_plan_id"):
        from app.models.realestate.core import RePaymentPlan

        await get_owned(ctx.db, RePaymentPlan, ctx.vendor_id, body["payment_plan_id"], "payment plan")

    block = await _active_block(ctx.db, unit.id)
    if unit.status == "blocked":
        same_party = block is not None and (
            (block.customer_id and block.customer_id == customer.id)
            or (block.lead_id and lead_id and block.lead_id == lead_id)
        )
        if not same_party:
            raise HTTPException(status_code=409, detail=f"Unit {unit.unit_number} is blocked for another party")
    elif unit.status != "available":
        raise HTTPException(status_code=409, detail=f"Unit {unit.unit_number} is {unit.status}")
    if unit.is_landowner_share:
        raise HTTPException(status_code=409, detail="Landowner-share units cannot be sold by the developer")

    discount = D(body.get("discount_amount"))
    if discount < 0:
        raise HTTPException(status_code=422, detail="discount_amount cannot be negative")
    sheet = cost_sheet(unit, project, discount=discount)
    gross = sheet["agreement_value"] + sheet["discount"]
    discount_pct = (sheet["discount"] / gross * 100) if gross > 0 else Decimal(0)

    booking_no = await next_number(ctx.db, ctx.vendor_id, "booking")
    comp = sheet["components"]
    booking = ReBooking(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, booking_no=booking_no, project_id=unit.project_id,
        unit_id=unit.id, customer_id=customer.id, lead_id=lead_id, broker_id=body.get("broker_id"),
        quotation_id=body.get("quotation_id"), payment_plan_id=body.get("payment_plan_id"),
        booking_date=body.get("booking_date") or date.today(), status="draft",
        sales_executive_name=body.get("sales_executive_name") or ctx.actor_name,
        sales_executive_user_id=ctx.user_id,
        basic_amount=D(comp["basic"]), plc_amount=D(comp["plc"]), floor_rise_amount=D(comp["floor_rise"]),
        parking_amount=D(comp["parking"]), club_amount=D(comp["club"]), other_charges=D(comp["other"]),
        discount_amount=sheet["discount"], agreement_value=sheet["agreement_value"],
        gst_rate=sheet["gst_rate"], gst_amount=sheet["gst_amount"], stamp_duty=sheet["stamp_duty"],
        registration_fee=sheet["registration_fee"], total_consideration=sheet["total_cost"],
        token_amount=D(body.get("token_amount")), paid_amount=Decimal(0), loan_amount=D(body.get("loan_amount")),
        bank_name=body.get("bank_name"), funding=body.get("funding") or "self",
        nominee_name=body.get("nominee_name"), remarks=body.get("remarks"),
        possession_due_date=project.possession_date if project else None,
    )
    ctx.db.add(booking)
    await ctx.db.flush()

    applicants = body.get("applicants") or []
    if not any(a.get("is_primary") for a in applicants):
        applicants = [{"customer_id": customer.id, "full_name": customer.full_name, "is_primary": True,
                       "pan": customer.pan, "phone": customer.phone, "email": customer.email,
                       "share_percent": 100 if not applicants else 0, "relation": "self"}] + list(applicants)
    for a in applicants:
        ctx.db.add(ReBookingApplicant(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, booking_id=booking.id,
            customer_id=a.get("customer_id"), full_name=a["full_name"], relation=a.get("relation"),
            pan=a.get("pan"), aadhaar_last4=a.get("aadhaar_last4"), phone=a.get("phone"), email=a.get("email"),
            is_primary=bool(a.get("is_primary")), share_percent=D(a.get("share_percent")),
        ))

    approval = await request_approval(
        ctx, "booking", booking.id, ref=booking_no, value=discount_pct, field="discount_percent",
        amount=sheet["discount"], title=f"Booking {booking_no} — {unit.unit_number}",
        reason=f"Discount {discount_pct:.2f}% of price",
    )
    if approval is not None:
        booking.status = "pending_approval"
        booking.approval_request_id = approval.id
        unit.status = "blocked"
        if block is not None:
            block.expires_at = None  # keep unit held until the decision
    else:
        await confirm_booking(ctx, booking, unit, block)
    await audit(ctx, "booking", booking.id, "create", ref=booking_no, changes={"unit": unit.unit_number})
    return booking


async def confirm_booking(ctx: Ctx, booking: ReBooking, unit: Optional[ReUnit] = None, block: Optional[ReUnitBlock] = None) -> None:
    unit = unit or await _lock_unit(ctx, booking.unit_id)
    block = block if block is not None else await _active_block(ctx.db, unit.id)
    booking.status = "confirmed"
    unit.status = "booked"
    if block is not None:
        block.status = "converted"
        block.released_at = _now()
    if booking.lead_id:
        lead = await ctx.db.get(ReLead, booking.lead_id)
        if lead is not None:
            lead.stage = "booked"
            lead.customer_id = lead.customer_id or booking.customer_id
            lead.converted_at = _now()
    await ctx.db.flush()
    from .payments import on_booking_confirmed

    await on_booking_confirmed(ctx, booking)


@register_handler("booking")
async def _booking_approval(ctx: Ctx, entity_id: UUID, approved: bool, req: ReApprovalRequest) -> None:
    booking = await ctx.db.get(ReBooking, entity_id)
    if booking is None or booking.vendor_id != ctx.vendor_id or booking.status != "pending_approval":
        return
    unit = await _lock_unit(ctx, booking.unit_id)
    if approved:
        await confirm_booking(ctx, booking, unit)
    else:
        booking.status = "cancelled"
        booking.cancelled_at = _now()
        if unit.status == "blocked":
            unit.status = "available"


async def booking_context(db: AsyncSession, booking: ReBooking) -> dict[str, Any]:
    """Merge-field values for letters / agreements generated from a booking."""
    unit = await db.get(ReUnit, booking.unit_id)
    project = await db.get(ReProject, booking.project_id)
    customer = await db.get(ReCustomer, booking.customer_id)
    tower = await db.get(ReTower, unit.tower_id) if unit and unit.tower_id else None
    return {
        "date": date.today().strftime("%d %b %Y"),
        "booking_no": booking.booking_no,
        "booking_date": booking.booking_date.strftime("%d %b %Y") if booking.booking_date else "",
        "customer_name": customer.full_name if customer else "",
        "customer_address": ", ".join(p for p in [getattr(customer, "address", None), getattr(customer, "city", None)] if p),
        "unit_number": unit.unit_number if unit else "",
        "floor_number": unit.floor_number if unit else "",
        "carpet_area": unit.carpet_area if unit else "",
        "super_area": unit.super_area if unit else "",
        "tower_name": tower.name if tower else "",
        "project_name": project.name if project else "",
        "city": project.city if project else "",
        "rera_number": project.rera_number if project else "",
        "developer_entity": (project.developer_entity if project and project.developer_entity else "The Developer"),
        "agreement_value": f"{booking.agreement_value:,.2f}",
        "gst_amount": f"{booking.gst_amount:,.2f}",
        "stamp_duty": f"{booking.stamp_duty:,.2f}",
        "registration_fee": f"{booking.registration_fee:,.2f}",
        "paid_amount": f"{booking.paid_amount or 0:,.2f}",
        "possession_date": booking.possession_due_date.strftime("%d %b %Y") if booking.possession_due_date else "as per RERA",
    }


async def issue_allotment(ctx: Ctx, booking: ReBooking) -> ReAllotment:
    if booking.status != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed bookings can be allotted")
    allotment_no = await next_number(ctx.db, ctx.vendor_id, "allotment")
    values = await booking_context(ctx.db, booking)
    values["allotment_no"] = allotment_no
    rendered = await render_template(ctx.db, ctx.vendor_id, "allotment_letter", values)
    allot = ReAllotment(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, allotment_no=allotment_no, booking_id=booking.id,
        allotment_date=date.today(), status="issued", letter_html=rendered["html"], issued_at=_now(),
    )
    booking.status = "allotted"
    booking.allotment_date = allot.allotment_date
    ctx.db.add(allot)
    await ctx.db.flush()
    await audit(ctx, "booking", booking.id, "allot", ref=booking.booking_no)
    return allot


# ── cancellation & refund ───────────────────────────────────────────────────────────────────

async def request_cancellation(
    ctx: Ctx, booking: ReBooking, *, reason: str, forfeiture_percent: Decimal | float = 10,
    gst_adjustment: Decimal | float = 0, other_deductions: Decimal | float = 0,
) -> ReCancellation:
    if booking.status not in ("confirmed", "allotted", "agreement_signed"):
        raise HTTPException(status_code=409, detail=f"Booking in status '{booking.status}' cannot be cancelled")
    open_req = (
        await ctx.db.execute(
            select(ReCancellation).where(
                ReCancellation.booking_id == booking.id, ReCancellation.status.in_(("requested", "approved", "refund_pending"))
            )
        )
    ).scalars().first()
    if open_req is not None:
        raise HTTPException(status_code=409, detail="A cancellation is already in progress for this booking")
    pct = D(forfeiture_percent)
    if pct < 0 or pct > 100:
        raise HTTPException(status_code=422, detail="forfeiture_percent must be between 0 and 100")
    paid = D(booking.paid_amount)
    forfeiture = min(paid, money_q(D(booking.agreement_value) * pct / 100))
    from .payments import brokerage_to_recover

    brokerage = await brokerage_to_recover(ctx.db, booking.id)
    gst_adj, other = D(gst_adjustment), D(other_deductions)
    refundable = max(Decimal(0), money_q(paid - forfeiture - brokerage - gst_adj - other))
    canc = ReCancellation(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id,
        cancellation_no=await next_number(ctx.db, ctx.vendor_id, "cancellation"),
        booking_id=booking.id, requested_on=date.today(), reason=reason, status="requested",
        total_paid=paid, forfeiture_percent=pct, forfeiture_amount=forfeiture, brokerage_recovery=brokerage,
        gst_adjustment=gst_adj, other_deductions=other, refundable_amount=refundable,
    )
    ctx.db.add(canc)
    await ctx.db.flush()
    approval = await request_approval(
        ctx, "cancellation", canc.id, ref=canc.cancellation_no, value=refundable, field="amount",
        title=f"Cancellation {canc.cancellation_no} — {booking.booking_no}", reason=reason,
    )
    if approval is not None:
        canc.approval_request_id = approval.id
    await audit(ctx, "booking", booking.id, "cancel_request", ref=booking.booking_no, changes={"refundable": refundable})
    return canc


async def approve_cancellation(ctx: Ctx, canc: ReCancellation) -> ReCancellation:
    if canc.status != "requested":
        raise HTTPException(status_code=409, detail=f"Cancellation is {canc.status}")
    booking = await get_owned(ctx.db, ReBooking, ctx.vendor_id, canc.booking_id, "booking")
    unit = await _lock_unit(ctx, booking.unit_id)
    booking.status = "cancelled"
    booking.cancelled_at = _now()
    if unit.status in ("booked", "sold"):
        unit.status = "available"
    canc.approved_by_name = ctx.actor_name
    canc.approved_at = _now()
    from .payments import on_booking_cancelled

    await on_booking_cancelled(ctx, booking)
    if D(canc.refundable_amount) > 0:
        ctx.db.add(ReRefund(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, refund_no=await next_number(ctx.db, ctx.vendor_id, "refund"),
            cancellation_id=canc.id, booking_id=booking.id, customer_id=booking.customer_id,
            amount=canc.refundable_amount, mode="neft", status="pending",
        ))
        canc.status = "refund_pending"
    else:
        canc.status = "completed"
    await ctx.db.flush()
    await audit(ctx, "cancellation", canc.id, "approve", ref=canc.cancellation_no)
    return canc


@register_handler("cancellation")
async def _cancellation_approval(ctx: Ctx, entity_id: UUID, approved: bool, req: ReApprovalRequest) -> None:
    canc = await ctx.db.get(ReCancellation, entity_id)
    if canc is None or canc.vendor_id != ctx.vendor_id or canc.status != "requested":
        return
    if approved:
        await approve_cancellation(ctx, canc)
    else:
        canc.status = "rejected"


async def pay_refund(ctx: Ctx, refund: ReRefund, *, mode: str, reference_no: str, paid_on: Optional[date]) -> ReRefund:
    if refund.status not in ("pending", "approved"):
        raise HTTPException(status_code=409, detail=f"Refund is {refund.status}")
    refund.status = "paid"
    refund.mode = mode
    refund.reference_no = reference_no
    refund.paid_on = paid_on or date.today()
    await ctx.db.flush()
    if refund.cancellation_id:
        pending = (
            await ctx.db.execute(
                select(ReRefund).where(ReRefund.cancellation_id == refund.cancellation_id, ReRefund.status != "paid")
            )
        ).scalars().first()
        if pending is None:
            canc = await ctx.db.get(ReCancellation, refund.cancellation_id)
            if canc is not None:
                canc.status = "completed"
    await audit(ctx, "refund", refund.id, "pay", ref=refund.refund_no)
    return refund
