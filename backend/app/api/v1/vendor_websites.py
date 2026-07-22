"""
Website Builder API — multi-site, multi-page, block-based with full AI features.
"""
from __future__ import annotations
import copy
import re
import secrets
import uuid, json, random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, update
from sqlalchemy.orm import selectinload, with_loader_criteria
from uuid import UUID

from app.database import get_db
from app.api.deps import get_current_active_user, resolve_dashboard_vendor
from app.middleware.vendor_dashboard_context import get_preferred_vendor_id_from_context
from app.models.user import User
from app.models.vendor import Vendor
from app.models.website import (
    WebsiteSite, WebsitePage, WebsiteBlock, WebsiteMedia, WebsiteRedirect,
    WebsiteFormSubmission, WebsitePageRevision,
    WebsiteBlockTranslation, WebsiteSymbol, WebsiteABExposure,
    WebsiteWebhook, WebsiteBuilderPreview,
)
from app.services.vendor_service import VendorService
from app.schemas.website import (
    SiteCreate, SiteUpdate, SiteOut, SiteListItem,
    PageTrashOut, SiteTrashOut,
    PageCreate, PageUpdate, PageOut,
    BlockCreate, BlockUpdate, BlockOut,
    BlockReorderRequest, PageReorderRequest,
    AITextRequest, AITextResponse,
    AIScreenshotRequest, AIScreenshotResponse,
    AIUrlCloneRequest, AIUrlCloneResponse,
    AIUxReviewRequest, AIUxReviewResponse,
    AIImageRequest,
    AIThemeRequest, AIThemeResponse,
    AIMediaAdjustRequest, AIMediaAdjustResponse,
    AISEORequest, AISEOResponse,
    AISuggestBlocksRequest, AISuggestBlocksResponse,
    AIEnhancePromptRequest, AIEnhancePromptResponse,
    AIGenerateSiteRequest, AIGenerateSiteResponse,
    SiteRedirectCreate, SiteRedirectUpdate, SiteRedirectOut,
    MediaOut,
    MediaUpdateBody,
)

router = APIRouter(redirect_slashes=False)

PAGE_TRASH_RETENTION_DAYS = 7
SITE_TRASH_RETENTION_DAYS = 30


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_vendor(db: AsyncSession, user: User) -> Vendor:
    pref = get_preferred_vendor_id_from_context()
    return await resolve_dashboard_vendor(db, user, preferred_vendor_id=pref)


async def _get_site(
    db: AsyncSession,
    site_id: str,
    vendor_id: UUID,
    *,
    include_deleted: bool = False,
) -> WebsiteSite:
    """Load site with active pages only.

    Do NOT assign ``site.pages = [...]`` to filter trashed pages — the pages
    relationship uses ``delete-orphan`` cascade, so reassigning the list
    permanently deletes any page removed from the collection (including trash).
    """
    query = (
        select(WebsiteSite)
        .options(
            selectinload(WebsiteSite.pages).selectinload(WebsitePage.blocks),
            with_loader_criteria(WebsitePage, WebsitePage.deleted_at.is_(None)),
        )
        .where(WebsiteSite.id == UUID(site_id), WebsiteSite.vendor_id == vendor_id)
    )
    if not include_deleted:
        query = query.where(WebsiteSite.deleted_at.is_(None))
    result = await db.execute(query)
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


async def _purge_expired_trashed_pages(db: AsyncSession, site_id: str) -> None:
    cutoff = datetime.utcnow() - timedelta(days=PAGE_TRASH_RETENTION_DAYS)
    result = await db.execute(
        select(WebsitePage).where(
            WebsitePage.site_id == UUID(site_id),
            WebsitePage.deleted_at.isnot(None),
            WebsitePage.deleted_at < cutoff,
        )
    )
    for page in result.scalars().all():
        await db.delete(page)


async def _purge_expired_trashed_sites(db: AsyncSession, vendor_id: UUID) -> None:
    cutoff = datetime.utcnow() - timedelta(days=SITE_TRASH_RETENTION_DAYS)
    result = await db.execute(
        select(WebsiteSite).where(
            WebsiteSite.vendor_id == vendor_id,
            WebsiteSite.deleted_at.isnot(None),
            WebsiteSite.deleted_at < cutoff,
        )
    )
    for site in result.scalars().all():
        await db.execute(
            delete(WebsiteSite).where(WebsiteSite.id == site.id)
        )


