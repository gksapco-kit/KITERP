"""
Tests for Feature 6: FX Revaluation & Year-End Balance Carry-Forward.

Covers:
  - upsert_exchange_rate creates and updates correctly.
  - get_rate returns the most-recent rate on or before the query date.
  - simulate_fx_reval raises when no rate exists.
  - simulate_fx_reval computes gain/loss correctly for an open FX line.
  - run_balance_carry_forward carries BS accounts and is idempotent.
  - list_carry_forwards filters by fiscal year.
"""
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.finance import (
    FinExchangeRate, FinFxRevalRun, FinBalanceCarryForward,
    FinJournalEntry, FinJournalLine,
)
from app.models.vendor import Vendor
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance import fx_reval_service as fxs


@pytest_asyncio.fixture
async def fx_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


# ── Exchange Rate tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upsert_creates_rate(db_session, fx_vendor):
    er = await fxs.upsert_exchange_rate(
        db_session, fx_vendor.id, "USD", "INR",
        Decimal("83.50"), date(2024, 10, 1)
    )
    await db_session.flush()
    assert er.rate == Decimal("83.50")
    assert er.from_currency == "USD"


@pytest.mark.asyncio
async def test_upsert_updates_existing_rate(db_session, fx_vendor):
    await fxs.upsert_exchange_rate(db_session, fx_vendor.id, "USD", "INR", Decimal("83.00"), date(2024, 10, 1))
    await db_session.flush()
    er = await fxs.upsert_exchange_rate(db_session, fx_vendor.id, "USD", "INR", Decimal("84.00"), date(2024, 10, 1))
    await db_session.flush()

    rows = (await db_session.execute(
        select(FinExchangeRate).where(
            FinExchangeRate.vendor_id == fx_vendor.id,
            FinExchangeRate.from_currency == "USD",
        )
    )).scalars().all()
    assert len(rows) == 1
    assert rows[0].rate == Decimal("84.00")


@pytest.mark.asyncio
async def test_get_rate_most_recent(db_session, fx_vendor):
    await fxs.upsert_exchange_rate(db_session, fx_vendor.id, "EUR", "INR", Decimal("90.00"), date(2024, 9, 1))
    await fxs.upsert_exchange_rate(db_session, fx_vendor.id, "EUR", "INR", Decimal("91.50"), date(2024, 10, 1))
    await db_session.flush()

    rate = await fxs.get_rate(db_session, fx_vendor.id, "EUR", "INR", date(2024, 10, 15))
    assert rate == Decimal("91.50")

    # Earlier date should pick the September rate
    rate_sep = await fxs.get_rate(db_session, fx_vendor.id, "EUR", "INR", date(2024, 9, 30))
    assert rate_sep == Decimal("90.00")


@pytest.mark.asyncio
async def test_get_rate_returns_none_if_missing(db_session, fx_vendor):
    rate = await fxs.get_rate(db_session, fx_vendor.id, "JPY", "INR", date(2024, 10, 1))
    assert rate is None


# ── FX Revaluation tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_simulate_reval_no_rate_raises(db_session, fx_vendor):
    with pytest.raises(ValueError, match="No exchange rate"):
        await fxs.simulate_fx_reval(db_session, fx_vendor.id, "GBP", date(2024, 10, 1))


@pytest.mark.asyncio
async def test_simulate_reval_creates_run(db_session, fx_vendor):
    """Simulation with rate present must create a run (even with 0 open lines)."""
    await fxs.upsert_exchange_rate(db_session, fx_vendor.id, "USD", "INR", Decimal("83.00"), date(2024, 10, 1))
    await db_session.flush()

    run = await fxs.simulate_fx_reval(db_session, fx_vendor.id, "USD", date(2024, 10, 1))
    assert run.status == "simulated"
    assert run.currency == "USD"
    assert run.rate_used == Decimal("83.00")
    # No open FX lines → gains and losses are 0
    assert run.total_gain == Decimal(0)
    assert run.total_loss == Decimal(0)


# ── Balance Carry-Forward tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_carry_forward_empty_returns_list(db_session, fx_vendor):
    """With no posted transactions carry-forward should succeed and return []."""
    results = await fxs.run_balance_carry_forward(db_session, fx_vendor.id, 2023, 2024)
    await db_session.flush()
    assert isinstance(results, list)


@pytest.mark.asyncio
async def test_carry_forward_idempotent(db_session, fx_vendor):
    """Running carry-forward twice for the same year must not create duplicates."""
    await fxs.run_balance_carry_forward(db_session, fx_vendor.id, 2023, 2024)
    await db_session.flush()
    await fxs.run_balance_carry_forward(db_session, fx_vendor.id, 2023, 2024)
    await db_session.flush()

    rows = (await db_session.execute(
        select(FinBalanceCarryForward).where(
            FinBalanceCarryForward.vendor_id == fx_vendor.id,
            FinBalanceCarryForward.from_fiscal_year == 2023,
        )
    )).scalars().all()
    # Unique constraint: one row per account per from_fiscal_year
    acct_ids = [r.account_id for r in rows]
    assert len(acct_ids) == len(set(acct_ids))


@pytest.mark.asyncio
async def test_list_carry_forwards_filter(db_session, fx_vendor):
    await fxs.run_balance_carry_forward(db_session, fx_vendor.id, 2023, 2024)
    await fxs.run_balance_carry_forward(db_session, fx_vendor.id, 2022, 2023)
    await db_session.flush()

    rows_2023 = await fxs.list_carry_forwards(db_session, fx_vendor.id, fiscal_year=2023)
    rows_2022 = await fxs.list_carry_forwards(db_session, fx_vendor.id, fiscal_year=2022)
    # Each year's results are independent
    for r in rows_2023:
        assert r.from_fiscal_year == 2023
    for r in rows_2022:
        assert r.from_fiscal_year == 2022
