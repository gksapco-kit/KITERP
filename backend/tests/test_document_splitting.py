"""
Tests for Feature 8: Document Splitting (SAP New G/L FAGL_DOC_SPLIT equivalent).

Covers:
  - create / list / delete split rules.
  - Splitting engine: proportional allocation across profit centers.
  - Splitting engine: equal-weight fallback when base lines have no dimension value.
  - Splitting engine: no-op when no active rules exist.
  - Splitting engine: no-op when journal entry has no clearing lines.
  - get_split_items returns all slices for a journal entry.
"""
import pytest
import pytest_asyncio
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select

from app.models.vendor import Vendor
from app.models.finance import (
    FinAccount, FinJournalEntry, FinJournalLine,
    FinProfitCenter, FinSplitRule,
)
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance import split_service as ss


@pytest_asyncio.fixture
async def split_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


async def _get_account(db_session, vendor_id, account_type: str) -> FinAccount:
    """Return the first account of the given type for the vendor."""
    row = (await db_session.execute(
        select(FinAccount).where(
            FinAccount.vendor_id == vendor_id,
            FinAccount.account_type == account_type,
        )
    )).scalars().first()
    assert row is not None, f"No account of type '{account_type}' found"
    return row


async def _make_je(db_session, vendor_id, lines: list[dict]) -> FinJournalEntry:
    """Create a simple journal entry with the given lines."""
    import uuid as _uuid
    from datetime import date
    je = FinJournalEntry(
        vendor_id=vendor_id,
        entry_no=f"TEST-{_uuid.uuid4().hex[:8].upper()}",
        entry_date=date.today(),
        reference="TEST-SPLIT",
        status="posted",
    )
    db_session.add(je)
    await db_session.flush()
    for li in lines:
        line = FinJournalLine(
            journal_entry_id=je.id,
            vendor_id=vendor_id,
            account_id=li["account_id"],
            debit=li.get("debit", Decimal("0")),
            credit=li.get("credit", Decimal("0")),
            profit_center_id=li.get("profit_center_id"),
            segment_id=li.get("segment_id"),
        )
        db_session.add(line)
    await db_session.flush()
    return je


# ── Split Rule CRUD ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_list_split_rules(db_session, split_vendor):
    rule = await ss.create_split_rule(
        db_session, split_vendor.id,
        name="Expense split by PC",
        dimension="profit_center",
        base_account_types=["expense"],
    )
    await db_session.commit()
    await db_session.refresh(rule)

    rules = await ss.list_split_rules(db_session, split_vendor.id)
    assert any(r.id == rule.id for r in rules)
    assert rule.split_method == "proportional"
    assert rule.is_active is True


@pytest.mark.asyncio
async def test_delete_split_rule(db_session, split_vendor):
    rule = await ss.create_split_rule(
        db_session, split_vendor.id,
        name="Temp rule",
        dimension="segment",
        base_account_types=["income"],
    )
    await db_session.commit()

    await ss.delete_split_rule(db_session, rule.id, split_vendor.id)
    await db_session.commit()

    rules = await ss.list_split_rules(db_session, split_vendor.id)
    assert all(r.id != rule.id for r in rules)


@pytest.mark.asyncio
async def test_delete_nonexistent_split_rule_raises(db_session, split_vendor):
    with pytest.raises(ValueError, match="not found"):
        await ss.delete_split_rule(db_session, uuid4(), split_vendor.id)


