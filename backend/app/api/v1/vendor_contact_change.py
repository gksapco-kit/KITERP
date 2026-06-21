# app/api/v1/vendor_contact_change.py
"""Vendor user contact change requests (email/phone) requiring admin / RM approval."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_vendor_user
from app.core.security import verify_password
from app.database import get_db
from app.models.user import User
from app.models.user_contact_change_request import UserContactChangeRequest
from app.models.vendor_user import VendorUser
from app.repositories.vendor_repo import VendorRepository

router = APIRouter()


class ContactChangeRequestCreate(BaseModel):
    field_type: str = Field(..., pattern="^(email|phone)$")
    new_value: str = Field(..., min_length=3, max_length=255)
    reason: Optional[str] = Field(None, max_length=2000)
    password: str = Field(..., min_length=1)


class ContactChangeRequestRow(BaseModel):
    id: str
    field_type: str
    current_value: str
    requested_value: str
    reason: Optional[str] = None
    status: str
    review_notes: Optional[str] = None
    created_at: Optional[str] = None
    resolved_at: Optional[str] = None


def _row(r: UserContactChangeRequest) -> ContactChangeRequestRow:
    return ContactChangeRequestRow(
        id=str(r.id),
        field_type=r.field_type,
        current_value=r.current_value,
        requested_value=r.requested_value,
        reason=r.reason,
        status=r.status,
        review_notes=r.review_notes,
        created_at=r.created_at.isoformat() if r.created_at else None,
        resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
    )


async def _get_user_for_vendor_user(vu: VendorUser, db: AsyncSession) -> User:
    user = await db.get(User, vu.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/contact-change-requests", response_model=List[ContactChangeRequestRow])
async def list_my_contact_change_requests(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserContactChangeRequest)
        .where(
            UserContactChangeRequest.user_id == vu.user_id,
            UserContactChangeRequest.vendor_id == vu.vendor_id,
        )
        .order_by(UserContactChangeRequest.created_at.desc())
        .limit(20)
    )
    return [_row(r) for r in result.scalars().all()]


@router.post(
    "/contact-change-requests",
    response_model=ContactChangeRequestRow,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact_change_request(
    body: ContactChangeRequestCreate,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_for_vendor_user(vu, db)
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    field = body.field_type
    if field == "email" and not user.is_email_verified:
        raise HTTPException(
            status_code=400,
            detail="Verify your email before requesting a change",
        )
    if field == "phone" and not user.is_phone_verified:
        raise HTTPException(
            status_code=400,
            detail="Verify your phone before requesting a change",
        )

    pending = await db.execute(
        select(UserContactChangeRequest).where(
            UserContactChangeRequest.user_id == user.id,
            UserContactChangeRequest.vendor_id == vu.vendor_id,
            UserContactChangeRequest.field_type == field,
            UserContactChangeRequest.status == "pending",
        )
    )
    if pending.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A pending {field} change request already exists",
        )

    if field == "email":
        new_email = body.new_value.strip().lower()
        if new_email == (user.email or "").lower():
            raise HTTPException(status_code=400, detail="That is already your current email")
        dup = await db.execute(
            select(User).where(User.email == new_email, User.id != user.id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="That email is already in use")
        current_value = user.email or ""
        requested_value = new_email
    else:
        from app.services.sms_service import normalize_e164, is_valid_e164

        phone = normalize_e164(body.new_value.strip())
        if not is_valid_e164(phone):
            raise HTTPException(
                status_code=422,
                detail="Enter a valid mobile number with country code (e.g. +919876543210)",
            )
        if phone == (user.phone or ""):
            raise HTTPException(status_code=400, detail="That is already your current phone number")
        current_value = user.phone or ""
        requested_value = phone

    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vu.vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    req = UserContactChangeRequest(
        user_id=user.id,
        vendor_id=vendor.id,
        field_type=field,
        current_value=current_value,
        requested_value=requested_value,
        reason=(body.reason or "").strip() or None,
        status="pending",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return _row(req)


@router.post("/contact-change-requests/{request_id}/cancel", response_model=ContactChangeRequestRow)
async def cancel_contact_change_request(
    request_id: str,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID

    req = await db.get(UserContactChangeRequest, UUID(request_id))
    if not req or req.user_id != vu.user_id or req.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")

    req.status = "cancelled"
    req.resolved_at = datetime.now(timezone.utc)
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return _row(req)


async def apply_contact_change_request(
    db: AsyncSession,
    req: UserContactChangeRequest,
    reviewer: User,
    *,
    approve: bool,
    review_notes: Optional[str] = None,
) -> UserContactChangeRequest:
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is no longer pending")

    now = datetime.now(timezone.utc)
    if not approve:
        req.status = "rejected"
        req.review_notes = (review_notes or "").strip() or None
        req.reviewed_by_user_id = reviewer.id
        req.resolved_at = now
        db.add(req)
        await db.commit()
        await db.refresh(req)
        return req

    user = await db.get(User, req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.field_type == "email":
        dup = await db.execute(
            select(User).where(User.email == req.requested_value, User.id != user.id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="That email is already in use")
        user.email = req.requested_value
        user.is_email_verified = True
        user.pending_email = None
        user.email_change_code = None
        user.email_change_expires_at = None
    else:
        from app.api.v1.auth import _sync_owner_phone_to_vendors

        user.phone = req.requested_value
        user.is_phone_verified = True
        await _sync_owner_phone_to_vendors(db, user.id, user.phone)

    db.add(user)
    req.status = "approved"
    req.review_notes = (review_notes or "").strip() or None
    req.reviewed_by_user_id = reviewer.id
    req.resolved_at = now
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def apply_contact_change_request(
    db: AsyncSession,
    req: UserContactChangeRequest,
    reviewer: User,
    *,
    approve: bool,
    review_notes: Optional[str] = None,
) -> UserContactChangeRequest:
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is no longer pending")

    now = datetime.now(timezone.utc)
    if not approve:
        req.status = "rejected"
        req.review_notes = (review_notes or "").strip() or None
        req.reviewed_by_user_id = reviewer.id
        req.resolved_at = now
        db.add(req)
        await db.commit()
        await db.refresh(req)
        return req

    user = await db.get(User, req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.field_type == "email":
        dup = await db.execute(
            select(User).where(User.email == req.requested_value, User.id != user.id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="That email is already in use")
        user.email = req.requested_value
        user.is_email_verified = True
        user.pending_email = None
        user.email_change_code = None
        user.email_change_expires_at = None
    else:
        from app.api.v1.auth import _sync_owner_phone_to_vendors

        user.phone = req.requested_value
        user.is_phone_verified = True
        await _sync_owner_phone_to_vendors(db, user.id, user.phone)

    db.add(user)
    req.status = "approved"
    req.review_notes = (review_notes or "").strip() or None
    req.reviewed_by_user_id = reviewer.id
    req.resolved_at = now
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req
