"""
Vendor Recurring Plans — CRUD for recurring booking series synced to website builder
Recurring Booking section.
Routes: /vendors/me/recurring-plans
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, require_permission
from app.database import get_db
from app.models.vendor_recurring_plan import VendorRecurringPlan
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter(dependencies=[Depends(require_permission("subscriptions.view"))])


class RecurringPresetIn(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    discount_pct: float = 0


async def _invalidate_recurring_plans_live_cache(db: AsyncSession, vendor_id) -> None:
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
        raise HTTPException(status_code=422, detail="Invalid plan id")


def _normalize_presets(presets: List[RecurringPresetIn]) -> List[Dict[str, Any]]:
    out = []
    for p in presets:
        out.append({
            "id": p.id or str(uuid.uuid4())[:8],
            "name": p.name,
            "description": p.description,
            "discount_pct": p.discount_pct,
        })
    return out


def _plan_to_dict(p: VendorRecurringPlan) -> dict:
    return {
        "id": str(p.id),
        "vendor_id": str(p.vendor_id),
        "slug": p.slug,
        "title": p.title,
        "image_url": p.image_url,
        "start_date": p.start_date,
        "start_time": p.start_time,
        "duration_minutes": p.duration_minutes,
        "price_per_session": p.price_per_session,
        "currency": p.currency,
        "default_session_count": p.default_session_count,
        "min_sessions": p.min_sessions,
        "max_sessions": p.max_sessions,
        "show_upcoming": p.show_upcoming,
        "cta_label": p.cta_label,
        "presets": p.presets or [],
        "sort_order": p.sort_order,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


class RecurringPlanCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    image_url: Optional[str] = None
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    price_per_session: float = 0
    currency: str = "USD"
    default_session_count: int = 8
    min_sessions: int = 2
    max_sessions: int = 24
    show_upcoming: bool = True
    cta_label: str = "Confirm series"
    presets: List[RecurringPresetIn] = Field(default_factory=list)
    slug: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class RecurringPlanUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    image_url: Optional[str] = None
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    price_per_session: Optional[float] = None
    currency: Optional[str] = None
    default_session_count: Optional[int] = None
    min_sessions: Optional[int] = None
    max_sessions: Optional[int] = None
    show_upcoming: Optional[bool] = None
    cta_label: Optional[str] = None
    presets: Optional[List[RecurringPresetIn]] = None
    slug: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List recurring plans")
async def list_recurring_plans(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorRecurringPlan).where(VendorRecurringPlan.vendor_id == vendor_id)
    if search:
        like = f"%{search}%"
        q = q.where(VendorRecurringPlan.title.ilike(like))
    if is_active is not None:
        q = q.where(VendorRecurringPlan.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorRecurringPlan.sort_order.asc(), VendorRecurringPlan.created_at.desc())
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


@router.post("", status_code=201, summary="Create recurring plan")
async def create_recurring_plan(
    body: RecurringPlanCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    base_slug = body.slug or _slugify(body.title)
    slug = base_slug

    existing = (
        await db.execute(
            select(VendorRecurringPlan).where(
                VendorRecurringPlan.vendor_id == vendor_id,
                VendorRecurringPlan.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    plan = VendorRecurringPlan(
        vendor_id=vendor_id,
        slug=slug,
        title=body.title,
        image_url=body.image_url,
        start_date=body.start_date,
        start_time=body.start_time,
        duration_minutes=body.duration_minutes,
        price_per_session=body.price_per_session,
        currency=body.currency,
        default_session_count=body.default_session_count,
        min_sessions=body.min_sessions,
        max_sessions=body.max_sessions,
        show_upcoming=body.show_upcoming,
        cta_label=body.cta_label,
        presets=_normalize_presets(body.presets),
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    await _invalidate_recurring_plans_live_cache(db, vendor_id)
    return _plan_to_dict(plan)


@router.get("/{plan_id}", summary="Get recurring plan")
async def get_recurring_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_plan_id(plan_id)
    plan = (
        await db.execute(
            select(VendorRecurringPlan).where(
                VendorRecurringPlan.id == pid,
                VendorRecurringPlan.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Recurring plan not found")
    return _plan_to_dict(plan)


@router.patch("/{plan_id}", summary="Update recurring plan")
async def update_recurring_plan(
    plan_id: str,
    body: RecurringPlanUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_plan_id(plan_id)
    plan = (
        await db.execute(
            select(VendorRecurringPlan).where(
                VendorRecurringPlan.id == pid,
                VendorRecurringPlan.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Recurring plan not found")

    data = body.model_dump(exclude_unset=True)
    if "presets" in data and data["presets"] is not None:
        data["presets"] = _normalize_presets(body.presets)
    for key, val in data.items():
        setattr(plan, key, val)
    plan.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(plan)
    await _invalidate_recurring_plans_live_cache(db, vendor_id)
    return _plan_to_dict(plan)


@router.delete("/{plan_id}", status_code=204, summary="Delete recurring plan")
async def delete_recurring_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_plan_id(plan_id)
    result = await db.execute(
        delete(VendorRecurringPlan).where(
            VendorRecurringPlan.id == pid,
            VendorRecurringPlan.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Recurring plan not found")
    await _invalidate_recurring_plans_live_cache(db, vendor_id)
