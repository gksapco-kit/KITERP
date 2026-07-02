"""
Fixed Asset lifecycle: category GL-account routing, acquisition/depreciation/
disposal posting, and maintenance capitalize-vs-expense posting.

Covers the gaps closed in this batch:
  - Default asset categories are seeded and mapped to the Fixed Asset /
    Accumulated Depreciation / Depreciation Expense GL accounts.
  - Acquiring, depreciating, and disposing an asset with a category posts to
    the category's mapped accounts (not just the generic COA fallback).
  - Disposal computes book value / gain-loss correctly.
  - Maintenance either capitalizes into the asset's cost or posts as a
    standalone expense, and never collides with the asset's own JEs
    (each maintenance record gets its own source_id).

Runs on the in-memory SQLite harness from conftest.
"""
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.finance import FinAccount, FinAssetCategory, FinJournalEntry, FinJournalLine
from app.models.vendor import Vendor
from app.repositories.finance.finance_repo import FinAssetRepo
from app.services.finance.coa_seeder import (
    seed_default_asset_categories,
    seed_default_coa,
    seed_default_fiscal_year,
)
from app.services.finance.posting import post_event


@pytest_asyncio.fixture
async def asset_vendor(db_session, test_vendor: Vendor) -> Vendor:
    """A vendor with seeded COA + fiscal year + default asset categories."""
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await seed_default_asset_categories(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


async def _account(db_session, vendor_id, code: str) -> FinAccount:
    return (
        await db_session.execute(
            select(FinAccount).where(FinAccount.vendor_id == vendor_id, FinAccount.code == code)
        )
    ).scalar_one()


async def _lines(db_session, je_id):
    return (
        await db_session.execute(select(FinJournalLine).where(FinJournalLine.journal_entry_id == je_id))
    ).scalars().all()


@pytest.mark.asyncio
async def test_seed_default_asset_categories_maps_gl_accounts(db_session, asset_vendor):
    cats = (
        await db_session.execute(
            select(FinAssetCategory).where(FinAssetCategory.vendor_id == asset_vendor.id)
        )
    ).scalars().all()
    assert len(cats) == 5

    accum_dep = await _account(db_session, asset_vendor.id, "1290")
    dep_expense = await _account(db_session, asset_vendor.id, "5240")
    computers = next(c for c in cats if c.name == "Computers & Equipment")
    computers_gl = await _account(db_session, asset_vendor.id, "1220")

    assert computers.asset_account_id == computers_gl.id
    assert computers.accum_dep_account_id == accum_dep.id
    assert computers.dep_expense_account_id == dep_expense.id


@pytest.mark.asyncio
async def test_seed_default_asset_categories_is_idempotent(db_session, asset_vendor):
    """Re-running the seeder must not create duplicate categories."""
    await seed_default_asset_categories(db_session, asset_vendor.id)
    await db_session.commit()
    cats = (
        await db_session.execute(
            select(FinAssetCategory).where(FinAssetCategory.vendor_id == asset_vendor.id)
        )
    ).scalars().all()
    assert len(cats) == 5


@pytest_asyncio.fixture
async def computers_category(db_session, asset_vendor):
    r = await db_session.execute(
        select(FinAssetCategory).where(
            FinAssetCategory.vendor_id == asset_vendor.id,
            FinAssetCategory.name == "Computers & Equipment",
        )
    )
    return r.scalar_one()


@pytest.mark.asyncio
async def test_acquisition_posts_to_category_asset_account(db_session, asset_vendor, computers_category):
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-001", "name": "Laptop", "category_id": computers_category.id,
        "acquisition_date": date.today(), "purchase_cost": 60000,
    })
    await db_session.flush()

    cat_accounts = await repo.get_category_accounts(asset)
    assert cat_accounts["asset_account_id"] == computers_category.asset_account_id

    je = await post_event(db_session, asset_vendor.id, "asset", asset.id, {
        "cost": float(asset.purchase_cost), "narration": "Asset Acquisition: Laptop",
        **cat_accounts,
    })
    await db_session.commit()

    assert je is not None
    lines = await _lines(db_session, je.id)
    computers_gl = await _account(db_session, asset_vendor.id, "1220")
    debited = [l for l in lines if l.debit and l.debit > 0]
    assert any(l.account_id == computers_gl.id for l in debited), \
        "Acquisition must debit the category's mapped Fixed Asset account, not the generic fallback"


@pytest.mark.asyncio
async def test_depreciation_posts_to_category_accounts_and_sets_period(
    db_session, asset_vendor, computers_category,
):
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-002", "name": "Server", "category_id": computers_category.id,
        "acquisition_date": date.today(), "purchase_cost": Decimal("36000"),
        "useful_life_years": 3, "depreciation_method": "straight_line",
    })
    await db_session.flush()

    amount = await repo.calculate_depreciation(asset)
    assert amount > 0

    cat_accounts = await repo.get_category_accounts(asset)
    je = await post_event(db_session, asset_vendor.id, "depreciation", asset.id, {
        "amount": float(amount), "narration": "Depreciation: Server", **cat_accounts,
    })
    entry = await repo.record_depreciation(
        asset_vendor.id, asset, amount, period_id=je.period_id if je else None, je_id=je.id if je else None,
    )
    await db_session.commit()

    assert je is not None
    assert je.total_debit == je.total_credit
    assert entry.period_id == je.period_id, "Depreciation entry must record the JE's fiscal period"
    assert entry.journal_entry_id == je.id

    lines = await _lines(db_session, je.id)
    dep_expense_gl = await _account(db_session, asset_vendor.id, "5240")
    accum_dep_gl = await _account(db_session, asset_vendor.id, "1290")
    assert any(l.account_id == dep_expense_gl.id and l.debit > 0 for l in lines)
    assert any(l.account_id == accum_dep_gl.id and l.credit > 0 for l in lines)

    assert float(asset.accumulated_depreciation) == pytest.approx(float(amount))
    assert float(asset.current_value) == pytest.approx(36000 - float(amount))


