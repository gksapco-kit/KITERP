# app/api/v1/vendor_bookings.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
import math
import uuid as uuid_mod

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.booking import Booking
from app.models.order import Order
from app.services.vendor_service import VendorService
from app.services.booking_service import BookingService
from app.services.order_media import save_order_media_file

router = APIRouter()


async def _vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


def _booking_dict(b: Booking) -> dict:
    return {
        "id": str(b.id),
        "vendor_id": str(b.vendor_id),
        "store_id": str(b.store_id) if getattr(b, "store_id", None) else None,
        "customer_id": str(b.customer_id) if b.customer_id else None,
        "service_id": str(b.service_id) if b.service_id else None,
        "booking_number": b.booking_number,
        "service_name": b.service_name,
        "service_price": float(b.service_price) if b.service_price else 0,
        "booking_date": b.booking_date.isoformat() if b.booking_date else None,
        "start_time": b.start_time.isoformat() if b.start_time else None,
        "end_time": b.end_time.isoformat() if b.end_time else None,
        "duration_minutes": b.duration_minutes,
        "status": b.status,
        "customer_name": b.customer_name,
        "customer_phone": b.customer_phone,
        "customer_email": b.customer_email,
        "subtotal": float(b.subtotal) if b.subtotal else 0,
        "tax_amount": float(b.tax_amount) if b.tax_amount else 0,
        "total": float(b.total) if b.total else 0,
        "notes": b.notes,
        "cancel_reason": b.cancel_reason,
        "payment_status": b.payment_status,
        "payment_method": b.payment_method,
        "invoice_id": str(b.invoice_id) if getattr(b, "invoice_id", None) else None,
        "order_id": str(b.order_id) if getattr(b, "order_id", None) else None,
        # Staff
        "assigned_staff_id": str(b.assigned_staff_id) if getattr(b, "assigned_staff_id", None) else None,
        "assigned_staff_name": getattr(b, "assigned_staff_name", None),
        "completed_by_id": str(b.completed_by_id) if getattr(b, "completed_by_id", None) else None,
        "completed_by_name": getattr(b, "completed_by_name", None),
        "delivery_notes": getattr(b, "delivery_notes", None),
        "internal_notes": getattr(b, "internal_notes", None),
        # History and media
        "status_history": getattr(b, "status_history", None) or [],
        "followups": getattr(b, "followups", None) or [],
        "attachments": getattr(b, "attachments", None) or [],
        # Timestamps
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "confirmed_at": b.confirmed_at.isoformat() if getattr(b, "confirmed_at", None) else None,
        "completed_at": b.completed_at.isoformat() if getattr(b, "completed_at", None) else None,
    }


async def _sync_order_status(booking: Booking, new_status: str, db: AsyncSession):
    """Keep the linked Order in sync with the booking status."""
    order_id = getattr(booking, "order_id", None)
    if not order_id:
        return
    order = await db.get(Order, order_id)
    if not order:
        return

    status_map = {
        "confirmed": "confirmed",
        "in_progress": "processing",
        "completed": "delivered",
        "cancelled": "cancelled",
        "no_show": "cancelled",
    }
    mapped = status_map.get(new_status)
    if mapped and order.status != mapped:
        order.status = mapped
        if mapped == "delivered":
            order.delivered_at = datetime.now(timezone.utc)
            order.payment_status = "paid"
        elif mapped == "cancelled":
            pass


