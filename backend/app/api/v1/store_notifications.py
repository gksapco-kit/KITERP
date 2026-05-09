# app/api/v1/store_notifications.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.api.deps import get_store_vendor_id, get_current_active_customer
from app.models.customer import Customer
from app.services.notification_service import NotificationService

router = APIRouter()


def _serialize(n) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "is_read": n.is_read,
        "reference_id": str(n.reference_id) if n.reference_id else None,
        "reference_type": n.reference_type,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("")
async def list_customer_notifications(
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = NotificationService(db)
    items = await svc.get_customer_notifications(
        vendor_id, customer.id, limit=limit, unread_only=unread_only
    )
    return {"items": [_serialize(n) for n in items]}


@router.get("/stats")
async def customer_notification_stats(
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = NotificationService(db)
    return await svc.get_customer_notification_stats(vendor_id, customer.id)


@router.patch("/read-all")
async def mark_all_read(
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = NotificationService(db)
    count = await svc.mark_all_customer_notifications_read(vendor_id, customer.id)
    await db.commit()
    return {"status": "ok", "marked_read": count}


@router.patch("/{notification_id}/read")
async def mark_one_read(
    notification_id: str,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = NotificationService(db)
    notif = await svc.mark_customer_notification_read(
        UUID(notification_id), vendor_id, customer.id
    )
    if not notif:
        raise HTTPException(404, "Notification not found")
    await db.commit()
    return {"status": "ok"}
