"""
Tests for vendor product CRUD endpoints at /api/v1/vendors/me/products.

Each test gets a clean database (tables created/dropped per test via conftest).
Auth is overridden so requests skip real JWT — the test_user is injected directly.
"""

import json
import pytest
from httpx import AsyncClient

from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.user import User

BASE = "/api/v1/vendors/me/products"


# ── CREATE ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_product_minimal(client: AsyncClient, test_vendor: Vendor):
    """POST with only required fields (name, price) succeeds."""
    payload = {"name": "Simple Widget", "price": 199.99}
    resp = await client.post(
        BASE,
        data={"product_data": json.dumps(payload)},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Simple Widget"
    assert body["price"] == 199.99
    assert body["slug"] == "simple-widget"
    assert body["status"] == "draft"
    assert body["vendor_id"] == str(test_vendor.id)
    assert body["product_type"] == "physical"
    assert body["currency"] == "INR"
    assert body["created_by"] is not None


@pytest.mark.asyncio
async def test_create_product_all_sections(client: AsyncClient, test_vendor: Vendor):
    """POST with fields spanning every section returns them all."""
    payload = {
        # Basic
        "name": "Full Product",
        "slug": "full-product",
        "description": "A complete product",
        "short_description": "Complete",
        "brand": "TestBrand",
        "product_type": "physical",
        "category": "Electronics",
        "subcategory": "Gadgets",
        "tags": ["new", "popular"],
        # Pricing
        "price": 4999.00,
        "compare_at_price": 5999.00,
        "cost_price": 3000.00,
        "currency": "INR",
        "discount_percentage": 15.0,
        "discount_amount": 750.00,
        "offer_label": "Flash Sale",
        "is_on_sale": True,
        # Tax
        "is_taxable": True,
        "tax_rate": 18.0,
        "hsn_code": "85171290",
        "gst_rate": 18.0,
        # Inventory
        "sku": "FP-001",
        "barcode": "1234567890",
        "track_inventory": True,
        "quantity": 100,
        "low_stock_threshold": 10,
        "reorder_point": 20,
        "reorder_quantity": 50,
        "stock_status": "in_stock",
        "allow_backorders": False,
        # Lifecycle
        "warranty_period_days": 365,
        "warranty_type": "manufacturer",
        # Return
        "return_policy": "30-day full refund",
        "return_days": 30,
        "is_returnable": True,
        "return_conditions": "Unopened, with tags",
        "refund_policy": "full_refund",
        # Shipping
        "weight_kg": 0.5,
        "length_cm": 20.0,
        "width_cm": 15.0,
        "height_cm": 5.0,
        "shipping_class": "standard",
        "requires_shipping": True,
        "shipping_cost": 49.00,
        "free_shipping_threshold": 999.00,
        # Visibility
        "status": "active",
        "is_featured": True,
        "is_visible": True,
        "is_new_arrival": True,
        "is_best_seller": False,
        # SEO
        "meta_title": "Full Product - Buy Now",
        "meta_description": "Best product ever",
        "meta_keywords": ["electronics", "gadget"],
        "og_image_url": "https://example.com/og.png",
        "canonical_url": "https://shop.com/full-product",
        # Advanced
        "attributes": {"color": ["Red", "Blue"]},
        "specifications": {"weight": "500g"},
        "custom_fields": {"note": "handle with care"},
        # Digital
        "is_digital": False,
        # Subscription
        "is_subscription": False,
    }

    resp = await client.post(
        BASE,
        data={"product_data": json.dumps(payload)},
    )
    assert resp.status_code == 201
    body = resp.json()

    assert body["brand"] == "TestBrand"
    assert body["discount_percentage"] == 15.0
    assert body["offer_label"] == "Flash Sale"
    assert body["is_on_sale"] is True
    assert body["gst_rate"] == 18.0
    assert body["reorder_point"] == 20
    assert body["stock_status"] == "in_stock"
    assert body["warranty_type"] == "manufacturer"
    assert body["return_days"] == 30
    assert body["refund_policy"] == "full_refund"
    assert body["weight_kg"] == 0.5
    assert body["shipping_class"] == "standard"
    assert body["is_featured"] is True
    assert body["is_new_arrival"] is True
    assert body["meta_keywords"] == ["electronics", "gadget"]
    assert body["canonical_url"] == "https://shop.com/full-product"
    assert body["attributes"] == {"color": ["Red", "Blue"]}
    assert body["custom_fields"] == {"note": "handle with care"}
    assert body["version_number"] == 1
    assert body["view_count"] == 0


@pytest.mark.asyncio
async def test_create_product_auto_slug(client: AsyncClient, test_vendor: Vendor):
    """When slug is omitted, the API auto-generates one from name."""
    payload = {"name": "Auto Slug Test!", "price": 10}
    resp = await client.post(BASE, data={"product_data": json.dumps(payload)})
    assert resp.status_code == 201
    assert resp.json()["slug"].startswith("auto-slug-test")


@pytest.mark.asyncio
async def test_create_product_duplicate_slug_appends_suffix(
    client: AsyncClient, test_vendor: Vendor
):
    """Two products with the same name get different slugs."""
    payload = {"name": "Dupe Name", "price": 10}
    r1 = await client.post(BASE, data={"product_data": json.dumps(payload)})
    r2 = await client.post(BASE, data={"product_data": json.dumps(payload)})
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["slug"] != r2.json()["slug"]


@pytest.mark.asyncio
async def test_create_product_invalid_json(client: AsyncClient, test_vendor: Vendor):
    """Sending invalid JSON in product_data returns 400."""
    resp = await client.post(BASE, data={"product_data": "not-json"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_product_missing_name(client: AsyncClient, test_vendor: Vendor):
    """Missing required 'name' field returns 422."""
    resp = await client.post(
        BASE, data={"product_data": json.dumps({"price": 10})}
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_product_negative_price(client: AsyncClient, test_vendor: Vendor):
    """Negative price is rejected by schema validation."""
    payload = {"name": "Bad Price", "price": -5}
    resp = await client.post(BASE, data={"product_data": json.dumps(payload)})
    assert resp.status_code == 422


# ── LIST ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_products_empty(client: AsyncClient, test_vendor: Vendor):
    """Empty vendor returns zero items."""
    resp = await client.get(BASE)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_list_products_returns_created(client: AsyncClient, test_vendor: Vendor):
    """After creating two products, list returns both."""
    for name in ["Alpha", "Beta"]:
        await client.post(
            BASE, data={"product_data": json.dumps({"name": name, "price": 10})}
        )

    resp = await client.get(BASE)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    names = {p["name"] for p in body["items"]}
    assert names == {"Alpha", "Beta"}


@pytest.mark.asyncio
async def test_list_products_pagination(client: AsyncClient, test_vendor: Vendor):
    """Pagination works: page=1, size=2 of 3 products returns 2 items."""
    for i in range(3):
        await client.post(
            BASE, data={"product_data": json.dumps({"name": f"P{i}", "price": 10})}
        )

    resp = await client.get(BASE, params={"page": 1, "size": 2})
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["pages"] == 2


@pytest.mark.asyncio
async def test_list_products_search(client: AsyncClient, test_vendor: Vendor):
    """Search filter narrows results."""
    await client.post(
        BASE, data={"product_data": json.dumps({"name": "Wireless Mouse", "price": 500})}
    )
    await client.post(
        BASE, data={"product_data": json.dumps({"name": "USB Cable", "price": 100})}
    )

    resp = await client.get(BASE, params={"search": "wireless"})
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Wireless Mouse"


# ── GET SINGLE ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_product_by_id(client: AsyncClient, test_product: Product):
    """GET /products/{id} returns the correct product."""
    resp = await client.get(f"{BASE}/{test_product.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(test_product.id)
    assert body["name"] == "Existing Product"


@pytest.mark.asyncio
async def test_get_product_not_found(client: AsyncClient, test_vendor: Vendor):
    """GET for a non-existent UUID returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(f"{BASE}/{fake_id}")
    assert resp.status_code == 404


# ── UPDATE ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_product_basic(client: AsyncClient, test_product: Product):
    """PUT updates fields and bumps version_number."""
    resp = await client.put(
        f"{BASE}/{test_product.id}",
        json={"name": "Renamed Product", "price": 1299.00},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Renamed Product"
    assert body["price"] == 1299.00
    assert body["version_number"] == 2


@pytest.mark.asyncio
async def test_update_product_new_fields(client: AsyncClient, test_product: Product):
    """PUT can set new section fields (shipping, returns, etc.)."""
    resp = await client.put(
        f"{BASE}/{test_product.id}",
        json={
            "brand": "UpdatedBrand",
            "weight_kg": 1.5,
            "is_returnable": False,
            "return_days": 7,
            "is_new_arrival": True,
            "meta_title": "Buy Existing Product",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["brand"] == "UpdatedBrand"
    assert body["weight_kg"] == 1.5
    assert body["is_returnable"] is False
    assert body["return_days"] == 7
    assert body["is_new_arrival"] is True
    assert body["meta_title"] == "Buy Existing Product"


@pytest.mark.asyncio
async def test_update_product_not_found(client: AsyncClient, test_vendor: Vendor):
    """PUT on non-existent product returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.put(f"{BASE}/{fake_id}", json={"name": "Ghost"})
    assert resp.status_code == 404


# ── DELETE ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_product(client: AsyncClient, test_product: Product):
    """DELETE removes the product, subsequent GET returns 404."""
    resp = await client.delete(f"{BASE}/{test_product.id}")
    assert resp.status_code == 204

    resp2 = await client.get(f"{BASE}/{test_product.id}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_product_not_found(client: AsyncClient, test_vendor: Vendor):
    """DELETE on non-existent product returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.delete(f"{BASE}/{fake_id}")
    assert resp.status_code == 404


# ── DIGITAL / SUBSCRIPTION fields ────────────────────────────────

@pytest.mark.asyncio
async def test_create_digital_product(client: AsyncClient, test_vendor: Vendor):
    """Digital product fields are persisted and returned."""
    payload = {
        "name": "E-Book",
        "price": 299,
        "product_type": "digital",
        "is_digital": True,
        "download_url": "https://cdn.example.com/ebook.pdf",
        "download_limit": 5,
        "download_expiry_days": 30,
        "requires_shipping": False,
    }
    resp = await client.post(BASE, data={"product_data": json.dumps(payload)})
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_digital"] is True
    assert body["download_url"] == "https://cdn.example.com/ebook.pdf"
    assert body["download_limit"] == 5
    assert body["download_expiry_days"] == 30
    assert body["requires_shipping"] is False


@pytest.mark.asyncio
async def test_create_subscription_product(client: AsyncClient, test_vendor: Vendor):
    """Subscription product fields are persisted."""
    payload = {
        "name": "Monthly Box",
        "price": 999,
        "product_type": "subscription",
        "is_subscription": True,
        "subscription_interval": "monthly",
        "subscription_price": 899,
    }
    resp = await client.post(BASE, data={"product_data": json.dumps(payload)})
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_subscription"] is True
    assert body["subscription_interval"] == "monthly"
    assert body["subscription_price"] == 899.0


# ── EDGE CASES ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_product_with_json_fields(client: AsyncClient, test_vendor: Vendor):
    """JSON fields (attributes, specifications, custom_fields) roundtrip correctly."""
    payload = {
        "name": "JSON Fields Test",
        "price": 100,
        "attributes": {"color": ["Red", "Blue"], "size": ["S", "M", "L"]},
        "specifications": {"weight": "200g", "material": "Cotton"},
        "custom_fields": {"vendor_notes": "Fragile"},
        "related_product_ids": [],
        "meta_keywords": ["test", "json"],
    }
    resp = await client.post(BASE, data={"product_data": json.dumps(payload)})
    assert resp.status_code == 201
    body = resp.json()
    assert body["attributes"]["color"] == ["Red", "Blue"]
    assert body["specifications"]["material"] == "Cotton"
    assert body["custom_fields"]["vendor_notes"] == "Fragile"
    assert body["meta_keywords"] == ["test", "json"]
