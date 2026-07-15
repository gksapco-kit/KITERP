"""
Platform website-template curation: snapshot vendor builder sites into a shared catalog.
"""
from __future__ import annotations

import copy
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.vendor import Vendor
from app.models.website import (
    PlatformWebsiteTemplate,
    WebsiteBlock,
    WebsitePage,
    WebsiteSite,
)

# Per-site assignment keys — never copy into a reusable catalog snapshot.
_SITE_SCOPED_STYLE_KEYS = frozenset({
    "storefront_assigned",
    "website_store_scope",
    "website_store_id",
    "website_store_name",
    "website_home_store_id",
    "applied_template_id",
    "applied_template_name",
})

_TOP_LEVEL_IMAGE_FIELDS = (
    "bg_image_url",
    "image_url",
    "cover_image_url",
    "thumbnail_url",
    "brand_logo",
    "logo_url",
    "src",
)

_ARRAY_IMAGE_FIELDS = (
    ("images", "src"),
    ("banners", "image_url"),
    ("banners", "src"),
    ("banners", "bg_image_url"),
    ("slides", "image_url"),
    ("slides", "src"),
    ("features", "image_url"),
    ("categories", "image_url"),
    ("testimonials", "avatar_url"),
    ("members", "avatar_url"),
    ("projects", "image_url"),
    ("posts", "image_url"),
    ("logos", "image_url"),
)

_HERO_BLOCK_TYPES = frozenset({
    "hero",
    "hero_split",
    "hero_minimal",
    "announcement_bar",
    "nav",
})


