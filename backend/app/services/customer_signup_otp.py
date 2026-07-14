"""Pre-registration OTP for storefront customer signup (per vendor + business unit)."""
from __future__ import annotations

import json
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_memory_otp: dict[str, dict] = {}

_OTP_PREFIX = "kiterp:customer_signup:"
_OTP_TTL_SEC = 600


def _scope(vendor_id: UUID, store_id: Optional[UUID]) -> str:
    return f"v:{vendor_id}:s:{store_id or 'all'}"


def _redis_key(vendor_id: UUID, store_id: Optional[UUID], channel: str, contact_key: str) -> str:
    return f"{_OTP_PREFIX}{_scope(vendor_id, store_id)}:{channel}:{contact_key}"


def phone_key(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def email_key(email: str) -> str:
    return (email or "").strip().lower()


def _serialize(entry: dict) -> str:
    payload = dict(entry)
    exp = payload.get("expires_at")
    if isinstance(exp, datetime):
        payload["expires_at"] = exp.isoformat()
    return json.dumps(payload)


def _deserialize(raw: str) -> dict:
    data = json.loads(raw)
    exp = data.get("expires_at")
    if isinstance(exp, str):
        data["expires_at"] = datetime.fromisoformat(exp.replace("Z", "+00:00"))
    return data


async def otp_set(
    vendor_id: UUID,
    store_id: Optional[UUID],
    channel: str,
    contact_key: str,
    entry: dict,
) -> None:
    from app.database import redis_client

    key = _redis_key(vendor_id, store_id, channel, contact_key)
    if redis_client:
        try:
            await redis_client.setex(key, _OTP_TTL_SEC, _serialize(entry))
        except Exception as e:
            logger.warning("Redis customer-signup OTP set failed: %s", e)
    _memory_otp[key] = entry


async def otp_get(
    vendor_id: UUID,
    store_id: Optional[UUID],
    channel: str,
    contact_key: str,
) -> dict | None:
    from app.database import redis_client

    key = _redis_key(vendor_id, store_id, channel, contact_key)
    if redis_client:
        try:
            raw = await redis_client.get(key)
            if raw:
                return _deserialize(raw)
        except Exception as e:
            logger.warning("Redis customer-signup OTP get failed: %s", e)
    return _memory_otp.get(key)


async def otp_pop(
    vendor_id: UUID,
    store_id: Optional[UUID],
    channel: str,
    contact_key: str,
) -> None:
    from app.database import redis_client

    key = _redis_key(vendor_id, store_id, channel, contact_key)
    if redis_client:
        try:
            await redis_client.delete(key)
        except Exception as e:
            logger.warning("Redis customer-signup OTP delete failed: %s", e)
    _memory_otp.pop(key, None)


def generate_code() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def mask_email(email: str) -> str:
    local, _, domain = (email or "").partition("@")
    if not domain:
        return email or ""
    if len(local) <= 2:
        return f"{local[0] if local else '*'}***@{domain}"
    return f"{local[0]}{'*' * max(1, len(local) - 2)}{local[-1]}@{domain}"


def mask_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) <= 4:
        return phone or ""
    return f"{'*' * (len(digits) - 4)}{digits[-4:]}"


async def send_customer_signup_otp(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    store_id: Optional[UUID],
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> dict:
    """Send a 6-digit OTP to email or phone before customer registration."""
    from app.services.otp_dispatch_helpers import otp_send_extra_fields
    from app.services.phone_otp_service import OtpService
    from app.services.sms_service import normalize_e164, is_valid_e164

    email_norm = email_key(email) if email else ""
    phone_norm = ""
    if phone:
        phone_norm = normalize_e164(phone)
        if not is_valid_e164(phone_norm):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Enter a valid mobile number with country code (e.g. +919876543210)",
            )

    if email_norm and "@" not in email_norm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address",
        )
    if not email_norm and not phone_norm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide an email or phone number to receive the OTP",
        )

    # Prefer email when both are provided (SendGrid on prod; SMS needs Twilio).
    channel = "email" if email_norm else "phone"
    destination = email_norm if channel == "email" else phone_norm
    contact = email_norm if channel == "email" else phone_key(phone_norm)

    code = generate_code()
    expires = datetime.now(timezone.utc) + timedelta(seconds=_OTP_TTL_SEC)
    otp_svc = OtpService()

    if channel == "email":
        otp_result = await otp_svc.send_otp(
            destination, channel="email", purpose="customer signup", code=code,
        )
        configured = await otp_svc.is_email_configured_with_vendor(db, vendor_id)
        extra = otp_send_extra_fields(
            otp_result,
            code=code,
            log_tag="customer-signup email otp",
            destination=destination,
            channel="email",
            configured=configured,
            not_configured_detail="Email service is not configured. Contact the store for help.",
            send_error_fallback="Could not send verification email. Check the address and try again.",
        )
    else:
        otp_result = await otp_svc.send_otp(
            destination, channel="sms", purpose="customer signup", code=code,
        )
        configured = await otp_svc.is_sms_configured_with_vendor(db, vendor_id)
        extra = otp_send_extra_fields(
            otp_result,
            code=code,
            log_tag="customer-signup phone otp",
            destination=destination,
            channel="sms",
            configured=configured,
            not_configured_detail="SMS service is not configured. Contact the store for help.",
            send_error_fallback="Could not send SMS to this number. Check the number and try again.",
        )

    if otp_result.via_verify and otp_result.sent:
        await otp_set(vendor_id, store_id, channel, contact, {"verify": True, "expires_at": expires})
    else:
        await otp_set(vendor_id, store_id, channel, contact, {"code": code, "expires_at": expires})

    return {
        "sent": True,
        "channel": channel,
        "to": mask_email(destination) if channel == "email" else mask_phone(destination),
        "expires_at": expires.isoformat(),
        **extra,
    }


async def verify_customer_signup_otp(
    *,
    vendor_id: UUID,
    store_id: Optional[UUID],
    email: Optional[str],
    phone: Optional[str],
    code: str,
) -> None:
    """Validate and consume the signup OTP for this vendor/BU contact."""
    from app.services.phone_otp_service import OtpService
    from app.services.sms_service import normalize_e164

    otp = (code or "").strip()
    if len(otp) != 6 or not otp.isdigit():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter the 6-digit OTP sent to your email or phone",
        )

    candidates: list[tuple[str, str, str]] = []
    if email:
        ek = email_key(email)
        if ek:
            candidates.append(("email", ek, ek))
    if phone:
        phone_norm = normalize_e164(phone)
        pk = phone_key(phone_norm)
        if len(pk) >= 10:
            candidates.append(("phone", pk, phone_norm))

    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email or phone is required",
        )

    now = datetime.now(timezone.utc)
    last_detail = "Invalid or expired OTP. Request a new code and try again."

    for channel, contact, destination in candidates:
        entry = await otp_get(vendor_id, store_id, channel, contact)
        if not entry:
            continue
        exp = entry.get("expires_at")
        if exp and exp < now:
            await otp_pop(vendor_id, store_id, channel, contact)
            last_detail = "OTP has expired — request a new code"
            continue

        if entry.get("verify"):
            check = await OtpService().verify_otp(
                destination, otp, channel=("email" if channel == "email" else "sms"),
            )
            if not check.approved:
                last_detail = "Invalid or expired OTP"
                continue
        elif entry.get("code") != otp:
            last_detail = "Invalid or expired OTP"
            continue

        await otp_pop(vendor_id, store_id, channel, contact)
        return

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=last_detail)
