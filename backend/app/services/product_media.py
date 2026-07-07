"""Resolve product thumbnail URLs from product-level and variant-level media."""

from __future__ import annotations

from typing import Any


def _is_image_media(item: dict[str, Any]) -> bool:
    return item.get("media_type", "image") == "image"


def resolve_variant_media_thumbnail(variants: list[Any] | None) -> str | None:
    for variant in variants or []:
        media = getattr(variant, "media", None) or []
        if not isinstance(media, list):
            continue
        image_items = [m for m in media if isinstance(m, dict) and m.get("url") and _is_image_media(m)]
        if not image_items:
            image_items = [m for m in media if isinstance(m, dict) and m.get("url")]
        if not image_items:
            continue
        primary = next((m for m in image_items if m.get("is_primary")), None) or image_items[0]
        url = primary.get("url")
        if url:
            return url
    return None


def resolve_product_thumbnail_url(product: Any) -> str | None:
    images = getattr(product, "images", None) or []
    image_rows = [
        img for img in images
        if getattr(img, "url", None) and getattr(img, "media_type", "image") == "image"
    ]
    if image_rows:
        primary = next((i for i in image_rows if i.is_primary), None) or image_rows[0]
        return primary.url

    return resolve_variant_media_thumbnail(getattr(product, "variants", None))
