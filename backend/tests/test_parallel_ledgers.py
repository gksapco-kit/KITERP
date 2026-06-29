"""
Tests for Feature 9: Parallel Ledgers / Multi-GAAP.

Covers:
  - create / list / delete ledgers.
  - Leading ledger flag demotes previous leading ledger.
  - Cannot delete the leading ledger.
  - Assign ledger to company; idempotent re-assignment.
  - Remove assignment.
  - Post and retrieve parallel-ledger line overrides.
  - Leading-ledger trial balance aggregates from FinJournalLine.
  - Non-leading ledger trial balance aggregates from FinJournalLineLedger.
"""
import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import date
from uuid import uuid4

from sqlalchemy import select

from app.models.vendor import Vendor
from app.models.finance import FinAccount, FinJournalEntry, FinJournalLine, FinCompany
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance import parallel_ledger_service as pls


@pytest_asyncio.fixture
async def pl_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


@pytest_asyncio.fixture
async def company(db_session, pl_vendor: Vendor) -> FinCompany:
    co = FinCompany(vendor_id=pl_vendor.id, code="TEST", name="Test Co")
    db_session.add(co)
    await db_session.flush()
    await db_session.commit()
    return co


async def _expense_acct(db_session, vendor_id):
    row = (await db_session.execute(
        select(FinAccount).where(
            FinAccount.vendor_id == vendor_id,
            FinAccount.account_type == "Expense",
        )
    )).scalars().first()
    assert row, "No Expense account found"
    return row


async def _asset_acct(db_session, vendor_id):
    row = (await db_session.execute(
        select(FinAccount).where(
            FinAccount.vendor_id == vendor_id,
            FinAccount.account_type == "Asset",
        )
    )).scalars().first()
    assert row, "No Asset account found"
    return row


async def _make_je(db_session, vendor_id, lines: list[dict]) -> FinJournalEntry:
    je = FinJournalEntry(
        vendor_id=vendor_id,
        entry_no=f"PL-{uuid4().hex[:8].upper()}",
        entry_date=date.today(),
        status="posted",
    )
    db_session.add(je)
    await db_session.flush()
    for li in lines:
        db_session.add(FinJournalLine(
            journal_entry_id=je.id,
            vendor_id=vendor_id,
            account_id=li["account_id"],
            debit=li.get("debit", Decimal("0")),
            credit=li.get("credit", Decimal("0")),
        ))
    await db_session.flush()
    return je


# ── Ledger CRUD ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_list_ledgers(db_session, pl_vendor):
    l1 = await pls.create_ledger(db_session, pl_vendor.id, "0L", "Leading (Local GAAP)", is_leading=True)
    l2 = await pls.create_ledger(db_session, pl_vendor.id, "IL", "IFRS", is_leading=False)
    await db_session.commit()

    ledgers = await pls.list_ledgers(db_session, pl_vendor.id)
    ids = {str(l.id) for l in ledgers}
    assert str(l1.id) in ids
    assert str(l2.id) in ids


@pytest.mark.asyncio
async def test_leading_flag_demotes_previous(db_session, pl_vendor):
    first = await pls.create_ledger(db_session, pl_vendor.id, "0L", "Local GAAP", is_leading=True)
    await db_session.commit()

    second = await pls.create_ledger(db_session, pl_vendor.id, "IL", "IFRS", is_leading=True)
    await db_session.commit()
    await db_session.refresh(first)

    assert second.is_leading is True
    assert first.is_leading is False


@pytest.mark.asyncio
async def test_cannot_delete_leading_ledger(db_session, pl_vendor):
    ledger = await pls.create_ledger(db_session, pl_vendor.id, "0L", "Local GAAP", is_leading=True)
    await db_session.commit()

    with pytest.raises(ValueError, match="leading"):
        await pls.delete_ledger(db_session, ledger.id, pl_vendor.id)


@pytest.mark.asyncio
async def test_delete_non_leading_ledger(db_session, pl_vendor):
    l1 = await pls.create_ledger(db_session, pl_vendor.id, "0L", "Local GAAP", is_leading=True)
    l2 = await pls.create_ledger(db_session, pl_vendor.id, "TX", "Tax Ledger", is_leading=False)
    await db_session.commit()

    await pls.delete_ledger(db_session, l2.id, pl_vendor.id)
    await db_session.commit()

    ledgers = await pls.list_ledgers(db_session, pl_vendor.id)
    assert all(str(l.id) != str(l2.id) for l in ledgers)


