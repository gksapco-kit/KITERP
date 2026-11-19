"""Inventory analytics: movement classification, shrinkage, ATP status, filter contract."""
import uuid
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryMovement
from app.models.procurement_goods import GoodsBatch
from app.models.storage_location import StorageLocation
from app.models.store import Store, StoreInventory
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/vendors/me/inventory/reports/analytics"
COST = 2.0


@pytest_asyncio.fixture
async def owner(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="owner", permissions=[], is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    return vu


@pytest_asyncio.fixture
async def store(db_session: AsyncSession, test_vendor: Vendor) -> Store:
    s = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Main", is_default=True)
    db_session.add(s)
    await db_session.commit()
    return s


async def _product(db: AsyncSession, vendor: Vendor, user: User, name: str) -> Product:
    p = Product(
        id=uuid.uuid4(), vendor_id=vendor.id, name=name, slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}",
        price=10.0, cost_price=COST, currency="INR", status="active", product_type="physical",
        quantity=0, track_inventory=True, created_by=user.id,
    )
    db.add(p)
    await db.commit()
    return p


def _move(vendor, product, mtype, qty, store=None, ref="manual") -> InventoryMovement:
    return InventoryMovement(
        id=uuid.uuid4(), vendor_id=vendor.id, product_id=product.id, movement_type=mtype,
        quantity=qty, quantity_before=0, quantity_after=max(qty, 0),
        reference_type=ref, store_id=store.id if store else None,
    )


@pytest_asyncio.fixture
async def seeded(db_session: AsyncSession, test_vendor: Vendor, test_user: User, store: Store):
    prod = await _product(db_session, test_vendor, test_user, "Bolt")
    empty = await _product(db_session, test_vendor, test_user, "Nut")  # no stock, no reservations
    db_session.add(StoreInventory(
        id=uuid.uuid4(), store_id=store.id, vendor_id=test_vendor.id, product_id=prod.id, quantity=20,
    ))
    db_session.add_all([
        _move(test_vendor, prod, "stock_in", 5, store, ref="grn"),                 # inbound 5
        _move(test_vendor, prod, "purchase_return", -2, store, ref="grn"),         # outbound 2 (negative qty)
        _move(test_vendor, prod, "adjustment", 10, None, ref="manual"),            # product-form edit -> inbound 10
        _move(test_vendor, prod, "adjustment", -1, store, ref="manual"),           # shrinkage 1
        _move(test_vendor, prod, "stock_count", 3, store, ref="stock_count"),      # surplus: NOT shrinkage
        _move(test_vendor, prod, "production_receipt", 4, store, ref="production_order"),  # inbound 4
    ])
    await db_session.commit()
    return prod, empty


async def test_movement_trend_classifies_by_sign_and_includes_product_edits(client: AsyncClient, owner, seeded):
    resp = await client.get(f"{BASE}/movement-trend")
    assert resp.status_code == 200, resp.text
    series = resp.json()["series"]
    inbound = sum(p["inbound_value"] for p in series)
    outbound = sum(p["outbound_value"] for p in series)
    # inbound units: stock_in 5 + product edit 10 + production_receipt 4 = 19 ; outbound: purchase_return 2
    assert inbound == pytest.approx(19 * COST)
    assert outbound == pytest.approx(2 * COST)


