"""
Tests for the named multi-menu system (restaurant_menu / restaurant_menu_category /
restaurant_menu_zone_link) — CRUD APIs plus the guest zone-link resolution endpoint.
"""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor import Vendor
from app.models.store import Store
from app.models.restaurant import Restaurant, RestaurantZone, RestaurantTable
from app.models.vendor_product import Product
from app.models.vendor_category import VendorCategory

MENUS_BASE = "/api/v1/vendors/me/restaurant/menus"


@pytest_asyncio.fixture
async def test_store(db_session: AsyncSession, test_vendor: Vendor) -> Store:
    store = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Main BU", unit_type="business_unit")
    db_session.add(store)
    await db_session.commit()
    await db_session.refresh(store)
    return store


@pytest_asyncio.fixture
async def test_restaurant(db_session: AsyncSession, test_vendor: Vendor, test_store: Store) -> Restaurant:
    restaurant = Restaurant(
        id=uuid.uuid4(), vendor_id=test_vendor.id, store_id=test_store.id,
        name="Test Diner", is_active=True, is_default=True,
    )
    db_session.add(restaurant)
    await db_session.commit()
    await db_session.refresh(restaurant)
    return restaurant


@pytest_asyncio.fixture
async def test_zone(db_session: AsyncSession, test_vendor: Vendor, test_restaurant: Restaurant) -> RestaurantZone:
    zone = RestaurantZone(
        id=uuid.uuid4(), vendor_id=test_vendor.id, restaurant_id=test_restaurant.id,
        name="Patio", sort_order=0,
    )
    db_session.add(zone)
    await db_session.commit()
    await db_session.refresh(zone)
    return zone


def _make_product(vendor_id, *, name, category="Food", status="active", price=100.0):
    return Product(
        id=uuid.uuid4(), vendor_id=vendor_id, name=name,
        slug=name.lower().replace(" ", "-") + f"-{uuid.uuid4().hex[:4]}",
        price=price, currency="INR", status=status, category=category, is_visible=True,
        stock_status="in_stock",
    )