def _site_trash_out(site: WebsiteSite, page_count: int = 0) -> SiteTrashOut:
    deleted_at = site.deleted_at or datetime.utcnow()
    purge_at = deleted_at + timedelta(days=SITE_TRASH_RETENTION_DAYS)
    seconds_left = (purge_at - datetime.utcnow()).total_seconds()
    days_remaining = max(0, int((seconds_left + 86399) // 86400))
    sc = site.style_config if isinstance(site.style_config, dict) else {}
    _, tpl_name = _resolved_applied_template(sc)
    return SiteTrashOut(
        id=str(site.id),
        name=site.name,
        description=site.description,
        deleted_at=deleted_at,
        purge_at=purge_at,
        days_remaining=days_remaining,
        page_count=page_count,
        is_published=bool(site.is_published),
        applied_template_name=tpl_name,
    )


def _page_trash_out(page: WebsitePage, block_count: Optional[int] = None) -> PageTrashOut:
    deleted_at = page.deleted_at or datetime.utcnow()
    purge_at = deleted_at + timedelta(days=PAGE_TRASH_RETENTION_DAYS)
    seconds_left = (purge_at - datetime.utcnow()).total_seconds()
    days_remaining = max(0, int((seconds_left + 86399) // 86400))
    return PageTrashOut(
        id=str(page.id),
        title=page.title,
        slug=page.slug,
        deleted_at=deleted_at,
        purge_at=purge_at,
        days_remaining=days_remaining,
        block_count=block_count if block_count is not None else len(page.blocks or []),
    )


async def _assert_site_owned(db: AsyncSession, site_id: str, vendor_id: UUID) -> None:
    """Lightweight ownership check — no pages/blocks eager load."""
    result = await db.execute(
        select(WebsiteSite.id).where(
            WebsiteSite.id == UUID(site_id),
            WebsiteSite.vendor_id == vendor_id,
            WebsiteSite.deleted_at.is_(None),
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Site not found")


async def _get_site_readable(
    db: AsyncSession,
    site_id: str,
    vendor_id: UUID,
) -> WebsiteSite:
    """Active or trashed site — read-only preview and glimpse endpoints."""
    return await _get_site(db, site_id, vendor_id, include_deleted=True)


async def _touch_site_content(db: AsyncSession, site_id: str, page_id: Optional[str] = None) -> None:
    """Bump site/page clocks so admin Sync detection sees builder saves."""
    now = datetime.utcnow()
    await db.execute(
        update(WebsiteSite)
        .where(WebsiteSite.id == UUID(site_id))
        .values(updated_at=now)
    )
    if page_id:
        await db.execute(
            update(WebsitePage)
            .where(WebsitePage.id == UUID(page_id), WebsitePage.site_id == UUID(site_id))
            .values(updated_at=now)
        )


async def _get_page(
    db: AsyncSession,
    page_id: str,
    site_id: str,
    *,
    include_deleted: bool = False,
) -> WebsitePage:
    query = (
        select(WebsitePage)
        .options(selectinload(WebsitePage.blocks))
        .where(WebsitePage.id == UUID(page_id), WebsitePage.site_id == UUID(site_id))
    )
    if not include_deleted:
        query = query.where(WebsitePage.deleted_at.is_(None))
    result = await db.execute(query)
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


async def _normalize_site_homepage(db: AsyncSession, site_id: str) -> None:
    """Ensure exactly one active homepage per site (fixes duplicate flags from imports/AI)."""
    result = await db.execute(
        select(WebsitePage)
        .where(WebsitePage.site_id == UUID(site_id), WebsitePage.deleted_at.is_(None))
        .order_by(WebsitePage.sort_order, WebsitePage.created_at)
    )
    pages = list(result.scalars().all())
    if not pages:
        return
    flagged = [p for p in pages if p.is_homepage]
    keeper = flagged[0] if flagged else pages[0]
    changed = False
    for p in pages:
        should_home = p.id == keeper.id
        if p.is_homepage != should_home:
            p.is_homepage = should_home
            p.updated_at = datetime.utcnow()
            changed = True
    if changed:
        await db.flush()


def _normalize_page_slug(raw: str) -> str:
    slug = (raw or "page").strip().lower().strip("/")
    slug = re.sub(r"[^a-z0-9-]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return (slug[:200] or "page")


async def _unique_active_slug(
    db: AsyncSession,
    site_id: str,
    base_slug: str,
    exclude_page_id: Optional[UUID] = None,
) -> str:
    slug = _normalize_page_slug(base_slug)
    candidate = slug
    n = 2
    while True:
        q = select(WebsitePage.id).where(
            WebsitePage.site_id == UUID(site_id),
            WebsitePage.deleted_at.is_(None),
            WebsitePage.slug == candidate,
        )
        if exclude_page_id:
            q = q.where(WebsitePage.id != exclude_page_id)
        if not (await db.execute(q)).scalar_one_or_none():
            return candidate
        candidate = f"{slug}-{n}"
        n += 1


async def _prepare_page_mutation(db: AsyncSession, site_id: str) -> None:
    await _purge_expired_trashed_pages(db, site_id)
    await _normalize_site_homepage(db, site_id)
    await db.flush()


async def _pick_replacement_homepage(
    db: AsyncSession,
    site_id: str,
    exclude_page_id: UUID,
) -> Optional[WebsitePage]:
    result = await db.execute(
        select(WebsitePage)
        .where(
            WebsitePage.site_id == UUID(site_id),
            WebsitePage.deleted_at.is_(None),
            WebsitePage.id != exclude_page_id,
        )
        .order_by(WebsitePage.sort_order, WebsitePage.created_at)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_block(db: AsyncSession, block_id: str, page_id: str) -> WebsiteBlock:
    result = await db.execute(
        select(WebsiteBlock).where(WebsiteBlock.id == UUID(block_id), WebsiteBlock.page_id == UUID(page_id))
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


# ── Page revisions (snapshot history) ────────────────────────────────────────

# Cap the number of stored revisions per page so heavy editors don't bloat
# the table forever. Older revisions get pruned on each new snapshot.
_MAX_REVISIONS_PER_PAGE = 50

# Throttle: don't snapshot more often than this per page. Auto-saves and
# autosave-style edits coalesce into a single revision.
_REVISION_MIN_INTERVAL_SECONDS = 30


async def _snapshot_page(
    db: AsyncSession,
    page_id: str,
    site_id: str,
    *,
    note: Optional[str] = None,
    author_user_id: Optional[UUID] = None,
    force: bool = False,
) -> Optional[WebsitePageRevision]:
    """
    Capture a full page+blocks snapshot into `wb_page_revisions`.

    The snapshot is the single source of truth that `restore_page_revision`
    reads, so the shape mirrors what restore expects: page metadata fields
    plus a `blocks` array of complete block records.

    Throttled to one revision every `_REVISION_MIN_INTERVAL_SECONDS` per
    page unless `force=True`. Pruned to the last `_MAX_REVISIONS_PER_PAGE`.

    Best-effort: if the model isn't available or write fails, swallow and
    continue so the user-facing save isn't blocked.
    """
    try:
        page_uuid = UUID(page_id)
        site_uuid = UUID(site_id)
    except Exception:
        return None

    page_res = await db.execute(
        select(WebsitePage)
        .options(selectinload(WebsitePage.blocks))
        .where(WebsitePage.id == page_uuid, WebsitePage.site_id == site_uuid)
    )
    page = page_res.scalar_one_or_none()
    if not page:
        return None

    if not force:
        last_res = await db.execute(
            select(WebsitePageRevision)
            .where(WebsitePageRevision.page_id == page_uuid)
            .order_by(WebsitePageRevision.created_at.desc())
            .limit(1)
        )
        last = last_res.scalar_one_or_none()
        if last and last.created_at:
            elapsed = (datetime.utcnow() - last.created_at).total_seconds()
            if elapsed < _REVISION_MIN_INTERVAL_SECONDS:
                return None

    blocks_snap: List[Dict[str, Any]] = [
        {
            "id": str(b.id),
            "block_type": b.block_type,
            "label": b.label,
            "props": b.props or {},
            "style_overrides": b.style_overrides or {},
            "visible": b.visible,
            "visible_on_mobile": b.visible_on_mobile,
            "visible_on_tablet": b.visible_on_tablet,
            "visible_on_desktop": b.visible_on_desktop,
            "animation": b.animation,
            "animation_delay": b.animation_delay,
            "sort_order": b.sort_order or 0,
        }
        for b in sorted(page.blocks or [], key=lambda x: (x.sort_order or 0))
    ]

    snapshot: Dict[str, Any] = {
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
        "is_homepage": page.is_homepage,
        "show_in_nav": page.show_in_nav,
        "blocks": blocks_snap,
    }

    revision = WebsitePageRevision(
        id=uuid.uuid4(),
        page_id=page_uuid,
        site_id=site_uuid,
        snapshot=snapshot,
        author_user_id=author_user_id,
        note=note,
    )
    try:
        db.add(revision)
        await db.flush()
    except Exception:
        # Ignore — caller's commit will still succeed without a snapshot.
        return None

    # Prune older revisions beyond the cap.
    try:
        keep_q = await db.execute(
            select(WebsitePageRevision.id)
            .where(WebsitePageRevision.page_id == page_uuid)
            .order_by(WebsitePageRevision.created_at.desc())
            .limit(_MAX_REVISIONS_PER_PAGE)
        )
        keep_ids = {row[0] for row in keep_q.all()}
        if keep_ids:
            await db.execute(
                delete(WebsitePageRevision)
                .where(
                    WebsitePageRevision.page_id == page_uuid,
                    WebsitePageRevision.id.notin_(keep_ids),
                )
            )
    except Exception:
        pass

    return revision


# ── Sites ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SiteListItem])
async def list_sites(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _purge_expired_trashed_sites(db, vendor.id)
    await db.flush()
    result = await db.execute(
        select(WebsiteSite).where(
            WebsiteSite.vendor_id == vendor.id,
            WebsiteSite.deleted_at.is_(None),
        ).order_by(WebsiteSite.created_at.desc())
    )
    sites = result.scalars().all()

    out = []
    for s in sites:
        page_count_res = await db.execute(
            select(func.count(WebsitePage.id)).where(
                WebsitePage.site_id == s.id,
                WebsitePage.deleted_at.is_(None),
            )
        )
        page_count = page_count_res.scalar() or 0
        tpl_id, tpl_name = _resolved_applied_template(s.style_config)
        sc = s.style_config if isinstance(s.style_config, dict) else {}
        out.append(SiteListItem(
            id=str(s.id), name=s.name, subdomain=s.subdomain, custom_domain=s.custom_domain,
            description=s.description, favicon_url=s.favicon_url, logo_url=s.logo_url,
            is_published=s.is_published, status=s.status, page_count=page_count,
            applied_template_id=tpl_id,
            applied_template_name=tpl_name,
            website_store_scope=sc.get("website_store_scope"),
            website_store_id=sc.get("website_store_id"),
            website_store_name=sc.get("website_store_name"),
            website_home_store_id=sc.get("website_home_store_id"),
            storefront_assigned=sc.get("storefront_assigned") is True,
            business_type=sc.get("business_type"),
            selling_mode=sc.get("selling_mode"),
            created_at=s.created_at, updated_at=s.updated_at,
        ))
    return out


@router.get("/trash", response_model=List[SiteTrashOut])
async def list_trashed_sites(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _purge_expired_trashed_sites(db, vendor.id)
    result = await db.execute(
        select(WebsiteSite)
        .where(
            WebsiteSite.vendor_id == vendor.id,
            WebsiteSite.deleted_at.isnot(None),
        )
        .order_by(WebsiteSite.deleted_at.desc())
    )
    sites = result.scalars().all()
    out: List[SiteTrashOut] = []
    for s in sites:
        page_count_res = await db.execute(
            select(func.count(WebsitePage.id)).where(
                WebsitePage.site_id == s.id,
                WebsitePage.deleted_at.is_(None),
            )
        )
        page_count = page_count_res.scalar() or 0
        out.append(_site_trash_out(s, page_count))
    await db.commit()
    return out


def _resolve_builder_site_home_store_id(sc: dict) -> str:
    """Home business unit for a store-scoped builder site (immutable after creation)."""
    home = str(sc.get("website_home_store_id") or "").strip()
    if home:
        return home
    if str(sc.get("website_store_scope") or "").strip().lower() == "store":
        return str(sc.get("website_store_id") or "").strip()
    return ""


def _validate_builder_site_store_assignment(existing_sc: dict, incoming_sc: dict) -> None:
    """Reject linking a BU-specific site to a different business unit."""
    if not incoming_sc:
        return
    existing_home = _resolve_builder_site_home_store_id(existing_sc)
    incoming_home = str(incoming_sc.get("website_home_store_id") or "").strip()
    if existing_home and incoming_home and incoming_home != existing_home:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change the home business unit for this website.",
        )
    if "website_store_id" not in incoming_sc and incoming_sc.get("storefront_assigned") is not True:
        return
    merged = {**existing_sc, **incoming_sc}
    home_id = existing_home or _resolve_builder_site_home_store_id(merged)
    target_id = str(incoming_sc.get("website_store_id") or merged.get("website_store_id") or "").strip()
    if home_id and target_id and target_id != home_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This website was built for a specific business unit and can only be assigned to that unit.",
        )


@router.post("/", response_model=SiteOut, status_code=201)
async def create_site(
    body: SiteCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site_id = uuid.uuid4()
    payload = body.model_dump() if hasattr(body, "model_dump") else body.dict()
    if not payload.get("style_config"):
        payload["style_config"] = {}
    site = WebsiteSite(
        id=site_id,
        vendor_id=vendor.id,
        **payload,
    )
    db.add(site)

    # Auto-create a Home page
    home = WebsitePage(
        id=uuid.uuid4(),
        site_id=site_id,
        title="Home",
        slug="home",
        page_type="home",
        is_homepage=True,
        sort_order=0,
    )
    db.add(home)
    await db.commit()
    await db.refresh(site)
    return await _get_site(db, str(site.id), vendor.id)


@router.post("/{site_id}/ensure-blank", response_model=SiteOut)
async def ensure_blank_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """One empty Home page, no blocks. Used for template-edit sandboxes so the canvas stays blank until APPLY."""
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    await db.execute(
        delete(WebsiteBlock).where(
            WebsiteBlock.page_id.in_(
                select(WebsitePage.id).where(WebsitePage.site_id == UUID(site_id))
            )
        )
    )
    await db.execute(delete(WebsitePage).where(WebsitePage.site_id == UUID(site_id)))
    home = WebsitePage(
        id=uuid.uuid4(),
        site_id=UUID(site_id),
        title="Home",
        slug="home",
        page_type="home",
        is_homepage=True,
        sort_order=0,
    )
    db.add(home)
    # Keep wizard metadata (scope, setup_features, palette, business_type, etc.) — blank means no blocks only.
    site.updated_at = datetime.utcnow()
    await db.commit()
    return await _get_site(db, site_id, vendor.id)


@router.get("/{site_id}", response_model=SiteOut)
async def get_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site_readable(db, site_id, vendor.id)
    if site.deleted_at is None:
        await _normalize_site_homepage(db, site_id)
        await db.commit()
        return await _get_site(db, site_id, vendor.id)
    return site


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(
    site_id: str,
    body: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    update_data = body.dict(exclude_none=True)
    if "style_config" in update_data and update_data["style_config"] is not None:
        existing_sc = site.style_config if isinstance(site.style_config, dict) else {}
        incoming_sc = update_data["style_config"]
        _validate_builder_site_store_assignment(existing_sc, incoming_sc)
        site.style_config = {**existing_sc, **incoming_sc}
        del update_data["style_config"]
    for k, v in update_data.items():
        setattr(site, k, v)
    if body.is_published and not site.published_at:
        site.published_at = datetime.utcnow()
    site.updated_at = datetime.utcnow()
    await db.commit()
    return await _get_site(db, site_id, vendor.id)


@router.delete("/{site_id}", status_code=204)
async def delete_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    site.deleted_at = datetime.utcnow()
    site.is_published = False
    site.status = "archived"
    site.updated_at = datetime.utcnow()
    sc = site.style_config if isinstance(site.style_config, dict) else {}
    if sc.get("storefront_assigned") is True:
        sc = {**sc, "storefront_assigned": False}
        site.style_config = sc
    await db.commit()

    try:
        from app.api.v1.public_sites import invalidate_site_cache
        await invalidate_site_cache(vendor.subdomain, site_id, vendor_slug=vendor.slug)
    except Exception:
        pass


@router.post("/{site_id}/restore", response_model=SiteOut)
async def restore_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id, include_deleted=True)
    if not site.deleted_at:
        raise HTTPException(status_code=400, detail="Site is not in trash")
    site.deleted_at = None
    site.status = "draft"
    site.updated_at = datetime.utcnow()
    await db.commit()
    return await _get_site(db, site_id, vendor.id)


@router.delete("/{site_id}/permanent", status_code=204)
async def permanently_delete_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site_uuid = UUID(site_id)
    result = await db.execute(
        select(WebsiteSite).where(
            WebsiteSite.id == site_uuid,
            WebsiteSite.vendor_id == vendor.id,
            WebsiteSite.deleted_at.isnot(None),
        )
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Deleted site not found")
    await db.execute(
        delete(WebsiteSite).where(
            WebsiteSite.id == site_uuid,
            WebsiteSite.vendor_id == vendor.id,
        )
    )
    await db.commit()


@router.post("/{site_id}/publish", response_model=SiteOut)
async def publish_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    site.is_published = True
    site.status = "published"
    site.published_at = datetime.utcnow()
    site.updated_at = datetime.utcnow()

    # Force a snapshot of every published page so vendors always have a
    # rollback target tied to the exact state that went live.
    for page in (site.pages or []):
        try:
            await _snapshot_page(
                db, str(page.id), site_id, note="auto: published", author_user_id=user.id, force=True,
            )
        except Exception:
            pass

    await db.commit()

    # Invalidate the public-sites Redis cache
    try:
        from app.api.v1.public_sites import invalidate_site_cache
        await invalidate_site_cache(vendor.subdomain, site_id, vendor_slug=vendor.slug)
    except Exception:
        pass

    # Fire outgoing webhooks (P3.10)
    try:
        await _fire_webhooks(db, site_id, "site.published", {"site_name": site.name})
    except Exception:
        pass

    return await _get_site(db, site_id, vendor.id)


@router.post("/{site_id}/unpublish", response_model=SiteOut)
async def unpublish_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    site.is_published = False
    site.status = "draft"
    site.updated_at = datetime.utcnow()
    await db.commit()
    return await _get_site(db, site_id, vendor.id)


# ── Pages ─────────────────────────────────────────────────────────────────────

@router.get("/{site_id}/pages", response_model=List[PageOut])
async def list_pages(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site_readable(db, site_id, vendor.id)
    await _purge_expired_trashed_pages(db, site_id)
    if site.deleted_at is None:
        await _normalize_site_homepage(db, site_id)
    result = await db.execute(
        select(WebsitePage)
        .options(selectinload(WebsitePage.blocks))
        .where(WebsitePage.site_id == UUID(site_id), WebsitePage.deleted_at.is_(None))
        .order_by(WebsitePage.sort_order)
    )
    pages = result.scalars().all()
    await db.commit()
    return pages


@router.get("/{site_id}/pages/trash", response_model=List[PageTrashOut])
async def list_trashed_pages(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _assert_site_owned(db, site_id, vendor.id)
    await _purge_expired_trashed_pages(db, site_id)
    await db.flush()
    result = await db.execute(
        select(WebsitePage)
        .where(WebsitePage.site_id == UUID(site_id), WebsitePage.deleted_at.isnot(None))
        .order_by(WebsitePage.deleted_at.desc())
    )
    pages = list(result.scalars().all())
    block_counts: Dict[UUID, int] = {}
    if pages:
        counts_res = await db.execute(
            select(WebsiteBlock.page_id, func.count(WebsiteBlock.id))
            .where(WebsiteBlock.page_id.in_([p.id for p in pages]))
            .group_by(WebsiteBlock.page_id)
        )
        block_counts = {row[0]: int(row[1]) for row in counts_res.all()}
    await db.commit()
    return [_page_trash_out(p, block_counts.get(p.id, 0)) for p in pages]


@router.post("/{site_id}/pages", response_model=PageOut, status_code=201)
async def create_page(
    site_id: str,
    body: PageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    page = WebsitePage(id=uuid.uuid4(), site_id=UUID(site_id), **body.dict())
    db.add(page)
    await db.commit()
    return await _get_page(db, str(page.id), site_id)


@router.get("/{site_id}/pages/{page_id}", response_model=PageOut)
async def get_page(
    site_id: str,
    page_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    return await _get_page(db, page_id, site_id)


@router.patch("/{site_id}/pages/{page_id}", response_model=PageOut)
async def update_page(
    site_id: str,
    page_id: str,
    body: PageUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    page = await _get_page(db, page_id, site_id)
    # Snapshot BEFORE mutating so restoring rewinds to the prior state.
    await _snapshot_page(
        db, page_id, site_id, note="page edited", author_user_id=user.id,
    )
    data = body.dict(exclude_none=True)
    slug_change_requested = "slug" in data
    if data.get("is_homepage") is True:
        await db.execute(
            update(WebsitePage)
            .where(
                WebsitePage.site_id == UUID(site_id),
                WebsitePage.id != UUID(page_id),
                WebsitePage.deleted_at.is_(None),
            )
            .values(is_homepage=False, updated_at=datetime.utcnow())
        )
    if "slug" in data:
        if page.is_homepage:
            data.pop("slug")
        else:
            data["slug"] = await _unique_active_slug(
                db, site_id, data["slug"], exclude_page_id=page.id,
            )
    for k, v in data.items():
        setattr(page, k, v)
    page.updated_at = datetime.utcnow()
    await db.commit()
    if slug_change_requested and not page.is_homepage:
        try:
            from app.api.v1.public_sites import invalidate_site_cache
            await invalidate_site_cache(vendor.subdomain, site_id, vendor_slug=vendor.slug)
        except Exception:
            pass
    return await _get_page(db, page_id, site_id)


@router.delete("/{site_id}/pages/{page_id}", status_code=204)
async def delete_page(
    site_id: str,
    page_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    await _prepare_page_mutation(db, site_id)
    page = await _get_page(db, page_id, site_id)
    active_count = await db.execute(
        select(func.count(WebsitePage.id)).where(
            WebsitePage.site_id == UUID(site_id),
            WebsitePage.deleted_at.is_(None),
        )
    )
    if (active_count.scalar() or 0) <= 1:
        raise HTTPException(status_code=400, detail="Your site needs at least one page")
    if page.is_homepage:
        replacement = await _pick_replacement_homepage(db, site_id, page.id)
        if not replacement:
            raise HTTPException(status_code=400, detail="Your site needs at least one page")
        page.is_homepage = False
        replacement.is_homepage = True
        replacement.updated_at = datetime.utcnow()
    page.deleted_at = datetime.utcnow()
    page.is_published = False
    page.show_in_nav = False
    page.is_homepage = False
    page.updated_at = datetime.utcnow()
    await db.commit()


@router.post("/{site_id}/pages/{page_id}/restore", response_model=PageOut)
async def restore_page(
    site_id: str,
    page_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    await _prepare_page_mutation(db, site_id)
    page = await _get_page(db, page_id, site_id, include_deleted=True)
    if not page.deleted_at:
        raise HTTPException(status_code=400, detail="Page is not in trash")
    new_slug = await _unique_active_slug(db, site_id, page.slug, exclude_page_id=page.id)
    if new_slug != page.slug:
        page.slug = new_slug
    page.deleted_at = None
    page.is_published = True
    page.show_in_nav = True
    page.is_homepage = False
    page.updated_at = datetime.utcnow()
    await _normalize_site_homepage(db, site_id)
    await db.commit()
    return await _get_page(db, page_id, site_id)


@router.post("/{site_id}/pages/reorder")
async def reorder_pages(
    site_id: str,
    body: PageReorderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    for item in body.items:
        try:
            page = await _get_page(db, str(item.id), site_id)
        except HTTPException:
            continue
        page.sort_order = item.sort_order
    await db.commit()
    return {"ok": True}


# ── Blocks ────────────────────────────────────────────────────────────────────

@router.get("/{site_id}/pages/{page_id}/blocks", response_model=List[BlockOut])
async def list_blocks(
    site_id: str,
    page_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site_readable(db, site_id, vendor.id)
    await _get_page(db, page_id, site_id)
    result = await db.execute(
        select(WebsiteBlock)
        .where(WebsiteBlock.page_id == page_id)
        .order_by(WebsiteBlock.sort_order)
    )
    return result.scalars().all()


@router.post("/{site_id}/pages/{page_id}/blocks", response_model=BlockOut, status_code=201)
async def create_block(
    site_id: str,
    page_id: str,
    body: BlockCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    await _get_page(db, page_id, site_id)
    await _snapshot_page(
        db, page_id, site_id, note="block added", author_user_id=user.id,
    )
    block = WebsiteBlock(id=uuid.uuid4(), page_id=UUID(page_id), **body.dict())
    db.add(block)
    await _touch_site_content(db, site_id, page_id)
    await db.commit()
    await db.refresh(block)
    return block


@router.patch("/{site_id}/pages/{page_id}/blocks/{block_id}", response_model=BlockOut)
async def update_block(
    site_id: str,
    page_id: str,
    block_id: str,
    body: BlockUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Update a single block. Snapshots are throttled so a burst of property
    edits coalesces into a single revision.
    """
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    block = await _get_block(db, block_id, page_id)
    await _snapshot_page(
        db, page_id, site_id, note="block edited", author_user_id=user.id,
    )
    body_dict = body.dict(exclude_none=True)
    # Preserve template provenance keys when the client omits them (partial props payloads).
    if "props" in body_dict and isinstance(body_dict["props"], dict):
        old_props = dict(block.props or {})
        new_props = dict(body_dict["props"])
        for key, val in old_props.items():
            if key.startswith("_template") and key not in new_props:
                new_props[key] = val
        body_dict["props"] = new_props
    for k, v in body_dict.items():
        setattr(block, k, v)
    block.updated_at = datetime.utcnow()
    await _touch_site_content(db, site_id, page_id)
    await db.commit()
    await db.refresh(block)
    return block


@router.delete("/{site_id}/pages/{page_id}/blocks/{block_id}", status_code=204)
async def delete_block(
    site_id: str,
    page_id: str,
    block_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    block = await _get_block(db, block_id, page_id)
    await _snapshot_page(
        db, page_id, site_id, note="block deleted", author_user_id=user.id, force=True,
    )
    await db.delete(block)
    await _touch_site_content(db, site_id, page_id)
    await db.commit()


@router.post("/{site_id}/pages/{page_id}/blocks/reorder")
async def reorder_blocks(
    site_id: str,
    page_id: str,
    body: BlockReorderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    await _get_page(db, page_id, site_id)
    await _snapshot_page(
        db, page_id, site_id, note="blocks reordered", author_user_id=user.id,
    )
    now = datetime.utcnow()
    for item in body.items:
        result = await db.execute(select(WebsiteBlock).where(WebsiteBlock.id == item.id))
        block = result.scalar_one_or_none()
        if block:
            block.sort_order = item.sort_order
            block.updated_at = now
    await _touch_site_content(db, site_id, page_id)
    await db.commit()
    return {"ok": True}


@router.post("/{site_id}/pages/{page_id}/blocks/{block_id}/duplicate", response_model=BlockOut)
async def duplicate_block(
    site_id: str,
    page_id: str,
    block_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    block = await _get_block(db, block_id, page_id)
    await _snapshot_page(
        db, page_id, site_id, note="block duplicated", author_user_id=user.id,
    )
    new_block = WebsiteBlock(
        id=uuid.uuid4(),
        page_id=UUID(page_id),
        block_type=block.block_type,
        label=(block.label or "") + " (copy)",
        props=dict(block.props),
        style_overrides=dict(block.style_overrides),
        visible=block.visible,
        visible_on_mobile=block.visible_on_mobile,
        visible_on_tablet=block.visible_on_tablet,
        visible_on_desktop=block.visible_on_desktop,
        animation=block.animation,
        animation_delay=block.animation_delay,
        sort_order=block.sort_order + 1,
    )
    db.add(new_block)
    await db.commit()
    await db.refresh(new_block)
    return new_block


# ── AI: Text Generation ───────────────────────────────────────────────────────

@router.post("/{site_id}/ai/text", response_model=AITextResponse)
async def ai_generate_text(
    site_id: str,
    body: AITextRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Generate text content with AI. Integrates with OpenAI GPT-4o.
    Falls back to contextual demo content when API key is not configured.
    """
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    try:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            import httpx
            messages = [
                {"role": "system", "content": (
                    f"You are a professional copywriter generating website content. "
                    f"Tone: {body.tone}. Field: {body.field or 'general'}. "
                    f"Block type: {body.block_type or 'general'}. "
                    f"Context: {body.context or ''}. "
                    "Return ONLY the text, no explanations. Keep it concise and impactful."
                )},
                {"role": "user", "content": body.prompt},
            ]
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "gpt-4o", "messages": messages, "n": 3, "max_tokens": 300},
                )
                data = resp.json()
                choices = data.get("choices", [])
                texts = [c["message"]["content"].strip() for c in choices if c.get("message")]
                return AITextResponse(result=texts[0] if texts else "", alternatives=texts[1:])
    except Exception:
        pass

    # Demo fallback with extended tone support
    field = body.field or "general"
    tone_map = {
        "professional":  ["Elevate your business with cutting-edge solutions.", "Trusted by thousands of businesses worldwide.", "Your success starts here."],
        "friendly":      ["Hey there! We're so excited to work with you!", "Let's build something amazing together!", "Join our growing family today!"],
        "bold":          ["Dominate your market.", "No limits. No boundaries. Just results.", "The future belongs to the bold."],
        "luxury":        ["Exclusively crafted for those who expect the finest.", "Uncompromising quality. Timeless elegance.", "Experience excellence redefined."],
        "minimalist":    ["Simple. Effective. Yours.", "Less noise. More results.", "Just what you need. Nothing more."],
        "gen_z":         ["No cap, this actually slaps 🔥", "It's giving main character energy fr fr", "Bestie, your glow-up starts here ✨"],
        "empathetic":    ["We understand how you feel — and we're here to help.", "Your challenges matter to us. Let's solve them together.", "Because you deserve solutions that truly work for you."],
        "casual":        ["Let's keep it real — this just works.", "Honestly? You're going to love this.", "No fluff, no jargon. Just good stuff."],
        "persuasive":    ["Don't let this opportunity pass you by.", "Thousands already made the switch — what are you waiting for?", "The results speak for themselves."],
        "corporate":     ["Delivering enterprise-grade performance at scale.", "Enabling operational excellence across your organisation.", "Strategic solutions for sustained competitive advantage."],
    }
    results = tone_map.get(body.tone, tone_map["professional"])
    return AITextResponse(result=results[0], alternatives=results[1:])


# ── AI: Screenshot to UI ──────────────────────────────────────────────────────

@router.post("/{site_id}/ai/screenshot-to-ui", response_model=AIScreenshotResponse)
async def ai_screenshot_to_ui(
    site_id: str,
    body: AIScreenshotRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Analyze a screenshot with GPT-4 Vision and convert it to editable blocks.
    """
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    try:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            import httpx
            prompt = (
                "Analyze this website screenshot and return a JSON object with these fields:\n"
                "1. detected_sections: list of section names you see (e.g. hero, nav, features, testimonials, cta, footer)\n"
                "2. suggested_blocks: list of block configs with {block_type, props: {headline, subtitle, layout}}\n"
                "3. detected_colors: top 5 hex colors from the design\n"
                "4. detected_fonts: font family names if identifiable\n"
                "5. website_type: one of ecommerce|portfolio|blog|corporate|landing|restaurant|saas\n"
                "6. confidence: 0.0-1.0\n"
                "Return ONLY valid JSON."
            )
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "gpt-4o",
                        "messages": [{
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{body.image_base64}"}},
                            ],
                        }],
                        "max_tokens": 1500,
                    },
                )
                content = resp.json()["choices"][0]["message"]["content"]
                # Strip markdown fences if present
                content = content.strip().lstrip("```json").lstrip("```").rstrip("```")
                data = json.loads(content)
                return AIScreenshotResponse(**data)
    except Exception:
        pass

    # Demo fallback
    return AIScreenshotResponse(
        detected_sections=["nav", "hero", "features", "testimonials", "cta", "footer"],
        suggested_blocks=[
            {"block_type": "nav", "props": {"brand": "Your Brand", "links": ["Home", "About", "Services", "Contact"]}},
            {"block_type": "hero", "props": {"headline": "Welcome to Your Website", "subtitle": "We help you grow", "bg_style": "gradient", "cta_primary": "Get Started", "cta_secondary": "Learn More"}},
            {"block_type": "features", "props": {"title": "Why Choose Us", "layout": "grid-3", "features": [{"icon": "Zap", "title": "Fast", "desc": "Blazing fast performance"}, {"icon": "Shield", "title": "Secure", "desc": "Enterprise-grade security"}, {"icon": "Star", "title": "Reliable", "desc": "99.9% uptime guarantee"}]}},
            {"block_type": "testimonials", "props": {"title": "What Customers Say", "layout": "carousel"}},
            {"block_type": "cta", "props": {"headline": "Ready to Get Started?", "subtitle": "Join thousands of happy customers", "cta_label": "Start Free Trial"}},
            {"block_type": "footer", "props": _footer_props_standard()},
        ],
        detected_colors=["#2563eb", "#1e40af", "#f59e0b", "#111827", "#ffffff"],
        detected_fonts=["Inter", "system-ui"],
        website_type=body.website_type or "corporate",
        confidence=0.78,
    )


# ── AI: URL Clone ─────────────────────────────────────────────────────────────

@router.post("/{site_id}/ai/url-clone", response_model=AIUrlCloneResponse)
async def ai_url_clone(
    site_id: str,
    body: AIUrlCloneRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Fetch a URL, extract its design language, and generate a similar-styled block config.
    """
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    try:
        import os, httpx
        # Fetch the URL's HTML to extract meta colors/fonts
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0 (compatible; AsureBot/1.0)"}
            resp = await client.get(body.url, headers=headers)
            html = resp.text[:50000]  # cap at 50KB

        # Use GPT to analyze if key is present
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            prompt = (
                f"Analyze this HTML/CSS from {body.url} and return a JSON object with:\n"
                "1. style_config: {primary_color, secondary_color, accent_color, bg_color, font_heading, font_body, border_radius, spacing}\n"
                "2. detected_blocks: list of block types detected [{block_type, props}]\n"
                "3. color_palette: top 6 hex colors\n"
                "4. typography: {heading_font, body_font, heading_size, body_size}\n"
                "5. layout_notes: brief description of the layout style\n"
                "Return ONLY valid JSON.\n\nHTML snippet:\n" + html[:10000]
            )
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "max_tokens": 1000},
                )
                content = r.json()["choices"][0]["message"]["content"].strip().lstrip("```json").lstrip("```").rstrip("```")
                data = json.loads(content)
                return AIUrlCloneResponse(**data)
    except Exception:
        pass

    return AIUrlCloneResponse(
        style_config={"primary_color": "#2563eb", "secondary_color": "#1e40af", "accent_color": "#f59e0b", "bg_color": "#ffffff", "font_heading": "Inter", "font_body": "Inter", "border_radius": "rounded", "spacing": "comfortable"},
        detected_blocks=[
            {"block_type": "nav", "props": {}},
            {"block_type": "hero", "props": {"bg_style": "gradient"}},
            {"block_type": "features", "props": {"layout": "grid-3"}},
            {"block_type": "cta", "props": {}},
            {"block_type": "footer", "props": _footer_props_standard()},
        ],
        color_palette=["#2563eb", "#1e40af", "#f59e0b", "#111827", "#f9fafb", "#ffffff"],
        typography={"heading_font": "Inter", "body_font": "Inter", "heading_size": "48px", "body_size": "16px"},
        layout_notes="Clean, modern corporate layout with full-width sections, centered hero, and card-based features grid.",
    )


# ── AI: UX Review ─────────────────────────────────────────────────────────────

@router.post("/{site_id}/ai/ux-review", response_model=AIUxReviewResponse)
async def ai_ux_review(
    site_id: str,
    body: AIUxReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    style = site.style_config or {}
    primary = style.get("primary_color", "#6d28d9")
    bg = style.get("bg_color", "#ffffff")

    issues = []
    suggestions = []
    strengths = []
    score = 75

    # Basic heuristic checks
    page_count = len(site.pages)
    if page_count == 0:
        issues.append({"type": "structure", "severity": "high", "message": "No pages created yet. Add at least a Home page."})
        score -= 15
    else:
        strengths.append(f"Site has {page_count} page(s) configured.")

    if not site.seo_title:
        issues.append({"type": "seo", "severity": "medium", "message": "Missing global SEO title. Add a descriptive title for search engines."})
        score -= 5
    if not site.seo_description:
        issues.append({"type": "seo", "severity": "medium", "message": "Missing meta description. Add a 150-160 character description."})
        score -= 5
    if not site.logo_url:
        issues.append({"type": "branding", "severity": "low", "message": "No logo uploaded. A logo builds brand recognition."})
        score -= 3
    if not site.favicon_url:
        issues.append({"type": "branding", "severity": "low", "message": "No favicon set. Favicons improve browser tab recognition."})
        score -= 2

    suggestions.extend([
        {"type": "conversion", "priority": "high", "message": "Add a strong CTA block above the fold on your homepage."},
        {"type": "trust", "priority": "medium", "message": "Add testimonials or social proof to increase credibility."},
        {"type": "performance", "priority": "medium", "message": "Compress all images before uploading for faster load times."},
        {"type": "accessibility", "priority": "high", "message": "Ensure all images have descriptive alt text."},
        {"type": "mobile", "priority": "high", "message": "Test your site on mobile — check that text is readable and CTAs are tappable."},
    ])

    strengths.extend(["Consistent branding colors applied.", "Drag-and-drop layout is well-structured."])

    return AIUxReviewResponse(
        score=max(0, min(100, score)),
        issues=issues,
        suggestions=suggestions,
        strengths=strengths,
        priority_fixes=[i["message"] for i in issues if i["severity"] == "high"],
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _download_and_save_image(db: AsyncSession, site_id: str, vendor_id: UUID, external_url: str, prompt: str = "", source: str = "ai") -> str:
    """Download an external image and persist it to the media library."""
    import httpx as _httpx
    from app.services.media_upload import get_file_service

    async with _httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        r = await client.get(external_url)
        r.raise_for_status()
        content = r.content

    ct = r.headers.get("content-type", "image/jpeg")
    ext = ".jpg"
    if "png" in ct:
        ext = ".png"
    elif "webp" in ct:
        ext = ".webp"
    elif "gif" in ct:
        ext = ".gif"

    local_url = await get_file_service().upload_bytes(
        content,
        f"websites/{site_id}",
        ext,
        ct,
    )

    # Persist to media table
    media = WebsiteMedia(
        id=uuid.uuid4(),
        site_id=UUID(site_id),
        vendor_id=vendor_id,
        filename=prompt[:80] or f"{source}_{uuid.uuid4().hex}{ext}",
        original_url=local_url,
        file_type="image",
        file_size=len(content),
        adjustments={},
        ai_tags=["ai-generated", source],
    )
    db.add(media)
    await db.commit()
    return local_url


# ── AI: Image prompt builder ───────────────────────────────────────────────────

def _build_image_prompt(prompt: str, style: str, block_context: Optional[str] = None, site_context: Optional[str] = None) -> tuple[str, str]:
    """Build a highly specific, quality-rich image prompt + negative prompt for DALL-E."""

    style_details = {
        "photorealistic": (
            "ultra-photorealistic professional photograph, shot on Sony A7R V, 50mm lens, "
            "natural soft lighting from the left, rule of thirds composition, shallow depth of field f/1.8, "
            "rich color grading, 8K resolution, perfect focus, award-winning commercial photography quality, "
            "clean background, commercial grade"
        ),
        "illustration": (
            "professional digital illustration, vector art, clean sharp lines, vibrant color palette, "
            "modern flat design, suitable for website hero, Dribbble quality, high detail, "
            "gradient shading, smooth rendering, SVG-quality precision"
        ),
        "minimalist": (
            "minimalist design, clean white or light background, simple geometric shapes, "
            "subtle shadows, plenty of white space, modern scandinavian aesthetic, "
            "professional brand photography, high-end lifestyle, calm and sophisticated"
        ),
        "abstract": (
            "premium abstract art, flowing organic shapes, rich gradient colors, "
            "dynamic composition, modern generative art, suitable for website backgrounds, "
            "vibrant yet sophisticated, high-end visual design, 4K quality"
        ),
        "3d": (
            "photorealistic 3D render, Octane or Blender cycles render, "
            "dramatic studio lighting with HDRI, subsurface scattering, ambient occlusion, "
            "ultra-high detail, 8K texture resolution, professional product visualization quality, "
            "cinematic depth of field"
        ),
        "watercolor": (
            "beautiful watercolor painting, soft washes of color, organic brush strokes, "
            "visible paper texture, pastel tones, elegant artistic style, "
            "professional illustration quality, emotionally evocative"
        ),
        "cinematic": (
            "cinematic photography, anamorphic lens flare, golden hour or blue hour lighting, "
            "deep shadows, rich contrast, film-like color grading (Kodak Portra 400), "
            "editorial magazine quality, dramatic mood, shallow focus"
        ),
        "flat": (
            "modern flat design illustration, bold solid colors, geometric shapes, "
            "clean lines, no gradients or shadows, icon-quality precision, "
            "bright and friendly palette, suitable for web UI, SVG-level clarity"
        ),
        "glassmorphism": (
            "glassmorphism aesthetic, frosted glass effect, translucent surfaces, "
            "vivid gradient backgrounds, soft blur, modern UI design aesthetic, "
            "premium digital art, vibrant color through glass"
        ),
        "neon": (
            "neon glow aesthetic, dark background, vibrant neon accent lights, "
            "cyberpunk-inspired, electric blue and pink tones, futuristic atmosphere, "
            "high contrast, dramatic glow effects, premium digital art"
        ),
    }.get(style, "professional quality, high resolution, suitable for commercial website use")

    block_hints = {
        "hero": "wide format, suitable as a hero banner or full-width header image, visually striking",
        "product": "clean product photography, isolated subject, professional commercial quality, white or neutral background",
        "team": "professional portrait photography, natural expression, modern office or studio background",
        "about": "authentic lifestyle photography, warm tones, human connection, storytelling",
        "gallery": "artistic composition, beautiful lighting, gallery-worthy photography",
        "testimonial": "warm friendly portrait, approachable expression, professional background",
        "background": "seamless pattern or texture, suitable for webpage background, tileable, subtle",
    }.get(block_context or "", "suitable for website use, web-optimized composition")

    site_ctx = f" Context: {site_context}." if site_context else ""
    full_prompt = (
        f"{prompt}. "
        f"Style: {style_details}. "
        f"{block_hints}.{site_ctx} "
        f"No text overlays, no watermarks, no borders, web-optimized."
    )

    negative = (
        "blurry, out of focus, low quality, pixelated, distorted, amateur, "
        "watermark, text overlay, logo, border, frame, low resolution, "
        "bad anatomy, ugly, deformed, oversaturated, fake-looking, "
        "stock photo cliché, boring, generic"
    )

    return full_prompt, negative


async def _pexels_search(prompt: str, aspect_ratio: str = "16:9") -> Optional[str]:
    """Search Pexels for a relevant stock photo. Returns URL or None."""
    import os, httpx
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        return None
    try:
        # Extract key subject words (first 5 words)
        query = " ".join(prompt.split()[:6])
        orientation = "landscape" if aspect_ratio in ("16:9", "3:2") else ("portrait" if aspect_ratio == "9:16" else "square")
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.pexels.com/v1/search",
                headers={"Authorization": api_key},
                params={"query": query, "per_page": 5, "orientation": orientation, "size": "large"},
            )
            data = r.json()
            photos = data.get("photos", [])
            if photos:
                photo = photos[0]
                src = photo.get("src", {})
                return src.get("large2x") or src.get("large")
    except Exception:
        pass
    return None


# ── AI: Image Generation ──────────────────────────────────────────────────────

@router.post("/{site_id}/ai/generate-image")
async def ai_generate_image(
    site_id: str,
    body: AIImageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    full_prompt, _neg = _build_image_prompt(
        body.prompt, body.style or "photorealistic",
        body.block_context, body.site_context
    )

    try:
        import os, httpx
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            size_map = {"16:9": "1792x1024", "1:1": "1024x1024", "4:3": "1024x1024", "9:16": "1024x1792", "3:2": "1792x1024"}
            size = size_map.get(body.aspect_ratio or "16:9", "1792x1024")
            async with httpx.AsyncClient(timeout=90) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "dall-e-3",
                        "prompt": full_prompt[:3900],  # DALL-E limit
                        "n": 1,
                        "size": size,
                        "quality": "hd",
                        "style": "vivid",  # vivid = more dramatic/detailed
                        "response_format": "url",
                    },
                )
                data = resp.json()
                if "data" in data and data["data"]:
                    temp_url = data["data"][0]["url"]
                    try:
                        local_url = await _download_and_save_image(db, site_id, vendor.id, temp_url, prompt=body.prompt, source="dalle")
                        return {"url": local_url, "prompt": body.prompt, "style": body.style, "saved": True}
                    except Exception:
                        return {"url": temp_url, "prompt": body.prompt, "style": body.style, "saved": False}
    except Exception:
        pass

    # Fallback 1: Pexels (if API key set — subject-matched real photos)
    try:
        pexels_url = await _pexels_search(body.prompt, body.aspect_ratio or "16:9")
        if pexels_url:
            try:
                local_url = await _download_and_save_image(db, site_id, vendor.id, pexels_url, prompt=body.prompt, source="pexels")
                return {"url": local_url, "prompt": body.prompt, "style": body.style, "saved": True, "source": "pexels"}
            except Exception:
                return {"url": pexels_url, "prompt": body.prompt, "style": body.style, "saved": False, "source": "pexels"}
    except Exception:
        pass

    # Fallback 2: deterministic picsum seed
    seed = abs(hash(body.prompt)) % 1000
    size_pix = {"16:9": "1280/720", "1:1": "800/800", "9:16": "720/1280", "3:2": "1200/800"}.get(body.aspect_ratio or "16:9", "1280/720")
    fallback_url = f"https://picsum.photos/seed/{seed}/{size_pix}"
    return {"url": fallback_url, "prompt": body.prompt, "style": body.style, "saved": False}


# ── AI: Enhance Image Prompt ───────────────────────────────────────────────────

@router.post("/{site_id}/ai/enhance-prompt", response_model=AIEnhancePromptResponse)
async def ai_enhance_prompt(
    site_id: str,
    body: AIEnhancePromptRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Enhance a simple image prompt into a rich, detailed description for better AI image generation."""
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    try:
        import os, httpx
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            system = (
                "You are an expert AI image prompt engineer specializing in website visuals. "
                "Given a simple description, expand it into a detailed, specific image generation prompt "
                "that will produce stunning, professional website imagery. "
                "Return ONLY valid JSON with keys: enhanced_prompt (str), negative_prompt (str), "
                "style_suggestion (str: photorealistic|3d|illustration|cinematic|minimalist|abstract), "
                "tips (list of 2-3 short improvement tips)."
            )
            user_msg = (
                f"Simple prompt: '{body.prompt}'\n"
                f"Style: {body.style or 'auto'}\n"
                f"Block context: {body.block_context or 'general website image'}\n"
                f"Site description: {body.site_description or 'professional website'}"
            )
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "gpt-4o", "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_msg},
                    ], "max_tokens": 500, "response_format": {"type": "json_object"}},
                )
                data = resp.json()["choices"][0]["message"]["content"]
                result = json.loads(data)
                return AIEnhancePromptResponse(**result)
    except Exception:
        pass

    # Fallback: local enhancement
    enhanced, neg = _build_image_prompt(body.prompt, body.style or "photorealistic", body.block_context)
    return AIEnhancePromptResponse(
        enhanced_prompt=enhanced[:600],
        negative_prompt=neg,
        style_suggestion=body.style or "photorealistic",
        tips=["Be specific about subject, lighting, and mood", "Mention colors and composition", "Add quality markers like 'professional' or 'award-winning'"],
    )


# ── AI: SEO Generator ─────────────────────────────────────────────────────────

@router.post("/{site_id}/ai/seo", response_model=AISEOResponse)
async def ai_generate_seo(
    site_id: str,
    body: AISEORequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Generate SEO metadata (title, description, keywords, OG tags) for a page."""
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    try:
        import os, httpx
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            system = (
                "You are an SEO expert. Generate optimized metadata for a website page. "
                "Return ONLY valid JSON with keys: seo_title (50-60 chars), seo_description (150-160 chars), "
                "seo_keywords (comma-separated, 5-8 keywords), og_title (str), og_description (str), "
                "focus_keyword (str), readability_tips (list of 3 short tips)."
            )
            prompt = (
                f"Page: '{body.page_title}', Type: {body.page_type}\n"
                f"Site: {site.name}\n"
                f"Description: {body.site_description or site.description or 'professional website'}\n"
                f"Keywords hint: {body.keywords_hint or 'auto-detect'}"
            )
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "gpt-4o", "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ], "max_tokens": 400, "response_format": {"type": "json_object"}},
                )
                data = resp.json()["choices"][0]["message"]["content"]
                result = json.loads(data)
                return AISEOResponse(**result)
    except Exception:
        pass

    # Fallback
    title = body.page_title
    return AISEOResponse(
        seo_title=f"{title} | {site.name}",
        seo_description=f"Explore {title.lower()} at {site.name}. {body.site_description or 'Professional services tailored to your needs.'}",
        seo_keywords=f"{title.lower()}, {site.name.lower()}, professional, services, quality",
        og_title=f"{title} — {site.name}",
        og_description=f"Discover what {site.name} offers on our {title.lower()} page.",
        focus_keyword=title.split()[0].lower() if title else site.name.lower(),
        readability_tips=["Use short paragraphs (2-3 sentences)", "Include your focus keyword in the first 100 words", "Add internal links to related pages"],
    )


# ── AI: Suggest Blocks ────────────────────────────────────────────────────────

@router.post("/{site_id}/ai/suggest-blocks", response_model=AISuggestBlocksResponse)
async def ai_suggest_blocks(
    site_id: str,
    body: AISuggestBlocksRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Suggest an optimal block layout for a given page type and industry."""
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    try:
        import os, httpx
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            system = (
                "You are a website UX architect. Suggest the optimal block sequence for a webpage. "
                "Available block types: nav, hero, hero_split, hero_minimal, features, features_alternating, "
                "stats, testimonials, team_grid, pricing, faq, cta, contact_form, portfolio_grid, "
                "blog_grid, newsletter, video_embed, trust_logos, timeline, about_split, services_cards, footer. "
                "Return ONLY valid JSON with: blocks (list of {block_type, label, reason}), "
                "reasoning (brief explanation), estimated_sections (int)."
            )
            prompt = (
                f"Page type: {body.page_type}\n"
                f"Industry: {body.industry or 'general'}\n"
                f"Goal: {body.goal or 'general'}\n"
                f"Site: {site.name}"
            )
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "gpt-4o", "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ], "max_tokens": 600, "response_format": {"type": "json_object"}},
                )
                data = resp.json()["choices"][0]["message"]["content"]
                result = json.loads(data)
                return AISuggestBlocksResponse(**result)
    except Exception:
        pass

    # Fallback suggestions per page type
    suggestions = {
        "home": ["nav", "hero", "trust_logos", "features", "stats", "testimonials", "cta", "footer"],
        "about": ["nav", "hero_minimal", "about_split", "team_grid", "timeline", "cta", "footer"],
        "services": ["nav", "hero_minimal", "services_cards", "features_alternating", "pricing", "faq", "cta", "footer"],
        "contact": ["nav", "hero_minimal", "contact_form", "map_embed", "footer"],
        "portfolio": ["nav", "hero", "portfolio_grid", "testimonials", "cta", "footer"],
        "landing": ["hero", "trust_logos", "features", "stats", "testimonials", "pricing", "faq", "cta", "newsletter"],
    }.get(body.page_type, ["nav", "hero", "features", "cta", "footer"])

    blocks = [{"block_type": bt, "label": bt.replace("_", " ").title(), "reason": "Recommended for this page type"} for bt in suggestions]
    return AISuggestBlocksResponse(blocks=blocks, reasoning=f"Standard {body.page_type} page structure", estimated_sections=len(blocks))


# ── AI: Theme from Brand ──────────────────────────────────────────────────────

@router.post("/{site_id}/ai/generate-theme", response_model=AIThemeResponse)
async def ai_generate_theme(
    site_id: str,
    body: AIThemeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    try:
        import os, httpx
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            prompt = (
                f"Generate a complete website theme for this brand:\n"
                f"Description: {body.brand_description}\n"
                f"Industry: {body.industry or 'general'}\n"
                f"Mood: {body.mood or 'professional'}\n\n"
                "Return a JSON object with:\n"
                "1. style_config: {primary_color, secondary_color, accent_color, bg_color, surface_color, text_color, font_heading, font_body, border_radius(sharp|rounded|pill), spacing(compact|comfortable|spacious), animation(none|subtle|expressive), button_style(filled|outline|ghost)}\n"
                "2. color_palette: list of 6 hex color codes\n"
                "3. font_pairing: {heading, body, reason}\n"
                "4. mood_description: 2-3 sentences describing the theme\n"
                "5. suggested_templates: list of 3 template names that fit this brand\n"
                "Return ONLY valid JSON."
            )
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "gpt-4o", "messages": [{"role": "user", "content": prompt}], "max_tokens": 800},
                )
                content = resp.json()["choices"][0]["message"]["content"].strip().lstrip("```json").lstrip("```").rstrip("```")
                data = json.loads(content)
                return AIThemeResponse(**data)
    except Exception:
        pass

    mood_themes = {
        "professional": {
            "style_config": {"primary_color": "#2563eb", "secondary_color": "#1e40af", "accent_color": "#f59e0b", "bg_color": "#ffffff", "surface_color": "#f8fafc", "text_color": "#0f172a", "font_heading": "Inter", "font_body": "Inter", "border_radius": "rounded", "spacing": "comfortable", "animation": "subtle", "button_style": "filled"},
            "color_palette": ["#2563eb", "#1e40af", "#f59e0b", "#0f172a", "#f8fafc", "#ffffff"],
            "font_pairing": {"heading": "Inter", "body": "Inter", "reason": "Clean and professional, universally readable."},
            "mood_description": "Professional and trustworthy. Blue tones convey reliability and expertise.",
            "suggested_templates": ["Corporate Pro", "Business Clean", "Agency Bold"],
        },
        "luxury": {
            "style_config": {"primary_color": "#1a1a1a", "secondary_color": "#d4af37", "accent_color": "#c9a96e", "bg_color": "#f5f0e8", "surface_color": "#ede8de", "text_color": "#1a1a1a", "font_heading": "Playfair Display", "font_body": "Lato", "border_radius": "sharp", "spacing": "spacious", "animation": "subtle", "button_style": "outline"},
            "color_palette": ["#1a1a1a", "#d4af37", "#c9a96e", "#f5f0e8", "#ede8de", "#ffffff"],
            "font_pairing": {"heading": "Playfair Display", "body": "Lato", "reason": "Elegant serif headings paired with clean sans-serif body."},
            "mood_description": "Sophisticated and exclusive. Gold accents on dark tones evoke luxury and prestige.",
            "suggested_templates": ["Luxury Boutique", "Elite Brand", "Premium Collection"],
        },
        "playful": {
            "style_config": {"primary_color": "#64C3A0", "secondary_color": "#13624A", "accent_color": "#f59e0b", "bg_color": "#f3fbf7", "surface_color": "#ffffff", "text_color": "#1e1b4b", "font_heading": "Nunito", "font_body": "Nunito", "border_radius": "pill", "spacing": "comfortable", "animation": "expressive", "button_style": "filled"},
            "color_palette": ["#64C3A0", "#13624A", "#f59e0b", "#1e1b4b", "#def2ea", "#f3fbf7"],
            "font_pairing": {"heading": "Nunito", "body": "Nunito", "reason": "Friendly, rounded font that feels approachable and fun."},
            "mood_description": "Vibrant and energetic. Bold colors and playful shapes create a memorable experience.",
            "suggested_templates": ["Fun & Bold", "Creative Agency", "Startup Vibrant"],
        },
    }

    theme = mood_themes.get(body.mood or "professional", mood_themes["professional"])
    return AIThemeResponse(**theme)


# ── AI: Media Adjuster ────────────────────────────────────────────────────────

@router.post("/{site_id}/ai/media-adjust", response_model=AIMediaAdjustResponse)
async def ai_media_adjust(
    site_id: str,
    body: AIMediaAdjustRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Apply AI-powered adjustments to an image. Returns adjusted image URL.
    Integrates with Cloudinary, Imgix, or similar transformation APIs.
    """
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    # Build transformation URL (Cloudinary-style if configured)
    try:
        import os
        cloudinary_base = os.environ.get("CLOUDINARY_BASE_URL")
        if cloudinary_base:
            transforms = []
            adj = body.adjustments
            if adj.get("brightness"):
                transforms.append(f"br_{adj['brightness']}")
            if adj.get("contrast"):
                transforms.append(f"co_{adj['contrast']}")
            if adj.get("saturation"):
                transforms.append(f"sa_{adj['saturation']}")
            if adj.get("sharpness"):
                transforms.append(f"e_sharpen:{adj['sharpness']}")
            if adj.get("remove_background"):
                transforms.append("e_background_removal")
            if adj.get("color_grade"):
                grade_map = {"cinematic": "e_art:athena", "vivid": "e_vibrance:50", "matte": "e_gamma:50", "vintage": "e_art:primavera"}
                transforms.append(grade_map.get(adj["color_grade"], ""))
            if adj.get("ai_enhance"):
                transforms.append("e_improve:indoor")

            transform_str = "/".join(t for t in transforms if t)
            adjusted_url = f"{cloudinary_base}/{transform_str}/{body.image_url.split('/')[-1]}"
            return AIMediaAdjustResponse(adjusted_url=adjusted_url, adjustments_applied=body.adjustments)
    except Exception:
        pass

    return AIMediaAdjustResponse(
        adjusted_url=body.image_url,
        adjustments_applied=body.adjustments,
        preview_url=body.image_url,
    )


# ── Media Library ─────────────────────────────────────────────────────────────

@router.get("/{site_id}/media", response_model=List[MediaOut])
async def list_media(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site_readable(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteMedia)
        .where(WebsiteMedia.site_id == site_id)
        .order_by(WebsiteMedia.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{site_id}/media", response_model=MediaOut, status_code=201)
async def upload_media(
    site_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    from pathlib import Path
    from app.services.media_upload import save_media_file

    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    ext = Path(file.filename or "image.jpg").suffix.lower()
    content = await file.read()
    await file.seek(0)
    url = await save_media_file(file, f"websites/{site_id}")
    fname = file.filename or f"upload{ext}"
    media = WebsiteMedia(
        id=uuid.uuid4(),
        site_id=UUID(site_id),
        vendor_id=vendor.id,
        filename=file.filename or fname,
        original_url=url,
        file_type="image" if ext in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"} else "video",
        file_size=len(content),
        adjustments={},
        ai_tags=[],
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return media


@router.post("/{site_id}/media/save-url", response_model=MediaOut, status_code=201)
async def save_external_url_as_media(
    site_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Download an external image URL and save it permanently to the media library."""
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    url = body.get("url", "")
    label = body.get("label", "")
    if not url:
        raise HTTPException(400, "url is required")

    # If it's already a local URL, just store it directly without downloading
    if url.startswith("/uploads/"):
        media = WebsiteMedia(
            id=uuid.uuid4(),
            site_id=UUID(site_id),
            vendor_id=vendor.id,
            filename=label or url.split("/")[-1],
            original_url=url,
            file_type="image",
            file_size=0,
            adjustments={},
            ai_tags=[],
        )
        db.add(media)
        await db.commit()
        await db.refresh(media)
        return media

    try:
        local_url = await _download_and_save_image(db, site_id, vendor.id, url, prompt=label, source="saved")
        result = await db.execute(
            select(WebsiteMedia)
            .where(WebsiteMedia.site_id == UUID(site_id), WebsiteMedia.original_url == local_url)
        )
        media = result.scalar_one_or_none()
        if not media:
            raise HTTPException(500, "Failed to save media")
        return media
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to download image: {e}")


@router.patch("/{site_id}/media/{media_id}", response_model=MediaOut)
async def update_media(
    site_id: str,
    media_id: str,
    body: MediaUpdateBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    filename = (body.filename or "").strip()
    if not filename:
        raise HTTPException(400, "filename is required")
    if "/" in filename or "\\" in filename:
        raise HTTPException(400, "filename cannot contain path separators")

    result = await db.execute(
        select(WebsiteMedia).where(WebsiteMedia.id == media_id, WebsiteMedia.site_id == site_id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(404, "Media not found")
    media.filename = filename[:300]
    await db.commit()
    await db.refresh(media)
    return media


@router.delete("/{site_id}/media/{media_id}", status_code=204)
async def delete_media(
    site_id: str,
    media_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteMedia).where(WebsiteMedia.id == media_id, WebsiteMedia.site_id == site_id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(404, "Media not found")
    await db.delete(media)
    await db.commit()


# ── Template Presets ──────────────────────────────────────────────────────────


def _footer_props_standard() -> Dict[str, Any]:
    """Full multi-column footer — stored on each block so preview/business front match template data (no UI-side defaults)."""
    return {
        "show_legal": True,
        "show_social": True,
        "social_links": {
            "twitter": "",
            "facebook": "",
            "instagram": "",
            "youtube": "",
        },
        "copyright": "© 2026 Your Company. All rights reserved.",
        "footer_columns": [
            {"title": "Company", "links": ["About", "Careers", "Contact"]},
            {"title": "Product", "links": ["Features", "Pricing", "Demo"]},
            {"title": "Resources", "links": ["Blog", "Docs", "Support"]},
            {"title": "Legal", "links": ["Terms", "Privacy", "Refund"]},
        ],
    }


def _footer_props_minimal() -> Dict[str, Any]:
    return {
        "minimal": True,
        "copyright": "© 2026 Your Company. All rights reserved.",
        "footer_columns": [
            {"title": "Work", "links": ["Portfolio", "Services"]},
            {"title": "Studio", "links": ["About", "Contact"]},
        ],
    }


# Healthy-living starter copy & imagery (generic wellness retail defaults).
WELLNESS_MARQUEE_TEXT = (
    "100% Plant-based,Wholesome,Naturally Grown,Nutritionally Balanced,"
    "Deliciously Healthy,Minimally Processed"
)
WELLNESS_CATEGORY_TITLES = [
    "Wholesome Snacks",
    "Gourmet Groceries",
    "Healthy Beverages",
    "Breakfast Cereals",
    "Nut Butters & Spreads",
    "Pickles & Powders",
    "Bars & Chikkis",
    "Seeds & Nuts",
    "Fruit Chews",
]

# Futuristic supermarket starter copy (NOVA Mart) — neon, automation-led messaging.
SUPERMARKET_MARQUEE_TEXT = (
    "30-minute delivery,AI-powered smart lists,Scan & go checkout,"
    "Live stock you can trust,Carbon-neutral routes,Members save more"
)


def _supermarket_footer_props() -> Dict[str, Any]:
    return {
        "show_legal": True,
        "copyright": "© 2026 NOVA Mart. Tomorrow's grocery, today.",
        "footer_columns": [
            {"title": "Shop", "links": ["Fresh Produce", "Pantry", "Frozen", "Beverages"]},
            {"title": "Services", "links": ["Same-day Delivery", "Click & Collect", "Smart Lists", "Rewards"]},
            {"title": "Company", "links": ["About", "Sustainability", "Careers", "Press"]},
            {"title": "Help", "links": ["Track Order", "Returns", "Contact", "FAQ"]},
        ],
    }


WEBSITE_TEMPLATES = {
    "portfolio": {
        "id": "portfolio", "name": "Creative Portfolio", "description": "Showcase your work beautifully",
        "thumbnail": "https://images.unsplash.com/photo-1545235617-9465d2a55698?w=600",
        "category": "creative",
        "default_style": {
            "primary_color": "#111827",
            "secondary_color": "#374151",
            "accent_color": "#8B5CF6",
            "bg_color": "#FFFFFF",
            "surface_color": "#F9FAFB",
            "text_color": "#111827",
            "font_heading": "Playfair Display",
            "font_body": "Inter",
            "border_radius": "sharp",
            "spacing": "spacious",
            "animation": "subtle",
            "button_style": "outline",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Your Name", "layout": "minimal"}},
                {"block_type": "hero", "props": {"headline": "Hi, I'm a Designer", "subtitle": "I craft beautiful digital experiences", "layout": "split", "bg_style": "minimal"}},
                {"block_type": "portfolio_grid", "props": {"title": "Selected Work", "columns": 3}},
                {"block_type": "about_split", "props": {"title": "About Me"}},
                {"block_type": "services_list", "props": {"title": "Services"}},
                {"block_type": "contact_form", "props": {"title": "Let's Work Together"}},
                {"block_type": "footer", "props": _footer_props_minimal()},
            ]},
            {"title": "Work", "slug": "work", "page_type": "custom", "blocks": [
                {"block_type": "portfolio_grid", "props": {"title": "All Projects", "columns": 3, "filterable": True}},
            ]},
            {"title": "Contact", "slug": "contact", "page_type": "contact", "blocks": [
                {"block_type": "contact_form", "props": {"title": "Get In Touch", "full_page": True}},
            ]},
        ],
    },
    "storefront_fashion": {
        "id": "storefront_fashion",
        "name": "Atelier",
        "description": "Lookbook-led editorial fashion layout with seasonal stories, size/color variants, and a refined product page.",
        "thumbnail": "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800",
        "category": "fashion",
        "tier": "full",
        "tags": ["Fashion", "Apparel", "Accessories", "Lookbook"],
        "preview_palette": ["#221D1A", "#E45E25", "#F9F7F5", "#A89C8F", "#221D1A"],
        "default_style": {
            "primary_color": "#221D1A", "secondary_color": "#E45E25", "accent_color": "#E45E25",
            "bg_color": "#F9F7F5", "surface_color": "#FFFFFF", "text_color": "#221D1A",
            "font_heading": "Fraunces", "font_body": "Inter",
            "border_radius": "none", "spacing": "spacious", "animation": "subtle",
            "shadow_style": "none", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "announcement_bar", "props": {"text": "Free shipping over $150 · Easy 30-day returns · Powered by your ERP", "color": "#221D1A"}},
                {"block_type": "nav", "props": {
                    "brand": "Atelier",
                    "tagline": "Editorial fashion & apparel",
                    "show_cart": True,
                    "show_search": True,
                    "nav_links": [
                        {"label": "Women", "url": "/women"},
                        {"label": "Men", "url": "/men"},
                        {"label": "Accessories", "url": "/accessories"},
                        {"label": "Lookbook", "url": "/women"},
                        {"label": "About", "url": "/about"},
                    ],
                }},
                {"block_type": "hero_split", "props": {
                    "layout": "split",
                    "bg_style": "minimal",
                    "eyebrow": "Autumn/Winter Collection",
                    "eyebrow_plain": True,
                    "headline": "Quiet luxury,",
                    "headline_line2": "built to last.",
                    "subtitle": "Editorial silhouettes, considered fabrics, made in small runs. Discover pieces designed to outlive the season.",
                    "image_url": "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80",
                    "cta_primary": "Shop the collection",
                    "cta_secondary": "View lookbook",
                    "cta_square": True,
                }},
                {"block_type": "marquee_strip", "props": {
                    "text": "Made in Portugal,Hand-finished,Free returns,Carbon-neutral shipping,Small batch,Since 2014",
                }},
                {"block_type": "category_cards", "props": {
                    "title": "The edit",
                    "eyebrow": "Shop by category",
                    "layout": "editorial",
                    "columns": 3,
                    "categories": [
                        {"title": "Women", "image_url": "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Men", "image_url": "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Accessories", "image_url": "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80"},
                    ],
                }},
                {"block_type": "product_grid", "props": {"title": "New arrivals", "columns": 3, "show_badges": True, "layout": "editorial", "featured_spotlight": True}},
                {"block_type": "about_split", "props": {
                    "layout": "statement",
                    "title": "We make fewer pieces, with more care.",
                    "subtitle": "Our craft",
                    "description": "Every garment is cut and finished in our partner workshop in Porto. We work with mills that have served the same families for generations — and we tell you exactly where each piece comes from.",
                }},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Women", "slug": "women", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Atelier", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Women", "columns": 3, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Men", "slug": "men", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Atelier", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Men", "columns": 3, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Accessories", "slug": "accessories", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Atelier", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Accessories", "columns": 3, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "About", "slug": "about", "page_type": "about", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Atelier"}},
                {"block_type": "about_split", "props": {"title": "About Atelier", "subtitle": "Our craft"}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Contact", "slug": "contact", "page_type": "contact", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Atelier"}},
                {"block_type": "contact_form", "props": {"title": "Get In Touch", "full_page": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
        ],
    },
    "storefront_electronics": {
        "id": "storefront_electronics",
        "name": "Voltage",
        "description": "Spec-driven electronics store with dense product cards, comparison tables, brand filters, and deal banners for tech-savvy shoppers.",
        "thumbnail": "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800",
        "category": "electronics",
        "tier": "full",
        "tags": ["Electronics", "Phones", "Laptops", "Audio", "Tech"],
        "preview_palette": ["#15181D", "#298EF3", "#0C0E11", "#1E2330", "#F3F4F6"],
        "default_style": {
            "primary_color": "#15181D", "secondary_color": "#298EF3", "accent_color": "#298EF3",
            "bg_color": "#0C0E11", "surface_color": "#15181D", "text_color": "#F3F4F6",
            "font_heading": "Space Grotesk", "font_body": "Manrope",
            "border_radius": "none", "spacing": "compact", "animation": "subtle",
            "shadow_style": "none", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Voltage", "show_cart": True, "show_search": True}},
                {"block_type": "announcement_bar", "props": {"text": "Spring Sale \u00b7 up to 25% off select audio \u00b7 2-year warranty included", "color": "#298EF3"}},
                {"block_type": "hero", "props": {"headline": "Power, perfected.", "subtitle": "The fastest mobile chip we\u2019ve ever shipped. 120Hz OLED. Triple 50MP camera.", "bg_style": "image", "image_url": "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1600", "overlay": True, "cta_primary": "Shop phones", "cta_secondary": "Compare models"}},
                {"block_type": "category_cards", "props": {"title": "Shop by category", "columns": 3}},
                {"block_type": "product_grid", "props": {"title": "Top rated this season", "columns": 4, "show_badges": True}},
                {"block_type": "features", "props": {"title": "Why Voltage", "layout": "grid-3"}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Phones", "slug": "phones", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Voltage", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Phones", "columns": 4, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Laptops", "slug": "laptops", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Voltage", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Laptops", "columns": 4, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Audio", "slug": "audio", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Voltage", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Audio", "columns": 4, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Deals", "slug": "deals", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Voltage", "show_cart": True, "show_search": True}},
                {"block_type": "offer_banner", "props": {"headline": "Spring Sale \u2014 up to 25% off", "subtitle": "Limited time deals on top-rated products"}},
                {"block_type": "product_grid", "props": {"title": "On sale now", "columns": 4, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Support", "slug": "support", "page_type": "contact", "show_in_nav": False, "blocks": [
                {"block_type": "nav", "props": {"brand": "Voltage"}},
                {"block_type": "contact_form", "props": {"title": "Support", "full_page": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
        ],
    },
    "storefront_grocery": {
        "id": "storefront_grocery",
        "name": "Wellness Store",
        "description": "Healthy living store — wholesome snacks, gourmet groceries, category highlights, and editorial product cards.",
        "thumbnail": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800",
        "category": "grocery",
        "tier": "full",
        "tags": ["Wellness", "Healthy Food", "Grocery", "Meal Plans", "Organic"],
        "preview_palette": ["#274832", "#E07A5F", "#F9F9F5", "#4A7A58", "#182E20"],
        "default_style": {
            "primary_color": "#274832", "secondary_color": "#4A7A58", "accent_color": "#E07A5F",
            "bg_color": "#F9F9F5", "surface_color": "#FFFFFF", "text_color": "#182E20",
            "font_heading": "DM Serif Display", "font_body": "Inter",
            "border_radius": "rounded", "spacing": "comfortable", "animation": "subtle",
            "shadow_style": "soft", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "announcement_bar", "props": {"text": "Wholesome snacks and groceries — natural ingredients you can trust.", "color": "#274832"}},
                {"block_type": "nav", "props": {"brand": "Wellness Store", "show_cart": True, "show_search": True, "cta_label": "Get started"}},
                {"block_type": "hero_split", "props": {
                    "headline": "Discover wellness essentials",
                    "headline_line2": "for everyday wellness",
                    "subtitle": "Wholesome snacks, gourmet groceries, and pantry staples — plant-based and delicious.",
                    "bg_style": "minimal",
                    "layout": "split",
                    "image_url": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80",
                    "cta_primary": "Shop bestsellers",
                    "cta_secondary": "Browse categories",
                }},
                {"block_type": "marquee_strip", "props": {"text": WELLNESS_MARQUEE_TEXT}},
                {"block_type": "category_cards", "props": {
                    "title": "Shop by category",
                    "eyebrow": "Explore",
                    "layout": "wellness",
                    "columns": 3,
                    "categories": [
                        {"title": "Wholesome Snacks", "image_url": "https://images.unsplash.com/photo-1606851090756-56d7fd5520ce?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Gourmet Groceries", "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Healthy Beverages", "image_url": "https://images.unsplash.com/photo-1556679343-7190518ceeb4?auto=format&fit=crop&w=900&q=80"},
                    ],
                }},
                {"block_type": "product_grid", "props": {"title": "Our bestsellers", "columns": 4, "show_badges": True, "layout": "editorial"}},
                {"block_type": "features", "props": {
                    "title": "Why choose us",
                    "layout": "grid-4",
                    "features": [
                        {"icon": "Leaf", "title": "100% natural ingredients", "desc": "Plant-based, minimally processed — no refined sugar or artificial additives."},
                        {"icon": "Heart", "title": "Ethical sourcing", "desc": "Partnering with small farmers who practice natural, sustainable growing."},
                        {"icon": "Star", "title": "Health & taste", "desc": "Nutritionally balanced recipes that are as delicious as they are wholesome."},
                        {"icon": "Shield", "title": "Transparent & trustworthy", "desc": "No hidden preservatives — what you see is what you get."},
                    ],
                }},
                {"block_type": "timeline", "props": {
                    "title": "Our story",
                    "items": [
                        {"year": "2010", "title": "Starting with workshops", "desc": "Spreading the joy of healthy living through workshops and consultations."},
                        {"year": "2013", "title": "Expanded our range", "desc": "Growing our catalog of guilt-free snacks, groceries, and wholesome pantry staples."},
                        {"year": "2017", "title": "Online store launch", "desc": "Wholesome snacks, gourmet groceries, and pantry staples online."},
                        {"year": "Today", "title": "Growing community", "desc": "A trusted destination for everyday wellness."},
                    ],
                }},
                {"block_type": "faq", "props": {
                    "title": "Frequently asked questions",
                    "faqs": [
                        {"question": "Are your products organic?", "answer": "We source from trusted small farmers who practice natural growing, with no artificial preservatives."},
                    ],
                }},
                {"block_type": "newsletter", "props": {"title": "Sign up to our newsletter", "subtitle": "Recipes, wellness tips, and new launches.", "cta_label": "Subscribe"}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Fruits & Veg", "slug": "fruits-veg", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Pantry", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Fruits & Vegetables", "columns": 6, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Bakery", "slug": "bakery", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Pantry", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Bakery", "columns": 6, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Beverages", "slug": "beverages", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Pantry", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Beverages", "columns": 6, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Snacks", "slug": "snacks", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Pantry", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Snacks", "columns": 6, "show_badges": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Track Order", "slug": "track", "page_type": "custom", "show_in_nav": False, "blocks": [
                {"block_type": "nav", "props": {"brand": "Pantry"}},
                {"block_type": "order_status", "props": {"title": "Track your order", "placeholder": "Enter order number\u2026"}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
        ],
    },
    "storefront_supermarket": {
        "id": "storefront_supermarket",
        "name": "NOVA Mart",
        "description": "Futuristic supermarket — dark neon UI, automation-led messaging, dense department grid, live stock, and 30-minute delivery storytelling.",
        "thumbnail": "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=800&q=80",
        "category": "grocery",
        "tier": "full",
        "tags": ["Supermarket", "Grocery", "Futuristic", "Delivery", "Smart Store"],
        "preview_palette": ["#060911", "#22D3EE", "#7C3AED", "#0F1524", "#E8EEF7"],
        "default_style": {
            "primary_color": "#0B0F1A", "secondary_color": "#7C3AED", "accent_color": "#22D3EE",
            "bg_color": "#060911", "surface_color": "#0F1524", "text_color": "#E8EEF7",
            "font_heading": "Space Grotesk", "font_body": "Manrope",
            "border_radius": "rounded", "spacing": "comfortable", "animation": "subtle",
            "shadow_style": "elevated", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "announcement_bar", "props": {"text": "\u26a1 30-minute delivery in your zone \u00b7 Free over $40 \u00b7 New members get $15 off", "color": "#7C3AED"}},
                {"block_type": "nav", "props": {"brand": "NOVA Mart", "show_cart": True, "show_search": True, "cta_label": "Start shopping", "cta_url": "/produce"}},
                {"block_type": "hero", "props": {
                    "eyebrow": "The smart supermarket",
                    "headline": "Groceries, at the",
                    "headline_line2": "speed of now.",
                    "subtitle": "Live-stocked aisles, AI shopping lists, and 30-minute delivery powered by autonomous routing. Welcome to the store that thinks ahead.",
                    "bg_style": "image",
                    "image_url": "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1600&q=80",
                    "overlay": True, "overlay_opacity": 0.6,
                    "cta_primary": "Shop departments", "cta_secondary": "See live deals",
                    "cta_primary_url": "/produce", "cta_secondary_url": "/deals",
                }},
                {"block_type": "marquee_strip", "props": {"text": SUPERMARKET_MARQUEE_TEXT}},
                {"block_type": "category_cards", "props": {
                    "title": "Shop every aisle",
                    "eyebrow": "Departments",
                    "layout": "grid",
                    "columns": 4,
                    "categories": [
                        {"title": "Fresh Produce", "image_url": "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Dairy & Eggs", "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Bakery", "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Pantry Staples", "image_url": "https://images.unsplash.com/photo-1584473457409-ae5c91d211dd?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Frozen Foods", "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Beverages", "image_url": "https://images.unsplash.com/photo-1556679343-7190518ceeb4?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Snacks & Treats", "image_url": "https://images.unsplash.com/photo-1606851090756-56d7fd5520ce?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Household", "image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80"},
                    ],
                }},
                {"block_type": "product_grid", "props": {"title": "Trending in your area", "subtitle": "Ranked live by what neighbours are buying right now.", "columns": 4, "show_badges": True, "layout": "editorial"}},
                {"block_type": "offer_banner", "props": {"headline": "Flash deals refresh every hour", "subtitle": "Dynamic pricing on overstock and short-dated picks \u2014 grab them before the timer resets.", "cta_label": "Shop deals", "cta_url": "/deals"}},
                {"block_type": "features", "props": {
                    "title": "A supermarket that runs itself",
                    "eyebrow": "Why NOVA",
                    "layout": "grid-4",
                    "features": [
                        {"icon": "Zap", "title": "30-minute delivery", "desc": "Autonomous routing dispatches the moment you check out \u2014 no slots, no waiting."},
                        {"icon": "Sparkles", "title": "AI smart lists", "desc": "We learn your basket and rebuild it weekly, swapping in better-priced staples."},
                        {"icon": "ScanLine", "title": "Scan & go", "desc": "Skip the till. Scan with the app and walk out \u2014 payment settles automatically."},
                        {"icon": "Leaf", "title": "Carbon-neutral", "desc": "Electric fleet and optimised routes offset every order, automatically."},
                    ],
                }},
                {"block_type": "stats", "props": {"stats": [
                    {"value": "12k+", "label": "SKUs in stock"},
                    {"value": "28 min", "label": "Avg delivery"},
                    {"value": "99.2%", "label": "Order accuracy"},
                    {"value": "24/7", "label": "Always open"},
                ]}},
                {"block_type": "testimonials", "props": {"title": "Shoppers who switched"}},
                {"block_type": "newsletter", "props": {"title": "Get tomorrow's deals tonight", "subtitle": "Drop your email for hyper-local offers, restock alerts, and members-only flash sales.", "cta_label": "Notify me"}},
                {"block_type": "footer", "props": _supermarket_footer_props()},
            ]},
            {"title": "Fresh Produce", "slug": "produce", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "NOVA Mart", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Fresh Produce", "subtitle": "Harvested-to-door, restocked live throughout the day.", "columns": 6, "show_badges": True}},
                {"block_type": "footer", "props": _supermarket_footer_props()},
            ]},
            {"title": "Pantry", "slug": "pantry", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "NOVA Mart", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Pantry Staples", "columns": 6, "show_badges": True}},
                {"block_type": "footer", "props": _supermarket_footer_props()},
            ]},
            {"title": "Frozen", "slug": "frozen", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "NOVA Mart", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Frozen Foods", "columns": 6, "show_badges": True}},
                {"block_type": "footer", "props": _supermarket_footer_props()},
            ]},
            {"title": "Beverages", "slug": "beverages", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "NOVA Mart", "show_cart": True, "show_search": True}},
                {"block_type": "product_grid", "props": {"title": "Beverages", "columns": 6, "show_badges": True}},
                {"block_type": "footer", "props": _supermarket_footer_props()},
            ]},
            {"title": "Deals", "slug": "deals", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "NOVA Mart", "show_cart": True, "show_search": True}},
                {"block_type": "offer_banner", "props": {"headline": "Live deals \u2014 prices drop in real time", "subtitle": "Smart pricing on overstock, short-dated, and seasonal lines."}},
                {"block_type": "countdown", "props": {"title": "Next flash drop", "subtitle": "Hourly resets \u2014 don't miss the next batch."}},
                {"block_type": "product_grid", "props": {"title": "On sale right now", "columns": 4, "show_badges": True}},
                {"block_type": "footer", "props": _supermarket_footer_props()},
            ]},
            {"title": "Track Order", "slug": "track", "page_type": "custom", "show_in_nav": False, "blocks": [
                {"block_type": "nav", "props": {"brand": "NOVA Mart"}},
                {"block_type": "order_status", "props": {"title": "Track your order", "subtitle": "Watch your driver in real time.", "placeholder": "Enter order number\u2026"}},
                {"block_type": "footer", "props": _supermarket_footer_props()},
            ]},
            {"title": "Support", "slug": "support", "page_type": "contact", "show_in_nav": False, "blocks": [
                {"block_type": "nav", "props": {"brand": "NOVA Mart"}},
                {"block_type": "contact_form", "props": {"title": "We're here 24/7", "full_page": True}},
                {"block_type": "footer", "props": _supermarket_footer_props()},
            ]},
        ],
    },
    "storefront_services": {
        "id": "storefront_services",
        "name": "Studio",
        "description": "Service catalog with provider profiles, availability calendar, and booking flow \u2014 built for salons, wellness studios, consultants, and more.",
        "thumbnail": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800",
        "category": "services",
        "tier": "full",
        "tags": ["Salon", "Wellness", "Consulting", "Booking", "Studio"],
        "preview_palette": ["#482E27", "#E44B25", "#F6F2EE", "#7A5048", "#2E1D18"],
        "default_style": {
            "primary_color": "#482E27", "secondary_color": "#E44B25", "accent_color": "#E44B25",
            "bg_color": "#F6F2EE", "surface_color": "#FFFFFF", "text_color": "#2E1D18",
            "font_heading": "Fraunces", "font_body": "Manrope",
            "border_radius": "none", "spacing": "spacious", "animation": "subtle",
            "shadow_style": "soft", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Studio", "cta_label": "Book now", "cta_url": "/book"}},
                {"block_type": "hero", "props": {"headline": "Care, by appointment.", "subtitle": "A small studio of stylists, colorists and barbers \u2014 with the time and tools to do it properly.", "bg_style": "image", "image_url": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600", "overlay": True, "cta_primary": "Book now", "cta_secondary": "See services"}},
                {"block_type": "services_cards", "props": {"title": "Services", "columns": 2}},
                {"block_type": "team_grid", "props": {"title": "The team", "columns": 3}},
                {"block_type": "booking_slot_picker", "props": {"title": "Book your slot", "subtitle": "Pick a service and time"}},
                {"block_type": "testimonials", "props": {"title": "Client voices"}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Services", "slug": "services", "page_type": "services", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Studio", "cta_label": "Book now", "cta_url": "/book"}},
                {"block_type": "services_cards", "props": {"title": "All services", "columns": 2}},
                {"block_type": "live_quote", "props": {"title": "Get an instant quote", "cta_label": "Calculate price"}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Team", "slug": "team", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Studio"}},
                {"block_type": "team_grid", "props": {"title": "Our team", "columns": 3}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Book", "slug": "book", "page_type": "custom", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Studio"}},
                {"block_type": "booking_slot_picker", "props": {"title": "Book your slot", "subtitle": "Choose a service and a time \u2014 we\u2019ll confirm by SMS within minutes."}},
                {"block_type": "faq", "props": {"title": "Booking FAQs", "faqs": [{"question": "Can I reschedule?", "answer": "Yes. You can reschedule up to 24 hours before your appointment."}, {"question": "Do you accept walk-ins?", "answer": "Walk-ins are welcome if a slot is available."}]}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "About", "slug": "about", "page_type": "about", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Studio"}},
                {"block_type": "about_split", "props": {"title": "About Studio", "subtitle": "Our promise"}},
                {"block_type": "gallery_masonry", "props": {"title": "Our work"}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
            {"title": "Visit", "slug": "visit", "page_type": "contact", "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Studio"}},
                {"block_type": "contact_form", "props": {"title": "Contact", "full_page": True}},
                {"block_type": "map_embed", "props": {"title": "Find us", "address": ""}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
        ],
    },
    # Editorial homepage kits (formerly Business Front builder presets)
    "atelier": {
        "id": "atelier",
        "name": "Atelier · Retail",
        "description": "Editorial fashion/lifestyle — slow goods, serif typography, Fraunces display",
        "thumbnail": "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=800&q=80",
        "category": "retail",
        "tier": "lite",
        "tags": ["Editorial", "Fashion", "Retail"],
        "preview_palette": ["#2e1f14", "#e55a23", "#f5ede0", "#5c3d27", "#2e1f14"],
        "default_style": {
            "primary_color": "#2e1f14", "secondary_color": "#5c3d27", "accent_color": "#e55a23",
            "bg_color": "#f5ede0", "surface_color": "#ffffff", "text_color": "#2e1f14",
            "font_heading": "Fraunces", "font_body": "Inter",
            "border_radius": "pill", "spacing": "spacious", "animation": "subtle",
            "shadow_style": "soft", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "announcement_bar", "props": {"text": "Free returns within 30 days · Small-batch makers · Carbon-aware shipping", "color": "#2e1f14"}},
                {"block_type": "nav", "props": {"brand": "Atelier", "show_cart": True, "show_search": True}},
                {"block_type": "hero", "props": {
                    "bg_style": "minimal", "layout": "split",
                    "eyebrow": "Spring Edit · Vol 04", "eyebrow_plain": True,
                    "headline": "Quiet objects for", "headline_line2": "loud seasons.",
                    "subtitle": "A small collection of garments and homewares, made by hand in studios we know by name.",
                    "image_url": "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=1600&q=80",
                    "cta_primary": "Shop the edit", "cta_secondary": "Lookbook",
                    "cta_primary_url": "/products", "cta_secondary_url": "/about",
                }},
                {"block_type": "marquee_strip", "props": {"text": "Free returns within 30 days,Made in small batches,Carbon-aware shipping,New drops every Friday"}},
                {"block_type": "product_grid", "props": {"title": "Featured", "columns": 3, "layout": "editorial", "show_badges": True, "featured_spotlight": True}},
                {"block_type": "category_cards", "props": {
                    "title": "Shop the edit", "eyebrow": "Categories", "layout": "editorial", "columns": 3,
                    "categories": [
                        {"title": "Garments", "image_url": "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Homewares", "image_url": "https://images.unsplash.com/photo-1616046229475-276d3c329acd?auto=format&fit=crop&w=900&q=80"},
                        {"title": "Objects", "image_url": "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80"},
                    ],
                }},
                {"block_type": "about_split", "props": {
                    "layout": "statement",
                    "title": "Made slowly,\non purpose.",
                    "subtitle": "A note from the studio",
                    "description": "Every piece passes through fewer than ten hands. We think that shows.",
                }},
                {"block_type": "testimonials", "props": {"title": "From our community"}},
                {"block_type": "blog_grid", "props": {"title": "Journal", "columns": 3}},
                {"block_type": "newsletter", "props": {"title": "Letters from the studio", "subtitle": "New edits, maker stories, and early access — monthly, unhurried."}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
        ],
    },
    "verde": {
        "id": "verde",
        "name": "Verde · Restaurant",
        "description": "Dark editorial restaurant — seasonal menus, reservation-first, dramatic typography",
        "thumbnail": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
        "category": "food",
        "tier": "lite",
        "tags": ["Editorial", "Restaurant", "Dark"],
        "preview_palette": ["#0e1714", "#e8a33c", "#c2892e", "#1a2824", "#e8dcc8"],
        "default_style": {
            "primary_color": "#e8a33c", "secondary_color": "#c2892e", "accent_color": "#e8a33c",
            "bg_color": "#0e1714", "surface_color": "#1a2824", "text_color": "#e8dcc8",
            "font_heading": "Fraunces", "font_body": "Inter",
            "border_radius": "pill", "spacing": "spacious", "animation": "subtle",
            "shadow_style": "none", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Verde", "cta_label": "Reserve", "cta_url": "/book", "transparent": True}},
                {"block_type": "hero", "props": {
                    "bg_style": "image", "layout": "centered", "overlay": True, "overlay_opacity": 0.55,
                    "eyebrow": "Est. 2024 · Brooklyn", "eyebrow_plain": True,
                    "headline": "Seasonal,", "headline_line2": "quietly seasonal.",
                    "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
                    "cta_primary": "Reserve a table", "cta_secondary": "View tonight's menu",
                    "cta_primary_url": "/book", "cta_secondary_url": "/menu",
                }},
                {"block_type": "marquee_strip", "props": {"text": "Open Tue–Sun · 17:00–23:00,Counter seating from 17:00,Wine list updated weekly,Walk-ins welcome at the bar"}},
                {"block_type": "menu_grid", "props": {"title": "Tonight's menu", "categories": ["Starters", "Mains", "Desserts", "Wine"]}},
                {"block_type": "about_split", "props": {"title": "A small green room", "subtitle": "That serves dinner", "description": "Seasonal cooking from a open kitchen — reservations recommended, walk-ins at the bar."}},
                {"block_type": "testimonials", "props": {"title": "Guest notes"}},
                {"block_type": "booking_widget", "props": {"title": "Reserve your table", "subtitle": "Pick a date and party size"}},
                {"block_type": "map_contact", "props": {"title": "Find us", "show_map": True}},
                {"block_type": "footer", "props": _footer_props_minimal()},
            ]},
        ],
    },
    "solace": {
        "id": "solace",
        "name": "Solace · Healthcare",
        "description": "Calm & trustworthy clinic/hospital — appointment booking, specialties grid",
        "thumbnail": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
        "category": "healthcare",
        "tier": "lite",
        "tags": ["Editorial", "Healthcare", "Clinic"],
        "preview_palette": ["#2e8a6e", "#236b56", "#eff8f4", "#ffffff", "#1a3d32"],
        "default_style": {
            "primary_color": "#2e8a6e", "secondary_color": "#236b56", "accent_color": "#2e8a6e",
            "bg_color": "#eff8f4", "surface_color": "#ffffff", "text_color": "#1a3d32",
            "font_heading": "Fraunces", "font_body": "Inter",
            "border_radius": "rounded", "spacing": "comfortable", "animation": "subtle",
            "shadow_style": "soft", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Solace", "cta_label": "Book appointment", "cta_url": "/book"}},
                {"block_type": "hero", "props": {
                    "bg_style": "minimal", "layout": "split",
                    "eyebrow": "Independent care · since 1998", "eyebrow_plain": True,
                    "headline": "Quiet rooms.", "headline_line2": "Patient hands.",
                    "subtitle": "A 90-bed independent hospital built around the unhurried appointment. Same-day bookings across 14 specialties.",
                    "image_url": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80",
                    "cta_primary": "Book an appointment", "cta_secondary": "Browse services",
                    "cta_primary_url": "/book", "cta_secondary_url": "/services",
                }},
                {"block_type": "features", "props": {
                    "title": "Always here when it matters",
                    "columns": 3,
                    "features": [
                        {"title": "Emergency open 24/7", "desc": "Call us anytime"},
                        {"title": "Walk-in lab", "desc": "Mon–Sat 7:00–19:00"},
                        {"title": "Free consultation", "desc": "First visit at no charge"},
                    ],
                }},
                {"block_type": "services_cards", "props": {"title": "Specialties", "columns": 3}},
                {"block_type": "stats", "props": {"stats": [
                    {"value": "90", "label": "Beds"},
                    {"value": "14", "label": "Specialties"},
                    {"value": "24/7", "label": "Emergency"},
                ]}},
                {"block_type": "testimonials", "props": {"title": "Patient stories"}},
                {"block_type": "booking_widget", "props": {"title": "Book an appointment", "subtitle": "Choose a specialty and time"}},
                {"block_type": "map_contact", "props": {"title": "Visit us", "show_map": True}},
                {"block_type": "footer", "props": _footer_props_standard()},
            ]},
        ],
    },
}

EDITORIAL_WEBSITE_TEMPLATE_IDS = frozenset({"atelier", "verde", "solace"})


# Maps block_type → live data resource.
# Mirrors the frontend BLOCK_AUTO_SOURCE so every template block is auto-wired
# to the vendor's real catalog / profile data the moment a template is applied.
BLOCK_AUTO_SOURCE: dict[str, str] = {
    # Brand / contact / profile info
    "nav":                "profile",
    "footer":             "profile",
    "about_split":        "profile",
    "contact_form":       "profile",
    "map_embed":          "profile",
    "map_contact":        "profile",
    "social_links":       "profile",
    # Products / catalog
    "product_grid":       "products",
    "menu_grid":          "products",
    "live_stock":         "products",
    "live_quote":         "products",
    "cart_drawer":        "products",
    "product_detail":     "products",
    "related_products":   "products",
    "search_bar":         "products",
    # Categories
    "category_cards":     "categories",
    "product_filters":    "categories",
    # Services / bookings
    "services_cards":     "services",
    "services_list":      "services",
    "booking_widget":     "services",
    "booking_slot_picker":"services",
    # Reviews / testimonials
    "testimonials":       "testimonials",
    "testimonials_grid":  "testimonials",
    "product_reviews":    "testimonials",
    # Team
    "team_grid":          "team",
    "team_list":          "team",
    # Stats / KPIs
    "stats":              "kpis",
    # Media / gallery
    "gallery_masonry":    "media",
    "gallery_grid":       "media",
    "image_gallery":      "media",
    # Orders / tracking
    "order_status":       "orders",
    # Customers (trust logos)
    "trust_logos":        "customers",
    # Blog Manager posts
    "blog_grid":          "blog",
    "blog_featured":      "blog",
    "blog_list":          "blog",
    "pricing":            "plans",
    "service.pricing":    "plans",
}


def _wire_block_auto_source(block_type: str, props: Dict[str, Any]) -> Dict[str, Any]:
    """Attach live ERP data_source to generated/template blocks (mirrors apply-template)."""
    p = dict(props or {})
    auto_source = BLOCK_AUTO_SOURCE.get(block_type)
    if auto_source and "data_source" not in p:
        p["data_source"] = {"type": auto_source, "auto": True}
        if block_type in ("testimonials", "testimonials_grid", "product_reviews"):
            p["testimonials"] = []
    return p


TEMPLATE_STYLE_FALLBACKS = {
    "portfolio": {
        "primary_color": "#111827", "secondary_color": "#374151", "accent_color": "#8B5CF6",
        "bg_color": "#FFFFFF", "surface_color": "#F9FAFB", "text_color": "#111827",
        "font_heading": "Playfair Display", "font_body": "Inter", "border_radius": "sharp",
        "spacing": "spacious", "animation": "subtle", "button_style": "outline",
    },
}


_BUSINESS_TYPE_TEMPLATE_LABELS: Dict[str, str] = {
    "retail": "Healthy Retail",
    "services": "Service Business",
    "restaurant": "Restaurant / Cafe",
    "fashion": "Fashion / Boutique",
    "electronics": "Electronics Store",
    "salon": "Salon / Spa",
    "clinic": "Clinic / Healthcare",
    "consulting": "Consultant / Agency",
}


def _resolved_applied_template(style_config: Optional[Any]) -> tuple[Optional[str], Optional[str]]:
    """Return (template_id, display_name) stored on a Website Builder site."""
    sc = style_config if isinstance(style_config, dict) else {}
    stored_name = sc.get("applied_template_name")
    stored_id = sc.get("applied_template_id")
    if isinstance(stored_name, str) and stored_name.strip():
        tid = str(stored_id).strip() if stored_id else None
        return tid or None, stored_name.strip()

    for key in ("wb_catalog_template_id", "wb_editorial_template_id"):
        raw = sc.get(key)
        if raw:
            tid = str(raw).strip()
            tpl = WEBSITE_TEMPLATES.get(tid)
            if isinstance(tpl, dict):
                name = tpl.get("name") or tid.replace("_", " ").title()
            else:
                name = tid.replace("_", " ").title()
            return tid, str(name)

    bt = sc.get("business_type")
    if isinstance(bt, str) and bt.strip():
        key = bt.strip()
        label = _BUSINESS_TYPE_TEMPLATE_LABELS.get(key, key.replace("_", " ").title())
        return None, label

    return None, None


def _enrich_template_dict(tpl: dict) -> dict:
    t = dict(tpl)
    pages = t.get("pages") or []
    page_count = len(pages)
    nav_count = len([p for p in pages if p.get("show_in_nav", True)])
    t.setdefault("page_count", page_count)
    t.setdefault("nav_page_count", nav_count)
    if "tier" not in t:
        t["tier"] = "full" if page_count >= 6 else "lite"
    if "default_style" not in t and t.get("id") in TEMPLATE_STYLE_FALLBACKS:
        t["default_style"] = TEMPLATE_STYLE_FALLBACKS[t["id"]]
    if "preview_palette" not in t:
        ds = t.get("default_style") or t.get("style_config") or TEMPLATE_STYLE_FALLBACKS.get(t.get("id"), {})
        if isinstance(ds, dict):
            pal = [
                ds.get("primary_color"),
                ds.get("secondary_color"),
                ds.get("accent_color"),
                ds.get("bg_color"),
                ds.get("text_color"),
            ]
            pal = [p for p in pal if isinstance(p, str) and p.startswith("#")]
            if pal:
                t["preview_palette"] = pal[:5]
    return t


async def _resolve_catalog_template(db: AsyncSession, template_id: str) -> Optional[dict]:
    """Built-in WEBSITE_TEMPLATES first, then admin-published platform templates."""
    tpl = WEBSITE_TEMPLATES.get(template_id)
    if tpl:
        return dict(tpl)
    from app.services.platform_website_templates import (
        catalog_template_dict,
        get_published_platform_template_by_slug,
    )
    platform = await get_published_platform_template_by_slug(db, template_id)
    if platform:
        return catalog_template_dict(platform)
    return None


@router.get("/templates/all")
async def list_templates(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    enriched = [_enrich_template_dict(tpl) for tpl in WEBSITE_TEMPLATES.values()]
    from app.services.platform_website_templates import (
        catalog_template_dict,
        list_published_platform_templates,
    )
    for platform in await list_published_platform_templates(db):
        enriched.append(_enrich_template_dict(catalog_template_dict(platform)))
    return enriched


@router.post("/{site_id}/apply-template/{template_id}", response_model=SiteOut)
async def apply_template(
    site_id: str,
    template_id: str,
    pages_only: bool = Query(False, description="Create template pages and theme only; do not copy blocks"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    tpl = await _resolve_catalog_template(db, template_id)
    if not tpl:
        raise HTTPException(404, "Template not found")

    # Apply template-level site style. Ready-made templates should carry their
    # own look and feel, not inherit colors from the previously edited site.
    tpl_style = tpl.get("default_style") or tpl.get("style_config") or TEMPLATE_STYLE_FALLBACKS.get(template_id)
    if isinstance(tpl_style, dict) and tpl_style:
        current = site.style_config or {}
        merged = {
            "nav_style": current.get("nav_style", "default"),
            "footer_style": current.get("footer_style", "default"),
            "container_width": current.get("container_width", "1280px"),
        }
        merged.update(tpl_style)
        # Business Front gallery templates (React previews in template-browser) — tag the
        # published site so the live business front can render the same React shell, not
        # only the block approximation.
        tid = str(template_id)
        if tid.startswith("storefront_"):
            merged["wb_catalog_template_id"] = tid
            merged.pop("wb_editorial_template_id", None)
            if tid == "storefront_grocery":
                merged["image_category_id"] = "wellness"
                merged["business_type"] = merged.get("business_type") or "retail"
            if tid == "storefront_supermarket":
                merged["business_type"] = merged.get("business_type") or "retail"
        elif tid in EDITORIAL_WEBSITE_TEMPLATE_IDS:
            merged["wb_editorial_template_id"] = tid
            merged.pop("wb_catalog_template_id", None)
        else:
            merged.pop("wb_catalog_template_id", None)
            merged.pop("wb_editorial_template_id", None)
        merged["applied_template_id"] = tid
        merged["applied_template_name"] = tpl.get("name") or tid.replace("_", " ").title()
        site.style_config = merged
    else:
        current = site.style_config if isinstance(site.style_config, dict) else {}
        site.style_config = {
            **current,
            "applied_template_id": str(template_id),
            "applied_template_name": tpl.get("name") or str(template_id).replace("_", " ").title(),
        }

    # Remove existing pages
    await db.execute(delete(WebsiteBlock).where(
        WebsiteBlock.page_id.in_(
            select(WebsitePage.id).where(WebsitePage.site_id == UUID(site_id))
        )
    ))
    await db.execute(delete(WebsitePage).where(WebsitePage.site_id == UUID(site_id)))

    # Create new pages from template
    for p_idx, p_tpl in enumerate(tpl.get("pages", [])):
        page_id_new = uuid.uuid4()
        page = WebsitePage(
            id=page_id_new,
            site_id=UUID(site_id),
            title=p_tpl["title"],
            slug=p_tpl["slug"],
            page_type=p_tpl.get("page_type", "custom"),
            is_homepage=p_tpl.get("is_homepage", False),
            show_in_nav=p_tpl.get("show_in_nav", True),
            is_published=p_tpl.get("is_published", True),
            seo_title=p_tpl.get("seo_title"),
            seo_description=p_tpl.get("seo_description"),
            og_image_url=p_tpl.get("og_image_url"),
            sort_order=p_idx,
        )
        db.add(page)
        await db.flush()

        if not pages_only:
            for b_idx, b_tpl in enumerate(p_tpl.get("blocks", [])):
                props = copy.deepcopy(b_tpl.get("props", {}) or {})
                b_type = b_tpl.get("block_type", "")

                # Auto-wire block to live vendor data so template content is
                # immediately replaced by the vendor's real catalog / profile
                # rather than showing static placeholder text.
                props = _wire_block_auto_source(b_type, props)
                if template_id == "storefront_grocery" and "_image_category_id" not in props:
                    props["_image_category_id"] = "wellness"

                block = WebsiteBlock(
                    id=uuid.uuid4(),
                    page_id=page_id_new,
                    block_type=b_type or b_tpl["block_type"],
                    props=props,
                    style_overrides={},
                    sort_order=b_idx,
                )
                db.add(block)

    site.updated_at = datetime.utcnow()
    await db.commit()
    return await _get_site(db, site_id, vendor.id)


# ── AI: One-Prompt Site Generator ─────────────────────────────────────────────

CATEGORY_IMAGE_POOLS: Dict[str, List[str]] = {
    "wellness": [
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1464456391031-c8a9c116fe84?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1606851090756-56d7fd5520ce?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1498837167922-ddd27525cd3?auto=format&fit=crop&w=1600&q=80",
    ],
    "shop": [
        "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
    ],
    "store": [
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1555529665-1569b70306e2?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1600&q=80",
    ],
    "beauty": [
        "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1516975080664-ed2fc6a329cf?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1600&q=80",
    ],
    "electronics": [
        "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1600&q=80",
    ],
    "catering-service": [
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80",
    ],
    "book-store": [
        "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1507842217343-583bb7270bce?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1524995994132-5781c2a7a032?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1600&q=80",
    ],
    "medical-equipment-store": [
        "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1631217868264-e5b1a5fe279c?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1519494021062-207bded1ffb1?auto=format&fit=crop&w=1600&q=80",
    ],
}


def _images_for_category(category_id: Optional[str], count: int = 12) -> List[str]:
    pool = CATEGORY_IMAGE_POOLS.get((category_id or "").strip()) or CATEGORY_IMAGE_POOLS["shop"]
    if not pool:
        return []
    return [pool[i % len(pool)] for i in range(count)]


def _nav_links_from_page_dicts(pages: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Build deduplicated nav links — one Home entry only."""
    links: List[Dict[str, str]] = []
    seen: set[str] = set()
    ordered = sorted(
        pages,
        key=lambda p: (not p.get("is_homepage"), p.get("sort_order") or 0),
    )
    for pg in ordered:
        if pg.get("show_in_nav") is False:
            continue
        url = "/" if pg.get("is_homepage") else f"/{str(pg.get('slug') or '').strip().lstrip('/')}"
        if url == "/home":
            url = "/"
        if url in seen:
            continue
        seen.add(url)
        label = "Home" if pg.get("is_homepage") else str(pg.get("title") or pg.get("slug") or "Page")
        links.append({"label": label, "url": url})
    return links


def _enrich_block_props_with_category(
    block_type: str,
    props: Dict[str, Any],
    images: List[str],
    cursor: List[int],
    category_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Fill empty image fields on starter blocks from the selected business category pack."""
    props = copy.deepcopy(props or {})
    if not images:
        return props

    def next_img() -> str:
        idx = cursor[0] % len(images)
        cursor[0] += 1
        return images[idx]

    if block_type in ("hero", "hero_split", "hero_minimal"):
        if not props.get("bg_image_url"):
            props["bg_image_url"] = next_img()
        if block_type == "hero_split" and not props.get("image_url"):
            props["image_url"] = next_img()
        if props.get("bg_style") in (None, "", "gradient", "minimal"):
            props["bg_style"] = "image"
        props.setdefault("overlay", True)
    elif block_type == "cta" and not props.get("bg_image_url"):
        props["bg_image_url"] = next_img()
    elif block_type == "about_split" and not props.get("image_url"):
        props["image_url"] = next_img()
    elif block_type == "features" and props.get("show_images"):
        for feat in props.get("features") or []:
            if isinstance(feat, dict) and not feat.get("image_url"):
                feat["image_url"] = next_img()
    elif block_type == "features_alternating":
        for feat in props.get("features") or []:
            if isinstance(feat, dict) and not feat.get("image_url"):
                feat["image_url"] = next_img()
    elif block_type == "services_cards":
        for feat in props.get("features") or []:
            if isinstance(feat, dict) and not feat.get("image_url"):
                feat["image_url"] = next_img()
    elif block_type == "category_cards":
        if category_id == "wellness":
            props.setdefault("layout", "wellness")
        cats = props.get("categories") or []
        if not cats:
            if category_id == "wellness":
                props["categories"] = [
                    {"title": title, "image_url": next_img()}
                    for title in WELLNESS_CATEGORY_TITLES
                ]
            else:
                props["categories"] = [
                    {"title": "New arrivals", "image_url": next_img()},
                    {"title": "Best sellers", "image_url": next_img()},
                    {"title": "Featured", "image_url": next_img()},
                ]
        else:
            for cat in cats:
                if isinstance(cat, dict) and not cat.get("image_url"):
                    cat["image_url"] = next_img()
        if category_id == "wellness":
            for cat in props.get("categories") or []:
                if isinstance(cat, dict) and not cat.get("image_url"):
                    cat["image_url"] = next_img()
    elif block_type == "testimonials":
        for t in props.get("testimonials") or []:
            if isinstance(t, dict) and not t.get("avatar_url"):
                t["avatar_url"] = next_img()
    elif block_type in ("gallery_masonry", "gallery_grid", "image_gallery"):
        images = props.get("images") or []
        if not images:
            props["images"] = [{"src": next_img(), "caption": ""} for _ in range(3)]
        else:
            for img in images:
                if isinstance(img, dict) and not img.get("src"):
                    img["src"] = next_img()
    return props


def _style_for_business_type(business_type: Optional[str]) -> Dict[str, Any]:
    presets: Dict[str, Dict[str, Any]] = {
        "retail": {
            "primary_color": "#274832", "secondary_color": "#4A7A58", "accent_color": "#E07A5F",
            "bg_color": "#F9F9F5", "surface_color": "#FFFFFF", "text_color": "#182E20",
            "font_heading": "DM Serif Display",
        },
        "services": {
            "primary_color": "#6366f1", "secondary_color": "#4338ca", "accent_color": "#818cf8",
            "bg_color": "#ffffff", "surface_color": "#f5f3ff", "text_color": "#1e1b4b",
        },
        "restaurant": {
            "primary_color": "#c2410c", "secondary_color": "#7c2d12", "accent_color": "#ea580c",
            "bg_color": "#fffbf7", "surface_color": "#fff7ed", "text_color": "#292524",
            "font_heading": "Playfair Display",
        },
        "fashion": {
            "primary_color": "#18181b", "secondary_color": "#3f3f46", "accent_color": "#a78bfa",
            "bg_color": "#ffffff", "surface_color": "#fafafa", "text_color": "#18181b",
            "font_heading": "Playfair Display", "border_radius": "sharp",
        },
        "electronics": {
            "primary_color": "#2563eb", "secondary_color": "#1e40af", "accent_color": "#38bdf8",
            "bg_color": "#ffffff", "surface_color": "#f8fafc", "text_color": "#0f172a",
        },
        "salon": {
            "primary_color": "#be185d", "secondary_color": "#831843", "accent_color": "#f472b6",
            "bg_color": "#fffbfb", "surface_color": "#fdf2f8", "text_color": "#500724",
            "font_heading": "Playfair Display",
        },
        "clinic": {
            "primary_color": "#0d9488", "secondary_color": "#115e59", "accent_color": "#2dd4bf",
            "bg_color": "#ffffff", "surface_color": "#f0fdfa", "text_color": "#134e4a",
        },
        "consulting": {
            "primary_color": "#1e3a5f", "secondary_color": "#0f172a", "accent_color": "#3b82f6",
            "bg_color": "#ffffff", "surface_color": "#f1f5f9", "text_color": "#0f172a",
        },
    }
    base = presets.get((business_type or "").strip(), presets["retail"])
    return {
        **base,
        "font_heading": base.get("font_heading", "Inter"),
        "font_body": "Inter",
        "border_radius": base.get("border_radius", "rounded"),
        "spacing": "comfortable",
        "animation": "subtle",
        "shadow_style": "soft",
        "button_style": "filled",
    }


_NO_ANIM_BLOCKS = frozenset({"nav", "footer", "announcement_bar", "marquee_strip"})


def _modern_design_animation(block_type: str, block_index: int) -> Dict[str, Any]:
    if block_type in _NO_ANIM_BLOCKS:
        return {}
    return {
        "animation": "slide-up" if block_index % 2 == 0 else "fade-in",
        "animation_delay": min(block_index * 80, 480),
    }


def _apply_modern_design_props(
    block_type: str,
    props: Dict[str, Any],
    style_cfg: Dict[str, Any],
) -> Dict[str, Any]:
    """Professional layouts and gradients on generated blocks (no auto wave dividers)."""
    p = dict(props or {})
    primary = style_cfg.get("primary_color", "#64C3A0")
    secondary = style_cfg.get("secondary_color", "#13624A")

    if block_type in ("hero", "hero_split", "hero_minimal"):
        p["bg_style"] = "gradient"
        p.setdefault("gradient_from", primary)
        p.setdefault("gradient_to", secondary)
        p.setdefault("gradient_dir", "135deg")
        p.setdefault("layout", "split" if block_type == "hero_split" else p.get("layout", "centered"))
        p.setdefault("padding_bottom", 72)
    elif block_type in (
        "features", "features_alternating", "category_cards", "services_cards",
        "testimonials", "testimonials_grid", "gallery_masonry", "booking_widget",
        "about_split", "stats", "pricing",
    ):
        p.setdefault("padding_top", 64)
        p.setdefault("padding_bottom", 64)
    elif block_type in ("cta", "cta_split", "contact_form", "newsletter"):
        p["bg_style"] = "gradient"
        p.setdefault("gradient_from", primary)
        p.setdefault("gradient_to", secondary)
        p.setdefault("gradient_dir", "135deg")
        p.setdefault("padding_top", 72)
        p.setdefault("padding_bottom", 72)

    return p


def _enrich_blocks_with_modern_design(
    blocks: List[Dict[str, Any]],
    style_cfg: Dict[str, Any],
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    content_idx = 0
    for b in blocks:
        b_type = b.get("block_type", "rich_text")
        props = _apply_modern_design_props(b_type, b.get("props", {}) or {}, style_cfg)
        meta = _modern_design_animation(b_type, content_idx)
        if b_type not in _NO_ANIM_BLOCKS:
            content_idx += 1
        out.append({**b, "props": props, **meta})
    return out


def _wellness_retail_home_blocks(
    short_name: str,
    category_id: str,
    feats: set,
    snap_props,
    selling_mode: str = "products",
) -> List[Dict[str, Any]]:
    """Generic healthy retail homepage (announcement, marquee, categories, story)."""
    show_meal_content = selling_mode in ("services", "both") and (not feats or "services_sections" in feats)
    blocks: List[Dict[str, Any]] = [
        {"block_type": "announcement_bar", "label": "Announcement", "props": snap_props("announcement_bar", {
            "text": (
                "Daily meals delivered to your doorstep — wholesome, plant-based, and delicious."
                if show_meal_content
                else f"Wholesome snacks and groceries from {short_name} — natural ingredients you can trust."
            ),
            "color": "#274832",
            "show_close": True,
        })},
        {"block_type": "nav", "label": "Navigation", "props": snap_props("nav", {
            "brand": short_name,
            "show_cart": True,
            "show_search": True,
            "cta_label": "Get started",
        })},
        {"block_type": "hero_split", "label": "Hero", "props": snap_props("hero_split", {
            "headline": "Discover wellness essentials",
            "headline_line2": "for everyday wellness",
            "subtitle": (
                f"Wholesome snacks, gourmet groceries, and pantry staples from {short_name} — "
                "crafted with natural ingredients you can trust."
            ),
            "bg_style": "minimal",
            "layout": "split",
            "eyebrow": "Welcome",
            "eyebrow_plain": True,
            "cta_primary": "Shop bestsellers",
            "cta_secondary": "Browse categories",
        })},
        {"block_type": "marquee_strip", "label": "Highlights", "props": {
            "text": WELLNESS_MARQUEE_TEXT,
        }},
    ]

    if not feats or "products_sections" in feats:
        blocks.append({
            "block_type": "category_cards",
            "label": "Categories",
            "props": snap_props("category_cards", {
                "title": "Shop by category",
                "eyebrow": "Explore",
                "layout": "wellness",
                "columns": 3,
                "categories": [
                    {"title": title, "image_url": ""}
                    for title in WELLNESS_CATEGORY_TITLES
                ],
            }),
        })
        blocks.append({
            "block_type": "product_grid",
            "label": "Bestsellers",
            "props": _wire_block_auto_source("product_grid", {
                "title": "Our bestsellers",
                "columns": 4,
                "show_badges": True,
                "layout": "editorial",
                "featured_spotlight": True,
            }),
        })

    if not feats or "reviews_trust" in feats:
        if show_meal_content:
            blocks.append({
                "block_type": "features_alternating",
                "label": "Service highlights",
                "props": snap_props("features_alternating", {
                    "title": "Flexible plans, delivered on your schedule",
                    "layout": "stacked",
                    "image_position": "right",
                    "features": [
                        {
                            "title": "Customize your schedule",
                            "desc": "Flexible meal plans that fit your routine — pause or skip anytime.",
                            "image_url": "",
                        },
                        {
                            "title": "Convenient doorstep delivery",
                            "desc": "Fresh, plant-based meals prepared daily and delivered to your door.",
                            "image_url": "",
                        },
                    ],
                }),
            })
        else:
            blocks.append({
                "block_type": "features_alternating",
                "label": "Why shop with us",
                "props": snap_props("features_alternating", {
                    "title": f"Wholesome products from {short_name}",
                    "layout": "stacked",
                    "image_position": "right",
                    "features": [
                        {
                            "title": "Curated for wellness",
                            "desc": "Wholesome snacks, gourmet groceries, and pantry staples chosen for quality.",
                            "image_url": "",
                        },
                        {
                            "title": "Delivered with care",
                            "desc": "Fresh, minimally processed products packed and shipped to your door.",
                            "image_url": "",
                        },
                    ],
                }),
            })
        blocks.append({
            "block_type": "features",
            "label": "Why choose us",
            "props": snap_props("features", {
                "title": "Why choose us",
                "layout": "grid-4",
                "show_images": False,
                "features": [
                    {"icon": "Leaf", "title": "100% natural ingredients", "desc": "Plant-based, minimally processed — no refined sugar or artificial additives."},
                    {"icon": "Heart", "title": "Ethical sourcing", "desc": "We partner with small farmers who practice natural, sustainable growing."},
                    {"icon": "Star", "title": "Health & taste", "desc": "Nutritionally balanced recipes that are as delicious as they are wholesome."},
                    {"icon": "Shield", "title": "Transparent & trustworthy", "desc": "No hidden preservatives — what you see is what you get."},
                ],
            }),
        })
        blocks.append({
            "block_type": "timeline",
            "label": "Our story",
            "props": {
                "title": "Our story",
                "items": [
                    {"year": "2010", "title": "Starting with workshops", "desc": "Spreading the joy of healthy living through intimate workshops and consultations."},
                    *([{"year": "2013", "title": "Service plans", "desc": "Flexible delivery plans tailored to customer schedules."}] if show_meal_content else [{"year": "2013", "title": "Expanded our range", "desc": "Growing our catalog of wholesome snacks, groceries, and pantry staples."}]),
                    {"year": "2017", "title": "Online store launch", "desc": "Wholesome snacks, gourmet groceries, and pantry staples online."},
                    {"year": "Today", "title": "Growing community", "desc": f"A trusted destination for everyday wellness with {short_name}."},
                ],
            },
        })
        blocks.append({
            "block_type": "testimonials",
            "label": "Testimonials",
            "props": _wire_block_auto_source("testimonials", snap_props("testimonials", {
                "title": "Loved by our community",
                "testimonials": [],
            })),
        })

    blocks.append({
        "block_type": "cta",
        "label": "Gifting CTA",
        "props": snap_props("cta", {
            "headline": "Custom curated and handcrafted with love",
            "subtitle": "Share the gift of deliciously healthy gourmet food.",
            "cta_label": "Send a gift now",
        }),
    })

    if not feats or "contact_form" in feats:
        blocks.append({
            "block_type": "faq",
            "label": "FAQ",
            "props": {
                "title": "Frequently asked questions",
                "faqs": [
                    {"question": "Are your products organic?", "answer": "We source from trusted small farmers who practice natural growing. Our products use no artificial preservatives or additives."},
                    *([{"question": "Do you offer delivery plans?", "answer": "Yes — flexible plans with scheduled doorstep delivery. Customize your schedule anytime."}] if show_meal_content else []),
                    {"question": "Where do you deliver?", "answer": "We deliver across our service areas. Contact us for coverage in your city."},
                ],
            },
        })
        blocks.append({
            "block_type": "newsletter",
            "label": "Newsletter",
            "props": {
                "title": "Sign up to our newsletter",
                "subtitle": "Recipes, wellness tips, and new product launches — straight to your inbox.",
                "cta_label": "Subscribe",
            },
        })

    blocks.append({"block_type": "footer", "label": "Footer", "props": _footer_props_standard()})
    return blocks


def _professional_home_blocks(
    short_name: str,
    niche: str,
    category_id: str,
    selling_mode: str = "products",
    business_type: str = "retail",
    setup_features: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Category-aware starter homepage — hero, images, features, social proof."""
    feats = set(setup_features or [])
    imgs = _images_for_category(category_id, 16)
    cursor = [0]

    def snap_props(block_type: str, props: Dict[str, Any]) -> Dict[str, Any]:
        enriched = _enrich_block_props_with_category(block_type, props, imgs, cursor, category_id)
        enriched["_image_category_id"] = category_id
        return enriched

    if business_type == "retail" and selling_mode in ("products", "both"):
        return _wellness_retail_home_blocks(short_name, category_id, feats, snap_props, selling_mode)

    hero_props: Dict[str, Any] = {
        "headline": f"Build Something Amazing" if business_type in ("retail", "services") else f"Welcome to {short_name}",
        "subtitle": f"The all-in-one {niche} experience — quality, trust, and care in every detail.",
        "bg_style": "gradient",
        "layout": "split",
        "gradient_dir": "135deg",
        "eyebrow": short_name.upper() if business_type == "fashion" else f"Welcome to {short_name}",
        "cta_primary": "Get Started Free" if selling_mode != "services" else "Book now",
        "cta_secondary": "Learn More",
    }
    if business_type == "fashion":
        hero_props.update({
            "headline": "Quiet luxury,",
            "headline_line2": "built to last.",
            "eyebrow_plain": True,
            "eyebrow": "NEW COLLECTION",
        })

    blocks: List[Dict[str, Any]] = [
        {"block_type": "nav", "label": "Navigation", "props": snap_props("nav", {
            "brand": short_name,
            "cta_label": "Get Started",
        })},
        {"block_type": "hero_split", "label": "Hero", "props": snap_props("hero_split", hero_props)},
    ]

    if business_type == "restaurant" and (not feats or "menu_gallery" in feats):
        blocks.append({
            "block_type": "gallery_masonry",
            "label": "Gallery",
            "props": snap_props("gallery_masonry", {
                "title": "From our kitchen",
                "eyebrow": "Gallery",
                "columns": 3,
                "images": [{"src": imgs[i % len(imgs)], "caption": f"Dish {i + 1}"} for i in range(min(6, len(imgs)))],
            }),
        })

    if selling_mode in ("products", "both") and (not feats or "products_sections" in feats):
        blocks.append({
            "block_type": "category_cards",
            "label": "Categories",
            "props": snap_props("category_cards", {
                "title": "Shop by category",
                "eyebrow": "Collections",
                "layout": "editorial",
                "columns": 3,
            }),
        })
    if selling_mode in ("services", "both") and (not feats or "services_sections" in feats):
        blocks.append({
            "block_type": "services_cards",
            "label": "Services",
            "props": snap_props("services_cards", {
                "title": "What we offer",
                "columns": 3,
                "features": [
                    {"title": "Consultation", "desc": "Expert guidance tailored to your needs."},
                    {"title": "Premium service", "desc": "Professional results, every time."},
                    {"title": "Ongoing support", "desc": "We are here when you need us."},
                ],
            }),
        })

    if business_type in ("salon", "clinic", "restaurant") and (not feats or "booking_blocks" in feats):
        blocks.append({
            "block_type": "booking_widget",
            "label": "Book Online",
            "props": snap_props("booking_widget", {
                "title": "Book an appointment",
                "subtitle": f"Schedule with {short_name} in seconds.",
            }),
        })

    if not feats or "reviews_trust" in feats:
        blocks.append({"block_type": "features", "label": "Features", "props": snap_props("features", {
            "title": "Why Choose Us",
            "layout": "grid-3",
            "show_images": True,
            "features": [
                {"icon": "Star", "title": "Quality first", "desc": "Hand-picked products and trusted service."},
                {"icon": "Shield", "title": "Secure checkout", "desc": "Safe payments and reliable delivery."},
                {"icon": "Zap", "title": "Fast support", "desc": "Real people ready to help."},
            ],
        })})
        blocks.append({"block_type": "testimonials", "label": "Testimonials", "props": _wire_block_auto_source("testimonials", snap_props("testimonials", {
            "title": "What customers say",
            "testimonials": [],
        }))})
    else:
        blocks.append({"block_type": "features", "label": "Features", "props": snap_props("features", {
            "title": "Why Choose Us",
            "layout": "grid-3",
            "show_images": True,
            "features": [
                {"icon": "Star", "title": "Quality first", "desc": "Hand-picked products and trusted service."},
                {"icon": "Shield", "title": "Secure checkout", "desc": "Safe payments and reliable delivery."},
                {"icon": "Zap", "title": "Fast support", "desc": "Real people ready to help."},
            ],
        })})

    if not feats or "contact_form" in feats:
        blocks.append({"block_type": "cta", "label": "CTA", "props": snap_props("cta", {
            "headline": "Ready to get started?",
            "subtitle": f"Join customers who trust {short_name}.",
            "cta_label": "Contact us today",
        })})

    blocks.append({"block_type": "footer", "label": "Footer", "props": _footer_props_standard()})
    return blocks


@router.post("/{site_id}/ai/generate-site", response_model=AIGenerateSiteResponse)
async def ai_generate_site(
    site_id: str,
    body: AIGenerateSiteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """One-prompt full-site generator."""
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    default_pages = list(body.pages) if body.pages else ["home", "about", "services", "contact"]
    if body.include_pricing and "pricing" not in default_pages:
        default_pages.append("pricing")
    if body.include_blog and "blog" not in default_pages:
        default_pages.append("blog")

    tone_instructions = {
        "professional": "formal, authoritative, trust-building",
        "friendly":     "warm, approachable, conversational",
        "bold":         "energetic, confident, punchy",
        "minimalist":   "clean, precise, no-fluff",
        "luxury":       "elegant, exclusive, sophisticated",
        "gen_z":        "casual, trendy, emoji-friendly, relatable",
        "empathetic":   "compassionate, supportive, human-centred",
        "casual":       "relaxed, honest, straightforward",
        "persuasive":   "compelling, urgency-driven, benefit-focused",
        "corporate":    "professional, structured, enterprise-grade",
    }.get(body.tone, "professional")

    try:
        import os, httpx
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            block_types = (
                "nav, hero, hero_split, hero_minimal, features, features_alternating, stats, "
                "testimonials, team_grid, pricing, faq, cta, contact_form, portfolio_grid, "
                "blog_grid, newsletter, video_embed, trust_logos, timeline, about_split, "
                "services_cards, product_grid, booking_widget, countdown, footer, "
                "live_stock, order_status, live_quote"
            )
            system = f"""You are an expert website architect. Generate a complete website structure.
Tone style: {tone_instructions}.
Available block types: {block_types}
Use Live ERP blocks where they help visitors: live_stock (inventory from catalog), order_status (order lookup), live_quote (instant quote). Put sensible default props; the vendor will bind real ERP data in the builder Data tab.
Return ONLY valid JSON:
{{
  "site_name":"string","tagline":"string","seo_title":"string","seo_description":"string",
  "summary":"string",
  "style_config":{{"primary_color":"#hex","secondary_color":"#hex","accent_color":"#hex",
    "bg_color":"#hex","surface_color":"#hex","text_color":"#hex",
    "font_heading":"Inter","font_body":"Inter","border_radius":"rounded",
    "spacing":"comfortable","animation":"subtle","button_style":"filled"}},
  "pages":[{{"title":"","slug":"","page_type":"home","is_homepage":true,
    "seo_title":"","seo_description":"",
    "blocks":[{{"block_type":"","label":"","props":{{}}}}]}}]
}}
Fill in real copy for the business. No placeholder text."""

            prompt = (
                f"Business: {body.business_description}\n"
                f"Business name: {(body.site_name or site.name or '').strip() or 'Auto'}\n"
                f"Business type: {(body.business_type or 'general').strip()}\n"
                f"Niche: {body.niche or 'auto'}\n"
                f"Pages: {', '.join(default_pages)}\n"
                f"Tone: {body.tone}\n"
                f"Use hero_split with bg_style gradient, category_cards, features with show_images, alternating layouts, testimonials with avatars, gradient CTA sections, and block animations fade-in/slide-up. Do not add top_shape or bottom_shape wave dividers unless explicitly requested."
            )

            async with httpx.AsyncClient(timeout=90) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "gpt-4o",
                        "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                        "max_tokens": 4000,
                        "response_format": {"type": "json_object"},
                    },
                )
                data = resp.json()["choices"][0]["message"]["content"]
                result = json.loads(data)
                return AIGenerateSiteResponse(**result)
    except Exception:
        pass

    # Fallback: smart template-based generation (works without OpenAI)
    niche = body.niche or "business"
    biz = body.business_description
    short_name = (body.site_name or site.name or "").strip()
    if not short_name and biz:
        short_name = biz.split(".")[0].split(",")[0][:60].strip() or "Your Business"
    if not short_name:
        short_name = "Your Business"
    category_id = (body.image_category or "").strip() or str((site.style_config or {}).get("image_category_id") or "shop")
    selling_mode = (body.selling_mode or "products").strip() or "products"
    business_type = (body.business_type or str((site.style_config or {}).get("business_type") or "retail")).strip()
    setup_features = body.setup_features or []
    imgs = _images_for_category(category_id, 16)
    img_cursor = [0]

    if body.pages:
        default_pages = [p if p != "home" else "home" for p in body.pages]
        if "home" not in default_pages:
            default_pages = ["home"] + default_pages
    else:
        default_pages = ["home", "about", "contact"]
        if selling_mode in ("services", "both"):
            default_pages.append("services")
        if selling_mode in ("products", "both"):
            default_pages.append("products")
        if body.include_pricing and "pricing" not in default_pages:
            default_pages.append("pricing")
        if body.include_blog and "blog" not in default_pages:
            default_pages.append("blog")

    pages_out: List[Dict[str, Any]] = []
    style_cfg = _style_for_business_type(business_type)
    for slug in default_pages:
        page_blocks: list = []
        if slug == "home":
            page_blocks = _professional_home_blocks(
                short_name, niche, category_id, selling_mode, business_type, setup_features,
            )
        elif slug == "about":
            page_blocks = [
                {"block_type": "hero_minimal", "label": "Hero", "props": _enrich_block_props_with_category("hero_minimal", {"headline": "About Us", "subtitle": "Our story, mission and values.", "bg_style": "image"}, imgs, img_cursor)},
                {"block_type": "about_split",  "label": "Our Story", "props": _enrich_block_props_with_category("about_split", {"title": "Who We Are", "subtitle": "Our Story", "description": biz, "layout": "split", "image_position": "right"}, imgs, img_cursor)},
                {"block_type": "team_grid",    "label": "Team", "props": {"title": "Meet the Team", "columns": 3}},
                {"block_type": "timeline",     "label": "Timeline", "props": {"title": "Our Journey"}},
            ]
        elif slug == "services":
            page_blocks = [
                {"block_type": "hero_minimal",     "label": "Hero", "props": {"headline": "Our Services", "bg_style": "minimal"}},
                {"block_type": "services_cards",   "label": "Services", "props": {"title": "What We Offer", "columns": 3}},
                {"block_type": "features_alternating", "label": "Features", "props": {"title": "How It Works"}},
                {"block_type": "cta",              "label": "CTA", "props": {"headline": "Ready to Work Together?", "cta_label": "Get In Touch"}},
            ]
        elif slug == "products":
            page_blocks = [
                {"block_type": "hero_minimal", "label": "Hero", "props": {"headline": "Our Products", "bg_style": "minimal"}},
                {"block_type": "product_grid", "label": "Products", "props": {"title": "Shop the catalog", "columns": 4, "show_badges": True}},
                {"block_type": "cta",          "label": "CTA", "props": {"headline": "Questions about an item?", "cta_label": "Contact us"}},
            ]
        elif slug == "pricing":
            page_blocks = [
                {"block_type": "pricing", "label": "Pricing", "props": {"title": "Simple, Transparent Pricing", "show_annual_toggle": True}},
                {"block_type": "faq",     "label": "FAQ", "props": {"title": "Pricing FAQs"}},
                {"block_type": "cta",     "label": "CTA", "props": {"headline": "Not sure which plan? Talk to us.", "cta_label": "Contact Sales"}},
            ]
        elif slug == "contact":
            page_blocks = [
                {"block_type": "contact_form", "label": "Contact", "props": {"title": "Get In Touch", "full_page": True}},
            ]
        elif slug == "blog":
            page_blocks = [
                {"block_type": "blog_grid",  "label": "Blog Grid", "props": {"title": "Latest Insights", "columns": 3}},
                {"block_type": "newsletter", "label": "Newsletter", "props": {"title": "Stay in the Loop"}},
            ]

        pages_out.append({
            "title": "Home" if slug == "home" else slug.replace("-", " ").title(),
            "slug": slug if slug != "home" else "home",
            "page_type": slug if slug in ("home", "about", "services", "contact", "blog", "pricing") else "custom",
            "is_homepage": slug == "home",
            "show_in_nav": True,
            "seo_title": f"{short_name} — {slug.replace('-', ' ').title()}" if slug != "home" else f"{short_name} — Home",
            "seo_description": (biz[:150] if biz else f"Welcome to {short_name}."),
            "blocks": page_blocks,
        })

    for page in pages_out:
        if page.get("blocks"):
            page["blocks"] = _enrich_blocks_with_modern_design(page["blocks"], style_cfg)

    return AIGenerateSiteResponse(
        site_name=short_name,
        tagline=f"Your trusted partner in {niche}",
        seo_title=f"{short_name} — {niche.capitalize()} Solutions",
        seo_description=(biz[:150] if biz else f"Discover {short_name}."),
        summary=f"Generated {len(pages_out)} pages for {short_name}.",
        style_config=style_cfg,
        pages=pages_out,
    )


@router.post("/{site_id}/ai/apply-generated-site", response_model=SiteOut)
async def apply_generated_site(
    site_id: str,
    body: AIGenerateSiteResponse,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Apply an AI-generated site structure (replaces all pages/blocks)."""
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    await db.execute(delete(WebsiteBlock).where(
        WebsiteBlock.page_id.in_(select(WebsitePage.id).where(WebsitePage.site_id == UUID(site_id)))
    ))
    await db.execute(delete(WebsitePage).where(WebsitePage.site_id == UUID(site_id)))

    if body.style_config:
        site.style_config = {**site.style_config, **body.style_config}
    if body.seo_title:
        site.seo_title = body.seo_title
    if body.seo_description:
        site.seo_description = body.seo_description

    category_id = str((site.style_config or {}).get("image_category_id") or "shop")
    category_imgs = _images_for_category(category_id, 20)
    img_cursor = [0]
    homepage_set = False
    page_dicts: List[Dict[str, Any]] = []

    for p_idx, p in enumerate(body.pages):
        is_home = bool(p.get("is_homepage")) and not homepage_set
        if is_home:
            homepage_set = True
        elif p_idx == 0 and not homepage_set:
            is_home = True
            homepage_set = True

        page_id_new = uuid.uuid4()
        page = WebsitePage(
            id=page_id_new, site_id=UUID(site_id),
            title=p.get("title", "Page"), slug=p.get("slug", f"page-{p_idx}"),
            page_type=p.get("page_type", "custom"),
            is_homepage=is_home,
            show_in_nav=p.get("show_in_nav", True),
            seo_title=p.get("seo_title"), seo_description=p.get("seo_description"),
            sort_order=p_idx,
        )
        db.add(page)
        await db.flush()

        page_dicts.append({
            "title": page.title,
            "slug": page.slug,
            "is_homepage": page.is_homepage,
            "show_in_nav": page.show_in_nav,
            "sort_order": page.sort_order,
        })

        for b_idx, b in enumerate(p.get("blocks", [])):
            b_type = b.get("block_type", "rich_text")
            # Nav / footer / announcement bar live on the homepage only.
            if not is_home and b_type in ("nav", "footer", "announcement_bar"):
                continue
            props = _enrich_block_props_with_category(
                b_type,
                b.get("props", {}) or {},
                category_imgs,
                img_cursor,
                category_id,
            )
            props = _wire_block_auto_source(b_type, props)
            if category_id and "_image_category_id" not in props:
                props["_image_category_id"] = category_id
            block = WebsiteBlock(
                id=uuid.uuid4(), page_id=page_id_new,
                block_type=b_type, label=b.get("label"),
                props=props, style_overrides={}, sort_order=b_idx,
                animation=b.get("animation"),
                animation_delay=int(b.get("animation_delay") or 0),
            )
            db.add(block)

    nav_links = _nav_links_from_page_dicts(page_dicts)
    if nav_links:
        nav_blocks = (await db.execute(
            select(WebsiteBlock).where(
                WebsiteBlock.page_id.in_(
                    select(WebsitePage.id).where(WebsitePage.site_id == UUID(site_id))
                ),
                WebsiteBlock.block_type == "nav",
            )
        )).scalars().all()
        for nav_block in nav_blocks:
            props = dict(nav_block.props or {})
            props["nav_links"] = nav_links
            nav_block.props = props

    site.updated_at = datetime.utcnow()
    await db.commit()
    return await _get_site(db, site_id, vendor.id)


# ── P3.5 AI-over-ERP: Conversion Insights ────────────────────────────────────

@router.post("/{site_id}/ai/conversion-insights")
async def ai_conversion_insights(
    site_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    AI analysis: joins recent orders, sessions, and site blocks to explain
    why conversion may be low and suggest block edits.
    """
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    # Gather ERP data (simplified — join orders + products)
    from sqlalchemy import desc as sa_desc
    from app.models.order import Order
    from app.models.vendor_product import Product

    orders_result = await db.execute(
        select(Order)
        .where(Order.vendor_id == vendor.id)
        .order_by(sa_desc(Order.created_at))
        .limit(50)
    )
    orders = orders_result.scalars().all()

    products_result = await db.execute(
        select(Product).where(Product.vendor_id == vendor.id, Product.is_active == True).limit(20)
    )
    products = products_result.scalars().all()

    # Summarise
    total_orders = len(orders)
    avg_order_value = sum(float(o.total_amount or 0) for o in orders) / max(total_orders, 1)
    top_products = [p.name for p in products[:5]]

    prompt = f"""You are a conversion optimization expert. Analyse this e-commerce store:

Store: {site.name}
Site pages: {len(site.pages)} pages published
Total recent orders: {total_orders}
Average order value: ${avg_order_value:.2f}
Top products: {', '.join(top_products) or 'none'}

User focus: {body.get('focus', 'general conversion improvement')}

Provide:
1. Top 3 reasons conversion may be low (with specific evidence)
2. Top 3 block changes to improve conversion (with exact block types)
3. One quick win implementable in 5 minutes

Format: JSON with keys: reasons (list), block_suggestions (list of {{block_type, change, why}}), quick_win (string)"""

    try:
        import httpx
        ai_resp = await httpx.AsyncClient(timeout=30).post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {__import__('os').environ.get('OPENAI_API_KEY', '')}"},
            json={"model": "gpt-4o-mini", "response_format": {"type": "json_object"},
                  "messages": [{"role": "user", "content": prompt}]}
        )
        data = ai_resp.json()
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        return {"ok": True, "insights": json.loads(text), "data_summary": {
            "total_orders": total_orders, "avg_order_value": round(avg_order_value, 2)
        }}
    except Exception as e:
        return {"ok": False, "error": str(e), "insights": {
            "reasons": ["Unable to generate AI insights — check OpenAI API key"],
            "block_suggestions": [],
            "quick_win": "Add a CTA block above the fold",
        }}


# ── Sitemap XML ────────────────────────────────────────────────────────────────

@router.get("/{site_id}/sitemap.xml")
async def get_sitemap(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    from fastapi.responses import Response as FResponse
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    base_url = f"https://{site.custom_domain or (str(site.subdomain) + '.kiterp.com' if site.subdomain else 'yoursite.com')}"

    urls = []
    for page in site.pages:
        if not page.is_published or page.deleted_at or page.noindex:
            continue
        slug = "" if page.is_homepage else f"/{page.slug}"
        urls.append(
            f"  <url><loc>{base_url}{slug}</loc>"
            f"<lastmod>{page.updated_at.strftime('%Y-%m-%d')}</lastmod>"
            f"<changefreq>weekly</changefreq>"
            f"<priority>{'1.0' if page.is_homepage else '0.8'}</priority></url>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls) + "\n</urlset>"
    )
    return FResponse(content=xml, media_type="application/xml")


# ── Live data feeds ───────────────────────────────────────────────────────────
#
# Unified read-only endpoint so every block in the builder can bind to real
# KITERP data with one call. Items are normalized into a common shape:
#   { id, title, subtitle, description, image_url, price, rating, url, meta }
# so frontend blocks can consume any feed uniformly and still fall back to
# resource-specific fields via `meta`.

def _norm_item(**kw) -> Dict[str, Any]:
    """Return a normalized live item with all keys present."""
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


async def _fetch_live_resource_items(
    db: AsyncSession,
    vendor,
    site,
    site_id: str,
    resource: str,
    limit: int,
) -> List[Dict[str, Any]]:
    """Shared live-feed fetcher for builder blocks and static exports."""
    limit = max(1, min(limit, 200))
    items: List[Dict[str, Any]] = []

    if resource == "products":
        from app.models.vendor_product import Product, ProductImage
        from app.services.product_media import resolve_product_thumbnail_url
        from app.services.product_pricing import live_product_price_fields
        q = (
            select(Product)
            .options(selectinload(Product.images), selectinload(Product.variants))
            .where(Product.vendor_id == vendor.id, Product.is_visible.is_(True))
            .order_by(Product.is_featured.desc(), Product.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        for p in rows:
            img = resolve_product_thumbnail_url(p)
            price_fields = live_product_price_fields(p)
            items.append(_norm_item(
                id=str(p.id),
                title=p.name or "",
                subtitle=p.brand,
                description=p.short_description or p.description,
                image_url=img,
                price=price_fields["price"],
                price_formatted=price_fields["price_formatted"],
                url=f"/products/{p.slug}" if p.slug else None,
                meta={
                    "sku": p.sku,
                    "slug": p.slug,
                    "category": p.category,
                    "stock_status": p.stock_status,
                    "quantity": p.quantity,
                    "is_featured": p.is_featured,
                    "is_on_sale": p.is_on_sale,
                    "discount_percentage": float(p.discount_percentage) if p.discount_percentage is not None else None,
                    "compare_at_price": price_fields["compare_at_price"],
                    "currency": p.currency,
                    "offer_label": p.offer_label,
                    "price_from_variants": price_fields["price_from_variants"],
                    "view_count": int(p.view_count or 0),
                },
            ))

    elif resource == "services":
        from app.models.vendor_service import Service
        from app.services.service_media import resolve_service_thumbnail_url
        q = (
            select(Service)
            .where(
                Service.vendor_id == vendor.id,
                Service.status == "active",
                Service.is_visible.is_(True),
            )
            .order_by(Service.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        for s in rows:
            price_val = float(s.price) if s.price is not None else None
            if s.price_type == "free":
                price_formatted = "Free"
            elif s.price_type == "not_applicable":
                price_formatted = None
                price_val = None
            elif price_val is not None and price_val > 0:
                price_formatted = f"{s.currency or 'INR'} {price_val:,.0f}"
            else:
                price_formatted = "Get a Quote"
            items.append(_norm_item(
                id=str(s.id),
                title=s.name or "",
                subtitle=s.category,
                description=s.short_description or s.description,
                image_url=resolve_service_thumbnail_url(s),
                price=price_val if price_val and price_val > 0 else None,
                price_formatted=price_formatted,
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
                    "booking_label": (s.booking_label or "Booking").strip() or "Booking",
                    "allow_quote_request": bool(s.allow_quote_request),
                    "subscription_label": (getattr(s, "subscription_label", None) or "Subscription").strip() or "Subscription",
                    "quote_request_label": (getattr(s, "quote_request_label", None) or "Quote Requests").strip() or "Quote Requests",
                },
            ))

    elif resource == "testimonials":
        from app.services.testimonials_live_feed import build_testimonials_live_items
        items = await build_testimonials_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "team":
        try:
            from app.models.hr import EmployeeProfile, Designation
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

    elif resource == "customers":
        from app.models.customer import Customer
        q = (
            select(Customer)
            .where(Customer.vendor_id == vendor.id, Customer.is_active.is_(True))
            .order_by(Customer.total_spent.desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        for c in rows:
            items.append(_norm_item(
                id=str(c.id),
                title=c.full_name or c.email or "Customer",
                subtitle=c.company_name or c.email,
                image_url=c.avatar_url,
                meta={
                    "total_orders": int(c.total_orders or 0),
                    "total_spent": float(c.total_spent or 0),
                },
            ))

    elif resource == "orders":
        from app.models.order import Order
        q = (
            select(Order)
            .where(Order.vendor_id == vendor.id)
            .order_by(Order.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        for o in rows:
            items.append(_norm_item(
                id=str(o.id),
                title=o.order_number or "",
                subtitle=o.status,
                price=float(o.total) if o.total is not None else None,
                meta={
                    "status": o.status,
                    "payment_status": o.payment_status,
                    "item_count": int(o.item_count or 0),
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                },
            ))

    elif resource == "bookings":
        from app.models.booking import Booking
        q = (
            select(Booking)
            .where(Booking.vendor_id == vendor.id)
            .order_by(Booking.booking_date.desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        for b in rows:
            items.append(_norm_item(
                id=str(b.id),
                title=b.service_name or b.booking_number or "",
                subtitle=b.customer_name,
                price=float(b.total) if b.total is not None else None,
                meta={
                    "status": b.status,
                    "booking_date": b.booking_date.isoformat() if b.booking_date else None,
                    "start_time": b.start_time.isoformat() if b.start_time else None,
                    "payment_status": b.payment_status,
                },
            ))

    elif resource == "categories":
        from app.services.category_live_feed import build_category_live_items
        items = await build_category_live_items(db, vendor.id, limit, _norm_item)

    elif resource == "media":
        rows = (await db.execute(
            select(WebsiteMedia)
            .where(WebsiteMedia.site_id == UUID(site_id))
            .order_by(WebsiteMedia.created_at.desc())
            .limit(limit)
        )).scalars().all()
        for m in rows:
            items.append(_norm_item(
                id=str(m.id),
                title=m.filename or "",
                image_url=m.thumbnail_url or m.adjusted_url or m.original_url,
                url=m.original_url,
                meta={
                    "file_type": m.file_type,
                    "file_size": m.file_size,
                    "width": m.width,
                    "height": m.height,
                },
            ))

    elif resource == "pages":
        seen_urls: set[str] = set()
        for page in sorted(site.pages or [], key=lambda p: (not p.is_homepage, getattr(p, "sort_order", 0))):
            if not getattr(page, "is_published", True) or not getattr(page, "show_in_nav", True):
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
                meta={
                    "is_homepage": bool(page.is_homepage),
                    "slug": page.slug,
                    "page_type": page.page_type,
                },
            ))
            if len(items) >= limit:
                break

    elif resource == "blog":
        from app.services.blog_live_feed import build_blog_live_items

        items = await build_blog_live_items(db, vendor.id, limit, _norm_item, include_drafts=True)

    elif resource == "plans":
        from app.services.plans_live_feed import build_plans_live_items

        items = await build_plans_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "properties":
        from app.services.properties_live_feed import build_properties_live_items

        items = await build_properties_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "courses":
        from app.services.courses_live_feed import build_courses_live_items

        items = await build_courses_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "fitness_classes":
        from app.services.fitness_classes_live_feed import build_fitness_classes_live_items

        items = await build_fitness_classes_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "vehicles":
        from app.services.vehicles_live_feed import build_vehicles_live_items

        items = await build_vehicles_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "events":
        from app.services.events_live_feed import build_events_live_items

        items = await build_events_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "recurring_plans":
        from app.services.recurring_plans_live_feed import build_recurring_plans_live_items

        items = await build_recurring_plans_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "booking_wizard_steps":
        from app.services.booking_wizard_steps_live_feed import build_booking_wizard_steps_live_items

        items = await build_booking_wizard_steps_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "booking_resources":
        from app.services.booking_resources_live_feed import build_booking_resources_live_items

        items = await build_booking_resources_live_items(db, vendor.id, limit, _norm_item, include_inactive=True)

    elif resource == "profile":
        from app.services.storefront_contact import build_profile_live_meta, load_linked_store_for_site

        linked_store = await load_linked_store_for_site(db, vendor.id, site.style_config)
        meta = build_profile_live_meta(vendor, linked_store)
        items = [_norm_item(
            id=str(vendor.id),
            title=vendor.display_name or vendor.business_name or "",
            subtitle=vendor.industry,
            description=vendor.description,
            image_url=vendor.logo_url,
            meta=meta,
        )]

    elif resource == "kpis":
        from app.models.vendor_product import Product
        from app.models.vendor_service import Service
        from app.models.order import Order
        from app.models.customer import Customer
        from app.models.review import Review

        products_count = (await db.execute(
            select(func.count(Product.id)).where(Product.vendor_id == vendor.id)
        )).scalar() or 0
        services_count = (await db.execute(
            select(func.count(Service.id)).where(Service.vendor_id == vendor.id)
        )).scalar() or 0
        customers_count = (await db.execute(
            select(func.count(Customer.id)).where(Customer.vendor_id == vendor.id)
        )).scalar() or 0
        orders_count = (await db.execute(
            select(func.count(Order.id)).where(Order.vendor_id == vendor.id)
        )).scalar() or 0
        revenue = (await db.execute(
            select(func.coalesce(func.sum(Order.total), 0))
            .where(Order.vendor_id == vendor.id, Order.payment_status == "paid")
        )).scalar() or 0
        avg_rating = (await db.execute(
            select(func.coalesce(func.avg(Review.rating), 0))
            .where(Review.vendor_id == vendor.id, Review.is_visible.is_(True))
        )).scalar() or 0

        def _fmt_count(n: int) -> str:
            if n >= 1_000_000:
                return f"{n / 1_000_000:.1f}M+"
            if n >= 1_000:
                return f"{n / 1_000:.1f}K+"
            return f"{int(n)}"

        items = [
            _norm_item(id="products", title=_fmt_count(products_count), subtitle="Products",
                       meta={"value": int(products_count)}),
            _norm_item(id="services", title=_fmt_count(services_count), subtitle="Services",
                       meta={"value": int(services_count)}),
            _norm_item(id="customers", title=_fmt_count(customers_count), subtitle="Happy Customers",
                       meta={"value": int(customers_count)}),
            _norm_item(id="orders", title=_fmt_count(orders_count), subtitle="Orders Delivered",
                       meta={"value": int(orders_count)}),
            _norm_item(id="revenue", title=f"₹{_fmt_count(int(revenue))}", subtitle="Revenue",
                       meta={"value": float(revenue)}),
            _norm_item(id="rating",
                       title=(f"{float(avg_rating):.1f}★" if avg_rating else "—"),
                       subtitle="Average Rating",
                       meta={"value": float(avg_rating)}),
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
            locality_parts = [p for p in [city, state] if p]
            subtitle = ", ".join(locality_parts) if locality_parts else (s.code or None)
            items.append(_norm_item(
                id=str(s.id),
                title=s.name or "",
                subtitle=subtitle,
                description=s.description,
                image_url=None,
                # Store link is branch-based — the frontend resolves it against
                # VITE_STOREFRONT_URL / the vendor subdomain and ?branch={code}.
                url=(f"?branch={s.code}" if s.code else f"?branch={str(s.id)}"),
                meta={
                    "code": s.code,
                    "phone": s.phone,
                    "email": s.email,
                    "is_default": bool(s.is_default),
                    "city": city,
                    "state": state,
                    "address": addr,
                },
            ))

    else:
        raise HTTPException(status_code=400, detail=f"Unknown live resource: {resource}")

    return items


@router.get("/{site_id}/live/{resource}")
async def get_live_resource(
    site_id: str,
    resource: str,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Read-only unified feed for website builder blocks.

    Supported resources:
      - products, services, testimonials, team, customers, orders,
        bookings, categories, media, pages, profile, kpis, blog
    """
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    items = await _fetch_live_resource_items(db, vendor, site, site_id, resource, limit)
    return {
        "resource": resource,
        "items": items,
        "count": len(items),
        "vendor_id": str(vendor.id),
        "site_id": site_id,
    }


# ── Public submissions from live blocks ──────────────────────────────────────
# Wire contact forms, newsletter signups, and booking requests placed on a
# website to real CRM/booking infrastructure without exposing internal admin
# endpoints to the visitor's browser.

@router.post("/{site_id}/live/contact")
async def submit_contact(
    site_id: str,
    body: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    from app.services.website_form_submissions import submit_website_contact_form

    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    result = await submit_website_contact_form(
        db,
        site,
        body,
        ip_address=(request.client.host if request.client else None),
        user_agent=request.headers.get("user-agent"),
    )
    return {
        "ok": True,
        "submission_id": result["submission_id"],
        "lead_id": result["lead_id"],
    }


@router.post("/{site_id}/live/newsletter")
async def submit_newsletter(
    site_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    email = (body.get("email") or "").strip()
    if not email or "@" not in email:
        raise HTTPException(400, "Valid email required")
    return {"ok": True, "email": email, "subscribed_at": datetime.utcnow().isoformat()}


# ── Redirect Manager ──────────────────────────────────────────────────────────

@router.get("/{site_id}/redirects", response_model=List[SiteRedirectOut])
async def list_redirects(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteRedirect).where(WebsiteRedirect.site_id == UUID(site_id))
        .order_by(WebsiteRedirect.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{site_id}/redirects", response_model=SiteRedirectOut, status_code=201)
async def create_redirect(
    site_id: str,
    body: SiteRedirectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    from_path = body.from_path if body.from_path.startswith("/") else f"/{body.from_path}"
    to_path = body.to_path if body.to_path.startswith("/") or body.to_path.startswith("http") else f"/{body.to_path}"
    redirect = WebsiteRedirect(
        site_id=UUID(site_id), from_path=from_path, to_path=to_path,
        status_code=body.status_code, is_active=body.is_active,
    )
    db.add(redirect)
    await db.commit()
    await db.refresh(redirect)
    return redirect


@router.patch("/{site_id}/redirects/{redirect_id}", response_model=SiteRedirectOut)
async def update_redirect(
    site_id: str, redirect_id: str, body: SiteRedirectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteRedirect).where(WebsiteRedirect.id == UUID(redirect_id), WebsiteRedirect.site_id == UUID(site_id))
    )
    redirect = result.scalar_one_or_none()
    if not redirect:
        raise HTTPException(404, "Redirect not found")
    for k, v in body.dict(exclude_none=True).items():
        setattr(redirect, k, v)
    await db.commit()
    await db.refresh(redirect)
    return redirect


@router.delete("/{site_id}/redirects/{redirect_id}", status_code=204)
async def delete_redirect(
    site_id: str, redirect_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteRedirect).where(WebsiteRedirect.id == UUID(redirect_id), WebsiteRedirect.site_id == UUID(site_id))
    )
    redirect = result.scalar_one_or_none()
    if not redirect:
        raise HTTPException(404, "Redirect not found")
    await db.delete(redirect)
    await db.commit()


# ── Headless ──────────────────────────────────────────────────────────────────

@router.post("/{site_id}/headless/enable", response_model=SiteOut)
async def enable_headless(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    import secrets
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    site.headless_enabled = True
    site.headless_token = secrets.token_urlsafe(32)
    site.updated_at = datetime.utcnow()
    await db.commit()
    return await _get_site(db, site_id, vendor.id)


@router.post("/{site_id}/headless/disable", response_model=SiteOut)
async def disable_headless(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    site.headless_enabled = False
    site.headless_token = None
    site.updated_at = datetime.utcnow()
    await db.commit()
    return await _get_site(db, site_id, vendor.id)


# ── Form Submissions (P1.4) ───────────────────────────────────────────────────

@router.get("/{site_id}/forms/submissions")
async def list_form_submissions(
    site_id: str,
    form_type: Optional[str] = None,
    page_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """List all form submissions for a site (Forms Inbox)."""
    from app.models.website import WebsiteFormSubmission
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    q = select(WebsiteFormSubmission).where(WebsiteFormSubmission.site_id == UUID(site_id))
    if form_type:
        q = q.where(WebsiteFormSubmission.form_type == form_type)
    if page_id:
        q = q.where(WebsiteFormSubmission.page_id == UUID(page_id))
    q = q.order_by(WebsiteFormSubmission.created_at.desc()).limit(limit).offset(offset)

    rows = (await db.execute(q)).scalars().all()
    total = (await db.execute(
        select(func.count(WebsiteFormSubmission.id)).where(WebsiteFormSubmission.site_id == UUID(site_id))
    )).scalar() or 0

    return {
        "submissions": [
            {
                "id": str(r.id),
                "site_id": str(r.site_id),
                "page_id": str(r.page_id) if r.page_id else None,
                "block_id": str(r.block_id) if r.block_id else None,
                "form_type": r.form_type,
                "payload": r.payload,
                "crm_lead_id": str(r.crm_lead_id) if r.crm_lead_id else None,
                "gdpr_consent": r.gdpr_consent,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": total,
    }


@router.delete("/{site_id}/forms/submissions/{submission_id}", status_code=204)
async def delete_form_submission(
    site_id: str,
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Delete a form submission (GDPR right-to-erasure)."""
    from app.models.website import WebsiteFormSubmission
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteFormSubmission).where(
            WebsiteFormSubmission.id == UUID(submission_id),
            WebsiteFormSubmission.site_id == UUID(site_id),
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Submission not found")
    await db.delete(sub)
    await db.commit()


# ── Page Revisions (P2.2) ─────────────────────────────────────────────────────

@router.get("/{site_id}/pages/{page_id}/revisions")
async def list_page_revisions(
    site_id: str,
    page_id: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """List historical snapshots for a page (History tab)."""
    from app.models.website import WebsitePageRevision
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    rows = (await db.execute(
        select(WebsitePageRevision)
        .where(WebsitePageRevision.page_id == UUID(page_id), WebsitePageRevision.site_id == UUID(site_id))
        .order_by(WebsitePageRevision.created_at.desc())
        .limit(limit)
    )).scalars().all()

    return [
        {
            "id": str(r.id),
            "page_id": str(r.page_id),
            "note": r.note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/{site_id}/pages/{page_id}/revisions/{revision_id}/restore")
async def restore_page_revision(
    site_id: str,
    page_id: str,
    revision_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Restore a page to a previous revision."""
    from app.models.website import WebsitePageRevision
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    rev_res = await db.execute(
        select(WebsitePageRevision).where(
            WebsitePageRevision.id == UUID(revision_id),
            WebsitePageRevision.page_id == UUID(page_id),
        )
    )
    revision = rev_res.scalar_one_or_none()
    if not revision:
        raise HTTPException(404, "Revision not found")

    snapshot = revision.snapshot or {}

    # Restore page metadata
    page_res = await db.execute(
        select(WebsitePage).where(WebsitePage.id == UUID(page_id), WebsitePage.site_id == UUID(site_id))
    )
    page = page_res.scalar_one_or_none()
    if not page:
        raise HTTPException(404, "Page not found")

    for field in [
        "title", "slug", "seo_title", "seo_description", "og_image_url",
        "focus_keyword", "seo_keywords", "noindex", "og_title", "og_description",
        "canonical_url", "schema_type", "layout",
    ]:
        if field in snapshot:
            setattr(page, field, snapshot[field])
    page.updated_at = datetime.utcnow()

    # Restore blocks — delete existing, re-create from snapshot
    await db.execute(
        select(WebsiteBlock).where(WebsiteBlock.page_id == UUID(page_id))
    )
    existing = (await db.execute(select(WebsiteBlock).where(WebsiteBlock.page_id == UUID(page_id)))).scalars().all()
    for b in existing:
        await db.delete(b)

    for b_snap in snapshot.get("blocks", []):
        block = WebsiteBlock(
            id=uuid.uuid4(),
            page_id=UUID(page_id),
            block_type=b_snap.get("block_type", "rich_text"),
            label=b_snap.get("label"),
            props=b_snap.get("props", {}),
            style_overrides=b_snap.get("style_overrides", {}),
            visible=b_snap.get("visible", True),
            sort_order=b_snap.get("sort_order", 0),
        )
        db.add(block)

    await db.commit()
    return {"ok": True, "restored_revision_id": revision_id}


# ── Builder preview snapshots (business front draft browser preview) ───────────

MAX_BUILDER_PREVIEW_BYTES = 2 * 1024 * 1024


@router.post("/{site_id}/builder-previews")
async def create_builder_preview(
    site_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Save a full-site JSON snapshot; business front loads it via public preview-by-token."""
    vendor = await _get_vendor(db, user)
    await _get_site_readable(db, site_id, vendor.id)
    payload = body.get("payload")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be an object")
    pages = payload.get("pages")
    if not isinstance(pages, list):
        raise HTTPException(status_code=400, detail="payload.pages must be an array")
    try:
        raw = json.dumps(payload, default=str)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="payload must be JSON-serializable")
    if len(raw.encode("utf-8")) > MAX_BUILDER_PREVIEW_BYTES:
        raise HTTPException(status_code=400, detail="Preview payload too large (max 2MB)")
    label = body.get("label")
    if label is not None:
        if not isinstance(label, str) or len(label) > 200:
            raise HTTPException(status_code=400, detail="label must be a string of at most 200 characters")

    token = secrets.token_urlsafe(48)[:64]
    row = WebsiteBuilderPreview(
        site_id=UUID(site_id),
        preview_token=token,
        label=label if isinstance(label, str) else None,
        payload=payload,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {
        "id": str(row.id),
        "preview_token": row.preview_token,
        "label": row.label,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.put("/{site_id}/builder-previews/{token}")
async def update_builder_preview(
    site_id: str,
    token: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Update an existing draft preview snapshot in place (keeps the same browser tab token)."""
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    if not token or len(token) > 128:
        raise HTTPException(status_code=400, detail="Invalid preview token")

    payload = body.get("payload")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be an object")
    pages = payload.get("pages")
    if not isinstance(pages, list):
        raise HTTPException(status_code=400, detail="payload.pages must be an array")
    try:
        raw = json.dumps(payload, default=str)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="payload must be JSON-serializable")
    if len(raw.encode("utf-8")) > MAX_BUILDER_PREVIEW_BYTES:
        raise HTTPException(status_code=400, detail="Preview payload too large (max 2MB)")

    result = await db.execute(
        select(WebsiteBuilderPreview).where(
            WebsiteBuilderPreview.site_id == UUID(site_id),
            WebsiteBuilderPreview.preview_token == token,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Preview not found")

    label = body.get("label")
    if label is not None:
        if not isinstance(label, str) or len(label) > 200:
            raise HTTPException(status_code=400, detail="label must be a string of at most 200 characters")
        row.label = label

    row.payload = payload
    await db.commit()
    await db.refresh(row)
    return {
        "id": str(row.id),
        "preview_token": row.preview_token,
        "label": row.label,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/{site_id}/builder-previews")
async def list_builder_previews(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """List recent preview snapshots for this site (newest first)."""
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteBuilderPreview)
        .where(WebsiteBuilderPreview.site_id == UUID(site_id))
        .order_by(WebsiteBuilderPreview.created_at.desc())
        .limit(50)
    )
    rows = list(result.scalars().all())
    return [
        {
            "id": str(r.id),
            "preview_token": r.preview_token,
            "label": r.label,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Export / Import (P2.5) ─────────────────────────────────────────────────────

@router.get("/{site_id}/export")
async def export_site(
    site_id: str,
    mode: str = Query("dynamic", pattern="^(static|dynamic)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Export a site as JSON.

    mode=static   — self-contained file; sync blocks include static_snapshot data (no API needed).
    mode=dynamic  — design + static content + data_source wiring only for sync blocks.
    """
    from sqlalchemy.orm import selectinload
    from fastapi.responses import JSONResponse
    from app.services.website_export import (
        fetch_block_static_snapshot,
        props_for_dynamic_export,
    )

    vendor = await _get_vendor(db, user)
    result = await db.execute(
        select(WebsiteSite)
        .options(selectinload(WebsiteSite.pages).selectinload(WebsitePage.blocks))
        .where(WebsiteSite.id == UUID(site_id), WebsiteSite.vendor_id == vendor.id)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(404, "Site not found")

    live_cache: Dict[tuple, List[Dict[str, Any]]] = {}
    pages_out: List[Dict[str, Any]] = []

    for p in sorted(site.pages or [], key=lambda x: x.sort_order or 0):
        blocks_out: List[Dict[str, Any]] = []
        for b in sorted(p.blocks or [], key=lambda x: x.sort_order or 0):
            raw_props = b.props if isinstance(b.props, dict) else {}
            block_out: Dict[str, Any] = {
                "block_type": b.block_type,
                "label": b.label,
                "style_overrides": b.style_overrides,
                "visible": b.visible,
                "sort_order": b.sort_order,
            }
            if mode == "static":
                block_out["props"] = raw_props
                snapshot = await fetch_block_static_snapshot(
                    db,
                    vendor,
                    site,
                    site_id,
                    b.block_type,
                    raw_props,
                    live_cache,
                    _fetch_live_resource_items,
                )
                if snapshot:
                    block_out["static_snapshot"] = snapshot
            else:
                block_out["props"] = props_for_dynamic_export(b.block_type, raw_props)

            blocks_out.append(block_out)

        pages_out.append({
            "title": p.title,
            "slug": p.slug,
            "page_type": p.page_type,
            "is_homepage": p.is_homepage,
            "show_in_nav": p.show_in_nav,
            "seo_title": p.seo_title,
            "seo_description": p.seo_description,
            "focus_keyword": p.focus_keyword,
            "seo_keywords": p.seo_keywords,
            "noindex": bool(p.noindex),
            "og_title": p.og_title,
            "og_description": p.og_description,
            "og_image_url": p.og_image_url,
            "canonical_url": p.canonical_url,
            "schema_type": p.schema_type or "auto",
            "sort_order": p.sort_order,
            "blocks": blocks_out,
        })

    slug_part = (site.subdomain or site.name or site_id or "site").strip().lower()
    slug_part = "".join(c if c.isalnum() or c in "-_" else "-" for c in slug_part).strip("-") or "site"
    export = {
        "export_version": 2,
        "export_mode": mode,
        "exported_at": datetime.utcnow().isoformat(),
        "site": {
            "name": site.name,
            "subdomain": site.subdomain,
            "description": site.description,
            "logo_url": site.logo_url,
            "favicon_url": site.favicon_url,
            "style_config": site.style_config,
            "seo_title": site.seo_title,
            "seo_description": site.seo_description,
            "language": site.language,
            "currency": site.currency,
            "pages": pages_out,
        },
    }
    return JSONResponse(
        content=export,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{slug_part}-{mode}.kit-site.json"'
            ),
        },
    )


# ── Drafts, Scheduling & Signed Preview (P2.3) ───────────────────────────────

@router.post("/{site_id}/pages/{page_id}/schedule")
async def schedule_page_publish(
    site_id: str,
    page_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Schedule a page to go live at a specific UTC datetime."""
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    result = await db.execute(
        select(WebsitePage).where(WebsitePage.id == UUID(page_id), WebsitePage.site_id == UUID(site_id))
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(404, "Page not found")

    scheduled_at_str = body.get("scheduled_publish_at")
    if scheduled_at_str:
        from dateutil import parser as dtparser  # type: ignore
        scheduled_at = dtparser.parse(scheduled_at_str)
        page.publish_status = "scheduled"
        page.scheduled_publish_at = scheduled_at
        page.is_published = False
    else:
        page.publish_status = "draft"
        page.scheduled_publish_at = None
        page.is_published = False

    page.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "page_id": page_id,
        "publish_status": page.publish_status,
        "scheduled_publish_at": page.scheduled_publish_at.isoformat() if page.scheduled_publish_at else None,
    }


@router.post("/{site_id}/preview-link")
async def create_preview_link(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Generate a signed preview URL that lets anyone view the unpublished site
    for 24 hours. The token is embedded in the URL and verified by the business front.
    """
    import secrets, hashlib
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    # Simple HMAC-like token: sha256(site_id + vendor_id + expires_epoch)
    expires_epoch = int((datetime.utcnow().timestamp()) + 86400)  # 24h
    raw = f"{site_id}:{str(vendor.id)}:{expires_epoch}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:32]

    base_url = (
        f"https://{site.custom_domain}"
        if site.custom_domain and site.domain_verified
        else f"https://{site.subdomain}.kiterp.com"
        if site.subdomain
        else None
    )

    if not base_url:
        raise HTTPException(400, "Site must have a subdomain or verified custom domain to generate a preview link")

    preview_url = f"{base_url}?preview={token}&expires={expires_epoch}"
    return {"preview_url": preview_url, "expires_at": datetime.utcfromtimestamp(expires_epoch).isoformat()}


# ── Custom Domain Verification (P2.1) ─────────────────────────────────────────

@router.post("/{site_id}/domains/verify-init")
async def domain_verify_init(
    site_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Step 1: Set a custom domain and return the TXT record the vendor must add.
    The token must be added as: _kiterp-verify.{custom_domain} TXT {token}
    """
    import secrets
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    custom_domain = (body.get("custom_domain") or "").strip().lower()
    if not custom_domain or "." not in custom_domain:
        raise HTTPException(400, "Invalid custom domain")

    token = secrets.token_urlsafe(32)
    site.custom_domain = custom_domain
    site.domain_verification_token = token
    site.domain_verified = False
    site.domain_ssl_status = "pending"
    site.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "custom_domain": custom_domain,
        "verification_token": token,
        "dns_record_type": "TXT",
        "dns_record_name": f"_kiterp-verify.{custom_domain}",
        "dns_record_value": token,
        "instructions": f'Add a TXT record: _kiterp-verify.{custom_domain} = "{token}". DNS propagation may take up to 48h.',
    }


@router.post("/{site_id}/domains/verify-check")
async def domain_verify_check(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """
    Step 2: Check if the TXT record has propagated and mark domain as verified.
    In production this would do a real DNS lookup; here it simulates success.
    """
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    if not site.custom_domain or not site.domain_verification_token:
        raise HTTPException(400, "No pending domain verification")

    from app.services.dns_service import verify_txt_record

    hostname = f"_kiterp-verify.{site.custom_domain}"
    from app.config import settings
    verified = await verify_txt_record(hostname, site.domain_verification_token)
    if not verified and not settings.DEBUG:
        return {
            "verified": False,
            "custom_domain": site.custom_domain,
            "dns_record_name": hostname,
            "message": "TXT record not found yet. DNS can take up to 48 hours to propagate.",
        }

    site.domain_verified = True
    site.domain_ssl_status = "issued"
    site.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "verified": True,
        "custom_domain": site.custom_domain,
        "ssl_status": site.domain_ssl_status,
        "message": "Domain verified! SSL certificate is being issued (may take ~15 minutes).",
    }


@router.get("/{site_id}/domains/status")
async def domain_status(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Return the current custom domain + SSL status."""
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)

    return {
        "custom_domain": site.custom_domain,
        "subdomain": site.subdomain,
        "domain_verified": site.domain_verified,
        "domain_ssl_status": site.domain_ssl_status,
        "domain_ssl_expires_at": site.domain_ssl_expires_at.isoformat() if site.domain_ssl_expires_at else None,
        "verification_token": site.domain_verification_token,
    }


@router.post("/import", status_code=201)
async def import_site(
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Import a site from an export JSON payload."""
    vendor = await _get_vendor(db, user)
    if body.get("export_version") not in (1, 2):
        raise HTTPException(400, "Unsupported export version")

    s = body.get("site", {})
    site_id = uuid.uuid4()
    site = WebsiteSite(
        id=site_id,
        vendor_id=vendor.id,
        name=s.get("name", "Imported Site"),
        subdomain=None,  # don't clone subdomain to avoid collisions
        description=s.get("description"),
        logo_url=s.get("logo_url"),
        favicon_url=s.get("favicon_url"),
        style_config=s.get("style_config") or {},
        seo_title=s.get("seo_title"),
        seo_description=s.get("seo_description"),
        language=s.get("language", "en"),
        currency=s.get("currency", "USD"),
    )
    db.add(site)

    for page_data in s.get("pages", []):
        page_id = uuid.uuid4()
        page = WebsitePage(
            id=page_id,
            site_id=site_id,
            title=page_data.get("title", "Page"),
            slug=page_data.get("slug", "page"),
            page_type=page_data.get("page_type", "custom"),
            is_homepage=page_data.get("is_homepage", False),
            show_in_nav=page_data.get("show_in_nav", True),
            seo_title=page_data.get("seo_title"),
            seo_description=page_data.get("seo_description"),
            focus_keyword=page_data.get("focus_keyword"),
            seo_keywords=page_data.get("seo_keywords"),
            noindex=bool(page_data.get("noindex")),
            og_title=page_data.get("og_title"),
            og_description=page_data.get("og_description"),
            og_image_url=page_data.get("og_image_url"),
            canonical_url=page_data.get("canonical_url"),
            schema_type=page_data.get("schema_type") or "auto",
            sort_order=page_data.get("sort_order", 0),
        )
        db.add(page)

        for i, b in enumerate(page_data.get("blocks", [])):
            block = WebsiteBlock(
                id=uuid.uuid4(),
                page_id=page_id,
                block_type=b.get("block_type", "rich_text"),
                label=b.get("label"),
                props=b.get("props", {}),
                style_overrides=b.get("style_overrides", {}),
                visible=b.get("visible", True),
                sort_order=b.get("sort_order", i),
            )
            db.add(block)

    await db.commit()
    return await _get_site(db, str(site_id), vendor.id)


# ── P3.1 Block Translations ────────────────────────────────────────────────────

@router.get("/{site_id}/pages/{page_id}/blocks/{block_id}/translations")
async def list_block_translations(
    site_id: str,
    page_id: str,
    block_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteBlockTranslation).where(WebsiteBlockTranslation.block_id == block_id)
    )
    return [
        {"id": str(t.id), "block_id": str(t.block_id), "language": t.language,
         "props_override": t.props_override, "updated_at": t.updated_at}
        for t in result.scalars().all()
    ]


@router.put("/{site_id}/pages/{page_id}/blocks/{block_id}/translations/{language}")
async def upsert_block_translation(
    site_id: str,
    page_id: str,
    block_id: str,
    language: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    result = await db.execute(
        select(WebsiteBlockTranslation).where(
            WebsiteBlockTranslation.block_id == block_id,
            WebsiteBlockTranslation.language == language,
        )
    )
    translation = result.scalar_one_or_none()
    if translation:
        translation.props_override = body.get("props_override", {})
        translation.updated_at = datetime.utcnow()
    else:
        translation = WebsiteBlockTranslation(
            id=uuid.uuid4(),
            block_id=uuid.UUID(block_id),
            language=language,
            props_override=body.get("props_override", {}),
        )
        db.add(translation)

    await db.commit()
    return {"id": str(translation.id), "language": language, "props_override": translation.props_override}


@router.delete("/{site_id}/pages/{page_id}/blocks/{block_id}/translations/{language}", status_code=204)
async def delete_block_translation(
    site_id: str,
    page_id: str,
    block_id: str,
    language: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    await db.execute(
        delete(WebsiteBlockTranslation).where(
            WebsiteBlockTranslation.block_id == block_id,
            WebsiteBlockTranslation.language == language,
        )
    )
    await db.commit()


# ── P3.3 Symbols (reusable block subtrees) ────────────────────────────────────

@router.get("/symbols")
async def list_symbols(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    result = await db.execute(
        select(WebsiteSymbol).where(WebsiteSymbol.vendor_id == vendor.id)
    )
    return [
        {"id": str(s.id), "name": s.name, "description": s.description,
         "snapshot": s.snapshot, "thumbnail_url": s.thumbnail_url,
         "updated_at": s.updated_at}
        for s in result.scalars().all()
    ]


@router.post("/symbols", status_code=201)
async def create_symbol(
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    symbol = WebsiteSymbol(
        id=uuid.uuid4(),
        vendor_id=vendor.id,
        name=body.get("name", "New Symbol"),
        description=body.get("description"),
        snapshot=body.get("snapshot", {}),
        thumbnail_url=body.get("thumbnail_url"),
    )
    db.add(symbol)
    await db.commit()
    return {"id": str(symbol.id), "name": symbol.name, "snapshot": symbol.snapshot}


@router.patch("/symbols/{symbol_id}")
async def update_symbol(
    symbol_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    result = await db.execute(
        select(WebsiteSymbol).where(
            WebsiteSymbol.id == symbol_id,
            WebsiteSymbol.vendor_id == vendor.id,
        )
    )
    symbol = result.scalar_one_or_none()
    if not symbol:
        raise HTTPException(404, "Symbol not found")
    for k, v in body.items():
        if hasattr(symbol, k):
            setattr(symbol, k, v)
    symbol.updated_at = datetime.utcnow()
    await db.commit()
    return {"id": str(symbol.id), "name": symbol.name, "snapshot": symbol.snapshot}


@router.delete("/symbols/{symbol_id}", status_code=204)
async def delete_symbol(
    symbol_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await db.execute(
        delete(WebsiteSymbol).where(
            WebsiteSymbol.id == symbol_id,
            WebsiteSymbol.vendor_id == vendor.id,
        )
    )
    await db.commit()


# ── P3.7 A/B Test backend ─────────────────────────────────────────────────────

@router.post("/{site_id}/ab/expose")
async def record_ab_exposure(
    site_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — record an A/B exposure (no auth required)."""
    exposure = WebsiteABExposure(
        id=uuid.uuid4(),
        site_id=uuid.UUID(site_id),
        block_id=uuid.UUID(body["block_id"]),
        variant=body.get("variant", "a"),
        session_id=body.get("session_id"),
    )
    db.add(exposure)
    await db.commit()
    return {"ok": True}


@router.post("/{site_id}/ab/convert")
async def record_ab_conversion(
    site_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — mark an exposure as converted."""
    result = await db.execute(
        select(WebsiteABExposure).where(
            WebsiteABExposure.site_id == site_id,
            WebsiteABExposure.block_id == body.get("block_id"),
            WebsiteABExposure.session_id == body.get("session_id"),
        ).order_by(WebsiteABExposure.created_at.desc()).limit(1)
    )
    exposure = result.scalar_one_or_none()
    if exposure:
        exposure.converted = True
        await db.commit()
    return {"ok": True}


@router.get("/{site_id}/ab/results")
async def get_ab_results(
    site_id: str,
    block_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Returns exposure + conversion counts per variant for an A/B block."""
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    from sqlalchemy import and_, case
    result = await db.execute(
        select(
            WebsiteABExposure.variant,
            func.count(WebsiteABExposure.id).label("exposures"),
            func.sum(case((WebsiteABExposure.converted == True, 1), else_=0)).label("conversions"),
        ).where(
            and_(
                WebsiteABExposure.site_id == site_id,
                WebsiteABExposure.block_id == block_id,
            )
        ).group_by(WebsiteABExposure.variant)
    )
    rows = result.all()
    return {
        "block_id": block_id,
        "variants": [
            {
                "variant": row.variant,
                "exposures": row.exposures,
                "conversions": row.conversions,
                "conversion_rate": round(row.conversions / row.exposures * 100, 2) if row.exposures else 0,
            }
            for row in rows
        ]
    }


# ── P3.10 Outgoing Webhooks ───────────────────────────────────────────────────

@router.get("/{site_id}/webhooks")
async def list_webhooks(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteWebhook).where(WebsiteWebhook.site_id == site_id)
    )
    return [
        {"id": str(w.id), "event": w.event, "url": w.url, "is_active": w.is_active,
         "last_triggered_at": w.last_triggered_at, "last_status_code": w.last_status_code}
        for w in result.scalars().all()
    ]


@router.post("/{site_id}/webhooks", status_code=201)
async def create_webhook(
    site_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    allowed_events = {"site.published", "form.submitted", "order.placed"}
    event = body.get("event", "")
    if event not in allowed_events:
        raise HTTPException(400, f"event must be one of: {', '.join(sorted(allowed_events))}")

    import secrets as secrets_mod
    wh = WebsiteWebhook(
        id=uuid.uuid4(),
        site_id=uuid.UUID(site_id),
        event=event,
        url=body["url"],
        secret=body.get("secret") or secrets_mod.token_hex(32),
        is_active=True,
    )
    db.add(wh)
    await db.commit()
    return {"id": str(wh.id), "event": wh.event, "url": wh.url, "secret": wh.secret, "is_active": wh.is_active}


@router.patch("/{site_id}/webhooks/{webhook_id}")
async def update_webhook(
    site_id: str,
    webhook_id: str,
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsiteWebhook).where(WebsiteWebhook.id == webhook_id, WebsiteWebhook.site_id == site_id)
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found")
    for k in ("url", "is_active", "event"):
        if k in body:
            setattr(wh, k, body[k])
    await db.commit()
    return {"id": str(wh.id), "event": wh.event, "url": wh.url, "is_active": wh.is_active}


@router.delete("/{site_id}/webhooks/{webhook_id}", status_code=204)
async def delete_webhook(
    site_id: str,
    webhook_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)
    await db.execute(
        delete(WebsiteWebhook).where(WebsiteWebhook.id == webhook_id, WebsiteWebhook.site_id == site_id)
    )
    await db.commit()


async def _fire_webhooks(db: AsyncSession, site_id: str, event: str, payload: Dict[str, Any]) -> None:
    """Internal helper: dispatch outgoing webhooks for a given event."""
    import hashlib, hmac as hmac_mod
    result = await db.execute(
        select(WebsiteWebhook).where(
            WebsiteWebhook.site_id == site_id,
            WebsiteWebhook.event == event,
            WebsiteWebhook.is_active == True,
        )
    )
    hooks = result.scalars().all()
    if not hooks:
        return

    import httpx
    body_bytes = json.dumps({"event": event, "site_id": site_id, **payload}).encode()

    for wh in hooks:
        sig = ""
        if wh.secret:
            sig = hmac_mod.new(wh.secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    wh.url,
                    content=body_bytes,
                    headers={"Content-Type": "application/json", "X-Webhook-Signature": sig},
                )
            wh.last_status_code = resp.status_code
        except Exception:
            wh.last_status_code = 0
        wh.last_triggered_at = datetime.utcnow()

    await db.commit()
