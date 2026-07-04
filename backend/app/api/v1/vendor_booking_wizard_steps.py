"""
Vendor Booking Wizard Steps — CRUD for the steps shown in the Booking Wizard
website builder section (Sales Management → Booking Wizard).
Routes: /vendors/me/booking-wizard-steps
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models.vendor_booking_wizard_step import VendorBookingWizardStep
from app.models.user import User
from app.services.vendor_service import VendorService

router = APIRouter()


async def _invalidate_wizard_steps_live_cache(db: AsyncSession, vendor_id) -> None:
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
        raise HTTPException(status_code=422, detail="Invalid step id")


def _to_dict(s: VendorBookingWizardStep) -> dict:
    return {
        "id": str(s.id),
        "vendor_id": str(s.vendor_id),
        "label": s.label,
        "description": s.description,
        "sort_order": s.sort_order,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


class BookingWizardStepCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=160)
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class BookingWizardStepUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=160)
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("", summary="List booking wizard steps")
async def list_booking_wizard_steps(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorBookingWizardStep).where(VendorBookingWizardStep.vendor_id == vendor_id)
    if search:
        like = f"%{search}%"
        q = q.where(VendorBookingWizardStep.label.ilike(like))
    if is_active is not None:
        q = q.where(VendorBookingWizardStep.is_active == is_active)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = (
        q.order_by(VendorBookingWizardStep.sort_order.asc(), VendorBookingWizardStep.created_at.asc())
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


@router.post("", status_code=201, summary="Create booking wizard step")
async def create_booking_wizard_step(
    body: BookingWizardStepCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    step = VendorBookingWizardStep(
        vendor_id=vendor_id,
        label=body.label,
        description=body.description,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    await _invalidate_wizard_steps_live_cache(db, vendor_id)
    return _to_dict(step)


@router.get("/{step_id}", summary="Get booking wizard step")
async def get_booking_wizard_step(
    step_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    sid = _parse_id(step_id)
    step = (
        await db.execute(
            select(VendorBookingWizardStep).where(
                VendorBookingWizardStep.id == sid,
                VendorBookingWizardStep.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    return _to_dict(step)


@router.patch("/{step_id}", summary="Update booking wizard step")
async def update_booking_wizard_step(
    step_id: str,
    body: BookingWizardStepUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    sid = _parse_id(step_id)
    step = (
        await db.execute(
            select(VendorBookingWizardStep).where(
                VendorBookingWizardStep.id == sid,
                VendorBookingWizardStep.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(step, key, val)
    step.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(step)
    await _invalidate_wizard_steps_live_cache(db, vendor_id)
    return _to_dict(step)


@router.delete("/{step_id}", status_code=204, summary="Delete booking wizard step")
async def delete_booking_wizard_step(
    step_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    sid = _parse_id(step_id)
    result = await db.execute(
        delete(VendorBookingWizardStep).where(
            VendorBookingWizardStep.id == sid,
            VendorBookingWizardStep.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Step not found")
    await _invalidate_wizard_steps_live_cache(db, vendor_id)
