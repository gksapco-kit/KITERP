"""Analytics, BOM scrap, product protection, planning aids and reconciliation (phases 7, 8, 10, 12, 13)."""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.mrp import StockReservation
from app.models.procurement_requisition import PurchaseRequisition, PurchaseRequisitionItem
from app.models.production import ProductionOrder
from tests.test_production_costing import (  # noqa: F401 — shared fixtures
    BASE, _body, _complete, _product, bom, component, finished, gl, owner, store,
)

pytestmark = pytest.mark.asyncio


# ── Phase 7: analytics ────────────────────────────────────────────────────

async def test_analytics_cost_variance_counts_only_completed_orders(
    client: AsyncClient, owner, finished, bom, store, gl,
):
    # One completed order (planned 60 material, actual 60) and one still being built.
    oid, done = await _complete(client, finished, store, qty=2)
    assert done.status_code == 200, done.text
    await client.post(f"{BASE}/production-orders", json=_body(finished, store, 5, "confirmed"))

    data = (await client.get(f"{BASE}/production/analytics")).json()
    assert data["totals"]["orders"] == 2
    assert data["totals"]["completed"] == 1
    assert data["totals"]["in_progress"] == 1
    assert data["totals"]["draft"] == 0
    # The unfinished order's plan must not show up as a saving.
    assert data["cost"]["planned_material"] == 60.0
    assert data["cost"]["actual_material"] == 60.0
    assert data["cost"]["variance"] == 0.0


async def test_analytics_rejects_bad_ranges(client: AsyncClient, owner):
    today = date.today()
    inverted = await client.get(f"{BASE}/production/analytics", params={
        "date_from": today.isoformat(), "date_to": (today - timedelta(days=3)).isoformat(),
    })
    assert inverted.status_code == 400
    huge = await client.get(f"{BASE}/production/analytics", params={
        "date_from": (today - timedelta(days=800)).isoformat(), "date_to": today.isoformat(),
    })
    assert huge.status_code == 400


async def test_order_list_still_works_without_heavy_columns(client: AsyncClient, owner, finished, bom, store):
    created = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, "draft"))
    assert created.status_code == 201
    listed = (await client.get(f"{BASE}/production-orders")).json()
    assert listed["total"] == 1
    assert listed["items"][0]["audit_log"] == [] and listed["items"][0]["attachments"] == []
    # The detail endpoint still returns them.
    detail = (await client.get(f"{BASE}/production-orders/{created.json()['id']}")).json()
    assert detail["audit_log"]


# ── Phase 10: scrap % and product protection ───────────────────────────────

async def test_bom_scrap_percentage_increases_the_requirement(
    client: AsyncClient, owner, finished, component, store,
):
    saved = await client.put(f"{BASE}/products/{finished.id}/bom", json=[
        {"component_id": str(component.id), "qty_per_unit": 3, "scrap_pct": 10},
    ])
    assert saved.status_code == 200, saved.text
    assert saved.json()[0]["scrap_pct"] == 10.0

    # 2 units x 3 x 1.10 = 6.6 -> reserved as 7
    mrp = await client.post(f"{BASE}/mrp/calculate", json={
        "items": [{"product_id": str(finished.id), "qty": 2, "name": "T-Shirt"}],
        "order_type": "production_order", "order_id": str(uuid.uuid4()), "store_id": str(store.id),
    })
    line = mrp.json()[0]
    assert round(line["required_qty"], 4) == 6.6
    assert line["reserve_qty"] == 7.0


async def test_scrap_percentage_must_be_in_range(client: AsyncClient, owner, finished, component):
    r = await client.put(f"{BASE}/products/{finished.id}/bom", json=[
        {"component_id": str(component.id), "qty_per_unit": 3, "scrap_pct": 150},
    ])
    assert r.status_code == 422


async def test_component_used_in_a_bom_cannot_be_deleted(
    client: AsyncClient, owner, finished, component, bom,
):
    r = await client.delete(f"{BASE}/products/{component.id}")
    assert r.status_code == 409
    assert "component in the BOM of T-Shirt" in r.json()["detail"]


async def test_product_on_an_open_order_cannot_be_deleted(
    client: AsyncClient, owner, finished, component, bom, store,
):
    created = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, "draft"))
    assert created.status_code == 201
    r = await client.delete(f"{BASE}/products/{finished.id}")
    assert r.status_code == 409
    assert "open production orders" in r.json()["detail"]


# ── Phase 12: planning aids ────────────────────────────────────────────────