@router.get("")
async def list_bookings(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    store_id: Optional[str] = None,
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    query = select(Booking).where(Booking.vendor_id == vendor_id)
    count_q = select(func.count()).select_from(Booking).where(Booking.vendor_id == vendor_id)

    if status:
        query = query.where(Booking.status == status)
        count_q = count_q.where(Booking.status == status)

    if store_id:
        store_uuid = UUID(store_id)
        query = query.where(Booking.store_id == store_uuid)
        count_q = count_q.where(Booking.store_id == store_uuid)

    total = (await db.execute(count_q)).scalar_one()
    skip = (page - 1) * size
    items = (
        await db.execute(query.order_by(Booking.created_at.desc()).offset(skip).limit(size))
    ).scalars().all()

    return {
        "items": [_booking_dict(b) for b in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    }


@router.post("", status_code=201)
async def create_booking(
    data: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a booking from the vendor panel."""
    if not data.get("service_id"):
        raise HTTPException(400, "service_id is required")
    if not data.get("booking_date"):
        raise HTTPException(400, "booking_date is required")
    if not data.get("customer_id"):
        raise HTTPException(400, "customer_id is required")

    svc = BookingService(db)
    booking = await svc.create(
        vendor_id=vendor_id,
        customer_id=UUID(data["customer_id"]),
        data=data,
    )

    # Record creation in status history
    history_entry = {
        "status": "pending",
        "changed_by": str(current_user.id),
        "changed_by_name": current_user.full_name or current_user.email,
        "changed_at": datetime.now(timezone.utc).isoformat(),
        "note": "Booking created by vendor",
    }
    booking.status_history = [history_entry]
    await db.commit()
    await db.refresh(booking)

    return JSONResponse(content=_booking_dict(booking), status_code=201)


@router.get("/{booking_id}")
async def get_booking(
    booking_id: str,
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    booking = await db.get(Booking, UUID(booking_id))
    if not booking or booking.vendor_id != vendor_id:
        raise HTTPException(404, "Booking not found")
    return _booking_dict(booking)


@router.put("/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    data: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Update booking status with history tracking and order sync."""
    booking = await db.get(Booking, UUID(booking_id))
    if not booking or booking.vendor_id != vendor_id:
        raise HTTPException(404, "Booking not found")

    new_status = data.get("status")
    valid = {"confirmed", "in_progress", "completed", "cancelled", "no_show"}
    if new_status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(valid)}")

    old_status = booking.status

    # Append to status history
    history_entry = {
        "from_status": old_status,
        "to_status": new_status,
        "changed_by": str(current_user.id),
        "changed_by_name": current_user.full_name or current_user.email,
        "changed_at": datetime.now(timezone.utc).isoformat(),
        "note": data.get("note") or data.get("cancel_reason") or "",
    }
    existing_history = list(booking.status_history or [])
    existing_history.append(history_entry)
    booking.status_history = existing_history

    booking.status = new_status

    if new_status == "confirmed":
        booking.confirmed_at = datetime.now(timezone.utc)

    elif new_status == "in_progress":
        pass

    elif new_status == "completed":
        otp_code = data.get("completion_otp") or data.get("otp")
        if booking.completion_otp:
            if booking.completion_otp_expires_at and booking.completion_otp_expires_at < datetime.now(timezone.utc):
                raise HTTPException(400, "Completion OTP has expired — send a new code")
            from app.services.phone_otp_service import PhoneOtpService, is_twilio_verify_stored

            otp_ok = False
            if is_twilio_verify_stored(booking.completion_otp) and booking.customer_phone:
                check = await PhoneOtpService().verify_otp(booking.customer_phone, str(otp_code or ""))
                otp_ok = check.approved
            elif otp_code and str(otp_code).strip() == str(booking.completion_otp):
                otp_ok = True
            if not otp_ok:
                raise HTTPException(400, "Invalid or missing completion OTP")
        booking.completed_at = datetime.now(timezone.utc)
        booking.completion_otp = None
        booking.completion_otp_expires_at = None
        booking.payment_status = "paid"
        if data.get("delivery_notes"):
            booking.delivery_notes = data["delivery_notes"]
        if data.get("completed_by_name"):
            booking.completed_by_name = data["completed_by_name"]
            booking.completed_by_id = current_user.id
        else:
            booking.completed_by_name = current_user.full_name or current_user.email
            booking.completed_by_id = current_user.id
        # Auto-create invoice
        try:
            from app.services.invoice_service import InvoiceService
            inv_svc = InvoiceService(db)
            invoice = await inv_svc.create_from_booking(booking, auto_commit=False)
            if invoice:
                booking.invoice_id = invoice.id
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to create invoice: %s", e)

    elif new_status in ("cancelled", "no_show"):
        booking.cancel_reason = data.get("cancel_reason")

    # Sync linked order
    await _sync_order_status(booking, new_status, db)

    await db.commit()
    await db.refresh(booking)
    return _booking_dict(booking)


@router.post("/{booking_id}/generate-otp")
@router.post("/{booking_id}/send-completion-otp")
async def send_completion_otp(
    booking_id: str,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Send OTP to customer for job completion verification."""
    from datetime import timedelta
    from app.config import settings
    from app.services.phone_otp_service import PhoneOtpService, TWILIO_VERIFY_MARKER, generate_otp_code
    from app.services.sms_service import normalize_e164

    booking = await db.get(Booking, UUID(booking_id))
    if not booking or booking.vendor_id != vendor_id:
        raise HTTPException(404, "Booking not found")
    if not booking.customer_phone:
        raise HTTPException(400, "Customer phone number is required to send completion OTP")

    phone = normalize_e164(booking.customer_phone)
    booking.completion_otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    otp_svc = PhoneOtpService()
    dispatch = await otp_svc.send_and_store_code(phone, channel="sms", purpose="booking completion")
    otp = dispatch.stored_code or generate_otp_code()

    if dispatch.result.sent:
        booking.completion_otp = TWILIO_VERIFY_MARKER if dispatch.verify_marker else dispatch.stored_code
    elif settings.DEBUG:
        booking.completion_otp = otp
    elif otp_svc.is_sms_configured:
        raise HTTPException(
            status_code=503,
            detail=dispatch.result.user_message(
                fallback="Could not send SMS to customer. Check the phone number and try again.",
            ),
        )
    else:
        raise HTTPException(status_code=503, detail="SMS service is not configured. Contact support.")

    await db.commit()
    payload: dict = {
        "sent": dispatch.result.sent or settings.DEBUG,
        "expires_in_minutes": 15,
    }
    if not dispatch.result.sent and settings.DEBUG:
        payload["dev_hint"] = otp
    return payload


@router.put("/{booking_id}/assign")
async def assign_staff(
    booking_id: str,
    data: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Assign a staff member to a booking."""
    booking = await db.get(Booking, UUID(booking_id))
    if not booking or booking.vendor_id != vendor_id:
        raise HTTPException(404, "Booking not found")

    booking.assigned_staff_id = UUID(data["staff_id"]) if data.get("staff_id") else None
    booking.assigned_staff_name = data.get("staff_name", "")

    # Add followup note about assignment
    note_entry = {
        "id": str(uuid_mod.uuid4()),
        "type": "assignment",
        "content": f"Assigned to {data.get('staff_name', 'staff')}",
        "author": current_user.full_name or current_user.email,
        "author_id": str(current_user.id),
        "role": "vendor",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    followups = list(booking.followups or [])
    followups.append(note_entry)
    booking.followups = followups

    await db.commit()
    await db.refresh(booking)
    return _booking_dict(booking)


@router.post("/{booking_id}/followups")
async def add_followup(
    booking_id: str,
    data: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Add a followup note to a booking."""
    booking = await db.get(Booking, UUID(booking_id))
    if not booking or booking.vendor_id != vendor_id:
        raise HTTPException(404, "Booking not found")

    content = (data.get("content") or "").strip()
    if not content:
        raise HTTPException(400, "content is required")

    note = {
        "id": str(uuid_mod.uuid4()),
        "type": data.get("type", "note"),  # note, followup, reminder, update
        "content": content,
        "author": current_user.full_name or current_user.email,
        "author_id": str(current_user.id),
        "role": "vendor",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    followups = list(booking.followups or [])
    followups.append(note)
    booking.followups = followups

    await db.commit()
    await db.refresh(booking)
    return _booking_dict(booking)


@router.put("/{booking_id}/notes")
async def update_internal_notes(
    booking_id: str,
    data: dict = Body(...),
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Update vendor-only internal notes."""
    booking = await db.get(Booking, UUID(booking_id))
    if not booking or booking.vendor_id != vendor_id:
        raise HTTPException(404, "Booking not found")

    booking.internal_notes = data.get("internal_notes", "")
    if "delivery_notes" in data:
        booking.delivery_notes = data["delivery_notes"]

    await db.commit()
    await db.refresh(booking)
    return _booking_dict(booking)


@router.post("/{booking_id}/attachments")
async def upload_attachment(
    booking_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image/file to the booking."""
    booking = await db.get(Booking, UUID(booking_id))
    if not booking or booking.vendor_id != vendor_id:
        raise HTTPException(404, "Booking not found")

    # Reuse the order media upload utility
    payload = await save_order_media_file(file, vendor_id, UUID(booking_id))

    attachment = {
        "id": str(uuid_mod.uuid4()),
        "url": payload["url"],
        "kind": payload["kind"],
        "filename": file.filename,
        "uploaded_by": current_user.full_name or current_user.email,
        "uploaded_by_id": str(current_user.id),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    attachments = list(booking.attachments or [])
    attachments.append(attachment)
    booking.attachments = attachments

    await db.commit()
    await db.refresh(booking)
    return attachment


@router.delete("/{booking_id}/attachments/{attachment_id}")
async def delete_attachment(
    booking_id: str,
    attachment_id: str,
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove an attachment from a booking."""
    booking = await db.get(Booking, UUID(booking_id))
    if not booking or booking.vendor_id != vendor_id:
        raise HTTPException(404, "Booking not found")

    booking.attachments = [a for a in (booking.attachments or []) if a.get("id") != attachment_id]
    await db.commit()
    return {"deleted": True}
