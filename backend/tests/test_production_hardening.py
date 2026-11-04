"""Production module hardening — phases 1-3.

Phase 1: access control (production.manage on writes, module-enabled flag)
Phase 2: lifecycle state machine, stock reversal, bin-level consumption
Phase 3: field locking, validation, server-owned audit, import, delete rules
"""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mrp import ProductBOMItem, StockReservation
from app.models.storage_location import StorageLocation
from app.models.store import Store, StoreInventory
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser
from app.models.user import User

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/vendors/me"


# ── Fixtures ──────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def owner(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="owner", permissions=[], is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    await db_session.refresh(vu)
    return vu


@pytest_asyncio.fixture
async def view_only(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    """Staff baseline has no production access; grant view only."""
    vu = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="staff", permissions=["production.view"], is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    await db_session.refresh(vu)
    return vu


async def _product(db: AsyncSession, vendor: Vendor, user: User, name: str, cost: float | None = None) -> Product:
    p = Product(
        id=uuid.uuid4(), vendor_id=vendor.id, name=name, slug=f"{name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}",
        price=100.0, cost_price=cost, currency="INR", status="active", product_type="physical",
        quantity=0, created_by=user.id,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@pytest_asyncio.fixture
async def component(db_session, test_vendor, test_user) -> Product:
    return await _product(db_session, test_vendor, test_user, "Raw Fabric", cost=10.0)


@pytest_asyncio.fixture
async def finished(db_session, test_vendor, test_user) -> Product:
    return await _product(db_session, test_vendor, test_user, "T-Shirt")


@pytest_asyncio.fixture
async def bom(db_session, test_vendor, finished, component):
    """1 T-Shirt = 3 Raw Fabric."""
    db_session.add(ProductBOMItem(
        vendor_id=test_vendor.id, product_id=finished.id, component_id=component.id, qty_per_unit=3,
    ))
    await db_session.commit()


@pytest_asyncio.fixture
async def store(db_session, test_vendor, component) -> Store:
    s = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Main Warehouse", is_default=True)
    db_session.add(s)
    await db_session.flush()
    db_session.add(StoreInventory(
        id=uuid.uuid4(), store_id=s.id, vendor_id=test_vendor.id, product_id=component.id, quantity=100,
    ))
    await db_session.commit()
    await db_session.refresh(s)
    return s


def _order_body(finished: Product, store: Store, status: str = "draft", qty: int = 2, **extra) -> dict:
    body = {
        "type": "mts",
        "status": status,
        "store_id": str(store.id),
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": qty, "name": "T-Shirt"}],
    }
    body.update(extra)
    return body


async def _stock(db: AsyncSession, store: Store, product: Product) -> int:
    # Aggregate query (no ORM objects) so we always read current DB state, never identity-map cache.
    q = select(func.coalesce(func.sum(StoreInventory.quantity), 0)).where(
        StoreInventory.store_id == store.id, StoreInventory.product_id == product.id,
    )
    return int((await db.execute(q)).scalar() or 0)


async def _recover(db: AsyncSession, *objs) -> None:
    """The test client shares one DB session across requests. When the API rolls back
    after a rejected request, ORM objects held by fixtures are expired; reload them so
    the next request can read e.g. ``test_user.id``. (In production every request gets
    its own session, so this is test plumbing only.)"""
    for o in objs:
        await db.refresh(o)


async def _create(client: AsyncClient, finished, store, status="draft", qty=2, **extra) -> dict:
    r = await client.post(f"{BASE}/production-orders", json=_order_body(finished, store, status, qty, **extra))
    assert r.status_code == 201, r.text
    return r.json()


async def _set_status(client: AsyncClient, order_id: str, status: str, **extra):
    return await client.put(f"{BASE}/production-orders/{order_id}", json={"status": status, **extra})


# ══ Phase 1 — access control ══════════════════════════════════════════════

async def test_view_only_user_can_read_but_not_write(
    client: AsyncClient, view_only, finished, store,
):
    assert (await client.get(f"{BASE}/production-orders")).status_code == 200
    assert (await client.get(f"{BASE}/work-centers")).status_code == 200
    assert (await client.get(f"{BASE}/production/analytics")).status_code == 200

    fake = uuid.uuid4()
    denied = [
        await client.post(f"{BASE}/production-orders", json=_order_body(finished, store)),
        await client.put(f"{BASE}/production-orders/{fake}", json={"status": "confirmed"}),
        await client.delete(f"{BASE}/production-orders/{fake}"),
        await client.post(f"{BASE}/production-orders/import-local", json={"orders": []}),
        await client.post(f"{BASE}/work-centers", json={"name": "WC"}),
        await client.put(f"{BASE}/work-centers/{fake}", json={"name": "x"}),
        await client.delete(f"{BASE}/work-centers/{fake}"),
        await client.post(f"{BASE}/production-orders/{fake}/operations", json={"name": "Op"}),
        await client.put(f"{BASE}/products/{fake}/bom", json=[]),
        await client.post(f"{BASE}/stock-reservations", json={
            "order_type": "production_order", "order_id": "x", "items": [],
        }),
        await client.delete(f"{BASE}/stock-reservations", params={"order_type": "production_order", "order_id": "x"}),
    ]
    assert [r.status_code for r in denied] == [403] * len(denied), [r.text for r in denied]


async def test_mrp_calculate_is_allowed_for_view_only(client: AsyncClient, view_only, finished, bom):
    r = await client.post(f"{BASE}/mrp/calculate", json={
        "items": [{"product_id": str(finished.id), "qty": 2, "name": "T-Shirt"}],
        "order_type": "production_order", "order_id": str(uuid.uuid4()),
    })
    assert r.status_code == 200, r.text


async def test_disabled_module_blocks_api(
    client: AsyncClient, db_session: AsyncSession, owner, test_vendor: Vendor,
):
    test_vendor.settings = {**(test_vendor.settings or {}), "production_enabled": False}
    await db_session.commit()
    r = await client.get(f"{BASE}/production-orders")
    assert r.status_code == 403
    assert "disabled" in r.json()["detail"].lower()


# ══ Phase 2 — lifecycle ═══════════════════════════════════════════════════

async def test_cannot_create_in_late_status(client: AsyncClient, owner, finished, store):
    r = await client.post(f"{BASE}/production-orders", json=_order_body(finished, store, status="completed"))
    assert r.status_code == 422


async def test_illegal_transition_is_rejected(client: AsyncClient, owner, finished, bom, store):
    order = await _create(client, finished, store)
    r = await _set_status(client, order["id"], "completed")  # draft -> completed
    assert r.status_code == 409, r.text
    assert "draft" in r.json()["detail"]


async def test_completed_cannot_be_cancelled_directly(client: AsyncClient, owner, finished, bom, store):
    order = await _create(client, finished, store, status="confirmed")
    assert (await _set_status(client, order["id"], "completed")).status_code == 200
    r = await _set_status(client, order["id"], "cancelled")
    assert r.status_code == 409, r.text


async def test_reopen_reverses_stock_and_recompletes(
    client: AsyncClient, db_session, owner, finished, component, bom, store,
):
    order = await _create(client, finished, store, status="confirmed")
    oid = order["id"]
    assert (await _set_status(client, oid, "completed")).status_code == 200
    assert await _stock(db_session, store, component) == 100 - 6
    assert await _stock(db_session, store, finished) == 2

    reopened = await _set_status(client, oid, "in_production")
    assert reopened.status_code == 200, reopened.text
    body = reopened.json()
    assert body["inventory_posted_at"] is None
    assert body["inventory_posting"] is None
    assert await _stock(db_session, store, component) == 100
    assert await _stock(db_session, store, finished) == 0

    # Completing again must post again (not be skipped by a stale posted marker).
    again = await _set_status(client, oid, "completed")
    assert again.status_code == 200, again.text
    assert await _stock(db_session, store, component) == 100 - 6
    assert await _stock(db_session, store, finished) == 2


async def test_reopen_refused_when_finished_goods_already_used(
    client: AsyncClient, db_session, owner, test_user, finished, component, bom, store,
):
    order = await _create(client, finished, store, status="confirmed")
    oid = order["id"]
    assert (await _set_status(client, oid, "completed")).status_code == 200

    # Simulate the finished goods having been sold/moved elsewhere.
    fg_rows = (await db_session.execute(
        select(StoreInventory).where(StoreInventory.store_id == store.id, StoreInventory.product_id == finished.id)
    )).scalars().all()
    for r in fg_rows:
        r.quantity = 0
    await db_session.commit()

    r = await _set_status(client, oid, "in_production")
    assert r.status_code == 400, r.text
    assert "already" in r.json()["detail"].lower()
    await _recover(db_session, test_user, owner, store, component, finished)
    # Nothing changed: still completed, components still consumed.
    got = (await client.get(f"{BASE}/production-orders/{oid}")).json()
    assert got["status"] == "completed"
    assert got["inventory_posted_at"] is not None
    assert await _stock(db_session, store, component) == 100 - 6


async def test_cancel_then_reconfirm_reserves_again(
    client: AsyncClient, db_session, owner, finished, bom, store,
):
    order = await _create(client, finished, store, status="confirmed")
    oid = order["id"]
    assert order["materials_reserved_at"] is not None

    cancelled = (await _set_status(client, oid, "cancelled")).json()
    assert cancelled["materials_reserved_at"] is None

    active = (await db_session.execute(
        select(StockReservation).where(StockReservation.order_id == oid, StockReservation.status == "active")
    )).scalars().all()
    assert active == []

    back = await _set_status(client, oid, "confirmed")
    assert back.status_code == 200, back.text
    assert back.json()["materials_reserved_at"] is not None
    await db_session.rollback()
    active = (await db_session.execute(
        select(StockReservation).where(StockReservation.order_id == oid, StockReservation.status == "active")
    )).scalars().all()
    assert len(active) == 1 and float(active[0].reserved_qty) == 6.0


async def test_completion_consumes_components_from_storage_bins(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store,
):
    """Raw material that sits only in a bin (no default-location row) must be usable."""
    # Move all component stock into a bin.
    default_row = (await db_session.execute(
        select(StoreInventory).where(StoreInventory.store_id == store.id, StoreInventory.product_id == component.id)
    )).scalar_one()
    default_row.quantity = 0
    bin_a = StorageLocation(id=uuid.uuid4(), vendor_id=test_vendor.id, store_id=store.id, name="Bin A", code="A")
    bin_b = StorageLocation(id=uuid.uuid4(), vendor_id=test_vendor.id, store_id=store.id, name="Bin B", code="B")
    db_session.add_all([bin_a, bin_b])
    await db_session.flush()
    db_session.add_all([
        StoreInventory(id=uuid.uuid4(), store_id=store.id, vendor_id=test_vendor.id, product_id=component.id,
                       quantity=4, storage_location_id=bin_a.id),
        StoreInventory(id=uuid.uuid4(), store_id=store.id, vendor_id=test_vendor.id, product_id=component.id,
                       quantity=10, storage_location_id=bin_b.id),
    ])
    await db_session.commit()

    order = await _create(client, finished, store, status="confirmed")  # needs 6 fabric
    done = await _set_status(client, order["id"], "completed")
    assert done.status_code == 200, done.text

    posting = done.json()["inventory_posting"]
    comp_alloc = posting["components"][0]["allocations"]
    # Largest balance first: all 6 units come from Bin B (10 on hand), none from Bin A (4).
    assert comp_alloc == [{"storage_location_id": str(bin_b.id), "qty": 6}]


async def test_bin_allocations_are_restored_to_same_bins(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store,
):
    default_row = (await db_session.execute(
        select(StoreInventory).where(StoreInventory.store_id == store.id, StoreInventory.product_id == component.id)
    )).scalar_one()
    default_row.quantity = 0
    bin_a = StorageLocation(id=uuid.uuid4(), vendor_id=test_vendor.id, store_id=store.id, name="Bin A", code="A")
    bin_b = StorageLocation(id=uuid.uuid4(), vendor_id=test_vendor.id, store_id=store.id, name="Bin B", code="B")
    db_session.add_all([bin_a, bin_b])
    await db_session.flush()
    row_a = StoreInventory(id=uuid.uuid4(), store_id=store.id, vendor_id=test_vendor.id, product_id=component.id,
                           quantity=4, storage_location_id=bin_a.id)
    row_b = StoreInventory(id=uuid.uuid4(), store_id=store.id, vendor_id=test_vendor.id, product_id=component.id,
                           quantity=4, storage_location_id=bin_b.id)
    db_session.add_all([row_a, row_b])
    await db_session.commit()

    order = await _create(client, finished, store, status="confirmed")  # 6 fabric > any single bin
    oid = order["id"]
    done = await _set_status(client, oid, "completed")
    assert done.status_code == 200, done.text
    assert len(done.json()["inventory_posting"]["components"][0]["allocations"]) == 2

    assert (await _set_status(client, oid, "in_production")).status_code == 200
    await db_session.refresh(row_a)
    await db_session.refresh(row_b)
    assert (row_a.quantity, row_b.quantity) == (4, 4)


async def test_insufficient_stock_blocks_completion_atomically(
    client: AsyncClient, db_session, owner, test_user, finished, component, bom, store,
):
    order = await _create(client, finished, store, status="confirmed", qty=50)  # needs 150 > 100
    oid = order["id"]
    r = await _set_status(client, oid, "completed")
    assert r.status_code == 400, r.text
    await _recover(db_session, test_user, owner, store, component, finished)
    got = (await client.get(f"{BASE}/production-orders/{oid}")).json()
    assert got["status"] == "confirmed"
    assert got["inventory_posted_at"] is None
    assert await _stock(db_session, store, component) == 100


async def test_product_without_bom_does_not_consume_itself(
    client: AsyncClient, db_session, owner, finished, component, store,
):
    """No BOM defined: nothing to reserve/consume, finished goods are simply received."""
    order = await _create(client, finished, store, status="confirmed")
    assert order["material_requirements"] == []
    done = await _set_status(client, order["id"], "completed")
    assert done.status_code == 200, done.text
    assert await _stock(db_session, store, finished) == 2
    assert await _stock(db_session, store, component) == 100


# ══ Phase 3 — integrity, validation, audit ═══════════════════════════════

async def test_structural_fields_locked_after_confirmation(
    client: AsyncClient, owner, finished, bom, store,
):
    order = await _create(client, finished, store, status="confirmed")
    r = await client.put(f"{BASE}/production-orders/{order['id']}", json={
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 99, "name": "T-Shirt"}],
    })
    assert r.status_code == 409, r.text
    assert "items" in r.json()["detail"]

    # Re-sending identical items is not a change.
    same = await client.put(f"{BASE}/production-orders/{order['id']}", json={
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 2, "name": "T-Shirt (renamed)"}],
        "priority": "high",
    })
    assert same.status_code == 200, same.text


