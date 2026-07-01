"""
Vendor Pricing Plans — CRUD for storefront pricing tiers synced to website builder.
Routes: /vendors/me/pricing-plans
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models.pricing_plan import VendorPricingPlan
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter()


async def _invalidate_plans_live_cache(db: AsyncSession, vendor_id) -> None:
    from app.api.v1.public_sites import invalidate_vendor_live_caches

    await invalidate_vendor_live_caches(db, vendor_id)


async def _get_vendor_id(user: User, db: AsyncSession):
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor.id


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:180]


def _utc_naive() -> datetime:
    return datetime.utcnow()


def _parse_plan_id(plan_id: str) -> UUID:
    try:
        return UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid pricing plan id")


def _plan_to_dict(p: VendorPricingPlan) -> dict:
    return {
        "id": str(p.id),
        "vendor_id": str(p.vendor_id),
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        "price": float(p.price) if p.price is not None else None,
        "currency": p.currency,
        "period": p.period,
        "features": p.features or [],
        "is_featured": p.is_featured,
        "cta_label": p.cta_label,
        "cta_url": p.cta_url,
        "sort_order": p.sort_order,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


class PricingPlanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: str = "INR"
    period: str = "mo"
    features: List[str] = []
    is_featured: bool = False
    cta_label: str = "Get started"
    cta_url: str = "/contact"
    sort_order: int = 0
    is_active: bool = True


class PricingPlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    period: Optional[str] = None
    features: Optional[List[str]] = None
    is_featured: Optional[bool] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List pricing plans")
async def list_plans(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorPricingPlan).where(VendorPricingPlan.vendor_id == vendor_id)
    if search:
        q = q.where(VendorPricingPlan.name.ilike(f"%{search}%"))
    if is_active is not None:
        q = q.where(VendorPricingPlan.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorPricingPlan.sort_order.asc(), VendorPricingPlan.created_at.asc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_plan_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create pricing plan")
async def create_plan(
    body: PricingPlanCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    slug = body.slug or _slugify(body.name)

    existing = (
        await db.execute(
            select(VendorPricingPlan).where(
                VendorPricingPlan.vendor_id == vendor_id,
                VendorPricingPlan.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    plan = VendorPricingPlan(
        vendor_id=vendor_id,
        slug=slug,
        name=body.name,
        description=body.description,
        price=body.price,
        currency=body.currency,
        period=body.period,
        features=body.features or [],
        is_featured=body.is_featured,
        cta_label=body.cta_label,
        cta_url=body.cta_url,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    await _invalidate_plans_live_cache(db, vendor_id)
    return _plan_to_dict(plan)


@router.get("/{plan_id}", summary="Get pricing plan")
async def get_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_plan_id(plan_id)
    plan = (
        await db.execute(
            select(VendorPricingPlan).where(
                VendorPricingPlan.id == pid,
                VendorPricingPlan.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Pricing plan not found")
    return _plan_to_dict(plan)


@router.patch("/{plan_id}", summary="Update pricing plan")
async def update_plan(
    plan_id: str,
    body: PricingPlanUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_plan_id(plan_id)
    plan = (
        await db.execute(
            select(VendorPricingPlan).where(
                VendorPricingPlan.id == pid,
                VendorPricingPlan.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Pricing plan not found")

    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(plan, key, val)
    plan.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(plan)
    await _invalidate_plans_live_cache(db, vendor_id)
    return _plan_to_dict(plan)


@router.delete("/{plan_id}", status_code=204, summary="Delete pricing plan")
async def delete_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_plan_id(plan_id)
    result = await db.execute(
        delete(VendorPricingPlan).where(
            VendorPricingPlan.id == pid,
            VendorPricingPlan.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Pricing plan not found")
    await _invalidate_plans_live_cache(db, vendor_id)
