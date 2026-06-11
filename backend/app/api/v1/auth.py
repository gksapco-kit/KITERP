# app/api/v1/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone
import json
import secrets
import logging
import re

from app.database import get_db
from app.config import settings
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.schemas.user import UserCreate, LoginRequest, Token
from app.services.auth_service import AuthService
from app.services.platform_staff_audit_service import (
    log_platform_staff_audit,
    ACTION_PLATFORM_LOGIN,
)
from app.services.vendor_service import apply_auto_approval_to_vendor_if_enabled
from app.repositories.vendor_repo import VendorRepository
from app.core.events import event_emitter
from app.repositories.user_repo import UserRepository
from app.repositories.vendor_user_repo import VendorUserRepository
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_vendor_handoff_token,
)
from app.schemas.vendor import VendorResponse
from app.utils.platform_staff import has_platform_staff_access
from app.utils.platform_vendor_access import ensure_vendor_visible_to_platform_staff
from app.services.vendor_platform_audit_service import (
    ACTION_VENDOR_HANDOFF_REDEEMED,
    log_vendor_platform_audit,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_email_verification_codes: dict[str, dict] = {}
# Pre-signup phone OTP (digits-only key → { code, expires_at }); cleared after successful vendor-signup.
_vendor_signup_phone_otp: dict[str, dict] = {}
_vendor_signup_email_otp: dict[str, dict] = {}

_VENDOR_SIGNUP_PHONE_OTP_PREFIX = "kiterp:vendor_signup:phone:"
_VENDOR_SIGNUP_EMAIL_OTP_PREFIX = "kiterp:vendor_signup:email:"
_VENDOR_SIGNUP_OTP_TTL_SEC = 600


def _serialize_vendor_signup_otp_entry(entry: dict) -> str:
    payload = dict(entry)
    exp = payload.get("expires_at")
    if isinstance(exp, datetime):
        payload["expires_at"] = exp.isoformat()
    return json.dumps(payload)


def _deserialize_vendor_signup_otp_entry(raw: str) -> dict:
    data = json.loads(raw)
    exp = data.get("expires_at")
    if isinstance(exp, str):
        data["expires_at"] = datetime.fromisoformat(exp.replace("Z", "+00:00"))
    return data


async def _vendor_signup_otp_set(channel: str, key: str, entry: dict) -> None:
    """Store pre-signup OTP in Redis (prod multi-worker) and in-process fallback."""
    from app.database import redis_client

    prefix = _VENDOR_SIGNUP_PHONE_OTP_PREFIX if channel == "phone" else _VENDOR_SIGNUP_EMAIL_OTP_PREFIX
    if redis_client:
        try:
            await redis_client.setex(
                f"{prefix}{key}",
                _VENDOR_SIGNUP_OTP_TTL_SEC,
                _serialize_vendor_signup_otp_entry(entry),
            )
        except Exception as e:
            logger.warning("Redis vendor-signup OTP set failed (%s): %s", channel, e)
    if channel == "phone":
        _vendor_signup_phone_otp[key] = entry
    else:
        _vendor_signup_email_otp[key] = entry


async def _vendor_signup_otp_get(channel: str, key: str) -> dict | None:
    from app.database import redis_client

    prefix = _VENDOR_SIGNUP_PHONE_OTP_PREFIX if channel == "phone" else _VENDOR_SIGNUP_EMAIL_OTP_PREFIX
    if redis_client:
        try:
            raw = await redis_client.get(f"{prefix}{key}")
            if raw:
                return _deserialize_vendor_signup_otp_entry(raw)
        except Exception as e:
            logger.warning("Redis vendor-signup OTP get failed (%s): %s", channel, e)
    if channel == "phone":
        return _vendor_signup_phone_otp.get(key)
    return _vendor_signup_email_otp.get(key)


async def _vendor_signup_otp_pop(channel: str, key: str) -> None:
    from app.database import redis_client

    prefix = _VENDOR_SIGNUP_PHONE_OTP_PREFIX if channel == "phone" else _VENDOR_SIGNUP_EMAIL_OTP_PREFIX
    if redis_client:
        try:
            await redis_client.delete(f"{prefix}{key}")
        except Exception as e:
            logger.warning("Redis vendor-signup OTP delete failed (%s): %s", channel, e)
    if channel == "phone":
        _vendor_signup_phone_otp.pop(key, None)
    else:
        _vendor_signup_email_otp.pop(key, None)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class VendorSignupPhoneOtpSend(BaseModel):
    phone: str = Field(..., min_length=8, max_length=24)


class VendorSignupEmailOtpSend(BaseModel):
    email: EmailStr


class VendorSignupContactCheck(BaseModel):
    """Pre-flight check before OTP / signup — same rules as register()."""
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=24)


class VendorSignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    business_name: str = Field(..., min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=24)
    password: str = Field(..., min_length=8, max_length=100)
    business_category: Optional[str] = Field(None, max_length=50)
    phone_otp: Optional[str] = Field(None, min_length=6, max_length=6)
    email_otp: Optional[str] = Field(None, min_length=6, max_length=6)


class EmailVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class MeUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=24)
    avatar_url: Optional[str] = Field(None, max_length=500)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class EmailChangeRequestPayload(BaseModel):
    new_email: EmailStr
    password: str = Field(..., min_length=1)


