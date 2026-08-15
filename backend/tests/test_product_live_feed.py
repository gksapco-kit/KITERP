"""Tests for homepage live product feed serialization."""

from types import SimpleNamespace
from uuid import uuid4

from app.services.product_live_feed import product_to_live_item, serialize_live_variant


def _norm_item(**kw):
    return {
        "id": kw.get("id"),
        "title": kw.get("title") or "",
        "subtitle": kw.get("subtitle"),
        "description": kw.get("description"),
        "image_url": kw.get("image_url"),
        "price": kw.get("price"),
        "price_formatted": kw.get("price_formatted"),
        "rating": kw.get("rating"),
        "url": kw.get("url"),
        "meta": kw.get("meta") or {},
    }


def test_live_product_includes_variant_options_and_images():
    crate_id = uuid4()
    image_id = uuid4()
    product = SimpleNamespace(
        id=uuid4(),
        name="Special Toned Milk - CRATES",
        slug="special-toned-milk-crates",
        brand="Nandini",
        short_description="12 packs",
        description=None,
        sku="MAT-00007",
        category="Nandini Milk",
        stock_status="in_stock",
        quantity=10,
        track_inventory=True,
        allow_backorders=False,
        is_featured=True,
        is_on_sale=False,
        discount_percentage=None,
        currency="INR",
        offer_label=None,
        view_count=2,
        tags=["Nandini"],
        uom="piece",
        price=0,
        compare_at_price=None,
        images=[
            SimpleNamespace(
                id=image_id,
                url="https://cdn.example/milk.jpg",
                alt_text="Crate",
                position=0,
                is_primary=True,
                media_type="image",
            )
        ],
        variants=[
            SimpleNamespace(
                id=crate_id,
                name="CRATE / 1000 ML",
                sku="MAT-00007-1000-CRAT",
                barcode="121300445621",
                uom="piece",
                uom_quantity=1,
                price_type="per_unit",
                price=616.80,
                compare_at_price=None,
                currency="INR",
                quantity=4,
                stock_status="in_stock",
                allow_backorders=False,
                track_inventory=True,
                color=None,
                attributes={"Crate": "CRATE", "Milk - Liter": "1000 ML"},
                media=[],
                is_active=True,
                max_quantity_per_order=None,
                min_quantity_per_order=None,
            )
        ],
    )

    item = product_to_live_item(product, _norm_item)
    assert item["title"] == "Special Toned Milk - CRATES"
    assert item["price"] == 616.80
    assert item["url"] == "/products/special-toned-milk-crates"
    assert item["image_url"] == "https://cdn.example/milk.jpg"
    assert item["meta"]["variants"][0]["sku"] == "MAT-00007-1000-CRAT"
    assert item["meta"]["variants"][0]["attributes"]["Milk - Liter"] == "1000 ML"
    assert item["meta"]["images"][0]["url"] == "https://cdn.example/milk.jpg"
    assert serialize_live_variant(product.variants[0])["price"] == 616.80


def test_live_variant_zero_qty_is_out_of_stock():
    serialized = serialize_live_variant(
        SimpleNamespace(
            id=uuid4(),
            name="200 ML",
            sku="MAT-00006-200-CRAT",
            barcode=None,
            uom="piece",
            uom_quantity=1,
            price_type="per_unit",
            price=80,
            compare_at_price=None,
            currency="INR",
            quantity=0,
            stock_status="in_stock",
            allow_backorders=False,
            track_inventory=True,
            color=None,
            attributes={"Capacity": "200 ML", "Crate": "CRATE"},
            media=[],
            is_active=True,
            max_quantity_per_order=None,
            min_quantity_per_order=None,
        )
    )
    assert serialized["quantity"] == 0
    assert serialized["stock_status"] == "out_of_stock"