# ── Ledger Assignment ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_assign_and_remove(db_session, pl_vendor, company):
    ledger = await pls.create_ledger(db_session, pl_vendor.id, "0L", "Local GAAP", is_leading=True)
    await db_session.commit()

    asgn = await pls.assign_ledger(db_session, pl_vendor.id, ledger.id, company.id)
    await db_session.commit()
    assert asgn.ledger_id == ledger.id

    # Idempotent
    asgn2 = await pls.assign_ledger(db_session, pl_vendor.id, ledger.id, company.id)
    await db_session.commit()
    assert str(asgn2.id) == str(asgn.id)

    await pls.remove_assignment(db_session, asgn.id, pl_vendor.id)
    await db_session.commit()

    items = await pls.list_assignments(db_session, pl_vendor.id, company_id=company.id)
    assert all(str(a.id) != str(asgn.id) for a in items)


# ── Parallel ledger line posting ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_post_and_retrieve_ledger_line(db_session, pl_vendor):
    leading = await pls.create_ledger(db_session, pl_vendor.id, "0L", "Local GAAP", is_leading=True)
    ifrs    = await pls.create_ledger(db_session, pl_vendor.id, "IL", "IFRS")
    await db_session.commit()

    exp_acct = await _expense_acct(db_session, pl_vendor.id)
    ast_acct = await _asset_acct(db_session, pl_vendor.id)
    je = await _make_je(db_session, pl_vendor.id, [
        {"account_id": exp_acct.id, "debit": Decimal("1000")},
        {"account_id": ast_acct.id, "credit": Decimal("1000")},
    ])

    # Get the expense journal line
    lines = (await db_session.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
    )).scalars().all()
    exp_line = next(l for l in lines if l.account_id == exp_acct.id)

    # IFRS: depreciation is 900 instead of 1000
    row = await pls.post_ledger_line(
        db_session, exp_line.id, ifrs.id,
        Decimal("900"), Decimal("0"), narration="IFRS adjustment"
    )
    await db_session.commit()

    fetched = await pls.get_ledger_lines(db_session, je.id, ifrs.id)
    assert len(fetched) == 1
    assert Decimal(str(fetched[0].debit)) == Decimal("900")


# ── Trial Balance ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_leading_ledger_trial_balance(db_session, pl_vendor):
    leading = await pls.create_ledger(db_session, pl_vendor.id, "0L", "Local GAAP", is_leading=True)
    await db_session.commit()

    exp_acct = await _expense_acct(db_session, pl_vendor.id)
    ast_acct = await _asset_acct(db_session, pl_vendor.id)
    await _make_je(db_session, pl_vendor.id, [
        {"account_id": exp_acct.id, "debit": Decimal("500")},
        {"account_id": ast_acct.id, "credit": Decimal("500")},
    ])
    await db_session.commit()

    tb = await pls.ledger_trial_balance(db_session, pl_vendor.id, leading.id)
    assert len(tb) > 0
    total_debit  = sum(r["debit"]  for r in tb)
    total_credit = sum(r["credit"] for r in tb)
    assert total_debit == total_credit


@pytest.mark.asyncio
async def test_parallel_ledger_trial_balance(db_session, pl_vendor):
    leading = await pls.create_ledger(db_session, pl_vendor.id, "0L", "Local GAAP", is_leading=True)
    ifrs    = await pls.create_ledger(db_session, pl_vendor.id, "IL", "IFRS")
    await db_session.commit()

    exp_acct = await _expense_acct(db_session, pl_vendor.id)
    ast_acct = await _asset_acct(db_session, pl_vendor.id)
    je = await _make_je(db_session, pl_vendor.id, [
        {"account_id": exp_acct.id, "debit": Decimal("1000")},
        {"account_id": ast_acct.id, "credit": Decimal("1000")},
    ])

    lines = (await db_session.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
    )).scalars().all()
    exp_line = next(l for l in lines if l.account_id == exp_acct.id)

    await pls.post_ledger_line(db_session, exp_line.id, ifrs.id, Decimal("850"), Decimal("0"))
    await db_session.commit()

    tb = await pls.ledger_trial_balance(db_session, pl_vendor.id, ifrs.id)
    # Only the IFRS-specific line is reported
    assert len(tb) == 1
    assert tb[0]["debit"] == Decimal("850")
