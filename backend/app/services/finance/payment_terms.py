"""
Payment Terms service.

Handles CRUD for the fin_payment_term master and the core date-calculation
engine that every module (procurement, sales, AR/AP) uses to derive due dates.

Public surface
--------------
list_payment_terms(db, vendor_id, *, usage=None, active_only=True)
get_payment_term(db, term_id, vendor_id)
create_payment_term(db, vendor_id, data)
update_payment_term(db, term_id, vendor_id, data)
toggle_active(db, term_id, vendor_id)
delete_payment_term(db, term_id, vendor_id)

compute_due_date(term, invoice_date, **anchors) -> date
build_schedule(term, amount, invoice_date, **anchors) -> PaymentSchedule
"""

from __future__ import annotations

import uuid
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.finance import FinPaymentTerm, FinPaymentTermDiscount, FinPaymentTermStage


# ─────────────────────────────────────────────────────────────────────────────
# Result types
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ScheduledStage:
    label: str | None
    sort_order: int
    share_pct: Decimal
    amount: Decimal
    due_date: date


@dataclass(frozen=True)
class DiscountOffer:
    """An early-payment reduction available if the full stage amount clears by `pay_by`."""
    pay_by: date
    discount_pct: Decimal
    saving: Decimal              # = amount * discount_pct / 100
    net_amount: Decimal          # = amount - saving


@dataclass
class PaymentSchedule:
    """Result of applying a payment term to a specific invoice."""
    due_date: date               # headline due date (last stage)
    stages: list[ScheduledStage]
    discounts: list[DiscountOffer]
    summary: str                 # human label to snapshot onto the document


# ─────────────────────────────────────────────────────────────────────────────
# Pure date arithmetic (no DB calls – easy to unit-test)
# ─────────────────────────────────────────────────────────────────────────────

def _last_day_of_month(d: date) -> date:
    return d.replace(day=monthrange(d.year, d.month)[1])


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return d.replace(year=year, month=month, day=day)


def _resolve_start(
    term: FinPaymentTerm,
    *,
    invoice_date: date,
    posting_date: date | None = None,
    received_date: date | None = None,
    delivery_date: date | None = None,
    goods_receipt_date: date | None = None,
) -> date:
    """Determine the clock-start date from the term's `starts_from` rule."""
    anchor_map = {
        "invoice_date":      invoice_date,
        "posting_date":      posting_date,
        "received_date":     received_date,
        "delivery_date":     delivery_date,
        "goods_receipt_date": goods_receipt_date,
    }
    anchor = anchor_map.get(term.starts_from) or invoice_date

    # Step 1: offset days
    start = anchor + timedelta(days=int(term.start_offset_days or 0))

    # Step 2: shift months
    shift = int(term.start_shift_months or 0)
    if shift:
        start = _add_months(start, shift)

    # Step 3: fix to a calendar day within the resulting month
    on_day = term.start_on_day
    if on_day:
        last = monthrange(start.year, start.month)[1]
        day = last if on_day >= 31 else min(on_day, last)
        start = start.replace(day=day)

    return start


def _stage_due_date(start: date, stage: FinPaymentTermStage, term: FinPaymentTerm) -> date:
    """Calculate the due date for a single stage."""
    d = start + timedelta(days=int(stage.due_days or 0))

    if stage.due_on_day:
        last = monthrange(d.year, d.month)[1]
        day = last if stage.due_on_day >= 31 else min(stage.due_on_day, last)
        d = d.replace(day=day)

    if term.round_to_month_end:
        d = _last_day_of_month(d)

    grace = int(term.grace_days or 0)
    if grace:
        d += timedelta(days=grace)

    return d


def compute_due_date(
    term: FinPaymentTerm,
    invoice_date: date,
    **anchors,  # posting_date, received_date, delivery_date, goods_receipt_date
) -> date:
    """Quick helper – returns the due date of the *last* stage only."""
    if not term.stages:
        return invoice_date

    start = _resolve_start(term, invoice_date=invoice_date, **anchors)
    last_stage = sorted(term.stages, key=lambda s: s.sort_order)[-1]
    return _stage_due_date(start, last_stage, term)


