"""Phone OTP — Twilio Verify (preferred) or Programmable SMS fallback."""
from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from typing import Optional

import httpx

from app.config import settings
from app.services.sms_service import SmsService, normalize_e164, is_valid_e164

log = logging.getLogger(__name__)

VERIFY_API = "https://verify.twilio.com/v2"

# Stored in DB when Twilio Verify owns the code (not our generated digits).
TWILIO_VERIFY_MARKER = "__twilio_verify__"
DOMAIN_OFF_VERIFY_MARKER = "domain-off:__twilio_verify__"
BOOKING_VERIFY_MARKER = TWILIO_VERIFY_MARKER


@dataclass
class OtpSendResult:
    sent: bool
    channel: str = "phone"
    via_verify: bool = False
    twilio_code: Optional[int] = None
    twilio_message: Optional[str] = None

    def user_message(self, *, fallback: str) -> str:
        if self.twilio_code == 20008:
            return (
                "Twilio Test Credentials are in .env — replace with Live Account SID and "
                "Auth Token from the Twilio Console dashboard (not the Test Credentials tab)."
            )
        if self.twilio_code == 21608:
            return (
                "On a Twilio trial account, verify the recipient number under "
                "Phone Numbers → Verified Caller IDs, or upgrade your Twilio account."
            )
        if self.twilio_message and settings.DEBUG:
            return f"{fallback} (Twilio: {self.twilio_message})"
        return fallback


@dataclass
class OtpVerifyResult:
    approved: bool
    twilio_message: Optional[str] = None


@dataclass
class OtpDispatch:
    """Result of send_and_store_code — what to persist and whether send succeeded."""
    result: OtpSendResult
    stored_code: Optional[str] = None  # None = do not store; use TWILIO_VERIFY_MARKER separately

    @property
    def verify_marker(self) -> bool:
        return self.result.sent and self.result.via_verify


def generate_otp_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def is_twilio_verify_stored(code: Optional[str]) -> bool:
    return code in (TWILIO_VERIFY_MARKER, DOMAIN_OFF_VERIFY_MARKER)


class PhoneOtpService:
    def __init__(self) -> None:
        self.account_sid = (settings.TWILIO_ACCOUNT_SID or "").strip()
        self.auth_token = (settings.TWILIO_AUTH_TOKEN or "").strip()
        self.verify_service_sid = (settings.TWILIO_VERIFY_SERVICE_SID or "").strip()
        self.sms = SmsService()

    @property
    def uses_verify(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.verify_service_sid)

    @property
    def uses_sms(self) -> bool:
        return self.sms.is_configured

    @property
    def is_configured(self) -> bool:
        return self.uses_verify or self.uses_sms

    def _auth(self) -> tuple[str, str]:
        return self.account_sid, self.auth_token

    def _parse_twilio_error(self, resp: httpx.Response) -> tuple[Optional[int], Optional[str]]:
        try:
            payload = resp.json()
            return payload.get("code"), payload.get("message")
        except Exception:
            return None, resp.text[:200]

    async def send_otp(self, phone: str, *, purpose: str, code: str) -> OtpSendResult:
        phone = normalize_e164(phone)
        if not is_valid_e164(phone):
            return OtpSendResult(sent=False, twilio_message="Invalid phone number")

        if self.uses_verify:
            return await self._send_via_verify(phone)

        if self.uses_sms:
            sms_result = await self.sms.send_otp(phone, code, purpose=purpose)
            return OtpSendResult(
                sent=sms_result.sent,
                via_verify=False,
                twilio_code=sms_result.twilio_code,
                twilio_message=sms_result.twilio_message,
            )

        return OtpSendResult(sent=False)

    async def send_and_store_code(self, phone: str, *, purpose: str) -> OtpDispatch:
        """Send OTP and return what to store in verification_code / completion_otp."""
        code = generate_otp_code()
        result = await self.send_otp(phone, purpose=purpose, code=code)
        if result.sent and result.via_verify:
            return OtpDispatch(result=result, stored_code=None)
        if result.sent:
            return OtpDispatch(result=result, stored_code=code)
        return OtpDispatch(result=result, stored_code=None)

    async def _send_via_verify(self, phone: str) -> OtpSendResult:
        url = f"{VERIFY_API}/Services/{self.verify_service_sid}/Verifications"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    url,
                    data={"To": phone, "Channel": "sms"},
                    auth=self._auth(),
                )
            if resp.status_code >= 400:
                code, message = self._parse_twilio_error(resp)
                log.error("Twilio Verify send failed (%s): %s", resp.status_code, resp.text)
                return OtpSendResult(sent=False, via_verify=True, twilio_code=code, twilio_message=message)
            log.info("Twilio Verify OTP sent to %s", phone[-4:].rjust(len(phone), "*"))
            return OtpSendResult(sent=True, via_verify=True)
        except Exception:
            log.exception("Twilio Verify send error for %s", phone)
            return OtpSendResult(sent=False, via_verify=True, twilio_message="Network error contacting Twilio")

    async def verify_otp(self, phone: str, code: str) -> OtpVerifyResult:
        phone = normalize_e164(phone)
        if not self.uses_verify:
            return OtpVerifyResult(approved=False, twilio_message="Verify not configured")

        url = f"{VERIFY_API}/Services/{self.verify_service_sid}/VerificationCheck"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    url,
                    data={"To": phone, "Code": code.strip()},
                    auth=self._auth(),
                )
            if resp.status_code >= 400:
                _, message = self._parse_twilio_error(resp)
                log.error("Twilio Verify check failed (%s): %s", resp.status_code, resp.text)
                return OtpVerifyResult(approved=False, twilio_message=message)
            status = (resp.json().get("status") or "").lower()
            return OtpVerifyResult(approved=status == "approved")
        except Exception:
            log.exception("Twilio Verify check error for %s", phone)
            return OtpVerifyResult(approved=False, twilio_message="Network error contacting Twilio")

    # Back-compat aliases used by vendor signup
    async def send_signup_otp(self, phone: str, *, code: str) -> OtpSendResult:
        return await self.send_otp(phone, purpose="vendor signup", code=code)

    async def verify_signup_otp(self, phone: str, code: str) -> OtpVerifyResult:
        return await self.verify_otp(phone, code)
