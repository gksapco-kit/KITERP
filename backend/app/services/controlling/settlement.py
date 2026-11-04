"""Post manufacturing order cost settlements to the general ledger.

Costing model
-------------
* Finished goods are valued at **actual** cost when the order completes
  (Dr Finished goods / Cr WIP, amount = sum of actual cost lines).
* COGS is released **incrementally**: every posting relieves ``qty_delivered - qty_cogs_posted``
  units at the order's unit actual cost, never more than the value received into stock.
* Completion and COGS postings can be reversed (the journal is voided / reversed and the
  booking marked ``reversed``). COGS must be reversed before completion.
* Optional "WIP accumulation mode" (``co_gl_mapping.post_wip_to_gl``) additionally journals
  component issues (Dr WIP / Cr Raw material) and activity confirmations (Dr WIP / Cr Absorption)
  as they happen - see ``app.services.controlling.movements``.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.controlling import (
    CoCostBooking,
    CoGlMapping,
    CoManufacturingOrder,
    CoOrderCostLine,
    CoVarianceRunOrder,
)
from app.models.finance import FinFiscalYear, FinFiscalYearCompany, FinJournalEntry, FinPeriod
from app.services.finance.posting import _supersede_entry, post_event

ZERO = Decimal("0")
Q4 = Decimal("0.0001")

# Orders in these states may be settled (completion posted / COGS released).
SETTLEABLE_STATUSES = ("released", "in_progress", "completed")


def _dec(v: Any) -> Decimal:
    return Decimal(str(v if v is not None else 0))


async def check_period_open(
    db: AsyncSession, vendor_id: UUID, entry_date: date, company_id: Optional[UUID] = None
) -> None:
    """Raise ValueError if the accounting period for ``entry_date`` (of this company's calendar) is closed."""
    q = (
        select(FinPeriod)
        .join(FinFiscalYear, FinFiscalYear.id == FinPeriod.fiscal_year_id)
        .where(
            FinPeriod.vendor_id == vendor_id,
            FinPeriod.start_date <= entry_date,
            FinPeriod.end_date >= entry_date,
        )
    )
    if company_id is not None:
        q = q.join(
            FinFiscalYearCompany,
            and_(
                FinFiscalYearCompany.fiscal_year_id == FinFiscalYear.id,
                FinFiscalYearCompany.company_id == company_id,
            ),
        )
    periods = (await db.execute(q.order_by(FinPeriod.start_date.desc()))).scalars().all()
    if periods and not any(p.status == "open" for p in periods):
        p = periods[0]
        raise ValueError(
            f"Posting period '{p.name}' is {p.status}. "
            "Reopen the period or choose a different entry date."
        )


# Backwards compatible name used by older callers / tests.
_check_period_open = check_period_open


def _line_amount(qty: Decimal, rate: Decimal) -> Decimal:
    return (qty * rate).quantize(Q4)


def order_line_amounts(ln: CoOrderCostLine) -> None:
    """Single source of truth for cost-line amounts.

    When both quantity and rate are non-zero the amount is *always* qty x rate (so editing
    a quantity or rate can never leave a stale amount behind). A line with only an amount
    (qty or rate zero) keeps the explicit amount.
    """
    qp, rp = _dec(ln.qty_planned), _dec(ln.rate_planned)
    if qp != 0 and rp != 0:
        ln.amount_planned = _line_amount(qp, rp)
    qa, ra = _dec(ln.qty_actual), _dec(ln.rate_actual)
    if qa != 0 and ra != 0:
        ln.amount_actual = _line_amount(qa, ra)


_order_line_amounts = order_line_amounts


def sum_order_planned_actual(order: CoManufacturingOrder) -> Tuple[Decimal, Decimal]:
    p = a = ZERO
    for ln in order.cost_lines:
        order_line_amounts(ln)
        p += _dec(ln.amount_planned)
        a += _dec(ln.amount_actual)
    return p, a


async def get_gl_mapping(
    db: AsyncSession, vendor_id: UUID, company_id: UUID
) -> Optional[CoGlMapping]:
    r = await db.execute(
        select(CoGlMapping).where(
            CoGlMapping.vendor_id == vendor_id,
            CoGlMapping.company_id == company_id,
        )
    )
    return r.scalar_one_or_none()


_MAPPING_FIELDS = (
    "wip_account_id",
    "finished_goods_account_id",
    "cogs_account_id",
    "production_variance_account_id",
    "raw_material_account_id",
    "absorption_account_id",
    "post_wip_to_gl",
    "notes",
)


async def upsert_gl_mapping(
    db: AsyncSession,
    vendor_id: UUID,
    company_id: UUID,
    **fields: Any,
) -> CoGlMapping:
    row = await get_gl_mapping(db, vendor_id, company_id)
    if row is None:
        row = CoGlMapping(id=uuid.uuid4(), vendor_id=vendor_id, company_id=company_id)
        db.add(row)
    for name in _MAPPING_FIELDS:
        if name in fields and fields[name] is not None:
            setattr(row, name, fields[name])
    await db.flush()
    return row


async def load_order_for_settlement(
    db: AsyncSession, vendor_id: UUID, order_id: UUID, *, lock: bool = True
) -> Optional[CoManufacturingOrder]:
    """Load an order with its cost lines; ``lock`` takes a row lock so concurrent postings serialise."""
    q = (
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vendor_id,
        )
        .execution_options(populate_existing=True)
    )
    if lock:
        q = q.with_for_update()
    return (await db.execute(q)).scalar_one_or_none()


