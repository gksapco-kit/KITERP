"""
General-ledger posting integrity (`services/finance/posting.py`).

The single most important finance guarantee is **double-entry balance**: every
journal entry must have ``total_debit == total_credit``. These tests seed a
default chart of accounts + fiscal year, then post one event per source type and
assert the resulting journal balances. Also covers idempotency (re-posting the
same source voids the old entry) and graceful no-op when accounts are missing.

Runs on the in-memory SQLite harness from conftest.
"""

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.finance import FinAccount, FinJournalEntry, FinJournalLine
from app.models.vendor import Vendor
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.posting import post_event


async def _account_id_by_code(db_session, vendor_id, code: str):
    acc = (
        await db_session.execute(
            select(FinAccount).where(
                FinAccount.vendor_id == vendor_id, FinAccount.code == code
            )
        )
    ).scalar_one()
    # Return the UUID object: the SQLite test harness's UUID column type does not
    # coerce string ids (Postgres does). Production callers pass typed ids.
    return acc.id


@pytest_asyncio.fixture
async def finance_vendor(db_session, test_vendor: Vendor) -> Vendor:
    """A vendor with a seeded COA + open fiscal year so posting can resolve accounts."""
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


# source_type → balanced payload (each handler resolves accounts by name).
BALANCED_EVENTS = {
    "invoice": {"total": 118, "cgst": 9, "sgst": 9, "customer_id": None},
    "payment": {"amount": 118, "customer_id": None},
    "pos": {"cash_total": 118, "tax_total": 18},
    "vendor_bill": {"subtotal": 100, "tax_amount": 18, "total": 118, "supplier_id": None},
    "vendor_payment": {"amount": 118, "supplier_id": None},
    "payroll": {"gross_total": 100, "net_total": 90, "tds_total": 10},
    "expense": {"amount": 50},
    "depreciation": {"amount": 25},
}


@pytest.mark.asyncio
@pytest.mark.parametrize("source_type", list(BALANCED_EVENTS.keys()))
async def test_event_posts_balanced_journal(db_session, finance_vendor, source_type):
    payload = dict(BALANCED_EVENTS[source_type])
    if source_type == "vendor_bill":
        # Real callers pass an explicit expense account; the default name-lookup
        # ("Operating Expense" + "Purchase") doesn't match the seeded COGS account.
        payload["expense_account_id"] = await _account_id_by_code(
            db_session, finance_vendor.id, "5110",
        )
    je = await post_event(
        db_session, finance_vendor.id, source_type, uuid.uuid4(), payload,
    )
    await db_session.commit()

    assert je is not None, f"{source_type} produced no journal entry"
    assert je.total_debit == je.total_credit, f"{source_type} journal is unbalanced"
    assert je.total_debit > 0
    assert je.status == "posted"

    # Lines themselves balance.
    lines = (
        await db_session.execute(
            select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
        )
    ).scalars().all()
    assert len(lines) >= 2
    total_dr = sum(l.debit for l in lines)
    total_cr = sum(l.credit for l in lines)
    assert total_dr == total_cr == je.total_debit


@pytest.mark.asyncio
async def test_invoice_revenue_and_tax_split(db_session, finance_vendor):
    """Invoice: AR debited gross; revenue net of tax; GST output = cgst+sgst+igst."""
    je = await post_event(
        db_session, finance_vendor.id, "invoice", uuid.uuid4(),
        {"total": 118, "cgst": 9, "sgst": 9},
    )
    await db_session.commit()
    lines = (
        await db_session.execute(
            select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
        )
    ).scalars().all()
    debits = {float(l.debit) for l in lines if l.debit > 0}
    credits = sorted(float(l.credit) for l in lines if l.credit > 0)
    assert 118.0 in debits          # AR gross
    assert credits == [18.0, 100.0]  # GST 18, revenue 100


