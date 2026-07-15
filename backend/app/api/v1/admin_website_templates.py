"""
Admin — All Templates (curate vendor website-builder designs into the shared catalog).
"""
from __future__ import annotations

import json
import secrets
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_platform_staff, get_current_superuser
from app.database import get_db
from app.models.user import User
from app.models.website import WebsiteBuilderPreview, WebsitePage, WebsiteSite
from app.services import platform_website_templates as pwt

router = APIRouter()

MAX_BUILDER_PREVIEW_BYTES = 2 * 1024 * 1024


class AdminTemplateStats(BaseModel):
    total: int
    assigned: int
    draft: int
    published: int
    needs_sync: int


class AdminTemplateRow(BaseModel):
    site_id: str
    name: str
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    vendor_id: str
    vendor_name: str
    vendor_email: Optional[str] = None
    site_status: str
    is_published: bool
    storefront_assigned: bool
    list_bucket: Literal["assigned", "draft"]
    page_count: int
    business_type: Optional[str] = None
    site_updated_at: Optional[datetime] = None
    content_updated_at: Optional[datetime] = None
    # Platform catalog linkage
    platform_template_id: Optional[str] = None
    platform_slug: Optional[str] = None
    catalog_status: Optional[Literal["draft", "published"]] = None
    catalog_published: bool = False
    needs_sync: bool = False
    last_synced_at: Optional[datetime] = None
    catalog_published_at: Optional[datetime] = None


class AdminTemplateListResponse(BaseModel):
    items: List[AdminTemplateRow]
    total: int
    stats: AdminTemplateStats


class AdminTemplateDetail(AdminTemplateRow):
    snapshot_preview: Optional[dict] = None
    page_titles: List[str] = []
    note: str = (
        "Publishing adds this design to Business Website Templates for every vendor. "
        "Deleting a published catalog entry does not change websites that already applied it."
    )


class AdminTemplatePreviewResponse(BaseModel):
    site_id: str
    preview_token: str
    vendor_slug: Optional[str] = None
    page_slug: Optional[str] = None


def _preview_block_out(block) -> Dict[str, Any]:
    return {
        "id": str(block.id),
        "page_id": str(block.page_id),
        "block_type": block.block_type,
        "label": block.label,
        "props": block.props or {},
        "style_overrides": block.style_overrides or {},
        "visible": block.visible if block.visible is not None else True,
        "visible_on_mobile": block.visible_on_mobile if block.visible_on_mobile is not None else True,
        "visible_on_tablet": block.visible_on_tablet if block.visible_on_tablet is not None else True,
        "visible_on_desktop": block.visible_on_desktop if block.visible_on_desktop is not None else True,
        "animation": block.animation,
        "animation_delay": block.animation_delay or 0,
        "sort_order": block.sort_order or 0,
        "visible_branches": (block.props or {}).get("_visible_branches") or [],
    }


def _preview_payload_from_site(site: WebsiteSite, vendor_slug: Optional[str]) -> Dict[str, Any]:
    """Public-site JSON shape for draft browser preview (includes unpublished draft pages)."""
    pages_data: List[Dict[str, Any]] = []
    for page in sorted(site.pages or [], key=lambda p: (p.sort_order or 0, str(p.id))):
        if page.deleted_at is not None:
            continue
        blocks = [
            _preview_block_out(b)
            for b in sorted(page.blocks or [], key=lambda x: (x.sort_order or 0, str(x.id)))
            if b.visible is not False
        ]
        pages_data.append(
            {
                "id": str(page.id),
                "site_id": str(page.site_id),
                "title": page.title,
                "slug": page.slug,
                "page_type": page.page_type,
                "seo_title": page.seo_title,
                "seo_description": page.seo_description,
                "og_image_url": page.og_image_url,
                "focus_keyword": page.focus_keyword,
                "seo_keywords": page.seo_keywords,
                "noindex": bool(page.noindex),
                "og_title": page.og_title,
                "og_description": page.og_description,
                "canonical_url": page.canonical_url,
                "schema_type": page.schema_type or "auto",
                "layout": page.layout,
                "sort_order": page.sort_order or 0,
                "is_published": True,
                "is_homepage": bool(page.is_homepage),
                "show_in_nav": page.show_in_nav if page.show_in_nav is not None else True,
                "blocks": blocks,
            }
        )
    return {
        "id": str(site.id),
        "vendor_id": str(site.vendor_id),
        "vendor_slug": vendor_slug,
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
        "is_published": True,
        "status": site.status or "draft",
        "google_analytics_id": site.google_analytics_id,
        "meta_pixel_id": site.meta_pixel_id,
        "custom_head_code": site.custom_head_code,
        "custom_body_code": site.custom_body_code,
        "language": site.language,
        "languages_enabled": site.languages_enabled or ["en"],
        "currency": site.currency,
        "currencies_enabled": site.currencies_enabled or ([site.currency] if site.currency else ["USD"]),
        "currency_symbol": site.currency_symbol,
        "currency_position": site.currency_position,
        "location": site.location,
        "timezone": site.timezone,
        "pages": pages_data,
        "updated_at": site.updated_at.isoformat() if site.updated_at else None,
    }


