"""Platform admin website analytics — all businesses, one vendor, or kiterp.com."""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_platform_staff
from app.database import get_db
from app.models.platform_website_analytics import (
    PLATFORM_SITE_KEY,
    PLATFORM_VENDOR_ID,
    PlatformWebsitePageView,
)
from app.models.store import Store
from app.models.user import User
from app.models.vendor import Vendor
from app.services.website_analytics import (
    build_platform_website_analytics,
    build_website_analytics,
    merge_platform_into_vendor_report,
    parse_path_and_branch,
)
from app.utils.platform_vendor_access import (
    ensure_vendor_visible_to_platform_staff,
    relationship_manager_list_scope,
)

router = APIRouter()
public_router = APIRouter()


async def _load_visible_vendor(
    db: AsyncSession, current_user: User, vendor_id: UUID
) -> Vendor:
    vendor = (
        await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    ).scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    await ensure_vendor_visible_to_platform_staff(current_user, vendor)
    return vendor


def _store_brief(s: Store) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "code": s.code,
        "unit_type": s.unit_type or "business_unit",
        "parent_id": str(s.parent_id) if s.parent_id else None,
        "is_default": bool(s.is_default),
        "is_active": bool(s.is_active),
    }


@router.get("/vendors/{vendor_id}/stores")
async def admin_list_vendor_stores(
    vendor_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Business units + branches for analytics filters on a business account."""
    await _load_visible_vendor(db, current_user, vendor_id)
    rows = (
        await db.execute(
            select(Store)
            .where(Store.vendor_id == vendor_id, Store.is_active.is_(True))
            .order_by(Store.unit_type.asc(), Store.is_default.desc(), Store.name.asc())
        )
    ).scalars().all()
    business_units = [
        _store_brief(s)
        for s in rows
        if (s.unit_type or "business_unit") != "branch" and not s.parent_id
    ]
    if not business_units:
        business_units = [_store_brief(s) for s in rows if not s.parent_id]
    branches = [_store_brief(s) for s in rows if s.parent_id]
    return {
        "vendor_id": str(vendor_id),
        "business_units": business_units,
        "branches": branches,
    }


@router.get("/website-analytics")
async def admin_website_analytics(
    vendor_id: Optional[UUID] = Query(None, description="Limit to one business account"),
    site: Optional[str] = Query(
        None,
        description="Use 'platform' for kiterp.com marketing site analytics",
    ),
    business_unit_id: Optional[UUID] = Query(None, description="BU filter (requires vendor_id)"),
    branch_id: Optional[UUID] = Query(None, description="Branch filter (requires vendor_id)"),
    days: int = Query(7, ge=1, le=90),
    minutes: Optional[int] = Query(
        None,
        ge=1,
        le=90 * 24 * 60,
        description="Lookback in minutes (overrides days when set; e.g. 30 or 60)",
    ),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    site_norm = (site or "").strip().lower()
    if site_norm in (PLATFORM_SITE_KEY, "kiterp", PLATFORM_VENDOR_ID):
        return await build_platform_website_analytics(
            db, days=days, minutes=minutes, limit=limit
        )

    if vendor_id:
        await _load_visible_vendor(db, current_user, vendor_id)
        vendor_ids: List[UUID] = [vendor_id]
    else:
        rm_scope = relationship_manager_list_scope(current_user)
        q = select(Vendor.id)
        if rm_scope is not None:
            q = q.where(Vendor.relationship_manager_user_id == rm_scope)
        vendor_ids = [row[0] for row in (await db.execute(q)).all()]

    report = await build_website_analytics(
        db,
        vendor_ids=vendor_ids,
        business_unit_id=business_unit_id if vendor_id else None,
        branch_id=branch_id if vendor_id else None,
        days=days,
        minutes=minutes,
        limit=limit,
        include_vendor_meta=True,
    )
    report["filters"]["vendor_id"] = str(vendor_id) if vendor_id else None

    # All businesses: also include KITERP.com marketing traffic.
    if not vendor_id:
        platform = await build_platform_website_analytics(
            db, days=days, minutes=minutes, limit=limit
        )
        report = merge_platform_into_vendor_report(report, platform, limit=limit)
        report["filters"]["vendor_id"] = None

    return report


@public_router.post("/journey/beacon")
async def public_platform_journey_beacon(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Beacon for kiterp.com / platform marketing pages (no vendor_id)."""
    event_type = str(payload.get("event_type") or "page_view")[:60]
    raw_path = ""
    body_payload = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
    if isinstance(body_payload, dict):
        raw_path = str(body_payload.get("path") or "")
    if not raw_path:
        raw_path = str(payload.get("path") or "/")
    path, _ = parse_path_and_branch(raw_path)
    if not path:
        path = "/"
    path = path[:500]

    obj = PlatformWebsitePageView(
        event_type=event_type or "page_view",
        path=path,
        visitor_id=(str(payload.get("visitor_id") or "")[:120] or None),
        payload=body_payload or {},
    )
    db.add(obj)
    await db.commit()
    return {"ok": True}
