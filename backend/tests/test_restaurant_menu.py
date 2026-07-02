"""
Tests for the restaurant dine-in menu subsystem.

Covers:
- load_dine_in_products utility (all_active / curated / is_visible / stock_status)
- GET /api/v1/vendors/me/restaurant/menu
- PUT /api/v1/vendors/me/restaurant/menu
- GET /public/restaurant/{slug}/table/preview  (public QR endpoint)
"""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor import Vendor
from app.models.vendor_product import Product, ProductImage
from app.utils.restaurant_menu import (
    load_dine_in_products,
    load_dine_in_products_with_meta,
    parse_menu_settings,
    menu_settings_payload,
)

MENU_BASE = "/api/v1/vendors/me/restaurant/menu"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_product(vendor_id, *, name, category="Food", status="active",
                  is_visible=True, stock_status="in_stock", allow_backorders=False, price=100.0):
    return Product(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        name=name,
        slug=name.lower().replace(" ", "-") + f"-{uuid.uuid4().hex[:4]}",
        price=price,
        currency="INR",
        status=status,
        category=category,
        is_visible=is_visible,
        stock_status=stock_status,
        allow_backorders=allow_backorders,
    )


# ── Unit tests for parse_menu_settings ────────────────────────────────────────

def test_parse_defaults_to_all_active():
    mode, ids = parse_menu_settings(None)
    assert mode == "all_active"
    assert ids == []


def test_parse_curated_mode():
    uid = str(uuid.uuid4())
    settings = {"restaurant_menu": {"mode": "curated", "product_ids": [uid]}}
    mode, ids = parse_menu_settings(settings)
    assert mode == "curated"
    assert uid in ids


def test_parse_invalid_mode_falls_back():
    settings = {"restaurant_menu": {"mode": "unknown_mode"}}
    mode, _ = parse_menu_settings(settings)
    assert mode == "all_active"


def test_menu_settings_payload_roundtrip():
    uid = str(uuid.uuid4())
    payload = menu_settings_payload("curated", [uid])
    assert payload["restaurant_menu"]["mode"] == "curated"
    assert uid in payload["restaurant_menu"]["product_ids"]


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def products(db_session: AsyncSession, test_vendor: Vendor):
    """A set of products covering all filter scenarios."""
    items = [
        _make_product(test_vendor.id, name="Visible Active", category="Starters"),
        _make_product(test_vendor.id, name="Hidden Product", is_visible=False),
        _make_product(test_vendor.id, name="Draft Product", status="draft"),
        _make_product(test_vendor.id, name="Out of Stock", stock_status="out_of_stock"),
        _make_product(test_vendor.id, name="Backorder OK", stock_status="out_of_stock", allow_backorders=True),
        _make_product(test_vendor.id, name="Low Stock", stock_status="low_stock"),
        _make_product(test_vendor.id, name="Main Course", category="Mains"),
    ]
    for p in items:
        db_session.add(p)
    await db_session.commit()
    for p in items:
        await db_session.refresh(p)
    return items


# ── load_dine_in_products ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_all_active_includes_visible_active(db_session, test_vendor, products):
    rows = await load_dine_in_products(db_session, test_vendor.id, None)
    names = {p.name for p in rows}
    assert "Visible Active" in names
    assert "Main Course" in names
    assert "Low Stock" in names


@pytest.mark.asyncio
async def test_all_active_excludes_hidden(db_session, test_vendor, products):
    rows = await load_dine_in_products(db_session, test_vendor.id, None)
    names = {p.name for p in rows}
    assert "Hidden Product" not in names


@pytest.mark.asyncio
async def test_all_active_excludes_draft(db_session, test_vendor, products):
    rows = await load_dine_in_products(db_session, test_vendor.id, None)
    names = {p.name for p in rows}
    assert "Draft Product" not in names


@pytest.mark.asyncio
async def test_all_active_excludes_out_of_stock(db_session, test_vendor, products):
    rows = await load_dine_in_products(db_session, test_vendor.id, None)
    names = {p.name for p in rows}
    assert "Out of Stock" not in names


@pytest.mark.asyncio
async def test_all_active_includes_backorder_allowed(db_session, test_vendor, products):
    rows = await load_dine_in_products(db_session, test_vendor.id, None)
    names = {p.name for p in rows}
    assert "Backorder OK" in names


@pytest.mark.asyncio
async def test_curated_mode_returns_only_selected(db_session, test_vendor, products):
    visible = next(p for p in products if p.name == "Visible Active")
    settings = {"restaurant_menu": {"mode": "curated", "product_ids": [str(visible.id)]}}
    rows = await load_dine_in_products(db_session, test_vendor.id, settings)
    assert len(rows) == 1
    assert rows[0].id == visible.id


@pytest.mark.asyncio
async def test_curated_mode_still_excludes_hidden(db_session, test_vendor, products):
    hidden = next(p for p in products if p.name == "Hidden Product")
    settings = {"restaurant_menu": {"mode": "curated", "product_ids": [str(hidden.id)]}}
    rows = await load_dine_in_products(db_session, test_vendor.id, settings)
    assert rows == []


@pytest.mark.asyncio
async def test_curated_empty_ids_returns_empty(db_session, test_vendor, products):
    settings = {"restaurant_menu": {"mode": "curated", "product_ids": []}}
    rows = await load_dine_in_products(db_session, test_vendor.id, settings)
    assert rows == []


