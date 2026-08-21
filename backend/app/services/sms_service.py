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
    63038: (
        "Twilio daily message limit reached (50/day on trial). "
        "Upgrade your Twilio account or wait until tomorrow."
    ),
    30044: (
        "SMS is too long for a Twilio trial account (trial allows only a short single-segment message). "
        "Shorten your template, remove emoji/special characters, or upgrade your Twilio account."
    ),
    21408: "SMS is not enabled for this region in your Twilio account.",
    20003: "Twilio authentication failed — check Account SID and Auth Token.",
    30004: (
        "SMS was blocked by the carrier or recipient (India DND/filtering is common). "
        "Try a verified number on a Twilio trial, or complete DLT registration for India domestic SMS."
    ),
}

# One GSM-7 segment; trial accounts often reject multi-segment bodies (Twilio error 30044).
SMS_GSM7_SEGMENT_LEN = 160
SMS_TRIAL_SAFE_LEN = 120


def twilio_sms_user_hint(error_code: int | None, twilio_message: str = "") -> str:
    if error_code and error_code in _TWILIO_USER_HINTS:
        return _TWILIO_USER_HINTS[error_code]
    msg = (twilio_message or "").strip()
    if error_code:
        return f"SMS delivery failed (Twilio error {error_code})."
    return msg or "SMS delivery failed."


def is_sms_length_trial_error(*, code: int | None = None, message: str = "") -> bool:
    if code == 30044:
        return True
    lower = (message or "").lower()
    return "30044" in lower or "trial message length" in lower or "maximum length" in lower


def normalize_sms_gsm7(text: str) -> str:
    """Collapse whitespace and replace common non-GSM characters for trial-safe SMS."""
    raw = (text or "").strip().replace("\r\n", "\n").replace("\n", " ")
    for src, dst in (("₹", "Rs"), ("—", "-"), ("–", "-"), ("…", "..."), ("👉", "")):
        raw = raw.replace(src, dst)
    ascii_chars: list[str] = []
    for ch in raw:
        if ord(ch) <= 127:
            ascii_chars.append(ch)
        elif ch.isspace():
            ascii_chars.append(" ")
    return " ".join("".join(ascii_chars).split())


def truncate_sms_body(text: str, max_len: int = SMS_GSM7_SEGMENT_LEN) -> str:
    cleaned = normalize_sms_gsm7(text)
    if len(cleaned) <= max_len:
        return cleaned
    if max_len <= 3:
        return cleaned[:max_len]
    return cleaned[: max_len - 3].rstrip() + "..."


def sms_attempt_bodies(body: str, *, compact_len: int = SMS_TRIAL_SAFE_LEN) -> list[str]:
    """Primary body plus a shorter fallback for Twilio trial length limits."""
    primary = (body or "").strip()
    if not primary:
        return [""]
    bodies = [primary]
    compact = truncate_sms_body(primary, compact_len)
    if compact.strip() and compact.strip() != primary:
        bodies.append(compact)
    return bodies


def sms_delivery_unconfirmed_hint(to_phone: str = "") -> str:
    """User-facing hint when Twilio queued SMS but delivery was not confirmed."""
    parts = [
        "Twilio accepted the SMS but it was not confirmed as delivered to the phone.",
        "On a Twilio trial account, verify the recipient under Phone Numbers → Verified Caller IDs.",
    ]
    normalized = normalize_e164(to_phone)
    if normalized.startswith("+91"):
        parts.append(
            "For India (+91): enable Messaging → Geo permissions for India in Twilio Console. "
            "Domestic India SMS also requires DLT sender/template registration."
        )
    parts.append("Check Twilio Console → Messaging → Logs for the message status.")
    return " ".join(parts)


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
    """Strip formatting and ensure E.164 for Twilio (+country + number)."""
    raw = (phone or "").strip()
    if not raw or raw in {"-", "—", "N/A", "n/a", "NA"}:
        return ""
    cleaned = re.sub(r"[\s\-().]", "", raw)
    if not cleaned:
        return ""
    # Indian local 10-digit mobile (6–9…) → +91…
    if re.fullmatch(r"[6-9]\d{9}", cleaned):
        return f"+91{cleaned}"
    if cleaned.startswith("91") and len(cleaned) == 12 and cleaned[2] in "6789":
        return f"+{cleaned}"
    if not cleaned.startswith("+"):
        cleaned = f"+{cleaned.lstrip('+')}"
    return cleaned


def is_valid_e164(phone: str) -> bool:
    normalized = normalize_e164(phone)
    digits = re.sub(r"\D", "", normalized)
    return normalized.startswith("+") and 10 <= len(digits) <= 15


def format_public_phone(phone: Optional[str]) -> Optional[str]:
    """Display phone with country code, e.g. '+91 9441757900'."""
    raw = (phone or "").strip()
    if not raw:
        return None
    e164 = normalize_e164(raw)
    if not e164:
        return raw
    digits = re.sub(r"\D", "", e164)
    if e164.startswith("+91") and len(digits) == 12:
        return f"+91 {e164[3:]}"
    return e164


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
