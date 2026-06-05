"""SMS delivery — Twilio when configured, otherwise no-op (dev mode)."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from app.config import settings

log = logging.getLogger(__name__)

TWILIO_API = "https://api.twilio.com/2010-04-01"

# Twilio error code → user-facing hint (no secrets)
_TWILIO_USER_HINTS: dict[int, str] = {
    21211: "The mobile number format is invalid.",
    21606: (
        "Your Twilio sender number cannot send SMS to this country. "
        "In Twilio Console: use an SMS-capable number you own, and enable "
        "Messaging → Geo permissions for the destination (e.g. India)."
    ),
    21608: (
        "On a Twilio trial account, verify the recipient number under "
        "Phone Numbers → Verified Caller IDs."
    ),
    21408: "SMS is not enabled for this region in your Twilio account.",
    20003: "Twilio authentication failed — check Account SID and Auth Token.",
}


@dataclass
class SmsResult:
    sent: bool
    twilio_code: Optional[int] = None
    twilio_message: Optional[str] = None

    def user_message(self, *, fallback: str) -> str:
        if self.twilio_code and self.twilio_code in _TWILIO_USER_HINTS:
            return _TWILIO_USER_HINTS[self.twilio_code]
        if settings.DEBUG and self.twilio_message:
            return f"{fallback} (Twilio: {self.twilio_message})"
        return fallback


def normalize_e164(phone: str) -> str:
    """Strip formatting and ensure a leading + for Twilio E.164."""
    raw = (phone or "").strip()
    if not raw:
        return ""
    cleaned = re.sub(r"[\s\-().]", "", raw)
    if not cleaned.startswith("+"):
        cleaned = f"+{cleaned.lstrip('+')}"
    return cleaned


def is_valid_e164(phone: str) -> bool:
    normalized = normalize_e164(phone)
    digits = re.sub(r"\D", "", normalized)
    return normalized.startswith("+") and 10 <= len(digits) <= 15


class SmsService:
    def __init__(self) -> None:
        self.account_sid = (settings.TWILIO_ACCOUNT_SID or "").strip()
        self.auth_token = (settings.TWILIO_AUTH_TOKEN or "").strip()
        self.from_number = normalize_e164(settings.TWILIO_FROM_NUMBER or "")

    @property
    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.from_number)

    async def send_sms(self, to: str, body: str) -> SmsResult:
        if not self.is_configured:
            return SmsResult(sent=False)
        to = normalize_e164(to)
        if not is_valid_e164(to):
            log.warning("SMS skipped — invalid destination: %s", to[-4:] if to else "")
            return SmsResult(sent=False, twilio_message="Invalid destination phone number")
        url = f"{TWILIO_API}/Accounts/{self.account_sid}/Messages.json"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    url,
                    data={"To": to, "From": self.from_number, "Body": body},
                    auth=(self.account_sid, self.auth_token),
                )
            if resp.status_code >= 400:
                twilio_code: Optional[int] = None
                twilio_message: Optional[str] = None
                try:
                    payload = resp.json()
                    twilio_code = payload.get("code")
                    twilio_message = payload.get("message")
                except Exception:
                    twilio_message = resp.text[:200]
                log.error("Twilio SMS failed (%s): %s", resp.status_code, resp.text)
                return SmsResult(sent=False, twilio_code=twilio_code, twilio_message=twilio_message)
            log.info("SMS sent to %s", to[-4:].rjust(len(to), "*") if len(to) > 4 else "****")
            return SmsResult(sent=True)
        except Exception:
            log.exception("Twilio SMS error for %s", to)
            return SmsResult(sent=False, twilio_message="Network error contacting Twilio")

    async def send_otp(self, phone: str, code: str, *, purpose: str = "verification") -> SmsResult:
        body = f"Your KITERP {purpose} code is {code}. It expires in 10 minutes."
        return await self.send_sms(phone, body)
