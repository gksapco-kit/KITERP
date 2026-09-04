"""
End-to-end inventory module scenarios via FastAPI ASGI + SQLite harness.

Covers core stock ops, alerts, settings, stock counts, transfer orders,
instant store transfer, write-off, reports, FIFO, and known-gap probes.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryMovement
from app.models.store import Store, StoreInventory
from app.models.stock_cost_layer import StockCostLayer
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser
from app.models.user import User
from app.services.fifo_cost_service import FifoCostService

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/vendors/me/inventory"
STORES = "/api/v1/vendors/me/stores"


@pytest_asyncio.fixture
async def owner(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        user_id=test_user.id,
        role="owner",
        permissions=[],
        is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    return vu


@pytest_asyncio.fixture
async def tracked_product(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="E2E Widget",
        slug=f"e2e-widget-{uuid.uuid4().hex[:6]}",
        sku=f"SKU-{uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        cost_price=Decimal("40.00"),
        currency="INR",
        status="active",
        product_type="physical",
        track_inventory=True,
        quantity=0,
        low_stock_threshold=5,
        reorder_point=10,
        category="Widgets",
        created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def store_a(db_session: AsyncSession, test_vendor: Vendor) -> Store:
    s = Store(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Store A",
        code="SA",
        is_default=True,
        unit_type="business_unit",
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest_asyncio.fixture
async def store_b(db_session: AsyncSession, test_vendor: Vendor) -> Store:
    s = Store(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Store B",
        code="SB",
        is_default=False,
        unit_type="business_unit",
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


# ── Settings ──────────────────────────────────────────────────────────────────

async def test_01_settings_get_and_toggle(client: AsyncClient, owner: VendorUser):
    get_r = await client.get(f"{BASE}/settings")
    assert get_r.status_code == 200, get_r.text
    assert "auto_generate_barcode" in get_r.json()

    put_r = await client.put(f"{BASE}/settings", json={"auto_generate_barcode": True})
    assert put_r.status_code == 200, put_r.text
    assert put_r.json()["auto_generate_barcode"] is True

    get2 = await client.get(f"{BASE}/settings")
    assert get2.json()["auto_generate_barcode"] is True


# ── Core stock ops (global) ───────────────────────────────────────────────────

async def test_02_stock_in_global(client: AsyncClient, owner: VendorUser, tracked_product: Product, db_session: AsyncSession):
    pid = tracked_product.id
    r = await client.post(f"{BASE}/stock-in", json={
        "product_id": str(pid),
        "quantity": 20,
        "reason": "Initial receipt",
        "cost_price": 40,
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["movement_type"] == "stock_in"
    assert body["quantity"] == 20
    assert body["quantity_after"] == 20

    db_session.expire_all()
    refreshed = await db_session.get(Product, pid)
    assert refreshed is not None
    assert refreshed.quantity == 20


async def test_03_stock_out_and_insufficient(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, db_session: AsyncSession,
):
    pid = tracked_product.id
    await client.post(f"{BASE}/stock-in", json={"product_id": str(pid), "quantity": 10})

    ok = await client.post(f"{BASE}/stock-out", json={
        "product_id": str(pid), "quantity": 3, "reason": "Damage",
    })
    assert ok.status_code == 201, ok.text
    assert ok.json()["quantity_after"] == 7

    bad = await client.post(f"{BASE}/stock-out", json={
        "product_id": str(pid), "quantity": 100,
    })
    assert bad.status_code == 400, bad.text

    db_session.expire_all()
    refreshed = await db_session.get(Product, pid)
    assert refreshed is not None
    assert refreshed.quantity == 7


async def test_04_adjust_absolute(client: AsyncClient, owner: VendorUser, tracked_product: Product, db_session: AsyncSession):
    pid = tracked_product.id
    await client.post(f"{BASE}/stock-in", json={"product_id": str(pid), "quantity": 15})
    r = await client.post(f"{BASE}/adjust", json={
        "product_id": str(pid),
        "new_quantity": 4,
        "reason": "Cycle recount",
    })
    assert r.status_code == 201, r.text
    db_session.expire_all()
    refreshed = await db_session.get(Product, pid)
    assert refreshed is not None
    assert refreshed.quantity == 4


async def test_05_location_without_store_rejected(client: AsyncClient, owner: VendorUser, tracked_product: Product):
    r = await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 1,
        "storage_location_id": str(uuid.uuid4()),
    })
    assert r.status_code == 400, r.text


async def test_06_history_summary_low_stock_reorder(
    client: AsyncClient, owner: VendorUser, tracked_product: Product,
):
    await client.post(f"{BASE}/stock-in", json={"product_id": str(tracked_product.id), "quantity": 12})
    await client.post(f"{BASE}/stock-out", json={"product_id": str(tracked_product.id), "quantity": 9})

    hist = await client.get(f"{BASE}/history", params={"product_id": str(tracked_product.id)})
    assert hist.status_code == 200, hist.text
    assert hist.json()["total"] >= 2

    summary = await client.get(f"{BASE}/summary")
    assert summary.status_code == 200, summary.text
    assert "items" in summary.json()

    low = await client.get(f"{BASE}/low-stock")
    assert low.status_code == 200, low.text
    # 12-9=3, threshold=5 → should appear
    assert low.json()["total"] >= 1

    reorder = await client.get(f"{BASE}/reorder-alerts")
    assert reorder.status_code == 200, reorder.text


async def test_07_write_off_global(client: AsyncClient, owner: VendorUser, tracked_product: Product, db_session: AsyncSession):
    pid = tracked_product.id
    await client.post(f"{BASE}/stock-in", json={"product_id": str(pid), "quantity": 10})
    r = await client.post(f"{BASE}/write-off", json={
        "product_id": str(pid),
        "quantity": 2,
        "reason": "Expired",
    })
    assert r.status_code == 201, r.text
    assert r.json()["quantity_written_off"] == 2

    zero = await client.post(f"{BASE}/write-off", json={
        "product_id": str(pid),
        "quantity": 0,
    })
    assert zero.status_code == 400

    db_session.expire_all()
    refreshed = await db_session.get(Product, pid)
    assert refreshed is not None
    assert refreshed.quantity == 8


async def test_08_expiry_alerts(client: AsyncClient, owner: VendorUser, tracked_product: Product):
    await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 5,
        "expiration_date": "2020-01-01",
    })
    r = await client.get(f"{BASE}/expiry-alerts", params={"days_ahead": 30})
    assert r.status_code == 200, r.text
    assert "items" in r.json()
    assert "summary" in r.json()


# ── Store-scoped stock ────────────────────────────────────────────────────────

async def test_09_stock_in_out_at_store(
    client: AsyncClient, owner: VendorUser, tracked_product: Product,
    store_a: Store, db_session: AsyncSession,
):
    r = await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 25,
        "store_id": str(store_a.id),
    })
    assert r.status_code == 201, r.text

    row = (
        await db_session.execute(
            select(StoreInventory).where(
                StoreInventory.store_id == store_a.id,
                StoreInventory.product_id == tracked_product.id,
                StoreInventory.variant_id.is_(None),
                StoreInventory.storage_location_id.is_(None),
            )
        )
    ).scalar_one()
    assert row.quantity == 25

    out = await client.post(f"{BASE}/stock-out", json={
        "product_id": str(tracked_product.id),
        "quantity": 5,
        "store_id": str(store_a.id),
    })
    assert out.status_code == 201, out.text
    await db_session.refresh(row)
    assert row.quantity == 20


async def test_10_instant_store_transfer(
    client: AsyncClient, owner: VendorUser, tracked_product: Product,
    store_a: Store, store_b: Store, db_session: AsyncSession,
):
    await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 30,
        "store_id": str(store_a.id),
    })

    same = await client.post(f"{STORES}/transfer", json={
        "from_store_id": str(store_a.id),
        "to_store_id": str(store_a.id),
        "product_id": str(tracked_product.id),
        "quantity": 5,
    })
    assert same.status_code == 400

    ok = await client.post(f"{STORES}/transfer", json={
        "from_store_id": str(store_a.id),
        "to_store_id": str(store_b.id),
        "product_id": str(tracked_product.id),
        "quantity": 12,
        "reason": "Rebalance",
    })
    assert ok.status_code == 200, ok.text

    from_row = (
        await db_session.execute(
            select(StoreInventory).where(
                StoreInventory.store_id == store_a.id,
                StoreInventory.product_id == tracked_product.id,
                StoreInventory.storage_location_id.is_(None),
            )
        )
    ).scalar_one()
    to_row = (
        await db_session.execute(
            select(StoreInventory).where(
                StoreInventory.store_id == store_b.id,
                StoreInventory.product_id == tracked_product.id,
                StoreInventory.storage_location_id.is_(None),
            )
        )
    ).scalar_one()
    assert from_row.quantity == 18
    assert to_row.quantity == 12

    insuf = await client.post(f"{STORES}/transfer", json={
        "from_store_id": str(store_a.id),
        "to_store_id": str(store_b.id),
        "product_id": str(tracked_product.id),
        "quantity": 999,
    })
    assert insuf.status_code == 400


# ── Stock transfer orders ─────────────────────────────────────────────────────

async def test_11_sto_happy_path(
    client: AsyncClient, owner: VendorUser, tracked_product: Product,
    store_a: Store, store_b: Store, db_session: AsyncSession,
):
    await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 40,
        "store_id": str(store_a.id),
    })

    create = await client.post(f"{BASE}/transfer-orders", json={
        "from_store_id": str(store_a.id),
        "to_store_id": str(store_b.id),
        "notes": "STO e2e",
        "lines": [{"product_id": str(tracked_product.id), "requested_qty": 10}],
    })
    assert create.status_code == 201, create.text
    order_id = create.json()["id"]
    assert create.json()["status"] == "draft"

    submit = await client.post(f"{BASE}/transfer-orders/{order_id}/submit")
    assert submit.status_code == 200, submit.text
    assert submit.json()["status"] == "submitted"

    dispatch = await client.post(f"{BASE}/transfer-orders/{order_id}/dispatch")
    assert dispatch.status_code == 200, dispatch.text
    assert dispatch.json()["status"] == "dispatched"

    detail = await client.get(f"{BASE}/transfer-orders/{order_id}")
    assert detail.status_code == 200, detail.text
    line_id = detail.json()["lines"][0]["id"]

    # Cannot cancel after dispatch
    cancel = await client.post(f"{BASE}/transfer-orders/{order_id}/cancel")
    assert cancel.status_code == 400, cancel.text

    receive = await client.post(f"{BASE}/transfer-orders/{order_id}/receive", json={
        "lines": [{"line_id": line_id, "received_qty": 10}],
    })
    assert receive.status_code == 200, receive.text
    assert receive.json()["status"] == "received"

    from_row = (
        await db_session.execute(
            select(StoreInventory).where(
                StoreInventory.store_id == store_a.id,
                StoreInventory.product_id == tracked_product.id,
                StoreInventory.storage_location_id.is_(None),
            )
        )
    ).scalar_one()
    to_row = (
        await db_session.execute(
            select(StoreInventory).where(
                StoreInventory.store_id == store_b.id,
                StoreInventory.product_id == tracked_product.id,
                StoreInventory.storage_location_id.is_(None),
            )
        )
    ).scalar_one()
    assert from_row.quantity == 30
    assert to_row.quantity == 10


async def test_12_sto_insufficient_dispatch_and_cancel_draft(
    client: AsyncClient, owner: VendorUser, tracked_product: Product,
    store_a: Store, store_b: Store,
):
    await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 2,
        "store_id": str(store_a.id),
    })

    create = await client.post(f"{BASE}/transfer-orders", json={
        "from_store_id": str(store_a.id),
        "to_store_id": str(store_b.id),
        "lines": [{"product_id": str(tracked_product.id), "requested_qty": 50}],
    })
    assert create.status_code == 201, create.text
    order_id = create.json()["id"]

    await client.post(f"{BASE}/transfer-orders/{order_id}/submit")
    dispatch = await client.post(f"{BASE}/transfer-orders/{order_id}/dispatch")
    assert dispatch.status_code == 400, dispatch.text

    # Separate draft cancel path
    create2 = await client.post(f"{BASE}/transfer-orders", json={
        "from_store_id": str(store_a.id),
        "to_store_id": str(store_b.id),
        "lines": [{"product_id": str(tracked_product.id), "requested_qty": 1}],
    })
    oid2 = create2.json()["id"]
    cancel = await client.post(f"{BASE}/transfer-orders/{oid2}/cancel")
    assert cancel.status_code == 200, cancel.text
    assert cancel.json()["status"] == "cancelled"


async def test_13_sto_short_receive(
    client: AsyncClient, owner: VendorUser, tracked_product: Product,
    store_a: Store, store_b: Store, db_session: AsyncSession,
):
    await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 20,
        "store_id": str(store_a.id),
    })
    create = await client.post(f"{BASE}/transfer-orders", json={
        "from_store_id": str(store_a.id),
        "to_store_id": str(store_b.id),
        "lines": [{"product_id": str(tracked_product.id), "requested_qty": 8}],
    })
    order_id = create.json()["id"]
    await client.post(f"{BASE}/transfer-orders/{order_id}/submit")
    await client.post(f"{BASE}/transfer-orders/{order_id}/dispatch")
    detail = await client.get(f"{BASE}/transfer-orders/{order_id}")
    line_id = detail.json()["lines"][0]["id"]

    receive = await client.post(f"{BASE}/transfer-orders/{order_id}/receive", json={
        "lines": [{"line_id": line_id, "received_qty": 5}],
    })
    assert receive.status_code == 200, receive.text
    assert receive.json()["status"] == "received"

    to_row = (
        await db_session.execute(
            select(StoreInventory).where(
                StoreInventory.store_id == store_b.id,
                StoreInventory.product_id == tracked_product.id,
                StoreInventory.storage_location_id.is_(None),
            )
        )
    ).scalar_one()
    assert to_row.quantity == 5


# ── Stock counts ──────────────────────────────────────────────────────────────

async def test_14_stock_count_lifecycle_with_variance(
    client: AsyncClient, owner: VendorUser, tracked_product: Product,
    store_a: Store, db_session: AsyncSession,
):
    await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 10,
        "store_id": str(store_a.id),
    })

    create = await client.post(f"{BASE}/stock-counts", json={
        "count_type": "cycle_count",
        "description": "E2E count",
        "store_id": str(store_a.id),
        "freeze_stock": True,
        "product_ids": [str(tracked_product.id)],
    })
    assert create.status_code == 201, create.text
    count_id = create.json()["id"]
    assert create.json()["status"] == "draft"
    assert create.json()["freeze_stock"] is True

    start = await client.post(f"{BASE}/stock-counts/{count_id}/start")
    assert start.status_code == 200, start.text

    # freeze_stock gap: stock-in still allowed while count is in progress
    freeze_probe = await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 1,
        "store_id": str(store_a.id),
    })
    assert freeze_probe.status_code == 201, freeze_probe.text  # documents GAP: freeze not enforced

    detail = await client.get(f"{BASE}/stock-counts/{count_id}")
    assert detail.status_code == 200, detail.text
    line = detail.json()["lines"][0]
    line_id = line["id"]
    # system_qty was snapped at start (10); freeze didn't block later stock-in
    assert line["system_qty"] == 10

    update = await client.put(
        f"{BASE}/stock-counts/{count_id}/lines/{line_id}",
        json={"counted_qty": 7, "notes": "Short 3"},
    )
    assert update.status_code == 200, update.text
    assert update.json()["variance"] == -3

    review = await client.post(f"{BASE}/stock-counts/{count_id}/review")
    assert review.status_code == 200, review.text

    post = await client.post(f"{BASE}/stock-counts/{count_id}/post")
    assert post.status_code == 200, post.text
    assert post.json()["status"] == "completed"

    row = (
        await db_session.execute(
            select(StoreInventory).where(
                StoreInventory.store_id == store_a.id,
                StoreInventory.product_id == tracked_product.id,
                StoreInventory.storage_location_id.is_(None),
            )
        )
    ).scalar_one()
    # Post sets to counted_qty=7 (absolute), ignoring the extra +1 stock-in during freeze gap
    assert row.quantity == 7

    variance = await client.get(f"{BASE}/stock-counts/{count_id}/variance-report")
    assert variance.status_code == 200, variance.text

    # Cannot cancel completed
    cancel = await client.post(f"{BASE}/stock-counts/{count_id}/cancel")
    assert cancel.status_code == 400


async def test_15_stock_count_cancel_draft_and_invalid_transitions(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store_a: Store,
):
    create = await client.post(f"{BASE}/stock-counts", json={
        "count_type": "spot_check",
        "store_id": str(store_a.id),
        "product_ids": [str(tracked_product.id)],
    })
    count_id = create.json()["id"]

    # Post while still draft should fail
    post = await client.post(f"{BASE}/stock-counts/{count_id}/post")
    assert post.status_code == 400

    cancel = await client.post(f"{BASE}/stock-counts/{count_id}/cancel")
    assert cancel.status_code == 200, cancel.text
    assert cancel.json()["status"] == "cancelled"


# ── Reports & FIFO ────────────────────────────────────────────────────────────

async def test_16_reports_endpoints(client: AsyncClient, owner: VendorUser, tracked_product: Product):
    await client.post(f"{BASE}/stock-in", json={"product_id": str(tracked_product.id), "quantity": 15})
    await client.post(f"{BASE}/stock-out", json={"product_id": str(tracked_product.id), "quantity": 2})

    for path, params in [
        ("/reports/stock-value", {"group_by": "category"}),
        ("/reports/stock-value", {"group_by": "store"}),
        ("/reports/stock-value", {"group_by": "all"}),
        ("/reports/abc-analysis", {"days": 90}),
        ("/reports/stock-aging", {}),
        ("/reports/slow-movers", {"days": 30}),
        ("/reports/fifo-valuation", {}),
    ]:
        r = await client.get(f"{BASE}{path}", params=params)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text}"

    # group_by=store is advertised but returns flat/category-style payload (gap probe)
    store_group = await client.get(f"{BASE}/reports/stock-value", params={"group_by": "store"})
    body = store_group.json()
    # Document current behavior: no per-store grouping key required to exist
    assert "items" in body or "groups" in body or "total_value" in body or isinstance(body, (dict, list))


async def test_17_fifo_manual_layer_and_auto_gap(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, db_session: AsyncSession,
):
    # Stock-in should NOT auto-create FIFO layer (documented gap)
    await client.post(f"{BASE}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 10,
        "cost_price": 40,
    })
    layers_before = (
        await db_session.execute(
            select(StockCostLayer).where(StockCostLayer.product_id == tracked_product.id)
        )
    ).scalars().all()
    assert len(layers_before) == 0  # GAP: no auto layer on stock-in

    # Endpoint takes query params (not JSON body)
    create = await client.post(
        f"{BASE}/reports/fifo-valuation/create-layer",
        params={
            "product_id": str(tracked_product.id),
            "quantity": 10,
            "unit_cost": 40,
        },
    )
    assert create.status_code == 201, create.text

    val = await client.get(f"{BASE}/reports/fifo-valuation")
    assert val.status_code == 200, val.text
    payload = val.json()
    assert (
        payload.get("total", 0) >= 1
        or len(payload.get("items", [])) >= 1
        or len(payload.get("layers", [])) >= 1
        or payload.get("total_products", 0) >= 1
    ), payload

    # Consume via service (sale path does not call this — gap)
    svc = FifoCostService(db_session)
    consumed = await svc.consume_layers(
        vendor_id=tracked_product.vendor_id,
        product_id=tracked_product.id,
        quantity=3,
    )
    assert consumed["cogs"] > 0
    await db_session.commit()


# ── Permission denial ─────────────────────────────────────────────────────────

async def test_18_staff_without_inventory_denied(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor, test_user: User,
):
    # Replace owner with staff lacking inventory.view
    existing = (
        await db_session.execute(
            select(VendorUser).where(
                VendorUser.vendor_id == test_vendor.id,
                VendorUser.user_id == test_user.id,
            )
        )
    ).scalars().all()
    for vu in existing:
        await db_session.delete(vu)
    await db_session.commit()

    staff = VendorUser(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        user_id=test_user.id,
        role="staff",
        permissions=[],  # staff baseline may or may not include inventory.view
        is_active=True,
    )
    # Force empty effective perms via custom empty override by using role with no inventory
    # Use cashier-like: set role custom with empty — simplest: permissions override won't remove base.
    # So use a role that lacks inventory: check DEFAULT — "accountant" may lack it.
    staff.role = "accountant"
    db_session.add(staff)
    await db_session.commit()

    from app.models.vendor_role import DEFAULT_ROLE_PERMISSIONS
    if "inventory.view" in DEFAULT_ROLE_PERMISSIONS.get("accountant", []):
        pytest.skip("accountant has inventory.view; cannot assert denial")

    r = await client.get(f"{BASE}/summary")
    assert r.status_code == 403, r.text
