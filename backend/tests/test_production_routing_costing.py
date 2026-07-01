"""Phase 5 (WorkCenter/ProductionOperation routing) + Phase 7 (cost roll-up) tests."""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mrp import ProductBOMItem
from app.models.store import Store, StoreInventory
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser
from app.models.user import User

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def test_vendor_user_owner(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="owner", permissions=[], is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    await db_session.refresh(vu)
    return vu


@pytest_asyncio.fixture
async def component_product(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="Raw Fabric", slug=f"raw-fabric-{uuid.uuid4().hex[:6]}",
        price=5.0, cost_price=10.0, currency="INR", status="active", product_type="physical",
        quantity=0, created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def finished_product(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="T-Shirt", slug=f"t-shirt-{uuid.uuid4().hex[:6]}",
        price=499.0, currency="INR", status="active", product_type="physical",
        quantity=0, created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def bom_setup(db_session: AsyncSession, test_vendor: Vendor, finished_product: Product, component_product: Product):
    """1 T-Shirt requires 3 x Raw Fabric."""
    db_session.add(ProductBOMItem(
        vendor_id=test_vendor.id, product_id=finished_product.id,
        component_id=component_product.id, qty_per_unit=3,
    ))
    await db_session.commit()


@pytest_asyncio.fixture
async def store_with_stock(db_session: AsyncSession, test_vendor: Vendor, component_product: Product) -> Store:
    store = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Main Warehouse", is_default=True)
    db_session.add(store)
    await db_session.flush()
    db_session.add(StoreInventory(
        id=uuid.uuid4(), store_id=store.id, vendor_id=test_vendor.id,
        product_id=component_product.id, quantity=100,
    ))
    await db_session.commit()
    await db_session.refresh(store)
    return store


async def test_confirm_reserves_materials_and_computes_planned_cost(
    client: AsyncClient, test_vendor_user_owner: VendorUser,
    finished_product: Product, bom_setup, store_with_stock: Store,
):
    resp = await client.post("/api/v1/vendors/me/production-orders", json={
        "type": "mts",
        "status": "confirmed",
        "store_id": str(store_with_stock.id),
        "items": [{"item_type": "product", "product_id": str(finished_product.id), "qty": 2, "name": "T-Shirt"}],
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["materials_reserved_at"] is not None
    assert len(body["material_requirements"]) == 1
    line = body["material_requirements"][0]
    assert float(line["required_qty"]) == 6.0  # 2 shirts x 3 fabric
    assert float(line["reserve_qty"]) == 6.0
    # planned_material_cost = required_qty(6) * cost_price(10) = 60
    assert body["planned_material_cost"] == pytest.approx(60.0)


async def test_routing_operations_compute_labor_cost(
    client: AsyncClient, test_vendor_user_owner: VendorUser,
    finished_product: Product, bom_setup, store_with_stock: Store,
):
    order_resp = await client.post("/api/v1/vendors/me/production-orders", json={
        "type": "mts",
        "status": "draft",
        "store_id": str(store_with_stock.id),
        "items": [{"item_type": "product", "product_id": str(finished_product.id), "qty": 2, "name": "T-Shirt"}],
    })
    assert order_resp.status_code == 201, order_resp.text
    order_id = order_resp.json()["id"]

    wc_resp = await client.post("/api/v1/vendors/me/work-centers", json={
        "name": "Stitching Line", "cost_per_hour": 100,
    })
    assert wc_resp.status_code == 201, wc_resp.text
    wc = wc_resp.json()
    assert wc["code"]  # auto-generated

    op_resp = await client.post(f"/api/v1/vendors/me/production-orders/{order_id}/operations", json={
        "name": "Stitching", "work_center_id": wc["id"], "planned_hours": 2,
    })
    assert op_resp.status_code == 201, op_resp.text
    op = op_resp.json()
    assert op["sequence"] == 10
    assert op["status"] == "pending"

    order_after = (await client.get(f"/api/v1/vendors/me/production-orders/{order_id}")).json()
    assert order_after["planned_labor_cost"] == pytest.approx(200.0)  # 2h x 100/h
    assert order_after["actual_labor_cost"] in (None, 0)

    upd_resp = await client.put(
        f"/api/v1/vendors/me/production-orders/{order_id}/operations/{op['id']}",
        json={"status": "in_progress", "actual_hours": 1.5},
    )
    assert upd_resp.status_code == 200, upd_resp.text
    assert upd_resp.json()["started_at"] is not None

    order_after2 = (await client.get(f"/api/v1/vendors/me/production-orders/{order_id}")).json()
    assert order_after2["actual_labor_cost"] == pytest.approx(150.0)  # 1.5h x 100/h

    # Removing the operation clears the routing back to zero cost.
    del_resp = await client.delete(f"/api/v1/vendors/me/production-orders/{order_id}/operations/{op['id']}")
    assert del_resp.status_code == 204
    order_after3 = (await client.get(f"/api/v1/vendors/me/production-orders/{order_id}")).json()
    assert order_after3["planned_labor_cost"] is None


async def test_completion_posts_stock_and_computes_actual_material_cost(
    client: AsyncClient, test_vendor_user_owner: VendorUser,
    finished_product: Product, bom_setup, store_with_stock: Store,
):
    order_resp = await client.post("/api/v1/vendors/me/production-orders", json={
        "type": "mts",
        "status": "confirmed",
        "store_id": str(store_with_stock.id),
        "items": [{"item_type": "product", "product_id": str(finished_product.id), "qty": 2, "name": "T-Shirt"}],
    })
    order_id = order_resp.json()["id"]

    complete_resp = await client.put(f"/api/v1/vendors/me/production-orders/{order_id}", json={"status": "completed"})
    assert complete_resp.status_code == 200, complete_resp.text
    body = complete_resp.json()
    assert body["inventory_posted_at"] is not None
    assert body["actual_material_cost"] == pytest.approx(60.0)
