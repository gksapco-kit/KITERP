"""
Fiscal calendar tests: FY bounds, contiguous monthly period generation, and
overlap detection.

Pure helpers are tested directly; DB-backed helpers use the SQLite harness.
"""

import uuid
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.finance import (
    FinCompany,
    FinFiscalYear,
    FinFiscalYearCompany,
    FinPeriod,
)
from app.models.vendor import Vendor
from app.services.finance.fiscal_calendar import (
    any_fy_overlaps,
    build_standard_periods,
    fiscal_year_bounds,
    find_overlapping_fiscal_year,
    iter_month_periods_in_range,
)


# ── Pure helpers ─────────────────────────────────────────────────

def test_fiscal_year_bounds_templates():
    assert fiscal_year_bounds("jan_dec", 2026) == (date(2026, 1, 1), date(2026, 12, 31), "FY 2026")
    assert fiscal_year_bounds("apr_mar", 2026) == (date(2026, 4, 1), date(2027, 3, 31), "FY 2026-27")
    assert fiscal_year_bounds("jul_jun", 2026) == (date(2026, 7, 1), date(2027, 6, 30), "FY 2026-27")


def test_fiscal_year_bounds_unknown_template():
    with pytest.raises(ValueError):
        fiscal_year_bounds("weekly", 2026)


def test_monthly_periods_are_contiguous_and_complete():
    segs = iter_month_periods_in_range(date(2026, 4, 1), date(2027, 3, 31))
    assert len(segs) == 12
    # Period numbers 1..12
    assert [s[2] for s in segs] == list(range(1, 13))
    # Covers the whole FY exactly.
    assert segs[0][0] == date(2026, 4, 1)
    assert segs[-1][1] == date(2027, 3, 31)
    # No gaps / overlaps: each segment ends the day before the next begins.
    from datetime import timedelta
    for (a_start, a_end, _an, _al), (b_start, _be, _bn, _bl) in zip(segs, segs[1:]):
        assert a_end + timedelta(days=1) == b_start


def test_partial_month_range():
    # Mid-month start/end produce partial first/last periods.
    segs = iter_month_periods_in_range(date(2026, 4, 15), date(2026, 5, 10))
    assert segs[0][0] == date(2026, 4, 15)
    assert segs[0][1] == date(2026, 4, 30)
    assert segs[-1][1] == date(2026, 5, 10)


# ── DB-backed ────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def fy_with_company(db_session, test_vendor: Vendor):
    company = FinCompany(
        id=uuid.uuid4(), vendor_id=test_vendor.id, code="1000",
        name="Main", is_default=True, is_active=True,
    )
    db_session.add(company)
    await db_session.flush()
    fy = FinFiscalYear(
        id=uuid.uuid4(), vendor_id=test_vendor.id, variant_code="MAIN",
        name="FY 2026-27", start_date=date(2026, 4, 1), end_date=date(2027, 3, 31),
        status="open",
    )
    db_session.add(fy)
    await db_session.flush()
    db_session.add(FinFiscalYearCompany(
        id=uuid.uuid4(), vendor_id=test_vendor.id, fiscal_year_id=fy.id,
        company_id=company.id, is_current=True,
    ))
    await db_session.commit()
    return company, fy


@pytest.mark.asyncio
async def test_build_standard_periods_creates_twelve(db_session, test_vendor, fy_with_company):
    _company, fy = fy_with_company
    await build_standard_periods(db_session, test_vendor.id, fy)
    await db_session.commit()

    periods = (await db_session.execute(
        select(FinPeriod).where(FinPeriod.fiscal_year_id == fy.id)
    )).scalars().all()
    assert len(periods) == 12
    assert all(p.status == "open" for p in periods)
    assert all(p.period_kind == "standard" for p in periods)


@pytest.mark.asyncio
async def test_overlap_detection(db_session, test_vendor, fy_with_company):
    company, fy = fy_with_company

    overlapping = await find_overlapping_fiscal_year(
        db_session, test_vendor.id, company.id, date(2026, 6, 1), date(2026, 6, 30),
    )
    assert overlapping is not None
    assert overlapping.id == fy.id

    assert await any_fy_overlaps(
        db_session, test_vendor.id, company.id, date(2026, 6, 1), date(2026, 6, 30),
    ) is True

    # A range entirely outside the FY does not overlap.
    assert await any_fy_overlaps(
        db_session, test_vendor.id, company.id, date(2030, 1, 1), date(2030, 12, 31),
    ) is False

    # Excluding the FY itself yields no overlap (used when editing that FY).
    assert await any_fy_overlaps(
        db_session, test_vendor.id, company.id, date(2026, 6, 1), date(2026, 6, 30),
        exclude_fy_id=fy.id,
    ) is False
