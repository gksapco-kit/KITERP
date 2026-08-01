from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.database import get_db
from app.models.user import User
from app.services.rental_service import RentalService

router = APIRouter(dependencies=[Depends(require_permission("rentals.view"))])


@router.get("/dashboard")
async def rental_dashboard(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).get_dashboard(vendor_id)


@router.get("/assets")
async def list_rental_assets(
    status: str | None = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_assets(vendor_id, status=status)


@router.get("/assets/{asset_id}")
async def get_rental_asset(
    asset_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).get_asset(vendor_id, asset_id)


@router.post("/assets", status_code=201)
async def create_rental_asset(
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).create_asset(vendor_id, body)


@router.patch("/assets/{asset_id}")
async def update_rental_asset(
    asset_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).update_asset(vendor_id, asset_id, body)


@router.get("/assets/{asset_id}/calendar")
async def asset_availability_calendar(
    asset_id: UUID,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).get_availability_calendar(vendor_id, asset_id, from_date, to_date)


@router.get("/bookings")
async def list_rental_bookings(
    status: str | None = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_bookings(vendor_id, status=status)


@router.get("/bookings/{booking_id}")
async def get_rental_booking(
    booking_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).get_booking(vendor_id, booking_id)


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
    svc = RentalService(db)
    if body.get("status"):
        return await svc.update_booking_status(vendor_id, booking_id, body["status"])
    if body.get("new_end_date"):
        new_end = body["new_end_date"]
        if isinstance(new_end, str):
            new_end = date.fromisoformat(new_end)
        return await svc.extend_booking(vendor_id, booking_id, new_end)
    return await svc.get_booking(vendor_id, booking_id)


@router.post("/bookings/{booking_id}/payment")
async def record_rental_payment(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).record_payment(vendor_id, booking_id, body)


@router.patch("/bookings/{booking_id}/delivery")
async def update_rental_delivery(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).update_delivery(vendor_id, booking_id, body)
