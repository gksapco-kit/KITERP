"""Build live-feed items for storefront product grids.

Includes variants and images so homepage cards can match the Products page
(option pickers, variant price, gallery).
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.vendor_product import Product
from app.services.product_media import resolve_product_thumbnail_url
from app.services.product_pricing import live_product_price_fields
from app.api.v1.vendor_products import _effective_stock_status


def _num(v: Any) -> float | None:
    return float(v) if v is not None else None


def serialize_live_variant(variant: Any) -> Dict[str, Any]:
    qty = int(variant.quantity or 0)
    track = True if variant.track_inventory is None else bool(variant.track_inventory)
    backorders = bool(variant.allow_backorders)
    return {
        "id": str(variant.id),
        "name": variant.name or "",
        "sku": variant.sku,
        "barcode": variant.barcode,
        "uom": variant.uom or "piece",
        "uom_quantity": _num(variant.uom_quantity),
        "price_type": variant.price_type or "per_unit",
        "price": _num(variant.price) or 0,
        "compare_at_price": _num(variant.compare_at_price),
        "currency": variant.currency or "INR",
        "quantity": qty,
        "stock_status": _effective_stock_status(
            quantity=qty,
            stock_status=variant.stock_status,
            track_inventory=track,
            allow_backorders=backorders,
        ),
        "allow_backorders": backorders,
        "track_inventory": track,
        "max_quantity_per_order": variant.max_quantity_per_order,
        "min_quantity_per_order": variant.min_quantity_per_order,
        "color": variant.color,
        "attributes": variant.attributes or {},
        "media": variant.media or [],
        "is_active": True if variant.is_active is None else bool(variant.is_active),
    }


def serialize_live_image(image: Any) -> Dict[str, Any]:
    return {
        "id": str(image.id),
        "url": image.url,
        "alt_text": image.alt_text,
        "position": image.position or 0,
        "is_primary": bool(image.is_primary),
        "media_type": image.media_type or "image",
    }


def product_to_live_item(product: Product, norm_item: Callable[..., Dict[str, Any]]) -> Dict[str, Any]:
    price_fields = live_product_price_fields(product)
    variants = [serialize_live_variant(v) for v in (product.variants or [])]
    images = [serialize_live_image(img) for img in (product.images or [])]
    return norm_item(
        id=str(product.id),
        title=product.name or "",
        subtitle=product.brand,
        description=product.short_description or product.description,
        image_url=resolve_product_thumbnail_url(product),
        price=price_fields["price"],
        price_formatted=price_fields["price_formatted"],
        url=f"/products/{product.slug}" if product.slug else None,
        meta={
            "sku": product.sku,
            "slug": product.slug,
            "category": product.category,
            "stock_status": _effective_stock_status(
                quantity=product.quantity,
                stock_status=product.stock_status,
                track_inventory=True if product.track_inventory is None else bool(product.track_inventory),
                allow_backorders=bool(product.allow_backorders),
            ),
            "quantity": product.quantity or 0,
            "track_inventory": True if product.track_inventory is None else bool(product.track_inventory),
            "allow_backorders": bool(product.allow_backorders),
            "is_featured": product.is_featured,
            "is_on_sale": product.is_on_sale,
            "discount_percentage": float(product.discount_percentage) if product.discount_percentage is not None else None,
            "compare_at_price": price_fields["compare_at_price"],
            "currency": product.currency,
            "offer_label": product.offer_label,
            "price_from_variants": price_fields["price_from_variants"],
            "view_count": int(product.view_count or 0),
            "tags": product.tags or [],
            "brand": product.brand,
            "uom": product.uom or "piece",
            "variants": variants,
            "images": images,
        },
    )


async def build_product_live_items(
    db: AsyncSession,
    vendor_id: UUID,
    limit: int,
    norm_item: Callable[..., Dict[str, Any]],
) -> List[Dict[str, Any]]:
    q = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.variants))
        .where(Product.vendor_id == vendor_id, Product.is_visible.is_(True))
        .order_by(Product.is_featured.desc(), Product.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    return [product_to_live_item(p, norm_item) for p in rows]