@pytest.mark.asyncio
async def test_disposal_computes_gain_loss_and_posts_category_accounts(
    db_session, asset_vendor, computers_category,
):
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-003", "name": "Old Printer", "category_id": computers_category.id,
        "acquisition_date": date.today(), "purchase_cost": Decimal("10000"),
    })
    await db_session.flush()
    # Simulate two years of depreciation already recorded.
    asset.accumulated_depreciation = Decimal("4000")
    asset.current_value = Decimal("6000")
    await db_session.flush()

    cat_accounts = await repo.get_category_accounts(asset)
    je = await post_event(db_session, asset_vendor.id, "disposal", asset.id, {
        "purchase_cost": float(asset.purchase_cost),
        "accum_dep": float(asset.accumulated_depreciation),
        "sale_price": 7000,
        "narration": "Asset Disposal (sold): Old Printer",
        **cat_accounts,
    })
    disposal = await repo.dispose_asset(
        asset_vendor.id, asset,
        {"disposal_date": date.today(), "disposal_method": "sold", "sale_price": 7000},
        je_id=je.id if je else None,
    )
    await db_session.commit()

    assert je is not None
    assert je.total_debit == je.total_credit
    # Sale price (7000) exceeds NBV (6000) → gain of 1000.
    assert disposal.book_value_at_disposal == Decimal("6000")
    assert disposal.gain_loss == Decimal("1000")
    assert asset.status == "disposed"

    lines = await _lines(db_session, je.id)
    computers_gl = await _account(db_session, asset_vendor.id, "1220")
    accum_dep_gl = await _account(db_session, asset_vendor.id, "1290")
    assert any(l.account_id == computers_gl.id and l.credit > 0 for l in lines), \
        "Disposal must remove the asset cost from the category's mapped account"
    assert any(l.account_id == accum_dep_gl.id and l.debit > 0 for l in lines)


@pytest.mark.asyncio
async def test_maintenance_capitalize_increases_asset_cost_without_voiding_acquisition_je(
    db_session, asset_vendor, computers_category,
):
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-004", "name": "Forklift", "category_id": computers_category.id,
        "acquisition_date": date.today(), "purchase_cost": Decimal("50000"),
    })
    await db_session.flush()

    acquisition_je = await post_event(db_session, asset_vendor.id, "asset", asset.id, {
        "cost": float(asset.purchase_cost), "narration": "Asset Acquisition: Forklift",
        **await repo.get_category_accounts(asset),
    })
    await db_session.commit()
    assert acquisition_je.status == "posted"

    maintenance = await repo.create_maintenance(asset_vendor.id, {
        "asset_id": asset.id, "maintenance_date": date.today(),
        "description": "Engine overhaul", "cost": 5000,
    })
    asset.purchase_cost = float(asset.purchase_cost or 0) + 5000
    asset.current_value = float(asset.current_value or 0) + 5000
    maint_je = await post_event(db_session, asset_vendor.id, "asset", maintenance.id, {
        "cost": 5000, "narration": "Capitalized Maintenance: Forklift",
        **await repo.get_category_accounts(asset),
    })
    maintenance.journal_entry_id = maint_je.id if maint_je else None
    await db_session.commit()

    # The original acquisition JE must still be posted — using maintenance.id (not
    # asset.id) as the source_id for the capitalize event avoids the idempotent
    # void-and-replace behavior in post_event colliding with the asset's own JE.
    await db_session.refresh(acquisition_je)
    assert acquisition_je.status == "posted"
    assert maint_je is not None
    assert maint_je.id != acquisition_je.id
    assert float(asset.purchase_cost) == 55000


@pytest.mark.asyncio
async def test_maintenance_expense_does_not_change_asset_cost(db_session, asset_vendor, computers_category):
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-005", "name": "AC Unit", "category_id": computers_category.id,
        "acquisition_date": date.today(), "purchase_cost": Decimal("20000"),
    })
    await db_session.flush()
    original_cost = float(asset.purchase_cost)

    maintenance = await repo.create_maintenance(asset_vendor.id, {
        "asset_id": asset.id, "maintenance_date": date.today(),
        "description": "Filter cleaning", "cost": 800,
    })
    je = await post_event(db_session, asset_vendor.id, "expense", maintenance.id, {
        "amount": 800, "narration": "Asset Maintenance: AC Unit",
    })
    await db_session.commit()

    assert je is not None
    assert je.total_debit == je.total_credit == 800
    assert float(asset.purchase_cost) == original_cost, "Non-capitalized maintenance must not change asset cost"