async def test_draft_items_editable_and_back_to_draft_unlocks(
    client: AsyncClient, owner, finished, bom, store,
):
    order = await _create(client, finished, store)  # draft
    edit = await client.put(f"{BASE}/production-orders/{order['id']}", json={
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 5, "name": "T-Shirt"}],
    })
    assert edit.status_code == 200, edit.text
    assert edit.json()["items"][0]["qty"] == 5

    assert (await _set_status(client, order["id"], "confirmed")).status_code == 200
    # confirmed -> draft AND edit in one request is allowed.
    back = await client.put(f"{BASE}/production-orders/{order['id']}", json={
        "status": "draft",
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 7, "name": "T-Shirt"}],
    })
    assert back.status_code == 200, back.text
    assert back.json()["items"][0]["qty"] == 7
    assert back.json()["materials_reserved_at"] is None


async def test_completed_order_is_read_only_except_notes(client: AsyncClient, owner, finished, bom, store):
    order = await _create(client, finished, store, status="confirmed")
    assert (await _set_status(client, order["id"], "completed")).status_code == 200
    blocked = await client.put(f"{BASE}/production-orders/{order['id']}", json={"priority": "urgent"})
    assert blocked.status_code == 409, blocked.text
    ok = await client.put(f"{BASE}/production-orders/{order['id']}", json={"notes": "QC passed"})
    assert ok.status_code == 200, ok.text


