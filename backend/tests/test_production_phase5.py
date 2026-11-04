"""Production shop-floor execution — phase 5.

Operation locking on closed orders, frozen work-centre rates, work-centre
rate/delete handling, complete reorder lists and the QC gate.
"""
import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.vendor_product import Product
from tests.test_production_costing import (  # noqa: F401 — shared fixtures
    BASE, _body, _complete, bom, component, finished, gl, owner, store,
)

pytestmark = pytest.mark.asyncio


async def _wc(client, rate=50, name="Sewing"):
    r = await client.post(f"{BASE}/work-centers", json={"name": name, "cost_per_hour": rate})
    assert r.status_code == 201, r.text
    return r.json()


async def _order_with_op(client, finished, store, wc, hours=2, status="confirmed", op_status=None, **op_extra):
    if op_status:
        op_extra["status"] = op_status
    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, status))
    assert r.status_code == 201, r.text
    oid = r.json()["id"]
    op = await client.post(f"{BASE}/production-orders/{oid}/operations", json={
        "name": "Stitch", "work_center_id": wc["id"], "planned_hours": hours, **op_extra,
    })
    assert op.status_code == 201, op.text
    return oid, op.json()


async def _labor(client, oid):
    return Decimal(str((await client.get(f"{BASE}/production-orders/{oid}")).json()["planned_labor_cost"]))


async def test_operations_are_read_only_on_completed_and_cancelled_orders(
    client: AsyncClient, owner, finished, bom, store, gl,
):
    wc = await _wc(client)
    oid, op = await _order_with_op(client, finished, store, wc, actual_hours=2)
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})).status_code == 200

    ops = f"{BASE}/production-orders/{oid}/operations"
    assert (await client.post(ops, json={"name": "Late"})).status_code == 409
    assert (await client.put(f"{ops}/{op['id']}", json={"planned_hours": 9})).status_code == 409
    assert (await client.delete(f"{ops}/{op['id']}")).status_code == 409
    assert (await client.put(f"{ops}/reorder/apply", json={"ids": [op["id"]]})).status_code == 409
    # Reading stays possible.
    assert (await client.get(ops)).status_code == 200

    # Re-open and the routing is editable again.
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "in_production"})).status_code == 200
    assert (await client.put(f"{ops}/{op['id']}", json={"planned_hours": 3})).status_code == 200


async def test_work_center_rate_change_updates_open_orders_only(
    client: AsyncClient, owner, finished, bom, store, gl,
):
    wc = await _wc(client, rate=50)
    open_oid, _ = await _order_with_op(client, finished, store, wc, hours=2)
    done_oid, _ = await _order_with_op(client, finished, store, wc, hours=2, actual_hours=2)
    assert (await client.put(f"{BASE}/production-orders/{done_oid}", json={"status": "completed"})).status_code == 200
    assert await _labor(client, open_oid) == Decimal("100")

    r = await client.put(f"{BASE}/work-centers/{wc['id']}", json={"cost_per_hour": 80})
    assert r.status_code == 200, r.text

    assert await _labor(client, open_oid) == Decimal("160")   # follows the live rate
    assert await _labor(client, done_oid) == Decimal("100")   # frozen when completed


async def test_completed_operation_freezes_its_rate(client: AsyncClient, owner, finished, bom, store, gl):
    wc = await _wc(client, rate=50)
    oid, op = await _order_with_op(client, finished, store, wc, hours=2, actual_hours=2, op_status="completed")
    assert op["rate_applied"] == 50.0
    await client.put(f"{BASE}/work-centers/{wc['id']}", json={"cost_per_hour": 90})
    assert await _labor(client, oid) == Decimal("100")

    reopened = await client.put(
        f"{BASE}/production-orders/{oid}/operations/{op['id']}", json={"status": "in_progress"},
    )
    assert reopened.json()["rate_applied"] is None
    assert await _labor(client, oid) == Decimal("180")


async def test_work_center_in_use_by_open_orders_cannot_be_deleted(
    client: AsyncClient, owner, finished, bom, store, gl,
):
    wc = await _wc(client)
    oid, _ = await _order_with_op(client, finished, store, wc)
    r = await client.delete(f"{BASE}/work-centers/{wc['id']}")
    assert r.status_code == 409
    assert "open production orders" in r.json()["detail"]
    assert await _labor(client, oid) == Decimal("100")


async def test_deleting_work_center_keeps_cost_of_completed_orders(
    client: AsyncClient, owner, finished, bom, store, gl,
):
    wc = await _wc(client, rate=50)
    oid, _ = await _order_with_op(client, finished, store, wc, hours=2, actual_hours=2)
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})).status_code == 200
    assert (await client.delete(f"{BASE}/work-centers/{wc['id']}")).status_code == 204
    assert await _labor(client, oid) == Decimal("100")


async def test_reorder_requires_the_complete_list(client: AsyncClient, owner, finished, bom, store, gl):
    wc = await _wc(client)
    oid, op1 = await _order_with_op(client, finished, store, wc)
    op2 = (await client.post(f"{BASE}/production-orders/{oid}/operations", json={"name": "Pack"})).json()
    url = f"{BASE}/production-orders/{oid}/operations/reorder/apply"

    assert (await client.put(url, json={"ids": [op2["id"]]})).status_code == 400
    assert (await client.put(url, json={"ids": [op2["id"], op2["id"]]})).status_code == 400
    ok = await client.put(url, json={"ids": [op2["id"], op1["id"]]})
    assert ok.status_code == 200
    assert [o["id"] for o in ok.json()["items"]] == [op2["id"], op1["id"]]


async def test_negative_hours_are_rejected(client: AsyncClient, owner, finished, bom, store, gl):
    wc = await _wc(client)
    oid, op = await _order_with_op(client, finished, store, wc)
    url = f"{BASE}/production-orders/{oid}/operations"
    assert (await client.post(url, json={"name": "x", "planned_hours": -1})).status_code == 400
    assert (await client.put(f"{url}/{op['id']}", json={"actual_hours": -2})).status_code == 400


async def test_qc_flagged_product_must_pass_through_qc(
    client: AsyncClient, db_session, owner, test_user, finished, bom, store, gl,
):
    finished.qc_required_on_production = True
    await db_session.commit()
    await db_session.refresh(owner)

    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, "confirmed"))
    oid = r.json()["id"]
    direct = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    assert direct.status_code == 409
    assert "quality check" in direct.json()["detail"]
    # The shared test session expires every object on rollback; production requests use their own session.
    await db_session.refresh(owner)
    await db_session.refresh(test_user)

    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "in_production"})).status_code == 200
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "qc"})).status_code == 200
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})).status_code == 200
