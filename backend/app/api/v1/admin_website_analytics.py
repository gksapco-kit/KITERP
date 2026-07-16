"""Platform admin website analytics — all businesses or one vendor (+ BU/branch)."""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_platform_staff
from app.database import get_db
from app.models.store import Store
from app.models.user import User
from app.models.vendor import Vendor
from app.services.website_analytics import build_website_analytics
from app.utils.platform_vendor_access import (
    ensure_vendor_visible_to_platform_staff,
    relationship_manager_list_scope,
)

router = APIRouter()


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
    business_units = [_store_brief(s) for s in rows if (s.unit_type or "business_unit") != "branch" and not s.parent_id]
    # Also treat parent_id NULL as BU even if unit_type missing
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
    business_unit_id: Optional[UUID] = Query(None, description="BU filter (requires vendor_id)"),
    branch_id: Optional[UUID] = Query(None, description="Branch filter (requires vendor_id)"),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
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
        limit=limit,
        include_vendor_meta=True,
    )
    report["filters"]["vendor_id"] = str(vendor_id) if vendor_id else None
    return report