def _row_from(
    site: WebsiteSite,
    vendor_name: str,
    vendor_email: Optional[str],
    page_count: int,
    content_updated: datetime,
    platform,
    *,
    block_image: Optional[str] = None,
) -> AdminTemplateRow:
    sc = site.style_config if isinstance(site.style_config, dict) else {}
    bucket = pwt.assignment_bucket(site)
    catalog_status = platform.catalog_status if platform else None
    sync = bool(platform and pwt.needs_sync(platform, content_updated))
    thumbnail = pwt.resolve_site_card_thumbnail(site, platform, block_image=block_image)
    return AdminTemplateRow(
        site_id=str(site.id),
        name=site.name,
        description=site.description,
        thumbnail=thumbnail,
        vendor_id=str(site.vendor_id),
        vendor_name=vendor_name,
        vendor_email=vendor_email,
        site_status=site.status or "draft",
        is_published=bool(site.is_published),
        storefront_assigned=sc.get("storefront_assigned") is True,
        list_bucket="assigned" if bucket == "assigned" else "draft",
        page_count=page_count,
        business_type=sc.get("business_type"),
        site_updated_at=site.updated_at,
        content_updated_at=content_updated,
        platform_template_id=str(platform.id) if platform else None,
        platform_slug=platform.slug if platform else None,
        catalog_status=catalog_status if catalog_status in ("draft", "published") else None,
        catalog_published=catalog_status == "published",
        needs_sync=sync,
        last_synced_at=platform.last_synced_at if platform else None,
        catalog_published_at=platform.published_at if platform else None,
    )


