"""Controlling Phase 1: tenant isolation, permissions, and input validation."""
from __future__ import annotations

import uuid
from datetime import date

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_current_vendor_user
from app.database import get_db
from app.main import app
from app.models.controlling import CoRouting, CoRoutingOperation, CoWorkCenter
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser
from app.services.controlling.seed_demo import seed_co_demo_data

CO = "/api/v1/vendors/me/controlling"


def _override(db_session, user, vendor_user):
    async def _db():
        yield db_session

    async def _user():
        return user

    async def _vu():
        return vendor_user

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_active_user] = _user
    app.dependency_overrides[get_current_vendor_user] = _vu


@pytest_asyncio.fixture
async def co_client(db_session, test_user: User, test_vendor_user: VendorUser):
    _override(db_session, test_user, test_vendor_user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def ro_client(db_session, test_user: User, test_vendor: Vendor):
    """Same vendor, but a user that may only view finance / controlling."""
    ro = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="staff", permissions=["controlling.view", "finance.view"], is_active=True,
    )
    _override(db_session, test_user, ro)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def company_id(db_session, test_vendor: Vendor, test_user: User) -> str:
    out = await seed_co_demo_data(
        db_session, test_vendor.id, test_user.id,
        demo_order_no=f"A-{uuid.uuid4().hex[:6]}", skip_if_order_exists=False,
    )
    await db_session.commit()
    return out["company_id"]


@pytest_asyncio.fixture
async def other_tenant(db_session, test_user: User) -> dict:
    """A second vendor with its own company, order, product and routing."""
    v = Vendor(
        id=uuid.uuid4(), business_name="Other Store", display_name="Other Store",
        slug=f"other-{uuid.uuid4().hex[:6]}", business_type="retail", offering_type="products",
        primary_email="other@test.com", primary_phone="9876500000",
        subdomain=f"oth-{uuid.uuid4().hex[:6]}", status="active",
    )
    db_session.add(v)
    await db_session.flush()
    seeded = await seed_co_demo_data(
        db_session, v.id, test_user.id, demo_order_no=f"B-{uuid.uuid4().hex[:6]}", skip_if_order_exists=False,
    )
    product = Product(
        id=uuid.uuid4(), vendor_id=v.id, name="Foreign product", slug=f"foreign-{uuid.uuid4().hex[:6]}",
        price=10, currency="INR", status="active", product_type="physical", quantity=1, created_by=test_user.id,
    )
    db_session.add(product)
    company = uuid.UUID(seeded["company_id"])
    wc = CoWorkCenter(id=uuid.uuid4(), vendor_id=v.id, company_id=company, code="FWC", name="Foreign WC")
    routing = CoRouting(id=uuid.uuid4(), vendor_id=v.id, company_id=company, code="FRT", name="Foreign RT")
    db_session.add_all([wc, routing])
    await db_session.flush()
    op = CoRoutingOperation(id=uuid.uuid4(), routing_id=routing.id, work_center_id=wc.id, seq_no=10)
    db_session.add(op)
    await db_session.commit()
    return {
        "vendor_id": v.id, "company_id": seeded["company_id"], "order_id": seeded["manufacturing_order_id"],
        "product_id": product.id, "routing_id": routing.id, "op_id": op.id, "wc_id": wc.id,
    }


