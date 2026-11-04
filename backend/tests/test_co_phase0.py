"""Controlling hot-fixes: routing attach, overhead apply, status transitions, pool formula fields."""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_current_vendor_user
from app.database import get_db
from app.main import app
from app.models.vendor_product import Product
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.services.controlling.seed_demo import seed_co_demo_data

CO = "/api/v1/vendors/me/controlling"


@pytest_asyncio.fixture
async def co_client(db_session, test_user: User, test_vendor_user: VendorUser):
    async def _db():
        yield db_session

    async def _user():
        return test_user

    async def _vu():
        return test_vendor_user

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_active_user] = _user
    app.dependency_overrides[get_current_vendor_user] = _vu
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def company_id(db_session, test_vendor: Vendor, test_user: User) -> str:
    summary = await seed_co_demo_data(
        db_session, test_vendor.id, test_user.id,
        demo_order_no=f"CO-P0-{uuid.uuid4().hex[:6]}", skip_if_order_exists=False,
    )
    await db_session.commit()
    return summary["company_id"]


async def _cost_version(client, company_id: str, product: Product) -> dict:
    r = await client.post(f"{CO}/product-costs", json={
        "company_id": company_id,
        "product_id": str(product.id),
        "version_code": f"V-{uuid.uuid4().hex[:6]}",
        "valid_from": str(date.today()),
        "status": "draft",
        "lines": [{"line_type": "material", "description": "Steel", "qty_per_output_unit": "2", "unit_rate_planned": "10"}],
    })
    assert r.status_code == 201, r.text
    return r.json()


async def _routing(client, company_id: str, product: Product) -> str:
    wc = await client.post(f"{CO}/work-centers", json={
        "company_id": company_id, "code": f"WC-{uuid.uuid4().hex[:5]}", "name": "Lathe",
        "labor_rate_per_hour": 100, "machine_rate_per_hour": 50, "direct_overhead_rate": 2,
    })
    assert wc.status_code == 201, wc.text
    rt = await client.post(f"{CO}/routings", json={
        "company_id": company_id, "product_id": str(product.id),
        "code": f"RT-{uuid.uuid4().hex[:5]}", "name": "Turn", "status": "active", "lot_size": 10,
    })
    assert rt.status_code == 201, rt.text
    rid = rt.json()["id"]
    op = await client.post(f"{CO}/routings/{rid}/operations", json={
        "work_center_id": wc.json()["id"], "seq_no": 10, "description": "Turning",
        "setup_hrs": 1, "run_hrs_per_unit": 0.5, "machine_hrs_per_unit": 0.25, "direct_overhead_pct": 10,
    })
    assert op.status_code == 201, op.text
    return rid


@pytest.mark.asyncio
async def test_attach_routing_generates_activity_and_direct_overhead_lines(co_client, company_id, test_product):
    ver = await _cost_version(co_client, company_id, test_product)
    rid = await _routing(co_client, company_id, test_product)

    r = await co_client.patch(f"{CO}/product-costs/{ver['id']}/routing", json={"routing_id": rid})
    assert r.status_code == 200, r.text

    got = (await co_client.get(f"{CO}/product-costs/{ver['id']}")).json()
    # labor: (1 setup / lot 10 + 0.5 run) = 0.6h x 100 = 60 ; machine: 0.25h x 50 = 12.5
    # direct overhead: 10% x 72.5 + 0.25h x 2 = 7.75 ; material: 2 x 10 = 20
    assert Decimal(got["material_total_planned"]) == Decimal("20")
    assert Decimal(got["activity_total_planned"]) == Decimal("72.5")
    assert Decimal(got["direct_overhead_total_planned"]) == Decimal("7.75")
    assert Decimal(got["rolled_up_unit_cost"]) == Decimal("100.25")
    assert got["routing_id"] == rid
    cats = {ln["category"] for ln in got["lines"]}
    assert cats == {"material", "activity", "direct_overhead"}
    assert all(ln["qty_planned"] is not None and ln["rate_planned"] is not None for ln in got["lines"])

    # Re-attaching is idempotent (no duplicated lines).
    await co_client.patch(f"{CO}/product-costs/{ver['id']}/routing", json={"routing_id": rid})
    again = (await co_client.get(f"{CO}/product-costs/{ver['id']}")).json()
    assert len(again["lines"]) == len(got["lines"])
    assert Decimal(again["rolled_up_unit_cost"]) == Decimal("100.25")


@pytest.mark.asyncio
async def test_unlink_routing_removes_generated_lines_only(co_client, company_id, test_product):
    ver = await _cost_version(co_client, company_id, test_product)
    rid = await _routing(co_client, company_id, test_product)
    await co_client.patch(f"{CO}/product-costs/{ver['id']}/routing", json={"routing_id": rid})

    r = await co_client.patch(f"{CO}/product-costs/{ver['id']}/routing", json={"routing_id": None})
    assert r.status_code == 200, r.text
    got = (await co_client.get(f"{CO}/product-costs/{ver['id']}")).json()
    assert got["routing_id"] is None
    assert [ln["category"] for ln in got["lines"]] == ["material"]
    assert Decimal(got["rolled_up_unit_cost"]) == Decimal("20")


