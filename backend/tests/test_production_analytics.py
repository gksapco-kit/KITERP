"""Phase 6: production analytics endpoint."""
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
async def owner(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="owner", permissions=[], is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    return vu


@pytest_asyncio.fixture
async def component(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="Bolt", slug=f"bolt-{uuid.uuid4().hex[:6]}",
        price=1.0, cost_price=2.0, currency="INR", status="active", product_type="physical",
        quantity=0, created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    return p


@pytest_asyncio.fixture
async def finished(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="Chair", slug=f"chair-{uuid.uuid4().hex[:6]}",
        price=999.0, currency="INR", status="active", product_type="physical",
        quantity=0, created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    return p


@pytest_asyncio.fixture
async def bom(db_session: AsyncSession, test_vendor: Vendor, finished: Product, component: Product):
    db_session.add(ProductBOMItem(
        vendor_id=test_vendor.id, product_id=finished.id, component_id=component.id, qty_per_unit=4,
    ))
    await db_session.commit()


@pytest_asyncio.fixture
async def store(db_session: AsyncSession, test_vendor: Vendor, component: Product) -> Store:
    s = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Main", is_default=True)
    db_session.add(s)
    await db_session.flush()
    db_session.add(StoreInventory(
        id=uuid.uuid4(), store_id=s.id, vendor_id=test_vendor.id, product_id=component.id, quantity=1000,
    ))
    await db_session.commit()
    await db_session.refresh(s)
    return s


async def test_analytics_reports_completed_orders_and_cost(
    client: AsyncClient, owner: VendorUser, finished: Product, bom, store: Store,
):
    completed = await client.post("/api/v1/vendors/me/production-orders", json={
        "type": "mts", "status": "confirmed", "store_id": str(store.id),
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 3, "name": "Chair"}],
    })
    assert completed.status_code == 201, completed.text
    order_id = completed.json()["id"]
    complete_resp = await client.put(f"/api/v1/vendors/me/production-orders/{order_id}", json={"status": "completed"})
    assert complete_resp.status_code == 200, complete_resp.text

    draft = await client.post("/api/v1/vendors/me/production-orders", json={
        "type": "mto", "status": "draft", "store_id": str(store.id),
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 1, "name": "Chair"}],
    })
    assert draft.status_code == 201, draft.text

    resp = await client.get("/api/v1/vendors/me/production/analytics")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["totals"]["orders"] == 2
    assert data["totals"]["completed"] == 1
    assert data["totals"]["in_progress"] == 1
    # 3 chairs x 4 bolts x cost_price(2) = 24
    assert data["cost"]["actual_material"] == pytest.approx(24.0)
    assert data["cost"]["planned_material"] == pytest.approx(24.0)
    assert any(row["store_name"] == "Main" and row["orders"] == 2 for row in data["by_store"])
    assert {"status": "completed", "count": 1} in data["by_status"]
    assert {"status": "draft", "count": 1} in data["by_status"]


async def test_analytics_scopes_by_store_and_date(client: AsyncClient, owner: VendorUser, finished: Product, bom, store: Store):
    other_store_resp = await client.post("/api/v1/vendors/me/stores", json={"name": "Second Unit"})
    assert other_store_resp.status_code == 201, other_store_resp.text
    other_store_id = other_store_resp.json()["store"]["id"]

    await client.post("/api/v1/vendors/me/production-orders", json={
        "type": "mts", "status": "draft", "store_id": str(store.id),
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 1, "name": "Chair"}],
    })
    await client.post("/api/v1/vendors/me/production-orders", json={
        "type": "mts", "status": "draft", "store_id": other_store_id,
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": 1, "name": "Chair"}],
    })

    resp = await client.get("/api/v1/vendors/me/production/analytics", params={"store_id": str(store.id)})
    assert resp.status_code == 200
    assert resp.json()["totals"]["orders"] == 1

    resp_all = await client.get("/api/v1/vendors/me/production/analytics")
    assert resp_all.json()["totals"]["orders"] == 2