async def test_audit_trail_is_server_owned(client: AsyncClient, owner, finished, bom, store, test_user):
    order = await _create(client, finished, store)
    oid = order["id"]
    assert order["audit_log"][0]["action"] == "created"
    assert order["audit_log"][0]["actor"] == test_user.full_name

    forged = {"id": "x", "action": "status_changed", "actor": "Somebody Else", "timestamp": "2020-01-01", "detail": "forged"}
    r = await client.put(f"{BASE}/production-orders/{oid}", json={
        "audit_event": forged, "audit_log": [forged], "priority": "high",
    })
    assert r.status_code == 200, r.text
    log = r.json()["audit_log"]
    assert all(e["actor"] == test_user.full_name for e in log)
    assert not any(e.get("detail") == "forged" for e in log)
    assert any(e["action"] == "priority_changed" for e in log)

    r2 = await _set_status(client, oid, "confirmed")
    events = [e for e in r2.json()["audit_log"] if e["action"] == "status_changed"]
    assert events and events[-1]["meta"]["from"] == "draft" and events[-1]["meta"]["to"] == "confirmed"


@pytest.mark.parametrize("patch", [
    {"progress": 150},
    {"progress": -1},
    {"priority": "whenever"},
    {"status": "teleported"},
    {"items": [{"item_type": "product", "product_id": str(uuid.uuid4()), "qty": -3, "name": "x"}]},
    {"items": [{"item_type": "product", "qty": 0, "name": "x"}]},
    {"attachments": [{"name": "x", "type": "a/b", "size": 1, "dataUrl": "javascript:alert(1)"}]},
    {"attachments": [{"name": "big", "type": "a/b", "size": 99_000_000, "dataUrl": "data:a/b;base64,AA=="}]},
])
async def test_invalid_input_is_rejected(client: AsyncClient, owner, finished, store, patch):
    order = await _create(client, finished, store)
    r = await client.put(f"{BASE}/production-orders/{order['id']}", json=patch)
    assert r.status_code == 422, r.text