# ── tenant isolation ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_activity_confirmation_rejects_foreign_order(co_client, company_id, other_tenant):
    r = await co_client.post(f"{CO}/activity-confirmations", json={
        "company_id": company_id, "order_id": other_tenant["order_id"],
        "confirmation_date": str(date.today()), "hours_confirmed": "5", "rate_per_hour": "10",
    })
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_goods_movement_rejects_foreign_order(co_client, company_id, other_tenant):
    r = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": company_id, "order_id": other_tenant["order_id"], "movement_type": "component_issue",
        "posting_date": str(date.today()), "qty": "1", "unit_cost": "1",
    })
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_budget_line_rejects_foreign_order(co_client, company_id, other_tenant):
    r = await co_client.post(f"{CO}/manufacturing-orders/{other_tenant['order_id']}/budget-lines", json={
        "company_id": company_id, "order_id": other_tenant["order_id"], "category": "material",
        "amount_budgeted": "100",
    })
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_routing_operation_endpoints_reject_foreign_routing(co_client, other_tenant):
    rid, oid = other_tenant["routing_id"], other_tenant["op_id"]
    assert (await co_client.patch(f"{CO}/routings/{rid}/operations/{oid}", json={"setup_hrs": "9"})).status_code == 404
    assert (await co_client.delete(f"{CO}/routings/{rid}/operations/{oid}")).status_code == 404
    assert (await co_client.post(f"{CO}/routings/{rid}/operations", json={"seq_no": 20})).status_code == 404
    assert (await co_client.patch(f"{CO}/routings/{rid}", json={"name": "hijack"})).status_code == 404
    assert (await co_client.delete(f"{CO}/routings/{rid}")).status_code == 404
    assert (await co_client.delete(f"{CO}/work-centers/{other_tenant['wc_id']}")).status_code == 404


@pytest.mark.asyncio
async def test_cost_version_rejects_foreign_product(co_client, company_id, other_tenant):
    r = await co_client.post(f"{CO}/product-costs", json={
        "company_id": company_id, "product_id": str(other_tenant["product_id"]),
        "version_code": "X1", "valid_from": str(date.today()),
    })
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_manufacturing_order_rejects_foreign_product_and_cost_line_refs(co_client, company_id, other_tenant):
    r = await co_client.post(f"{CO}/manufacturing-orders", json={
        "company_id": company_id, "product_id": str(other_tenant["product_id"]),
    })
    assert r.status_code == 404, r.text
    r2 = await co_client.post(f"{CO}/manufacturing-orders", json={
        "company_id": company_id,
        "cost_lines": [{"category": "material", "product_id": str(other_tenant["product_id"])}],
    })
    assert r2.status_code == 404, r2.text


@pytest.mark.asyncio
async def test_gl_mapping_rejects_unknown_account(co_client, company_id):
    r = await co_client.put(f"{CO}/co-gl-mapping", json={"company_id": company_id, "wip_account_id": str(uuid.uuid4())})
    assert r.status_code == 404, r.text


# ── permissions ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_read_only_user_can_read_but_not_write_master_data(ro_client, company_id, test_product):
    assert (await ro_client.get(f"{CO}/work-centers")).status_code == 200
    assert (await ro_client.get(f"{CO}/routings")).status_code == 200

    assert (await ro_client.post(f"{CO}/work-centers", json={"company_id": company_id, "code": "W1"})).status_code == 403
    assert (await ro_client.post(f"{CO}/routings", json={"company_id": company_id, "code": "R1"})).status_code == 403
    rid = uuid.uuid4()
    assert (await ro_client.patch(f"{CO}/work-centers/{rid}", json={"name": "x"})).status_code == 403
    assert (await ro_client.delete(f"{CO}/routings/{rid}")).status_code == 403
    assert (await ro_client.post(f"{CO}/routings/{rid}/operations", json={})).status_code == 403
    assert (await ro_client.patch(f"{CO}/product-costs/{rid}/routing", json={"routing_id": None})).status_code == 403
    assert (await ro_client.post(f"{CO}/product-costs/{rid}/apply-overhead", json={})).status_code == 403


@pytest.mark.asyncio
async def test_posting_requires_journal_post_permission(ro_client):
    rid = uuid.uuid4()
    assert (await ro_client.post(f"{CO}/variance-runs/{rid}/post", json={})).status_code == 403
    assert (await ro_client.post(f"{CO}/cost-allocations/{rid}/post", json={})).status_code == 403


