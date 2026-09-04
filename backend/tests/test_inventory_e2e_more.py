"""
Next-round inventory E2E — consignment, goods movements, multi-bin,
adjust-at-location, variant instant transfer, reservation bulk release,
service-level insufficient-stock race, and known-gap probes.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryMovement
from app.models.procurement import Supplier
from app.models.store import Store, StoreInventory
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product, ProductVariant
from app.models.vendor_user import VendorUser
from app.services.store_inventory_service import apply_store_inventory_delta

pytestmark = pytest.mark.asyncio

INV = "/api/v1/vendors/me/inventory"
PROC = "/api/v1/vendors/me/procurement"
PLANTS = "/api/v1/vendors/me/plants"
SLOCS = "/api/v1/vendors/me/storage-locations"
STORES = "/api/v1/vendors/me/stores"
ME = "/api/v1/vendors/me"


async def _product_qty(db: AsyncSession, product_id) -> int:
    return int(
        (await db.execute(select(Product.quantity).where(Product.id == product_id))).scalar_one()
    )


async def _store_qty(
    db: AsyncSession, store_id, product_id, *, variant_id=None, location_id=None,
) -> int:
    q = select(StoreInventory.quantity).where(
        StoreInventory.store_id == store_id,
        StoreInventory.product_id == product_id,
    )
    if variant_id is None:
        q = q.where(StoreInventory.variant_id.is_(None))
    else:
        q = q.where(StoreInventory.variant_id == variant_id)
    if location_id is None:
        q = q.where(StoreInventory.storage_location_id.is_(None))
    else:
        q = q.where(StoreInventory.storage_location_id == location_id)
    val = (await db.execute(q)).scalar_one_or_none()
    return int(val or 0)


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
        name="More Widget",
        slug=f"more-{uuid.uuid4().hex[:6]}",
        sku=f"MW-{uuid.uuid4().hex[:6]}",
        price=Decimal("100"),
        cost_price=Decimal("40"),
        currency="INR",
        status="active",
        product_type="physical",
        track_inventory=True,
        quantity=0,
        created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def store(db_session: AsyncSession, test_vendor: Vendor) -> Store:
    s = Store(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Hub",
        code="HUB",
        is_default=True,
        unit_type="business_unit",
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest_asyncio.fixture
async def plant_and_bins(client: AsyncClient, owner: VendorUser, store: Store):
    plant = await client.post(PLANTS, json={
        "store_id": str(store.id), "name": "Hub Plant", "code": "HP",
    })
    assert plant.status_code == 201, plant.text
    plant_id = plant.json()["id"]
    a = await client.post(SLOCS, json={
        "store_id": str(store.id), "plant_id": plant_id,
        "name": "Bin A", "code": "BA", "stock_type": "unrestricted",
    })
    b = await client.post(SLOCS, json={
        "store_id": str(store.id), "plant_id": plant_id,
        "name": "Bin B", "code": "BB", "stock_type": "unrestricted",
    })
    assert a.status_code == 201 and b.status_code == 201, (a.text, b.text)
    return {
        "plant_id": plant_id,
        "bin_a": a.json()["id"],
        "bin_b": b.json()["id"],
        "store_id": str(store.id),
    }


# ── Consignment ───────────────────────────────────────────────────────────────

async def test_32_consignment_create_withdraw_no_store_inventory(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
    db_session: AsyncSession, test_vendor: Vendor,
):
    supplier = Supplier(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Consign Sup",
        party_type="supplier",
        is_active=True,
    )
    db_session.add(supplier)
    await db_session.commit()
    pid = tracked_product.id
    sid = supplier.id

    create = await client.post(f"{PROC}/consignment-stock", json={
        "supplier_id": str(sid),
        "product_id": str(pid),
        "quantity_available": 20,
        "unit_price": 15,
        "currency": "INR",
    })
    assert create.status_code == 201, create.text
    cs_id = create.json()["id"]
    assert create.json()["quantity_available"] == 20
    assert create.json()["quantity_withdrawn"] == 0

    # Consignment is bookkeeping only — Product / StoreInventory unchanged
    assert await _product_qty(db_session, pid) == 0
    store_rows = (
        await db_session.execute(
            select(func.count()).select_from(StoreInventory).where(
                StoreInventory.product_id == pid,
            )
        )
    ).scalar_one()
    assert store_rows == 0

    withdraw = await client.post(f"{PROC}/consignment-stock/{cs_id}/withdraw", json={
        "quantity": 5, "notes": "issue to floor",
    })
    assert withdraw.status_code == 200, withdraw.text
    assert withdraw.json()["quantity_available"] == 15
    assert withdraw.json()["quantity_withdrawn"] == 5

    # Still no StoreInventory / product qty side effects
    assert await _product_qty(db_session, pid) == 0
    moves = (
        await db_session.execute(
            select(func.count()).select_from(InventoryMovement).where(
                InventoryMovement.product_id == pid,
            )
        )
    ).scalar_one()
    assert moves == 0

    over = await client.post(f"{PROC}/consignment-stock/{cs_id}/withdraw", json={
        "quantity": 999,
    })
    assert over.status_code == 400, over.text

    listed = await client.get(f"{PROC}/consignment-stock", params={"supplier_id": str(sid)})
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] >= 1


# ── Multi-bin + adjust at location ────────────────────────────────────────────

async def test_33_multi_bin_unique_rows_and_adjust(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
    plant_and_bins, db_session: AsyncSession,
):
    pid = tracked_product.id
    sid = store.id
    bin_a = uuid.UUID(plant_and_bins["bin_a"])
    bin_b = uuid.UUID(plant_and_bins["bin_b"])

    r1 = await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid), "quantity": 10,
        "store_id": str(sid), "storage_location_id": str(bin_a),
    })
    r2 = await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid), "quantity": 4,
        "store_id": str(sid), "storage_location_id": str(bin_b),
    })
    assert r1.status_code == 201 and r2.status_code == 201, (r1.text, r2.text)

    assert await _store_qty(db_session, sid, pid, location_id=bin_a) == 10
    assert await _store_qty(db_session, sid, pid, location_id=bin_b) == 4
    assert await _product_qty(db_session, pid) == 14

    adj = await client.post(f"{INV}/adjust", json={
        "product_id": str(pid),
        "new_quantity": 6,
        "store_id": str(sid),
        "storage_location_id": str(bin_a),
        "reason": "Bin recount",
    })
    assert adj.status_code == 201, adj.text
    assert await _store_qty(db_session, sid, pid, location_id=bin_a) == 6
    assert await _store_qty(db_session, sid, pid, location_id=bin_b) == 4
    assert await _product_qty(db_session, pid) == 10


async def test_34_invalid_storage_location_rejected(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
):
    r = await client.post(f"{INV}/stock-in", json={
        "product_id": str(tracked_product.id),
        "quantity": 1,
        "store_id": str(store.id),
        "storage_location_id": str(uuid.uuid4()),
    })
    assert r.status_code == 400, r.text


async def test_35_put_store_inventory_with_multi_bin_rows(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
    plant_and_bins, db_session: AsyncSession,
):
    """PUT updates the bin-less store row only; location-scoped rows stay intact."""
    pid = tracked_product.id
    sid = store.id
    bin_a = uuid.UUID(plant_and_bins["bin_a"])
    bin_b = uuid.UUID(plant_and_bins["bin_b"])

    await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid), "quantity": 3,
        "store_id": str(sid), "storage_location_id": str(bin_a),
    })
    await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid), "quantity": 2,
        "store_id": str(sid), "storage_location_id": str(bin_b),
    })

    put = await client.put(
        f"{STORES}/{sid}/inventory/{pid}",
        json={"quantity": 9, "low_stock_threshold": 1},
    )
    assert put.status_code == 200, put.text
    assert put.json()["quantity"] == 9

    assert await _store_qty(db_session, sid, pid) == 9
    assert await _store_qty(db_session, sid, pid, location_id=bin_a) == 3
    assert await _store_qty(db_session, sid, pid, location_id=bin_b) == 2
    # Product rollup sums all null-variant store rows (bins + bin-less)
    assert await _product_qty(db_session, pid) == 14


# ── Instant transfer with variant ─────────────────────────────────────────────

async def test_36_instant_transfer_with_variant(
    client: AsyncClient, owner: VendorUser,
    db_session: AsyncSession, test_vendor: Vendor, test_user: User,
):
    store_a = Store(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="A", code="TA",
        is_default=True, unit_type="business_unit",
    )
    store_b = Store(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="B", code="TB",
        is_default=False, unit_type="business_unit",
    )
    product = Product(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="Var Transfer",
        slug=f"vt-{uuid.uuid4().hex[:6]}", price=Decimal("10"), currency="INR",
        status="active", product_type="physical", track_inventory=True, quantity=0,
        created_by=test_user.id,
    )
    db_session.add_all([store_a, store_b, product])
    await db_session.flush()
    variant = ProductVariant(
        id=uuid.uuid4(), product_id=product.id, name="Size L",
        sku=f"L-{uuid.uuid4().hex[:5]}", price=Decimal("10"), quantity=0,
        track_inventory=True, is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()
    pid, vid, a_id, b_id = product.id, variant.id, store_a.id, store_b.id

    inn = await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid), "variant_id": str(vid),
        "quantity": 8, "store_id": str(a_id),
    })
    assert inn.status_code == 201, inn.text

    xfer = await client.post(f"{STORES}/transfer", json={
        "from_store_id": str(a_id),
        "to_store_id": str(b_id),
        "product_id": str(pid),
        "variant_id": str(vid),
        "quantity": 3,
    })
    assert xfer.status_code == 200, xfer.text
    assert await _store_qty(db_session, a_id, pid, variant_id=vid) == 5
    assert await _store_qty(db_session, b_id, pid, variant_id=vid) == 3


# ── Goods movements ───────────────────────────────────────────────────────────

async def test_37_goods_movement_receipt_no_po(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
    plant_and_bins, db_session: AsyncSession,
):
    pid = tracked_product.id
    plant_id = plant_and_bins["plant_id"]
    bin_a = plant_and_bins["bin_a"]

    r = await client.post(f"{PROC}/goods-movements", json={
        "movement_type": "receipt_no_po",
        "plant_id": plant_id,
        "to_storage_location_id": bin_a,
        "notes": "misc receipt",
        "lines": [{"product_id": str(pid), "quantity": 11, "batch_number": "GM-LOT-1"}],
    })
    assert r.status_code == 201, r.text
    assert r.json()["document_number"].startswith("GMD-")
    assert r.json()["movement_type"] == "receipt_no_po"

    assert await _store_qty(
        db_session, store.id, pid, location_id=uuid.UUID(bin_a),
    ) == 11
    assert await _product_qty(db_session, pid) == 11


async def test_38_goods_movement_sloc_transfer(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
    plant_and_bins, db_session: AsyncSession,
):
    pid = tracked_product.id
    plant_id = plant_and_bins["plant_id"]
    bin_a = plant_and_bins["bin_a"]
    bin_b = plant_and_bins["bin_b"]

    # Seed via receipt so a GoodsBatch exists (sloc_transfer only moves SI when batches transfer)
    seed = await client.post(f"{PROC}/goods-movements", json={
        "movement_type": "receipt_no_po",
        "plant_id": plant_id,
        "to_storage_location_id": bin_a,
        "lines": [{"product_id": str(pid), "quantity": 10, "batch_number": "XFER-SRC"}],
    })
    assert seed.status_code == 201, seed.text

    xfer = await client.post(f"{PROC}/goods-movements", json={
        "movement_type": "sloc_transfer",
        "plant_id": plant_id,
        "from_storage_location_id": bin_a,
        "to_storage_location_id": bin_b,
        "lines": [{
            "product_id": str(pid),
            "quantity": 4,
            "to_plant_id": plant_id,
        }],
    })
    assert xfer.status_code == 201, xfer.text

    assert await _store_qty(db_session, store.id, pid, location_id=uuid.UUID(bin_a)) == 6
    assert await _store_qty(db_session, store.id, pid, location_id=uuid.UUID(bin_b)) == 4


async def test_39_sloc_transfer_without_batch_is_noop_gap(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
    plant_and_bins, db_session: AsyncSession,
):
    """Documented gap: sloc_transfer only adjusts StoreInventory when GoodsBatch transfers > 0."""
    pid = tracked_product.id
    plant_id = plant_and_bins["plant_id"]
    bin_a = plant_and_bins["bin_a"]
    bin_b = plant_and_bins["bin_b"]

    # Manual stock-in creates StoreInventory but typically no GoodsBatch unless batch_managed
    await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid), "quantity": 5,
        "store_id": str(store.id), "storage_location_id": bin_a,
    })
    assert await _store_qty(db_session, store.id, pid, location_id=uuid.UUID(bin_a)) == 5

    xfer = await client.post(f"{PROC}/goods-movements", json={
        "movement_type": "sloc_transfer",
        "plant_id": plant_id,
        "from_storage_location_id": bin_a,
        "to_storage_location_id": bin_b,
        "lines": [{"product_id": str(pid), "quantity": 3, "to_plant_id": plant_id}],
    })
    # Document may succeed but leave store bins unchanged (gap)
    assert xfer.status_code in (201, 422), xfer.text
    if xfer.status_code == 201:
        assert await _store_qty(db_session, store.id, pid, location_id=uuid.UUID(bin_a)) == 5
        assert await _store_qty(db_session, store.id, pid, location_id=uuid.UUID(bin_b)) == 0


# ── Reservations bulk release + global stock count ────────────────────────────

async def test_40_reservation_bulk_release(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
):
    create = await client.post(f"{ME}/stock-reservations", json={
        "order_type": "sales_order",
        "order_id": "SO-BULK-1",
        "store_id": str(store.id),
        "items": [
            {"product_id": str(tracked_product.id), "reserved_qty": "2"},
            {"product_id": str(tracked_product.id), "reserved_qty": "1"},
        ],
    })
    assert create.status_code == 201, create.text
    assert len(create.json()) == 2

    bulk = await client.delete(
        f"{ME}/stock-reservations",
        params={"order_type": "sales_order", "order_id": "SO-BULK-1"},
    )
    assert bulk.status_code == 200, bulk.text
    assert bulk.json().get("count", 0) >= 2 or "count" in bulk.json()

    listed = await client.get(f"{ME}/stock-reservations", params={
        "order_type": "sales_order", "order_id": "SO-BULK-1", "status": "active",
    })
    assert listed.status_code == 200, listed.text
    assert listed.json() == [] or all(r["status"] != "active" for r in listed.json())


async def test_41_global_stock_count_lifecycle(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, db_session: AsyncSession,
):
    pid = tracked_product.id
    await client.post(f"{INV}/stock-in", json={"product_id": str(pid), "quantity": 9})

    create = await client.post(f"{INV}/stock-counts", json={
        "count_type": "full_count",
        "description": "Global count",
        "product_ids": [str(pid)],
    })
    assert create.status_code == 201, create.text
    assert create.json()["store_id"] is None
    count_id = create.json()["id"]

    await client.post(f"{INV}/stock-counts/{count_id}/start")
    detail = await client.get(f"{INV}/stock-counts/{count_id}")
    assert detail.status_code == 200, detail.text
    line = detail.json()["lines"][0]
    assert line["system_qty"] == 9

    await client.put(
        f"{INV}/stock-counts/{count_id}/lines/{line['id']}",
        json={"counted_qty": 11},
    )
    post = await client.post(f"{INV}/stock-counts/{count_id}/post")
    assert post.status_code == 200, post.text
    assert post.json()["status"] == "completed"
    assert await _product_qty(db_session, pid) == 11


# ── Service-level sequential race (insufficient after first consume) ──────────

async def test_42_sequential_store_delta_insufficient(
    db_session: AsyncSession, test_vendor: Vendor, tracked_product: Product, store: Store,
):
    pid = tracked_product.id
    sid = store.id
    await apply_store_inventory_delta(db_session, test_vendor.id, sid, pid, None, 5)
    await db_session.commit()

    await apply_store_inventory_delta(db_session, test_vendor.id, sid, pid, None, -3)
    await db_session.commit()
    assert await _store_qty(db_session, sid, pid) == 2

    with pytest.raises(ValueError, match="Insufficient"):
        await apply_store_inventory_delta(db_session, test_vendor.id, sid, pid, None, -5)
    await db_session.rollback()
    assert await _store_qty(db_session, sid, pid) == 2
