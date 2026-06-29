"""
GL open-item management and clearing engine tests.

Tests cover:
  - Lines on reconcilable accounts are stamped 'open' after posting.
  - Non-reconcilable accounts are not stamped.
  - Clearing validates: same account, reconcilable, net-zero, valid status.
  - Successful clearing stamps 'cleared' and creates a FinGlClearingBatch.
  - Reset clearing restores lines to 'open'.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.finance import (
    FinAccount, FinGlClearingBatch, FinJournalEntry, FinJournalLine,
)
from app.models.vendor import Vendor
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.posting import post_event
from app.services.finance.clearing import (
    clear_open_items,
    get_open_items,
    reset_clearing,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def clearing_vendor(db_session, test_vendor: Vendor) -> Vendor:
    """Vendor with seeded COA + fiscal year, AR marked reconcilable."""
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    # The default seeder already marks 1130 as is_reconciliation_account.
    # Also set is_reconcilable so the clearing service accepts it.
    ar = (await db_session.execute(
        select(FinAccount).where(
            FinAccount.vendor_id == test_vendor.id,
            FinAccount.code == "1130",
        )
    )).scalar_one()
    ar.is_reconcilable = True
    ar.is_reconciliation_account = True
    ar.reconciliation_subledger = "customer"
    await db_session.flush()
    await db_session.commit()
    return test_vendor


async def _get_ar_account(db, vendor_id):
    return (await db.execute(
        select(FinAccount).where(FinAccount.vendor_id == vendor_id, FinAccount.code == "1130")
    )).scalar_one()


async def _get_sales_account(db, vendor_id):
    return (await db.execute(
        select(FinAccount).where(FinAccount.vendor_id == vendor_id, FinAccount.code == "4100")
    )).scalar_one()


# ─── Tests ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invoice_line_stamped_open(db_session, clearing_vendor):
    """Lines posted to a reconcilable account must get open_item_status='open'."""
    je = await post_event(
        db_session, clearing_vendor.id, "invoice", uuid.uuid4(),
        {"total": 118, "cgst": 9, "sgst": 9},
    )
    await db_session.commit()

    ar = await _get_ar_account(db_session, clearing_vendor.id)
    lines = (await db_session.execute(
        select(FinJournalLine).where(
            FinJournalLine.journal_entry_id == je.id,
            FinJournalLine.account_id == ar.id,
        )
    )).scalars().all()

    assert len(lines) >= 1
    for ln in lines:
        assert ln.open_item_status == "open", "AR line should be stamped 'open'"


@pytest.mark.asyncio
async def test_non_reconcilable_line_not_stamped(db_session, clearing_vendor):
    """Lines on a non-reconcilable account must have open_item_status=None."""
    je = await post_event(
        db_session, clearing_vendor.id, "invoice", uuid.uuid4(),
        {"total": 100, "cgst": 0, "sgst": 0},
    )
    await db_session.commit()

    sales = await _get_sales_account(db_session, clearing_vendor.id)
    lines = (await db_session.execute(
        select(FinJournalLine).where(
            FinJournalLine.journal_entry_id == je.id,
            FinJournalLine.account_id == sales.id,
        )
    )).scalars().all()

    assert len(lines) >= 1
    for ln in lines:
        assert ln.open_item_status is None, "Sales revenue line must not be tracked"


@pytest.mark.asyncio
async def test_get_open_items_returns_open_lines(db_session, clearing_vendor):
    """get_open_items must return lines with open_item_status='open'."""
    ar = await _get_ar_account(db_session, clearing_vendor.id)

    await post_event(
        db_session, clearing_vendor.id, "invoice", uuid.uuid4(),
        {"total": 118, "cgst": 9, "sgst": 9},
    )
    await db_session.commit()

    items = await get_open_items(db_session, clearing_vendor.id, ar.id)
    assert len(items) >= 1
    for item in items:
        assert item["open_item_status"] in ("open", "partial")


@pytest.mark.asyncio
async def test_clear_open_items_success(db_session, clearing_vendor):
    """
    Clear matching AR debit (from invoice) against AR credit (from payment).
    Both lines must become 'cleared' and a FinGlClearingBatch must be created.
    """
    from datetime import date
    ar = await _get_ar_account(db_session, clearing_vendor.id)

    # Post invoice → AR debit
    je_inv = await post_event(
        db_session, clearing_vendor.id, "invoice", uuid.uuid4(),
        {"total": 100, "cgst": 0, "sgst": 0},
    )
    # Post payment → AR credit
    je_pay = await post_event(
        db_session, clearing_vendor.id, "payment", uuid.uuid4(),
        {"amount": 100},
    )
    await db_session.commit()

    ar_lines = (await db_session.execute(
        select(FinJournalLine).where(
            FinJournalLine.account_id == ar.id,
            FinJournalLine.vendor_id == clearing_vendor.id,
            FinJournalLine.open_item_status == "open",
        )
    )).scalars().all()

    assert len(ar_lines) >= 2, "Need at least one debit and one credit AR line"

    # Pick exactly the debit and credit that sum to zero
    debit_line  = next(ln for ln in ar_lines if ln.debit > 0)
    credit_line = next(ln for ln in ar_lines if ln.credit > 0)

    batch = await clear_open_items(
        db_session, clearing_vendor.id,
        [debit_line.id, credit_line.id],
        clearing_date=date.today(),
    )
    await db_session.commit()

    assert isinstance(batch, FinGlClearingBatch)
    assert batch.clearing_ref.startswith("CLR")
    assert batch.line_count == 2

    # Lines are now cleared
    for ln_id in [debit_line.id, credit_line.id]:
        ln = (await db_session.execute(
            select(FinJournalLine).where(FinJournalLine.id == ln_id)
        )).scalar_one()
        assert ln.open_item_status == "cleared"
        assert ln.clearing_batch_id == batch.id


@pytest.mark.asyncio
async def test_clear_unbalanced_raises(db_session, clearing_vendor):
    """Clearing items that don't net to zero must raise ValueError."""
    from datetime import date
    ar = await _get_ar_account(db_session, clearing_vendor.id)

    je = await post_event(
        db_session, clearing_vendor.id, "invoice", uuid.uuid4(),
        {"total": 200, "cgst": 0, "sgst": 0},
    )
    await db_session.commit()

    ar_lines = (await db_session.execute(
        select(FinJournalLine).where(
            FinJournalLine.account_id == ar.id,
            FinJournalLine.vendor_id == clearing_vendor.id,
            FinJournalLine.journal_entry_id == je.id,
        )
    )).scalars().all()

    with pytest.raises(ValueError, match="balance"):
        await clear_open_items(
            db_session, clearing_vendor.id,
            [ln.id for ln in ar_lines],
            clearing_date=date.today(),
        )