async def test_shortages_and_requisition_for_a_short_order(
    client: AsyncClient, db_session, owner, finished, component, bom, store,
):
    # 40 shirts x 3 fabric = 120 needed, only 100 on hand.
    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 40, "draft"))
    oid = r.json()["id"]

    short = (await client.get(f"{BASE}/production-orders/{oid}/shortages")).json()
    assert short["total"] == 1
    assert short["items"][0]["component_name"] == "Raw Fabric"
    assert short["items"][0]["shortage"] == 20.0

    pr = await client.post(f"{BASE}/production-orders/{oid}/purchase-requisition")
    assert pr.status_code == 201, pr.text
    stored = (await db_session.execute(
        select(PurchaseRequisition).where(PurchaseRequisition.pr_number == pr.json()["pr_number"])
    )).scalar_one()
    item = (await db_session.execute(
        select(PurchaseRequisitionItem).where(PurchaseRequisitionItem.requisition_id == stored.id)
    )).scalar_one()
    assert item.product_id == component.id and item.quantity == Decimal("20")

    audit = (await client.get(f"{BASE}/production-orders/{oid}")).json()["audit_log"]
    assert "purchase_requisition_created" in [e["action"] for e in audit]


async def test_no_requisition_when_stock_is_sufficient(
    client: AsyncClient, owner, finished, component, bom, store,
):
    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, "draft"))
    pr = await client.post(f"{BASE}/production-orders/{r.json()['id']}/purchase-requisition")
    assert pr.status_code == 400
    assert "No shortages" in pr.json()["detail"]


async def test_work_center_load_reports_open_hours(client: AsyncClient, owner, finished, bom, store):
    wc = (await client.post(f"{BASE}/work-centers", json={
        "name": "Sewing", "cost_per_hour": 50, "capacity_per_day": 8,
    })).json()
    oid = (await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, "confirmed"))).json()["id"]
    await client.post(f"{BASE}/production-orders/{oid}/operations", json={
        "name": "Stitch", "work_center_id": wc["id"], "planned_hours": 20,
    })
    load = (await client.get(f"{BASE}/work-centers/load")).json()
    row = next(x for x in load["items"] if x["work_center_id"] == wc["id"])
    assert row["open_hours"] == 20.0 and row["days_of_work"] == 2.5


# ── Phase 8 / 13: reconciliation ───────────────────────────────────────────

async def test_reconciliation_is_clean_for_healthy_data(
    client: AsyncClient, owner, finished, bom, store, gl,
):
    oid, done = await _complete(client, finished, store, qty=2)
    assert done.status_code == 200, done.text
    report = (await client.get(f"{BASE}/production/reconciliation")).json()
    assert report["total"] == 0, report["issues"]


async def test_reconciliation_flags_and_repairs_stale_reservations(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store, gl,
):
    oid = (await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, "confirmed"))).json()["id"]
    # Simulate legacy desync: cancel the order but leave its reservation active.
    order = (await db_session.execute(select(ProductionOrder).where(ProductionOrder.id == uuid.UUID(oid)))).scalar_one()
    order.status = "cancelled"
    await db_session.commit()

    report = (await client.get(f"{BASE}/production/reconciliation")).json()
    codes = {i["code"] for i in report["issues"]}
    assert "stale_reservation" in codes and report["fixable"] >= 1

    fixed = await client.post(f"{BASE}/production/reconciliation/repair")
    assert fixed.status_code == 200 and fixed.json()["released_reservations"] >= 1
    assert (await client.get(f"{BASE}/production/reconciliation")).json()["total"] == 0


async def test_reconciliation_flags_completed_order_without_posting(
    client: AsyncClient, db_session, owner, finished, bom, store, gl,
):
    oid = (await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, "confirmed"))).json()["id"]
    order = (await db_session.execute(select(ProductionOrder).where(ProductionOrder.id == uuid.UUID(oid)))).scalar_one()
    order.status = "completed"
    await db_session.commit()

    issues = (await client.get(f"{BASE}/production/reconciliation")).json()["issues"]
    assert "completed_without_posting" in {i["code"] for i in issues}


async def test_repair_requires_manage_permission(client: AsyncClient, db_session, test_vendor, test_user):
    from app.models.vendor_user import VendorUser
    db_session.add(VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="staff", permissions=["production.view"], is_active=True,
    ))
    await db_session.commit()
    assert (await client.get(f"{BASE}/production/reconciliation")).status_code == 200
    assert (await client.post(f"{BASE}/production/reconciliation/repair")).status_code == 403
