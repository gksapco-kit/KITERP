"""
Extended inventory E2E scenarios — GRN, purchase returns, plants/locations,
batch stock-in, material valuation, reservations, variants, put-store-inventory.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryMovement
from app.models.plant import Plant
from app.models.procurement import Supplier, PurchaseOrder, PurchaseOrderItem
from app.models.procurement_goods import GoodsBatch
from app.models.procurement_sequence import DocumentSequence
from app.models.store import Store, StoreInventory
from app.models.storage_location import StorageLocation
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product, ProductVariant
from app.models.vendor_user import VendorUser

pytestmark = pytest.mark.asyncio

INV = "/api/v1/vendors/me/inventory"
PROC = "/api/v1/vendors/me/procurement"
PLANTS = "/api/v1/vendors/me/plants"
SLOCS = "/api/v1/vendors/me/storage-locations"
STORES = "/api/v1/vendors/me/stores"
ME = "/api/v1/vendors/me"


async def _product_qty(db: AsyncSession, product_id) -> int:
    """Read quantity without expiring the shared test session (auth objects stay usable)."""
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
    # Pre-seed doc sequences so next_doc_number raw INSERT is not required on SQLite
    for prefix, width in (("GRN", 6), ("GRNR", 5), ("PRET", 6)):
        db_session.add(DocumentSequence(
            id=uuid.uuid4(),
            vendor_id=test_vendor.id,
            prefix=prefix,
            last_value=0,
            width=width,
        ))
    await db_session.commit()
    return vu


@pytest_asyncio.fixture
async def tracked_product(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Ext Widget",
        slug=f"ext-widget-{uuid.uuid4().hex[:6]}",
        sku=f"EXT-{uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        cost_price=Decimal("40.00"),
        currency="INR",
        status="active",
        product_type="physical",
        track_inventory=True,
        quantity=0,
        low_stock_threshold=5,
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
        name="Main Store",
        code="MAIN",
        is_default=True,
        unit_type="business_unit",
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest_asyncio.fixture
async def po_stack(
    db_session: AsyncSession,
    test_vendor: Vendor,
    tracked_product: Product,
):
    supplier = Supplier(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Acme Supplier",
        party_type="supplier",
        is_active=True,
    )
    db_session.add(supplier)
    await db_session.flush()

    po = PurchaseOrder(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        supplier_id=supplier.id,
        po_number=f"PO-{uuid.uuid4().hex[:6]}",
        status="sent",
        subtotal=Decimal("200"),
        total=Decimal("200"),
        currency="INR",
        audit_log=[],
    )
    db_session.add(po)
    await db_session.flush()

    item = PurchaseOrderItem(
        id=uuid.uuid4(),
        purchase_order_id=po.id,
        product_id=tracked_product.id,
        quantity_ordered=Decimal("20"),
        quantity_received=Decimal("0"),
        unit_cost=Decimal("10"),
        total_cost=Decimal("200"),
        unit_of_measure="piece",
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(po)
    await db_session.refresh(item)
    await db_session.refresh(supplier)
    return {"supplier": supplier, "po": po, "item": item, "product": tracked_product}


# ── Plants & storage locations ────────────────────────────────────────────────

async def test_19_plants_crud(client: AsyncClient, owner: VendorUser, store: Store):
    create = await client.post(PLANTS, json={
        "store_id": str(store.id),
        "name": "Main Plant",
        "code": "P1",
        "sort_order": 0,
    })
    assert create.status_code == 201, create.text
    plant_id = create.json()["id"]
    assert create.json()["code"] == "P1"

    listed = await client.get(PLANTS, params={"store_id": str(store.id)})
    assert listed.status_code == 200, listed.text
    assert any(p["id"] == plant_id for p in listed.json()["plants"])

    upd = await client.put(f"{PLANTS}/{plant_id}", json={"name": "Plant Renamed"})
    assert upd.status_code == 200, upd.text
    assert upd.json()["name"] == "Plant Renamed"

    # Duplicate code rejected
    dup = await client.post(PLANTS, json={
        "store_id": str(store.id), "name": "Other", "code": "P1",
    })
    assert dup.status_code == 400, dup.text


async def test_20_storage_locations_crud(client: AsyncClient, owner: VendorUser, store: Store):
    plant = await client.post(PLANTS, json={
        "store_id": str(store.id), "name": "Plant", "code": "PX",
    })
    plant_id = plant.json()["id"]

    create = await client.post(SLOCS, json={
        "store_id": str(store.id),
        "plant_id": plant_id,
        "name": "Rack 1",
        "code": "R1",
        "stock_type": "unrestricted",
    })
    assert create.status_code == 201, create.text
    loc_id = create.json()["id"]
    assert create.json()["stock_type"] == "unrestricted"

    bad_type = await client.post(SLOCS, json={
        "store_id": str(store.id),
        "plant_id": plant_id,
        "name": "Bad",
        "code": "BAD",
        "stock_type": "not_a_type",
    })
    assert bad_type.status_code == 400, bad_type.text

    listed = await client.get(SLOCS, params={"store_id": str(store.id)})
    assert listed.status_code == 200, listed.text
    assert any(l["id"] == loc_id for l in listed.json()["locations"])

    upd = await client.put(f"{SLOCS}/{loc_id}", json={"name": "Rack 1A", "stock_type": "quarantine"})
    assert upd.status_code == 200, upd.text
    assert upd.json()["stock_type"] == "quarantine"


# ── Stock-in at bin + history filter ──────────────────────────────────────────

async def test_21_stock_in_with_storage_location(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store, db_session: AsyncSession,
):
    plant = await client.post(PLANTS, json={"store_id": str(store.id), "name": "P", "code": "PL"})
    sloc = await client.post(SLOCS, json={
        "store_id": str(store.id),
        "plant_id": plant.json()["id"],
        "name": "Bin A",
        "code": "BA",
        "stock_type": "unrestricted",
    })
    loc_id = sloc.json()["id"]
    pid = tracked_product.id

    r = await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid),
        "quantity": 7,
        "store_id": str(store.id),
        "storage_location_id": loc_id,
        "reason": "bin receive",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["store_id"] == str(store.id)
    assert body["storage_location_id"] == loc_id

    assert await _store_qty(db_session, store.id, pid, location_id=uuid.UUID(loc_id)) == 7

    hist = await client.get(f"{INV}/history", params={
        "product_id": str(pid),
        "store_id": str(store.id),
        "storage_location_id": loc_id,
    })
    assert hist.status_code == 200, hist.text
    assert hist.json()["total"] >= 1


# ── Batch-managed stock-in + write-off batch + expiry from batch ─────────────

async def test_22_batch_managed_stock_in_and_write_off(
    client: AsyncClient, owner: VendorUser, store: Store,
    db_session: AsyncSession, test_vendor: Vendor, test_user: User,
):
    product = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Batch Drug",
        slug=f"batch-{uuid.uuid4().hex[:6]}",
        sku=f"BT-{uuid.uuid4().hex[:6]}",
        price=Decimal("50"),
        cost_price=Decimal("20"),
        currency="INR",
        status="active",
        product_type="physical",
        track_inventory=True,
        batch_managed=True,
        qc_required_on_receipt=False,
        quantity=0,
        created_by=test_user.id,
    )
    db_session.add(product)
    await db_session.commit()
    pid = product.id
    sid = store.id

    plant = await client.post(PLANTS, json={"store_id": str(sid), "name": "Pharma", "code": "PH"})
    sloc = await client.post(SLOCS, json={
        "store_id": str(sid),
        "plant_id": plant.json()["id"],
        "name": "Cold",
        "code": "CL",
        "stock_type": "unrestricted",
    })
    loc_id = sloc.json()["id"]
    exp = (date.today() + timedelta(days=5)).isoformat()

    r = await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid),
        "quantity": 12,
        "store_id": str(sid),
        "storage_location_id": loc_id,
        "batch_number": "LOT-E2E-1",
        "manufacture_date": "2026-01-01",
        "expiration_date": exp,
    })
    assert r.status_code == 201, r.text

    batch_row = (
        await db_session.execute(
            select(
                GoodsBatch.id,
                GoodsBatch.quantity_available,
                GoodsBatch.is_active,
            ).where(
                GoodsBatch.product_id == pid,
                GoodsBatch.batch_number == "LOT-E2E-1",
            )
        )
    ).one()
    batch_id = batch_row.id
    assert float(batch_row.quantity_available) == 12

    alerts = await client.get(f"{INV}/expiry-alerts", params={
        "days_ahead": 30, "include_batches": True, "include_products": True,
    })
    assert alerts.status_code == 200, alerts.text
    assert any(
        i.get("batch_number") == "LOT-E2E-1" or i.get("batch_id") == str(batch_id)
        for i in alerts.json().get("items", [])
    )

    wo = await client.post(f"{INV}/write-off", json={
        "product_id": str(pid),
        "quantity": 12,
        "batch_id": str(batch_id),
        "store_id": str(sid),
        "storage_location_id": loc_id,
        "reason": "Expired lot",
    })
    assert wo.status_code == 201, wo.text
    assert wo.json()["quantity_written_off"] == 12

    after = (
        await db_session.execute(
            select(GoodsBatch.quantity_available, GoodsBatch.is_active).where(GoodsBatch.id == batch_id)
        )
    ).one()
    assert float(after.quantity_available) == 0
    assert after.is_active is False


# ── Variant API stock-in/out ──────────────────────────────────────────────────

async def test_23_variant_stock_in_out_api(
    client: AsyncClient, owner: VendorUser, store: Store,
    db_session: AsyncSession, test_vendor: Vendor, test_user: User,
):
    product = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Variant Parent",
        slug=f"var-p-{uuid.uuid4().hex[:6]}",
        price=Decimal("100"),
        currency="INR",
        status="active",
        product_type="physical",
        track_inventory=True,
        quantity=0,
        created_by=test_user.id,
    )
    db_session.add(product)
    await db_session.flush()
    variant = ProductVariant(
        id=uuid.uuid4(),
        product_id=product.id,
        name="Red / M",
        sku=f"VR-{uuid.uuid4().hex[:6]}",
        price=Decimal("100"),
        quantity=0,
        track_inventory=True,
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()
    pid, vid = product.id, variant.id

    inn = await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid),
        "variant_id": str(vid),
        "quantity": 10,
        "store_id": str(store.id),
    })
    assert inn.status_code == 201, inn.text
    assert inn.json()["variant_id"] == str(vid)

    out = await client.post(f"{INV}/stock-out", json={
        "product_id": str(pid),
        "variant_id": str(vid),
        "quantity": 3,
        "store_id": str(store.id),
    })
    assert out.status_code == 201, out.text

    assert await _store_qty(db_session, store.id, pid, variant_id=vid) == 7


# ── PUT store inventory ───────────────────────────────────────────────────────

async def test_24_put_store_inventory(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store, db_session: AsyncSession,
):
    pid = tracked_product.id
    r = await client.put(
        f"{STORES}/{store.id}/inventory/{pid}",
        json={"quantity": 25, "low_stock_threshold": 3},
    )
    assert r.status_code == 200, r.text
    assert r.json()["quantity"] == 25

    assert await _store_qty(db_session, store.id, pid) == 25
    assert await _product_qty(db_session, pid) == 25

    # PUT does not write InventoryMovement with a dedicated reference
    moves = (
        await db_session.execute(
            select(InventoryMovement.id).where(
                InventoryMovement.product_id == pid,
                InventoryMovement.reference_type == "store_put",
            )
        )
    ).scalars().all()
    assert len(moves) == 0


# ── Material valuation ────────────────────────────────────────────────────────

async def test_25_material_valuation_crud(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
):
    plant = await client.post(PLANTS, json={
        "store_id": str(store.id), "name": "Val Plant", "code": "VP",
    })
    plant_id = plant.json()["id"]

    create = await client.post(f"{PROC}/material-valuation", json={
        "product_id": str(tracked_product.id),
        "plant_id": plant_id,
        "valuation_method": "moving_average",
        "currency": "INR",
        "standard_price": 40,
        "moving_avg_price": 42.5,
    })
    assert create.status_code == 201, create.text
    val_id = create.json()["id"]

    listed = await client.get(f"{PROC}/material-valuation", params={
        "product_id": str(tracked_product.id),
    })
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] >= 1

    upd = await client.put(f"{PROC}/material-valuation/{val_id}", json={
        "valuation_method": "standard_price",
        "standard_price": 50,
    })
    assert upd.status_code == 200, upd.text
    assert upd.json()["valuation_method"] == "standard_price"
    assert float(upd.json()["standard_price"]) == 50


# ── Reservations ──────────────────────────────────────────────────────────────

async def test_26_stock_reservations_create_list_release(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
):
    create = await client.post(f"{ME}/stock-reservations", json={
        "order_type": "production_order",
        "order_id": "po-test-1",
        "store_id": str(store.id),
        "items": [{"product_id": str(tracked_product.id), "reserved_qty": "3"}],
    })
    assert create.status_code == 201, create.text
    items = create.json()
    assert isinstance(items, list) and len(items) == 1
    resv_id = items[0]["id"]
    assert items[0]["status"] == "active"

    listed = await client.get(f"{ME}/stock-reservations", params={
        "order_type": "production_order",
        "order_id": "po-test-1",
        "status": "active",
    })
    assert listed.status_code == 200, listed.text
    assert any(r["id"] == resv_id for r in listed.json())

    empty = await client.post(f"{ME}/stock-reservations", json={
        "order_type": "production_order",
        "order_id": "po-empty",
        "items": [],
    })
    assert empty.status_code == 400, empty.text

    release = await client.delete(f"{ME}/stock-reservations/{resv_id}")
    assert release.status_code == 200, release.text
    assert release.json()["message"] == "Reservation released"


# ── GRN no-QC → reverse ──────────────────────────────────────────────────────

async def test_27_grn_post_and_reverse(
    client: AsyncClient, owner: VendorUser, store: Store, po_stack, db_session: AsyncSession,
):
    po, item, product = po_stack["po"], po_stack["item"], po_stack["product"]
    pid = product.id

    create = await client.post(f"{PROC}/grns", json={
        "purchase_order_id": str(po.id),
        "requires_qc": False,
        "notes": "e2e grn",
        "lines": [{
            "po_item_id": str(item.id),
            "product_id": str(pid),
            "received_qty": 10,
            "unit_of_measure": "piece",
            "unit_price": 10,
        }],
    })
    assert create.status_code == 201, create.text
    grn = create.json()
    assert grn["status"] == "posted"
    assert grn["grn_number"].startswith("GRN-")
    assert grn["total_received_qty"] == 10
    line_id = grn["lines"][0]["id"]
    assert grn["lines"][0]["qc_status"] == "not_required"

    assert await _product_qty(db_session, pid) == 10

    moves = (
        await db_session.execute(
            select(InventoryMovement.movement_type, InventoryMovement.quantity).where(
                InventoryMovement.product_id == pid,
                InventoryMovement.reference_type == "grn",
            )
        )
    ).all()
    assert any(m.movement_type == "purchase" and m.quantity == 10 for m in moves)

    rev = await client.post(f"{PROC}/grns/{grn['id']}/reverse", json={
        "reversal_type": "full",
        "reversal_date": date.today().isoformat(),
        "reason": "wrong qty",
        "lines": [{
            "grn_line_id": line_id,
            "reversed_qty": 10,
            "reason": "full reverse",
        }],
    })
    assert rev.status_code == 201, rev.text
    assert rev.json()["status"] == "posted"
    assert rev.json()["reversal_number"].startswith("GRNR-")

    detail = await client.get(f"{PROC}/grns/{grn['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["status"] == "reversed"

    assert await _product_qty(db_session, pid) == 0


async def test_28_grn_qc_path_posts_accepted_only(
    client: AsyncClient, owner: VendorUser, store: Store, po_stack, db_session: AsyncSession,
):
    po, item, product = po_stack["po"], po_stack["item"], po_stack["product"]
    pid = product.id

    create = await client.post(f"{PROC}/grns", json={
        "purchase_order_id": str(po.id),
        "requires_qc": True,
        "lines": [{
            "po_item_id": str(item.id),
            "product_id": str(pid),
            "received_qty": 10,
            "unit_of_measure": "piece",
            "unit_price": 10,
        }],
    })
    assert create.status_code == 201, create.text
    assert create.json()["status"] == "qc_pending"
    grn_id = create.json()["id"]
    line_id = create.json()["lines"][0]["id"]

    assert await _product_qty(db_session, pid) == 0  # no inventory yet

    qc = await client.post(f"{PROC}/grns/{grn_id}/qc/{line_id}", json={
        "result": "passed",
        "accepted_qty": 8,
        "rejected_qty": 2,
    })
    assert qc.status_code == 200, qc.text

    close = await client.post(f"{PROC}/grns/{grn_id}/close-qc")
    assert close.status_code == 200, close.text
    assert close.json()["status"] == "qc_done"

    assert await _product_qty(db_session, pid) == 8


async def test_29_grn_untracked_product_skips_inventory(
    client: AsyncClient, owner: VendorUser, store: Store,
    db_session: AsyncSession, test_vendor: Vendor, test_user: User,
):
    product = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Service Item",
        slug=f"svc-{uuid.uuid4().hex[:6]}",
        price=Decimal("10"),
        currency="INR",
        status="active",
        product_type="service",
        track_inventory=False,
        quantity=0,
        created_by=test_user.id,
    )
    db_session.add(product)
    supplier = Supplier(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="Svc Sup", party_type="supplier", is_active=True,
    )
    db_session.add(supplier)
    await db_session.flush()
    po = PurchaseOrder(
        id=uuid.uuid4(), vendor_id=test_vendor.id, supplier_id=supplier.id,
        po_number=f"PO-U-{uuid.uuid4().hex[:5]}", status="sent",
        subtotal=10, total=10, currency="INR", audit_log=[],
    )
    db_session.add(po)
    await db_session.flush()
    item = PurchaseOrderItem(
        id=uuid.uuid4(), purchase_order_id=po.id, product_id=product.id,
        quantity_ordered=Decimal("5"), quantity_received=Decimal("0"),
        unit_cost=Decimal("2"), total_cost=Decimal("10"), unit_of_measure="piece",
    )
    db_session.add(item)
    await db_session.commit()

    create = await client.post(f"{PROC}/grns", json={
        "purchase_order_id": str(po.id),
        "requires_qc": False,
        "lines": [{
            "po_item_id": str(item.id),
            "product_id": str(product.id),
            "received_qty": 5,
            "unit_of_measure": "piece",
        }],
    })
    assert create.status_code == 201, create.text

    assert await _product_qty(db_session, product.id) == 0
    moves = (
        await db_session.execute(
            select(InventoryMovement.id).where(InventoryMovement.product_id == product.id)
        )
    ).scalars().all()
    assert len(moves) == 0


# ── Purchase return → dispatch deducts stock ──────────────────────────────────

async def test_30_purchase_return_dispatch_deducts_stock(
    client: AsyncClient, owner: VendorUser, store: Store, po_stack, db_session: AsyncSession,
):
    po, item, product = po_stack["po"], po_stack["item"], po_stack["product"]
    pid = product.id

    # Seed stock first
    await client.post(f"{INV}/stock-in", json={
        "product_id": str(pid), "quantity": 15, "store_id": str(store.id),
    })

    create = await client.post(f"{PROC}/purchase-returns", json={
        "purchase_order_id": str(po.id),
        "return_date": date.today().isoformat(),
        "return_reason": "quality_rejection",
        "currency": "INR",
        "lines": [{
            "po_item_id": str(item.id),
            "product_id": str(pid),
            "line_number": 1,
            "return_qty": "5",
            "unit_price": "10",
            "unit_of_measure": "piece",
        }],
    })
    assert create.status_code == 201, create.text
    assert create.json()["status"] == "draft"
    assert create.json()["return_number"].startswith("PRET-")
    ret_id = create.json()["id"]

    approve = await client.post(f"{PROC}/purchase-returns/{ret_id}/approve")
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] == "approved"

    # Stock unchanged until dispatch
    qty_before = await _product_qty(db_session, pid)

    dispatch = await client.post(f"{PROC}/purchase-returns/{ret_id}/dispatch", json={
        "dispatched_via": "courier",
        "dispatch_date": date.today().isoformat(),
        "tracking_number": "TRK1",
    })
    assert dispatch.status_code == 200, dispatch.text
    assert dispatch.json()["status"] == "goods_dispatched"

    qty_after = await _product_qty(db_session, pid)
    assert qty_after == qty_before - 5

    moves = (
        await db_session.execute(
            select(InventoryMovement.quantity).where(
                InventoryMovement.product_id == pid,
                InventoryMovement.reference_type == "purchase_return",
            )
        )
    ).scalars().all()
    assert any(q == -5 for q in moves)


async def test_31_grn_reverse_over_max_rejected(
    client: AsyncClient, owner: VendorUser, store: Store, po_stack,
):
    po, item, product = po_stack["po"], po_stack["item"], po_stack["product"]
    create = await client.post(f"{PROC}/grns", json={
        "purchase_order_id": str(po.id),
        "requires_qc": False,
        "lines": [{
            "po_item_id": str(item.id),
            "product_id": str(product.id),
            "received_qty": 5,
            "unit_of_measure": "piece",
        }],
    })
    assert create.status_code == 201, create.text
    grn_id = create.json()["id"]
    line_id = create.json()["lines"][0]["id"]

    rev = await client.post(f"{PROC}/grns/{grn_id}/reverse", json={
        "reversal_type": "partial",
        "reversal_date": date.today().isoformat(),
        "lines": [{"grn_line_id": line_id, "reversed_qty": 99}],
    })
    assert rev.status_code == 400, rev.text