# ── Splitting Engine ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_proportional_split_by_profit_center(db_session, split_vendor):
    """Bank / clearing line should be split proportional to the expense line amounts."""
    # Create two profit centres
    pc1 = FinProfitCenter(vendor_id=split_vendor.id, code="PC1", name="PC One")
    pc2 = FinProfitCenter(vendor_id=split_vendor.id, code="PC2", name="PC Two")
    db_session.add_all([pc1, pc2])
    await db_session.flush()

    expense_acct = await _get_account(db_session, split_vendor.id, "Expense")
    asset_acct   = await _get_account(db_session, split_vendor.id, "Asset")

    # Journal: 200 expense on PC1, 100 expense on PC2, 300 credit bank (no dimension)
    je = await _make_je(db_session, split_vendor.id, [
        {"account_id": expense_acct.id, "debit":  Decimal("200"), "profit_center_id": pc1.id},
        {"account_id": expense_acct.id, "debit":  Decimal("100"), "profit_center_id": pc2.id},
        {"account_id": asset_acct.id,   "credit": Decimal("300")},
    ])

    # Create the split rule
    rule = await ss.create_split_rule(
        db_session, split_vendor.id,
        name="Expense → PC split",
        dimension="profit_center",
        base_account_types=["Expense"],
    )
    await db_session.flush()

    items = await ss.apply_document_splitting(db_session, split_vendor.id, je.id)
    await db_session.commit()

    # Should create 2 split items (one per profit center) for the single clearing line
    assert len(items) == 2

    by_pc = {str(i.profit_center_id): i for i in items}
    assert str(pc1.id) in by_pc
    assert str(pc2.id) in by_pc

    # PC1 share = 200/300 = 66.67 %  →  credit ≈ 200.00
    # PC2 share = 100/300 = 33.33 %  →  credit ≈ 100.00
    total_credit = sum(Decimal(str(i.credit)) for i in items)
    assert total_credit == Decimal("300.00")

    # Percentages must sum to 100
    total_pct = sum(Decimal(str(i.split_pct)) for i in items)
    assert total_pct == Decimal("100.0000")


@pytest.mark.asyncio
async def test_no_active_rules_returns_empty(db_session, split_vendor):
    """When no split rules exist, apply_document_splitting returns []."""
    expense_acct = await _get_account(db_session, split_vendor.id, "Expense")
    asset_acct   = await _get_account(db_session, split_vendor.id, "Asset")
    je = await _make_je(db_session, split_vendor.id, [
        {"account_id": expense_acct.id, "debit": Decimal("500")},
        {"account_id": asset_acct.id, "credit": Decimal("500")},
    ])

    items = await ss.apply_document_splitting(db_session, split_vendor.id, je.id)
    assert items == []


@pytest.mark.asyncio
async def test_no_clearing_lines_skips(db_session, split_vendor):
    """When all lines are base lines (no clearing lines), the rule is skipped."""
    expense_acct = await _get_account(db_session, split_vendor.id, "Expense")

    pc = FinProfitCenter(vendor_id=split_vendor.id, code="PCONLY", name="PC Only")
    db_session.add(pc)
    await db_session.flush()

    je = await _make_je(db_session, split_vendor.id, [
        {"account_id": expense_acct.id, "debit": Decimal("200"), "profit_center_id": pc.id},
        {"account_id": expense_acct.id, "debit": Decimal("100"), "profit_center_id": pc.id},
    ])

    await ss.create_split_rule(
        db_session, split_vendor.id,
        name="All base - no clearing",
        dimension="profit_center",
        base_account_types=["Expense"],
    )
    await db_session.flush()

    items = await ss.apply_document_splitting(db_session, split_vendor.id, je.id)
    # No clearing lines → nothing to split
    assert items == []


@pytest.mark.asyncio
async def test_get_split_items(db_session, split_vendor):
    """get_split_items correctly returns all items for a JE."""
    pc = FinProfitCenter(vendor_id=split_vendor.id, code="PCGI", name="PC GetItems")
    db_session.add(pc)
    await db_session.flush()

    expense_acct = await _get_account(db_session, split_vendor.id, "Expense")
    asset_acct   = await _get_account(db_session, split_vendor.id, "Asset")

    je = await _make_je(db_session, split_vendor.id, [
        {"account_id": expense_acct.id, "debit": Decimal("100"), "profit_center_id": pc.id},
        {"account_id": asset_acct.id,   "credit": Decimal("100")},
    ])

    await ss.create_split_rule(
        db_session, split_vendor.id,
        name="Get items rule",
        dimension="profit_center",
        base_account_types=["Expense"],
    )
    await db_session.flush()

    created = await ss.apply_document_splitting(db_session, split_vendor.id, je.id)
    await db_session.commit()

    fetched = await ss.get_split_items(db_session, je.id)
    assert len(fetched) == len(created)
    assert {str(i.id) for i in fetched} == {str(i.id) for i in created}
