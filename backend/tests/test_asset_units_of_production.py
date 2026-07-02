"""
Units-of-production depreciation method.

Covers:
  - calculate_depreciation() computes per-unit rate = (cost - salvage) / capacity,
    caps to remaining depreciable value, and never lets cumulative units exceed capacity.
  - record_depreciation() accumulates asset.units_consumed alongside the usual
    accumulated_depreciation / current_value bookkeeping.
  - The POST /assets/{id}/depreciate endpoint requires a `units` payload for this
    method and rejects assets that have no total_units_capacity configured.

Runs on the in-memory SQLite harness from conftest.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_current_vendor_user
from app.database import get_db
from app.main import app
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.repositories.finance.finance_repo import FinAssetRepo
from app.services.finance.coa_seeder import (
    seed_default_asset_categories,
    seed_default_coa,
    seed_default_fiscal_year,
)

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
async def test_calculate_depreciation_units_of_production(db_session, asset_vendor):
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-300", "name": "Stamping Press", "acquisition_date": date.today(),
        "purchase_cost": Decimal("100000"), "salvage_value": Decimal("10000"),
        "depreciation_method": "units_of_production", "total_units_capacity": Decimal("90000"),
    })
    await db_session.flush()

    # rate/unit = (100000 - 10000) / 90000 = 1.0
    amount = await repo.calculate_depreciation(asset, units=Decimal("1000"))
    assert amount == pytest.approx(1000, abs=0.01)

    entry = await repo.record_depreciation(asset_vendor.id, asset, amount, units=Decimal("1000"))
    await db_session.commit()

    assert entry.units_produced == Decimal("1000")
    assert float(asset.units_consumed) == pytest.approx(1000)
    assert float(asset.accumulated_depreciation) == pytest.approx(1000)
    assert float(asset.current_value) == pytest.approx(99000)


@pytest.mark.asyncio
async def test_calculate_depreciation_units_of_production_caps_at_capacity(db_session, asset_vendor):
    """Depreciation must never exceed (cost - salvage) even if reported units
    overshoot the asset's remaining lifetime capacity."""
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-301", "name": "CNC Machine", "acquisition_date": date.today(),
        "purchase_cost": Decimal("50000"), "salvage_value": Decimal("0"),
        "depreciation_method": "units_of_production", "total_units_capacity": Decimal("1000"),
    })
    await db_session.flush()

    # First period consumes 900 of the 1000 unit capacity.
    amount1 = await repo.calculate_depreciation(asset, units=Decimal("900"))
    await repo.record_depreciation(asset_vendor.id, asset, amount1, units=Decimal("900"))
    await db_session.commit()
    assert float(asset.units_consumed) == pytest.approx(900)
    assert float(asset.current_value) == pytest.approx(5000)

    # Reporting 500 more units (only 100 of capacity remain) must cap the
    # depreciation to the remaining book value, not blow past salvage.
    amount2 = await repo.calculate_depreciation(asset, units=Decimal("500"))
    assert amount2 == pytest.approx(5000, abs=0.01)


@pytest.mark.asyncio
async def test_depreciate_endpoint_requires_units_for_units_of_production(
    fin_client: AsyncClient, db_session, asset_vendor: Vendor,
):
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-302", "name": "Bottling Line", "acquisition_date": date.today(),
        "purchase_cost": Decimal("20000"), "depreciation_method": "units_of_production",
        "total_units_capacity": Decimal("2000"),
    })
    await db_session.commit()

    resp = await fin_client.post(f"{BASE}/assets/{asset.id}/depreciate", json={})
    assert resp.status_code == 400

    resp2 = await fin_client.post(f"{BASE}/assets/{asset.id}/depreciate", json={"units": 200})
    assert resp2.status_code == 200
    body = resp2.json()
    assert body["amount"] == pytest.approx(2000, abs=0.01)


@pytest.mark.asyncio
async def test_depreciate_endpoint_rejects_missing_capacity(
    fin_client: AsyncClient, db_session, asset_vendor: Vendor,
):
    repo = FinAssetRepo(db_session)
    asset = await repo.create_asset(asset_vendor.id, {
        "asset_code": "FA-303", "name": "No Capacity Asset", "acquisition_date": date.today(),
        "purchase_cost": Decimal("15000"), "depreciation_method": "units_of_production",
    })
    await db_session.commit()

    resp = await fin_client.post(f"{BASE}/assets/{asset.id}/depreciate", json={"units": 100})
    assert resp.status_code == 400
