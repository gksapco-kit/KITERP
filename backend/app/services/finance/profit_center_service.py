"""
app/services/finance/profit_center_service.py

Profit Center & Segment dimension services:
  - CRUD helpers
  - P&L by profit centre (slice journal lines by profit_center_id, then group)
  - P&L by segment
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import (
    FinProfitCenter,
    FinSegment,
    FinJournalLine,
    FinJournalEntry,
    FinAccount,
)

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Profit Center helpers
# ─────────────────────────────────────────────────────────────────────────────

async def list_profit_centers(db: AsyncSession, vendor_id: UUID) -> list[FinProfitCenter]:
    rows = (await db.execute(
        select(FinProfitCenter)
        .where(FinProfitCenter.vendor_id == vendor_id)
        .order_by(FinProfitCenter.code)
    )).scalars().all()
    return list(rows)


async def create_profit_center(
    db: AsyncSession,
    vendor_id: UUID,
    code: str,
    name: str,
    description: str | None = None,
    parent_id: UUID | None = None,
    manager: str | None = None,
) -> FinProfitCenter:
    pc = FinProfitCenter(
        vendor_id=vendor_id, code=code, name=name,
        description=description, parent_id=parent_id, manager=manager,
    )
    db.add(pc)
    await db.flush()
    return pc


async def update_profit_center(
    db: AsyncSession,
    pc_id: UUID,
    vendor_id: UUID,
    **kwargs: Any,
) -> FinProfitCenter:
    pc = (await db.execute(
        select(FinProfitCenter).where(
            FinProfitCenter.id == pc_id, FinProfitCenter.vendor_id == vendor_id
        )
    )).scalar_one_or_none()
    if not pc:
        raise ValueError("Profit center not found")
    for k, v in kwargs.items():
        if hasattr(pc, k):
            setattr(pc, k, v)
    await db.flush()
    return pc


async def delete_profit_center(db: AsyncSession, pc_id: UUID, vendor_id: UUID) -> None:
    pc = (await db.execute(
        select(FinProfitCenter).where(
            FinProfitCenter.id == pc_id, FinProfitCenter.vendor_id == vendor_id
        )
    )).scalar_one_or_none()
    if not pc:
        raise ValueError("Profit center not found")
    await db.delete(pc)
    await db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Segment helpers
# ─────────────────────────────────────────────────────────────────────────────

async def list_segments(db: AsyncSession, vendor_id: UUID) -> list[FinSegment]:
    rows = (await db.execute(
        select(FinSegment)
        .where(FinSegment.vendor_id == vendor_id)
        .order_by(FinSegment.code)
    )).scalars().all()
    return list(rows)


async def create_segment(
    db: AsyncSession,
    vendor_id: UUID,
    code: str,
    name: str,
    description: str | None = None,
) -> FinSegment:
    seg = FinSegment(vendor_id=vendor_id, code=code, name=name, description=description)
    db.add(seg)
    await db.flush()
    return seg


async def delete_segment(db: AsyncSession, seg_id: UUID, vendor_id: UUID) -> None:
    seg = (await db.execute(
        select(FinSegment).where(FinSegment.id == seg_id, FinSegment.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not seg:
        raise ValueError("Segment not found")
    await db.delete(seg)
    await db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# P&L by Profit Center / Segment
# ─────────────────────────────────────────────────────────────────────────────

async def _pnl_by_dimension(
    db: AsyncSession,
    vendor_id: UUID,
    from_date: date,
    to_date: date,
    dimension_col,          # FinJournalLine.profit_center_id or .segment_id
    label_col,              # FinProfitCenter.name or FinSegment.name
    join_model,             # FinProfitCenter or FinSegment
) -> list[dict[str, Any]]:
    """
    Core query: aggregate income & expense journal lines grouped by dimension.
    Returns rows like:
      {dimension_id, dimension_name, income, expense, net}
    """
    stmt = (
        select(
            dimension_col.label("dim_id"),
            label_col.label("dim_name"),
            func.sum(
                func.coalesce(FinJournalLine.credit, Decimal(0))
                - func.coalesce(FinJournalLine.debit, Decimal(0))
            ).filter(FinAccount.account_type == "income").label("income"),
            func.sum(
                func.coalesce(FinJournalLine.debit, Decimal(0))
                - func.coalesce(FinJournalLine.credit, Decimal(0))
            ).filter(FinAccount.account_type == "expense").label("expense"),
        )
        .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
        .join(FinAccount, FinJournalLine.account_id == FinAccount.id)
        .outerjoin(join_model, dimension_col == join_model.id)
        .where(
            FinJournalEntry.vendor_id == vendor_id,
            FinJournalEntry.status == "posted",
            FinJournalEntry.entry_date >= from_date,
            FinJournalEntry.entry_date <= to_date,
            FinAccount.account_type.in_(["income", "expense"]),
        )
        .group_by(dimension_col, label_col)
        .order_by(label_col)
    )
    rows = (await db.execute(stmt)).all()
    result = []
    for row in rows:
        income  = Decimal(str(row.income  or 0))
        expense = Decimal(str(row.expense or 0))
        result.append({
            "dimension_id":   str(row.dim_id) if row.dim_id else None,
            "dimension_name": row.dim_name or "Unassigned",
            "income":         income,
            "expense":        expense,
            "net":            income - expense,
        })
    return result


async def pnl_by_profit_center(
    db: AsyncSession,
    vendor_id: UUID,
    from_date: date,
    to_date: date,
) -> list[dict[str, Any]]:
    return await _pnl_by_dimension(
        db, vendor_id, from_date, to_date,
        FinJournalLine.profit_center_id,
        FinProfitCenter.name,
        FinProfitCenter,
    )


async def pnl_by_segment(
    db: AsyncSession,
    vendor_id: UUID,
    from_date: date,
    to_date: date,
) -> list[dict[str, Any]]:
    return await _pnl_by_dimension(
        db, vendor_id, from_date, to_date,
        FinJournalLine.segment_id,
        FinSegment.name,
        FinSegment,
    )
