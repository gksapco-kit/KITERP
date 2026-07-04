"""
Vendor Booking Resources — CRUD for bookable rooms/tables/courts/equipment synced to
website builder Resource Picker section.
Routes: /vendors/me/booking-resources
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models.vendor_booking_resource import VendorBookingResource
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter()


async def _invalidate_booking_resources_live_cache(db: AsyncSession, vendor_id) -> None:
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


def _parse_resource_id(resource_id: str) -> UUID:
    try:
        return UUID(resource_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid resource id")


def _resource_to_dict(r: VendorBookingResource) -> dict:
    return {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id),
        "name": r.name,
        "resource_type": r.resource_type,
        "capacity": r.capacity,
        "description": r.description,
        "features": r.features or [],
        "price_per_hour": r.price_per_hour,
        "currency": r.currency,
        "is_available": r.is_available,
        "sort_order": r.sort_order,
        "is_active": r.is_active,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


class BookingResourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    resource_type: str = "room"
    capacity: int = 1
    description: Optional[str] = None
    features: List[str] = Field(default_factory=list)
    price_per_hour: float = 0
    currency: str = "USD"
    is_available: bool = True
    sort_order: int = 0
    is_active: bool = True


class BookingResourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    resource_type: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None
    features: Optional[List[str]] = None
    price_per_hour: Optional[float] = None
    currency: Optional[str] = None
    is_available: Optional[bool] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List booking resources")
async def list_booking_resources(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorBookingResource).where(VendorBookingResource.vendor_id == vendor_id)
    if search:
        like = f"%{search}%"
        q = q.where(VendorBookingResource.name.ilike(like))
    if is_active is not None:
        q = q.where(VendorBookingResource.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorBookingResource.sort_order.asc(), VendorBookingResource.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_resource_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create booking resource")
async def create_booking_resource(
    body: BookingResourceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    resource = VendorBookingResource(
        vendor_id=vendor_id,
        name=body.name,
        resource_type=body.resource_type,
        capacity=body.capacity,
        description=body.description,
        features=body.features,
        price_per_hour=body.price_per_hour,
        currency=body.currency,
        is_available=body.is_available,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    await _invalidate_booking_resources_live_cache(db, vendor_id)
    return _resource_to_dict(resource)


@router.get("/{resource_id}", summary="Get booking resource")
async def get_booking_resource(
    resource_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    rid = _parse_resource_id(resource_id)
    resource = (
        await db.execute(
            select(VendorBookingResource).where(
                VendorBookingResource.id == rid,
                VendorBookingResource.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Booking resource not found")
    return _resource_to_dict(resource)


@router.patch("/{resource_id}", summary="Update booking resource")
async def update_booking_resource(
    resource_id: str,
    body: BookingResourceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    rid = _parse_resource_id(resource_id)
    resource = (
        await db.execute(
            select(VendorBookingResource).where(
                VendorBookingResource.id == rid,
                VendorBookingResource.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Booking resource not found")

    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(resource, key, val)
    resource.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(resource)
    await _invalidate_booking_resources_live_cache(db, vendor_id)
    return _resource_to_dict(resource)


@router.delete("/{resource_id}", status_code=204, summary="Delete booking resource")
async def delete_booking_resource(
    resource_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    rid = _parse_resource_id(resource_id)
    result = await db.execute(
        delete(VendorBookingResource).where(
            VendorBookingResource.id == rid,
            VendorBookingResource.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Booking resource not found")
    await _invalidate_booking_resources_live_cache(db, vendor_id)
