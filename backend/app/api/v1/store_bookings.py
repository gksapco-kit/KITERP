from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date
import math

from app.database import get_db
from app.api.deps import get_store_vendor_id, get_current_active_customer
from app.models.customer import Customer
from app.models.order import Order
from app.repositories.order_repo import OrderRepository
from app.services.booking_service import BookingService
from app.models.booking import Booking

router = APIRouter()


class BookingCreate(BaseModel):
    service_id: str
    plan_id: Optional[str] = None
    booking_date: date
    start_time: Optional[str] = None
    notes: Optional[str] = None
    payment_method: str = Field(default="cod")
    order_id: Optional[str] = None


class BookingCancelRequest(BaseModel):
    reason: Optional[str] = None


def _booking_to_dict(b: Booking) -> dict:
    return {
        "id": str(b.id),
        "vendor_id": str(b.vendor_id),
        "customer_id": str(b.customer_id) if b.customer_id else None,
        "service_id": str(b.service_id) if b.service_id else None,
        "service_plan_id": str(b.service_plan_id) if b.service_plan_id else None,
        "plan_name": b.plan_name,
        "booking_number": b.booking_number,
        "service_name": b.service_name,
        "service_price": float(b.service_price) if b.service_price else 0,
        "booking_date": b.booking_date.isoformat() if b.booking_date else None,
        "start_time": b.start_time.isoformat() if b.start_time else None,
        "end_time": b.end_time.isoformat() if b.end_time else None,
        "duration_minutes": b.duration_minutes,
        "status": b.status,
        "customer_name": b.customer_name,
        "customer_email": b.customer_email,
        "customer_phone": b.customer_phone,
        "notes": b.notes,
        "cancel_reason": b.cancel_reason,
        "subtotal": float(b.subtotal) if b.subtotal else 0,
        "tax_amount": float(b.tax_amount) if b.tax_amount else 0,
        "discount_amount": float(b.discount_amount) if b.discount_amount else 0,
        "total": float(b.total) if b.total else 0,
        "payment_status": b.payment_status,
        "payment_method": b.payment_method,
        "order_id": str(b.order_id) if getattr(b, "order_id", None) else None,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@router.post("", status_code=201)
async def create_booking(
    data: BookingCreate,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BookingService(db)
    booking = await svc.create(
        vendor_id=vendor_id,
        customer_id=customer.id,
        data={
            "service_id": data.service_id,
            "plan_id": data.plan_id,
            "booking_date": data.booking_date,
            "start_time": data.start_time,
            "notes": data.notes,
            "payment_method": data.payment_method,
            "customer_name": customer.full_name,
            "customer_email": customer.email,
            "customer_phone": customer.phone,
        },
    )

    # Link to an existing checkout order when provided; otherwise create one
    if data.order_id:
        try:
            linked_id = UUID(data.order_id)
            order_repo = OrderRepository(db)
            order = await order_repo.get_by_vendor_and_id(vendor_id, linked_id)
            if order and order.customer_id == customer.id:
                booking.order_id = order.id
                booking.payment_method = order.payment_method or booking.payment_method
                booking.payment_status = order.payment_status or booking.payment_status
                # Annotate order line with booking refs when possible
                items = list(order.items or [])
                for line in items:
                    if (
                        isinstance(line, dict)
                        and str(line.get("service_id") or "") == str(booking.service_id or "")
                        and not line.get("booking_id")
                    ):
                        line["booking_id"] = str(booking.id)
                        line["booking_number"] = booking.booking_number
                if items:
                    order.items = items
                    order.source = order.source or "booking"
                await db.commit()
                await db.refresh(booking)
            else:
                await db.commit()
        except Exception:
            await db.commit()
    else:
        try:
            order_repo = OrderRepository(db)
            order_number = await order_repo.get_next_order_number(vendor_id)
            slot_label = booking.booking_date.strftime("%d %b %Y")
            if booking.start_time:
                slot_label += f" {booking.start_time.strftime('%H:%M')}"
            from app.services.store_resolver import resolve_store_id as _resolve_txn_store_id
            bk_store_id = await _resolve_txn_store_id(db, vendor_id)
            order = Order(
                order_number=order_number,
                vendor_id=vendor_id,
                customer_id=customer.id,
                store_id=bk_store_id,
                items=[{
                    "service_id": str(booking.service_id) if booking.service_id else None,
                    "name": booking.service_name or "Service",
                    "qty": 1,
                    "price": float(booking.total or 0),
                    "item_type": "service",
                    "booking_id": str(booking.id),
                    "booking_number": booking.booking_number,
                    "booking_date": slot_label,
                }],
                item_count=1,
                subtotal=booking.subtotal or 0,
                tax_amount=booking.tax_amount or 0,
                discount_amount=booking.discount_amount or 0,
                shipping_amount=0,
                total=booking.total or 0,
                status="pending",
                payment_status=booking.payment_status or "pending",
                payment_method=booking.payment_method,
                source="booking",
                notes=data.notes,
            )
            db.add(order)
            await db.flush()
            booking.order_id = order.id
            await db.commit()
            await db.refresh(booking)
        except Exception:
            # If order creation fails, still return the booking
            await db.commit()

    return JSONResponse(content=_booking_to_dict(booking), status_code=201)


@router.get("/slots")
async def get_booking_slots(
    service_id: str,
    booking_date: date,
    plan_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Return bookable time slots for a service (optionally a specific plan) on a given date."""
    try:
        svc_uuid = UUID(service_id)
    except ValueError:
        raise HTTPException(400, "Invalid service_id")
    plan_uuid: Optional[UUID] = None
    if plan_id:
        try:
            plan_uuid = UUID(plan_id)
        except ValueError:
            raise HTTPException(400, "Invalid plan_id")
    svc = BookingService(db)
    slots = await svc.get_available_slots(vendor_id, svc_uuid, booking_date, plan_id=plan_uuid)
    return JSONResponse(content={"slots": slots, "date": booking_date.isoformat()})


@router.get("")
async def list_my_bookings(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BookingService(db)
    skip = (page - 1) * size
    items, total = await svc.list_by_customer(
        vendor_id, customer.id, skip, size, status_filter=status,
    )
    return JSONResponse(content={
        "items": [_booking_to_dict(b) for b in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/{booking_id}")
async def get_booking(
    booking_id: str,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BookingService(db)
    booking = await svc.get(vendor_id, customer.id, UUID(booking_id))
    return JSONResponse(content=_booking_to_dict(booking))


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    data: BookingCancelRequest,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BookingService(db)
    booking = await svc.cancel(vendor_id, customer.id, UUID(booking_id), data.reason)
    return JSONResponse(content=_booking_to_dict(booking))