@router.get("/website-templates/stats", response_model=AdminTemplateStats)
async def website_template_stats(
    _: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    rows = await pwt.list_admin_candidate_sites(db, bucket="all")
    assigned = draft = published = needs = 0
    for site, _vendor, platform, content_updated in rows:
        if pwt.assignment_bucket(site) == "assigned":
            assigned += 1
        else:
            draft += 1
        if platform and platform.catalog_status == "published":
            published += 1
        if platform and pwt.needs_sync(platform, content_updated):
            needs += 1
    return AdminTemplateStats(
        total=len(rows),
        assigned=assigned,
        draft=draft,
        published=published,
        needs_sync=needs,
    )


@router.get("/website-templates", response_model=AdminTemplateListResponse)
async def list_website_templates(
    view: Literal["assigned", "draft", "all"] = Query("all"),
    search: Optional[str] = Query(None),
    _: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    List vendor website-builder sites for admin curation.
    view=assigned → storefront-assigned templates; view=draft → draft templates.
    """
    all_rows = await pwt.list_admin_candidate_sites(db, bucket="all", search=search)
    stats = AdminTemplateStats(total=0, assigned=0, draft=0, published=0, needs_sync=0)
    for site, _v, platform, content_updated in all_rows:
        stats.total += 1
        if pwt.assignment_bucket(site) == "assigned":
            stats.assigned += 1
        else:
            stats.draft += 1
        if platform and platform.catalog_status == "published":
            stats.published += 1
        if platform and pwt.needs_sync(platform, content_updated):
            stats.needs_sync += 1

    filtered = all_rows
    if view in ("assigned", "draft"):
        filtered = [
            r for r in all_rows
            if pwt.assignment_bucket(r[0]) == view
        ]

    items: List[AdminTemplateRow] = []
    preview_images = await pwt.load_homepage_preview_images(
        db,
        [site.id for site, *_rest in filtered],
    )
    for site, vendor, platform, content_updated in filtered:
        page_count_res = await db.execute(
            select(func.count(WebsitePage.id)).where(
                WebsitePage.site_id == site.id,
                WebsitePage.deleted_at.is_(None),
            )
        )
        page_count = int(page_count_res.scalar() or 0)
        items.append(
            _row_from(
                site,
                vendor.business_name or vendor.display_name or "Business",
                vendor.primary_email,
                page_count,
                content_updated,
                platform,
                block_image=preview_images.get(site.id),
            )
        )

    return AdminTemplateListResponse(items=items, total=len(items), stats=stats)


async def _detail_for_site(db: AsyncSession, site_id: str) -> AdminTemplateDetail:
    try:
        sid = UUID(site_id)
    except ValueError:
        raise HTTPException(400, "Invalid site id")

    site = await pwt.load_site_with_pages(db, sid)
    if not site:
        raise HTTPException(404, "Template site not found")

    from app.models.vendor import Vendor
    vendor_res = await db.execute(select(Vendor).where(Vendor.id == site.vendor_id))
    vendor = vendor_res.scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, "Business account not found")

    platform = await pwt.get_active_platform_for_site(db, site.id)
    content_updated = await pwt.source_content_updated_at(db, site)
    pages = [p for p in (site.pages or []) if p.deleted_at is None]
    page_titles = [p.title for p in sorted(pages, key=lambda x: x.sort_order or 0)]
    ordered_pages = sorted(
        pages,
        key=lambda p: (0 if p.is_homepage else 1, p.sort_order or 0, str(p.id)),
    )
    block_image = None
    for page in ordered_pages:
        block_image = pwt.extract_preview_image_from_orm_blocks(list(page.blocks or []))
        if block_image:
            break
    row = _row_from(
        site,
        vendor.business_name or vendor.display_name or "Business",
        vendor.primary_email,
        len(pages),
        content_updated,
        platform,
        block_image=block_image,
    )
    snapshot_preview = None
    if platform and isinstance(platform.snapshot, dict):
        snap = dict(platform.snapshot)
        snap_pages = snap.get("pages") or []
        snapshot_preview = {
            "id": platform.slug,
            "name": platform.name,
            "page_count": len(snap_pages),
            "pages": [
                {"title": p.get("title"), "slug": p.get("slug"), "block_count": len(p.get("blocks") or [])}
                for p in snap_pages
            ],
        }
    return AdminTemplateDetail(
        **row.model_dump(),
        snapshot_preview=snapshot_preview,
        page_titles=page_titles,
    )


@router.get("/website-templates/{site_id}", response_model=AdminTemplateDetail)
async def get_website_template_detail(
    site_id: str,
    _: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await _detail_for_site(db, site_id)


@router.post(
    "/website-templates/{site_id}/preview",
    response_model=AdminTemplatePreviewResponse,
)
async def create_website_template_preview(
    site_id: str,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """
    Snapshot the vendor builder site into a draft preview token so admins can
    open the same browser preview vendors use (without publishing the catalog entry).
    """
    try:
        sid = UUID(site_id)
    except ValueError:
        raise HTTPException(400, "Invalid site id")

    site = await pwt.load_site_with_pages(db, sid)
    if not site:
        raise HTTPException(404, "Template site not found")

    from app.models.vendor import Vendor

    vendor_res = await db.execute(select(Vendor).where(Vendor.id == site.vendor_id))
    vendor = vendor_res.scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, "Business account not found")

    vendor_slug = (vendor.slug or "").strip() or None
    payload = _preview_payload_from_site(site, vendor_slug)
    pages = payload.get("pages") or []
    if not isinstance(pages, list) or len(pages) == 0:
        raise HTTPException(400, "This template has no pages to preview yet")

    try:
        raw = json.dumps(payload, default=str)
    except (TypeError, ValueError):
        raise HTTPException(400, "Preview payload could not be serialized")
    if len(raw.encode("utf-8")) > MAX_BUILDER_PREVIEW_BYTES:
        raise HTTPException(400, "Preview payload too large (max 2MB)")

    home = next((p for p in pages if p.get("is_homepage")), None) or pages[0]
    page_slug = home.get("slug") if isinstance(home, dict) else None

    token = secrets.token_urlsafe(48)[:64]
    row = WebsiteBuilderPreview(
        site_id=site.id,
        preview_token=token,
        label=f"Admin preview · {site.name}"[:200],
        payload=payload,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    return AdminTemplatePreviewResponse(
        site_id=str(site.id),
        preview_token=row.preview_token,
        vendor_slug=vendor_slug,
        page_slug=page_slug if isinstance(page_slug, str) else None,
    )


@router.post("/website-templates/{site_id}/publish", response_model=AdminTemplateDetail)
async def publish_website_template(
    site_id: str,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """
    Snapshot the vendor site and publish it into Business Website Templates
    so any vendor can apply it.
    """
    try:
        sid = UUID(site_id)
    except ValueError:
        raise HTTPException(400, "Invalid site id")
    try:
        await pwt.publish_site_to_catalog(db, site_id=sid, user_id=current_user.id)
        await db.commit()
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return await _detail_for_site(db, site_id)


@router.post("/website-templates/{site_id}/unpublish", response_model=AdminTemplateDetail)
async def unpublish_website_template(
    site_id: str,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Hide from vendor gallery; sites that already applied the snapshot stay intact."""
    try:
        sid = UUID(site_id)
    except ValueError:
        raise HTTPException(400, "Invalid site id")
    platform = await pwt.get_active_platform_for_site(db, sid)
    if not platform:
        raise HTTPException(404, "This template is not in the platform catalog yet")
    await pwt.unpublish_platform_template(db, platform_id=platform.id)
    await db.commit()
    return await _detail_for_site(db, site_id)


@router.post("/website-templates/{site_id}/sync", response_model=AdminTemplateDetail)
async def sync_website_template(
    site_id: str,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """
    Pull the latest multi-editor changes from the source site into the catalog snapshot
    and (if already published) make them available to vendors on next apply.
    """
    try:
        sid = UUID(site_id)
    except ValueError:
        raise HTTPException(400, "Invalid site id")
    platform = await pwt.get_active_platform_for_site(db, sid)
    if not platform:
        raise HTTPException(404, "Publish the template before syncing")
    try:
        await pwt.sync_platform_template(
            db, platform_id=platform.id, user_id=current_user.id,
        )
        await db.commit()
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return await _detail_for_site(db, site_id)


@router.delete("/website-templates/{site_id}", status_code=status.HTTP_200_OK)
async def delete_website_template(
    site_id: str,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """
    Soft-delete the platform catalog entry only.
    Does not delete the vendor source site and does not change websites
    that already applied this template (they keep their own page/block copies).
    """
    try:
        sid = UUID(site_id)
    except ValueError:
        raise HTTPException(400, "Invalid site id")
    platform = await pwt.get_active_platform_for_site(db, sid)
    if not platform:
        raise HTTPException(
            404,
            "No published/draft catalog entry to remove. The vendor source site is unchanged.",
        )
    await pwt.soft_delete_platform_template(db, platform_id=platform.id)
    await db.commit()
    return {
        "ok": True,
        "site_id": site_id,
        "message": (
            "Catalog template removed. Websites that already applied it are not affected. "
            "The original vendor builder site is unchanged."
        ),
    }
