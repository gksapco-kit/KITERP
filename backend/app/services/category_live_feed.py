# app/services/category_live_feed.py
"""Build live-feed items for storefront category blocks."""
from typing import Any, Callable, Dict, List
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_product import Product
from app.models.vendor_service import Service
from app.repositories.vendor_category_repo import VendorCategoryRepository


async def build_category_live_items(
    db: AsyncSession,
    vendor_id: UUID,
    limit: int,
    norm_item: Callable[..., Dict[str, Any]],
) -> List[Dict[str, Any]]:
    repo = VendorCategoryRepository(db)
    cats = await repo.list_by_vendor(vendor_id, is_active=True)

    if cats:
        prod_rows = (await db.execute(
            select(Product.category, func.count(Product.id))
            .where(Product.vendor_id == vendor_id, Product.category.isnot(None))
            .group_by(Product.category)
        )).all()
        svc_rows = (await db.execute(
            select(Service.category, func.count(Service.id))
            .where(Service.vendor_id == vendor_id, Service.category.isnot(None))
            .group_by(Service.category)
        )).all()
        prod_counts = {cat: int(cnt or 0) for cat, cnt in prod_rows if cat}
        svc_counts = {cat: int(cnt or 0) for cat, cnt in svc_rows if cat}

        items: List[Dict[str, Any]] = []
        for c in sorted(cats, key=lambda x: (x.sort_order or 0, x.name or ""))[:limit]:
            keys = {c.name, c.slug}
            cnt = sum(prod_counts.get(k, 0) + svc_counts.get(k, 0) for k in keys if k)
            items.append(norm_item(
                id=str(c.id),
                title=c.name or "",
                subtitle=f"{cnt} item{'s' if cnt != 1 else ''}" if cnt else None,
                description=c.description,
                image_url=c.image_url,
                url=f"/categories/{c.slug}" if c.slug else None,
                meta={
                    "count": cnt,
                    "slug": c.slug,
                    "applies_to": c.applies_to,
                    "image_url": c.image_url,
                },
            ))
        return items

    # Fallback: derive from product/service category strings (legacy)
    prod_rows = (await db.execute(
        select(Product.category, func.count(Product.id))
        .where(Product.vendor_id == vendor_id, Product.category.isnot(None))
        .group_by(Product.category)
    )).all()
    svc_rows = (await db.execute(
        select(Service.category, func.count(Service.id))
        .where(Service.vendor_id == vendor_id, Service.category.isnot(None))
        .group_by(Service.category)
    )).all()
    seen: Dict[str, int] = {}
    for cat, cnt in list(prod_rows) + list(svc_rows):
        if not cat:
            continue
        seen[cat] = seen.get(cat, 0) + int(cnt or 0)
    items = []
    for cat, cnt in sorted(seen.items(), key=lambda x: -x[1])[:limit]:
        items.append(norm_item(
            id=cat,
            title=cat,
            subtitle=f"{cnt} item{'s' if cnt != 1 else ''}",
            meta={"count": cnt},
        ))
    return items
