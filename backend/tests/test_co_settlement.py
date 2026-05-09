"""Tests for CO demo seed and GL settlement posting."""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user, get_current_vendor_user
from app.database import get_db
from app.main import app
from app.models.controlling import CoManufacturingOrder
from app.models.finance import FinJournalEntry
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.services.controlling.seed_demo import seed_co_demo_data
from app.services.controlling.settlement import (
    post_cogs_issue,
    post_production_completion,
    sum_order_planned_actual,
)

CO_BASE = "/api/v1/vendors/me/controlling"


@pytest_asyncio.fixture
async def co_client(
    db_session,
    test_user: User,
    test_vendor_user: VendorUser,
):
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


@pytest.mark.asyncio
async def test_seed_co_demo_creates_order_with_planned_and_actual(
    db_session,
    test_vendor: Vendor,
    test_user: User,
):
    ono = f"CO-T-{uuid.uuid4().hex[:8]}"
    out = await seed_co_demo_data(
        db_session,
        test_vendor.id,
        test_user.id,
        demo_order_no=ono,
        skip_if_order_exists=False,
    )
    await db_session.commit()
    assert out.get("skipped") is False
    r = await db_session.execute(
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(CoManufacturingOrder.id == uuid.UUID(out["manufacturing_order_id"]))
    )
    mo = r.scalar_one()
    planned, actual = sum_order_planned_actual(mo)
    assert planned == Decimal("765")
    assert actual == Decimal("810")


@pytest.mark.asyncio
async def test_seed_co_demo_skips_when_order_exists(
    db_session,
    test_vendor: Vendor,
    test_user: User,
):
    ono = f"CO-T-{uuid.uuid4().hex[:8]}"
    await seed_co_demo_data(
        db_session,
        test_vendor.id,
        test_user.id,
        demo_order_no=ono,
        skip_if_order_exists=False,
    )
    await db_session.commit()
    out2 = await seed_co_demo_data(
        db_session,
        test_vendor.id,
        test_user.id,
        demo_order_no=ono,
        skip_if_order_exists=True,
    )
    assert out2.get("skipped") is True


@pytest.mark.asyncio
async def test_post_production_completion_creates_balanced_journal(
    db_session,
    test_vendor: Vendor,
    test_user: User,
    test_vendor_user: VendorUser,
):
    ono = f"CO-T-{uuid.uuid4().hex[:8]}"
    await seed_co_demo_data(
        db_session,
        test_vendor.id,
        test_user.id,
        demo_order_no=ono,
        skip_if_order_exists=False,
    )
    await db_session.commit()
    r = await db_session.execute(select(CoManufacturingOrder).where(CoManufacturingOrder.order_no == ono))
    mo = r.scalar_one()
    await post_production_completion(db_session, test_vendor.id, mo.id, test_vendor_user.id)
    await db_session.commit()

    r2 = await db_session.execute(
        select(FinJournalEntry).where(FinJournalEntry.source_type == "co_cost_booking")
    )
    jes = r2.scalars().all()
    assert len(jes) == 1
    je = jes[0]
    assert je.total_debit == je.total_credit
    assert je.total_debit == Decimal("810")


@pytest.mark.asyncio
async def test_post_production_completion_twice_raises(
    db_session,
    test_vendor: Vendor,
    test_user: User,
    test_vendor_user: VendorUser,
):
    ono = f"CO-T-{uuid.uuid4().hex[:8]}"
    await seed_co_demo_data(
        db_session,
        test_vendor.id,
        test_user.id,
        demo_order_no=ono,
        skip_if_order_exists=False,
    )
    await db_session.commit()
    r = await db_session.execute(select(CoManufacturingOrder).where(CoManufacturingOrder.order_no == ono))
    mo = r.scalar_one()
    await post_production_completion(db_session, test_vendor.id, mo.id, test_vendor_user.id)
    await db_session.commit()
    with pytest.raises(ValueError, match="already posted"):
        await post_production_completion(db_session, test_vendor.id, mo.id, test_vendor_user.id)


@pytest.mark.asyncio
async def test_post_cogs_issue_after_production(
    db_session,
    test_vendor: Vendor,
    test_user: User,
    test_vendor_user: VendorUser,
):
    ono = f"CO-T-{uuid.uuid4().hex[:8]}"
    await seed_co_demo_data(
        db_session,
        test_vendor.id,
        test_user.id,
        demo_order_no=ono,
        skip_if_order_exists=False,
    )
    await db_session.commit()
    r = await db_session.execute(select(CoManufacturingOrder).where(CoManufacturingOrder.order_no == ono))
    mo = r.scalar_one()
    await post_production_completion(db_session, test_vendor.id, mo.id, test_vendor_user.id)
    await db_session.commit()
    await post_cogs_issue(db_session, test_vendor.id, mo.id, test_vendor_user.id)
    await db_session.commit()

    r2 = await db_session.execute(
        select(FinJournalEntry)
        .where(FinJournalEntry.source_type == "co_cost_booking")
        .order_by(FinJournalEntry.entry_no)
    )
    jes = r2.scalars().all()
    assert len(jes) == 2
    # Unit actual 810/10 = 81; COGS for qty 4 => 324
    assert jes[1].total_debit == Decimal("324")
    assert jes[1].total_credit == Decimal("324")


@pytest.mark.asyncio
async def test_co_gl_mapping_get_and_manufacturing_order_detail(
    co_client: AsyncClient,
    db_session,
    test_vendor: Vendor,
    test_user: User,
):
    ono = f"CO-T-{uuid.uuid4().hex[:8]}"
    summary = await seed_co_demo_data(
        db_session,
        test_vendor.id,
        test_user.id,
        demo_order_no=ono,
        skip_if_order_exists=False,
    )
    await db_session.commit()
    company_id = summary["company_id"]

    r_map = await co_client.get(f"{CO_BASE}/co-gl-mapping", params={"company_id": company_id})
    assert r_map.status_code == 200
    body = r_map.json()
    assert body is not None
    assert body["company_id"] == company_id
    assert body["wip_account_id"] is not None
    assert body["finished_goods_account_id"] is not None
    assert body["cogs_account_id"] is not None

    mo_id = summary["manufacturing_order_id"]
    r_mo = await co_client.get(f"{CO_BASE}/manufacturing-orders/{mo_id}")
    assert r_mo.status_code == 200
    mo_json = r_mo.json()
    assert mo_json["order_no"] == ono
    assert mo_json["settlement_status"] == "none"
    assert len(mo_json["cost_lines"]) == 3
    assert len(mo_json.get("cost_bookings", [])) == 0
