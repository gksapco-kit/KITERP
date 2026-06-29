"""
app/services/finance/fx_reval_service.py

Foreign-currency revaluation (F.05 equivalent) and year-end balance
carry-forward (F.16 / FAGLGVTR equivalent).
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
    FinAccount,
    FinBalanceCarryForward,
    FinExchangeRate,
    FinFxRevalLine,
    FinFxRevalRun,
    FinJournalEntry,
    FinJournalLine,
)

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Exchange Rate helpers
# ─────────────────────────────────────────────────────────────────────────────

async def upsert_exchange_rate(
    db: AsyncSession,
    vendor_id: UUID,
    from_currency: str,
    to_currency: str,
    rate: Decimal,
    rate_date: date,
    rate_type: str = "M",
) -> FinExchangeRate:
    existing = (await db.execute(
        select(FinExchangeRate).where(
            FinExchangeRate.vendor_id == vendor_id,
            FinExchangeRate.from_currency == from_currency.upper(),
            FinExchangeRate.to_currency == to_currency.upper(),
            FinExchangeRate.effective_date == rate_date,
            FinExchangeRate.rate_type == rate_type,
        )
    )).scalar_one_or_none()

    if existing:
        existing.rate = rate
        await db.flush()
        return existing

    er = FinExchangeRate(
        vendor_id=vendor_id,
        from_currency=from_currency.upper(),
        to_currency=to_currency.upper(),
        rate=rate,
        effective_date=rate_date,
        rate_type=rate_type,
    )
    db.add(er)
    await db.flush()
    return er


async def get_rate(
    db: AsyncSession,
    vendor_id: UUID,
    from_currency: str,
    to_currency: str,
    as_of_date: date,
    rate_type: str = "M",
) -> Decimal | None:
    """Return the most-recent exchange rate on or before as_of_date."""
    row = (await db.execute(
        select(FinExchangeRate.rate)
        .where(
            FinExchangeRate.vendor_id == vendor_id,
            FinExchangeRate.from_currency == from_currency.upper(),
            FinExchangeRate.to_currency == to_currency.upper(),
            FinExchangeRate.rate_type == rate_type,
            FinExchangeRate.effective_date <= as_of_date,
        )
        .order_by(FinExchangeRate.effective_date.desc())
        .limit(1)
    )).scalar_one_or_none()
    return Decimal(str(row)) if row is not None else None


# ─────────────────────────────────────────────────────────────────────────────
# FX Revaluation
# ─────────────────────────────────────────────────────────────────────────────

async def simulate_fx_reval(
    db: AsyncSession,
    vendor_id: UUID,
    currency: str,
    run_date: date,
    local_currency: str = "INR",
    rate_type: str = "M",
    created_by: str | None = None,
) -> FinFxRevalRun:
    """
    Simulate (or execute) an FX revaluation for all open journal lines
    denominated in `currency`.

    Does NOT post the adjustment JE — call post_fx_reval() separately.
    Returns the FinFxRevalRun header in 'simulated' status.
    """
    rate = await get_rate(db, vendor_id, currency, local_currency, run_date, rate_type)
    if rate is None:
        raise ValueError(
            f"No exchange rate found for {currency}/{local_currency} on or before {run_date}."
        )

    # Find open FX journal lines for this vendor + currency
    open_lines = (await db.execute(
        select(FinJournalLine)
        .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
        .where(
            FinJournalEntry.vendor_id == vendor_id,
            FinJournalEntry.status == "posted",
            FinJournalLine.currency == currency.upper(),
            FinJournalLine.amount_fc.isnot(None),
            FinJournalLine.open_item_status == "open",
        )
    )).scalars().all()

    run = FinFxRevalRun(
        vendor_id=vendor_id,
        run_date=run_date,
        currency=currency.upper(),
        rate_used=rate,
        status="simulated",
        created_by=created_by,
    )
    db.add(run)
    await db.flush()

    total_gain = Decimal(0)
    total_loss = Decimal(0)

    for jl in open_lines:
        fc_amount = Decimal(str(jl.amount_fc))
        original_lc = Decimal(str(jl.debit or 0)) - Decimal(str(jl.credit or 0))
        revalued_lc = fc_amount * rate
        adjustment  = revalued_lc - original_lc

        reval_line = FinFxRevalLine(
            reval_run_id=run.id,
            journal_line_id=jl.id,
            original_amount_fc=fc_amount,
            original_amount_lc=original_lc,
            revalued_amount_lc=revalued_lc,
            adjustment=adjustment,
        )
        db.add(reval_line)

        if adjustment > 0:
            total_gain += adjustment
        else:
            total_loss += abs(adjustment)

    run.total_gain = total_gain
    run.total_loss = total_loss
    await db.flush()
    return run


async def list_reval_runs(
    db: AsyncSession,
    vendor_id: UUID,
) -> list[FinFxRevalRun]:
    rows = (await db.execute(
        select(FinFxRevalRun)
        .where(FinFxRevalRun.vendor_id == vendor_id)
        .order_by(FinFxRevalRun.run_date.desc())
    )).scalars().all()
    return list(rows)


# ─────────────────────────────────────────────────────────────────────────────
# Year-End Balance Carry-Forward
# ─────────────────────────────────────────────────────────────────────────────

async def run_balance_carry_forward(
    db: AsyncSession,
    vendor_id: UUID,
    from_fiscal_year: int,
    to_fiscal_year: int,
    carried_by: str | None = None,
) -> list[dict[str, Any]]:
    """
    For every balance-sheet account (asset / liability / equity):
      1. Compute closing balance (sum of debits - credits in from_fiscal_year).
      2. Upsert a FinBalanceCarryForward record.
      3. Update the account's opening_balance for the new year.

    Returns a list of {account_code, account_name, closing_balance, action}.
    Idempotent — re-running for the same year updates existing records.
    """
    BS_TYPES = ("asset", "liability", "equity")

    # Closing balances: sum all posted lines for the year
    year_start = date(from_fiscal_year, 4, 1)
    year_end   = date(from_fiscal_year + 1, 3, 31)

    balance_rows = (await db.execute(
        select(
            FinJournalLine.account_id,
            func.sum(
                func.coalesce(FinJournalLine.debit, Decimal(0))
                - func.coalesce(FinJournalLine.credit, Decimal(0))
            ).label("net_debit"),
        )
        .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
        .join(FinAccount, FinJournalLine.account_id == FinAccount.id)
        .where(
            FinJournalEntry.vendor_id == vendor_id,
            FinJournalEntry.status == "posted",
            FinJournalEntry.entry_date >= year_start,
            FinJournalEntry.entry_date <= year_end,
            FinAccount.account_type.in_(BS_TYPES),
        )
        .group_by(FinJournalLine.account_id)
    )).all()

    results = []
    for row in balance_rows:
        acc = (await db.execute(
            select(FinAccount).where(FinAccount.id == row.account_id)
        )).scalar_one_or_none()
        if not acc:
            continue

        closing = Decimal(str(row.net_debit or 0)) + Decimal(str(acc.opening_balance or 0))

        # Upsert carry-forward record
        existing_cf = (await db.execute(
            select(FinBalanceCarryForward).where(
                FinBalanceCarryForward.vendor_id == vendor_id,
                FinBalanceCarryForward.account_id == acc.id,
                FinBalanceCarryForward.from_fiscal_year == from_fiscal_year,
            )
        )).scalar_one_or_none()

        if existing_cf:
            existing_cf.closing_balance = closing
            existing_cf.to_fiscal_year = to_fiscal_year
            existing_cf.carried_by = carried_by
            action = "updated"
        else:
            db.add(FinBalanceCarryForward(
                vendor_id=vendor_id,
                account_id=acc.id,
                from_fiscal_year=from_fiscal_year,
                to_fiscal_year=to_fiscal_year,
                closing_balance=closing,
                carried_by=carried_by,
            ))
            action = "created"

        # Set opening balance for new year on the account
        acc.opening_balance = closing

        results.append({
            "account_id":   str(acc.id),
            "account_code": acc.code,
            "account_name": acc.name,
            "closing_balance": closing,
            "action": action,
        })

    await db.flush()
    return results


async def list_carry_forwards(
    db: AsyncSession,
    vendor_id: UUID,
    fiscal_year: int | None = None,
) -> list[FinBalanceCarryForward]:
    stmt = select(FinBalanceCarryForward).where(
        FinBalanceCarryForward.vendor_id == vendor_id
    )
    if fiscal_year:
        stmt = stmt.where(FinBalanceCarryForward.from_fiscal_year == fiscal_year)
    stmt = stmt.order_by(FinBalanceCarryForward.from_fiscal_year.desc())
    return list((await db.execute(stmt)).scalars().all())