async def test_unknown_product_in_items_is_rejected(client: AsyncClient, owner, finished, store):
    r = await client.post(f"{BASE}/production-orders", json={
        "type": "mts", "store_id": str(store.id),
        "items": [{"item_type": "product", "product_id": str(uuid.uuid4()), "qty": 1, "name": "ghost"}],
    })
    assert r.status_code == 400, r.text


async def test_duplicate_reference_is_a_400(client: AsyncClient, owner, finished, store):
    await _create(client, finished, store, ref="PO-DUP-1")
    r = await client.post(f"{BASE}/production-orders", json=_order_body(finished, store, ref="PO-DUP-1"))
    assert r.status_code == 400, r.text

    other = await _create(client, finished, store, ref="PO-DUP-2")
    r2 = await client.put(f"{BASE}/production-orders/{other['id']}", json={"ref": "PO-DUP-1"})
    assert r2.status_code == 400, r2.text


async def test_delete_rules(client: AsyncClient, owner, finished, bom, store):
    draft = await _create(client, finished, store)
    assert (await client.delete(f"{BASE}/production-orders/{draft['id']}")).status_code == 204

    live = await _create(client, finished, store, status="confirmed")
    assert (await client.delete(f"{BASE}/production-orders/{live['id']}")).status_code == 409
    assert (await _set_status(client, live["id"], "cancelled")).status_code == 200
    assert (await client.delete(f"{BASE}/production-orders/{live['id']}")).status_code == 204


