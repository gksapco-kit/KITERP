"""Shared website analytics aggregation (journey page_view + product view_count)."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.crm import CrmJourneyEvent
from app.models.store import Store
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.services.store_scope import store_ids_in_scope

PRODUCT_PATH_MARKER = "/products/"
REALTIME_WINDOW = timedelta(minutes=30)


def _product_image_url(product: Any | None) -> str | None:
    """Use already-loaded product.images only — avoid async lazy-load of variants."""
    if product is None:
        return None
    images = getattr(product, "images", None) or []
    image_rows = [
        img for img in images
        if getattr(img, "url", None) and getattr(img, "media_type", "image") == "image"
    ]
    if not image_rows:
        image_rows = [img for img in images if getattr(img, "url", None)]
    if not image_rows:
        return None
    primary = next((i for i in image_rows if getattr(i, "is_primary", False)), None) or image_rows[0]
    return primary.url


def parse_path_and_branch(raw: str) -> tuple[str, Optional[str]]:
    if not raw:
        return "", None
    text = str(raw).strip()
    if not text:
        return "", None
    if "://" in text:
        parsed = urlparse(text)
        path = parsed.path or ""
        query = parsed.query or ""
    else:
        if "?" in text:
            path, query = text.split("?", 1)
        else:
            path, query = text, ""
    branch = None
    if query:
        qs = parse_qs(query, keep_blank_values=False)
        vals = qs.get("branch") or qs.get("store") or []
        if vals:
            branch = str(vals[0]).strip() or None
    path = path.rstrip("/") or "/"
    return path, branch


def product_slug_from_path(path: str) -> Optional[str]:
    if PRODUCT_PATH_MARKER not in path:
        return None
    after = path.split(PRODUCT_PATH_MARKER, 1)[1]
    slug = after.split("/", 1)[0].strip()
    return slug or None


async def branch_tokens_for_scope(
    db: AsyncSession,
    vendor_id: UUID,
    business_unit_id: Optional[UUID],
    branch_id: Optional[UUID],
) -> Optional[Set[str]]:
    store_ids = await store_ids_in_scope(
        db, vendor_id, bu_id=business_unit_id, branch_id=branch_id
    )
    if store_ids is None:
        return None
    if not store_ids:
        return set()
    rows = (
        await db.execute(
            select(Store).where(Store.vendor_id == vendor_id, Store.id.in_(store_ids))
        )
    ).scalars().all()
    tokens: Set[str] = set()
    for s in rows:
        tokens.add(str(s.id))
        if s.code:
            tokens.add(str(s.code).strip())
    return tokens


def event_matches_branch(branch_param: Optional[str], allowed: Optional[Set[str]]) -> bool:
    if allowed is None:
        return True
    if not allowed:
        return False
    if not branch_param:
        return False
    return branch_param.strip() in allowed


async def build_website_analytics(
    db: AsyncSession,
    *,
    vendor_ids: List[UUID],
    business_unit_id: Optional[UUID] = None,
    branch_id: Optional[UUID] = None,
    days: int = 7,
    limit: int = 50,
    include_vendor_meta: bool = False,
) -> Dict[str, Any]:
    """
    Aggregate page_view journeys + product views for one or more vendors.

    When multiple vendors (or include_vendor_meta), page/product rows include
    vendor_id / vendor_slug / vendor_name. BU/branch filters only apply when a
    single vendor is in scope.
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    realtime_since = now - REALTIME_WINDOW

    if not vendor_ids:
        return {
            "summary": {
                "total_page_views": 0,
                "unique_visitors": 0,
                "total_product_views": 0,
                "pages_tracked": 0,
                "realtime_active_users": 0,
            },
            "pages": [],
            "products": [],
            "filters": {
                "vendor_ids": [],
                "business_unit_id": str(business_unit_id) if business_unit_id else None,
                "branch_id": str(branch_id) if branch_id else None,
                "days": days,
                "limit": limit,
            },
        }

    single_vendor = len(vendor_ids) == 1
    allowed_branches: Optional[Set[str]] = None
    if single_vendor and (business_unit_id or branch_id):
        allowed_branches = await branch_tokens_for_scope(
            db, vendor_ids[0], business_unit_id, branch_id
        )
    elif single_vendor:
        allowed_branches = None
    else:
        # Platform-wide: ignore BU/branch (they are vendor-scoped).
        allowed_branches = None
        business_unit_id = None
        branch_id = None

    vendor_meta: Dict[UUID, Dict[str, str]] = {}
    if include_vendor_meta or not single_vendor:
        rows = (
            await db.execute(select(Vendor).where(Vendor.id.in_(vendor_ids)))
        ).scalars().all()
        for v in rows:
            vendor_meta[v.id] = {
                "vendor_id": str(v.id),
                "vendor_slug": v.slug or "",
                "vendor_name": v.display_name or v.business_name or v.slug or str(v.id),
            }

    events = (
        await db.execute(
            select(CrmJourneyEvent).where(
                CrmJourneyEvent.vendor_id.in_(vendor_ids),
                CrmJourneyEvent.event_type == "page_view",
                CrmJourneyEvent.occurred_at >= since,
            )
        )
    ).scalars().all()

    # Page key: path only for single vendor; (vendor_id, path) when multi.
    page_views: Dict[Any, int] = defaultdict(int)
    page_visitors: Dict[Any, Set[str]] = defaultdict(set)
    page_realtime_visitors: Dict[Any, Set[str]] = defaultdict(set)
    # Product journey: (vendor_id, slug) -> views
    product_journey_views: Dict[tuple, int] = defaultdict(int)
    all_visitors: Set[str] = set()
    matched_events = 0

    for ev in events:
        payload = ev.payload if isinstance(ev.payload, dict) else {}
        raw_path = payload.get("path") or ""
        path, branch_param = parse_path_and_branch(raw_path)
        if not path:
            continue
        if not event_matches_branch(branch_param, allowed_branches):
            continue

        matched_events += 1
        key = path if single_vendor and not include_vendor_meta else (ev.vendor_id, path)
        page_views[key] += 1
        visitor = (ev.visitor_id or "").strip() or f"anon:{ev.id}"
        page_visitors[key].add(visitor)
        all_visitors.add(visitor)

        occurred = ev.occurred_at
        if occurred and occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=timezone.utc)
        if occurred and occurred >= realtime_since:
            page_realtime_visitors[key].add(visitor)

        slug = product_slug_from_path(path)
        if slug:
            product_journey_views[(ev.vendor_id, slug)] += 1

    pages: List[Dict[str, Any]] = []
    for key, views in page_views.items():
        if isinstance(key, tuple):
            vid, path = key
            meta = vendor_meta.get(vid, {})
            row: Dict[str, Any] = {
                "path": path,
                "views": views,
                "unique_visitors": len(page_visitors[key]),
                "active_users": len(page_realtime_visitors.get(key, set())),
                **meta,
            }
        else:
            row = {
                "path": key,
                "views": views,
                "unique_visitors": len(page_visitors[key]),
                "active_users": len(page_realtime_visitors.get(key, set())),
            }
            if include_vendor_meta and single_vendor:
                row.update(vendor_meta.get(vendor_ids[0], {}))
        pages.append(row)
    pages.sort(key=lambda r: (-r["active_users"], -r["views"], r["path"]))
    pages = pages[:limit]

    products_out: List[Dict[str, Any]] = []
    scoped = allowed_branches is not None

    if not scoped:
        prod_q = (
            select(Product)
            .options(selectinload(Product.images))
            .where(
                Product.vendor_id.in_(vendor_ids),
                Product.is_visible.is_(True),
            )
            .order_by(Product.view_count.desc().nullslast(), Product.created_at.desc())
            .limit(limit)
        )
        products = (await db.execute(prod_q)).scalars().all()
        for p in products:
            item: Dict[str, Any] = {
                "id": str(p.id),
                "name": p.name,
                "slug": p.slug,
                "view_count": int(p.view_count or 0),
                "image_url": _product_image_url(p),
                "source": "catalog",
            }
            if include_vendor_meta or not single_vendor:
                item.update(vendor_meta.get(p.vendor_id, {
                    "vendor_id": str(p.vendor_id),
                    "vendor_slug": "",
                    "vendor_name": "",
                }))
            products_out.append(item)

        total_row = await db.execute(
            select(Product.view_count).where(
                Product.vendor_id.in_(vendor_ids),
                Product.is_visible.is_(True),
            )
        )
        total_product_views = sum(int(v or 0) for (v,) in total_row.all())
    else:
        pairs = list(product_journey_views.keys())
        by_key: Dict[tuple, Product] = {}
        if pairs:
            vids = {vid for vid, _ in pairs}
            slugs = {slug for _, slug in pairs}
            rows = (
                await db.execute(
                    select(Product)
                    .options(selectinload(Product.images))
                    .where(
                        Product.vendor_id.in_(vids),
                        Product.slug.in_(slugs),
                    )
                )
            ).scalars().all()
            by_key = {(p.vendor_id, p.slug): p for p in rows if p.slug}

        ranked = sorted(product_journey_views.items(), key=lambda x: -x[1])[:limit]
        for (vid, slug), views in ranked:
            p = by_key.get((vid, slug))
            item = {
                "id": str(p.id) if p else None,
                "name": p.name if p else slug,
                "slug": slug,
                "view_count": views,
                "image_url": _product_image_url(p),
                "source": "journey",
            }
            if include_vendor_meta or not single_vendor:
                item.update(vendor_meta.get(vid, {
                    "vendor_id": str(vid),
                    "vendor_slug": "",
                    "vendor_name": "",
                }))
            products_out.append(item)
        total_product_views = sum(int(p.get("view_count") or 0) for p in products_out)

    return {
        "summary": {
            "total_page_views": matched_events,
            "unique_visitors": len(all_visitors),
            "total_product_views": total_product_views,
            "pages_tracked": len(page_views),
            "realtime_active_users": sum(len(v) for v in page_realtime_visitors.values()),
        },
        "pages": pages,
        "products": products_out,
        "filters": {
            "vendor_ids": [str(v) for v in vendor_ids],
            "business_unit_id": str(business_unit_id) if business_unit_id else None,
            "branch_id": str(branch_id) if branch_id else None,
            "days": days,
            "limit": limit,
        },
    }
