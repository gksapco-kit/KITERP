from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_customer, get_store_vendor_id
from app.database import get_db
from app.models.customer import Customer
from app.services.rental_service import RentalService

router = APIRouter()


@router.get("/assets")
async def list_store_rental_assets(
    quantity: float | None = Query(None),
    weight: float | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    category: str | None = Query(None),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Public rental catalog with optional smart capacity filtering."""
    svc = RentalService(db)
    if quantity or weight or start_date or end_date or category:
        return await svc.search_available_assets(
            vendor_id,
            quantity=float(quantity or 1),
            weight=weight,
            start_date=start_date,
            end_date=end_date,
            category=category,
        )
    assets = await svc.list_assets(vendor_id)
    return svc.list_storefront_assets(assets)


@router.get("/assets/{asset_id}")
async def get_store_rental_asset(
    asset_id: UUID,
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await RentalService(db).get_asset(vendor_id, asset_id)


@router.post("/bookings", status_code=status.HTTP_201_CREATED)
async def create_store_rental_booking(
    body: dict,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Customer books a rental asset from the storefront."""
    payload = {
        **body,
        "customer_id": str(customer.id),
        "customer_name": body.get("customer_name") or customer.full_name,
        "customer_email": body.get("customer_email") or customer.email,
        "customer_phone": body.get("customer_phone") or customer.phone,
    }
    return await RentalService(db).create_booking(vendor_id, payload)


@router.get("/my-bookings")
async def list_my_rental_bookings(
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await RentalService(db).list_bookings(vendor_id, customer_id=customer.id)


@router.get("/my-bookings/{booking_id}")
async def get_my_rental_booking(
    booking_id: UUID,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    booking = await RentalService(db).get_booking(vendor_id, booking_id)
    if booking.get("customer_id") != str(customer.id):
        from fastapi import HTTPException
        raise HTTPException(404, "Rental booking not found")
    return booking


@router.post("/my-bookings/{booking_id}/pay")
async def pay_my_rental_booking(
    booking_id: UUID,
    body: dict,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await RentalService(db).customer_pay(vendor_id, booking_id, customer.id, body)


@router.post("/my-bookings/{booking_id}/cancel")
async def cancel_my_rental_booking(
    booking_id: UUID,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    booking = await RentalService(db).get_booking(vendor_id, booking_id)
    if booking.get("customer_id") != str(customer.id):
        from fastapi import HTTPException
        raise HTTPException(404, "Rental booking not found")
    if booking["status"] not in ("pending", "approved"):
        from fastapi import HTTPException
        raise HTTPException(400, "Only pending or approved bookings can be cancelled")
    return await RentalService(db).update_booking_status(vendor_id, booking_id, "cancelled")
