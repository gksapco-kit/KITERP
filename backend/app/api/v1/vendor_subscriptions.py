from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_vendor_id
from app.database import get_db
from app.models.user import User
from app.schemas.customer_subscription import SubscriptionResponse, SubscriptionStatusUpdate
from app.services.customer_subscription_service import CustomerSubscriptionService

router = APIRouter()


@router.get("", response_model=list[SubscriptionResponse])
async def list_customer_subscriptions(
    status: str | None = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await CustomerSubscriptionService(db).list_for_vendor(vendor_id, status)


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription_status(
    subscription_id: UUID,
    body: SubscriptionStatusUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await CustomerSubscriptionService(db).update_status(
        vendor_id, subscription_id, body.status,
    )