class CodePayload(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


def user_to_dict(user: User) -> dict:
    """Safely convert SQLAlchemy User model to a JSON-serializable dict."""
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "is_email_verified": user.is_email_verified or False,
        "is_phone_verified": user.is_phone_verified or False,
        "is_active": user.is_active or False,
        "is_superuser": user.is_superuser or False,
        "platform_staff_role": getattr(user, "platform_staff_role", None),
        "platform_staff_job_role": getattr(user, "platform_staff_job_role", None),
        "platform_staff_manager_id": (
            str(user.platform_staff_manager_id)
            if getattr(user, "platform_staff_manager_id", None)
            else None
        ),
        "pending_email": getattr(user, "pending_email", None),
        "is_2fa_enabled": bool(getattr(user, "is_2fa_enabled", False)),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user."""
    service = AuthService(db)
    user = await service.register(data)
    return JSONResponse(content=user_to_dict(user), status_code=201)


@router.post("/login")
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with email or phone number. Accepts JSON or form-data."""
    service = AuthService(db)

    content_type = request.headers.get("content-type", "")
    vendor_slug_raw: Optional[str] = None
    if "application/json" in content_type:
        body = await request.json()
        login_val = body.get("login") or body.get("email") or ""
        password = body.get("password", "")
        totp_code = body.get("totp_code") or body.get("otp")
        vendor_slug_raw = body.get("vendor_slug")
    else:
        form = await request.form()
        login_val = form.get("username") or form.get("login") or ""
        password = form.get("password") or ""
        totp_code = form.get("totp_code") or form.get("otp")
        vendor_slug_raw = form.get("vendor_slug")

    if not login_val or not password:
        raise HTTPException(status_code=422, detail="login and password are required")

    # Super Admin UI (frontend :3000) — never tenant-scope login via Host middleware or
    # VENDOR_LOGIN_DEFAULT_SLUG, or platform users get "Incorrect password" / no match.
    platform_login_hdr = request.headers.get("x-platform-login", "").strip().lower()
    platform_login = platform_login_hdr in ("1", "true", "yes") or request.query_params.get(
        "platform", ""
    ).strip().lower() in ("1", "true", "yes")

    vrepo = VendorRepository(db)
    resolved_vendor_id: Optional[UUID] = None
    if not platform_login:
        if vendor_slug_raw and str(vendor_slug_raw).strip():
            v = await vrepo.find_by_slug_ci(str(vendor_slug_raw).strip())
            if not v:
                raise HTTPException(status_code=400, detail="Unknown business slug.")
            resolved_vendor_id = v.id
        if resolved_vendor_id is None:
            state_vid = getattr(request.state, "vendor_id", None)
            if state_vid:
                try:
                    resolved_vendor_id = UUID(str(state_vid))
                except ValueError:
                    resolved_vendor_id = None
        if resolved_vendor_id is None and settings.VENDOR_LOGIN_DEFAULT_SLUG:
            v = await vrepo.find_by_slug_ci(settings.VENDOR_LOGIN_DEFAULT_SLUG.strip())
            if v:
                resolved_vendor_id = v.id

    try:
        tokens = await service.login(
            str(login_val), str(password), vendor_id=resolved_vendor_id, totp_code=totp_code,
        )
    except HTTPException as exc:
        # Wrong vendor slug (env, ?vendor=, or host) must not block login when the user
        # belongs to another business — retry without tenant scope.
        if (
            not platform_login
            and exc.status_code == status.HTTP_401_UNAUTHORIZED
            and resolved_vendor_id is not None
            and exc.detail == "No team account on this business for that email or phone."
        ):
            tokens = await service.login(
                str(login_val), str(password), vendor_id=None, totp_code=totp_code,
            )
        else:
            raise
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type,
    }


@router.post("/login/platform")
async def login_platform(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Super Admin app (port 3000): JSON login with **no** tenant scoping.
    Prefer this over `/auth/login` so Vite/webpack proxies cannot drop `X-Platform-Login`
    and OAuth form bodies cannot be mishandled.
    """
    service = AuthService(db)
    tokens, user = await service.login_platform(data.login.strip(), data.password)
    await log_platform_staff_audit(
        db,
        subject_user_id=user.id,
        actor_user_id=user.id,
        action=ACTION_PLATFORM_LOGIN,
        request=request,
    )
    await db.commit()
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type,
    }


class VendorHandoffRedeemRequest(BaseModel):
    handoff_token: str = Field(..., min_length=20)


class VendorHandoffRedeemResponse(Token):
    vendor: dict


@router.post("/vendor-handoff/redeem", response_model=VendorHandoffRedeemResponse)
async def redeem_vendor_handoff(
    body: VendorHandoffRedeemRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a short-lived admin handoff JWT for normal vendor-dashboard tokens + vendor profile."""
    payload = decode_vendor_handoff_token(body.handoff_token.strip())
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired handoff token",
        )
    try:
        user_id = UUID(str(payload["sub"]))
        vendor_id = UUID(str(payload["vendor_id"]))
    except (KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid handoff token payload",
        )

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    if not has_platform_staff_access(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform access required",
        )

    vendor = await db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    await ensure_vendor_visible_to_platform_staff(user, vendor)

    vu_repo = VendorUserRepository(db)
    existing_rows = await vu_repo.list_all_for_vendor_and_user(vendor_id, user_id)
    if existing_rows:
        # Prefer newest row as canonical; deactivate duplicate vendor_user rows (same user+vendor).
        vu = existing_rows[0]
        vu.is_active = True
        vu.role = "platform_staff"
        vu.role_id = None
        vu.permissions = []
        for dup in existing_rows[1:]:
            dup.is_active = False
    else:
        db.add(
            VendorUser(
                vendor_id=vendor_id,
                user_id=user_id,
                role="platform_staff",
                permissions=[],
                is_active=True,
            )
        )
    await db.flush()

    await log_vendor_platform_audit(
        db,
        vendor_id=vendor_id,
        actor_user_id=user_id,
        action=ACTION_VENDOR_HANDOFF_REDEEMED,
        detail={"source": "admin_dashboard_handoff"},
        request=request,
    )
    await db.commit()

    token_data = {"sub": str(user.id)}
    if user.email:
        token_data["email"] = user.email
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)
    vendor_payload = VendorResponse.model_validate(vendor).model_dump(mode="json")
    return VendorHandoffRedeemResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        vendor=vendor_payload,
    )


