"""Tests for product listing price resolution."""

from types import SimpleNamespace

from app.services.product_pricing import (
    format_listing_price,
    live_product_price_fields,
    resolve_product_listing_price,
)


def test_uses_product_price_when_set():
    product = SimpleNamespace(price=499, compare_at_price=599, currency="INR", variants=[])
    price, compare_at, from_variants = resolve_product_listing_price(product)
    assert price == 499
    assert compare_at == 599
    assert from_variants is False


def test_falls_back_to_minimum_variant_price():
    product = SimpleNamespace(
        price=0,
        compare_at_price=None,
        currency="INR",
        variants=[
            SimpleNamespace(price=250, compare_at_price=300, is_active=True),
            SimpleNamespace(price=180, compare_at_price=220, is_active=True),
            SimpleNamespace(price=999, compare_at_price=None, is_active=False),
        ],
    )
    price, compare_at, from_variants = resolve_product_listing_price(product)
    assert price == 180
    assert compare_at == 220
    assert from_variants is True


def test_live_product_price_fields_formats_currency():
    product = SimpleNamespace(
        price=0,
        compare_at_price=None,
        currency="INR",
        variants=[SimpleNamespace(price=350, compare_at_price=None, is_active=True)],
    )
    fields = live_product_price_fields(product)
    assert fields["price"] == 350
    assert fields["price_formatted"] == format_listing_price(350, "INR")
    assert fields["price_from_variants"] is True
