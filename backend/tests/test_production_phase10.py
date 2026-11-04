"""BOM effectivity, by-products and standard routings (phase 10)."""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.finance import FinJournalEntry
from app.models.procurement_special import MaterialValuation
from app.models.store import StoreInventory
from tests.test_production_costing import (  # noqa: F401 — shared fixtures
    BASE, _body, _product, component, finished, gl, owner, store,
)

pytestmark = pytest.mark.asyncio


async def _heal(db, *objs):
    for o in objs:
        await db.refresh(o)


async def _stock(db, store_id, product_id) -> int:
    return int((await db.execute(
        select(func.coalesce(func.sum(StoreInventory.quantity), 0)).where(
            StoreInventory.store_id == store_id, StoreInventory.product_id == product_id,
        )
    )).scalar())


def _line(component_id, qty=3, **extra):
    return {"component_id": str(component_id), "qty_per_unit": qty, **extra}


# ── Effectivity ────────────────────────────────────────────────────────────

async def test_only_lines_effective_today_are_used_by_mrp(
    client: AsyncClient, owner, finished, component, store,
):
    fid, cid, sid = str(finished.id), component.id, str(store.id)
    today = date.today()
    saved = await client.put(f"{BASE}/products/{fid}/bom", json=[
        _line(cid, 3, valid_to=(today - timedelta(days=1)).isoformat()),            # expired revision
        _line(cid, 5, valid_from=today.isoformat(), valid_to=(today + timedelta(days=30)).isoformat()),
        _line(cid, 9, valid_from=(today + timedelta(days=31)).isoformat()),          # future revision
    ])
    assert saved.status_code == 200, saved.text
    assert [(l["valid_from"] is not None, l["valid_to"] is not None) for l in saved.json()] == [
        (False, True), (True, True), (True, False),
    ]
    mrp = await client.post(f"{BASE}/mrp/calculate", json={
        "items": [{"product_id": fid, "qty": 2, "name": "T-Shirt"}],
        "order_type": "production_order", "order_id": str(uuid.uuid4()), "store_id": sid,
    })
    assert mrp.json()[0]["required_qty"] == 10.0   # 2 x 5, the revision valid today


async def test_overlapping_revisions_of_a_component_are_rejected(
    client: AsyncClient, db_session, owner, test_user, finished, component,
):
    fid, cid = str(finished.id), component.id
    today = date.today()
    r = await client.put(f"{BASE}/products/{fid}/bom", json=[
        _line(cid, 3, valid_to=(today + timedelta(days=10)).isoformat()),
        _line(cid, 5, valid_from=(today + timedelta(days=5)).isoformat()),
    ])
    assert r.status_code == 400 and "non-overlapping" in r.json()["detail"]
    await _heal(db_session, owner, test_user)

    backwards = await client.put(f"{BASE}/products/{fid}/bom", json=[
        _line(cid, 3, valid_from=today.isoformat(), valid_to=(today - timedelta(days=2)).isoformat()),
    ])
    assert backwards.status_code == 400 and "cannot be before" in backwards.json()["detail"]


# ── By-products ───────────────────────────────────────────────────────────

async def test_byproduct_is_received_and_carries_its_cost_share(
    client: AsyncClient, db_session, owner, test_user, test_vendor, finished, component, store, gl,
):
    offcut = await _product(db_session, test_vendor, test_user, "Fabric Offcut")
    fid, cid, oid_p, sid = str(finished.id), component.id, offcut.id, store.id
    saved = await client.put(f"{BASE}/products/{fid}/bom", json=[
        _line(cid, 3),
        _line(oid_p, 0.5, is_byproduct=True, cost_share_pct=10),
    ])
    assert saved.status_code == 200, saved.text
    assert [l["is_byproduct"] for l in saved.json()] == [False, True]

    # A by-product is an output, never a requirement.
    mrp = await client.post(f"{BASE}/mrp/calculate", json={
        "items": [{"product_id": fid, "qty": 10, "name": "T-Shirt"}],
        "order_type": "production_order", "order_id": str(uuid.uuid4()), "store_id": str(sid),
    })
    assert [l["component_id"] for l in mrp.json()] == [str(cid)]

    r = await client.post(f"{BASE}/production-orders", json={
        "type": "mts", "status": "confirmed", "store_id": str(sid),
        "items": [{"item_type": "product", "product_id": fid, "qty": 10, "name": "T-Shirt"}],
    })
    oid = r.json()["id"]
    done = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    assert done.status_code == 200, done.text

    assert await _stock(db_session, sid, oid_p) == 5            # 10 shirts x 0.5
    posting = (await client.get(f"{BASE}/production-orders/{oid}")).json()["inventory_posting"]
    assert posting["costing"]["total"] == "300.00" and posting["costing"]["byproduct_cost"] == "30.00"
    assert posting["costing"]["unit_cost"] == "27.0000"          # 270 / 10 main units
    by = [g for g in posting["goods"] if g.get("byproduct")]
    assert len(by) == 1 and by[0]["qty"] == 5 and by[0]["unit_cost"] == "6.0000"

    mv = (await db_session.execute(select(MaterialValuation).where(MaterialValuation.product_id == oid_p))).scalar_one()
    assert mv.total_stock == Decimal("5") and mv.moving_avg_price == Decimal("6.0000")
    jes = (await db_session.execute(select(FinJournalEntry).where(
        FinJournalEntry.vendor_id == test_vendor.id, FinJournalEntry.source_type == "co_cost_booking",
        FinJournalEntry.status == "posted",
    ))).scalars().all()
    assert len(jes) == 1 and jes[0].total_debit == jes[0].total_credit == Decimal("300")

    # Reconciliation understands by-product receipts.
    assert (await client.get(f"{BASE}/production/reconciliation")).json()["total"] == 0

    # Re-opening takes the by-product back out as well.
    back = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "in_production"})
    assert back.status_code == 200, back.text
    assert await _stock(db_session, sid, oid_p) == 0


