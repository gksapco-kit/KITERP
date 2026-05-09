"""Post manufacturing order cost settlements to the general ledger."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.controlling import CoCostBooking, CoGlMapping, CoManufacturingOrder, CoOrderCostLine
from app.services.finance.posting import post_event


def _line_amount(qty: Decimal, rate: Decimal) -> Decimal:
    return (qty * rate).quantize(Decimal("0.0001"))


def _order_line_amounts(ln: CoOrderCostLine) -> None:
    ap0 = Decimal(str(ln.amount_planned or 0))
    if ap0 == 0 and ln.qty_planned is not None and ln.rate_planned is not None:
        ln.amount_planned = _line_amount(Decimal(str(ln.qty_planned)), Decimal(str(ln.rate_planned)))
    aa0 = Decimal(str(ln.amount_actual or 0))
    if aa0 == 0 and ln.qty_actual is not None and ln.rate_actual is not None:
        ln.amount_actual = _line_amount(Decimal(str(ln.qty_actual)), Decimal(str(ln.rate_actual)))


def sum_order_planned_actual(order: CoManufacturingOrder) -> Tuple[Decimal, Decimal]:
    p = a = Decimal("0")
    for ln in order.cost_lines:
        _order_line_amounts(ln)
        p += Decimal(str(ln.amount_planned or 0))
        a += Decimal(str(ln.amount_actual or 0))
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


async def upsert_gl_mapping(
    db: AsyncSession,
    vendor_id: UUID,
    company_id: UUID,
    wip_account_id: Optional[UUID] = None,
    finished_goods_account_id: Optional[UUID] = None,
    cogs_account_id: Optional[UUID] = None,
    production_variance_account_id: Optional[UUID] = None,
    raw_material_account_id: Optional[UUID] = None,
    notes: Optional[str] = None,
) -> CoGlMapping:
    row = await get_gl_mapping(db, vendor_id, company_id)
    if row is None:
        row = CoGlMapping(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            company_id=company_id,
        )
        db.add(row)
    if wip_account_id is not None:
        row.wip_account_id = wip_account_id
    if finished_goods_account_id is not None:
        row.finished_goods_account_id = finished_goods_account_id
    if cogs_account_id is not None:
        row.cogs_account_id = cogs_account_id
    if production_variance_account_id is not None:
        row.production_variance_account_id = production_variance_account_id
    if raw_material_account_id is not None:
        row.raw_material_account_id = raw_material_account_id
    if notes is not None:
        row.notes = notes
    await db.flush()
    return row


async def load_order_for_settlement(
    db: AsyncSession, vendor_id: UUID, order_id: UUID
) -> Optional[CoManufacturingOrder]:
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vendor_id,
        )
    )
    return r.scalar_one_or_none()


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

    mapping = await get_gl_mapping(db, vendor_id, order.company_id)
    if not mapping or not mapping.wip_account_id or not mapping.finished_goods_account_id:
        raise ValueError("Configure WIP and finished goods accounts in CO GL mapping")

    _, actual_total = sum_order_planned_actual(order)
    if actual_total <= 0:
        raise ValueError("No actual cost on order lines — enter actuals before posting completion")

    amt = actual_total.quantize(Decimal("0.0001"))
    booking = CoCostBooking(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=order.company_id,
        order_id=order.id,
        booking_type="production_completion",
        amount=amt,
        qty_basis=order.qty_planned,
        unit_cost=(
            (amt / Decimal(str(order.qty_planned))).quantize(Decimal("0.000001"))
            if order.qty_planned is not None and Decimal(str(order.qty_planned)) > 0
            else None
        ),
        entry_date=entry_date or date.today(),
        narration=f"Production completion — {order.order_no}",
        extra={},
    )
    db.add(booking)
    await db.flush()

    cc = order.cost_center_id
    pj = order.project_id
    payload = {
        "company_id": order.company_id,
        "entry_date": (entry_date or date.today()).isoformat(),
        "document_type": "CO",
        "narration": booking.narration or "",
        "reference": order.order_no,
        "ref_doc_type": "co_manufacturing_order",
        "ref_doc_id": str(order.id),
        "lines": [
            {
                "account_id": str(mapping.finished_goods_account_id),
                "debit": str(amt),
                "credit": "0",
                "narration": f"FG receipt {order.order_no}",
                "cost_center_id": str(cc) if cc else None,
                "project_id": str(pj) if pj else None,
            },
            {
                "account_id": str(mapping.wip_account_id),
                "debit": "0",
                "credit": str(amt),
                "narration": f"WIP relief {order.order_no}",
                "cost_center_id": str(cc) if cc else None,
                "project_id": str(pj) if pj else None,
            },
        ],
    }
    je = await post_event(db, vendor_id, "co_cost_booking", booking.id, payload, created_by_id=created_by_id)
    if not je:
        raise ValueError("Journal posting failed — check GL accounts and period")

    booking.journal_entry_id = je.id
    order.production_completion_journal_id = je.id
    if (order.settlement_status or "none") in ("none", ""):
        order.settlement_status = "production_posted"
    await db.flush()
    return order, booking, je.id


async def post_cogs_issue(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    created_by_id: Optional[UUID],
    entry_date: Optional[date] = None,
) -> Tuple[CoManufacturingOrder, CoCostBooking, uuid.UUID]:
    order = await load_order_for_settlement(db, vendor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    if not order.production_completion_journal_id:
        raise ValueError("Post production completion before COGS issue")

    mapping = await get_gl_mapping(db, vendor_id, order.company_id)
    if not mapping or not mapping.cogs_account_id or not mapping.finished_goods_account_id:
        raise ValueError("Configure COGS and finished goods accounts in CO GL mapping")

    qd = Decimal(str(order.qty_delivered or 0))
    if qd <= 0:
        raise ValueError("Quantity delivered must be greater than zero")

    _, actual_total = sum_order_planned_actual(order)
    qp = Decimal(str(order.qty_planned or 0))
    if qp > 0:
        unit = (actual_total / qp).quantize(Decimal("0.0001"))
        cogs_amt = (unit * qd).quantize(Decimal("0.0001"))
    else:
        cogs_amt = actual_total.quantize(Decimal("0.0001"))

    if cogs_amt <= 0:
        raise ValueError("Computed COGS amount is zero")

    booking = CoCostBooking(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=order.company_id,
        order_id=order.id,
        booking_type="cogs_issue",
        amount=cogs_amt,
        qty_basis=qd,
        unit_cost=(cogs_amt / qd).quantize(Decimal("0.000001")) if qd > 0 else None,
        entry_date=entry_date or date.today(),
        narration=f"COGS — {order.order_no}",
        extra={},
    )
    db.add(booking)
    await db.flush()

    cc = order.cost_center_id
    pj = order.project_id
    payload = {
        "company_id": order.company_id,
        "entry_date": (entry_date or date.today()).isoformat(),
        "document_type": "CO",
        "narration": booking.narration or "",
        "reference": order.order_no,
        "ref_doc_type": "co_manufacturing_order",
        "ref_doc_id": str(order.id),
        "lines": [
            {
                "account_id": str(mapping.cogs_account_id),
                "debit": str(cogs_amt),
                "credit": "0",
                "narration": f"COGS {order.order_no}",
                "cost_center_id": str(cc) if cc else None,
                "project_id": str(pj) if pj else None,
            },
            {
                "account_id": str(mapping.finished_goods_account_id),
                "debit": "0",
                "credit": str(cogs_amt),
                "narration": f"FG issue {order.order_no}",
                "cost_center_id": str(cc) if cc else None,
                "project_id": str(pj) if pj else None,
            },
        ],
    }
    je = await post_event(db, vendor_id, "co_cost_booking", booking.id, payload, created_by_id=created_by_id)
    if not je:
        raise ValueError("Journal posting failed — check GL accounts and period")

    booking.journal_entry_id = je.id
    order.cogs_issue_journal_id = je.id
    if qd + Decimal("0.0001") >= qp and qp > 0:
        order.settlement_status = "cogs_closed"
    else:
        order.settlement_status = "cogs_partial"
    await db.flush()
    return order, booking, je.id
