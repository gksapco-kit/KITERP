"""
Public Sites API — unauthenticated read-only endpoints for the business front renderer.

These endpoints serve published website builder content to visitor browsers
without requiring a login token. Vendor resolution is done either by:
  1. Explicit site_id (looked up and ownership verified)
  2. Subdomain path param (resolved via vendor.subdomain column)

All data is soft-cached in Redis (60 s TTL) to avoid hammering the DB.
"""
from __future__ import annotations

import json
import uuid as _uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.database import get_db, redis_client
from app.models.website import (
    WebsiteSite,
    WebsitePage,
    WebsiteBlock,
    WebsiteMedia,
    WebsiteFormSubmission,
    WebsiteWebhook,
    WebsiteBuilderPreview,
)

router = APIRouter(redirect_slashes=False)


# ── helpers ──────────────────────────────────────────────────────────────────

def _block_out(b: WebsiteBlock) -> Dict[str, Any]:
    return {
        "id": str(b.id),
        "page_id": str(b.page_id),
        "block_type": b.block_type,
        "label": b.label,
        "props": b.props or {},
        "style_overrides": b.style_overrides or {},
        "visible": b.visible,
        "visible_on_mobile": b.visible_on_mobile,
        "visible_on_tablet": b.visible_on_tablet,
        "visible_on_desktop": b.visible_on_desktop,
        "animation": b.animation,
        "animation_delay": b.animation_delay or 0,
        "sort_order": b.sort_order or 0,
        "visible_branches": (b.props or {}).get("_visible_branches") or [],
    }


def _page_out(p: WebsitePage, include_blocks: bool = True) -> Dict[str, Any]:
    blocks = []
    if include_blocks and p.blocks:
        blocks = [_block_out(b) for b in sorted(p.blocks, key=lambda x: (x.sort_order or 0)) if b.visible]
    return {
        "id": str(p.id),
        "site_id": str(p.site_id),
        "title": p.title,
        "slug": p.slug,
        "page_type": p.page_type,
        "seo_title": p.seo_title,
        "seo_description": p.seo_description,
        "og_image_url": p.og_image_url,
        "layout": p.layout,
        "sort_order": p.sort_order or 0,
        "is_published": p.is_published,
        "is_homepage": p.is_homepage,
        "show_in_nav": p.show_in_nav,
        "blocks": blocks,
    }


def _site_out(site: WebsiteSite, pages: Optional[List[WebsitePage]] = None) -> Dict[str, Any]:
    pages_data = []
    if pages is not None:
        pages_data = [_page_out(p) for p in sorted(pages, key=lambda x: (x.sort_order or 0)) if p.is_published and not p.deleted_at]
    return {
        "id": str(site.id),
        "vendor_id": str(site.vendor_id),
        "name": site.name,
        "subdomain": site.subdomain,
        "custom_domain": site.custom_domain,
        "description": site.description,
        "favicon_url": site.favicon_url,
        "logo_url": site.logo_url,
        "style_config": site.style_config or {},
        "seo_title": site.seo_title,
        "seo_description": site.seo_description,
        "seo_keywords": site.seo_keywords,
        "og_image_url": site.og_image_url,
        "is_published": site.is_published,
        "status": site.status,
        "google_analytics_id": site.google_analytics_id,
        "meta_pixel_id": site.meta_pixel_id,
        "custom_head_code": site.custom_head_code,
        "custom_body_code": site.custom_body_code,
        "language": site.language,
        "languages_enabled": site.languages_enabled,
        "currency": site.currency,
        "currencies_enabled": site.currencies_enabled,
        "currency_symbol": site.currency_symbol,
        "currency_position": site.currency_position,
        "location": site.location,
        "timezone": site.timezone,
        "pages": pages_data,
        "updated_at": site.updated_at.isoformat() if site.updated_at else None,
    }