# ── validation / conflicts ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invalid_input_is_422_not_500(co_client, company_id):
    base_alloc = {"company_id": company_id, "period_year": 2026}
    assert (await co_client.post(f"{CO}/cost-allocations", json={**base_alloc, "period_month": 13})).status_code == 422
    assert (await co_client.post(
        f"{CO}/cost-allocations", json={**base_alloc, "period_month": 5, "allocated_amount": "-1"}
    )).status_code == 422
    assert (await co_client.post(f"{CO}/goods-movements", json={
        "company_id": company_id, "order_id": str(uuid.uuid4()), "movement_type": "bogus",
        "posting_date": str(date.today()),
    })).status_code == 422
    assert (await co_client.post(f"{CO}/goods-movements", json={
        "company_id": company_id, "order_id": str(uuid.uuid4()), "movement_type": "component_issue",
        "posting_date": str(date.today()), "qty": "-3",
    })).status_code == 422
    assert (await co_client.post(f"{CO}/work-centers", json={"company_id": company_id})).status_code == 422
    assert (await co_client.post(
        f"{CO}/work-centers", json={"company_id": company_id, "code": "NEG", "labor_rate_per_hour": "-5"}
    )).status_code == 422
    assert (await co_client.post(f"{CO}/routings", json={"company_id": company_id, "code": "BAD", "lot_size": 0})).status_code == 422
    assert (await co_client.post(
        f"{CO}/manufacturing-orders", json={"company_id": company_id, "order_kind": "nonsense"}
    )).status_code == 422
    assert (await co_client.get(f"{CO}/period-end-report", params={"period_year": 2026, "period_month": 0})).status_code == 422
    assert (await co_client.get(f"{CO}/routings/not-a-uuid")).status_code == 422


# NOTE: a 409 rolls the (shared) test session back and expires its fixtures, so each conflict
# gets its own test. In production every request has its own session.

@pytest.mark.asyncio
async def test_duplicate_work_center_code_returns_409(co_client, company_id):
    body = {"company_id": company_id, "code": f"DUP-{uuid.uuid4().hex[:4]}"}
    assert (await co_client.post(f"{CO}/work-centers", json=body)).status_code == 201
    r = await co_client.post(f"{CO}/work-centers", json=body)
    assert r.status_code == 409
    assert "Conflict" in r.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_order_number_returns_409(co_client, company_id):
    mo = {"company_id": company_id, "order_no": f"DUP-{uuid.uuid4().hex[:6]}"}
    assert (await co_client.post(f"{CO}/manufacturing-orders", json=mo)).status_code == 201
    assert (await co_client.post(f"{CO}/manufacturing-orders", json=mo)).status_code == 409


@pytest.mark.asyncio
async def test_work_center_and_routing_crud_roundtrip(co_client, company_id):
    wc = await co_client.post(f"{CO}/work-centers", json={
        "company_id": company_id, "code": f"W-{uuid.uuid4().hex[:4]}", "labor_rate_per_hour": "12.5",
    })
    assert wc.status_code == 201, wc.text
    wid = wc.json()["id"]
    assert (await co_client.patch(f"{CO}/work-centers/{wid}", json={"labor_rate_per_hour": "20", "is_active": False})).status_code == 200
    listed = [w for w in (await co_client.get(f"{CO}/work-centers")).json() if w["id"] == wid][0]
    assert listed["labor_rate_per_hour"].startswith("20") and listed["is_active"] is False

    rt = await co_client.post(f"{CO}/routings", json={"company_id": company_id, "code": f"R-{uuid.uuid4().hex[:4]}"})
    assert rt.status_code == 201, rt.text
    rid = rt.json()["id"]
    op = await co_client.post(f"{CO}/routings/{rid}/operations", json={"work_center_id": wid, "seq_no": 10, "setup_hrs": "1"})
    assert op.status_code == 201, op.text
    oid = op.json()["id"]
    assert (await co_client.patch(
        f"{CO}/routings/{rid}/operations/{oid}", json={"labor_rate_override": "30"}
    )).status_code == 200
    got = (await co_client.get(f"{CO}/routings/{rid}")).json()
    assert got["operations"][0]["labor_rate_override"].startswith("30")
    assert (await co_client.delete(f"{CO}/routings/{rid}/operations/{oid}")).status_code == 204
    assert (await co_client.delete(f"{CO}/routings/{rid}")).status_code == 204
    assert (await co_client.delete(f"{CO}/work-centers/{wid}")).status_code == 204
