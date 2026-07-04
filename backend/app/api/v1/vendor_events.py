"""
Vendor Events — CRUD for ticketed events synced to website builder Ticket Picker.
Routes: /vendors/me/events
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

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models.vendor_event import VendorEvent
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter()


class TicketTierIn(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=160)
    price: float = 0
    currency: str = "USD"
    perks: List[str] = Field(default_factory=list)
    remaining: int = 0
    popular: bool = False


async def _invalidate_events_live_cache(db: AsyncSession, vendor_id) -> None:
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


def _parse_event_id(event_id: str) -> UUID:
    try:
        return UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid event id")


def _normalize_tiers(tiers: List[TicketTierIn]) -> List[Dict[str, Any]]:
    out = []
    for t in tiers:
        out.append({
            "id": t.id or str(uuid.uuid4())[:8],
            "name": t.name,
            "price": t.price,
            "currency": t.currency,
            "perks": [p for p in t.perks if p],
            "remaining": t.remaining,
            "popular": t.popular,
        })
    return out


def _event_to_dict(e: VendorEvent) -> dict:
    return {
        "id": str(e.id),
        "vendor_id": str(e.vendor_id),
        "slug": e.slug,
        "title": e.title,
        "tagline": e.tagline,
        "image_url": e.image_url,
        "event_date": e.event_date,
        "doors_time": e.doors_time,
        "start_time": e.start_time,
        "end_time": e.end_time,
        "venue": e.venue,
        "address": e.address,
        "venue_capacity": e.venue_capacity,
        "age_note": e.age_note,
        "order_title": e.order_title,
        "seating_title": e.seating_title,
        "show_seating": e.show_seating,
        "max_per_order": e.max_per_order,
        "cta_label": e.cta_label,
        "tiers": e.tiers or [],
        "sort_order": e.sort_order,
        "is_active": e.is_active,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    tagline: Optional[str] = None
    image_url: Optional[str] = None
    event_date: Optional[str] = None
    doors_time: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    venue_capacity: Optional[int] = None
    age_note: Optional[str] = None
    order_title: str = "Your order"
    seating_title: str = "Seating chart"
    show_seating: bool = True
    max_per_order: int = 8
    cta_label: str = "Continue to checkout"
    tiers: List[TicketTierIn] = Field(default_factory=list)
    slug: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    tagline: Optional[str] = None
    image_url: Optional[str] = None
    event_date: Optional[str] = None
    doors_time: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    venue_capacity: Optional[int] = None
    age_note: Optional[str] = None
    order_title: Optional[str] = None
    seating_title: Optional[str] = None
    show_seating: Optional[bool] = None
    max_per_order: Optional[int] = None
    cta_label: Optional[str] = None
    tiers: Optional[List[TicketTierIn]] = None
    slug: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List events")
async def list_events(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorEvent).where(VendorEvent.vendor_id == vendor_id)
    if search:
        like = f"%{search}%"
        q = q.where((VendorEvent.title.ilike(like)) | (VendorEvent.venue.ilike(like)))
    if is_active is not None:
        q = q.where(VendorEvent.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorEvent.sort_order.asc(), VendorEvent.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_event_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create event")
async def create_event(
    body: EventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    base_slug = body.slug or _slugify(body.title)
    slug = base_slug

    existing = (
        await db.execute(
            select(VendorEvent).where(
                VendorEvent.vendor_id == vendor_id,
                VendorEvent.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    event = VendorEvent(
        vendor_id=vendor_id,
        slug=slug,
        title=body.title,
        tagline=body.tagline,
        image_url=body.image_url,
        event_date=body.event_date,
        doors_time=body.doors_time,
        start_time=body.start_time,
        end_time=body.end_time,
        venue=body.venue,
        address=body.address,
        venue_capacity=body.venue_capacity,
        age_note=body.age_note,
        order_title=body.order_title,
        seating_title=body.seating_title,
        show_seating=body.show_seating,
        max_per_order=body.max_per_order,
        cta_label=body.cta_label,
        tiers=_normalize_tiers(body.tiers),
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    await _invalidate_events_live_cache(db, vendor_id)
    return _event_to_dict(event)


@router.get("/{event_id}", summary="Get event")
async def get_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    eid = _parse_event_id(event_id)
    event = (
        await db.execute(
            select(VendorEvent).where(
                VendorEvent.id == eid,
                VendorEvent.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_to_dict(event)


@router.patch("/{event_id}", summary="Update event")
async def update_event(
    event_id: str,
    body: EventUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    eid = _parse_event_id(event_id)
    event = (
        await db.execute(
            select(VendorEvent).where(
                VendorEvent.id == eid,
                VendorEvent.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    data = body.model_dump(exclude_unset=True)
    if "tiers" in data and data["tiers"] is not None:
        data["tiers"] = _normalize_tiers(body.tiers)
    for key, val in data.items():
        setattr(event, key, val)
    event.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(event)
    await _invalidate_events_live_cache(db, vendor_id)
    return _event_to_dict(event)


@router.delete("/{event_id}", status_code=204, summary="Delete event")
async def delete_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    eid = _parse_event_id(event_id)
    result = await db.execute(
        delete(VendorEvent).where(
            VendorEvent.id == eid,
            VendorEvent.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    await _invalidate_events_live_cache(db, vendor_id)
