"""Sales-order link and capacity-aware scheduling (phase 12)."""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.core.security import get_password_hash
from app.models.customer import Customer
from app.models.order import Order, OrderLine
from app.models.store import StoreInventory
from tests.test_production_costing import (  # noqa: F401 — shared fixtures
    BASE, _body, _product, bom, component, finished, gl, owner, store,
)

pytestmark = pytest.mark.asyncio


async def _sales_order(db, vendor, store, lines, *, deadline=None, number="SO-1001"):
    customer = Customer(
        id=uuid.uuid4(), vendor_id=vendor.id, full_name="Asha Buyer", email="asha@test.com",
        phone="9990001111", password_hash=get_password_hash("password123"),
    )
    db.add(customer)
    await db.flush()
    so = Order(
        id=uuid.uuid4(), order_number=number, vendor_id=vendor.id, customer_id=customer.id, store_id=store.id,
        items=[], item_count=len(lines), subtotal=Decimal("100"), total=Decimal("100"),
        status="confirmed", payment_status="pending", payment_method="upi", requested_delivery_date=deadline,
    )
    db.add(so)
    await db.flush()
    for no, (product, qty) in enumerate(lines, start=1):
        db.add(OrderLine(
            id=uuid.uuid4(), order_id=so.id, vendor_id=vendor.id, line_no=no * 10, product_id=product.id,
            item_type="product", item_name=product.name, ordered_qty=Decimal(str(qty)),
        ))
    await db.commit()
    return so.id, number


# ── Sales order link ──────────────────────────────────────────────────────

async def test_production_order_is_drafted_from_a_sales_order(
    client: AsyncClient, db_session, owner, test_user, test_vendor, finished, component, bom, store,
):
    plain = await _product(db_session, test_vendor, test_user, "Gift Card")            # no BOM -> skipped
    deadline = date.today() + timedelta(days=10)
    so_id, number = await _sales_order(db_session, test_vendor, store, [(finished, 4), (plain, 1)], deadline=deadline)

    r = await client.post(f"{BASE}/production-orders/from-sales-order/{so_id}", json={})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["sales_order"] == number
    assert [(i["name"], i["qty"]) for i in body["items"]] == [("T-Shirt", 4)]
    assert body["skipped"] == [{"name": "Gift Card", "reason": "no bill of materials"}]

    order = (await client.get(f"{BASE}/production-orders/{body['id']}")).json()
    assert order["status"] == "draft" and order["type"] == "mto"
    assert order["order_ref"] == number
    assert order["customer_name"] == "Asha Buyer" and order["customer_phone"] == "9990001111"
    assert order["delivery_deadline"] == deadline.isoformat()
    assert order["store_id"] == str(store.id)

    linked = (await client.get(f"{BASE}/production-orders/by-sales-order/{so_id}")).json()
    assert [(o["ref"], o["status"]) for o in linked["items"]] == [(body["ref"], "draft")]


async def test_sales_order_cannot_be_produced_twice(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store,
):
    so_id, number = await _sales_order(db_session, test_vendor, store, [(finished, 2)])
    first = await client.post(f"{BASE}/production-orders/from-sales-order/{so_id}", json={})
    assert first.status_code == 201
    again = await client.post(f"{BASE}/production-orders/from-sales-order/{so_id}", json={})
    assert again.status_code == 409 and number in again.json()["detail"]

    # Cancelling the first frees the sales order to be planned again.
    assert (await client.put(f"{BASE}/production-orders/{first.json()['id']}", json={"status": "cancelled"})).status_code == 200
    assert (await client.post(f"{BASE}/production-orders/from-sales-order/{so_id}", json={})).status_code == 201


async def test_shortfall_only_produces_what_stock_does_not_cover(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store,
):
    db_session.add(StoreInventory(
        id=uuid.uuid4(), store_id=store.id, vendor_id=test_vendor.id, product_id=finished.id, quantity=3,
    ))
    await db_session.commit()
    so_id, _ = await _sales_order(db_session, test_vendor, store, [(finished, 5)])
    r = await client.post(f"{BASE}/production-orders/from-sales-order/{so_id}", json={"shortfall_only": True})
    assert r.status_code == 201, r.text
    assert [i["qty"] for i in r.json()["items"]] == [2]


async def test_sales_order_with_nothing_to_make_is_refused(
    client: AsyncClient, db_session, owner, test_user, test_vendor, store,
):
    plain = await _product(db_session, test_vendor, test_user, "Gift Card")
    so_id, _ = await _sales_order(db_session, test_vendor, store, [(plain, 1)])
    r = await client.post(f"{BASE}/production-orders/from-sales-order/{so_id}", json={})
    assert r.status_code == 400 and "No manufactured lines" in r.json()["detail"]
    missing = await client.post(f"{BASE}/production-orders/from-sales-order/{uuid.uuid4()}", json={})
    assert missing.status_code == 404


# ── Scheduling ────────────────────────────────────────────────────────────

async def _order_with_op(client, finished, store, hours, wc_id, deadline=None):
    body = _body(finished, store, qty=1, status="draft")
    if deadline:
        body["delivery_deadline"] = deadline.isoformat()
    r = await client.post(f"{BASE}/production-orders", json=body)
    assert r.status_code == 201, r.text
    oid = r.json()["id"]
    op = await client.post(f"{BASE}/production-orders/{oid}/operations", json={
        "name": "Machining", "planned_hours": hours, "work_center_id": wc_id,
    })
    assert op.status_code in (200, 201), op.text
    return oid


