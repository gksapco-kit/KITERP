"""Resolve storefront listing prices from products and variants."""

from __future__ import annotations

from typing import Any


def resolve_product_listing_price(product: Any) -> tuple[float | None, float | None, bool]:
    """
    Resolve the price shown on product cards/grids.

    When the product-level price is missing or zero, fall back to the minimum
    price among active variants (common when pricing lives on variants only).
    """
    raw_price = float(product.price) if product.price is not None else None
    compare_at = float(product.compare_at_price) if product.compare_at_price is not None else None
    from_variants = False

    variants = getattr(product, "variants", None) or []
    active_variants = [v for v in variants if getattr(v, "is_active", True)]

    if (raw_price is None or raw_price <= 0) and active_variants:
        variant_prices = [
            float(v.price)
            for v in active_variants
            if v.price is not None and float(v.price) > 0
        ]
        if variant_prices:
            raw_price = min(variant_prices)
            from_variants = True
            if compare_at is None:
                variant_compares = [
                    float(v.compare_at_price)
                    for v in active_variants
                    if v.compare_at_price is not None and float(v.compare_at_price) > 0
                ]
                if variant_compares:
                    compare_at = min(variant_compares)

    return raw_price, compare_at, from_variants


def format_listing_price(price: float | None, currency: str = "INR") -> str | None:
    if price is None:
        return None
    return f"{currency} {float(price):,.0f}"


def live_product_price_fields(product: Any) -> dict[str, Any]:
    """Price fields for website-builder live product feeds."""
    price, compare_at, from_variants = resolve_product_listing_price(product)
    currency = product.currency or "INR"
    return {
        "price": price,
        "price_formatted": format_listing_price(price, currency),
        "compare_at_price": compare_at,
        "price_from_variants": from_variants,
    }
