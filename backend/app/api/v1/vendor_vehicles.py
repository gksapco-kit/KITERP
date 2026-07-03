"""
Vendor Vehicles — CRUD for auto inventory synced to website builder.
Routes: /vendors/me/vehicles
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
from app.models.vendor_vehicle import VendorVehicle
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter()


async def _invalidate_vehicles_live_cache(db: AsyncSession, vendor_id) -> None:
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


def _parse_vehicle_id(vehicle_id: str) -> UUID:
    try:
        return UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid vehicle id")


def _vehicle_to_dict(v: VendorVehicle) -> dict:
    return {
        "id": str(v.id),
        "vendor_id": str(v.vendor_id),
        "slug": v.slug,
        "year": v.year,
        "make": v.make,
        "model": v.model,
        "trim": v.trim,
        "condition": v.condition,
        "price": float(v.price) if v.price is not None else 0,
        "currency": v.currency,
        "mileage": v.mileage,
        "fuel": v.fuel,
        "transmission": v.transmission,
        "body_style": v.body_style,
        "exterior_color": v.exterior_color,
        "image_url": v.image_url,
        "stock_number": v.stock_number,
        "location_note": v.location_note,
        "cta_label": v.cta_label,
        "highlights": v.highlights or [],
        "sort_order": v.sort_order,
        "is_active": v.is_active,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
    }


class VehicleCreate(BaseModel):
    year: int = 2024
    make: str = Field(..., min_length=1, max_length=120)
    model: str = Field(..., min_length=1, max_length=120)
    trim: Optional[str] = None
    condition: str = "Used"
    price: float = 0
    currency: str = "USD"
    mileage: int = 0
    fuel: str = "Gas"
    transmission: str = "Auto"
    body_style: Optional[str] = None
    exterior_color: Optional[str] = None
    image_url: Optional[str] = None
    stock_number: Optional[str] = None
    location_note: Optional[str] = None
    cta_label: str = "Schedule test drive"
    highlights: List[str] = Field(default_factory=list)
    slug: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class VehicleUpdate(BaseModel):
    year: Optional[int] = None
    make: Optional[str] = Field(None, min_length=1, max_length=120)
    model: Optional[str] = Field(None, min_length=1, max_length=120)
    trim: Optional[str] = None
    condition: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    mileage: Optional[int] = None
    fuel: Optional[str] = None
    transmission: Optional[str] = None
    body_style: Optional[str] = None
    exterior_color: Optional[str] = None
    image_url: Optional[str] = None
    stock_number: Optional[str] = None
    location_note: Optional[str] = None
    cta_label: Optional[str] = None
    highlights: Optional[List[str]] = None
    slug: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List vehicles")
async def list_vehicles(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorVehicle).where(VendorVehicle.vendor_id == vendor_id)
    if search:
        like = f"%{search}%"
        q = q.where((VendorVehicle.make.ilike(like)) | (VendorVehicle.model.ilike(like)))
    if is_active is not None:
        q = q.where(VendorVehicle.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorVehicle.sort_order.asc(), VendorVehicle.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_vehicle_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create vehicle")
async def create_vehicle(
    body: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    base_slug = body.slug or _slugify(f"{body.year}-{body.make}-{body.model}")
    slug = base_slug

    existing = (
        await db.execute(
            select(VendorVehicle).where(
                VendorVehicle.vendor_id == vendor_id,
                VendorVehicle.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    vehicle = VendorVehicle(
        vendor_id=vendor_id,
        slug=slug,
        year=body.year,
        make=body.make,
        model=body.model,
        trim=body.trim,
        condition=body.condition,
        price=body.price,
        currency=body.currency,
        mileage=body.mileage,
        fuel=body.fuel,
        transmission=body.transmission,
        body_style=body.body_style,
        exterior_color=body.exterior_color,
        image_url=body.image_url,
        stock_number=body.stock_number,
        location_note=body.location_note,
        cta_label=body.cta_label,
        highlights=body.highlights,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    await _invalidate_vehicles_live_cache(db, vendor_id)
    return _vehicle_to_dict(vehicle)


@router.get("/{vehicle_id}", summary="Get vehicle")
async def get_vehicle(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    vid = _parse_vehicle_id(vehicle_id)
    vehicle = (
        await db.execute(
            select(VendorVehicle).where(
                VendorVehicle.id == vid,
                VendorVehicle.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return _vehicle_to_dict(vehicle)


@router.patch("/{vehicle_id}", summary="Update vehicle")
async def update_vehicle(
    vehicle_id: str,
    body: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    vid = _parse_vehicle_id(vehicle_id)
    vehicle = (
        await db.execute(
            select(VendorVehicle).where(
                VendorVehicle.id == vid,
                VendorVehicle.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(vehicle, key, val)
    vehicle.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(vehicle)
    await _invalidate_vehicles_live_cache(db, vendor_id)
    return _vehicle_to_dict(vehicle)


@router.delete("/{vehicle_id}", status_code=204, summary="Delete vehicle")
async def delete_vehicle(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    vid = _parse_vehicle_id(vehicle_id)
    result = await db.execute(
        delete(VendorVehicle).where(
            VendorVehicle.id == vid,
            VendorVehicle.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    await _invalidate_vehicles_live_cache(db, vendor_id)