def build_schedule(
    term: FinPaymentTerm,
    amount: Decimal,
    invoice_date: date,
    **anchors,
) -> PaymentSchedule:
    """
    Apply a payment term to an invoice amount and date, returning a full
    payment schedule with per-stage due dates and early-payment offers.
    """
    start = _resolve_start(term, invoice_date=invoice_date, **anchors)

    # Build stages
    stages_sorted = sorted(term.stages, key=lambda s: s.sort_order)
    scheduled: list[ScheduledStage] = []
    for s in stages_sorted:
        pct = Decimal(str(s.share_pct))
        stage_amount = (amount * pct / 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        due = _stage_due_date(start, s, term)
        scheduled.append(ScheduledStage(
            label=s.label,
            sort_order=int(s.sort_order),
            share_pct=pct,
            amount=stage_amount,
            due_date=due,
        ))

    # Rounding: push any cent difference onto the last stage
    if scheduled:
        total_split = sum(s.amount for s in scheduled)
        diff = amount - total_split
        if diff:
            last = scheduled[-1]
            scheduled[-1] = ScheduledStage(
                label=last.label,
                sort_order=last.sort_order,
                share_pct=last.share_pct,
                amount=last.amount + diff,
                due_date=last.due_date,
            )

    # Build discount offers
    offers: list[DiscountOffer] = []
    for d in sorted(term.discounts, key=lambda x: x.within_days):
        pay_by = start + timedelta(days=int(d.within_days))
        pct = Decimal(str(d.discount_pct))
        base = amount                     # whole invoice; per-stage discounts handled if needed
        saving = (base * pct / 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        offers.append(DiscountOffer(
            pay_by=pay_by,
            discount_pct=pct,
            saving=saving,
            net_amount=base - saving,
        ))

    headline = scheduled[-1].due_date if scheduled else invoice_date
    summary = _build_summary(term, scheduled, offers)

    return PaymentSchedule(
        due_date=headline,
        stages=scheduled,
        discounts=offers,
        summary=summary,
    )


def _build_summary(
    term: FinPaymentTerm,
    stages: list[ScheduledStage],
    discounts: list[DiscountOffer],
) -> str:
    """Build a short human-readable label, e.g. 'Net 30 days' or '2% within 10 / Net 30'."""
    parts: list[str] = []
    for d in discounts:
        parts.append(f"{d.discount_pct}% within {d.within_days} days")
    if len(stages) == 1:
        days = stages[0].due_date  # not ideal without a reference date; use term metadata
        parts.append(f"Net {term.stages[0].due_days} days" if term.stages else term.name)
    elif len(stages) > 1:
        labels = [
            f"{s.share_pct}% {s.label or f'stage {s.sort_order}'}"
            for s in stages
        ]
        parts.append(" + ".join(labels))
    return " / ".join(parts) if parts else term.name


# ─────────────────────────────────────────────────────────────────────────────
# CRUD (async SQLAlchemy)
# ─────────────────────────────────────────────────────────────────────────────

async def _load(
    db: AsyncSession,
    term_id: UUID,
    vendor_id: UUID,
) -> FinPaymentTerm:
    stmt = (
        select(FinPaymentTerm)
        .where(FinPaymentTerm.id == term_id, FinPaymentTerm.vendor_id == vendor_id)
        .options(
            selectinload(FinPaymentTerm.stages),
            selectinload(FinPaymentTerm.discounts),
        )
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        raise ValueError(f"Payment term {term_id} not found")
    return row


async def list_payment_terms(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    usage: str | None = None,
    active_only: bool = True,
) -> Sequence[FinPaymentTerm]:
    stmt = (
        select(FinPaymentTerm)
        .where(FinPaymentTerm.vendor_id == vendor_id)
        .options(
            selectinload(FinPaymentTerm.stages),
            selectinload(FinPaymentTerm.discounts),
        )
        .order_by(FinPaymentTerm.code)
    )
    if active_only:
        stmt = stmt.where(FinPaymentTerm.is_active.is_(True))
    if usage:
        stmt = stmt.where(FinPaymentTerm.usage.in_([usage, "both"]))
    return (await db.execute(stmt)).scalars().all()


async def get_payment_term(
    db: AsyncSession,
    term_id: UUID,
    vendor_id: UUID,
) -> FinPaymentTerm:
    return await _load(db, term_id, vendor_id)


async def create_payment_term(
    db: AsyncSession,
    vendor_id: UUID,
    data: dict,
) -> FinPaymentTerm:
    stages_data   = data.pop("stages",    [])
    discounts_data = data.pop("discounts", [])

    _validate_stages(stages_data)

    term = FinPaymentTerm(vendor_id=vendor_id, **data)
    db.add(term)
    await db.flush()  # get term.id

    for i, s in enumerate(stages_data, 1):
        db.add(FinPaymentTermStage(
            term_id=term.id,
            sort_order=s.get("sort_order", i),
            label=s.get("label"),
            share_pct=Decimal(str(s["share_pct"])),
            due_days=int(s.get("due_days", 0)),
            due_on_day=s.get("due_on_day"),
        ))

    for disc in discounts_data:
        db.add(FinPaymentTermDiscount(
            term_id=term.id,
            within_days=int(disc["within_days"]),
            discount_pct=Decimal(str(disc["discount_pct"])),
        ))

    await db.flush()
    return await _load(db, term.id, vendor_id)


async def update_payment_term(
    db: AsyncSession,
    term_id: UUID,
    vendor_id: UUID,
    data: dict,
) -> FinPaymentTerm:
    term = await _load(db, term_id, vendor_id)

    stages_data   = data.pop("stages",    None)
    discounts_data = data.pop("discounts", None)

    for k, v in data.items():
        if hasattr(term, k):
            setattr(term, k, v)

    if stages_data is not None:
        _validate_stages(stages_data)
        for s in list(term.stages):
            await db.delete(s)
        await db.flush()
        for i, s in enumerate(stages_data, 1):
            db.add(FinPaymentTermStage(
                term_id=term.id,
                sort_order=s.get("sort_order", i),
                label=s.get("label"),
                share_pct=Decimal(str(s["share_pct"])),
                due_days=int(s.get("due_days", 0)),
                due_on_day=s.get("due_on_day"),
            ))

    if discounts_data is not None:
        for d in list(term.discounts):
            await db.delete(d)
        await db.flush()
        for disc in discounts_data:
            db.add(FinPaymentTermDiscount(
                term_id=term.id,
                within_days=int(disc["within_days"]),
                discount_pct=Decimal(str(disc["discount_pct"])),
            ))

    await db.flush()
    return await _load(db, term.id, vendor_id)


async def toggle_active(
    db: AsyncSession,
    term_id: UUID,
    vendor_id: UUID,
) -> FinPaymentTerm:
    term = await _load(db, term_id, vendor_id)
    term.is_active = not term.is_active
    await db.flush()
    return term


async def delete_payment_term(
    db: AsyncSession,
    term_id: UUID,
    vendor_id: UUID,
) -> None:
    term = await _load(db, term_id, vendor_id)
    await db.delete(term)
    await db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Internal validation
# ─────────────────────────────────────────────────────────────────────────────

def _validate_stages(stages: list[dict]) -> None:
    if not stages:
        raise ValueError("A payment term must have at least one payment stage.")
    total = sum(Decimal(str(s["share_pct"])) for s in stages)
    if abs(total - 100) > Decimal("0.01"):
        raise ValueError(
            f"Stage shares must add up to exactly 100%. Current total: {total}%."
        )