@pytest.mark.asyncio
async def test_clear_non_reconcilable_account_raises(db_session, clearing_vendor):
    """Clearing against a non-reconcilable account must raise ValueError."""
    from datetime import date
    sales = await _get_sales_account(db_session, clearing_vendor.id)

    # Manually insert two lines on the sales account so we have something to attempt
    ar = await _get_ar_account(db_session, clearing_vendor.id)
    je = await post_event(
        db_session, clearing_vendor.id, "invoice", uuid.uuid4(),
        {"total": 100, "cgst": 0, "sgst": 0},
    )
    await db_session.commit()

    sales_lines = (await db_session.execute(
        select(FinJournalLine).where(
            FinJournalLine.account_id == sales.id,
            FinJournalLine.vendor_id == clearing_vendor.id,
        )
    )).scalars().all()

    if not sales_lines:
        pytest.skip("No sales lines to test with")

    with pytest.raises(ValueError, match="open-item tracking"):
        await clear_open_items(
            db_session, clearing_vendor.id,
            [ln.id for ln in sales_lines[:1]],
            clearing_date=date.today(),
        )


@pytest.mark.asyncio
async def test_reset_clearing(db_session, clearing_vendor):
    """reset_clearing must restore all cleared lines back to 'open'."""
    from datetime import date
    ar = await _get_ar_account(db_session, clearing_vendor.id)

    await post_event(
        db_session, clearing_vendor.id, "invoice", uuid.uuid4(),
        {"total": 100, "cgst": 0, "sgst": 0},
    )
    await post_event(
        db_session, clearing_vendor.id, "payment", uuid.uuid4(),
        {"amount": 100},
    )
    await db_session.commit()

    ar_lines = (await db_session.execute(
        select(FinJournalLine).where(
            FinJournalLine.account_id == ar.id,
            FinJournalLine.vendor_id == clearing_vendor.id,
            FinJournalLine.open_item_status == "open",
        )
    )).scalars().all()
    debit_line  = next(ln for ln in ar_lines if ln.debit > 0)
    credit_line = next(ln for ln in ar_lines if ln.credit > 0)

    batch = await clear_open_items(
        db_session, clearing_vendor.id,
        [debit_line.id, credit_line.id],
        clearing_date=date.today(),
    )
    await db_session.commit()

    # Now reset
    await reset_clearing(db_session, clearing_vendor.id, batch.id)
    await db_session.commit()

    for ln_id in [debit_line.id, credit_line.id]:
        ln = (await db_session.execute(
            select(FinJournalLine).where(FinJournalLine.id == ln_id)
        )).scalar_one()
        assert ln.open_item_status == "open"
        assert ln.clearing_batch_id is None
