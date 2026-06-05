from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_customer, get_store_vendor_id
from app.database import get_db
from app.models.customer import Customer
from app.schemas.customer_subscription import (
    SubscriptionCreate, SubscriptionResponse, SubscriptionStatusUpdate,
)
from app.services.customer_subscription_service import CustomerSubscriptionService

router = APIRouter()


@router.get("", response_model=list[SubscriptionResponse])
async def list_my_subscriptions(
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await CustomerSubscriptionService(db).list_for_customer(vendor_id, customer.id)


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    data: SubscriptionCreate,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await CustomerSubscriptionService(db).create(vendor_id, customer, data)


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_my_subscription(
    subscription_id: UUID,
    body: SubscriptionStatusUpdate,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await CustomerSubscriptionService(db).update_status(
        vendor_id, subscription_id, body.status, customer_id=customer.id,
    )