def _pick_image_url(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _extract_overlay_image(props: Dict[str, Any]) -> Optional[str]:
    overlays = props.get("overlays")
    if not isinstance(overlays, list):
        return None
    for item in overlays:
        if not isinstance(item, dict) or item.get("type") != "image":
            continue
        url = _pick_image_url(item.get("src"))
        if url:
            return url
    return None


def _extract_image_from_block_props(props: Optional[dict]) -> Optional[str]:
    if not isinstance(props, dict):
        return None
    for field in _TOP_LEVEL_IMAGE_FIELDS:
        url = _pick_image_url(props.get(field))
        if url:
            return url
    overlay = _extract_overlay_image(props)
    if overlay:
        return overlay
    for key, field in _ARRAY_IMAGE_FIELDS:
        items = props.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            url = _pick_image_url(item.get(field))
            if url:
                return url
    return None


def extract_preview_image_from_block_dicts(blocks: List[dict]) -> Optional[str]:
    """First usable image from block prop dicts (hero blocks preferred)."""
    sorted_blocks = sorted(
        blocks,
        key=lambda b: (
            0 if (b.get("block_type") or "") in _HERO_BLOCK_TYPES else 1,
            int(b.get("sort_order") or 0),
        ),
    )
    for block in sorted_blocks:
        if (block.get("block_type") or "") not in _HERO_BLOCK_TYPES:
            continue
        url = _extract_image_from_block_props(block.get("props") if isinstance(block.get("props"), dict) else None)
        if url:
            return url
    for block in sorted_blocks:
        url = _extract_image_from_block_props(block.get("props") if isinstance(block.get("props"), dict) else None)
        if url:
            return url
    return None


def extract_preview_image_from_orm_blocks(blocks: List[WebsiteBlock]) -> Optional[str]:
    dicts = [
        {
            "block_type": b.block_type,
            "sort_order": b.sort_order or 0,
            "props": b.props if isinstance(b.props, dict) else {},
        }
        for b in blocks
        if b.visible is not False
    ]
    return extract_preview_image_from_block_dicts(dicts)


def extract_preview_image_from_snapshot(snapshot: Optional[dict]) -> Optional[str]:
    if not isinstance(snapshot, dict):
        return None
    thumb = _pick_image_url(snapshot.get("thumbnail"))
    if thumb:
        return thumb
    pages = snapshot.get("pages") or []
    if not isinstance(pages, list):
        return None
    ordered = sorted(
        [p for p in pages if isinstance(p, dict)],
        key=lambda p: (0 if p.get("is_homepage") else 1, int(p.get("sort_order") or 0)),
    )
    for page in ordered:
        blocks = page.get("blocks") or []
        if not isinstance(blocks, list):
            continue
        url = extract_preview_image_from_block_dicts(
            [b for b in blocks if isinstance(b, dict)]
        )
        if url:
            return url
    return None


def resolve_site_card_thumbnail(
    site: WebsiteSite,
    platform: Optional[PlatformWebsiteTemplate] = None,
    *,
    block_image: Optional[str] = None,
) -> Optional[str]:
    """Best static image for admin / gallery template cards."""
    for candidate in (
        block_image,
        site.og_image_url,
        platform.thumbnail if platform else None,
        extract_preview_image_from_snapshot(platform.snapshot if platform else None),
        site.logo_url,
        site.favicon_url,
    ):
        url = _pick_image_url(candidate)
        if url:
            return url
    return None


async def load_homepage_preview_images(
    db: AsyncSession,
    site_ids: List[UUID],
) -> Dict[UUID, str]:
    """Batch-load the first hero/cover image from each site's homepage (or first page)."""
    if not site_ids:
        return {}
    result = await db.execute(
        select(WebsitePage)
        .where(
            WebsitePage.site_id.in_(site_ids),
            WebsitePage.deleted_at.is_(None),
        )
        .options(selectinload(WebsitePage.blocks))
    )
    by_site: Dict[UUID, List[WebsitePage]] = {}
    for page in result.scalars().all():
        by_site.setdefault(page.site_id, []).append(page)

    out: Dict[UUID, str] = {}
    for site_id, pages in by_site.items():
        ordered = sorted(
            pages,
            key=lambda p: (0 if p.is_homepage else 1, p.sort_order or 0, str(p.id)),
        )
        for page in ordered:
            url = extract_preview_image_from_orm_blocks(list(page.blocks or []))
            if url:
                out[site_id] = url
                break
    return out


def _is_sandbox_site(site: WebsiteSite) -> bool:
    desc = (site.description or "").strip()
    name = (site.name or "").strip()
    return (
        desc.startswith("Sandbox:")
        or desc.startswith("Sandbox for template:")
        or name.startswith("Template edit")
    )


def _is_external_site(style_config: Optional[dict]) -> bool:
    sc = style_config if isinstance(style_config, dict) else {}
    scope = str(sc.get("website_store_scope") or "").strip().lower()
    return scope in {"external", "other", "other_use"}


def assignment_bucket(site: WebsiteSite) -> str:
    """assigned = linked for storefront use; draft = everything else (builder WIP)."""
    sc = site.style_config if isinstance(site.style_config, dict) else {}
    if sc.get("storefront_assigned") is True:
        return "assigned"
    return "draft"


async def load_site_with_pages(db: AsyncSession, site_id: UUID) -> Optional[WebsiteSite]:
    result = await db.execute(
        select(WebsiteSite)
        .where(WebsiteSite.id == site_id, WebsiteSite.deleted_at.is_(None))
        .options(
            selectinload(WebsiteSite.pages).selectinload(WebsitePage.blocks),
        )
    )
    return result.scalar_one_or_none()


async def source_content_updated_at(db: AsyncSession, site: WebsiteSite) -> datetime:
    """
    Latest edit clock across the site, pages, and blocks.
    Builder saves mostly touch blocks — those must count for Sync detection.
    """
    page_max = await db.execute(
        select(func.max(WebsitePage.updated_at)).where(
            WebsitePage.site_id == site.id,
            WebsitePage.deleted_at.is_(None),
        )
    )
    block_max = await db.execute(
        select(func.max(WebsiteBlock.updated_at)).where(
            WebsiteBlock.page_id.in_(
                select(WebsitePage.id).where(
                    WebsitePage.site_id == site.id,
                    WebsitePage.deleted_at.is_(None),
                )
            )
        )
    )
    latest_page = page_max.scalar()
    latest_block = block_max.scalar()
    candidates = [
        t for t in (site.updated_at, site.created_at, latest_page, latest_block) if t is not None
    ]
    return max(candidates) if candidates else datetime.utcnow()


def needs_sync(platform: PlatformWebsiteTemplate, source_updated_at: Optional[datetime]) -> bool:
    """True when the live source site is newer than the last published/synced snapshot."""
    if not platform.source_site_id or not source_updated_at:
        return False
    if platform.snapshot_source_updated_at is None:
        return True
    # Allow tiny clock skew / same-second writes still count as changed if clearly after.
    return source_updated_at > platform.snapshot_source_updated_at


def _style_for_snapshot(style_config: Optional[dict]) -> dict:
    sc = style_config if isinstance(style_config, dict) else {}
    return {k: copy.deepcopy(v) for k, v in sc.items() if k not in _SITE_SCOPED_STYLE_KEYS}


def build_template_snapshot(site: WebsiteSite, slug: str) -> Dict[str, Any]:
    pages_out: List[dict] = []
    for page in sorted(site.pages or [], key=lambda p: (p.sort_order or 0, str(p.id))):
        if page.deleted_at is not None:
            continue
        blocks_out = []
        for block in sorted(page.blocks or [], key=lambda b: (b.sort_order or 0, str(b.id))):
            blocks_out.append({
                "block_type": block.block_type,
                "label": block.label,
                "props": copy.deepcopy(block.props or {}),
                "style_overrides": copy.deepcopy(block.style_overrides or {}),
                "visible": block.visible if block.visible is not None else True,
                "visible_on_mobile": block.visible_on_mobile if block.visible_on_mobile is not None else True,
                "visible_on_tablet": block.visible_on_tablet if block.visible_on_tablet is not None else True,
                "visible_on_desktop": block.visible_on_desktop if block.visible_on_desktop is not None else True,
                "animation": block.animation,
                "animation_delay": block.animation_delay or 0,
            })
        pages_out.append({
            "title": page.title,
            "slug": page.slug,
            "page_type": page.page_type or "custom",
            "is_homepage": bool(page.is_homepage),
            "show_in_nav": bool(page.show_in_nav) if page.show_in_nav is not None else True,
            "seo_title": page.seo_title,
            "seo_description": page.seo_description,
            "blocks": blocks_out,
        })

    sc = site.style_config if isinstance(site.style_config, dict) else {}
    category = str(sc.get("business_type") or sc.get("category") or "custom").strip() or "custom"
    block_thumb = None
    for page in sorted(
        [p for p in (site.pages or []) if p.deleted_at is None],
        key=lambda p: (0 if p.is_homepage else 1, p.sort_order or 0, str(p.id)),
    ):
        block_thumb = extract_preview_image_from_orm_blocks(list(page.blocks or []))
        if block_thumb:
            break
    thumbnail = (
        site.og_image_url
        or block_thumb
        or site.logo_url
        or site.favicon_url
        or "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800"
    )
    default_style = _style_for_snapshot(sc)
    palette = [
        default_style.get("primary_color"),
        default_style.get("secondary_color"),
        default_style.get("accent_color"),
        default_style.get("bg_color"),
        default_style.get("text_color"),
    ]
    palette = [p for p in palette if isinstance(p, str) and p.startswith("#")]

    page_count = len(pages_out)
    nav_count = len([p for p in pages_out if p.get("show_in_nav", True)])
    return {
        "id": slug,
        "name": site.name,
        "description": site.description or f"Community template from {site.name}",
        "thumbnail": thumbnail,
        "category": category,
        "tags": ["Community", "Builder"],
        "tier": "full" if page_count >= 6 else "lite",
        "page_count": page_count,
        "nav_page_count": nav_count,
        "preview_palette": palette[:5] if palette else None,
        "default_style": default_style,
        "pages": pages_out,
        "source": "platform",
    }


def catalog_template_dict(platform: PlatformWebsiteTemplate) -> Dict[str, Any]:
    """Shape consumed by list_templates / apply-template / public preview."""
    snap = copy.deepcopy(platform.snapshot) if isinstance(platform.snapshot, dict) else {}
    snap["id"] = platform.slug
    snap["name"] = platform.name
    if platform.description is not None:
        snap["description"] = platform.description
    if platform.thumbnail:
        snap["thumbnail"] = platform.thumbnail
    snap["category"] = platform.category or snap.get("category") or "custom"
    if platform.tags:
        snap["tags"] = list(platform.tags)
    pages = snap.get("pages") or []
    snap.setdefault("page_count", len(pages))
    snap.setdefault("nav_page_count", len([p for p in pages if p.get("show_in_nav", True)]))
    snap["source"] = "platform"
    snap["platform_template_id"] = str(platform.id)
    return snap


async def get_published_platform_template_by_slug(
    db: AsyncSession,
    slug: str,
) -> Optional[PlatformWebsiteTemplate]:
    result = await db.execute(
        select(PlatformWebsiteTemplate).where(
            PlatformWebsiteTemplate.slug == slug,
            PlatformWebsiteTemplate.catalog_status == "published",
            PlatformWebsiteTemplate.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_published_platform_templates(db: AsyncSession) -> List[PlatformWebsiteTemplate]:
    result = await db.execute(
        select(PlatformWebsiteTemplate)
        .where(
            PlatformWebsiteTemplate.catalog_status == "published",
            PlatformWebsiteTemplate.deleted_at.is_(None),
        )
        .order_by(PlatformWebsiteTemplate.published_at.desc().nullslast())
    )
    return list(result.scalars().all())


async def get_active_platform_for_site(
    db: AsyncSession,
    site_id: UUID,
) -> Optional[PlatformWebsiteTemplate]:
    result = await db.execute(
        select(PlatformWebsiteTemplate).where(
            PlatformWebsiteTemplate.source_site_id == site_id,
            PlatformWebsiteTemplate.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_admin_candidate_sites(
    db: AsyncSession,
    *,
    bucket: str,
    search: Optional[str] = None,
) -> List[Tuple[WebsiteSite, Vendor, Optional[PlatformWebsiteTemplate], datetime]]:
    """
    Vendor builder sites for admin curation, joined with vendor + platform row.
    bucket: assigned | draft | all
    """
    result = await db.execute(
        select(WebsiteSite, Vendor)
        .join(Vendor, Vendor.id == WebsiteSite.vendor_id)
        .where(WebsiteSite.deleted_at.is_(None))
        .order_by(WebsiteSite.updated_at.desc().nullslast())
    )
    rows = result.all()

    site_ids = [site.id for site, _vendor in rows]
    platform_by_site: Dict[UUID, PlatformWebsiteTemplate] = {}
    if site_ids:
        plat_res = await db.execute(
            select(PlatformWebsiteTemplate).where(
                PlatformWebsiteTemplate.source_site_id.in_(site_ids),
                PlatformWebsiteTemplate.deleted_at.is_(None),
            )
        )
        for pt in plat_res.scalars().all():
            if pt.source_site_id:
                platform_by_site[pt.source_site_id] = pt

    out: List[Tuple[WebsiteSite, Vendor, Optional[PlatformWebsiteTemplate], datetime]] = []
    q = (search or "").strip().lower()
    for site, vendor in rows:
        if _is_sandbox_site(site):
            continue
        sc = site.style_config if isinstance(site.style_config, dict) else {}
        if _is_external_site(sc):
            continue
        site_bucket = assignment_bucket(site)
        if bucket in ("assigned", "draft") and site_bucket != bucket:
            continue
        if q:
            hay = " ".join([
                site.name or "",
                site.description or "",
                vendor.business_name or "",
                vendor.display_name or "",
                vendor.primary_email or "",
            ]).lower()
            if q not in hay:
                continue
        content_updated = await source_content_updated_at(db, site)
        out.append((site, vendor, platform_by_site.get(site.id), content_updated))
    return out


async def publish_site_to_catalog(
    db: AsyncSession,
    *,
    site_id: UUID,
    user_id: UUID,
) -> PlatformWebsiteTemplate:
    site = await load_site_with_pages(db, site_id)
    if not site:
        raise ValueError("Site not found")
    if _is_sandbox_site(site):
        raise ValueError("Sandbox sites cannot be published as platform templates")

    platform = await get_active_platform_for_site(db, site.id)
    content_updated = await source_content_updated_at(db, site)
    now = datetime.utcnow()

    if platform is None:
        slug = f"platform_{str(site.id).replace('-', '')[:16]}"
        # Ensure unique slug
        existing = await db.execute(
            select(PlatformWebsiteTemplate.id).where(PlatformWebsiteTemplate.slug == slug)
        )
        if existing.scalar_one_or_none():
            slug = f"platform_{uuid.uuid4().hex[:16]}"
        snapshot = build_template_snapshot(site, slug)
        platform = PlatformWebsiteTemplate(
            id=uuid.uuid4(),
            slug=slug,
            name=site.name,
            description=site.description,
            thumbnail=snapshot.get("thumbnail"),
            category=snapshot.get("category") or "custom",
            tags=snapshot.get("tags") or ["Community", "Builder"],
            source_site_id=site.id,
            source_vendor_id=site.vendor_id,
            catalog_status="published",
            snapshot=snapshot,
            snapshot_source_updated_at=content_updated,
            published_at=now,
            published_by_user_id=user_id,
            last_synced_at=now,
            last_synced_by_user_id=user_id,
        )
        db.add(platform)
    else:
        snapshot = build_template_snapshot(site, platform.slug)
        platform.name = site.name
        platform.description = site.description
        platform.thumbnail = snapshot.get("thumbnail")
        platform.category = snapshot.get("category") or platform.category or "custom"
        platform.tags = snapshot.get("tags") or platform.tags or []
        platform.source_vendor_id = site.vendor_id
        platform.catalog_status = "published"
        platform.snapshot = snapshot
        platform.snapshot_source_updated_at = content_updated
        platform.published_at = platform.published_at or now
        platform.published_by_user_id = user_id
        platform.last_synced_at = now
        platform.last_synced_by_user_id = user_id
        platform.updated_at = now

    await db.flush()
    await db.refresh(platform)
    return platform


async def unpublish_platform_template(
    db: AsyncSession,
    *,
    platform_id: UUID,
) -> PlatformWebsiteTemplate:
    result = await db.execute(
        select(PlatformWebsiteTemplate).where(
            PlatformWebsiteTemplate.id == platform_id,
            PlatformWebsiteTemplate.deleted_at.is_(None),
        )
    )
    platform = result.scalar_one_or_none()
    if not platform:
        raise ValueError("Platform template not found")
    platform.catalog_status = "draft"
    platform.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(platform)
    return platform


async def sync_platform_template(
    db: AsyncSession,
    *,
    platform_id: UUID,
    user_id: UUID,
) -> PlatformWebsiteTemplate:
    result = await db.execute(
        select(PlatformWebsiteTemplate).where(
            PlatformWebsiteTemplate.id == platform_id,
            PlatformWebsiteTemplate.deleted_at.is_(None),
        )
    )
    platform = result.scalar_one_or_none()
    if not platform:
        raise ValueError("Platform template not found")
    if not platform.source_site_id:
        raise ValueError("Source site is no longer linked; sync is unavailable")

    site = await load_site_with_pages(db, platform.source_site_id)
    if not site:
        raise ValueError("Source site was deleted; catalog snapshot is unchanged")

    content_updated = await source_content_updated_at(db, site)
    snapshot = build_template_snapshot(site, platform.slug)
    now = datetime.utcnow()
    platform.name = site.name
    platform.description = site.description
    platform.thumbnail = snapshot.get("thumbnail")
    platform.category = snapshot.get("category") or platform.category or "custom"
    platform.tags = snapshot.get("tags") or platform.tags or []
    platform.snapshot = snapshot
    platform.snapshot_source_updated_at = content_updated
    platform.last_synced_at = now
    platform.last_synced_by_user_id = user_id
    platform.updated_at = now
    # Sync keeps current catalog_status (published or draft)
    await db.flush()
    await db.refresh(platform)
    return platform


async def soft_delete_platform_template(
    db: AsyncSession,
    *,
    platform_id: UUID,
) -> PlatformWebsiteTemplate:
    """
    Remove from catalog only. Vendor sites that already applied this template keep
    their copied pages/blocks — they are unaffected.
    """
    result = await db.execute(
        select(PlatformWebsiteTemplate).where(
            PlatformWebsiteTemplate.id == platform_id,
            PlatformWebsiteTemplate.deleted_at.is_(None),
        )
    )
    platform = result.scalar_one_or_none()
    if not platform:
        raise ValueError("Platform template not found")
    now = datetime.utcnow()
    platform.deleted_at = now
    platform.catalog_status = "draft"
    platform.updated_at = now
    await db.flush()
    await db.refresh(platform)
    return platform