async def test_byproduct_shares_cannot_exceed_100_percent(
    client: AsyncClient, db_session, owner, test_user, test_vendor, finished, component,
):
    a = await _product(db_session, test_vendor, test_user, "Offcut A")
    b = await _product(db_session, test_vendor, test_user, "Offcut B")
    fid, cid, aid, bid = str(finished.id), component.id, a.id, b.id
    r = await client.put(f"{BASE}/products/{fid}/bom", json=[
        _line(cid, 3),
        _line(aid, 1, is_byproduct=True, cost_share_pct=60),
        _line(bid, 1, is_byproduct=True, cost_share_pct=50),
    ])
    assert r.status_code == 400 and "100%" in r.json()["detail"]


# ── Standard routing ──────────────────────────────────────────────────────

async def test_standard_routing_is_copied_onto_a_confirmed_order(
    client: AsyncClient, owner, finished, component, store,
):
    fid, sid = str(finished.id), str(store.id)
    await client.put(f"{BASE}/products/{fid}/bom", json=[_line(component.id, 3)])
    wc = (await client.post(f"{BASE}/work-centers", json={"name": "Cutting", "cost_per_hour": 20})).json()
    saved = await client.put(f"{BASE}/products/{fid}/routing", json=[
        {"name": "Cut", "work_center_id": wc["id"], "setup_hours": 1, "hours_per_unit": 0.5},
        {"name": "Sew", "hours_per_unit": 1},
    ])
    assert saved.status_code == 200, saved.text
    assert [s["sequence"] for s in saved.json()["items"]] == [10, 20]
    assert len((await client.get(f"{BASE}/products/{fid}/routing")).json()["items"]) == 2

    r = await client.post(f"{BASE}/production-orders", json={
        "type": "mts", "status": "confirmed", "store_id": sid,
        "items": [{"item_type": "product", "product_id": fid, "qty": 4, "name": "T-Shirt"}],
    })
    assert r.status_code == 201, r.text
    oid = r.json()["id"]
    ops = (await client.get(f"{BASE}/production-orders/{oid}/operations")).json()["items"]
    assert [(o["name"], o["planned_hours"]) for o in ops] == [("Cut", 3.0), ("Sew", 4.0)]
    order = (await client.get(f"{BASE}/production-orders/{oid}")).json()
    assert order["planned_labor_cost"] == 60.0                      # 3 h x 20 (Sew has no work center)
    assert "routing_applied" in [e["action"] for e in order["audit_log"]]


async def test_a_hand_made_routing_is_not_overwritten_by_the_standard_one(
    client: AsyncClient, owner, finished, component, store,
):
    fid, sid = str(finished.id), str(store.id)
    await client.put(f"{BASE}/products/{fid}/bom", json=[_line(component.id, 3)])
    await client.put(f"{BASE}/products/{fid}/routing", json=[{"name": "Cut", "hours_per_unit": 1}])
    r = await client.post(f"{BASE}/production-orders", json={
        "type": "mts", "status": "draft", "store_id": sid,
        "items": [{"item_type": "product", "product_id": fid, "qty": 2, "name": "T-Shirt"}],
    })
    oid = r.json()["id"]
    await client.post(f"{BASE}/production-orders/{oid}/operations", json={"name": "Special", "planned_hours": 1})
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "confirmed"})).status_code == 200
    ops = (await client.get(f"{BASE}/production-orders/{oid}/operations")).json()["items"]
    assert [o["name"] for o in ops] == ["Special"]


async def test_routing_requires_production_manage(
    client: AsyncClient, db_session, owner, test_user, finished,
):
    fid = str(finished.id)
    owner.permissions = ["production.view"]
    owner.role = "staff"
    await db_session.commit()
    await _heal(db_session, owner, test_user)
    assert (await client.get(f"{BASE}/products/{fid}/routing")).status_code == 200
    assert (await client.put(f"{BASE}/products/{fid}/routing", json=[{"name": "Cut"}])).status_code == 403