@router.post("/refresh")
async def refresh_token(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token."""
    service = AuthService(db)
    tokens = await service.refresh_tokens(data.refresh_token)
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type,
    }


async def _build_me_payload(user: User, db: AsyncSession) -> dict:
    """Build the same /me response payload (user dict + vendor_role) used by GET and PATCH."""
    data = user_to_dict(user)

    from app.repositories.vendor_user_repo import VendorUserRepository
    from app.repositories.vendor_repo import VendorRepository
    from app.api.deps import (
        get_effective_permissions,
        normalized_vendor_role,
        vendor_member_role_display_name,
    )

    vu_repo = VendorUserRepository(db)
    vu = await vu_repo.get_by_user_id(user.id)

    if not vu:
        vendor_repo = VendorRepository(db)
        vendor = await vendor_repo.get_by_user_id(user.id)
        if vendor:
            from app.models.vendor_user import VendorUser
            vu = VendorUser(
                vendor_id=vendor.id,
                user_id=user.id,
                role="owner",
                permissions=[],
                is_active=True,
            )
            db.add(vu)
            await db.commit()
            await db.refresh(vu)

    if vu:
        if vu.role_id:
            from app.repositories.vendor_role_repo import VendorRoleRepository
            role_repo = VendorRoleRepository(db)
            custom_role = await role_repo.get_by_vendor_and_id(vu.vendor_id, vu.role_id)
            vu.custom_role = custom_role

        perms = get_effective_permissions(vu)
        data["vendor_role"] = {
            "vendor_id": str(vu.vendor_id),
            "role": normalized_vendor_role(vu),
            "role_id": str(vu.role_id) if vu.role_id else None,
            "role_name": vendor_member_role_display_name(vu),
            "permissions": perms,
            "is_active": vu.is_active,
        }
    else:
        data["vendor_role"] = None

    return data


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current logged-in user profile with vendor role information."""
    data = await _build_me_payload(current_user, db)
    return JSONResponse(content=data)


@router.patch("/me")
async def update_me(
    payload: MeUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile (name, phone, avatar)."""
    updates: dict = {}

    if payload.full_name is not None:
        name = payload.full_name.strip()
        if name:
            updates["full_name"] = name

    if payload.phone is not None:
        phone = payload.phone.strip() or None
        if phone and phone != current_user.phone:
            existing = await db.execute(
                select(User).where(User.phone == phone, User.id != current_user.id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Phone number is already in use")
            updates["phone"] = phone
            updates["is_phone_verified"] = False
        elif phone is None:
            updates["phone"] = None

    if payload.avatar_url is not None:
        url = payload.avatar_url.strip()
        updates["avatar_url"] = url or None

    if updates:
        for key, value in updates.items():
            setattr(current_user, key, value)
        db.add(current_user)
        await db.commit()
        await db.refresh(current_user)

    data = await _build_me_payload(current_user, db)
    return JSONResponse(content=data)


@router.post("/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password after verifying the current one."""
    from app.core.security import verify_password, get_password_hash

    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password")

    current_user.password_hash = get_password_hash(payload.new_password)
    db.add(current_user)
    await db.commit()

    return {"success": True, "message": "Password changed successfully"}


# ── Password reset (forgot password) ──────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=24)


class ResetPasswordRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=24)
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request a 6-digit password-reset code to the supplied email.

    In dev mode (no SMTP), the code is returned in ``dev_hint``.
    """
    from datetime import datetime, timedelta, timezone
    from app.repositories.user_repo import UserRepository

    email = _require_valid_email(str(payload.email))
    repo = UserRepository(db)
    users = await repo.list_users_by_email_ci(email)
    user = users[0] if users else None

    if not user:
        raise HTTPException(
            status_code=400,
            detail="This email is not registered. Check the address or create a business account first.",
        )

    expires = datetime.now(timezone.utc) + timedelta(seconds=600)
    from app.services.phone_otp_service import OtpService, TWILIO_VERIFY_EMAIL_MARKER, generate_otp_code

    otp_svc = OtpService()
    dispatch = await otp_svc.send_and_store_code(email, channel="email", purpose="password reset")
    if not dispatch.result.sent:
        if settings.DEBUG:
            code = generate_otp_code()
            user.verification_code = code
            user.verification_code_expires_at = expires
            db.add(user)
            await db.commit()
            logger.info("[forgot-password-email:dev] email=%s code=%s", email, code)
            return {"sent": True, "to": email, "dev_hint": code}
        if otp_svc.is_email_configured:
            raise HTTPException(
                status_code=503,
                detail=dispatch.result.user_message(
                    fallback="Could not send verification email. Check the address and try again.",
                ),
            )
        raise HTTPException(status_code=503, detail="Email service is not configured. Contact support.")

    user.verification_code = (
        TWILIO_VERIFY_EMAIL_MARKER if dispatch.verify_marker else dispatch.stored_code
    )
    user.verification_code_expires_at = expires
    db.add(user)
    await db.commit()
    return {"sent": True, "to": email, "expires_at": expires.isoformat()}


@router.post("/forgot-password/check-email")
async def forgot_password_check_email(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify the email exists in the database before sending a reset code."""
    from app.repositories.user_repo import UserRepository

    email = _require_valid_email(str(payload.email))
    repo = UserRepository(db)
    if not await repo.email_exists_in_db(email):
        raise HTTPException(
            status_code=400,
            detail="This email is not registered. Check the address or create a business account first.",
        )
    return {"registered": True}


@router.post("/forgot-password/check-phone")
async def forgot_password_check_phone(
    payload: ForgotPasswordPhoneRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify the phone exists in the database before sending a reset OTP."""
    from app.repositories.user_repo import UserRepository
    from app.services.sms_service import normalize_e164

    phone = normalize_e164(payload.phone or "")
    key = _vendor_signup_phone_key(phone)
    if len(key) < 10:
        raise HTTPException(
            status_code=422,
            detail="Enter a valid phone number with country code",
        )
    repo = UserRepository(db)
    if not await repo.phone_exists_in_db(phone):
        raise HTTPException(
            status_code=400,
            detail="This phone number is not registered. Check the number or create a business account first.",
        )
    return {"registered": True}


@router.post("/forgot-password-phone")
async def forgot_password_phone(
    payload: ForgotPasswordPhoneRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request a 6-digit password-reset code via SMS."""
    from app.repositories.user_repo import UserRepository
    from app.services.phone_otp_service import OtpService, TWILIO_VERIFY_MARKER, generate_otp_code
    from app.services.sms_service import normalize_e164

    phone = normalize_e164(payload.phone or "")
    key = _vendor_signup_phone_key(phone)
    if len(key) < 10:
        raise HTTPException(
            status_code=422,
            detail="Enter a valid phone number with country code",
        )

    repo = UserRepository(db)
    users = await repo.list_users_by_phone(phone)
    user = users[0] if users else None
    if not user:
        raise HTTPException(
            status_code=400,
            detail="This phone number is not registered. Check the number or create a business account first.",
        )

    expires = datetime.now(timezone.utc) + timedelta(seconds=600)
    otp_svc = OtpService()
    dispatch = await otp_svc.send_and_store_code(phone, channel="sms", purpose="password reset")
    if not dispatch.result.sent:
        if settings.DEBUG:
            code = dispatch.stored_code or generate_otp_code()
            user.verification_code = code
            user.verification_code_expires_at = expires
            db.add(user)
            await db.commit()
            logger.info("[forgot-password-phone:dev] phone_suffix=%s code=%s", phone[-4:], code)
            return {"sent": True, "to": _mask_phone(phone), "dev_hint": code}
        if otp_svc.is_sms_configured:
            raise HTTPException(
                status_code=503,
                detail=dispatch.result.user_message(
                    fallback="Could not send SMS to this number. Check the number and try again.",
                ),
            )
        raise HTTPException(status_code=503, detail="SMS service is not configured. Contact support.")

    if dispatch.verify_marker:
        user.verification_code = TWILIO_VERIFY_MARKER
    else:
        user.verification_code = dispatch.stored_code
    user.verification_code_expires_at = expires
    db.add(user)
    await db.commit()
    return {"sent": True, "to": _mask_phone(phone), "expires_at": expires.isoformat()}


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Validate reset code and set new password."""
    from datetime import datetime, timezone
    from app.core.security import get_password_hash
    from app.services.phone_otp_service import (
        OtpService,
        is_twilio_verify_stored,
        is_twilio_email_verify_stored,
    )
    from app.services.sms_service import normalize_e164

    if not payload.email and not payload.phone:
        raise HTTPException(status_code=422, detail="Email or phone is required")

    user = None
    if payload.email:
        result = await db.execute(select(User).where(User.email == payload.email.lower()))
        user = result.scalar_one_or_none()
    elif payload.phone:
        from app.repositories.user_repo import UserRepository

        phone = normalize_e164(payload.phone)
        users = await UserRepository(db).list_users_by_phone(phone)
        user = users[0] if users else None

    if not user or not user.verification_code:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    if user.verification_code_expires_at and user.verification_code_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset code has expired — please request a new one")

    code_ok = False
    if is_twilio_email_verify_stored(user.verification_code) and user.email:
        check = await OtpService().verify_otp(user.email, payload.code, channel="email")
        code_ok = check.approved
    elif is_twilio_verify_stored(user.verification_code) and user.phone:
        check = await OtpService().verify_otp(user.phone, payload.code, channel="sms")
        code_ok = check.approved
    elif user.verification_code == payload.code:
        code_ok = True

    if not code_ok:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    user.password_hash = get_password_hash(payload.new_password)
    user.verification_code = None
    user.verification_code_expires_at = None
    db.add(user)
    await db.commit()

    return {"success": True, "message": "Password reset successfully — you can now log in"}


# ── Self-service email / phone verification ────────────────────────────────

CODE_TTL_SECONDS = 600  # 10 minutes
RESEND_COOLDOWN_SECONDS = 30


def _generate_code() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def _expires_at(seconds: int = CODE_TTL_SECONDS) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


def _smtp_dev_mode() -> bool:
    """True when no real SMTP is configured — codes are returned as dev_hint."""
    from app.config import get_settings
    return not bool((get_settings().SMTP_HOST or "").strip())


def _check_cooldown(prev_expires_at: Optional[datetime]) -> None:
    """Raise 429 if the previous code was generated less than RESEND_COOLDOWN_SECONDS ago."""
    if not prev_expires_at:
        return
    # `prev_expires_at` is `now + CODE_TTL_SECONDS` from the previous send.
    # The previous send happened at `prev_expires_at - CODE_TTL_SECONDS`.
    issued_at = prev_expires_at - timedelta(seconds=CODE_TTL_SECONDS)
    elapsed = (datetime.now(timezone.utc) - issued_at).total_seconds()
    if elapsed < RESEND_COOLDOWN_SECONDS:
        wait = int(RESEND_COOLDOWN_SECONDS - elapsed)
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {wait}s before requesting another code",
        )


@router.post("/email/resend-verification")
async def resend_email_verification(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Send (or resend) a verification code to the current user's email."""
    if current_user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")
    if not current_user.email:
        raise HTTPException(status_code=400, detail="No email on file")

    _check_cooldown(current_user.verification_code_expires_at)

    expires = _expires_at()
    from app.services.phone_otp_service import OtpService, TWILIO_VERIFY_EMAIL_MARKER

    email = current_user.email.lower()
    otp_svc = OtpService()
    dispatch = await otp_svc.send_and_store_code(email, channel="email", purpose="email verification")
    code = dispatch.stored_code or _generate_code()
    current_user.verification_code = (
        TWILIO_VERIFY_EMAIL_MARKER if dispatch.verify_marker else dispatch.stored_code or code
    )
    current_user.verification_code_expires_at = expires
    db.add(current_user)
    await db.commit()

    extra = _otp_email_extra_fields(
        email_sent=dispatch.result.sent,
        email_configured=otp_svc.is_email_configured,
        code=code,
        log_tag="email-verify:dev",
        email=email,
        email_error=dispatch.result.user_message(
            fallback="Could not send verification email. Check the address and try again.",
        ),
    )

    return {
        "sent": True,
        "channel": "email",
        "to": _mask_email(email),
        "expires_at": expires.isoformat(),
        **extra,
    }


@router.post("/email/verify")
async def verify_email_code(
    payload: CodePayload,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm the code from /email/resend-verification and mark email verified."""
    if current_user.is_email_verified:
        return await _build_me_payload(current_user, db)

    from app.services.phone_otp_service import OtpService, is_twilio_email_verify_stored

    if current_user.verification_code_expires_at and current_user.verification_code_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code has expired")

    code_ok = False
    if is_twilio_email_verify_stored(current_user.verification_code) and current_user.email:
        check = await OtpService().verify_otp(current_user.email, payload.code, channel="email")
        code_ok = check.approved
    elif current_user.verification_code and current_user.verification_code == payload.code:
        code_ok = True

    if not code_ok:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    current_user.is_email_verified = True
    current_user.verification_code = None
    current_user.verification_code_expires_at = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return JSONResponse(content=await _build_me_payload(current_user, db))


@router.post("/email/request-change")
async def request_email_change(
    payload: EmailChangeRequestPayload,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a code to be sent to a NEW email address before swapping it on the account."""
    from app.core.security import verify_password

    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_email = payload.new_email.lower().strip()
    if new_email == (current_user.email or "").lower():
        raise HTTPException(status_code=400, detail="That is already your current email")

    existing = await db.execute(select(User).where(User.email == new_email, User.id != current_user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="That email is already in use")

    _check_cooldown(getattr(current_user, "email_change_expires_at", None))

    expires = _expires_at()
    from app.services.phone_otp_service import OtpService, TWILIO_VERIFY_EMAIL_MARKER

    otp_svc = OtpService()
    dispatch = await otp_svc.send_and_store_code(new_email, channel="email", purpose="email change")
    code = dispatch.stored_code or _generate_code()
    current_user.pending_email = new_email
    current_user.email_change_code = (
        TWILIO_VERIFY_EMAIL_MARKER if dispatch.verify_marker else dispatch.stored_code or code
    )
    current_user.email_change_expires_at = expires
    db.add(current_user)
    await db.commit()

    extra = _otp_email_extra_fields(
        email_sent=dispatch.result.sent,
        email_configured=otp_svc.is_email_configured,
        code=code,
        log_tag="email-change:dev",
        email=new_email,
        email_error=dispatch.result.user_message(
            fallback="Could not send verification email. Check the address and try again.",
        ),
    )

    return {
        "sent": True,
        "channel": "email",
        "to": _mask_email(new_email),
        "expires_at": expires.isoformat(),
        **extra,
    }


@router.post("/email/confirm-change")
async def confirm_email_change(
    payload: CodePayload,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm the email-change code and swap email = pending_email."""
    from app.services.phone_otp_service import OtpService, is_twilio_email_verify_stored

    if not current_user.pending_email or not current_user.email_change_code:
        raise HTTPException(status_code=400, detail="No email change in progress")
    if current_user.email_change_expires_at and current_user.email_change_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code has expired")

    code_ok = False
    if is_twilio_email_verify_stored(current_user.email_change_code):
        check = await OtpService().verify_otp(current_user.pending_email, payload.code, channel="email")
        code_ok = check.approved
    elif current_user.email_change_code == payload.code:
        code_ok = True

    if not code_ok:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    # Re-check uniqueness in case another user grabbed the email in the interim.
    dup = await db.execute(select(User).where(User.email == current_user.pending_email, User.id != current_user.id))
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="That email is already in use")

    current_user.email = current_user.pending_email
    current_user.is_email_verified = True
    current_user.pending_email = None
    current_user.email_change_code = None
    current_user.email_change_expires_at = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return JSONResponse(content=await _build_me_payload(current_user, db))


@router.post("/phone/send-otp")
async def send_phone_otp(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an OTP for the current user's phone (dev mode — code is returned in response)."""
    if not current_user.phone:
        raise HTTPException(status_code=400, detail="No phone number on file")
    if current_user.is_phone_verified:
        raise HTTPException(status_code=400, detail="Phone is already verified")

    _check_cooldown(current_user.verification_code_expires_at)

    expires = _expires_at()
    from app.services.phone_otp_service import OtpService, TWILIO_VERIFY_MARKER
    from app.services.sms_service import normalize_e164

    phone = normalize_e164(current_user.phone or "")
    otp_svc = OtpService()
    dispatch = await otp_svc.send_and_store_code(phone, channel="sms", purpose="phone verification")
    code = dispatch.stored_code or _generate_code()
    if dispatch.verify_marker:
        current_user.verification_code = TWILIO_VERIFY_MARKER
    else:
        current_user.verification_code = dispatch.stored_code or code
    current_user.verification_code_expires_at = expires
    db.add(current_user)
    await db.commit()

    extra = _otp_sms_extra_fields(
        sms_sent=dispatch.result.sent,
        sms_configured=otp_svc.is_sms_configured,
        code=code,
        log_tag="phone-otp:dev",
        phone=phone,
        sms_error=dispatch.result.user_message(
            fallback="Could not send SMS to this number. Check the number and try again.",
        ),
    )

    return {
        "sent": True,
        "channel": "phone",
        "to": _mask_phone(phone),
        "expires_at": expires.isoformat(),
        **extra,
    }


@router.post("/phone/verify-otp")
async def verify_phone_otp(
    payload: CodePayload,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm the phone OTP and mark phone as verified."""
    if current_user.is_phone_verified:
        return await _build_me_payload(current_user, db)

    from app.services.phone_otp_service import OtpService, is_twilio_verify_stored

    if current_user.verification_code_expires_at and current_user.verification_code_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code has expired")

    code_ok = False
    if is_twilio_verify_stored(current_user.verification_code) and current_user.phone:
        check = await OtpService().verify_otp(current_user.phone, payload.code, channel="sms")
        code_ok = check.approved
    elif current_user.verification_code and current_user.verification_code == payload.code:
        code_ok = True

    if not code_ok:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    current_user.is_phone_verified = True
    current_user.verification_code = None
    current_user.verification_code_expires_at = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return JSONResponse(content=await _build_me_payload(current_user, db))


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email or ""
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        return f"{local[0]}***@{domain}"
    return f"{local[0]}{'*' * max(1, len(local) - 2)}{local[-1]}@{domain}"


def _mask_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) <= 4:
        return phone or ""
    return f"{phone[:-4].replace(digits[-len(digits):-4], '*' * (len(digits) - 4))}{phone[-4:]}" if False else f"{'*' * (len(digits) - 4)}{digits[-4:]}"


def _generate_slug(business_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", business_name.lower()).strip("-")
    return slug[:80] or "store"


def _vendor_signup_phone_key(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def _require_valid_mobile(phone: str) -> str:
    from app.services.sms_service import normalize_e164, is_valid_e164

    normalized = normalize_e164(phone)
    if not is_valid_e164(normalized):
        raise HTTPException(
            status_code=422,
            detail="Enter a valid mobile number with country code (e.g. +919876543210)",
        )
    return normalized


def _otp_sms_extra_fields(
    *,
    sms_sent: bool,
    sms_configured: bool,
    code: str,
    log_tag: str,
    phone: str,
    sms_error: "str | None" = None,
) -> dict:
    """Build response extras after an OTP SMS attempt."""
    from app.services.otp_dispatch_helpers import otp_send_extra_fields
    from app.services.phone_otp_service import OtpSendResult

    return otp_send_extra_fields(
        OtpSendResult(
            sent=sms_sent,
            channel="phone",
            twilio_message=sms_error,
        ),
        code=code,
        log_tag=log_tag,
        destination=phone,
        channel="sms",
        configured=sms_configured,
        not_configured_detail="SMS service is not configured. Contact support.",
        send_error_fallback="Could not send SMS to this number. Check the number and try again.",
    )


def _otp_email_extra_fields(
    *,
    email_sent: bool,
    email_configured: bool,
    code: str,
    log_tag: str,
    email: str,
    email_error: "str | None" = None,
) -> dict:
    """Build response extras after an OTP email attempt."""
    from app.services.otp_dispatch_helpers import otp_send_extra_fields
    from app.services.phone_otp_service import OtpSendResult

    return otp_send_extra_fields(
        OtpSendResult(
            sent=email_sent,
            channel="email",
            twilio_message=email_error,
        ),
        code=code,
        log_tag=log_tag,
        destination=email,
        channel="email",
        configured=email_configured,
        not_configured_detail="Email service is not configured. Contact support.",
        send_error_fallback="Could not send verification email. Check the address and try again.",
    )


def _require_valid_email(email: str) -> str:
    from app.services.phone_otp_service import normalize_email, is_valid_email

    normalized = normalize_email(email)
    if not is_valid_email(normalized):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    return normalized


@router.post("/vendor-signup/check-contact")
async def vendor_signup_check_contact(body: VendorSignupContactCheck, db: AsyncSession = Depends(get_db)):
    """Return 400 if email or phone is already registered — call before sending OTP or creating account."""
    email = str(body.email).strip() if body.email else None
    phone = (body.phone or "").strip() or None
    if not email and not phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide an email and/or phone to check",
        )
    repo = UserRepository(db)
    if email and await repo.email_blocks_vendor_signup(email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if phone:
        key = _vendor_signup_phone_key(phone)
        if len(key) < 10:
            raise HTTPException(status_code=422, detail="Enter a valid phone number")
        if await repo.phone_blocks_vendor_signup(phone):
            raise HTTPException(status_code=400, detail="Phone number already registered")
    return {"available": True}


@router.post("/vendor-signup/send-phone-otp")
async def vendor_signup_send_phone_otp(body: VendorSignupPhoneOtpSend, db: AsyncSession = Depends(get_db)):
    """Send OTP via SMS before vendor self-signup when using phone as contact."""
    phone = _require_valid_mobile(body.phone or "")
    key = _vendor_signup_phone_key(phone)
    repo = UserRepository(db)
    if await repo.phone_blocks_vendor_signup(phone):
        raise HTTPException(status_code=400, detail="Phone number already registered")
    code = f"{secrets.randbelow(900000) + 100000}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    from app.services.phone_otp_service import OtpService

    otp_svc = OtpService()
    otp_result = await otp_svc.send_signup_otp(phone, code=code)
    extra = _otp_sms_extra_fields(
        sms_sent=otp_result.sent,
        sms_configured=otp_svc.is_sms_configured,
        code=code,
        log_tag="vendor-signup phone otp",
        phone=phone,
        sms_error=otp_result.user_message(
            fallback="Could not send SMS to this number. Check the number and try again.",
        ),
    )
    if otp_result.via_verify:
        await _vendor_signup_otp_set("phone", key, {"verify": True, "expires_at": expires})
    else:
        await _vendor_signup_otp_set("phone", key, {"code": code, "expires_at": expires})
    return {
        "sent": True,
        "channel": "phone",
        "to": _mask_phone(phone),
        "expires_at": expires.isoformat(),
        **extra,
    }


@router.post("/vendor-signup/send-email-otp")
async def vendor_signup_send_email_otp(body: VendorSignupEmailOtpSend, db: AsyncSession = Depends(get_db)):
    """Send OTP via email before vendor self-signup when using email as contact."""
    email = _require_valid_email(str(body.email))
    repo = UserRepository(db)
    if await repo.email_blocks_vendor_signup(email):
        raise HTTPException(status_code=400, detail="Email already registered")
    code = f"{secrets.randbelow(900000) + 100000}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    from app.services.phone_otp_service import OtpService

    otp_svc = OtpService()
    otp_result = await otp_svc.send_signup_email_otp(email, code=code)
    extra = _otp_email_extra_fields(
        email_sent=otp_result.sent,
        email_configured=otp_svc.is_email_configured,
        code=code,
        log_tag="vendor-signup email otp",
        email=email,
        email_error=otp_result.user_message(
            fallback="Could not send verification email. Check the address and try again.",
        ),
    )
    if otp_result.via_verify and otp_result.sent:
        await _vendor_signup_otp_set("email", email, {"verify": True, "expires_at": expires})
    else:
        await _vendor_signup_otp_set("email", email, {"code": code, "expires_at": expires})
    return {
        "sent": True,
        "channel": "email",
        "to": _mask_email(email),
        "expires_at": expires.isoformat(),
        **extra,
    }


@router.post("/vendor-signup", status_code=status.HTTP_201_CREATED)
async def vendor_signup(data: VendorSignupRequest, db: AsyncSession = Depends(get_db)):
    """
    Self-service vendor signup: creates user + vendor + sends verification code.
    Returns tokens so the user is immediately logged in.
    """
    email = str(data.email).strip() if data.email else None
    phone = (data.phone or "").strip() or None
    if not email and not phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either email or phone is required",
        )

    if phone:
        otp = (data.phone_otp or "").strip()
        if len(otp) != 6 or not otp.isdigit():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Enter the 6-digit OTP sent to your phone",
            )
        key = _vendor_signup_phone_key(phone)
        entry = await _vendor_signup_otp_get("phone", key)
        if not entry:
            raise HTTPException(status_code=400, detail="Invalid or expired phone OTP")
        exp = entry.get("expires_at")
        if exp and exp < datetime.now(timezone.utc):
            await _vendor_signup_otp_pop("phone", key)
            raise HTTPException(status_code=400, detail="Phone OTP has expired — request a new code")
        if entry.get("verify"):
            from app.services.phone_otp_service import PhoneOtpService

            check = await PhoneOtpService().verify_signup_otp(phone, otp)
            if not check.approved:
                raise HTTPException(status_code=400, detail="Invalid or expired phone OTP")
        elif entry.get("code") != otp:
            raise HTTPException(status_code=400, detail="Invalid or expired phone OTP")
        await _vendor_signup_otp_pop("phone", key)

    if email and not phone:
        otp = (data.email_otp or "").strip()
        if len(otp) != 6 or not otp.isdigit():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Enter the 6-digit OTP sent to your email",
            )
        email_key = email.lower()
        entry = await _vendor_signup_otp_get("email", email_key)
        if not entry:
            raise HTTPException(status_code=400, detail="Invalid or expired email OTP")
        exp = entry.get("expires_at")
        if exp and exp < datetime.now(timezone.utc):
            await _vendor_signup_otp_pop("email", email_key)
            raise HTTPException(status_code=400, detail="Email OTP has expired — request a new code")
        if entry.get("verify"):
            from app.services.phone_otp_service import OtpService

            check = await OtpService().verify_signup_email_otp(email_key, otp)
            if not check.approved:
                raise HTTPException(status_code=400, detail="Invalid or expired email OTP")
        elif entry.get("code") != otp:
            raise HTTPException(status_code=400, detail="Invalid or expired email OTP")
        await _vendor_signup_otp_pop("email", email_key)

    auth_service = AuthService(db)

    user_create = UserCreate(
        full_name=data.full_name,
        email=email,
        phone=phone,
        password=data.password,
    )
    user = await auth_service.register(user_create, commit=False)
    if phone:
        user.is_phone_verified = True
        db.add(user)
        await db.flush()
    if email and not phone:
        user.is_email_verified = True
        db.add(user)
        await db.flush()

    slug_base = _generate_slug(data.business_name)
    slug = slug_base

    from app.repositories.vendor_repo import VendorRepository
    vendor_repo = VendorRepository(db)
    counter = 0
    while await vendor_repo.slug_exists(slug):
        counter += 1
        slug = f"{slug_base}-{counter}"

    placeholder_email = (email or f"{slug}@phone-signup.kiterp.local")[:255]
    primary_phone_val = (phone or "-")[:20]

    from app.models.vendor import Vendor, VendorOwner
    from app.models.vendor_user import VendorUser

    vendor = Vendor(
        business_name=data.business_name,
        display_name=data.business_name,
        slug=slug,
        subdomain=slug,
        business_type=(data.business_category or "individual")[:50],
        offering_type="both",
        industry="retail",
        primary_email=placeholder_email,
        primary_phone=primary_phone_val,
        street_address="—",
        city="—",
        state="—",
        postal_code="000000",
        country="India",
    )
    db.add(vendor)
    await db.flush()

    try:
        owner = VendorOwner(
            vendor_id=vendor.id,
            user_id=user.id,
            full_name=data.full_name,
            email=placeholder_email,
            phone=phone,
            is_primary=True,
        )
        db.add(owner)
    except Exception:
        pass

    vendor_user = VendorUser(
        vendor_id=vendor.id,
        user_id=user.id,
        role="owner",
        permissions=[],
        is_active=True,
    )
    db.add(vendor_user)

    from app.models.store import Store
    from app.utils.store_codes import allocate_default_business_store_code

    await db.flush()
    store_code = await allocate_default_business_store_code(db, vendor.id)
    default_store = Store(
        vendor_id=vendor.id,
        name=(data.business_name or "")[:200] or "Main location",
        code=store_code,
        description=None,
        address={},
        is_default=True,
        is_active=True,
    )
    db.add(default_store)

    from app.services.finance.coa_seeder import get_or_create_default_fin_company

    await get_or_create_default_fin_company(db, vendor.id)

    auto_approved = apply_auto_approval_to_vendor_if_enabled(vendor)

    await db.commit()

    await event_emitter.emit(
        "vendor.registered",
        {"vendor_id": str(vendor.id), "user_id": str(user.id)},
    )
    if auto_approved:
        await event_emitter.emit(
            "vendor.approved",
            {"vendor_id": str(vendor.id), "admin_id": None},
        )

    verification_hint: Optional[str] = None
    if email and not phone:
        pass  # email verified via signup OTP
    elif email and phone and not user.is_email_verified:
        code = f"{secrets.randbelow(900000) + 100000}"
        _email_verification_codes[email.lower()] = {
            "code": code,
            "user_id": str(user.id),
        }
        if settings.DEBUG:
            verification_hint = code

    login_identifier = (email or phone or "").strip()
    tokens = await auth_service.login(login_identifier, data.password, vendor_id=vendor.id)

    msg = (
        f"Vendor created. Email verification code (dev): {verification_hint}"
        if verification_hint
        else "Vendor created. Phone verified via OTP."
    )
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "vendor_id": str(vendor.id),
        "vendor_slug": slug,
        "verification_code_hint": verification_hint,
        "message": msg,
    }


@router.post("/verify-email")
async def verify_email(data: EmailVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify email with the 6-digit code."""
    email = data.email.lower()
    entry = _email_verification_codes.get(email)
    code_ok = False
    if entry:
        if entry.get("verify"):
            from app.services.phone_otp_service import OtpService

            check = await OtpService().verify_otp(email, data.code, channel="email")
            code_ok = check.approved
        elif entry.get("code") == data.code:
            code_ok = True
    if not code_ok:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    await db.execute(
        update(User).where(User.email == data.email).values(is_email_verified=True)
    )
    await db.commit()

    _email_verification_codes.pop(email, None)

    return {"verified": True, "message": "Email verified successfully"}


class TwoFactorEnableRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


@router.post("/2fa/setup")
async def setup_2fa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a TOTP secret (not enabled until confirmed with /2fa/enable)."""
    from app.services.totp_service import generate_totp_secret, provisioning_uri

    secret = generate_totp_secret()
    current_user.totp_secret = secret
    current_user.is_2fa_enabled = False
    await db.commit()
    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri(secret, current_user.email or current_user.full_name),
    }


@router.post("/2fa/enable")
async def enable_2fa(
    body: TwoFactorEnableRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.totp_service import verify_totp

    if not current_user.totp_secret:
        raise HTTPException(400, "Call /auth/2fa/setup first")
    if not verify_totp(current_user.totp_secret, body.code):
        raise HTTPException(400, "Invalid authenticator code")
    current_user.is_2fa_enabled = True
    await db.commit()
    return {"enabled": True}


@router.post("/2fa/disable")
async def disable_2fa(
    body: TwoFactorEnableRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.totp_service import verify_totp

    if not current_user.totp_secret or not verify_totp(current_user.totp_secret, body.code):
        raise HTTPException(400, "Invalid authenticator code")
    current_user.is_2fa_enabled = False
    current_user.totp_secret = None
    await db.commit()
    return {"enabled": False}