async def test_import_local_is_safe(client: AsyncClient, owner, finished, store):
    payload = {
        "default_store_id": str(store.id),
        "orders": [
            {"ref": "LOC-1", "type": "mts", "status": "completed", "progress": 100,
             "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 3, "name": "T-Shirt"}]},
            {"ref": "LOC-2", "type": "mto", "customer_id": "not-a-uuid", "progress": "abc", "priority": "weird"},
            {"ref": "", "type": "mts"},
            {"ref": "LOC-4", "items": [{"item_type": "product", "qty": -5}]},
            {"ref": "LOC-1"},
        ],
    }
    r = await client.post(f"{BASE}/production-orders/import-local", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] == 2
    assert body["skipped"] == 3
    assert {e["ref"] for e in body["errors"]} == {"(none)", "LOC-4", "LOC-1"}

    listing = (await client.get(f"{BASE}/production-orders")).json()["items"]
    imported = {o["ref"]: o for o in listing}
    assert imported["LOC-1"]["status"] == "draft"          # never posted -> always draft
    assert imported["LOC-2"]["priority"] == "medium"
    assert imported["LOC-2"]["progress"] == 0

    too_many = await client.post(f"{BASE}/production-orders/import-local", json={"orders": [{"ref": f"X{i}"} for i in range(201)]})
    assert too_many.status_code == 422