# ── Menu CRUD ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_menu_requires_restaurant(client: AsyncClient, test_vendor: Vendor):
    resp = await client.post(MENUS_BASE, json={"restaurant_id": str(uuid.uuid4()), "name": "Lunch"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_and_list_menu(client: AsyncClient, test_restaurant: Restaurant):
    resp = await client.post(MENUS_BASE, json={"restaurant_id": str(test_restaurant.id), "name": "Lunch menu"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Lunch menu"
    assert body["categories"] == []
    assert body["zone_links"] == []

    listed = await client.get(MENUS_BASE, params={"restaurant_id": str(test_restaurant.id)})
    assert listed.status_code == 200
    names = {m["name"] for m in listed.json()["items"]}
    assert "Lunch menu" in names


@pytest.mark.asyncio
async def test_create_menu_with_zones(client: AsyncClient, test_restaurant: Restaurant, test_zone: RestaurantZone):
    resp = await client.post(MENUS_BASE, json={
        "restaurant_id": str(test_restaurant.id), "name": "Dinner", "zone_ids": [str(test_zone.id)],
    })
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["zone_links"]) == 1
    assert body["zone_links"][0]["zone_id"] == str(test_zone.id)
    assert body["zone_links"][0]["zone_name"] == "Patio"
    assert body["zone_links"][0]["link_token"]


@pytest.mark.asyncio
async def test_update_and_delete_menu(client: AsyncClient, test_restaurant: Restaurant):
    created = await client.post(MENUS_BASE, json={"restaurant_id": str(test_restaurant.id), "name": "Brunch"})
    menu_id = created.json()["id"]

    updated = await client.put(f"{MENUS_BASE}/{menu_id}", json={"name": "Weekend Brunch", "is_active": False})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Weekend Brunch"
    assert updated.json()["is_active"] is False

    deleted = await client.delete(f"{MENUS_BASE}/{menu_id}")
    assert deleted.status_code == 204

    fetched = await client.get(f"{MENUS_BASE}/{menu_id}")
    assert fetched.status_code == 404


# ── Categories (tree) ───────────────────────────────────────────────────

@pytest_asyncio.fixture
async def menu_id(client: AsyncClient, test_restaurant: Restaurant) -> str:
    resp = await client.post(MENUS_BASE, json={"restaurant_id": str(test_restaurant.id), "name": "Main menu"})
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_root_and_sub_category(client: AsyncClient, menu_id: str):
    root = await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Food"})
    assert root.status_code == 201
    root_body = root.json()
    assert root_body["parent_id"] is None
    assert root_body["mode"] == "all_active"

    sub = await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Starters", "parent_id": root_body["id"]})
    assert sub.status_code == 201
    assert sub.json()["parent_id"] == root_body["id"]

    menu = await client.get(f"{MENUS_BASE}/{menu_id}")
    cats = menu.json()["categories"]
    assert len(cats) == 2


@pytest.mark.asyncio
async def test_duplicate_category_name_rejected(client: AsyncClient, menu_id: str):
    await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Drinks"})
    dup = await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Drinks"})
    assert dup.status_code == 400


@pytest.mark.asyncio
async def test_update_category_mode_curated(client: AsyncClient, menu_id: str, db_session: AsyncSession, test_vendor: Vendor):
    p = _make_product(test_vendor.id, name="Cola")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    cat = await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Drinks"})
    cat_id = cat.json()["id"]

    updated = await client.put(
        f"{MENUS_BASE}/{menu_id}/categories/{cat_id}",
        json={"mode": "curated", "product_ids": [str(p.id)]},
    )
    assert updated.status_code == 200
    assert updated.json()["mode"] == "curated"
    assert str(p.id) in updated.json()["product_ids"]


@pytest.mark.asyncio
async def test_move_category_reorders_siblings(client: AsyncClient, menu_id: str):
    a = (await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Alpha"})).json()
    b = (await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Beta"})).json()

    menu_before = (await client.get(f"{MENUS_BASE}/{menu_id}")).json()
    order_before = [c["id"] for c in sorted(menu_before["categories"], key=lambda c: c["sort_order"])]
    assert order_before == [a["id"], b["id"]]

    moved = await client.post(f"{MENUS_BASE}/{menu_id}/categories/{b['id']}/move", json={"direction": "up"})
    assert moved.status_code == 200
    order_after = [c["id"] for c in sorted(moved.json()["categories"], key=lambda c: c["sort_order"])]
    assert order_after == [b["id"], a["id"]]


@pytest.mark.asyncio
async def test_delete_category(client: AsyncClient, menu_id: str):
    cat = (await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Temp"})).json()
    deleted = await client.delete(f"{MENUS_BASE}/{menu_id}/categories/{cat['id']}")
    assert deleted.status_code == 204
    menu = (await client.get(f"{MENUS_BASE}/{menu_id}")).json()
    assert menu["categories"] == []


# ── Zone links ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_menu_zones(client: AsyncClient, menu_id: str, test_zone: RestaurantZone):
    resp = await client.put(f"{MENUS_BASE}/{menu_id}/zones", json={"zone_ids": [str(test_zone.id)]})
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["zone_id"] == str(test_zone.id)

    cleared = await client.put(f"{MENUS_BASE}/{menu_id}/zones", json={"zone_ids": []})
    assert cleared.status_code == 200
    assert cleared.json()["items"] == []


# ── Public guest resolution ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_guest_menu_by_zone_link(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor,
    menu_id: str, test_zone: RestaurantZone,
):
    p = _make_product(test_vendor.id, name="Iced Tea", category="Drinks")
    db_session.add(p)
    await db_session.commit()

    cat = (await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "All items"})).json()
    assert cat["mode"] == "all_active"

    links = await client.put(f"{MENUS_BASE}/{menu_id}/zones", json={"zone_ids": [str(test_zone.id)]})
    token = links.json()["items"][0]["link_token"]

    guest = await client.get(f"/api/v1/public/restaurant/{test_vendor.slug}/menu/{token}")
    assert guest.status_code == 200
    body = guest.json()
    assert body["zone"]["name"] == "Patio"
    assert body["menu"]["name"] == "Main menu"
    items = body["menu"]["categories"][0]["items"]
    names = {i["name"] for i in items}
    assert "Iced Tea" in names


@pytest.mark.asyncio
async def test_guest_menu_by_categories_mode(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor,
    menu_id: str, test_zone: RestaurantZone,
):
    vcat = VendorCategory(
        id=uuid.uuid4(), vendor_id=test_vendor.id, name="Beverages", slug="beverages",
        applies_to="product",
    )
    db_session.add(vcat)
    await db_session.commit()
    await db_session.refresh(vcat)

    matching = _make_product(test_vendor.id, name="Lemonade", category="beverages")
    other = _make_product(test_vendor.id, name="Burger", category="mains")
    db_session.add_all([matching, other])
    await db_session.commit()

    cat = (await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Drinks"})).json()
    await client.put(
        f"{MENUS_BASE}/{menu_id}/categories/{cat['id']}",
        json={"mode": "by_categories", "vendor_category_ids": [str(vcat.id)]},
    )

    links = await client.put(f"{MENUS_BASE}/{menu_id}/zones", json={"zone_ids": [str(test_zone.id)]})
    token = links.json()["items"][0]["link_token"]

    guest = await client.get(f"/api/v1/public/restaurant/{test_vendor.slug}/menu/{token}")
    assert guest.status_code == 200
    items = guest.json()["menu"]["categories"][0]["items"]
    names = {i["name"] for i in items}
    assert "Lemonade" in names
    assert "Burger" not in names


@pytest.mark.asyncio
async def test_guest_menu_invalid_token_404(client: AsyncClient, test_vendor: Vendor):
    resp = await client.get(f"/api/v1/public/restaurant/{test_vendor.slug}/menu/does-not-exist")
    assert resp.status_code == 404


# ── Table QR uses zone-linked named menu ──────────────────────────────────

@pytest.mark.asyncio
async def test_table_qr_uses_zone_linked_menu(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor,
    test_restaurant: Restaurant, test_zone: RestaurantZone, menu_id: str,
):
    zone_product = _make_product(test_vendor.id, name="Zone Menu Burger", category="Mains")
    legacy_product = _make_product(test_vendor.id, name="Legacy Only Pizza", category="Mains")
    db_session.add_all([zone_product, legacy_product])
    await db_session.commit()

    cat = (await client.post(f"{MENUS_BASE}/{menu_id}/categories", json={"name": "Food"})).json()
    await client.put(
        f"{MENUS_BASE}/{menu_id}/categories/{cat['id']}",
        json={"mode": "curated", "product_ids": [str(zone_product.id)]},
    )
    await client.put(f"{MENUS_BASE}/{menu_id}/zones", json={"zone_ids": [str(test_zone.id)]})

    table = RestaurantTable(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        restaurant_id=test_restaurant.id,
        zone_id=test_zone.id,
        label="T9",
        capacity=4,
        qr_token=f"qr-{uuid.uuid4().hex[:12]}",
    )
    db_session.add(table)
    await db_session.commit()
    await db_session.refresh(table)

    resp = await client.get(f"/api/v1/public/restaurant/{test_vendor.slug}/table/{table.qr_token}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["table"]["zone_name"] == "Patio"

    item_names = set()
    for section in body["menu"]:
        for item in section.get("items", []):
            item_names.add(item["name"])
        for sub in section.get("subcategories", []):
            for item in sub.get("items", []):
                item_names.add(item["name"])

    assert "Zone Menu Burger" in item_names
    assert "Legacy Only Pizza" not in item_names


@pytest.mark.asyncio
async def test_table_qr_falls_back_to_legacy_without_zone_menu(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor,
    test_restaurant: Restaurant, test_zone: RestaurantZone,
):
    legacy_product = _make_product(test_vendor.id, name="Legacy Fallback Pasta", category="Pasta")
    db_session.add(legacy_product)
    await db_session.commit()

    test_vendor.settings = {
        "restaurant_menu": {
            "mode": "curated",
            "product_ids": [str(legacy_product.id)],
        },
    }
    await db_session.commit()

    table = RestaurantTable(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        restaurant_id=test_restaurant.id,
        zone_id=test_zone.id,
        label="T10",
        capacity=2,
        qr_token=f"qr-{uuid.uuid4().hex[:12]}",
    )
    db_session.add(table)
    await db_session.commit()
    await db_session.refresh(table)

    resp = await client.get(f"/api/v1/public/restaurant/{test_vendor.slug}/table/{table.qr_token}")
    assert resp.status_code == 200
    body = resp.json()

    item_names = set()
    for section in body["menu"]:
        for item in section.get("items", []):
            item_names.add(item["name"])
        for sub in section.get("subcategories", []):
            for item in sub.get("items", []):
                item_names.add(item["name"])

    assert "Legacy Fallback Pasta" in item_names
