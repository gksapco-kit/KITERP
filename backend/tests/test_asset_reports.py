"""
HTTP-level tests for the Fixed Asset reporting endpoints and a regression guard
for the /assets/maintenance route-ordering bug (it was previously registered
after /assets/{asset_id}, so Starlette matched "maintenance" as an asset_id
path param and returned 422 instead of reaching the real handler).

Also covers the Balance Sheet report shape fix (current/non-current split),
which the BalanceSheet.tsx page depends on but the repo previously returned
as a flat, uncategorized list.
"""
from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.deps import get_current_active_user, get_current_vendor_user
from app.database import get_db
from app.main import app
from app.models.finance import FinAccount, FinVendorBillLine
from app.models.procurement import Supplier
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.repositories.finance.finance_repo import FinAPRepo, FinAssetRepo
from app.services.finance.coa_seeder import (
    seed_default_asset_categories,
    seed_default_coa,
    seed_default_fiscal_year,
)
from app.services.finance.posting import post_event

BASE = "/api/v1/vendors/me/finance"


@pytest_asyncio.fixture
async def fin_client(db_session, test_user: User, test_vendor_user: VendorUser):
    async def _db():
        yield db_session

    async def _user():
        return test_user

    async def _vu():
        return test_vendor_user

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_active_user] = _user
    app.dependency_overrides[get_current_vendor_user] = _vu
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def asset_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await seed_default_asset_categories(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


@pytest.mark.asyncio
async def test_list_maintenance_route_is_reachable_not_shadowed_by_asset_id(
    fin_client: AsyncClient, asset_vendor: Vendor, test_vendor_user: VendorUser,
):
    """
    Regression: /assets/{asset_id} was registered before /assets/maintenance,
    so GET /assets/maintenance previously 422'd trying to parse "maintenance"
    as a UUID instead of listing maintenance records.
    """
    resp = await fin_client.get(f"{BASE}/assets/maintenance")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_asset_register_report(fin_client: AsyncClient, db_session, asset_vendor: Vendor):
    repo = FinAssetRepo(db_session)
    cat = (await repo.list_categories(asset_vendor.id))[0]
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-100", "name": "Report Asset", "category_id": cat.id,
        "acquisition_date": date.today(), "purchase_cost": 12000,
    })
    await db_session.commit()

    resp = await fin_client.get(f"{BASE}/assets/reports/register")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_cost"] >= 12000
    codes = [a["asset_code"] for a in body["assets"]]
    assert "FA-100" in codes
    assert any(b["category_name"] == cat.name for b in body["by_category"])


@pytest.mark.asyncio
async def test_depreciation_schedule_report(fin_client: AsyncClient, db_session, asset_vendor: Vendor):
    repo = FinAssetRepo(db_session)
    cat = (await repo.list_categories(asset_vendor.id))[0]
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-101", "name": "Dep Schedule Asset", "category_id": cat.id,
        "acquisition_date": date.today(), "purchase_cost": 36000,
        "useful_life_years": 3, "depreciation_method": "straight_line",
    })
    await db_session.flush()
    amount = await repo.calculate_depreciation(asset)
    je = await post_event(db_session, asset_vendor.id, "depreciation", asset.id, {
        "amount": float(amount), "narration": "Depreciation: Dep Schedule Asset",
        **await repo.get_category_accounts(asset),
    })
    await repo.record_depreciation(asset_vendor.id, asset, amount,
                                    period_id=je.period_id if je else None,
                                    je_id=je.id if je else None)
    await db_session.commit()

    today = date.today()
    resp = await fin_client.get(
        f"{BASE}/assets/reports/depreciation-schedule",
        params={"from_date": str(date(today.year, 1, 1)), "to_date": str(date(today.year, 12, 31))},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_amount"] == pytest.approx(float(amount))
    assert any(e["asset_code"] == "FA-101" for e in body["entries"])


@pytest.mark.asyncio
async def test_asset_reconciliation_matches_after_acquisition_and_depreciation(
    fin_client: AsyncClient, db_session, asset_vendor: Vendor,
):
    """Subledger (sum of asset.purchase_cost / accumulated_depreciation) must equal
    the posted GL balance of the category's mapped accounts — zero variance."""
    repo = FinAssetRepo(db_session)
    cat = (await repo.list_categories(asset_vendor.id))[0]
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-102", "name": "Recon Asset", "category_id": cat.id,
        "acquisition_date": date.today(), "purchase_cost": 24000,
        "useful_life_years": 2, "depreciation_method": "straight_line",
    })
    await db_session.flush()
    cat_accounts = await repo.get_category_accounts(asset)
    await post_event(db_session, asset_vendor.id, "asset", asset.id, {
        "cost": float(asset.purchase_cost), "narration": "Acquisition: Recon Asset",
        **cat_accounts,
    })
    amount = await repo.calculate_depreciation(asset)
    je = await post_event(db_session, asset_vendor.id, "depreciation", asset.id, {
        "amount": float(amount), "narration": "Depreciation: Recon Asset", **cat_accounts,
    })
    await repo.record_depreciation(asset_vendor.id, asset, amount,
                                    period_id=je.period_id if je else None,
                                    je_id=je.id if je else None)
    await db_session.commit()

    resp = await fin_client.get(f"{BASE}/assets/reports/reconciliation")
    assert resp.status_code == 200
    body = resp.json()
    fa_line = next(l for l in body["lines"] if l["role"] == "fixed_asset" and l["account_id"] == str(cat.asset_account_id))
    accum_line = next(l for l in body["lines"] if l["role"] == "accumulated_depreciation" and l["account_id"] == str(cat.accum_dep_account_id))
    assert fa_line["variance"] == pytest.approx(0)
    assert accum_line["variance"] == pytest.approx(0)
    assert accum_line["subledger_balance"] == pytest.approx(float(amount))


