"""
Phase 12 — posting completeness.

  * readiness dry-run covers every document type on a default chart
  * ensure_default_accounts backfills an old chart without duplicating
  * safe_post queues failures, retry resolves them (Decimal/UUID/date round-trip)
  * partial invoice payments no longer supersede each other
  * unposted-document report + repost
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from app.models.finance import (
    FinAccount, FinJournalEntry, FinPostingFailure,
)
from app.models.invoice import Invoice
from app.models.vendor import Vendor
from app.services.finance.coa_seeder import (
    ensure_default_accounts, seed_default_coa, seed_default_fiscal_year,
)
from app.services.finance.posting import post_event
from app.services.finance.safe_posting import (
    posting_readiness, retry_failure, safe_post,
)


@pytest_asyncio.fixture
async def finance_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


# ── readiness ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_readiness_all_ready_on_default_chart(db_session, finance_vendor):
    items = await posting_readiness(db_session, finance_vendor.id)
    not_ready = {i["source_type"]: i["detail"] for i in items if not i["ready"]}
    assert not not_ready, not_ready


@pytest.mark.asyncio
async def test_readiness_reports_missing_accounts(db_session, test_vendor):
    # No COA at all
    items = await posting_readiness(db_session, test_vendor.id)
    assert items and all(not i["ready"] for i in items)


# ── ensure_default_accounts ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ensure_default_accounts_backfills_and_is_idempotent(db_session, finance_vendor):
    # Simulate an old tenant created before the statutory accounts existed.
    await db_session.execute(delete(FinAccount).where(
        FinAccount.vendor_id == finance_vendor.id,
        FinAccount.code.in_(["2170", "2180", "2190", "2195", "5211", "5212", "5295"]),
    ))
    await db_session.commit()
    before = {i["source_type"]: i["ready"] for i in await posting_readiness(db_session, finance_vendor.id)}
    assert before["payroll"] is False

    added = await ensure_default_accounts(db_session, finance_vendor.id)
    await db_session.commit()
    assert set(added) == {"2170", "2180", "2190", "2195", "5211", "5212", "5295"}

    after = {i["source_type"]: i["ready"] for i in await posting_readiness(db_session, finance_vendor.id)}
    assert after["payroll"] is True
    assert await ensure_default_accounts(db_session, finance_vendor.id) == []


@pytest.mark.asyncio
async def test_ensure_default_accounts_respects_renamed_accounts(db_session, finance_vendor):
    acc = (await db_session.execute(select(FinAccount).where(
        FinAccount.vendor_id == finance_vendor.id, FinAccount.code == "2170"))).scalar_one()
    acc.code = "9999"            # tenant renumbered the account; name is unchanged
    await db_session.commit()
    assert "2170" not in await ensure_default_accounts(db_session, finance_vendor.id)


# ── safe_post / failure queue ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_safe_post_queues_failure_then_retry_resolves(db_session, test_vendor):
    src = uuid.uuid4()
    cust = uuid.uuid4()
    payload = {"total": Decimal("118.00"), "cgst": Decimal("9"), "sgst": Decimal("9"),
               "customer_id": cust, "entry_date": date.today(), "narration": "INV-X"}

    # Tenant has no chart of accounts → cannot post
    assert await safe_post(db_session, test_vendor.id, "invoice", src, payload) is None
    await db_session.commit()
    row = (await db_session.execute(select(FinPostingFailure).where(
        FinPostingFailure.source_id == src))).scalar_one()
    assert row.status == "open" and row.attempts == 1 and row.error

    # Same document fails again → same row, attempts incremented
    assert await safe_post(db_session, test_vendor.id, "invoice", src, payload) is None
    await db_session.commit()
    rows = (await db_session.execute(select(FinPostingFailure).where(
        FinPostingFailure.source_id == src))).scalars().all()
    assert len(rows) == 1 and rows[0].attempts == 2

    # Finance fixes the setup, then retries
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    res = await retry_failure(db_session, rows[0])
    await db_session.commit()
    assert res["status"] == "resolved"
    await db_session.refresh(rows[0])
    assert rows[0].status == "resolved" and rows[0].journal_entry_id is not None
    je = (await db_session.execute(select(FinJournalEntry).where(
        FinJournalEntry.source_id == src))).scalar_one()
    assert je.total_debit == je.total_credit == Decimal("118.00")

    # Retrying again never double-posts
    res2 = await retry_failure(db_session, rows[0])
    assert res2.get("already_posted") is True
    jes = (await db_session.execute(select(FinJournalEntry).where(
        FinJournalEntry.source_id == src, FinJournalEntry.status == "posted"))).scalars().all()
    assert len(jes) == 1


@pytest.mark.asyncio
async def test_safe_post_success_leaves_no_failure(db_session, finance_vendor):
    src = uuid.uuid4()
    je = await safe_post(db_session, finance_vendor.id, "expense", src, {"amount": Decimal("50")})
    await db_session.commit()
    assert je is not None
    assert (await db_session.execute(select(FinPostingFailure).where(
        FinPostingFailure.source_id == src))).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_payroll_missing_statutory_account_is_named(db_session, finance_vendor):
    await db_session.execute(delete(FinAccount).where(
        FinAccount.vendor_id == finance_vendor.id, FinAccount.code == "2170"))
    await db_session.commit()
    src = uuid.uuid4()
    je = await safe_post(db_session, finance_vendor.id, "payroll", src, {
        "gross_total": Decimal("1000"), "net_total": Decimal("950"), "pf_employee": Decimal("50"),
    })
    await db_session.commit()
    assert je is None
    row = (await db_session.execute(select(FinPostingFailure).where(
        FinPostingFailure.source_id == src))).scalar_one()
    assert "PF Payable" in row.error


# ── partial payments ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_partial_payments_each_keep_their_own_entry(db_session, finance_vendor):
    from app.services.invoice_service import payment_source_id
    inv_id = uuid.uuid4()
    p1 = payment_source_id(inv_id, Decimal("40"))
    p2 = payment_source_id(inv_id, Decimal("100"))
    assert p1 != p2 and p1 == payment_source_id(inv_id, 40.0)   # distinct but deterministic

    await post_event(db_session, finance_vendor.id, "payment", p1, {"amount": Decimal("40")})
    await post_event(db_session, finance_vendor.id, "payment", p2, {"amount": Decimal("60")})
    await db_session.commit()
    live = (await db_session.execute(select(FinJournalEntry).where(
        FinJournalEntry.vendor_id == finance_vendor.id,
        FinJournalEntry.source_type == "payment",
        FinJournalEntry.status == "posted"))).scalars().all()
    assert len(live) == 2
    assert sum(j.total_debit for j in live) == Decimal("100")


# ── unposted report + repost ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unposted_invoice_listed_and_reposted(db_session, finance_vendor):
    from app.services.finance.posting_audit import find_unposted, repost_document
    inv = Invoice(
        id=uuid.uuid4(), vendor_id=finance_vendor.id, invoice_number="INV-U-1",
        invoice_type="invoice", total=Decimal("118"), cgst_amount=Decimal("9"),
        sgst_amount=Decimal("9"), igst_amount=Decimal("0"), status="sent",
        invoice_date=date.today(), items=[], amount_paid=0, balance_due=118,
        financial_year="2026-27", sequence_number=1, subtotal=100,
    )
    db_session.add(inv)
    await db_session.commit()

    rep = await find_unposted(db_session, finance_vendor.id)
    assert [r["number"] for r in rep["invoice"]] == ["INV-U-1"]

    res = await repost_document(db_session, finance_vendor.id, "invoice", inv.id)
    await db_session.commit()
    assert res["posted"] is True

    rep = await find_unposted(db_session, finance_vendor.id)
    assert rep["invoice"] == []


@pytest.mark.asyncio
async def test_repost_rejects_draft_invoice(db_session, finance_vendor):
    from app.services.finance.posting_audit import repost_document
    inv = Invoice(
        id=uuid.uuid4(), vendor_id=finance_vendor.id, invoice_number="INV-D-1",
        invoice_type="invoice", total=Decimal("10"), status="draft", invoice_date=date.today(),
        items=[], amount_paid=0, balance_due=10, financial_year="2026-27", sequence_number=2, subtotal=10,
    )
    db_session.add(inv)
    await db_session.commit()
    with pytest.raises(ValueError):
        await repost_document(db_session, finance_vendor.id, "invoice", inv.id)
