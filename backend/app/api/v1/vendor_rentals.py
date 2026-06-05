from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_vendor_id
from app.database import get_db
from app.models.user import User
from app.services.rental_service import RentalService

router = APIRouter()


@router.get("/assets")
async def list_rental_assets(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_assets(vendor_id)


@router.post("/assets", status_code=201)
async def create_rental_asset(
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).create_asset(vendor_id, body)


@router.get("/bookings")
async def list_rental_bookings(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_bookings(vendor_id)


@router.post("/bookings", status_code=201)
async def create_rental_booking(
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).create_booking(vendor_id, body)


@router.patch("/bookings/{booking_id}")
async def update_rental_booking(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).update_booking_status(vendor_id, booking_id, body.get("status", "pending"))