@pytest_asyncio.fixture
async def supplier(db_session, test_vendor: Vendor) -> Supplier:
    s = Supplier(vendor_id=test_vendor.id, name="Capital Equipment Co", party_type="supplier")
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest.mark.asyncio
async def test_capitalize_vendor_bill_line_creates_asset(
    fin_client: AsyncClient, db_session, asset_vendor: Vendor, supplier: Supplier,
):
    """A posted vendor bill line for capital equipment can be turned into a Fixed
    Asset register entry, without posting a duplicate GL entry."""
    asset_acc = (await db_session.execute(
        select(FinAccount).where(FinAccount.vendor_id == asset_vendor.id, FinAccount.code == "1220")
    )).scalar_one()

    ap_repo = FinAPRepo(db_session)
    bill = await ap_repo.create_bill(asset_vendor.id, {
        "supplier_id": supplier.id, "bill_no": "SUP-100", "bill_date": date.today(),
        "subtotal": 50000, "tax_amount": 0, "total": 50000, "balance_due": 50000,
        "lines": [{
            "account_id": asset_acc.id, "description": "3x Workstations",
            "quantity": 1, "unit_price": 50000, "line_total": 50000,
        }],
    })
    bill = await ap_repo.post_bill(bill)
    bill_id, supplier_id = bill.id, bill.supplier_id
    line_id = (await db_session.execute(
        select(FinVendorBillLine.id).where(FinVendorBillLine.bill_id == bill_id)
    )).scalar_one()
    je = await post_event(db_session, asset_vendor.id, "vendor_bill", bill_id, {
        "subtotal": 50000, "tax_amount": 0, "total": 50000,
        "expense_account_id": asset_acc.id, "supplier_id": supplier_id,
        "narration": "Vendor Bill SUP-100",
    })
    bill.journal_entry_id = je.id if je else None
    await db_session.commit()

    asset_repo = FinAssetRepo(db_session)
    cat = next(c for c in await asset_repo.list_categories(asset_vendor.id) if c.name == "Computers & Equipment")

    resp = await fin_client.post(f"{BASE}/assets/from-bill", json={
        "bill_line_id": str(line_id),
        "asset_code": "FA-200", "name": "Workstations Batch 1", "category_id": str(cat.id),
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["purchase_cost"] == 50000
    assert body["vendor_bill_id"] == str(bill.id)
    assert body["current_value"] == 50000

    # Bill detail view surfaces the linked asset for traceability.
    bill_resp = await fin_client.get(f"{BASE}/ap/bills/{bill_id}")
    assert bill_resp.status_code == 200
    linked = bill_resp.json()["linked_assets"]
    assert len(linked) == 1
    assert linked[0]["asset_code"] == "FA-200"

    # Re-capitalizing the same bill line must be rejected (no duplicate assets).
    dup_resp = await fin_client.post(f"{BASE}/assets/from-bill", json={
        "bill_line_id": str(line_id),
        "asset_code": "FA-201", "name": "Duplicate Attempt",
    })
    assert dup_resp.status_code == 400


@pytest.mark.asyncio
async def test_capitalize_draft_bill_is_rejected(
    fin_client: AsyncClient, db_session, asset_vendor: Vendor, supplier: Supplier,
):
    ap_repo = FinAPRepo(db_session)
    bill = await ap_repo.create_bill(asset_vendor.id, {
        "supplier_id": supplier.id, "bill_no": "SUP-101", "bill_date": date.today(),
        "subtotal": 10000, "tax_amount": 0, "total": 10000,
        "lines": [{"description": "Draft line", "quantity": 1, "unit_price": 10000, "line_total": 10000}],
    })
    line_id = (await db_session.execute(
        select(FinVendorBillLine.id).where(FinVendorBillLine.bill_id == bill.id)
    )).scalar_one()
    await db_session.commit()

    resp = await fin_client.post(f"{BASE}/assets/from-bill", json={
        "bill_line_id": str(line_id), "asset_code": "FA-202", "name": "Should Fail",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_balance_sheet_splits_current_and_non_current(
    fin_client: AsyncClient, db_session, asset_vendor: Vendor,
):
    """BalanceSheet.tsx reads current_assets/non_current_assets — the repo must
    emit that shape, not the old flat `assets` list."""
    resp = await fin_client.get(f"{BASE}/reports/balance-sheet")
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "current_assets", "non_current_assets", "total_current_assets", "total_non_current_assets",
        "current_liabilities", "non_current_liabilities", "equity", "total_assets",
        "total_liabilities", "total_equity",
    ):
        assert key in body