async def order_in_posted_variance_run(db: AsyncSession, order_id: UUID) -> bool:
    r = await db.execute(
        select(CoVarianceRunOrder.id).where(
            CoVarianceRunOrder.order_id == order_id, CoVarianceRunOrder.active.is_(True)
        ).limit(1)
    )
    return r.first() is not None


async def reverse_journal(
    db: AsyncSession, vendor_id: UUID, journal_entry_id: Optional[UUID], actor_id: Optional[UUID]
) -> None:
    """Undo a posted journal (voided in an open period, counter-entry in a closed one)."""
    if not journal_entry_id:
        return
    je = (
        await db.execute(
            select(FinJournalEntry).where(
                FinJournalEntry.id == journal_entry_id, FinJournalEntry.vendor_id == vendor_id
            )
        )
    ).scalar_one_or_none()
    if je is None or je.status != "posted" or je.reversed_by_id is not None:
        return
    await _supersede_entry(db, vendor_id, je, actor_id)


def _gl_lines(order: CoManufacturingOrder, debit_acc: UUID, credit_acc: UUID, amt: Decimal,
              dr_text: str, cr_text: str) -> list[dict]:
    cc = str(order.cost_center_id) if order.cost_center_id else None
    pj = str(order.project_id) if order.project_id else None
    return [
        {"account_id": str(debit_acc), "debit": str(amt), "credit": "0",
         "narration": dr_text, "cost_center_id": cc, "project_id": pj},
        {"account_id": str(credit_acc), "debit": "0", "credit": str(amt),
         "narration": cr_text, "cost_center_id": cc, "project_id": pj},
    ]


async def _post_booking(
    db: AsyncSession,
    vendor_id: UUID,
    order: CoManufacturingOrder,
    booking: CoCostBooking,
    lines: list[dict],
    entry_date: date,
    created_by_id: Optional[UUID],
) -> uuid.UUID:
    payload = {
        "company_id": order.company_id,
        "entry_date": entry_date.isoformat(),
        "document_type": "CO",
        "narration": booking.narration or "",
        "reference": order.order_no,
        "ref_doc_type": "co_manufacturing_order",
        "ref_doc_id": str(order.id),
        "lines": lines,
    }
    je = await post_event(db, vendor_id, "co_cost_booking", booking.id, payload, created_by_id=created_by_id)
    if not je:
        raise ValueError("Journal posting failed — check GL accounts and period")
    booking.journal_entry_id = je.id
    return je.id