async def _cached_get(cache_key: str) -> Optional[Dict]:
    if redis_client:
        try:
            raw = await redis_client.get(cache_key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return None


async def _cached_set(cache_key: str, data: Dict, ttl: int = 60) -> None:
    if redis_client:
        try:
            await redis_client.set(cache_key, json.dumps(data, default=str), ex=ttl)
        except Exception:
            pass


def _settings_str(settings: Optional[Dict[str, Any]], key: str) -> Optional[str]:
    raw = (settings or {}).get(key)
    return raw.strip() if isinstance(raw, str) and raw.strip() else None


def _resolve_template_mode(vendor_settings: Optional[Dict[str, Any]]) -> str:
    vendor_settings = vendor_settings or {}
    mode = vendor_settings.get("storefront_template_mode")
    if mode not in ("single", "per_unit"):
        mode = "single" if vendor_settings.get("storefront_link_mode") == "single" else "per_unit"
    return mode


def _resolve_effective_template_id(
    vendor_settings: Optional[Dict[str, Any]],
    store_settings: Optional[Dict[str, Any]],
) -> Optional[str]:
    """
    Mirror of the vendor/storefront `resolveEffectiveStorefrontTemplateId`.

    A non-empty result means a catalog/legacy template is assigned and must
    override any linked builder site for the branch.
    """
    if _resolve_template_mode(vendor_settings) == "single":
        return _settings_str(vendor_settings, "single_front_template_id")
    return (
        _settings_str(store_settings, "front_template_id")
        or _settings_str(vendor_settings, "single_front_template_id")
    )


def _store_specific_template_id(
    vendor_settings: Optional[Dict[str, Any]],
    store_settings: Optional[Dict[str, Any]],
) -> Optional[str]:
    """
    A catalog/legacy template explicitly assigned to *this* branch (or the
    shared template in `single` mode). Unlike `_resolve_effective_template_id`,
    this does NOT include the vendor-wide `single_front_template_id` fallback in
    `per_unit` mode — so a builder site linked to the store wins over that
    fallback. Only an explicit per-store assignment overrides the linked site.
    """
    if _resolve_template_mode(vendor_settings) == "single":
        return _settings_str(vendor_settings, "single_front_template_id")
    return _settings_str(store_settings, "front_template_id")


def _site_scope(site: WebsiteSite) -> str:
    """Normalised `website_store_scope` for a site: ``store`` | ``all`` | ``external`` | ``""``."""
    return str((site.style_config or {}).get("website_store_scope") or "").strip().lower()


def _site_is_store_scoped(site: WebsiteSite) -> bool:
    sc = site.style_config or {}
    return _site_scope(site) == "store" and bool(sc.get("website_store_id"))


async def _resolve_site_by_subdomain(
    subdomain: str,
    db: AsyncSession,
    branch: Optional[str] = None,
) -> Optional[WebsiteSite]:
    """
    Resolve which published site a visitor should see.

    When a `branch` (business unit code or id) is provided, the site linked to
    that specific store wins, so each business unit shows its own assigned
    storefront. A catalog/legacy template assigned to the branch overrides any
    linked builder site (returns None so the catalog/legacy renderer takes over).
    Falls back to the vendor's default (non store-scoped) published site.
    """
    from app.models.vendor import Vendor
    from app.models.store import Store

    vendor_res = await db.execute(select(Vendor).where(Vendor.subdomain == subdomain))
    vendor = vendor_res.scalar_one_or_none()
    if not vendor:
        return None

    sites_res = await db.execute(
        select(WebsiteSite)
        .options(selectinload(WebsiteSite.pages).selectinload(WebsitePage.blocks))
        .where(
            WebsiteSite.vendor_id == vendor.id,
            WebsiteSite.is_published == True,
        )
        .order_by(WebsiteSite.published_at.desc())
    )
    sites = list(sites_res.scalars().all())
    if not sites:
        return None

    def _linked_site_for_store(store_id: str) -> Optional[WebsiteSite]:
        for s in sites:
            sc = s.style_config or {}
            if sc.get("website_store_scope") == "store" and str(sc.get("website_store_id") or "") == store_id:
                return s
        return None

    def _shared_default_site() -> Optional[WebsiteSite]:
        """
        The shared/global customer storefront site.

        Never an `external` site (marketing/portfolio sites live on their own
        custom domain and are "not tied to a store", so they must not hijack the
        customer store subdomain). Only a non store-scoped ("all stores"/legacy)
        site qualifies, so a store-specific site never leaks onto the shared URL.
        """
        return next(
            (
                s for s in sites
                if _site_scope(s) != "external" and not _site_is_store_scoped(s)
            ),
            None,
        )

    branch_key = (branch or "").strip().lower()
    if branch_key:
        store_res = await db.execute(select(Store).where(Store.vendor_id == vendor.id))
        store = next(
            (
                st for st in store_res.scalars().all()
                if (st.code or "").strip().lower() == branch_key or str(st.id).lower() == branch_key
            ),
            None,
        )
        if store is not None:
            # An explicit per-store (or single-mode shared) catalog/legacy
            # template overrides any builder site linked to this branch.
            if _store_specific_template_id(vendor.settings, store.settings):
                return None
            # A builder site linked to this branch wins over the vendor-wide
            # `single_front_template_id` fallback used in per_unit mode.
            linked = _linked_site_for_store(str(store.id))
            if linked is not None:
                return linked
            # No per-store builder site: honour the vendor-wide template fallback.
            if _resolve_effective_template_id(vendor.settings, store.settings):
                return None
            # Nothing assigned for this branch → use the shared/global default.
            # Never serve a *different* store's store-scoped site for this
            # branch; only an "all stores" (or legacy) site may stand in.
            return _shared_default_site()

    # No branch (or an unknown branch): the shared/global customer storefront.
    shared = _shared_default_site()
    if shared is not None:
        return shared
    # Single-store vendors only ever have a store-scoped site — still serve it
    # on the bare URL. If only external sites exist, return None so the
    # catalog/legacy renderer takes over.
    return next(
        (s for s in sites if _site_scope(s) != "external" and _site_is_store_scoped(s)),
        None,
    )


async def _load_site_full(site_id: str, db: AsyncSession) -> Optional[WebsiteSite]:
    result = await db.execute(
        select(WebsiteSite)
        .options(
            selectinload(WebsiteSite.pages).selectinload(WebsitePage.blocks)
        )
        .where(WebsiteSite.id == UUID(site_id), WebsiteSite.is_published == True)
    )
    return result.scalar_one_or_none()


def _norm_item(**kw) -> Dict[str, Any]:
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


# ── Public site endpoints ─────────────────────────────────────────────────────

def _public_site_dict_from_template(tpl: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build the same shape as _site_out() from a WEBSITE_TEMPLATES preset dict
    for unauthenticated template browser preview (no DB rows).
    """
    import uuid as _uuid

    template_id = str(tpl.get("id") or "unknown")
    site_id = str(_uuid.uuid5(_uuid.NAMESPACE_URL, f"wb-template-preview:{template_id}"))
    vendor_id = str(_uuid.uuid5(_uuid.NAMESPACE_URL, "wb-template-preview-vendor"))

    style = tpl.get("default_style") or tpl.get("style_config") or {}
    if not isinstance(style, dict):
        style = {}

    pages_out: List[Dict[str, Any]] = []
    for p_idx, p_tpl in enumerate(tpl.get("pages") or []):
        slug = p_tpl.get("slug") or "page"
        page_id = str(
            _uuid.uuid5(
                _uuid.NAMESPACE_URL,
                f"wb-template-preview:{template_id}:page:{slug}:{p_idx}",
            )
        )
        blocks_out: List[Dict[str, Any]] = []
        for b_idx, b_tpl in enumerate(p_tpl.get("blocks") or []):
            b_type = b_tpl.get("block_type")
            if not b_type:
                continue
            bid = str(_uuid.uuid4())
            _props = dict(b_tpl.get("props") or {})
            if not isinstance(_props, dict):
                _props = {}
            # Auto-wire live data source so template previews show vendor's
            # real catalog / profile instead of static placeholder content.
            from app.api.v1.vendor_websites import BLOCK_AUTO_SOURCE as _BAS
            auto_src = _BAS.get(b_type)
            if auto_src and "data_source" not in _props:
                _props["data_source"] = {"type": auto_src, "auto": True}
            blocks_out.append(
                {
                    "id": bid,
                    "page_id": page_id,
                    "block_type": b_type,
                    "label": b_tpl.get("label"),
                    "props": _props,
                    "style_overrides": b_tpl.get("style_overrides") or {},
                    "visible": True,
                    "visible_on_mobile": True,
                    "visible_on_tablet": True,
                    "visible_on_desktop": True,
                    "animation": b_tpl.get("animation"),
                    "animation_delay": int(b_tpl.get("animation_delay") or 0),
                    "sort_order": b_idx,
                    "visible_branches": _props.get("_visible_branches") or [],
                }
            )
        pages_out.append(
            {
                "id": page_id,
                "site_id": site_id,
                "title": p_tpl.get("title") or "Page",
                "slug": slug,
                "page_type": p_tpl.get("page_type", "custom"),
                "seo_title": p_tpl.get("seo_title"),
                "seo_description": p_tpl.get("seo_description"),
                "og_image_url": p_tpl.get("og_image_url"),
                "layout": p_tpl.get("layout", "full"),
                "sort_order": p_idx,
                "is_published": p_tpl.get("is_published", True),
                "is_homepage": p_tpl.get("is_homepage", p_idx == 0),
                "show_in_nav": p_tpl.get("show_in_nav", True),
                "blocks": blocks_out,
            }
        )

    return {
        "id": site_id,
        "vendor_id": vendor_id,
        "name": tpl.get("name") or "Template preview",
        "subdomain": None,
        "custom_domain": None,
        "description": tpl.get("description"),
        "favicon_url": None,
        "logo_url": None,
        "style_config": style,
        "seo_title": None,
        "seo_description": None,
        "seo_keywords": None,
        "og_image_url": tpl.get("thumbnail"),
        "is_published": True,
        "status": "published",
        "google_analytics_id": None,
        "meta_pixel_id": None,
        "custom_head_code": None,
        "custom_body_code": None,
        "language": "en",
        "languages_enabled": ["en"],
        "currency": "USD",
        "currencies_enabled": ["USD"],
        "currency_symbol": "$",
        "currency_position": "before",
        "location": None,
        "timezone": "UTC",
        "pages": pages_out,
        "updated_at": None,
    }


@router.get("/website-template/{template_id}/preview")
async def get_website_template_preview(template_id: str):
    """
    Unauthenticated: return a synthetic `PublicSite` JSON for a catalog template,
    for opening a full browser preview (business front BlockRenderer) before apply.
    """
    from app.api.v1.vendor_websites import WEBSITE_TEMPLATES

    tpl = WEBSITE_TEMPLATES.get(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return _public_site_dict_from_template(dict(tpl))


@router.get("/preview/by-token/{token}")
async def get_builder_preview_by_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Unauthenticated: return a frozen JSON snapshot of a site saved from the vendor
    builder (same shape as the published public site payload). Opaque token only.
    """
    if not token or len(token) > 128:
        raise HTTPException(status_code=400, detail="Invalid preview token")

    result = await db.execute(
        select(WebsiteBuilderPreview).where(WebsiteBuilderPreview.preview_token == token)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Preview not found")
    return row.payload


@router.get("/by-subdomain/{subdomain}")
async def get_site_by_subdomain(
    subdomain: str,
    branch: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Return the published site + all published pages + blocks for a subdomain.
    Used by the business front on page load to determine what to render.

    The optional `branch` (business unit code or id) selects the site linked to
    that specific store so each business unit renders its own storefront.
    """
    branch_key = (branch or "").strip()
    cache_key = (
        f"pub_site:subdomain:{subdomain}:branch:{branch_key}"
        if branch_key
        else f"pub_site:subdomain:{subdomain}"
    )
    cached = await _cached_get(cache_key)
    if cached:
        return cached

    site = await _resolve_site_by_subdomain(subdomain, db, branch=branch_key or None)
    if not site:
        raise HTTPException(status_code=404, detail="No published site found for this subdomain")

    data = _site_out(site, pages=list(site.pages or []))
    await _cached_set(cache_key, data, ttl=60)
    return data


@router.get("/{site_id}/pages/{slug}")
async def get_page_by_slug(
    site_id: str,
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Return a single published page by slug."""
    site = await _load_site_full(site_id, db)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found or not published")

    if slug in ("", "home", "/"):
        page = next((p for p in (site.pages or []) if p.is_homepage and p.is_published and not p.deleted_at), None)
    else:
        page = next((p for p in (site.pages or []) if p.slug == slug and p.is_published and not p.deleted_at), None)

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    return _page_out(page)


@router.get("/{site_id}/info")
async def get_site_info(
    site_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lightweight site metadata (no blocks) — used for analytics/head injection."""
    cache_key = f"pub_site:info:{site_id}"
    cached = await _cached_get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(WebsiteSite).where(WebsiteSite.id == UUID(site_id), WebsiteSite.is_published == True)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    data = _site_out(site, pages=None)
    await _cached_set(cache_key, data, ttl=120)
    return data


# ── Live data feed (public, vendor resolved from site_id) ─────────────────────

@router.get("/{site_id}/live/{resource}")
async def get_live_resource_public(
    site_id: str,
    resource: str,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
):
    """
    Public live data feed — same shape as the authenticated /live/{resource}
    endpoint on the vendor side but resolved through site_id rather than auth.
    """
    cache_key = f"pub_live:{site_id}:{resource}:{limit}"
    cached = await _cached_get(cache_key)
    if cached:
        return cached

    # Resolve vendor from site
    result = await db.execute(
        select(WebsiteSite)
        .options(selectinload(WebsiteSite.pages))
        .where(WebsiteSite.id == UUID(site_id), WebsiteSite.is_published == True)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Load vendor
    from app.models.vendor import Vendor
    vendor_res = await db.execute(select(Vendor).where(Vendor.id == site.vendor_id))
    vendor = vendor_res.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    limit = max(1, min(limit, 200))
    items: List[Dict[str, Any]] = []

    if resource == "products":
        from app.models.vendor_product import Product, ProductImage
        q = (
            select(Product)
            .options(selectinload(Product.images))
            .where(Product.vendor_id == vendor.id, Product.is_visible.is_(True))
            .order_by(Product.is_featured.desc(), Product.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        for p in rows:
            img = None
            if p.images:
                primary = next((i for i in p.images if i.is_primary), None) or p.images[0]
                img = primary.url
            items.append(_norm_item(
                id=str(p.id),
                title=p.name or "",
                subtitle=p.brand,
                description=p.short_description or p.description,
                image_url=img,
                price=float(p.price) if p.price is not None else None,
                price_formatted=(f"{p.currency or 'INR'} {float(p.price):,.0f}" if p.price is not None else None),
                url=f"/products/{p.slug}" if p.slug else None,
                meta={
                    "sku": p.sku,
                    "category": p.category,
                    "stock_status": p.stock_status,
                    "quantity": p.quantity,
                    "is_featured": p.is_featured,
                    "is_on_sale": p.is_on_sale,
                    "discount_percentage": float(p.discount_percentage) if p.discount_percentage is not None else None,
                    "compare_at_price": float(p.compare_at_price) if p.compare_at_price is not None else None,
                    "currency": p.currency,
                    "offer_label": p.offer_label,
                },
            ))

    elif resource == "services":
        from app.models.vendor_service import Service
        q = (
            select(Service)
            .where(Service.vendor_id == vendor.id)
            .order_by(Service.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        for s in rows:
            items.append(_norm_item(
                id=str(s.id),
                title=s.name or "",
                subtitle=s.category,
                description=s.short_description or s.description,
                image_url=None,
                price=float(s.price) if s.price is not None else None,
                price_formatted=(f"{s.currency or 'INR'} {float(s.price):,.0f}" if s.price is not None else None),
                url=f"/services/{s.slug}" if s.slug else None,
                meta={
                    "duration_minutes": s.duration_minutes,
                    "service_mode": s.service_mode,
                    "category": s.category,
                    "price_type": s.price_type,
                    "price_min": float(s.price_min) if s.price_min is not None else None,
                    "price_max": float(s.price_max) if s.price_max is not None else None,
                    "currency": s.currency,
                    "requires_booking": bool(s.requires_booking),
                },
            ))

    elif resource == "testimonials":
        from app.models.review import Review
        from app.models.customer import Customer
        q = (
            select(Review, Customer)
            .join(Customer, Customer.id == Review.customer_id)
            .where(
                Review.vendor_id == vendor.id,
                Review.is_visible.is_(True),
                Review.rating >= 4,
                Review.comment.isnot(None),
            )
            .order_by(Review.rating.desc(), Review.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).all()
        for rv, cust in rows:
            items.append(_norm_item(
                id=str(rv.id),
                title=cust.full_name or "Customer",
                subtitle=cust.company_name or None,
                description=rv.comment or rv.title or "",
                image_url=cust.avatar_url,
                rating=int(rv.rating) if rv.rating is not None else None,
                meta={
                    "review_title": rv.title,
                    "review_type": rv.review_type,
                    "is_verified_purchase": bool(rv.is_verified_purchase),
                    "created_at": rv.created_at.isoformat() if rv.created_at else None,
                },
            ))

    elif resource == "team":
        try:
            from app.models.hr import EmployeeProfile, Designation
            from app.models.user import User
            from app.models.vendor_user import VendorUser
            q = (
                select(EmployeeProfile, User, Designation)
                .join(VendorUser, VendorUser.id == EmployeeProfile.vendor_user_id)
                .join(User, User.id == VendorUser.user_id)
                .outerjoin(Designation, Designation.id == EmployeeProfile.designation_id)
                .where(
                    EmployeeProfile.vendor_id == vendor.id,
                    EmployeeProfile.is_active.is_(True),
                    EmployeeProfile.status == "active",
                )
                .order_by(EmployeeProfile.date_of_joining.asc().nullslast())
                .limit(limit)
            )
            rows = (await db.execute(q)).all()
            for emp, u, desig in rows:
                items.append(_norm_item(
                    id=str(emp.id),
                    title=u.full_name or u.email or "Team Member",
                    subtitle=(desig.name if desig else None),
                    description=emp.notes,
                    image_url=u.avatar_url,
                    meta={
                        "employee_code": emp.employee_code,
                        "employment_type": emp.employment_type,
                        "date_of_joining": emp.date_of_joining.isoformat() if emp.date_of_joining else None,
                    },
                ))
        except Exception:
            items = []

    elif resource == "categories":
        from app.services.category_live_feed import build_category_live_items
        items = await build_category_live_items(db, vendor.id, limit, _norm_item)

    elif resource == "pages":
        seen_urls: set[str] = set()
        for page in sorted(site.pages or [], key=lambda p: (not p.is_homepage, getattr(p, "sort_order", 0))):
            if getattr(page, "deleted_at", None) or not getattr(page, "is_published", True) or not getattr(page, "show_in_nav", True):
                continue
            slug = "/" if page.is_homepage else f"/{page.slug or ''}"
            if slug == "/home":
                slug = "/"
            if slug in seen_urls:
                continue
            seen_urls.add(slug)
            items.append(_norm_item(
                id=str(page.id),
                title="Home" if page.is_homepage else (page.title or "Page"),
                subtitle=page.slug,
                url=slug,
                meta={"is_homepage": bool(page.is_homepage), "slug": page.slug, "page_type": page.page_type},
            ))
            if len(items) >= limit:
                break

    elif resource == "profile":
        v = vendor
        addr = " ".join(filter(None, [v.street_address, v.city, v.state, v.postal_code, v.country]))
        meta = {
            "business_name": v.business_name,
            "display_name": v.display_name,
            "description": v.description,
            "email": v.primary_email,
            "support_email": v.support_email,
            "phone": v.primary_phone,
            "support_phone": v.support_phone,
            "address": addr,
            "city": v.city,
            "state": v.state,
            "country": v.country,
            "postal_code": v.postal_code,
            "logo_url": v.logo_url,
            "banner_url": v.banner_url,
            "subdomain": v.subdomain,
            "custom_domain": v.custom_domain,
            "social_links": v.social_links or {},
            "business_hours": v.business_hours or {},
            "latitude": float(v.latitude) if v.latitude is not None else None,
            "longitude": float(v.longitude) if v.longitude is not None else None,
        }
        items = [_norm_item(
            id=str(v.id),
            title=v.display_name or v.business_name or "",
            subtitle=v.industry,
            description=v.description,
            image_url=v.logo_url,
            meta=meta,
        )]

    elif resource == "kpis":
        from app.models.vendor_product import Product
        from app.models.vendor_service import Service
        from app.models.order import Order
        from app.models.customer import Customer
        from app.models.review import Review

        products_count = (await db.execute(select(func.count(Product.id)).where(Product.vendor_id == vendor.id))).scalar() or 0
        services_count = (await db.execute(select(func.count(Service.id)).where(Service.vendor_id == vendor.id))).scalar() or 0
        customers_count = (await db.execute(select(func.count(Customer.id)).where(Customer.vendor_id == vendor.id))).scalar() or 0
        orders_count = (await db.execute(select(func.count(Order.id)).where(Order.vendor_id == vendor.id))).scalar() or 0
        revenue = (await db.execute(
            select(func.coalesce(func.sum(Order.total), 0))
            .where(Order.vendor_id == vendor.id, Order.payment_status == "paid")
        )).scalar() or 0
        avg_rating = (await db.execute(
            select(func.coalesce(func.avg(Review.rating), 0))
            .where(Review.vendor_id == vendor.id, Review.is_visible.is_(True))
        )).scalar() or 0

        def _fmt(n: int) -> str:
            if n >= 1_000_000: return f"{n / 1_000_000:.1f}M+"
            if n >= 1_000: return f"{n / 1_000:.1f}K+"
            return str(int(n))

        items = [
            _norm_item(id="products", title=_fmt(products_count), subtitle="Products", meta={"value": int(products_count)}),
            _norm_item(id="services", title=_fmt(services_count), subtitle="Services", meta={"value": int(services_count)}),
            _norm_item(id="customers", title=_fmt(customers_count), subtitle="Happy Customers", meta={"value": int(customers_count)}),
            _norm_item(id="orders", title=_fmt(orders_count), subtitle="Orders Delivered", meta={"value": int(orders_count)}),
            _norm_item(id="revenue", title=f"₹{_fmt(int(revenue))}", subtitle="Revenue", meta={"value": float(revenue)}),
            _norm_item(id="rating", title=(f"{float(avg_rating):.1f}★" if avg_rating else "—"), subtitle="Average Rating", meta={"value": float(avg_rating)}),
        ]

    elif resource == "stores":
        from app.models.store import Store
        q = (
            select(Store)
            .where(Store.vendor_id == vendor.id, Store.is_active.is_(True))
            .order_by(Store.is_default.desc(), Store.name.asc())
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        for s in rows:
            addr = s.address or {}
            city = (addr or {}).get("city") if isinstance(addr, dict) else None
            state = (addr or {}).get("state") if isinstance(addr, dict) else None
            items.append(_norm_item(
                id=str(s.id),
                title=s.name or "",
                subtitle=", ".join(p for p in [city, state] if p) or s.code or None,
                description=s.description,
                url=(f"?branch={s.code}" if s.code else f"?branch={str(s.id)}"),
                meta={"code": s.code, "phone": s.phone, "email": s.email, "is_default": bool(s.is_default), "city": city, "state": state, "address": addr},
            ))

    else:
        raise HTTPException(status_code=400, detail=f"Unknown live resource: {resource}")

    result_data = {"resource": resource, "items": items, "count": len(items), "site_id": site_id}
    await _cached_set(cache_key, result_data, ttl=60)
    return result_data


# ── Public form submissions ───────────────────────────────────────────────────

@router.post("/{site_id}/live/contact")
async def submit_contact_public(
    site_id: str,
    body: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a contact form from a published business front page (no auth required).

    Side effects:
      1. Records a `wb_form_submissions` row so the vendor inbox shows it.
      2. Creates a `CrmLead` with the same payload (best-effort).
      3. Fires the `form.submitted` outgoing webhook so subscribers (Slack,
         Zapier, custom CRM) get notified.
    """
    result = await db.execute(
        select(WebsiteSite).where(WebsiteSite.id == UUID(site_id), WebsiteSite.is_published == True)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    page_id_raw = body.get("page_id") or body.get("_page_id")
    block_id_raw = body.get("block_id") or body.get("_block_id")
    form_type = (body.get("_form_type") or body.get("form_type") or "contact")[:50]
    gdpr_consent = bool(body.get("gdpr_consent") or body.get("consent") or False)

    def _try_uuid(v: Any) -> Optional[UUID]:
        if not v:
            return None
        try:
            return UUID(str(v))
        except Exception:
            return None

    payload_for_storage = {k: v for k, v in body.items() if not k.startswith("_")}

    # 1. Persist submission for the vendor inbox.
    submission = WebsiteFormSubmission(
        site_id=site.id,
        page_id=_try_uuid(page_id_raw),
        block_id=_try_uuid(block_id_raw),
        form_type=form_type,
        payload=payload_for_storage,
        gdpr_consent=gdpr_consent,
        ip_address=_client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:1000] or None,
    )
    db.add(submission)

    lead_id_str: Optional[str] = None
    try:
        from app.models.crm import CrmLead
        from app.services.crm.numbering import next_crm_number
        raw_name = (body.get("name") or "Website Visitor").strip()
        first, _, last = raw_name.partition(" ")
        lead = CrmLead(
            vendor_id=site.vendor_id,
            number=await next_crm_number(db, site.vendor_id, CrmLead, "LED"),
            first_name=(first or "Website")[:120],
            last_name=(last or "Visitor")[:120],
            email=(body.get("email") or None),
            phone=(body.get("phone") or None),
            notes=(body.get("message") or None),
            source="website",
            source_campaign=f"website:{site_id}",
            status="new",
            intake_payload=payload_for_storage,
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)
        await db.refresh(submission)
        lead_id_str = str(lead.id)
        submission.crm_lead_id = lead.id
        await db.commit()
    except Exception:
        await db.rollback()
        # CRM failed — keep the submission row so the inbox still receives it.
        try:
            db.add(submission)
            await db.commit()
            await db.refresh(submission)
        except Exception:
            await db.rollback()

    # 3. Fire form.submitted webhook (best-effort, after-commit).
    submission_id = str(submission.id) if submission.id else None
    await _dispatch_webhooks(
        db,
        site_id,
        "form.submitted",
        {
            "submission_id": submission_id,
            "form_type": form_type,
            "page_id": str(page_id_raw) if page_id_raw else None,
            "block_id": str(block_id_raw) if block_id_raw else None,
            "lead_id": lead_id_str,
            "submitted_at": datetime.utcnow().isoformat(),
            "payload": payload_for_storage,
        },
    )

    return {
        "ok": True,
        "submission_id": submission_id,
        "lead_id": lead_id_str,
    }


@router.get("/{site_id}/live/booking-slots")
async def public_booking_slots(
    site_id: str,
    service_id: str,
    booking_date: str,
    db: AsyncSession = Depends(get_db),
):
    """Public availability for website builder booking_slot_picker block."""
    from datetime import date as date_type
    from app.services.booking_service import BookingService

    result = await db.execute(
        select(WebsiteSite).where(WebsiteSite.id == UUID(site_id), WebsiteSite.is_published == True)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(404, "Site not found")
    try:
        svc_uuid = UUID(service_id)
        bdate = date_type.fromisoformat(booking_date)
    except ValueError:
        raise HTTPException(400, "Invalid service_id or booking_date")
    slots = await BookingService(db).get_available_slots(site.vendor_id, svc_uuid, bdate)
    return {"slots": slots, "date": booking_date}


@router.post("/{site_id}/live/booking")
async def public_create_booking(
    site_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Create a service booking from a published site (guest customer)."""
    from datetime import date as date_type
    from app.services.booking_service import BookingService
    from app.services.customer_service import CustomerService

    result = await db.execute(
        select(WebsiteSite).where(WebsiteSite.id == UUID(site_id), WebsiteSite.is_published == True)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(404, "Site not found")

    service_id = body.get("service_id")
    booking_date = body.get("booking_date") or body.get("date")
    start_time = body.get("start_time") or body.get("time")
    name = (body.get("name") or "Guest").strip()
    email = (body.get("email") or "").strip()
    phone = (body.get("phone") or "").strip() or None
    notes = body.get("notes") or body.get("message")

    if not service_id or not booking_date or not start_time:
        raise HTTPException(400, "service_id, booking_date, and start_time are required")
    if not email:
        raise HTTPException(400, "email is required for booking confirmation")

    customer = await CustomerService(db).get_or_create_guest(site.vendor_id, name, email, phone)
    booking = await BookingService(db).create(
        vendor_id=site.vendor_id,
        customer_id=customer.id,
        data={
            "service_id": service_id,
            "booking_date": booking_date,
            "start_time": start_time,
            "notes": notes,
            "customer_name": name,
            "customer_email": email,
            "customer_phone": phone,
        },
    )
    return {"ok": True, "booking_id": str(booking.id), "booking_number": booking.booking_number}


@router.post("/{site_id}/live/newsletter")
async def submit_newsletter_public(
    site_id: str,
    body: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Subscribe to the vendor's newsletter from a published page.

    Records the subscription as a `wb_form_submissions` row with
    `form_type='newsletter'`, fires `form.submitted`, and is idempotent on
    (site, email) so the same address will not flood the inbox.
    """
    result = await db.execute(
        select(WebsiteSite).where(WebsiteSite.id == UUID(site_id), WebsiteSite.is_published == True)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    email = (body.get("email") or "").strip().lower()
    if not email or "@" not in email or len(email) > 320:
        raise HTTPException(400, "Valid email required")

    # Idempotency: skip if we already have a recent newsletter row for this email.
    existing = await db.execute(
        select(WebsiteFormSubmission)
        .where(
            WebsiteFormSubmission.site_id == site.id,
            WebsiteFormSubmission.form_type == "newsletter",
            func.lower(func.coalesce(WebsiteFormSubmission.payload["email"].astext, "")) == email,
        )
        .limit(1)
    )
    already = existing.scalar_one_or_none()
    if already:
        return {
            "ok": True,
            "email": email,
            "subscribed_at": already.created_at.isoformat() if already.created_at else None,
            "already_subscribed": True,
        }

    submission = WebsiteFormSubmission(
        site_id=site.id,
        form_type="newsletter",
        payload={"email": email, **{k: v for k, v in body.items() if k != "email" and not k.startswith("_")}},
        gdpr_consent=bool(body.get("gdpr_consent") or body.get("consent") or False),
        ip_address=_client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:1000] or None,
    )
    db.add(submission)
    try:
        await db.commit()
        await db.refresh(submission)
    except Exception:
        await db.rollback()

    submission_id = str(submission.id) if submission.id else None
    await _dispatch_webhooks(
        db,
        site_id,
        "form.submitted",
        {
            "submission_id": submission_id,
            "form_type": "newsletter",
            "email": email,
            "submitted_at": datetime.utcnow().isoformat(),
        },
    )

    return {
        "ok": True,
        "email": email,
        "subscribed_at": datetime.utcnow().isoformat(),
        "submission_id": submission_id,
    }


# ── Robots.txt + Sitemap (P2.6) ───────────────────────────────────────────────

@router.get("/by-subdomain/{subdomain}/robots.txt")
async def get_robots_txt(
    subdomain: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve robots.txt for a published site."""
    site = await _resolve_site_by_subdomain(subdomain, db)
    if not site:
        raise HTTPException(404, "Site not found")

    # Check for custom robots_txt in style_config or use default
    custom_robots = (site.style_config or {}).get("robots_txt")
    base_url = f"https://{site.custom_domain}" if site.custom_domain else f"https://{subdomain}.kiterp.com"
    default_robots = f"""User-agent: *
Allow: /

Sitemap: {base_url}/sitemap.xml
"""
    content = custom_robots if custom_robots else default_robots
    return Response(content=content, media_type="text/plain")


@router.get("/by-subdomain/{subdomain}/sitemap.xml")
async def get_sitemap_xml(
    subdomain: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate a dynamic sitemap.xml from published pages."""
    site = await _resolve_site_by_subdomain(subdomain, db)
    if not site:
        raise HTTPException(404, "Site not found")

    base_url = f"https://{site.custom_domain}" if site.custom_domain else f"https://{subdomain}.kiterp.com"

    urls = []
    for page in (site.pages or []):
        if not page.is_published or page.deleted_at:
            continue
        slug = "/" if page.is_homepage else f"/{page.slug}"
        loc = f"{base_url}{slug}"
        updated = (page.updated_at or page.created_at or datetime.utcnow()).strftime("%Y-%m-%d")
        urls.append(f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{updated}</lastmod>
    <changefreq>{'daily' if page.is_homepage else 'weekly'}</changefreq>
    <priority>{'1.0' if page.is_homepage else '0.8'}</priority>
  </url>""")

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls) + "\n</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


# ── Cache invalidation helper (called from publish handler) ───────────────────

async def invalidate_site_cache(subdomain: Optional[str], site_id: str) -> None:
    """Call this after publishing a site to clear the 60-s public cache."""
    if not redis_client:
        return
    try:
        if subdomain:
            # Clear the shared key plus every per-branch variant for this subdomain.
            await redis_client.delete(f"pub_site:subdomain:{subdomain}")
            async for key in redis_client.scan_iter(f"pub_site:subdomain:{subdomain}:branch:*"):
                await redis_client.delete(key)
        await redis_client.delete(f"pub_site:info:{site_id}")
        # Flush all live resource caches for this site
        async for key in redis_client.scan_iter(f"pub_live:{site_id}:*"):
            await redis_client.delete(key)
    except Exception:
        pass


async def _dispatch_webhooks(db: AsyncSession, site_id: str, event: str, payload: Dict[str, Any]) -> None:
    """
    Fire any active outgoing webhooks for an event. Best-effort: failures
    update last_status_code but never raise to the caller. Mirrors the
    helper in vendor_websites.py so public-side flows can dispatch too.
    """
    import hashlib
    import hmac as hmac_mod
    try:
        result = await db.execute(
            select(WebsiteWebhook).where(
                WebsiteWebhook.site_id == UUID(site_id),
                WebsiteWebhook.event == event,
                WebsiteWebhook.is_active == True,  # noqa: E712
            )
        )
        hooks = result.scalars().all()
    except Exception:
        return
    if not hooks:
        return

    import httpx
    body = {"event": event, "site_id": site_id, **payload}
    body_bytes = json.dumps(body, default=str).encode()

    for wh in hooks:
        sig = ""
        if wh.secret:
            sig = hmac_mod.new(wh.secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    wh.url,
                    content=body_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Event": event,
                        "X-Webhook-Signature": sig,
                    },
                )
            wh.last_status_code = resp.status_code
        except Exception:
            wh.last_status_code = 0
        wh.last_triggered_at = datetime.utcnow()

    try:
        await db.commit()
    except Exception:
        await db.rollback()


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


# ── Public business front checkout ────────────────────────────────────────────────

from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field
from app.models.customer import Customer
from app.models.order import Order


class _MoneyIn(BaseModel):
    amount: int  # minor units (cents)
    currency: str = "USD"


class _CartItemIn(BaseModel):
    id: str
    product_id: str
    variant_id: Optional[str] = None
    name: str
    variant_label: Optional[str] = None
    image_url: Optional[str] = None
    unit_price: _MoneyIn
    quantity: int
    sku: Optional[str] = None


class _AddressIn(BaseModel):
    full_name: str
    line1: str
    line2: Optional[str] = None
    city: str
    region: str
    postal_code: str
    country: str = "US"
    phone: Optional[str] = None


class _CustomerIn(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_guest: bool = True


class StorefrontOrderRequest(BaseModel):
    customer: _CustomerIn
    shipping_address: _AddressIn
    items: List[_CartItemIn]
    shipping_method_id: str = "standard"
    shipping_amount: int = 499  # minor units
    payment_method: str = "card"
    notes: Optional[str] = None
    coupon_code: Optional[str] = None


SHIPPING_LABELS: Dict[str, str] = {
    "standard": "Standard shipping (5–7 days)",
    "express": "Express shipping (2–3 days)",
    "overnight": "Overnight",
    "pickup": "Store pickup",
}


@router.post("/sites/{site_id}/storefront/orders")
async def place_storefront_order(
    site_id: str,
    body: StorefrontOrderRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — place an order from the business front checkout.
    No authentication required (guest checkout supported).
    """
    # 1. Resolve vendor from site
    try:
        site_uuid = UUID(site_id)
    except ValueError:
        raise HTTPException(400, "Invalid site_id")

    result = await db.execute(select(WebsiteSite).where(WebsiteSite.id == site_uuid))
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(404, "Site not found")

    vendor_id: UUID = site.vendor_id

    # 2. Look up or create a guest customer for this vendor/email
    c_result = await db.execute(
        select(Customer).where(
            Customer.vendor_id == vendor_id,
            Customer.email == body.customer.email,
        )
    )
    customer = c_result.scalar_one_or_none()

    if not customer:
        full_name = " ".join(filter(None, [body.customer.first_name, body.customer.last_name])) or body.customer.email
        customer = Customer(
            vendor_id=vendor_id,
            full_name=full_name,
            email=body.customer.email,
            phone=body.customer.phone,
            password_hash="",  # guest — no password
        )
        db.add(customer)
        await db.flush()

    # 3. Build order snapshot
    subtotal_minor = sum(i.unit_price.amount * i.quantity for i in body.items)
    subtotal = Decimal(subtotal_minor) / 100
    tax = (subtotal * Decimal("0.08875")).quantize(Decimal("0.01"))
    shipping = Decimal(body.shipping_amount) / 100
    total = subtotal + tax + shipping

    currency = body.items[0].unit_price.currency if body.items else "USD"

    items_snapshot = [
        {
            "product_id": i.product_id,
            "variant_id": i.variant_id,
            "name": i.name,
            "variant_label": i.variant_label,
            "image_url": i.image_url,
            "sku": i.sku,
            "quantity": i.quantity,
            "unit_price": i.unit_price.amount / 100,
            "line_total": i.unit_price.amount * i.quantity / 100,
            "currency": i.unit_price.currency,
        }
        for i in body.items
    ]

    # Generate order number
    ts = datetime.utcnow().strftime("%y%m%d%H%M%S")
    order_number = f"SF-{ts}"

    shipping_address_snapshot = {
        "full_name": body.shipping_address.full_name,
        "line1": body.shipping_address.line1,
        "line2": body.shipping_address.line2,
        "city": body.shipping_address.city,
        "region": body.shipping_address.region,
        "postal_code": body.shipping_address.postal_code,
        "country": body.shipping_address.country,
        "phone": body.shipping_address.phone,
    }

    # 4. Persist order
    from app.services.store_resolver import resolve_store_id as _resolve_txn_store_id
    sf_store_id = await _resolve_txn_store_id(db, vendor_id)
    order = Order(
        order_number=order_number,
        vendor_id=vendor_id,
        customer_id=customer.id,
        store_id=sf_store_id,
        items=items_snapshot,
        item_count=sum(i.quantity for i in body.items),
        subtotal=subtotal,
        tax_amount=tax,
        discount_amount=Decimal("0"),
        shipping_amount=shipping,
        total=total,
        status="pending",
        payment_status="pending",
        payment_method=body.payment_method,
        shipping_address=shipping_address_snapshot,
        notes=body.notes or "",
        source="online",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return {
        "ok": True,
        "order_id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "total": float(order.total),
        "currency": currency,
    }
