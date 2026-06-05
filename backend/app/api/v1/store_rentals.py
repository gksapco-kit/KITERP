from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_customer, get_store_vendor_id
from app.database import get_db
from app.models.customer import Customer
from app.services.rental_service import RentalService

router = APIRouter()


@router.get("/assets")
async def list_store_rental_assets(
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Public rental catalog for the storefront."""
    assets = await RentalService(db).list_assets(vendor_id)
    return [a for a in assets if a.get("status") in (None, "available")]


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
