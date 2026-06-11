# app/api/v1/vendor_team.py
"""Vendor Team Management API - Invite, manage, and remove team members."""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone, timedelta, date
import random
import string
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.models.vendor_role import DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS
from app.api.deps import (
    get_current_active_user,
    get_current_vendor_user,
    require_permission,
    get_effective_permissions,
    normalized_vendor_role,
    vendor_member_role_display_name,
)
from app.repositories.vendor_user_repo import VendorUserRepository
from app.repositories.vendor_role_repo import VendorRoleRepository
from app.repositories.user_repo import UserRepository
from app.core.security import get_password_hash


OTP_EXPIRY_MINUTES = 30


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


async def _send_phone_verification_otp(user: User, *, purpose: str) -> dict:
    """Send OTP to user.phone via Twilio. Mutates user.verification_code on success."""
    from app.config import settings
    from app.services.phone_otp_service import OtpService, TWILIO_VERIFY_MARKER

    if not user.phone:
        raise HTTPException(status_code=400, detail="No phone number on file")

    otp_svc = OtpService()
    dispatch = await otp_svc.send_and_store_code(user.phone, channel="sms", purpose=purpose)
    if dispatch.result.sent:
        user.verification_code = TWILIO_VERIFY_MARKER if dispatch.verify_marker else dispatch.stored_code
        return {"otp": None, "sms_sent": True, "email_sent": False}

    if settings.DEBUG:
        otp = dispatch.stored_code or _generate_otp()
        user.verification_code = otp
        return {"otp": otp, "sms_sent": False, "email_sent": False}

    if otp_svc.is_sms_configured:
        raise HTTPException(
            status_code=503,
            detail=dispatch.result.user_message(
                fallback="Could not send SMS to this number. Check the number and try again.",
            ),
        )
    raise HTTPException(status_code=503, detail="SMS service is not configured. Contact support.")


async def _send_email_verification_otp(user: User, *, purpose: str) -> dict:
    """Send OTP to user.email via Twilio Verify or SMTP. Mutates user.verification_code on success."""
    from app.config import settings
    from app.services.phone_otp_service import OtpService, TWILIO_VERIFY_EMAIL_MARKER

    if not user.email:
        raise HTTPException(status_code=400, detail="No email on file")

    otp_svc = OtpService()
    dispatch = await otp_svc.send_and_store_code(user.email, channel="email", purpose=purpose)
    if dispatch.result.sent:
        user.verification_code = (
            TWILIO_VERIFY_EMAIL_MARKER if dispatch.verify_marker else dispatch.stored_code
        )
        return {"otp": None, "sms_sent": False, "email_sent": True}

    if settings.DEBUG:
        otp = dispatch.stored_code or _generate_otp()
        user.verification_code = otp
        return {"otp": otp, "sms_sent": False, "email_sent": False}

    if otp_svc.is_email_configured:
        raise HTTPException(
            status_code=503,
            detail=dispatch.result.user_message(
                fallback="Could not send verification email. Check the address and try again.",
            ),
        )
    raise HTTPException(status_code=503, detail="Email service is not configured. Contact support.")


router = APIRouter()

# Built-in roles that may be assigned when inviting/editing (excludes owner, platform_staff)
ASSIGNABLE_BUILTIN_ROLES = [
    k for k in DEFAULT_ROLE_PERMISSIONS.keys()
    if k not in ("owner", "platform_staff")
]


# ── Schemas ─────────────────────────────────────────────────────

class InviteTeamMember(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    role: str = Field(default="staff")
    role_id: Optional[str] = None
    password: str = Field(..., min_length=6, max_length=100)
    access_starts_at: Optional[date] = None
    access_ends_at: Optional[date] = None
    employee_profile_id: Optional[UUID] = None


class UpdateTeamMember(BaseModel):
    role: Optional[str] = None
    role_id: Optional[str] = None
    is_active: Optional[bool] = None
    access_starts_at: Optional[date] = None
    access_ends_at: Optional[date] = None
    clear_access_ends_at: Optional[bool] = None


# ── Helpers ─────────────────────────────────────────────────────

def _member_to_dict(vu: VendorUser) -> dict:
    user = vu.user if hasattr(vu, "user") and vu.user else None
    perms = get_effective_permissions(vu)
    return {
        "id": str(vu.id),
        "vendor_id": str(vu.vendor_id),
        "user_id": str(vu.user_id),
        "role": normalized_vendor_role(vu),
        "role_id": str(vu.role_id) if vu.role_id else None,
        "role_name": vendor_member_role_display_name(vu),
        "permissions": perms,
        "is_active": vu.is_active,
        "invited_at": vu.invited_at.isoformat() if vu.invited_at else None,
        "accepted_at": vu.accepted_at.isoformat() if vu.accepted_at else None,
        "created_at": vu.created_at.isoformat() if vu.created_at else None,
        "access_starts_at": vu.access_starts_at.isoformat() if vu.access_starts_at else None,
        "access_ends_at": vu.access_ends_at.isoformat() if vu.access_ends_at else None,
        "access_end_source": vu.access_end_source,
        "access_sync_note": vu.access_sync_note,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "avatar_url": user.avatar_url,
            "is_active": user.is_active,
            "is_email_verified": user.is_email_verified,
            "is_phone_verified": user.is_phone_verified,
        } if user else None,
    }


