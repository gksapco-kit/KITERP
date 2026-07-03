"""
Vendor Properties — CRUD for real-estate listings synced to website builder.
Routes: /vendors/me/properties
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
from app.models.vendor_property import VendorProperty
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter()


async def _invalidate_properties_live_cache(db: AsyncSession, vendor_id) -> None:
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


def _parse_property_id(property_id: str) -> UUID:
    try:
        return UUID(property_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid property id")


def _property_to_dict(p: VendorProperty) -> dict:
    return {
        "id": str(p.id),
        "vendor_id": str(p.vendor_id),
        "title": p.title,
        "slug": p.slug,
        "address": p.address,
        "description": p.description,
        "price": float(p.price) if p.price is not None else None,
        "currency": p.currency,
        "beds": p.beds,
        "baths": p.baths,
        "sqft": p.sqft,
        "type": p.property_type,
        "status": p.status,
        "image_url": p.image_url,
        "gallery": p.gallery or [],
        "agent_name": p.agent_name,
        "agent_phone": p.agent_phone,
        "agent_email": p.agent_email,
        "cta_label": p.cta_label,
        "sort_order": p.sort_order,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


class PropertyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    beds: int = 0
    baths: int = 0
    sqft: int = 0
    type: str = "house"
    status: str = "for-sale"
    image_url: Optional[str] = None
    gallery: List[str] = []
    agent_name: Optional[str] = None
    agent_phone: Optional[str] = None
    agent_email: Optional[str] = None
    cta_label: str = "Schedule tour"
    sort_order: int = 0
    is_active: bool = True


class PropertyUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    beds: Optional[int] = None
    baths: Optional[int] = None
    sqft: Optional[int] = None
    type: Optional[str] = None
    status: Optional[str] = None
    image_url: Optional[str] = None
    gallery: Optional[List[str]] = None
    agent_name: Optional[str] = None
    agent_phone: Optional[str] = None
    agent_email: Optional[str] = None
    cta_label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List properties")
async def list_properties(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorProperty).where(VendorProperty.vendor_id == vendor_id)
    if search:
        q = q.where(VendorProperty.title.ilike(f"%{search}%"))
    if is_active is not None:
        q = q.where(VendorProperty.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorProperty.sort_order.asc(), VendorProperty.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_property_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create property")
async def create_property(
    body: PropertyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    slug = body.slug or _slugify(body.title)

    existing = (
        await db.execute(
            select(VendorProperty).where(
                VendorProperty.vendor_id == vendor_id,
                VendorProperty.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    prop = VendorProperty(
        vendor_id=vendor_id,
        slug=slug,
        title=body.title,
        address=body.address,
        description=body.description,
        price=body.price,
        currency=body.currency,
        beds=body.beds,
        baths=body.baths,
        sqft=body.sqft,
        property_type=body.type,
        status=body.status,
        image_url=body.image_url,
        gallery=body.gallery or [],
        agent_name=body.agent_name,
        agent_phone=body.agent_phone,
        agent_email=body.agent_email,
        cta_label=body.cta_label,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(prop)
    await db.commit()
    await db.refresh(prop)
    await _invalidate_properties_live_cache(db, vendor_id)
    return _property_to_dict(prop)


@router.get("/{property_id}", summary="Get property")
async def get_property(
    property_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_property_id(property_id)
    prop = (
        await db.execute(
            select(VendorProperty).where(
                VendorProperty.id == pid,
                VendorProperty.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return _property_to_dict(prop)


@router.patch("/{property_id}", summary="Update property")
async def update_property(
    property_id: str,
    body: PropertyUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_property_id(property_id)
    prop = (
        await db.execute(
            select(VendorProperty).where(
                VendorProperty.id == pid,
                VendorProperty.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    data = body.model_dump(exclude_unset=True)
    if "type" in data:
        prop.property_type = data.pop("type")
    for key, val in data.items():
        setattr(prop, key, val)
    prop.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(prop)
    await _invalidate_properties_live_cache(db, vendor_id)
    return _property_to_dict(prop)


@router.delete("/{property_id}", status_code=204, summary="Delete property")
async def delete_property(
    property_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_property_id(property_id)
    result = await db.execute(
        delete(VendorProperty).where(
            VendorProperty.id == pid,
            VendorProperty.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    await _invalidate_properties_live_cache(db, vendor_id)
