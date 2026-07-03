"""
Vendor Fitness Classes — CRUD for class schedule entries synced to website builder.
Routes: /vendors/me/fitness-classes
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models.vendor_fitness_class import VendorFitnessClass
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter()


async def _invalidate_fitness_classes_live_cache(db: AsyncSession, vendor_id) -> None:
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


def _parse_class_id(class_id: str) -> UUID:
    try:
        return UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid class id")


def _class_to_dict(c: VendorFitnessClass) -> dict:
    return {
        "id": str(c.id),
        "vendor_id": str(c.vendor_id),
        "name": c.name,
        "slug": c.slug,
        "instructor": c.instructor,
        "type": c.class_type,
        "duration": c.duration,
        "intensity": c.intensity,
        "date": c.date,
        "time": c.time,
        "capacity": c.capacity,
        "booked": c.booked,
        "studio": c.studio,
        "price": float(c.price) if c.price is not None else None,
        "currency": c.currency,
        "cta_label": c.cta_label,
        "sort_order": c.sort_order,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


class FitnessClassCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = None
    instructor: Optional[str] = None
    type: str = "Yoga"
    duration: int = 60
    intensity: int = 3
    date: Optional[str] = None
    time: Optional[str] = None
    capacity: int = 20
    booked: int = 0
    studio: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    cta_label: str = "Reserve"
    sort_order: int = 0
    is_active: bool = True


class FitnessClassUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = None
    instructor: Optional[str] = None
    type: Optional[str] = None
    duration: Optional[int] = None
    intensity: Optional[int] = None
    date: Optional[str] = None
    time: Optional[str] = None
    capacity: Optional[int] = None
    booked: Optional[int] = None
    studio: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    cta_label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List fitness classes")
async def list_fitness_classes(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorFitnessClass).where(VendorFitnessClass.vendor_id == vendor_id)
    if search:
        q = q.where(VendorFitnessClass.name.ilike(f"%{search}%"))
    if is_active is not None:
        q = q.where(VendorFitnessClass.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorFitnessClass.sort_order.asc(), VendorFitnessClass.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_class_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create fitness class")
async def create_fitness_class(
    body: FitnessClassCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    slug = body.slug or _slugify(body.name)

    existing = (
        await db.execute(
            select(VendorFitnessClass).where(
                VendorFitnessClass.vendor_id == vendor_id,
                VendorFitnessClass.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    cls = VendorFitnessClass(
        vendor_id=vendor_id,
        slug=slug,
        name=body.name,
        instructor=body.instructor,
        class_type=body.type,
        duration=body.duration,
        intensity=body.intensity,
        date=body.date,
        time=body.time,
        capacity=body.capacity,
        booked=body.booked,
        studio=body.studio,
        price=body.price,
        currency=body.currency,
        cta_label=body.cta_label,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    await _invalidate_fitness_classes_live_cache(db, vendor_id)
    return _class_to_dict(cls)


@router.get("/{class_id}", summary="Get fitness class")
async def get_fitness_class(
    class_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    cid = _parse_class_id(class_id)
    cls = (
        await db.execute(
            select(VendorFitnessClass).where(
                VendorFitnessClass.id == cid,
                VendorFitnessClass.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return _class_to_dict(cls)


@router.patch("/{class_id}", summary="Update fitness class")
async def update_fitness_class(
    class_id: str,
    body: FitnessClassUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    cid = _parse_class_id(class_id)
    cls = (
        await db.execute(
            select(VendorFitnessClass).where(
                VendorFitnessClass.id == cid,
                VendorFitnessClass.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    data = body.model_dump(exclude_unset=True)
    if "type" in data:
        cls.class_type = data.pop("type")
    for key, val in data.items():
        setattr(cls, key, val)
    cls.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(cls)
    await _invalidate_fitness_classes_live_cache(db, vendor_id)
    return _class_to_dict(cls)


@router.delete("/{class_id}", status_code=204, summary="Delete fitness class")
async def delete_fitness_class(
    class_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    cid = _parse_class_id(class_id)
    result = await db.execute(
        delete(VendorFitnessClass).where(
            VendorFitnessClass.id == cid,
            VendorFitnessClass.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    await _invalidate_fitness_classes_live_cache(db, vendor_id)
