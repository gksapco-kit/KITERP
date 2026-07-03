"""
Vendor Courses — CRUD for course catalog/detail entries synced to website builder.
Routes: /vendors/me/courses
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models.vendor_course import VendorCourse
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter()


async def _invalidate_courses_live_cache(db: AsyncSession, vendor_id) -> None:
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


def _parse_course_id(course_id: str) -> UUID:
    try:
        return UUID(course_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid course id")


def _course_to_dict(c: VendorCourse) -> dict:
    return {
        "id": str(c.id),
        "vendor_id": str(c.vendor_id),
        "title": c.title,
        "slug": c.slug,
        "instructor": c.instructor,
        "level": c.level,
        "category": c.category,
        "description": c.description,
        "duration": c.duration,
        "lessons": c.lessons,
        "rating": float(c.rating) if c.rating is not None else 0,
        "reviews": c.reviews,
        "price": float(c.price) if c.price is not None else None,
        "currency": c.currency,
        "image_url": c.image_url,
        "syllabus": c.syllabus or [],
        "outcomes": c.outcomes or [],
        "perks": c.perks or [],
        "enrolled_label": c.enrolled_label,
        "cta_label": c.cta_label,
        "preview_cta_label": c.preview_cta_label,
        "sort_order": c.sort_order,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


class SyllabusWeek(BaseModel):
    week: int
    title: str
    lessons: int = 0
    duration: str = ""


class PerkItem(BaseModel):
    icon: Optional[str] = "clock"
    text: str


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = None
    instructor: Optional[str] = None
    level: str = "Beginner"
    category: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[str] = None
    lessons: int = 0
    rating: float = 0
    reviews: int = 0
    price: Optional[float] = None
    currency: str = "USD"
    image_url: Optional[str] = None
    syllabus: List[SyllabusWeek] = []
    outcomes: List[str] = []
    perks: List[PerkItem] = []
    enrolled_label: Optional[str] = None
    cta_label: str = "Enroll for"
    preview_cta_label: str = "Try free preview"
    sort_order: int = 0
    is_active: bool = True


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = None
    instructor: Optional[str] = None
    level: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[str] = None
    lessons: Optional[int] = None
    rating: Optional[float] = None
    reviews: Optional[int] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    image_url: Optional[str] = None
    syllabus: Optional[List[SyllabusWeek]] = None
    outcomes: Optional[List[str]] = None
    perks: Optional[List[PerkItem]] = None
    enrolled_label: Optional[str] = None
    cta_label: Optional[str] = None
    preview_cta_label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


def _dump_list(items: Any) -> list:
    if items is None:
        return []
    return [item.model_dump() if hasattr(item, "model_dump") else item for item in items]


@router.get("", summary="List courses")
async def list_courses(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorCourse).where(VendorCourse.vendor_id == vendor_id)
    if search:
        q = q.where(VendorCourse.title.ilike(f"%{search}%"))
    if is_active is not None:
        q = q.where(VendorCourse.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorCourse.sort_order.asc(), VendorCourse.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_course_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create course")
async def create_course(
    body: CourseCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    slug = body.slug or _slugify(body.title)

    existing = (
        await db.execute(
            select(VendorCourse).where(
                VendorCourse.vendor_id == vendor_id,
                VendorCourse.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    course = VendorCourse(
        vendor_id=vendor_id,
        slug=slug,
        title=body.title,
        instructor=body.instructor,
        level=body.level,
        category=body.category,
        description=body.description,
        duration=body.duration,
        lessons=body.lessons,
        rating=body.rating,
        reviews=body.reviews,
        price=body.price,
        currency=body.currency,
        image_url=body.image_url,
        syllabus=_dump_list(body.syllabus),
        outcomes=body.outcomes or [],
        perks=_dump_list(body.perks),
        enrolled_label=body.enrolled_label,
        cta_label=body.cta_label,
        preview_cta_label=body.preview_cta_label,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    await _invalidate_courses_live_cache(db, vendor_id)
    return _course_to_dict(course)


@router.get("/{course_id}", summary="Get course")
async def get_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    cid = _parse_course_id(course_id)
    course = (
        await db.execute(
            select(VendorCourse).where(
                VendorCourse.id == cid,
                VendorCourse.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_to_dict(course)


@router.patch("/{course_id}", summary="Update course")
async def update_course(
    course_id: str,
    body: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    cid = _parse_course_id(course_id)
    course = (
        await db.execute(
            select(VendorCourse).where(
                VendorCourse.id == cid,
                VendorCourse.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    data = body.model_dump(exclude_unset=True)
    if "syllabus" in data and data["syllabus"] is not None:
        data["syllabus"] = _dump_list(body.syllabus)
    if "perks" in data and data["perks"] is not None:
        data["perks"] = _dump_list(body.perks)
    for key, val in data.items():
        setattr(course, key, val)
    course.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(course)
    await _invalidate_courses_live_cache(db, vendor_id)
    return _course_to_dict(course)


@router.delete("/{course_id}", status_code=204, summary="Delete course")
async def delete_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    cid = _parse_course_id(course_id)
    result = await db.execute(
        delete(VendorCourse).where(
            VendorCourse.id == cid,
            VendorCourse.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    await _invalidate_courses_live_cache(db, vendor_id)
