"""MRP / BOM / reservation guards — phase 6."""
import uuid

import pytest
from httpx import AsyncClient

from app.models.mrp import ProductBOMItem
from tests.test_production_costing import (  # noqa: F401 — shared fixtures
    BASE, _body, _product, bom, component, finished, owner, store,
)

pytestmark = pytest.mark.asyncio


def _bom(*pairs) -> list[dict]:
    return [{"component_id": str(cid), "qty_per_unit": qty} for cid, qty in pairs]


async def test_indirect_bom_cycle_is_rejected(client: AsyncClient, db_session, owner, test_vendor, test_user):
    a = await _product(db_session, test_vendor, test_user, "Prod A")
    b = await _product(db_session, test_vendor, test_user, "Prod B")
    c = await _product(db_session, test_vendor, test_user, "Prod C")

    assert (await client.put(f"{BASE}/products/{a.id}/bom", json=_bom((b.id, 1)))).status_code == 200
    assert (await client.put(f"{BASE}/products/{b.id}/bom", json=_bom((c.id, 2)))).status_code == 200

    r = await client.put(f"{BASE}/products/{c.id}/bom", json=_bom((a.id, 1)))
    assert r.status_code == 400
    assert "Prod C → Prod A → Prod B → Prod C" in r.json()["detail"]

    # The rejected request must not have wiped anything.
    assert (await client.get(f"{BASE}/products/{c.id}/bom")).json() == []
    assert len((await client.get(f"{BASE}/products/{a.id}/bom")).json()) == 1


async def test_self_reference_and_duplicates_are_rejected(
    client: AsyncClient, db_session, owner, test_vendor, test_user, finished, component, bom,
):
    assert (await client.put(f"{BASE}/products/{finished.id}/bom", json=_bom((finished.id, 1)))).status_code == 400
    dup = await client.put(
        f"{BASE}/products/{finished.id}/bom", json=_bom((component.id, 1), (component.id, 2)),
    )
    assert dup.status_code == 400
    assert "only appear once" in dup.json()["detail"]
    # Existing BOM untouched by the failed saves.
    existing = (await client.get(f"{BASE}/products/{finished.id}/bom")).json()
    assert [(i["component_id"], i["qty_per_unit"]) for i in existing] == [(str(component.id), 3.0)]


async def test_unknown_component_does_not_wipe_the_bom(
    client: AsyncClient, owner, finished, component, bom,
):
    r = await client.put(f"{BASE}/products/{finished.id}/bom", json=_bom((uuid.uuid4(), 1)))
    assert r.status_code == 404
    assert len((await client.get(f"{BASE}/products/{finished.id}/bom")).json()) == 1


async def test_manual_reservations_for_production_orders_are_refused(
    client: AsyncClient, owner, finished, component, bom, store,
):
    r = await client.post(f"{BASE}/stock-reservations", json={
        "order_type": "production_order", "order_id": str(uuid.uuid4()), "store_id": str(store.id),
        "items": [{"product_id": str(component.id), "reserved_qty": 5}],
    })
    assert r.status_code == 409


async def test_live_order_reservations_cannot_be_released_by_hand(
    client: AsyncClient, owner, finished, component, bom, store,
):
    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2, "confirmed"))
    assert r.status_code == 201, r.text
    oid = r.json()["id"]

    listed = (await client.get(f"{BASE}/stock-reservations", params={
        "order_type": "production_order", "order_id": oid,
    })).json()
    assert listed and listed[0]["status"] == "active" and listed[0]["product_name"] == "Raw Fabric"

    single = await client.delete(f"{BASE}/stock-reservations/{listed[0]['id']}")
    bulk = await client.delete(f"{BASE}/stock-reservations", params={"order_type": "production_order", "order_id": oid})
    assert single.status_code == 409 and bulk.status_code == 409

    # Moving the order back to draft releases them through the lifecycle.
    assert (await client.put(f"{BASE}/production-orders/{oid}", json={"status": "draft"})).status_code == 200
    after = (await client.get(f"{BASE}/stock-reservations", params={
        "order_type": "production_order", "order_id": oid,
    })).json()
    assert {x["status"] for x in after} == {"released"}


async def test_other_order_types_still_reserve_and_validate(
    client: AsyncClient, owner, component, store,
):
    ok = await client.post(f"{BASE}/stock-reservations", json={
        "order_type": "sales_order", "order_id": "SO-1", "store_id": str(store.id),
        "items": [{"product_id": str(component.id), "reserved_qty": 5}],
    })
    assert ok.status_code == 201, ok.text
    bad = await client.post(f"{BASE}/stock-reservations", json={
        "order_type": "sales_order", "order_id": "SO-2",
        "items": [{"product_id": str(uuid.uuid4()), "reserved_qty": 5}],
    })
    assert bad.status_code == 404