@pytest.mark.asyncio
async def test_truncation_detected(db_session, test_vendor):
    for i in range(5):
        db_session.add(_make_product(test_vendor.id, name=f"Item {i}"))
    await db_session.commit()
    result = await load_dine_in_products_with_meta(db_session, test_vendor.id, None, limit=3)
    assert result.truncated is True
    assert len(result.products) == 3


@pytest.mark.asyncio
async def test_no_truncation_when_under_limit(db_session, test_vendor):
    for i in range(2):
        db_session.add(_make_product(test_vendor.id, name=f"Small {i}"))
    await db_session.commit()
    result = await load_dine_in_products_with_meta(db_session, test_vendor.id, None, limit=10)
    assert result.truncated is False
    assert len(result.products) == 2


# ── GET /vendors/me/restaurant/menu ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_menu_settings_defaults(client: AsyncClient, test_vendor: Vendor):
    resp = await client.get(MENU_BASE)
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "all_active"
    assert isinstance(body["product_ids"], list)
    assert isinstance(body["items"], list)


@pytest.mark.asyncio
async def test_get_menu_returns_active_products(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor
):
    db_session.add(_make_product(test_vendor.id, name="Active A"))
    db_session.add(_make_product(test_vendor.id, name="Draft B", status="draft"))
    await db_session.commit()

    resp = await client.get(MENU_BASE)
    assert resp.status_code == 200
    names = {i["name"] for i in resp.json()["items"]}
    assert "Active A" in names
    assert "Draft B" not in names


# ── PUT /vendors/me/restaurant/menu ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_put_menu_updates_mode_to_curated(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor
):
    p = _make_product(test_vendor.id, name="Curated P")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    resp = await client.put(MENU_BASE, json={"mode": "curated", "product_ids": [str(p.id)]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "curated"
    assert str(p.id) in body["product_ids"]


@pytest.mark.asyncio
async def test_put_menu_switch_back_to_all_active(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor
):
    p = _make_product(test_vendor.id, name="Temp")
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)

    await client.put(MENU_BASE, json={"mode": "curated", "product_ids": [str(p.id)]})
    resp = await client.put(MENU_BASE, json={"mode": "all_active", "product_ids": []})
    assert resp.status_code == 200
    assert resp.json()["mode"] == "all_active"


@pytest.mark.asyncio
async def test_put_menu_invalid_mode_rejected(client: AsyncClient, test_vendor: Vendor):
    resp = await client.put(MENU_BASE, json={"mode": "invalid", "product_ids": []})
    # Pydantic Literal validation rejects unknown modes with 422
    assert resp.status_code in (400, 422)


# ── Public QR preview ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_public_preview_returns_menu(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor
):
    db_session.add(_make_product(test_vendor.id, name="Preview Dish", category="Starters"))
    await db_session.commit()

    resp = await client.get(f"/api/v1/public/restaurant/{test_vendor.slug}/table/preview")
    assert resp.status_code == 200
    body = resp.json()

    assert body["table"]["id"] == "preview"
    assert "menu" in body
    assert isinstance(body["menu"], list)
    assert "menu_truncated" in body
    cats = {sec["category"] for sec in body["menu"]}
    assert "Starters" in cats


@pytest.mark.asyncio
async def test_public_preview_excludes_hidden_and_oos(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor
):
    db_session.add(_make_product(test_vendor.id, name="Shown", category="Mains"))
    db_session.add(_make_product(test_vendor.id, name="Hidden", category="Mains", is_visible=False))
    db_session.add(_make_product(test_vendor.id, name="OOS", category="Mains", stock_status="out_of_stock"))
    await db_session.commit()

    resp = await client.get(f"/api/v1/public/restaurant/{test_vendor.slug}/table/preview")
    assert resp.status_code == 200
    all_items = [
        item
        for sec in resp.json()["menu"]
        for item in sec["items"]
        + [i for sub in sec.get("subcategories", []) for i in sub["items"]]
    ]
    names = {i["name"] for i in all_items}
    assert "Shown" in names
    assert "Hidden" not in names
    assert "OOS" not in names


@pytest.mark.asyncio
async def test_public_preview_image_url_from_product_image(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor
):
    p = _make_product(test_vendor.id, name="With Image", category="Drinks")
    db_session.add(p)
    await db_session.flush()
    img = ProductImage(
        id=uuid.uuid4(),
        product_id=p.id,
        url="https://example.com/drink.jpg",
        is_primary=True,
        media_type="image",
        position=0,
    )
    db_session.add(img)
    await db_session.commit()

    resp = await client.get(f"/api/v1/public/restaurant/{test_vendor.slug}/table/preview")
    assert resp.status_code == 200
    all_items = [
        item
        for sec in resp.json()["menu"]
        for item in sec["items"]
        + [i for sub in sec.get("subcategories", []) for i in sub["items"]]
    ]
    item = next((i for i in all_items if i["name"] == "With Image"), None)
    assert item is not None
    assert item["image_url"] == "https://example.com/drink.jpg"


@pytest.mark.asyncio
async def test_public_unknown_vendor_returns_404(client: AsyncClient):
    resp = await client.get("/api/v1/public/restaurant/no-such-vendor-xyz/table/preview")
    assert resp.status_code == 404
