"""Dine-in / QR menu product selection stored in vendor.settings.restaurant_menu."""
from __future__ import annotations

from typing import Any, Iterable, Set
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_product import Product


def parse_menu_settings(settings: dict | None) -> tuple[str, Set[str]]:
    """
    Returns (mode, product_id_strings).
    mode: 'all_active' | 'curated'
    """
    raw = (settings or {}).get("restaurant_menu") or {}
    mode = raw.get("mode") or "all_active"
    if mode not in ("all_active", "curated"):
        mode = "all_active"
    ids = {str(x) for x in (raw.get("product_ids") or []) if x}
    return mode, ids


def menu_settings_payload(mode: str, product_ids: Iterable[str]) -> dict:
    return {
        "restaurant_menu": {
            "mode": mode if mode in ("all_active", "curated") else "all_active",
            "product_ids": list(product_ids),
        }
    }


async def load_dine_in_products(
    db: AsyncSession,
    vendor_id: UUID,
    settings: dict | None,
    *,
    limit: int = 200,
) -> list[Product]:
    mode, curated_ids = parse_menu_settings(settings)
    q = (
        select(Product)
        .where(and_(Product.vendor_id == vendor_id, Product.status == "active"))
        .order_by(Product.category, Product.name)
        .limit(limit)
    )
    if mode == "curated":
        if not curated_ids:
            return []
        uuids = []
        for pid in curated_ids:
            try:
                uuids.append(UUID(pid))
            except ValueError:
                continue
        if not uuids:
            return []
        q = q.where(Product.id.in_(uuids))
    r = await db.execute(q)
    return list(r.scalars().all())
