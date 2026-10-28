"""Mobile OTP gate before integration secrets can be viewed or saved.

The code is sent to the mobile already stored on the business account
(vendor.primary_phone, otherwise the owner's login phone). It is delivered
by the platform SMS sender, not by the vendor integration being edited.
A short-lived grant is issued only after the code matches.
"""
from __future__ import annotations

import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.config import settings
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.services.otp_dispatch_helpers import otp_send_extra_fields
from app.services.phone_otp_service import OtpService, generate_otp_code
from app.services.sms_service import is_valid_e164, normalize_e164

OTP_REQUIRED_DETAIL = (
    "Enter the mobile code sent to this business account to continue."
)


def read_integration_otp_grant(
    x_integration_otp_grant: Optional[str] = Header(default=None),
    otp_grant: Optional[str] = Query(default=None),
) -> Optional[str]:
    """Grant from the header or the otp_grant query, so a proxy cannot drop it."""
    return (x_integration_otp_grant or otp_grant or "").strip() or None
NO_PHONE_DETAIL = (
    "Add a mobile number on this business account under Profile → Contact Information "
    "before changing provider credentials."
)

OTP_TTL = timedelta(minutes=10)
GRANT_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=45)
MAX_ATTEMPTS = 5


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _digest(value: str) -> str:
    return hashlib.sha256(value.strip().encode("utf-8")).hexdigest()


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def mask_business_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) <= 4:
        return "••••"
    return f"{'•' * (len(digits) - 4)}{digits[-4:]}"


def code_matches(state: dict[str, Any], code: str, now: Optional[datetime] = None) -> bool:
    now = now or _now()
    expires = _parse_dt(state.get("expires_at"))
    if not expires or expires < now:
        return False
    if state.get("via_verify"):
        return False
    stored = state.get("code_hash")
    if not stored or not (code or "").strip():
        return False
    return hmac.compare_digest(str(stored), _digest(code))


def grant_matches(state: dict[str, Any], grant: Optional[str], now: Optional[datetime] = None) -> bool:
    now = now or _now()
    expires = _parse_dt(state.get("grant_expires_at"))
    stored = state.get("grant_hash")
    if not expires or expires < now or not stored or not (grant or "").strip():
        return False
    return hmac.compare_digest(str(stored), _digest(grant or ""))


def _state_of(vendor: Vendor) -> dict[str, Any]:
    raw = getattr(vendor, "integration_otp_state", None) or {}
    return dict(raw) if isinstance(raw, dict) else {}


def _save_state(vendor: Vendor, state: dict[str, Any]) -> None:
    vendor.integration_otp_state = state
    flag_modified(vendor, "integration_otp_state")


async def resolve_business_otp_phone(db: AsyncSession, vendor_id: UUID) -> str:
    """Phone already on the business account. Never the number typed into a provider form."""
    vendor = await db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    candidates: list[str] = []
    if vendor.primary_phone:
        candidates.append(vendor.primary_phone)

    result = await db.execute(
        select(User.phone)
        .join(VendorUser, VendorUser.user_id == User.id)
        .where(
            VendorUser.vendor_id == vendor_id,
            VendorUser.role == "owner",
            VendorUser.is_active.is_(True),
        )
    )
    for phone in result.scalars().all():
        if phone:
            candidates.append(phone)

    for raw in candidates:
        normalized = normalize_e164(raw)
        if is_valid_e164(normalized):
            return normalized

    raise HTTPException(status_code=400, detail=NO_PHONE_DETAIL)


async def send_integration_credential_otp(db: AsyncSession, vendor_id: UUID) -> dict[str, Any]:
    vendor = await db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    phone = await resolve_business_otp_phone(db, vendor_id)
    now = _now()
    previous = _state_of(vendor)
    sent_at = _parse_dt(previous.get("sent_at"))
    if sent_at and now - sent_at < RESEND_COOLDOWN:
        raise HTTPException(
            status_code=429,
            detail="Wait a moment before requesting another code.",
        )

    # Platform sender only. Passing vendor_id would text through the integration being changed.
    otp_svc = OtpService()
    dispatch = await otp_svc.send_and_store_code(
        phone,
        channel="sms",
        purpose="integration credentials",
    )
    via_verify = bool(dispatch.verify_marker)
    code_for_store: Optional[str] = None
    if dispatch.result.sent and not via_verify:
        code_for_store = dispatch.stored_code
    elif not dispatch.result.sent:
        extra = otp_send_extra_fields(
            dispatch.result,
            code=dispatch.stored_code or generate_otp_code(),
            log_tag="integration-otp",
            destination=phone,
            channel="sms",
            configured=otp_svc.is_sms_configured,
            not_configured_detail="SMS service is not configured. Contact support.",
            send_error_fallback="Could not send the code to this business mobile number. Try again.",
        )
        code_for_store = extra.get("dev_hint")

    if not via_verify and not code_for_store:
        raise HTTPException(status_code=503, detail="Could not send the code to this business mobile number. Try again.")

    expires = now + OTP_TTL
    _save_state(vendor, {
        "phone": phone,
        "code_hash": _digest(code_for_store) if code_for_store else None,
        "via_verify": via_verify,
        "expires_at": expires.isoformat(),
        "sent_at": now.isoformat(),
        "attempts": 0,
        "grant_hash": None,
        "grant_expires_at": None,
    })
    await db.commit()

    payload: dict[str, Any] = {
        "sent": True,
        "to": mask_business_phone(phone),
        "expires_at": expires.isoformat(),
        "channel": "phone",
    }
    if not dispatch.result.sent and code_for_store and settings.DEBUG:
        payload["dev_hint"] = code_for_store
    return payload


async def verify_integration_credential_otp(
    db: AsyncSession,
    vendor_id: UUID,
    code: str,
) -> dict[str, Any]:
    import secrets

    vendor = await db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    state = _state_of(vendor)
    now = _now()
    expires = _parse_dt(state.get("expires_at"))
    if not expires or expires < now or not state.get("phone"):
        raise HTTPException(status_code=400, detail="Code has expired. Request a new one.")

    attempts = int(state.get("attempts") or 0)
    if attempts >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new OTP.")

    submitted = (code or "").strip()
    approved = False
    if state.get("via_verify"):
        check = await OtpService().verify_otp(state["phone"], submitted, channel="sms")
        approved = check.approved
    else:
        approved = code_matches(state, submitted, now)

    if not approved:
        state["attempts"] = attempts + 1
        _save_state(vendor, state)
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code")

    grant = secrets.token_urlsafe(32)
    grant_expires = now + GRANT_TTL
    state["code_hash"] = None
    state["via_verify"] = False
    state["attempts"] = 0
    state["grant_hash"] = _digest(grant)
    state["grant_expires_at"] = grant_expires.isoformat()
    _save_state(vendor, state)
    await db.commit()
    return {"grant": grant, "expires_at": grant_expires.isoformat()}


async def assert_integration_otp_grant(
    db: AsyncSession,
    vendor_id: UUID,
    grant: Optional[str],
) -> None:
    vendor = await db.get(Vendor, vendor_id)
    state = _state_of(vendor) if vendor else {}
    if not grant_matches(state, grant):
        raise HTTPException(status_code=403, detail=OTP_REQUIRED_DETAIL)


async def consume_integration_otp_grant(db: AsyncSession, vendor_id: UUID) -> None:
    """Drop the grant so the next sensitive save must confirm a new code."""
    vendor = await db.get(Vendor, vendor_id)
    if not vendor:
        return
    state = _state_of(vendor)
    state["grant_hash"] = None
    state["grant_expires_at"] = None
    _save_state(vendor, state)
