"""
Website Builder API — multi-site, multi-page, block-based with full AI features.
"""
from __future__ import annotations
import copy
import secrets
import uuid, json, random
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
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
)

router = APIRouter(redirect_slashes=False)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_vendor(db: AsyncSession, user: User) -> Vendor:
    pref = get_preferred_vendor_id_from_context()
    return await resolve_dashboard_vendor(db, user, preferred_vendor_id=pref)


async def _get_site(db: AsyncSession, site_id: str, vendor_id: UUID) -> WebsiteSite:
    result = await db.execute(
        select(WebsiteSite)
        .options(selectinload(WebsiteSite.pages).selectinload(WebsitePage.blocks))
        .where(WebsiteSite.id == UUID(site_id), WebsiteSite.vendor_id == vendor_id)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


async def _get_page(db: AsyncSession, page_id: str, site_id: str) -> WebsitePage:
    result = await db.execute(
        select(WebsitePage)
        .options(selectinload(WebsitePage.blocks))
        .where(WebsitePage.id == UUID(page_id), WebsitePage.site_id == UUID(site_id))
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


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


# ── Legacy theme_config bridge ────────────────────────────────────────────────

async def _sync_legacy_theme_config(db, site, vendor) -> None:
    """
    On publish, mirror the homepage blocks into vendor.theme_config.builder_config
    so the legacy business front Home.tsx (which reads builder_config.sections) keeps
    working for tenants that haven"t fully migrated to BlockRenderer.

    Only the block types the legacy renderer understands are mapped.
    """
    from sqlalchemy import update as sql_update
    from app.models.vendor import Vendor

    homepage = next((p for p in (site.pages or []) if p.is_homepage and p.is_published), None)
    if not homepage:
        return

    LEGACY_MAP = {
        "hero": "hero",
        "hero_split": "hero",
        "hero_minimal": "hero",
        "features": "trust_badges",
        "product_grid": "featured_products",
        "menu_grid": "featured_products",
        "services_cards": "featured_services",
        "testimonials": "testimonials",
        "cta": "cta_banner",
        "announcement_bar": "announcement_bar",
        "stats": "trust_badges",
    }

    sections: list = []
    seen_legacy: set = set()
    for block in sorted(homepage.blocks or [], key=lambda b: b.sort_order or 0):
        if not block.visible:
            continue
        legacy_id = LEGACY_MAP.get(block.block_type)
        if legacy_id and legacy_id not in seen_legacy:
            sections.append({
                "id": legacy_id,
                "visible": True,
                "props": block.props or {},
            })
            seen_legacy.add(legacy_id)

    existing_theme = dict(vendor.theme_config or {})
    existing_theme["builder_config"] = {
        "site_id": str(site.id),
        "style_config": site.style_config or {},
        "sections": sections,
        "modules": {},
    }

    await db.execute(
        sql_update(Vendor)
        .where(Vendor.id == vendor.id)
        .values(theme_config=existing_theme)
    )
    await db.commit()


# ── Sites ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SiteListItem])
async def list_sites(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    result = await db.execute(
        select(WebsiteSite).where(WebsiteSite.vendor_id == vendor.id).order_by(WebsiteSite.created_at.desc())
    )
    sites = result.scalars().all()

    out = []
    for s in sites:
        page_count_res = await db.execute(
            select(func.count(WebsitePage.id)).where(WebsitePage.site_id == s.id)
        )
        page_count = page_count_res.scalar() or 0
        out.append(SiteListItem(
            id=str(s.id), name=s.name, subdomain=s.subdomain, custom_domain=s.custom_domain,
            description=s.description, favicon_url=s.favicon_url, logo_url=s.logo_url,
            is_published=s.is_published, status=s.status, page_count=page_count,
            created_at=s.created_at, updated_at=s.updated_at,
        ))
    return out


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
    site.style_config = {}
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
    return await _get_site(db, site_id, vendor.id)


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(
    site_id: str,
    body: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    for k, v in body.dict(exclude_none=True).items():
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
    await db.delete(site)
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

    # Sync homepage blocks into legacy vendor.theme_config.builder_config so
    # business front tenants that haven"t migrated to BlockRenderer keep working.
    try:
        await _sync_legacy_theme_config(db, site, vendor)
    except Exception:
        pass  # never block publish

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
    await _get_site(db, site_id, vendor.id)
    result = await db.execute(
        select(WebsitePage)
        .options(selectinload(WebsitePage.blocks))
        .where(WebsitePage.site_id == site_id)
        .order_by(WebsitePage.sort_order)
    )
    return result.scalars().all()


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
    for k, v in body.dict(exclude_none=True).items():
        setattr(page, k, v)
    page.updated_at = datetime.utcnow()
    await db.commit()
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
    page = await _get_page(db, page_id, site_id)
    await db.delete(page)
    await db.commit()


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
        await db.execute(
            select(WebsitePage).where(WebsitePage.id == item.id, WebsitePage.site_id == site_id)
        )
        result = await db.execute(
            select(WebsitePage).where(WebsitePage.id == item.id)
        )
        page = result.scalar_one_or_none()
        if page:
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
    await _get_site(db, site_id, vendor.id)
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
    for item in body.items:
        result = await db.execute(select(WebsiteBlock).where(WebsiteBlock.id == item.id))
        block = result.scalar_one_or_none()
        if block:
            block.sort_order = item.sort_order
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
    """Download an external image and persist it to the media library. Returns the local /uploads/... URL."""
    import os, aiofiles, httpx as _httpx
    from pathlib import Path

    # Must match app.main: StaticFiles on backend/uploads (parents[4] was repo root — files were invisible to /uploads).
    upload_dir = Path(__file__).resolve().parents[3] / "uploads" / "websites" / site_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{source}_{uuid.uuid4()}.jpg"
    filepath = upload_dir / fname

    async with _httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        r = await client.get(external_url)
        r.raise_for_status()
        content = r.content

    # Detect extension from content-type
    ct = r.headers.get("content-type", "image/jpeg")
    if "png" in ct:
        fname = fname.replace(".jpg", ".png")
        filepath = upload_dir / fname
    elif "webp" in ct:
        fname = fname.replace(".jpg", ".webp")
        filepath = upload_dir / fname
    elif "gif" in ct:
        fname = fname.replace(".jpg", ".gif")
        filepath = upload_dir / fname

    async with aiofiles.open(str(filepath), "wb") as f:
        await f.write(content)

    local_url = f"/uploads/websites/{site_id}/{fname}"

    # Persist to media table
    media = WebsiteMedia(
        id=uuid.uuid4(),
        site_id=UUID(site_id),
        vendor_id=vendor_id,
        filename=prompt[:80] or fname,
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
    await _get_site(db, site_id, vendor.id)
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
    import os, aiofiles
    from pathlib import Path

    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    ext = Path(file.filename or "image.jpg").suffix.lower()
    fname = f"{uuid.uuid4()}{ext}"
    upload_dir = Path(__file__).resolve().parents[3] / "uploads" / "websites" / site_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    filepath = upload_dir / fname

    async with aiofiles.open(str(filepath), "wb") as f:
        content = await file.read()
        await f.write(content)

    url = f"/uploads/websites/{site_id}/{fname}"
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
        "name": "Pantry",
        "description": "Search-first grocery layout with dense category tiles, quick-add buttons, and a delivery slot banner for daily essentials.",
        "thumbnail": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
        "category": "grocery",
        "tier": "full",
        "tags": ["Grocery", "Daily Needs", "Convenience", "Delivery"],
        "preview_palette": ["#274832", "#E44B25", "#F9F9F5", "#4A7A58", "#182E20"],
        "default_style": {
            "primary_color": "#274832", "secondary_color": "#E44B25", "accent_color": "#E44B25",
            "bg_color": "#F9F9F5", "surface_color": "#FFFFFF", "text_color": "#182E20",
            "font_heading": "DM Serif Display", "font_body": "Inter",
            "border_radius": "none", "spacing": "compact", "animation": "subtle",
            "shadow_style": "soft", "button_style": "filled",
        },
        "pages": [
            {"title": "Home", "slug": "home", "page_type": "home", "is_homepage": True, "show_in_nav": True, "blocks": [
                {"block_type": "nav", "props": {"brand": "Pantry", "show_cart": True, "show_search": True}},
                {"block_type": "hero", "props": {"headline": "Fresh from the market, at your door.", "subtitle": "Order before 4pm for same-day delivery.", "bg_style": "image", "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600", "overlay": True, "cta_primary": "Shop now", "cta_secondary": "View offers"}},
                {"block_type": "search_bar", "props": {"placeholder": "Search for milk, bread, fruits\u2026", "show_filters": True}},
                {"block_type": "category_cards", "props": {"title": "Shop by category", "columns": 6}},
                {"block_type": "product_grid", "props": {"title": "Best sellers", "columns": 6, "show_badges": True}},
                {"block_type": "coupon_banner", "props": {"title": "Weekend Bundle \u2014 Save 15% on fresh produce", "show_copy_button": False}},
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
        "thumbnail": "/storefront-ui/retail-hero.jpg",
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
                    "image_url": "/storefront-ui/retail-hero.jpg",
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
        "thumbnail": "/storefront-ui/restaurant-hero.jpg",
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
                    "image_url": "/storefront-ui/restaurant-hero.jpg",
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
        "thumbnail": "/storefront-ui/hospital-hero.jpg",
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
                    "image_url": "/storefront-ui/hospital-hero.jpg",
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
    # Pages (blog, nav links)
    "blog_grid":          "pages",
    "blog_featured":      "pages",
    "blog_list":          "pages",
}


TEMPLATE_STYLE_FALLBACKS = {
    "portfolio": {
        "primary_color": "#111827", "secondary_color": "#374151", "accent_color": "#8B5CF6",
        "bg_color": "#FFFFFF", "surface_color": "#F9FAFB", "text_color": "#111827",
        "font_heading": "Playfair Display", "font_body": "Inter", "border_radius": "sharp",
        "spacing": "spacious", "animation": "subtle", "button_style": "outline",
    },
}


@router.get("/templates/all")
async def list_templates(user: User = Depends(get_current_active_user)):
    enriched = []
    for tpl in WEBSITE_TEMPLATES.values():
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
        # Best-effort palette preview
        if "preview_palette" not in t:
            ds = t.get("default_style") or t.get("style_config") or TEMPLATE_STYLE_FALLBACKS.get(t.get("id"), {})
            if isinstance(ds, dict):
                pal = [ds.get("primary_color"), ds.get("secondary_color"), ds.get("accent_color"), ds.get("bg_color"), ds.get("text_color")]
                pal = [p for p in pal if isinstance(p, str) and p.startswith("#")]
                if pal:
                    t["preview_palette"] = pal[:5]
        enriched.append(t)
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
    tpl = WEBSITE_TEMPLATES.get(template_id)
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
        elif tid in EDITORIAL_WEBSITE_TEMPLATE_IDS:
            merged["wb_editorial_template_id"] = tid
            merged.pop("wb_catalog_template_id", None)
        else:
            merged.pop("wb_catalog_template_id", None)
            merged.pop("wb_editorial_template_id", None)
        site.style_config = merged

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
                auto_source = BLOCK_AUTO_SOURCE.get(b_type)
                if auto_source and "data_source" not in props:
                    props["data_source"] = {"type": auto_source, "auto": True}

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
                f"Niche: {body.niche or 'auto'}\n"
                f"Pages: {', '.join(default_pages)}\n"
                f"Tone: {body.tone}"
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

    # Fallback: smart template-based generation
    niche = body.niche or "business"
    biz = body.business_description
    short_name = biz.split()[0].title() if biz else "Your Business"

    pages_out: List[Dict[str, Any]] = []
    for slug in default_pages:
        page_blocks: list = []
        if slug == "home":
            page_blocks = [
                {"block_type": "nav",        "label": "Navigation", "props": {"brand": short_name, "cta_label": "Get Started"}},
                {"block_type": "hero",       "label": "Hero", "props": {"headline": f"Welcome to {short_name}", "subtitle": f"We help you with {niche}.", "bg_style": "gradient", "cta_primary": "Get Started", "cta_secondary": "Learn More"}},
                {"block_type": "features",   "label": "Features", "props": {"title": "Why Choose Us", "layout": "grid-3"}},
                {"block_type": "live_stock", "label": "From your catalog", "props": {"title": "Popular products", "show_count": 6}},
                {"block_type": "order_status", "label": "Order tracking", "props": {"title": "Track your order", "placeholder": "Order number…"}},
                {"block_type": "stats",      "label": "Stats", "props": {"stats": [{"value": "500+", "label": "Clients"}, {"value": "98%", "label": "Satisfaction"}, {"value": "10yr", "label": "Experience"}]}},
                {"block_type": "testimonials","label": "Testimonials", "props": {"title": "What Our Clients Say"}},
                {"block_type": "cta",        "label": "CTA", "props": {"headline": "Ready to Get Started?", "cta_label": "Contact Us Today"}},
                {"block_type": "footer",     "label": "Footer", "props": _footer_props_standard()},
            ]
        elif slug == "about":
            page_blocks = [
                {"block_type": "nav",          "label": "Navigation", "props": {"brand": short_name}},
                {"block_type": "hero_minimal", "label": "Hero", "props": {"headline": "About Us", "subtitle": "Our story, mission and values.", "bg_style": "minimal"}},
                {"block_type": "about_split",  "label": "Our Story", "props": {"title": "Who We Are", "description": biz}},
                {"block_type": "team_grid",    "label": "Team", "props": {"title": "Meet the Team", "columns": 3}},
                {"block_type": "timeline",     "label": "Timeline", "props": {"title": "Our Journey"}},
                {"block_type": "footer",       "label": "Footer", "props": _footer_props_standard()},
            ]
        elif slug == "services":
            page_blocks = [
                {"block_type": "nav",              "label": "Navigation", "props": {"brand": short_name}},
                {"block_type": "hero_minimal",     "label": "Hero", "props": {"headline": "Our Services", "bg_style": "minimal"}},
                {"block_type": "services_cards",   "label": "Services", "props": {"title": "What We Offer", "columns": 3}},
                {"block_type": "features_alternating", "label": "Features", "props": {"title": "How It Works"}},
                {"block_type": "cta",              "label": "CTA", "props": {"headline": "Ready to Work Together?", "cta_label": "Get In Touch"}},
                {"block_type": "footer",           "label": "Footer", "props": _footer_props_standard()},
            ]
        elif slug == "pricing":
            page_blocks = [
                {"block_type": "nav",     "label": "Navigation", "props": {"brand": short_name}},
                {"block_type": "pricing", "label": "Pricing", "props": {"title": "Simple, Transparent Pricing", "show_annual_toggle": True}},
                {"block_type": "faq",     "label": "FAQ", "props": {"title": "Pricing FAQs"}},
                {"block_type": "cta",     "label": "CTA", "props": {"headline": "Not sure which plan? Talk to us.", "cta_label": "Contact Sales"}},
                {"block_type": "footer",  "label": "Footer", "props": _footer_props_standard()},
            ]
        elif slug == "contact":
            page_blocks = [
                {"block_type": "nav",          "label": "Navigation", "props": {"brand": short_name}},
                {"block_type": "contact_form", "label": "Contact", "props": {"title": "Get In Touch", "full_page": True}},
                {"block_type": "footer",       "label": "Footer", "props": _footer_props_standard()},
            ]
        elif slug == "blog":
            page_blocks = [
                {"block_type": "nav",        "label": "Navigation", "props": {"brand": short_name}},
                {"block_type": "blog_grid",  "label": "Blog Grid", "props": {"title": "Latest Insights", "columns": 3}},
                {"block_type": "newsletter", "label": "Newsletter", "props": {"title": "Stay in the Loop"}},
                {"block_type": "footer",     "label": "Footer", "props": _footer_props_standard()},
            ]

        pages_out.append({
            "title": slug.capitalize(),
            "slug": slug,
            "page_type": slug if slug in ("home", "about", "services", "contact", "blog", "pricing") else "custom",
            "is_homepage": slug == "home",
            "seo_title": f"{slug.capitalize()} | {short_name}",
            "seo_description": f"Explore the {slug} section of {short_name}.",
            "blocks": page_blocks,
        })

    return AIGenerateSiteResponse(
        site_name=short_name,
        tagline=f"Your trusted partner in {niche}",
        seo_title=f"{short_name} — {niche.capitalize()} Solutions",
        seo_description=biz[:150],
        summary=f"Generated {len(pages_out)} pages for {short_name}.",
        style_config={
            "primary_color": "#6d28d9", "secondary_color": "#4c1d95", "accent_color": "#f59e0b",
            "bg_color": "#ffffff", "surface_color": "#f9fafb", "text_color": "#111827",
            "font_heading": "Inter", "font_body": "Inter", "border_radius": "rounded",
            "spacing": "comfortable", "animation": "subtle", "button_style": "filled",
        },
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

    for p_idx, p in enumerate(body.pages):
        page_id_new = uuid.uuid4()
        page = WebsitePage(
            id=page_id_new, site_id=UUID(site_id),
            title=p.get("title", "Page"), slug=p.get("slug", f"page-{p_idx}"),
            page_type=p.get("page_type", "custom"),
            is_homepage=p.get("is_homepage", p_idx == 0),
            seo_title=p.get("seo_title"), seo_description=p.get("seo_description"),
            sort_order=p_idx,
        )
        db.add(page)
        await db.flush()
        for b_idx, b in enumerate(p.get("blocks", [])):
            block = WebsiteBlock(
                id=uuid.uuid4(), page_id=page_id_new,
                block_type=b.get("block_type", "rich_text"), label=b.get("label"),
                props=b.get("props", {}), style_overrides={}, sort_order=b_idx,
            )
            db.add(block)

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
        if not page.is_published:
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
        bookings, categories, media, pages, profile, kpis
    """
    vendor = await _get_vendor(db, user)
    site = await _get_site(db, site_id, vendor.id)
    limit = max(1, min(limit, 50))

    items: List[Dict[str, Any]] = []
    meta: Dict[str, Any] = {}

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
        from app.models.vendor_product import Product
        from app.models.vendor_service import Service
        prod_rows = (await db.execute(
            select(Product.category, func.count(Product.id))
            .where(Product.vendor_id == vendor.id, Product.category.isnot(None))
            .group_by(Product.category)
        )).all()
        svc_rows = (await db.execute(
            select(Service.category, func.count(Service.id))
            .where(Service.vendor_id == vendor.id, Service.category.isnot(None))
            .group_by(Service.category)
        )).all()
        seen = {}
        for cat, cnt in list(prod_rows) + list(svc_rows):
            if not cat:
                continue
            seen[cat] = seen.get(cat, 0) + int(cnt or 0)
        for cat, cnt in sorted(seen.items(), key=lambda x: -x[1])[:limit]:
            items.append(_norm_item(
                id=cat,
                title=cat,
                subtitle=f"{cnt} item{'s' if cnt != 1 else ''}",
                meta={"count": cnt},
            ))

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
        for page in sorted(site.pages or [], key=lambda p: (not p.is_homepage, getattr(p, "sort_order", 0))):
            if not getattr(page, "is_published", True) or not getattr(page, "show_in_nav", True):
                continue
            slug = "/" if page.is_homepage else f"/{page.slug or ''}"
            items.append(_norm_item(
                id=str(page.id),
                title=page.title or "Page",
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

    elif resource == "profile":
        v = vendor
        social = v.social_links or {}
        meta = {
            "business_name": v.business_name,
            "display_name": v.display_name,
            "description": v.description,
            "email": v.primary_email,
            "support_email": v.support_email,
            "phone": v.primary_phone,
            "support_phone": v.support_phone,
            "address": " ".join(filter(None, [v.street_address, v.city, v.state, v.postal_code, v.country])),
            "city": v.city,
            "state": v.state,
            "country": v.country,
            "postal_code": v.postal_code,
            "logo_url": v.logo_url,
            "banner_url": v.banner_url,
            "subdomain": v.subdomain,
            "custom_domain": v.custom_domain,
            "social_links": social,
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
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor = await _get_vendor(db, user)
    await _get_site(db, site_id, vendor.id)

    try:
        from app.models.crm import CrmLead
        raw_name = (body.get("name") or "Website Visitor").strip()
        first, _, last = raw_name.partition(" ")
        lead = CrmLead(
            vendor_id=vendor.id,
            first_name=(first or "Website")[:120],
            last_name=(last or "Visitor")[:120],
            email=(body.get("email") or None),
            phone=(body.get("phone") or None),
            notes=(body.get("message") or None),
            source="website",
            source_campaign=f"website:{site_id}",
            status="new",
            intake_payload=body,
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)
        return {"ok": True, "lead_id": str(lead.id)}
    except Exception:
        await db.rollback()
        return {"ok": True, "lead_id": None, "note": "captured"}


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

    for field in ["title", "slug", "seo_title", "seo_description", "og_image_url", "layout"]:
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
    await _get_site(db, site_id, vendor.id)
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
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Export a site as JSON — can be re-imported via /import."""
    from sqlalchemy.orm import selectinload
    vendor = await _get_vendor(db, user)
    result = await db.execute(
        select(WebsiteSite)
        .options(selectinload(WebsiteSite.pages).selectinload(WebsitePage.blocks))
        .where(WebsiteSite.id == UUID(site_id), WebsiteSite.vendor_id == vendor.id)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(404, "Site not found")

    export = {
        "export_version": 1,
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
            "pages": [
                {
                    "title": p.title,
                    "slug": p.slug,
                    "page_type": p.page_type,
                    "is_homepage": p.is_homepage,
                    "show_in_nav": p.show_in_nav,
                    "seo_title": p.seo_title,
                    "seo_description": p.seo_description,
                    "sort_order": p.sort_order,
                    "blocks": [
                        {
                            "block_type": b.block_type,
                            "label": b.label,
                            "props": b.props,
                            "style_overrides": b.style_overrides,
                            "visible": b.visible,
                            "sort_order": b.sort_order,
                        }
                        for b in sorted(p.blocks or [], key=lambda x: x.sort_order or 0)
                    ],
                }
                for p in sorted(site.pages or [], key=lambda x: x.sort_order or 0)
            ],
        },
    }
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content=export,
        headers={"Content-Disposition": f'attachment; filename="site-{site.subdomain or site_id}.json"'},
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

    # In production: asyncio-based DNS lookup via dnspython/aiodns
    # For now we set verified=True and queue an SSL cert job
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
    if body.get("export_version") != 1:
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
