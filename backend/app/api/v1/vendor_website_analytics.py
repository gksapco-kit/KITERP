"""Website analytics for vendor admin — page_view journey events + product view_count.

Mounted at GET /vendors/me/websites/analytics (static path; include this router
*before* the catch-all `/{site_id}` website builder routes).
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_vendor_id, require_permission
from app.database import get_db
from app.services.website_analytics import build_website_analytics

router = APIRouter(dependencies=[Depends(require_permission("reports.view"))])


@router.get("/analytics")
async def website_analytics(
    business_unit_id: Optional[UUID] = Query(None, description="Business unit (store parent)"),
    branch_id: Optional[UUID] = Query(None, description="Branch store id"),
    days: int = Query(7, ge=1, le=90, description="Lookback window for page views"),
    minutes: Optional[int] = Query(
        None,
        ge=1,
        le=90 * 24 * 60,
        description="Lookback in minutes (overrides days when set; e.g. 30 or 60)",
    ),
    limit: int = Query(50, ge=1, le=200),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    report = await build_website_analytics(
        db,
        vendor_ids=[vendor_id],
        business_unit_id=business_unit_id,
        branch_id=branch_id,
        days=days,
        minutes=minutes,
        limit=limit,
        include_vendor_meta=False,
    )
    # Keep vendor API filter shape stable (no vendor_ids list required by UI).
    built_filters = report.get("filters") or {}
    report["filters"] = {
        "business_unit_id": str(business_unit_id) if business_unit_id else None,
        "branch_id": str(branch_id) if branch_id else None,
        "days": built_filters.get("days", days),
        "minutes": built_filters.get("minutes", minutes),
        "limit": limit,
    }
    return report
