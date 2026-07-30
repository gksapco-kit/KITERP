"""
Vendor Testimonials — CRUD for curated customer quotes synced to website builder
Testimonials sections.
Routes: /vendors/me/testimonials
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, require_permission
from app.database import get_db
from app.models.vendor_testimonial import VendorTestimonial
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter(dependencies=[Depends(require_permission("reviews.view"))])


async def _invalidate_testimonials_live_cache(db: AsyncSession, vendor_id) -> None:
    from app.api.v1.public_sites import invalidate_vendor_live_caches

    await invalidate_vendor_live_caches(db, vendor_id)


async def _get_vendor_id(user: User, db: AsyncSession):
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor.id


def _utc_naive() -> datetime:
    return datetime.utcnow()


def _parse_id(item_id: str) -> UUID:
    try:
        return UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid testimonial id")


def _to_dict(t: VendorTestimonial) -> dict:
    return {
        "id": str(t.id),
        "vendor_id": str(t.vendor_id),
        "name": t.name,
        "role": t.role,
        "company": t.company,
        "quote": t.quote,
        "avatar_url": t.avatar_url,
        "rating": t.rating,
        "sort_order": t.sort_order,
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


class TestimonialCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    role: Optional[str] = None
    company: Optional[str] = None
    quote: str = Field(..., min_length=1)
    avatar_url: Optional[str] = None
    rating: int = Field(5, ge=1, le=5)
    sort_order: int = 0
    is_active: bool = True


class TestimonialUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    role: Optional[str] = None
    company: Optional[str] = None
    quote: Optional[str] = Field(None, min_length=1)
    avatar_url: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List testimonials")
async def list_testimonials(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorTestimonial).where(VendorTestimonial.vendor_id == vendor_id)
    if search:
        like = f"%{search}%"
        q = q.where(VendorTestimonial.name.ilike(like))
    if is_active is not None:
        q = q.where(VendorTestimonial.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorTestimonial.sort_order.asc(), VendorTestimonial.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create testimonial")
async def create_testimonial(
    body: TestimonialCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    testimonial = VendorTestimonial(
        vendor_id=vendor_id,
        name=body.name,
        role=body.role,
        company=body.company,
        quote=body.quote,
        avatar_url=body.avatar_url,
        rating=body.rating,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(testimonial)
    await db.commit()
    await db.refresh(testimonial)
    await _invalidate_testimonials_live_cache(db, vendor_id)
    return _to_dict(testimonial)


@router.get("/{testimonial_id}", summary="Get testimonial")
async def get_testimonial(
    testimonial_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    tid = _parse_id(testimonial_id)
    testimonial = (
        await db.execute(
            select(VendorTestimonial).where(
                VendorTestimonial.id == tid,
                VendorTestimonial.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not testimonial:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return _to_dict(testimonial)


@router.patch("/{testimonial_id}", summary="Update testimonial")
async def update_testimonial(
    testimonial_id: str,
    body: TestimonialUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    tid = _parse_id(testimonial_id)
    testimonial = (
        await db.execute(
            select(VendorTestimonial).where(
                VendorTestimonial.id == tid,
                VendorTestimonial.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not testimonial:
        raise HTTPException(status_code=404, detail="Testimonial not found")

    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(testimonial, key, val)
    testimonial.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(testimonial)
    await _invalidate_testimonials_live_cache(db, vendor_id)
    return _to_dict(testimonial)


@router.delete("/{testimonial_id}", status_code=204, summary="Delete testimonial")
async def delete_testimonial(
    testimonial_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    tid = _parse_id(testimonial_id)
    result = await db.execute(
        delete(VendorTestimonial).where(
            VendorTestimonial.id == tid,
            VendorTestimonial.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    await _invalidate_testimonials_live_cache(db, vendor_id)