# ── Endpoints ───────────────────────────────────────────────────

@router.get("")
async def list_team_members(
    page: int = 1,
    size: int = 50,
    vu: VendorUser = Depends(require_permission("team.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all team members for this vendor."""
    repo = VendorUserRepository(db)
    skip = (page - 1) * size
    members = await repo.list_by_vendor(vu.vendor_id, skip=skip, limit=size, include_inactive=True)
    total = await repo.count_by_vendor(vu.vendor_id, include_inactive=True)
    return JSONResponse({
        "items": [_member_to_dict(m) for m in members],
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0,
    })


@router.get("/assignable-roles")
async def list_assignable_roles(
    vu: VendorUser = Depends(require_permission("team.view")),
    db: AsyncSession = Depends(get_db),
):
    """Built-in + custom roles for team invite/edit (does not require roles.view)."""
    role_repo = VendorRoleRepository(db)
    custom = await role_repo.list_by_vendor(vu.vendor_id, include_inactive=True)
    from app.api.v1.vendor_roles import _role_to_dict

    return JSONResponse({
        "builtin_roles": [
            {"slug": slug, "name": slug.replace("_", " ").title()}
            for slug in ASSIGNABLE_BUILTIN_ROLES
        ],
        "custom_roles": [_role_to_dict(r) for r in custom],
    })


@router.get("/me")
async def get_my_membership(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's vendor membership and effective permissions."""
    repo = VendorUserRepository(db)
    member = await repo.get_with_details(vu.id)
    if not member:
        raise HTTPException(status_code=404, detail="Membership not found")
    return JSONResponse(_member_to_dict(member))


@router.post("", status_code=201)
async def invite_team_member(
    data: InviteTeamMember,
    vu: VendorUser = Depends(require_permission("team.invite")),
    db: AsyncSession = Depends(get_db),
):
    """
    Invite a new team member. Creates a user account if one doesn't exist
    and adds them to the vendor team.
    """
    user_repo = UserRepository(db)
    vu_repo = VendorUserRepository(db)

    # Validate role
    valid_roles = ASSIGNABLE_BUILTIN_ROLES + ["custom"]
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    if data.role == "platform_staff":
        raise HTTPException(
            status_code=400,
            detail="The platform_staff role is reserved for admin handoff — cannot invite manually.",
        )

    # Cannot assign owner role
    if data.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot assign owner role. There can only be one owner.")

    # If custom role, validate role_id
    if data.role == "custom":
        if not data.role_id:
            raise HTTPException(status_code=400, detail="role_id is required for custom roles.")
        role_repo = VendorRoleRepository(db)
        custom_role = await role_repo.get_by_vendor_and_id(vu.vendor_id, UUID(data.role_id))
        if not custom_role or not custom_role.is_active:
            raise HTTPException(status_code=400, detail="Custom role not found or inactive.")

    # Per-vendor identity: same email/phone may exist on other vendors as separate User rows.
    # Here we only reuse a User if they are already linked to *this* vendor with this email.
    fresh_otp: str | None = None
    user_on_vendor = await user_repo.get_user_with_email_for_vendor(vu.vendor_id, str(data.email))
    if user_on_vendor:
        existing_vu = await vu_repo.get_by_vendor_and_user(vu.vendor_id, user_on_vendor.id)
        if not existing_vu:
            raise HTTPException(status_code=500, detail="Inconsistent team membership for this email.")
        if existing_vu.is_active:
            member = await vu_repo.get_with_details(existing_vu.id)
            result = _member_to_dict(member)
            result["_otp"] = None
            return JSONResponse(status_code=201, content=result)
        # Reactivate and issue fresh OTP
        fresh_otp = _generate_otp()
        user_on_vendor.verification_code_expires_at = (
            datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        )
        if data.phone and user_on_vendor.phone:
            sent = await _send_phone_verification_otp(user_on_vendor, purpose="team verification")
            fresh_otp = sent.get("otp")
        else:
            user_on_vendor.verification_code = fresh_otp
        existing_vu.is_active = True
        existing_vu.role = data.role
        existing_vu.role_id = UUID(data.role_id) if data.role_id else None
        await db.commit()
        await db.refresh(existing_vu)
        member = await vu_repo.get_with_details(existing_vu.id)
        result = _member_to_dict(member)
        result["_otp"] = fresh_otp
        return JSONResponse(status_code=201, content=result)

    # New login identity for this vendor (even if another User exists elsewhere with same email).
    fresh_otp = _generate_otp()
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    user = User(
        email=str(data.email),
        full_name=data.full_name,
        phone=data.phone or None,
        password_hash=get_password_hash(data.password),
        is_active=True,
        is_email_verified=False,
        is_phone_verified=False,
        verification_code=fresh_otp,
        verification_code_expires_at=otp_expires,
    )
    db.add(user)
    await db.flush()
    if data.phone:
        sent = await _send_phone_verification_otp(user, purpose="team verification")
        fresh_otp = sent.get("otp")

    # Create VendorUser
    now = datetime.now(timezone.utc)
    new_vu = VendorUser(
        vendor_id=vu.vendor_id,
        user_id=user.id,
        role=data.role,
        role_id=UUID(data.role_id) if data.role_id else None,
        is_active=True,
        invited_by=vu.user_id,
        invited_at=now,
        accepted_at=now,
        access_starts_at=data.access_starts_at,
        access_ends_at=data.access_ends_at,
        access_end_source="manual" if data.access_ends_at else None,
    )
    db.add(new_vu)
    await db.flush()

    if data.employee_profile_id:
        from app.models.hr import EmployeeProfile
        from sqlalchemy import select

        emp_row = await db.execute(
            select(EmployeeProfile).where(
                EmployeeProfile.id == data.employee_profile_id,
                EmployeeProfile.vendor_id == vu.vendor_id,
            )
        )
        emp = emp_row.scalar_one_or_none()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee profile not found")
        if emp.vendor_user_id:
            raise HTTPException(
                status_code=400,
                detail="This employee already has portal access",
            )
        emp.vendor_user_id = new_vu.id
        if not (emp.full_name or "").strip():
            emp.full_name = data.full_name
        db.add(emp)

    await db.commit()
    await db.refresh(new_vu)

    member = await vu_repo.get_with_details(new_vu.id)
    result = _member_to_dict(member)
    # Return OTP so the admin can share it with the new member for verification
    result["_otp"] = fresh_otp
    return JSONResponse(status_code=201, content=result)


@router.get("/{member_id}")
async def get_team_member(
    member_id: UUID,
    vu: VendorUser = Depends(require_permission("team.view")),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific team member's details."""
    repo = VendorUserRepository(db)
    member = await repo.get_with_details(member_id)
    if not member or member.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Team member not found")
    return JSONResponse(_member_to_dict(member))


@router.put("/{member_id}")
async def update_team_member(
    member_id: UUID,
    data: UpdateTeamMember,
    vu: VendorUser = Depends(require_permission("team.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Update a team member's role or status."""
    repo = VendorUserRepository(db)
    member = await repo.get_with_details(member_id)
    if not member or member.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Team member not found")

    # Cannot modify the owner
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot modify the vendor owner's role.")

    # Cannot modify yourself (prevents locking yourself out)
    if member.user_id == vu.user_id:
        raise HTTPException(status_code=400, detail="Cannot modify your own membership. Ask another admin.")

    if data.role is not None:
        valid_roles = ASSIGNABLE_BUILTIN_ROLES + ["custom"]
        if data.role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
        if data.role == "owner":
            raise HTTPException(status_code=400, detail="Cannot assign owner role.")
        member.role = data.role

    if data.role_id is not None:
        if data.role == "custom" or (data.role is None and member.role == "custom"):
            role_repo = VendorRoleRepository(db)
            custom_role = await role_repo.get_by_vendor_and_id(vu.vendor_id, UUID(data.role_id))
            if not custom_role or not custom_role.is_active:
                raise HTTPException(status_code=400, detail="Custom role not found or inactive.")
            member.role_id = UUID(data.role_id)
        else:
            member.role_id = None

    if data.is_active is not None:
        member.is_active = data.is_active

    if data.access_starts_at is not None:
        member.access_starts_at = data.access_starts_at

    if data.clear_access_ends_at:
        member.access_ends_at = None
        member.access_end_source = None
        member.access_sync_note = None
    elif data.access_ends_at is not None:
        member.access_ends_at = data.access_ends_at
        member.access_end_source = "manual"
        member.access_sync_note = None

    await db.commit()
    await db.refresh(member)
    member = await repo.get_with_details(member.id)
    return JSONResponse(_member_to_dict(member))


@router.delete("/{member_id}")
async def remove_team_member(
    member_id: UUID,
    vu: VendorUser = Depends(require_permission("team.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a team member (deactivate)."""
    repo = VendorUserRepository(db)
    member = await repo.get_with_details(member_id)
    if not member or member.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Team member not found")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the vendor owner.")
    if member.user_id == vu.user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself.")

    member.is_active = False
    await db.commit()
    return JSONResponse({"message": "Team member removed"})


# ── OTP verification ──────────────────────────────────────────────────────────

@router.post("/{member_id}/send-verification")
async def send_verification_otp(
    member_id: UUID,
    vu: VendorUser = Depends(require_permission("team.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Generate a fresh OTP for the team member and return it so the admin can share it."""
    repo = VendorUserRepository(db)
    member = await repo.get_with_details(member_id)
    if not member or member.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Team member not found")

    user: User = member.user  # type: ignore[assignment]
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if user.is_email_verified and user.is_phone_verified:
        return JSONResponse({"message": "Already fully verified", "otp": None})

    channel = "phone" if user.phone and not user.is_phone_verified else "email"
    contact = user.phone if channel == "phone" else user.email
    user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    if channel == "phone":
        sent = await _send_phone_verification_otp(user, purpose="team verification")
        await db.commit()
        return JSONResponse({
            "otp": sent.get("otp"),
            "sms_sent": sent.get("sms_sent", False),
            "email_sent": sent.get("email_sent", False),
            "expires_in_minutes": OTP_EXPIRY_MINUTES,
            "contact": contact,
            "channel": channel,
        })

    sent = await _send_email_verification_otp(user, purpose="team verification")
    await db.commit()
    return JSONResponse({
        "otp": sent.get("otp"),
        "sms_sent": sent.get("sms_sent", False),
        "email_sent": sent.get("email_sent", False),
        "expires_in_minutes": OTP_EXPIRY_MINUTES,
        "contact": contact,
        "channel": channel,
    })


class VerifyOTPPayload(BaseModel):
    otp: str = Field(..., min_length=6, max_length=6)
    channel: str = Field("email", pattern=r"^(email|phone)$")


@router.post("/{member_id}/verify")
async def verify_team_member_otp(
    member_id: UUID,
    payload: VerifyOTPPayload,
    vu: VendorUser = Depends(require_permission("team.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Verify a team member's email or phone using the OTP."""
    repo = VendorUserRepository(db)
    member = await repo.get_with_details(member_id)
    if not member or member.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Team member not found")

    user: User = member.user  # type: ignore[assignment]
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    now = datetime.now(timezone.utc)
    if not user.verification_code or not user.verification_code_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    if user.verification_code_expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    from app.services.phone_otp_service import OtpService, is_twilio_verify_stored, is_twilio_email_verify_stored

    otp_ok = False
    if payload.channel == "phone" and is_twilio_verify_stored(user.verification_code) and user.phone:
        check = await OtpService().verify_otp(user.phone, payload.otp, channel="sms")
        otp_ok = check.approved
    elif payload.channel == "email" and is_twilio_email_verify_stored(user.verification_code) and user.email:
        check = await OtpService().verify_otp(user.email, payload.otp, channel="email")
        otp_ok = check.approved
    elif user.verification_code == payload.otp:
        otp_ok = True

    if not otp_ok:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if payload.channel == "email":
        user.is_email_verified = True
    else:
        user.is_phone_verified = True

    # Clear OTP once used
    user.verification_code = None
    user.verification_code_expires_at = None
    await db.commit()

    member = await repo.get_with_details(member.id)
    return JSONResponse(_member_to_dict(member))