async def test_movement_trend_keeps_uncosted_products_and_fills_empty_days(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor, test_user: User, owner, seeded,
):
    nocost = await _product(db_session, test_vendor, test_user, "Washer")
    nocost.cost_price = None
    db_session.add(_move(test_vendor, nocost, "stock_in", 7, None, ref="grn"))
    await db_session.commit()

    today = date.today()
    resp = await client.get(
        f"{BASE}/movement-trend",
        params={"date_from": (today - timedelta(days=4)).isoformat(), "date_to": (today + timedelta(days=1)).isoformat()},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    # one row per day in range, even days without movements
    assert len(data["series"]) == 6
    totals = data["totals"]
    assert totals["uncosted_movements"] == 1
    assert totals["inbound_qty"] == pytest.approx(19 + 7)       # seeded inbound units + uncosted 7
    assert totals["inbound_value"] == pytest.approx(19 * COST)  # uncosted adds no value
    assert totals["movements"] == 7


async def test_overview_and_trend_agree(client: AsyncClient, owner, seeded):
    overview = (await client.get(f"{BASE}/overview")).json()
    series = (await client.get(f"{BASE}/movement-trend")).json()["series"]
    assert overview["inbound_value"]["current"] == pytest.approx(sum(p["inbound_value"] for p in series))
    assert overview["outbound_value"]["current"] == pytest.approx(sum(p["outbound_value"] for p in series))


async def test_shrinkage_counts_losses_only(client: AsyncClient, owner, seeded):
    resp = await client.get(f"{BASE}/shrinkage", params={"group_by": "movement_type"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    # Only the -1 adjustment is a loss: product edit (+10) and count surplus (+3) are excluded.
    assert data["total_units"] == 1
    assert data["total_value"] == pytest.approx(1 * COST)


async def test_shrinkage_rejects_category_group_by(client: AsyncClient, owner):
    # The shared frontend filter defaults group_by to 'category'; the UI must not forward it.
    resp = await client.get(f"{BASE}/shrinkage", params={"group_by": "category"})
    assert resp.status_code == 422


async def test_turnover_is_null_without_outbound(client: AsyncClient, owner, seeded):
    overview = (await client.get(f"{BASE}/overview")).json()
    # Only a purchase_return (not COGS) went out -> turnover is still reported from flows;
    # with no flows at all it must be null rather than 0.
    assert overview["stock_value"]["skus"] == 1
    empty = (await client.get(f"{BASE}/overview", params={"date_from": "2000-01-01", "date_to": "2000-01-02"})).json()
    assert empty["turnover_ratio"] is None
    assert empty["days_sales_of_inventory"] is None


async def test_atp_marks_untouched_products_out_of_stock(client: AsyncClient, owner, seeded):
    resp = await client.get(f"{BASE}/atp")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    by_name = {i["product_name"]: i for i in data["items"]}
    assert by_name["Nut"]["status"] == "out_of_stock"
    assert by_name["Bolt"]["status"] == "available"
    assert data["summary"]["out_of_stock"]["count"] == 1
    assert data["summary"]["fully_reserved"]["count"] == 0


async def test_expiry_risk_scopes_batches_by_storage_location(
    client: AsyncClient, db_session: AsyncSession, owner, test_vendor, test_user, store,
):
    prod = await _product(db_session, test_vendor, test_user, "Milk")
    other = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Other")
    db_session.add(other)
    await db_session.flush()
    loc_main = StorageLocation(id=uuid.uuid4(), vendor_id=test_vendor.id, store_id=store.id, name="Main bin", code="M1")
    loc_other = StorageLocation(id=uuid.uuid4(), vendor_id=test_vendor.id, store_id=other.id, name="Other bin", code="O1")
    db_session.add_all([loc_main, loc_other])
    await db_session.flush()
    soon = date.today() + timedelta(days=10)
    for num, loc, qty in (("B-MAIN", loc_main, 5), ("B-OTHER", loc_other, 7), ("B-NOLOC", None, 3)):
        db_session.add(GoodsBatch(
            id=uuid.uuid4(), vendor_id=test_vendor.id, product_id=prod.id, batch_number=num,
            expiry_date=soon, quantity_received=qty, quantity_available=qty,
            storage_location_id=loc.id if loc else None,
        ))
    await db_session.commit()

    all_units = (await client.get(f"{BASE}/expiry-risk")).json()
    assert all_units["total"] == 3

    scoped = (await client.get(f"{BASE}/expiry-risk", params={"store_id": str(store.id)})).json()
    assert [i["batch_number"] for i in scoped["items"]] == ["B-MAIN"]
    assert scoped["total_value_at_risk"] == pytest.approx(5 * COST)

    kpi = (await client.get(f"{BASE}/overview", params={"store_id": str(store.id)})).json()
    assert kpi["expiry_at_risk_90d"] == pytest.approx(5 * COST)


async def test_turnover_uses_average_of_opening_and_closing_stock(
    client: AsyncClient, db_session: AsyncSession, owner, test_vendor, test_user, store,
):
    prod = await _product(db_session, test_vendor, test_user, "Gear")
    # Today: 10 on hand (value 20). Within the period 10 were sold, so opening stock was 20 (value 40).
    db_session.add(StoreInventory(
        id=uuid.uuid4(), store_id=store.id, vendor_id=test_vendor.id, product_id=prod.id, quantity=10,
    ))
    db_session.add(_move(test_vendor, prod, "sale", -10, store, ref="order"))
    await db_session.commit()

    data = (await client.get(f"{BASE}/turnover")).json()
    row = next(i for i in data["items"] if i["cogs"] > 0)
    assert row["cogs"] == pytest.approx(10 * COST)
    assert row["inventory_value"] == pytest.approx(10 * COST)
    # opening 40, closing 20 -> average 30 -> turnover 20 / 30
    assert row["average_inventory_value"] == pytest.approx(30.0)
    assert row["turnover_ratio"] == pytest.approx(0.67, abs=0.01)

    overview = (await client.get(f"{BASE}/overview")).json()
    assert overview["turnover_ratio"] == pytest.approx(0.67, abs=0.01)


async def test_in_transit_accepts_store_filter(client: AsyncClient, owner, store):
    resp = await client.get(f"{BASE}/in-transit", params={"store_id": str(store.id)})
    assert resp.status_code == 200, resp.text
    assert resp.json()["in_transit_count"] == 0
