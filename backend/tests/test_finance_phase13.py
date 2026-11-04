"""
Phase 13 — job & close safety.

  * document numbers: auto-created locked range, unique, Indian FY aware
  * period close checklist / audit / reopen rules
  * per-month depreciation keys never supersede each other
  * advisory lock helper
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.finance import (
    FinAuditLog, FinFiscalYear, FinJournalEntry, FinNumberRange, FinPeriod,
)
from app.models.vendor import Vendor
from app.services.finance import period_control
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.job_lock import lock_key, try_job_lock
from app.services.finance.posting import _fy_candidates, post_event


@pytest_asyncio.fixture
async def finance_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


# ── numbering ────────────────────────────────────────────────────────────────

def test_fy_candidates_indian_financial_year():
    assert _fy_candidates(date(2026, 2, 10), None) == [2025, 2026]
    assert _fy_candidates(date(2026, 4, 1), None) == [2026]
    assert _fy_candidates(date(2026, 2, 10), 2030)[0] == 2030


@pytest.mark.asyncio
async def test_number_range_auto_created_and_sequential(db_session, finance_vendor):
    nos = []
    for _ in range(3):
        je = await post_event(db_session, finance_vendor.id, "expense", uuid.uuid4(),
                              {"amount": Decimal("10")})
        nos.append(je.entry_no)
    await db_session.commit()
    assert len(set(nos)) == 3                       # unique
    ranges = (await db_session.execute(select(FinNumberRange).where(
        FinNumberRange.vendor_id == finance_vendor.id, FinNumberRange.document_type == "SA"))).scalars().all()
    assert len(ranges) == 1 and ranges[0].current_number == 4
    # numeric suffixes are strictly increasing
    suffixes = [int(n.rsplit("/", 1)[1]) for n in nos]
    assert suffixes == sorted(suffixes) == [1, 2, 3]


@pytest.mark.asyncio
async def test_configured_range_is_used_not_overridden(db_session, finance_vendor):
    today = date.today()
    fy = today.year if today.month >= 4 else today.year - 1
    db_session.add(FinNumberRange(
        id=uuid.uuid4(), vendor_id=finance_vendor.id, document_type="SA", fiscal_year=fy,
        number_from=5000, number_to=5999, current_number=5000, prefix="JV-"))
    await db_session.commit()
    je = await post_event(db_session, finance_vendor.id, "expense", uuid.uuid4(), {"amount": Decimal("5")})
    assert je.entry_no == "JV-5000"


# ── depreciation keys ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_monthly_depreciation_keys_do_not_supersede(db_session, finance_vendor):
    asset_id = uuid.uuid4()
    for month in ("2026-04", "2026-05"):
        await post_event(db_session, finance_vendor.id, "depreciation",
                         uuid.uuid5(asset_id, f"dep:{month}"), {"amount": Decimal("100")})
    # re-running the same month re-uses the key (idempotent, single live entry)
    await post_event(db_session, finance_vendor.id, "depreciation",
                     uuid.uuid5(asset_id, "dep:2026-05"), {"amount": Decimal("100")})
    await db_session.commit()
    live = (await db_session.execute(select(FinJournalEntry).where(
        FinJournalEntry.vendor_id == finance_vendor.id,
        FinJournalEntry.source_type == "depreciation",
        FinJournalEntry.status == "posted"))).scalars().all()
    assert len(live) == 2


# ── period control ───────────────────────────────────────────────────────────

async def _open_period(db, vendor_id) -> FinPeriod:
    p = (await db.execute(select(FinPeriod).where(
        FinPeriod.vendor_id == vendor_id, FinPeriod.status == "open"
    ).order_by(FinPeriod.start_date))).scalars().first()
    assert p is not None
    return p


@pytest.mark.asyncio
async def test_close_blocked_by_draft_journal(db_session, finance_vendor):
    period = await _open_period(db_session, finance_vendor.id)
    db_session.add(FinJournalEntry(
        id=uuid.uuid4(), vendor_id=finance_vendor.id, entry_no="DRAFT-1",
        entry_date=period.start_date, status="draft", source_type="manual",
        total_debit=0, total_credit=0, period_id=period.id))
    await db_session.commit()

    check = await period_control.close_checklist(db_session, finance_vendor.id, period)
    assert check["can_close"] is False
    assert check["blockers"][0]["code"] == "draft_journals"
    with pytest.raises(ValueError, match="draft journal"):
        await period_control.close_period(db_session, finance_vendor.id, period, None)
    assert period.status == "open"


@pytest.mark.asyncio
async def test_close_lock_reopen_write_audit_trail(db_session, finance_vendor):
    period = await _open_period(db_session, finance_vendor.id)
    await period_control.close_period(db_session, finance_vendor.id, period, None)
    assert period.status == "closed"
    with pytest.raises(ValueError, match="already closed"):
        await period_control.close_period(db_session, finance_vendor.id, period, None)
    with pytest.raises(ValueError):
        await period_control.lock_period(db_session, finance_vendor.id, period, None)

    await period_control.reopen_period(db_session, finance_vendor.id, period, None, reason="late invoice")
    assert period.status == "open" and period.closed_at is None
    await db_session.commit()

    actions = {a.action: a.diff_json for a in (await db_session.execute(select(FinAuditLog).where(
        FinAuditLog.entity_type == "period", FinAuditLog.entity_id == period.id))).scalars().all()}
    assert {"closed", "reopened"} <= set(actions)
    assert actions["reopened"]["reason"] == "late invoice"


@pytest.mark.asyncio
async def test_reopen_blocked_when_fiscal_year_closed(db_session, finance_vendor):
    period = await _open_period(db_session, finance_vendor.id)
    await period_control.close_period(db_session, finance_vendor.id, period, None)
    fy = (await db_session.execute(select(FinFiscalYear).where(
        FinFiscalYear.id == period.fiscal_year_id))).scalar_one()
    fy.status = "closed"
    await db_session.commit()
    with pytest.raises(ValueError, match="fiscal year is closed"):
        await period_control.reopen_period(db_session, finance_vendor.id, period, None)


# ── advisory lock ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_job_lock_helper(db_session, finance_vendor):
    k = lock_key("depreciation", finance_vendor.id)
    assert 0 <= k < 2 ** 63
    assert k == lock_key("depreciation", finance_vendor.id)
    assert k != lock_key("aging_snapshot", finance_vendor.id)
    assert await try_job_lock(db_session, "depreciation", finance_vendor.id) is True   # sqlite: no contention