async def test_schedule_queues_orders_on_a_busy_work_center(
    client: AsyncClient, owner, finished, component, bom, store,
):
    wc = (await client.post(f"{BASE}/work-centers", json={"name": "Lathe", "capacity_per_day": 8})).json()
    start = date.today() + timedelta(days=1)

    first = await _order_with_op(client, finished, store, 16, wc["id"])                    # 2 days
    preview = await client.post(f"{BASE}/production-orders/{first}/schedule", json={"start": start.isoformat()})
    assert preview.status_code == 200, preview.text
    plan = preview.json()
    assert plan["applied"] is False and plan["finish"].startswith((start + timedelta(days=2)).isoformat())
    assert plan["late_by_days"] is None

    # A preview stores nothing; applying does.
    ops = (await client.get(f"{BASE}/production-orders/{first}/operations")).json()["items"]
    assert ops[0]["planned_start"] is None
    applied = await client.post(f"{BASE}/production-orders/{first}/schedule/apply", json={"start": start.isoformat()})
    assert applied.status_code == 200 and applied.json()["applied"] is True
    ops = (await client.get(f"{BASE}/production-orders/{first}/operations")).json()["items"]
    assert ops[0]["planned_start"].startswith(start.isoformat())

    # The second order must wait for the lathe; it is late against its deadline.
    second = await _order_with_op(client, finished, store, 8, wc["id"], deadline=start + timedelta(days=1))
    plan2 = (await client.post(f"{BASE}/production-orders/{second}/schedule", json={"start": start.isoformat()})).json()
    assert plan2["steps"][0]["start"].startswith((start + timedelta(days=2)).isoformat())
    assert plan2["finish"].startswith((start + timedelta(days=3)).isoformat())
    assert plan2["late_by_days"] == 2

    order = (await client.get(f"{BASE}/production-orders/{first}")).json()
    assert "scheduled" in [e["action"] for e in order["audit_log"]]


async def test_schedule_apply_requires_manage_and_open_order(
    client: AsyncClient, db_session, owner, test_user, finished, component, bom, store,
):
    wc = (await client.post(f"{BASE}/work-centers", json={"name": "Press"})).json()
    oid = await _order_with_op(client, finished, store, 8, wc["id"])
    # Terminal orders cannot be re-planned.
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "cancelled"})).status_code == 200
    r = await client.post(f"{BASE}/production-orders/{oid}/schedule/apply", json={})
    assert r.status_code == 409
    assert (await client.post(f"{BASE}/production-orders/{uuid.uuid4()}/schedule", json={})).status_code == 404


# ── Shop-floor documents ──────────────────────────────────────────────────

async def test_pick_list_and_job_card(
    client: AsyncClient, owner, finished, component, bom, store,
):
    wc = (await client.post(f"{BASE}/work-centers", json={"name": "Sewing"})).json()
    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, qty=2, status="draft"))
    oid = r.json()["id"]
    await client.post(f"{BASE}/production-orders/{oid}/operations", json={
        "name": "Stitch", "planned_hours": 3, "work_center_id": wc["id"],
    })

    picks = (await client.get(f"{BASE}/production-orders/{oid}/pick-list")).json()
    assert picks["total"] == 1
    row = picks["items"][0]
    assert (row["name"], row["required"], row["already_issued"], row["to_pick"]) == ("Raw Fabric", 6, 0, 6)
    assert row["on_hand"] == 100.0 and row["short"] == 0.0

    card = (await client.get(f"{BASE}/production-orders/{oid}/job-card")).json()
    assert card["items"][0]["qty"] == 2
    assert [(o["name"], o["work_center"], o["planned_hours"]) for o in card["operations"]] == [("Stitch", "Sewing", 3.0)]
    assert card["materials"][0]["to_pick"] == 6

    # Finished orders have nothing left to pick.
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "cancelled"})).status_code == 200
    assert (await client.get(f"{BASE}/production-orders/{oid}/pick-list")).status_code == 409
    assert (await client.get(f"{BASE}/production-orders/{oid}/job-card")).json()["materials"] == []
    assert (await client.get(f"{BASE}/production-orders/{uuid.uuid4()}/pick-list")).status_code == 404


# ── Daily digest ──────────────────────────────────────────────────────────

async def test_daily_digest_reports_overdue_orders_once(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store,
):
    from sqlalchemy import select as _select
    from app.models.notification import Notification
    from app.models.production import ProductionOrder
    from app.services.production_scheduler import send_digest

    vid = test_vendor.id
    created = await client.post(f"{BASE}/production-orders", json=_body(finished, store, qty=1, status="confirmed"))
    assert created.status_code == 201, created.text
    oid = uuid.UUID(created.json()["id"])
    ref = created.json()["ref"]
    row = (await db_session.execute(_select(ProductionOrder).where(ProductionOrder.id == oid))).scalar_one()
    row.delivery_deadline = date.today() - timedelta(days=4)
    await db_session.commit()

    first = await send_digest(db_session, vid)
    await db_session.commit()
    assert first["sent"] is True and first["overdue"] == 1
    again = await send_digest(db_session, vid)
    assert again["sent"] is False and again["reason"] == "already sent today"

    notes = (await db_session.execute(
        _select(Notification).where(Notification.vendor_id == vid, Notification.type == "production")
    )).scalars().all()
    assert len(notes) == 1 and ref in notes[0].message and "4d" in notes[0].message


async def test_digest_is_silent_when_nothing_needs_attention(db_session, test_vendor):
    from app.services.production_scheduler import send_digest

    assert (await send_digest(db_session, test_vendor.id))["sent"] is False