def _recompute_settlement_status(order: CoManufacturingOrder) -> None:
    if not order.production_completion_journal_id:
        order.settlement_status = "none"
        return
    qd = _dec(order.qty_delivered)
    qc = _dec(order.qty_cogs_posted)
    qp = _dec(order.qty_planned)
    if qc <= 0:
        order.settlement_status = "production_posted"
    elif qp > 0 and qc + Decimal("0.0001") >= qp:
        order.settlement_status = "cogs_closed"
    elif qd > 0 and qc + Decimal("0.0001") >= qd and qp <= 0:
        order.settlement_status = "cogs_closed"
    else:
        order.settlement_status = "cogs_partial"


async def _live_bookings(db: AsyncSession, order_id: UUID, booking_type: str) -> list[CoCostBooking]:
    return list(
        (
            await db.execute(
                select(CoCostBooking)
                .where(
                    CoCostBooking.order_id == order_id,
                    CoCostBooking.booking_type == booking_type,
                    CoCostBooking.status == "posted",
                )
                .order_by(CoCostBooking.created_at, CoCostBooking.id)
            )
        ).scalars().all()
    )


async def post_production_completion(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    created_by_id: Optional[UUID],
    entry_date: Optional[date] = None,
) -> Tuple[CoManufacturingOrder, CoCostBooking, uuid.UUID]:
    order = await load_order_for_settlement(db, vendor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.production_completion_journal_id:
        raise ValueError("Production completion already posted for this order")
    if (order.status or "draft") not in SETTLEABLE_STATUSES:
        raise ValueError(
            f"Order is '{order.status}'. Release the order before posting production completion "
            "(cancelled / closed orders cannot be settled)."
        )

    d = entry_date or date.today()
    await check_period_open(db, vendor_id, d, order.company_id)

    mapping = await get_gl_mapping(db, vendor_id, order.company_id)
    if not mapping or not mapping.wip_account_id or not mapping.finished_goods_account_id:
        raise ValueError("Configure WIP and finished goods accounts in CO GL mapping")

    _, actual_total = sum_order_planned_actual(order)
    if actual_total <= 0:
        raise ValueError("No actual cost on order lines — enter actuals before posting completion")

    amt = actual_total.quantize(Q4)
    qp = _dec(order.qty_planned)
    booking = CoCostBooking(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=order.company_id,
        order_id=order.id,
        booking_type="production_completion",
        amount=amt,
        qty_basis=order.qty_planned,
        unit_cost=(amt / qp).quantize(Decimal("0.000001")) if qp > 0 else None,
        entry_date=d,
        narration=f"Production completion — {order.order_no}",
        status="posted",
        extra={},
    )
    db.add(booking)
    await db.flush()

    lines = _gl_lines(
        order, mapping.finished_goods_account_id, mapping.wip_account_id, amt,
        f"FG receipt {order.order_no}", f"WIP relief {order.order_no}",
    )
    je_id = await _post_booking(db, vendor_id, order, booking, lines, d, created_by_id)
    order.production_completion_journal_id = je_id
    _recompute_settlement_status(order)
    await db.flush()
    return order, booking, je_id


async def post_cogs_issue(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    created_by_id: Optional[UUID],
    entry_date: Optional[date] = None,
) -> Tuple[CoManufacturingOrder, CoCostBooking, uuid.UUID]:
    """Release ``qty_delivered - qty_cogs_posted`` units from finished goods to COGS."""
    order = await load_order_for_settlement(db, vendor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    if not order.production_completion_journal_id:
        raise ValueError("Post production completion before COGS issue")

    d = entry_date or date.today()
    await check_period_open(db, vendor_id, d, order.company_id)

    mapping = await get_gl_mapping(db, vendor_id, order.company_id)
    if not mapping or not mapping.cogs_account_id or not mapping.finished_goods_account_id:
        raise ValueError("Configure COGS and finished goods accounts in CO GL mapping")

    qd = _dec(order.qty_delivered)
    posted = _dec(order.qty_cogs_posted)
    delta = qd - posted
    if qd <= 0:
        raise ValueError("Quantity delivered must be greater than zero")
    if delta <= 0:
        raise ValueError(
            "COGS already posted for all delivered quantity — record a further goods receipt first"
        )

    # Value received into FG (live completion bookings) bounds the COGS that can be released.
    fg_value = sum((_dec(b.amount) for b in await _live_bookings(db, order.id, "production_completion")), ZERO)
    cogs_value = sum((_dec(b.amount) for b in await _live_bookings(db, order.id, "cogs_issue")), ZERO)

    _, actual_total = sum_order_planned_actual(order)
    qp = _dec(order.qty_planned)
    unit = (actual_total / qp) if qp > 0 else None
    cogs_amt = (unit * delta).quantize(Q4) if unit is not None else actual_total.quantize(Q4)
    if cogs_amt <= 0:
        raise ValueError("Computed COGS amount is zero")
    if cogs_value + cogs_amt > fg_value + Decimal("0.01"):
        cogs_amt = (fg_value - cogs_value).quantize(Q4)
        if cogs_amt <= 0:
            raise ValueError("COGS would exceed the value received into finished goods")

    booking = CoCostBooking(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=order.company_id,
        order_id=order.id,
        booking_type="cogs_issue",
        amount=cogs_amt,
        qty_basis=delta,
        unit_cost=(cogs_amt / delta).quantize(Decimal("0.000001")),
        entry_date=d,
        narration=f"COGS — {order.order_no}",
        status="posted",
        extra={"cumulative_qty": str(qd)},
    )
    db.add(booking)
    await db.flush()

    lines = _gl_lines(
        order, mapping.cogs_account_id, mapping.finished_goods_account_id, cogs_amt,
        f"COGS {order.order_no}", f"FG issue {order.order_no}",
    )
    je_id = await _post_booking(db, vendor_id, order, booking, lines, d, created_by_id)
    order.cogs_issue_journal_id = je_id
    order.qty_cogs_posted = posted + delta
    _recompute_settlement_status(order)
    await db.flush()
    return order, booking, je_id


async def reverse_cogs_issue(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    actor_id: Optional[UUID],
    reason: str,
) -> CoManufacturingOrder:
    """Reverse the most recent live COGS posting of an order."""
    order = await load_order_for_settlement(db, vendor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    live = await _live_bookings(db, order.id, "cogs_issue")
    if not live:
        raise ValueError("No posted COGS to reverse for this order")
    if await order_in_posted_variance_run(db, order.id):
        raise ValueError("Order is covered by a posted variance run — reverse that run first")
    booking = live[-1]
    await check_period_open(db, vendor_id, date.today(), order.company_id)
    await reverse_journal(db, vendor_id, booking.journal_entry_id, actor_id)
    booking.status = "reversed"
    booking.extra = {**(booking.extra or {}), "reversal_reason": reason, "reversed_by": str(actor_id) if actor_id else None}
    qty = _dec(booking.qty_basis)
    order.qty_cogs_posted = max(ZERO, _dec(order.qty_cogs_posted) - qty)
    remaining = live[:-1]
    order.cogs_issue_journal_id = remaining[-1].journal_entry_id if remaining else None
    _recompute_settlement_status(order)
    await db.flush()
    return order


async def reverse_production_completion_posting(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    actor_id: Optional[UUID],
    reason: str,
) -> CoManufacturingOrder:
    """Reverse the FG-receipt / WIP-relief journal so actuals can be corrected and re-posted."""
    order = await load_order_for_settlement(db, vendor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    if (order.ref_doc_type or "") == "production_order":
        raise ValueError(
            "This order mirrors a Production order — re-open the production order to reverse its accounting"
        )
    if not order.production_completion_journal_id:
        raise ValueError("Production completion has not been posted for this order")
    if await _live_bookings(db, order.id, "cogs_issue"):
        raise ValueError("Reverse the COGS postings first")
    if await order_in_posted_variance_run(db, order.id):
        raise ValueError("Order is covered by a posted variance run — reverse that run first")

    await check_period_open(db, vendor_id, date.today(), order.company_id)
    live = await _live_bookings(db, order.id, "production_completion")
    for b in live:
        await reverse_journal(db, vendor_id, b.journal_entry_id, actor_id)
        b.status = "reversed"
        b.extra = {**(b.extra or {}), "reversal_reason": reason, "reversed_by": str(actor_id) if actor_id else None}
    order.production_completion_journal_id = None
    order.cogs_issue_journal_id = None
    order.qty_cogs_posted = ZERO
    _recompute_settlement_status(order)
    await db.flush()
    return order
