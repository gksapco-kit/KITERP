"""Controlling Phase 6: pagination, period-aware reporting, aggregate WIP totals and permission coverage."""
from __future__ import annotations

import uuid
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
    ro = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="staff", permissions=["controlling.view", "finance.view"], is_active=True,
    )
    _override(db_session, test_user, ro)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded(db_session, test_vendor: Vendor, test_user: User) -> dict:
    out = await seed_co_demo_data(
        db_session, test_vendor.id, test_user.id,
        demo_order_no=f"P6-{uuid.uuid4().hex[:6]}", skip_if_order_exists=False,
    )
    await db_session.commit()
    return out


async def _new_order(client, company_id: str, **over) -> dict:
    body = {"company_id": company_id, "status": "in_progress", "qty_planned": "5", **over}
    r = await client.post(f"{CO}/manufacturing-orders", json=body)
    assert r.status_code == 201, r.text
    return r.json()


# ── pagination ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_order_list_is_paginated_and_validated(co_client, seeded):
    cid = seeded["company_id"]
    for _ in range(3):
        await _new_order(co_client, cid)

    everything = (await co_client.get(f"{CO}/manufacturing-orders", params={"company_id": cid})).json()
    assert len(everything) >= 4

    page1 = (await co_client.get(f"{CO}/manufacturing-orders", params={"company_id": cid, "limit": 2})).json()
    page2 = (await co_client.get(f"{CO}/manufacturing-orders", params={"company_id": cid, "limit": 2, "offset": 2})).json()
    assert len(page1) == 2
    ids = [o["id"] for o in page1 + page2]
    assert len(set(ids)) == len(ids), "pages must not overlap"
    assert ids == [o["id"] for o in everything][: len(ids)], "paging keeps the same ordering"

    for bad in ({"limit": 0}, {"limit": 5000}, {"offset": -1}):
        r = await co_client.get(f"{CO}/manufacturing-orders", params=bad)
        assert r.status_code == 422, bad


@pytest.mark.asyncio
async def test_other_lists_accept_limit_and_offset(co_client, seeded):
    cid = seeded["company_id"]
    for path in ("goods-movements", "activity-confirmations", "cost-allocations", "variance-runs", "internal-orders-report"):
        r = await co_client.get(f"{CO}/{path}", params={"company_id": cid, "limit": 1, "offset": 0})
        assert r.status_code == 200, (path, r.text)
        assert len(r.json()) <= 1
        r = await co_client.get(f"{CO}/{path}", params={"limit": 5000})
        assert r.status_code == 422, path


# ── aggregate WIP numbers ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_wip_matches_wip_summary(co_client, seeded):
    cid = seeded["company_id"]
    summary = (await co_client.get(f"{CO}/wip-summary", params={"company_id": cid})).json()
    dash = (await co_client.get(f"{CO}/dashboard", params={"company_id": cid})).json()
    assert dash["wip_open_orders"] == summary["open_orders"] >= 1
    assert Decimal(dash["wip_actual_cost"]) == Decimal(summary["wip_actual_cost"])
    assert Decimal(dash["wip_planned_value"]) == Decimal(summary["wip_planned_value"])

    report = (await co_client.get(
        f"{CO}/period-end-report",
        params={"company_id": cid, "period_year": date.today().year, "period_month": date.today().month},
    )).json()
    assert report["open_orders"] == summary["open_orders"]
    assert Decimal(report["total_actual"]) == Decimal(summary["wip_actual_cost"])


# ── period-aware period-end report ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_period_end_report_counts_follow_the_period(co_client, seeded):
    cid, oid = seeded["company_id"], seeded["manufacturing_order_id"]
    today = date.today()

    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/transition", json={"status": "completed"})
    assert r.status_code == 200, r.text

    this_month = (await co_client.get(
        f"{CO}/period-end-report",
        params={"company_id": cid, "period_year": today.year, "period_month": today.month},
    )).json()
    long_ago = (await co_client.get(
        f"{CO}/period-end-report",
        params={"company_id": cid, "period_year": 2001, "period_month": 1},
    )).json()

    assert this_month["completed_orders"] >= 1
    assert long_ago["completed_orders"] == 0
    assert long_ago["goods_movements_count"] == 0
    assert long_ago["activity_confirmations_count"] == 0

    movements = (await co_client.get(f"{CO}/goods-movements", params={"company_id": cid})).json()
    in_month = [
        m for m in movements
        if m["status"] == "posted" and m["posting_date"][:7] == f"{today.year:04d}-{today.month:02d}"
    ]
    assert this_month["goods_movements_count"] == len(in_month)


# ── internal orders report (single budget query) ──────────────────────────────

@pytest.mark.asyncio
async def test_internal_orders_report_budget_totals_per_order(co_client, seeded):
    cid = seeded["company_id"]
    a = await _new_order(co_client, cid, order_kind="project", status="draft")
    b = await _new_order(co_client, cid, order_kind="internal", status="draft")
    c = await _new_order(co_client, cid, order_kind="project", status="draft")  # no budget at all

    for order, amounts in ((a, ["100", "50"]), (b, ["7"])):
        for amt in amounts:
            r = await co_client.post(f"{CO}/manufacturing-orders/{order['id']}/budget-lines", json={
                "company_id": cid, "order_id": order["id"], "category": "material", "amount_budgeted": amt,
            })
            assert r.status_code in (200, 201), r.text

    rows = (await co_client.get(f"{CO}/internal-orders-report", params={"company_id": cid})).json()
    budgeted = {row["order_id"]: Decimal(row["budgeted"]) for row in rows}
    assert budgeted[a["id"]] == Decimal("150")
    assert budgeted[b["id"]] == Decimal("7")
    assert budgeted[c["id"]] == Decimal("0")


# ── permissions on the Phase 2/3 endpoints ───────────────────────────────────

@pytest.mark.asyncio
async def test_new_posting_and_reversal_endpoints_are_permission_gated(ro_client):
    rid = uuid.uuid4()
    reason = {"reason": "testing"}
    for path in (
        f"manufacturing-orders/{rid}/reverse-cogs-issue",
        f"manufacturing-orders/{rid}/reverse-production-completion",
        f"manufacturing-orders/{rid}/post-cogs-issue",
        f"manufacturing-orders/{rid}/post-production-completion",
        f"cost-allocations/{rid}/reverse",
        f"variance-runs/{rid}/reverse",
    ):
        r = await ro_client.post(f"{CO}/{path}", json=reason)
        assert r.status_code == 403, (path, r.status_code)

    assert (await ro_client.delete(f"{CO}/variance-runs/{rid}")).status_code == 403
    assert (await ro_client.post(f"{CO}/manufacturing-orders/{rid}/transition", json={"status": "released"})).status_code == 403
    assert (await ro_client.post(f"{CO}/goods-movements/{rid}/reverse", json=reason)).status_code in (403, 404, 405, 422)
