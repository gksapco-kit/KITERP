"""Dine-in / QR menu product selection stored in vendor.settings.restaurant_menu."""
from __future__ import annotations

import logging
from typing import Iterable, NamedTuple
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.vendor_product import Product, ProductImage

logger = logging.getLogger(__name__)

MENU_ITEM_LIMIT_DEFAULT = 200


def parse_menu_settings(settings: dict | None) -> tuple[str, list[str]]:
    """
    Returns (mode, product_id_strings).
    mode: 'all_active' | 'curated'

    Order of product_ids is preserved for curated mode display ordering.
    """
    raw = (settings or {}).get("restaurant_menu") or {}
    mode = raw.get("mode") or "all_active"
    if mode not in ("all_active", "curated"):
        mode = "all_active"
    # Use list to preserve insertion order (important for curated display ordering)
    seen: set[str] = set()
    ids: list[str] = []
    for x in (raw.get("product_ids") or []):
        s = str(x)
        if s and s not in seen:
            seen.add(s)
            ids.append(s)
    return mode, ids


def parse_category_order(settings: dict | None) -> list[str]:
    """Return the vendor-defined category display order (empty = alphabetical)."""
    raw = (settings or {}).get("restaurant_menu") or {}
    return [str(c) for c in (raw.get("category_order") or []) if c]


def menu_settings_payload(
    mode: str,
    product_ids: Iterable[str],
    category_order: Iterable[str] | None = None,
) -> dict:
    payload: dict = {
        "mode": mode if mode in ("all_active", "curated") else "all_active",
        "product_ids": list(product_ids),
    }
    if category_order is not None:
        payload["category_order"] = list(category_order)
    return {"restaurant_menu": payload}


def sort_menu_sections(sections: list[dict], category_order: list[str]) -> list[dict]:
    """Sort menu sections by vendor-defined category order; unknown categories go last."""
    if not category_order:
        return sections
    order_map = {name.lower(): idx for idx, name in enumerate(category_order)}
    return sorted(sections, key=lambda s: order_map.get((s.get("category") or "").lower(), len(category_order)))


class DineInProductResult(NamedTuple):
    products: list[Product]
    truncated: bool


async def load_dine_in_products(
    db: AsyncSession,
    vendor_id: UUID,
    settings: dict | None,
    *,
    limit: int = MENU_ITEM_LIMIT_DEFAULT,
) -> list[Product]:
    """Load dine-in products. Excludes hidden and out-of-stock items."""
    result = await load_dine_in_products_with_meta(db, vendor_id, settings, limit=limit)
    return result.products


async def load_dine_in_products_with_meta(
    db: AsyncSession,
    vendor_id: UUID,
    settings: dict | None,
    *,
    limit: int = MENU_ITEM_LIMIT_DEFAULT,
) -> DineInProductResult:
    """
    Load dine-in products with truncation metadata.

    Filters applied:
    - status == 'active'
    - is_visible == True
    - stock_status != 'out_of_stock'  (unless allow_backorders is set)

    Products are eager-loaded with their images so callers can access
    the primary image without additional queries.
    """
    mode, curated_ids = parse_menu_settings(settings)

    q = (
        select(Product)
        .where(
            and_(
                Product.vendor_id == vendor_id,
                Product.status == "active",
                Product.is_visible == True,  # noqa: E712
            )
        )
        .filter(
            # Exclude out-of-stock items unless backorders are allowed
            (Product.stock_status != "out_of_stock") | (Product.allow_backorders == True)  # noqa: E712
        )
        .options(selectinload(Product.images))
        .order_by(Product.category, Product.name)
        .limit(limit + 1)  # fetch one extra to detect truncation
    )

    curated_uuid_order: list[UUID] = []

    if mode == "curated":
        if not curated_ids:
            return DineInProductResult(products=[], truncated=False)
        for pid in curated_ids:
            try:
                curated_uuid_order.append(UUID(pid))
            except ValueError:
                continue
        if not curated_uuid_order:
            return DineInProductResult(products=[], truncated=False)
        q = q.where(Product.id.in_(curated_uuid_order))

    r = await db.execute(q)
    rows = list(r.scalars().all())

    truncated = len(rows) > limit
    if truncated:
        rows = rows[:limit]
        logger.warning(
            "Dine-in catalog for vendor %s hit the %d-item limit and was truncated. "
            "Consider increasing the limit or using curated mode.",
            vendor_id,
            limit,
        )

    # In curated mode, restore the vendor-defined order from product_ids
    if mode == "curated" and curated_uuid_order:
        order_map = {uid: idx for idx, uid in enumerate(curated_uuid_order)}
        rows.sort(key=lambda p: order_map.get(p.id, len(curated_uuid_order)))

    return DineInProductResult(products=rows, truncated=truncated)