@pytest.mark.asyncio
async def test_attach_unknown_routing_is_404(co_client, company_id, test_product):
    ver = await _cost_version(co_client, company_id, test_product)
    r = await co_client.patch(f"{CO}/product-costs/{ver['id']}/routing", json={"routing_id": str(uuid.uuid4())})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_apply_overhead_adds_indirect_line_and_is_idempotent(co_client, company_id, test_product):
    ver = await _cost_version(co_client, company_id, test_product)

    pool = await co_client.post(f"{CO}/overhead-pools", json={
        "company_id": company_id, "code": f"OH-{uuid.uuid4().hex[:5]}", "name": "Factory OH",
        "overhead_type": "indirect", "formula_type": "fixed_rate",
    })
    assert pool.status_code == 201, pool.text
    assert pool.json()["overhead_type"] == "indirect"
    assert pool.json()["formula_type"] == "fixed_rate"
    pid = pool.json()["id"]
    rate = await co_client.post(f"{CO}/overhead-pools/{pid}/rates", json={
        "effective_from": str(date.today() - timedelta(days=1)), "rate_per_unit": "5",
    })
    assert rate.status_code == 201, rate.text

    r = await co_client.post(
        f"{CO}/product-costs/{ver['id']}/apply-overhead",
        json={"company_id": company_id, "pool_ids": [pid], "base_quantities": {pid: "3"}},
    )
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["indirect_overhead"]) == Decimal("15")
    assert Decimal(r.json()["total"]) == Decimal("35")

    r2 = await co_client.post(
        f"{CO}/product-costs/{ver['id']}/apply-overhead", json={"company_id": company_id, "pool_ids": [pid]}
    )
    assert r2.status_code == 200, r2.text
    assert Decimal(r2.json()["indirect_overhead"]) == Decimal("5")  # replaced, not accumulated
    got = (await co_client.get(f"{CO}/product-costs/{ver['id']}")).json()
    assert [ln["category"] for ln in got["lines"]].count("indirect_overhead") == 1


@pytest.mark.asyncio
async def test_apply_overhead_pct_of_base_and_expired_rate(co_client, company_id, test_product):
    ver = await _cost_version(co_client, company_id, test_product)  # material 20

    pct = await co_client.post(f"{CO}/overhead-pools", json={
        "company_id": company_id, "code": f"PCT-{uuid.uuid4().hex[:4]}", "name": "Material burden",
        "allocation_base": "material_cost", "formula_type": "pct_of_base",
    })
    assert pct.status_code == 201, pct.text
    await co_client.post(f"{CO}/overhead-pools/{pct.json()['id']}/rates", json={
        "effective_from": str(date.today() - timedelta(days=10)), "rate_per_unit": "10",
    })

    expired = await co_client.post(f"{CO}/overhead-pools", json={
        "company_id": company_id, "code": f"EXP-{uuid.uuid4().hex[:4]}", "name": "Old pool",
    })
    await co_client.post(f"{CO}/overhead-pools/{expired.json()['id']}/rates", json={
        "effective_from": str(date.today() - timedelta(days=30)),
        "effective_to": str(date.today() - timedelta(days=5)), "rate_per_unit": "99",
    })

    r = await co_client.post(
        f"{CO}/product-costs/{ver['id']}/apply-overhead",
        json={"pool_ids": [pct.json()["id"], expired.json()["id"]]},
    )
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["indirect_overhead"]) == Decimal("2")  # 10% of 20; expired pool ignored


@pytest.mark.asyncio
async def test_order_transition_returns_full_order_and_enforces_state_machine(co_client, company_id):
    created = await co_client.post(f"{CO}/manufacturing-orders", json={
        "company_id": company_id, "title": "Transition test", "order_kind": "internal",
        "cost_lines": [{"category": "other", "description": "x", "qty_planned": "1", "rate_planned": "5"}],
    })
    assert created.status_code == 201, created.text
    oid = created.json()["id"]

    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/transition", json={"status": "released", "notes": "go"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "released"
    assert body["released_at"] is not None
    assert len(body["cost_lines"]) == 1
    assert "go" in (body["notes"] or "")

    bad = await co_client.post(f"{CO}/manufacturing-orders/{oid}/transition", json={"status": "closed"})
    assert bad.status_code == 422

    for nxt in ("in_progress", "completed"):
        step = await co_client.post(f"{CO}/manufacturing-orders/{oid}/transition", json={"status": nxt})
        assert step.status_code == 200, step.text
    assert step.json()["completed_at"] is not None