@pytest.mark.asyncio
async def test_posting_is_idempotent_voids_old(db_session, finance_vendor):
    """Re-posting the same source voids the previous entry; only one stays posted."""
    source_id = uuid.uuid4()
    await post_event(db_session, finance_vendor.id, "invoice", source_id,
                     {"total": 118, "cgst": 9, "sgst": 9})
    await db_session.commit()
    await post_event(db_session, finance_vendor.id, "invoice", source_id,
                     {"total": 236, "cgst": 18, "sgst": 18})
    await db_session.commit()

    rows = (
        await db_session.execute(
            select(FinJournalEntry).where(
                FinJournalEntry.vendor_id == finance_vendor.id,
                FinJournalEntry.source_type == "invoice",
                FinJournalEntry.source_id == source_id,
            )
        )
    ).scalars().all()
    posted = [r for r in rows if r.status == "posted"]
    voided = [r for r in rows if r.status == "void"]
    assert len(posted) == 1
    assert len(voided) == 1
    assert posted[0].total_debit == Decimal("236")


@pytest.mark.asyncio
async def test_unknown_source_type_returns_none(db_session, finance_vendor):
    je = await post_event(
        db_session, finance_vendor.id, "not_a_real_event", uuid.uuid4(), {"amount": 10},
    )
    assert je is None


@pytest.mark.asyncio
async def test_no_accounts_returns_none(db_session, test_vendor):
    """Without a seeded COA, posting is a safe no-op (no half-written journal)."""
    je = await post_event(
        db_session, test_vendor.id, "invoice", uuid.uuid4(),
        {"total": 118, "cgst": 9, "sgst": 9},
    )
    assert je is None


# ─── Reconciliation account tests ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_manual_posting_to_recon_account_blocked(db_session, finance_vendor):
    """Manual journal to a reconciliation account must raise ValueError."""
    from app.services.finance.posting import _guard_no_recon_accounts

    # Mark 1130 (Accounts Receivable) as reconciliation account
    ar_acc = (
        await db_session.execute(
            select(FinAccount).where(
                FinAccount.vendor_id == finance_vendor.id, FinAccount.code == "1130"
            )
        )
    ).scalar_one()
    ar_acc.is_reconciliation_account = True
    ar_acc.reconciliation_subledger = "customer"
    await db_session.flush()

    with pytest.raises(ValueError, match="reconciliation"):
        await post_event(
            db_session,
            finance_vendor.id,
            "manual",
            uuid.uuid4(),
            {"lines": [
                {"account_id": str(ar_acc.id), "debit": 100, "credit": 0},
                {"account_id": str(await _account_id_by_code(db_session, finance_vendor.id, "4100")), "debit": 0, "credit": 100},
            ]},
        )


@pytest.mark.asyncio
async def test_auto_posting_to_recon_account_succeeds(db_session, finance_vendor):
    """
    Invoice auto-posting must succeed even when AR (1130) is a reconciliation account.
    Subledger auto-posting handlers bypass the guard — only manual entries are blocked.
    """
    ar_acc = (
        await db_session.execute(
            select(FinAccount).where(
                FinAccount.vendor_id == finance_vendor.id, FinAccount.code == "1130"
            )
        )
    ).scalar_one()
    ar_acc.is_reconciliation_account = True
    ar_acc.reconciliation_subledger = "customer"
    await db_session.flush()

    je = await post_event(
        db_session, finance_vendor.id, "invoice", uuid.uuid4(),
        {"total": 118, "cgst": 9, "sgst": 9},
    )
    await db_session.commit()

    assert je is not None, "Invoice auto-posting must succeed even with recon account flag"
    assert je.status == "posted"
    assert je.total_debit == je.total_credit


@pytest.mark.asyncio
async def test_non_recon_account_manual_post_allowed(db_session, finance_vendor):
    """Manual journal to regular (non-reconciliation) accounts must succeed."""
    sales_id = await _account_id_by_code(db_session, finance_vendor.id, "4100")
    cash_id  = await _account_id_by_code(db_session, finance_vendor.id, "1110")

    je = await post_event(
        db_session,
        finance_vendor.id,
        "manual",
        uuid.uuid4(),
        {"lines": [
            # Pass UUID objects, not strings: SQLite test harness doesn't coerce str→UUID
            {"account_id": cash_id,  "debit": 50, "credit": 0,  "narration": "Cash in"},
            {"account_id": sales_id, "debit": 0,  "credit": 50, "narration": "Revenue"},
        ]},
    )
    await db_session.commit()
    assert je is not None
    assert je.total_debit == je.total_credit == 50
