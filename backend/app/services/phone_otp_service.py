"""OTP delivery — Twilio Verify (SMS + email) with SMS/SMTP fallbacks."""
from __future__ import annotations

import json
import logging
import re
import secrets
from dataclasses import dataclass
from typing import Literal, Optional

import httpx

from app.config import settings
from app.services.sms_service import SmsService, normalize_e164, is_valid_e164

log = logging.getLogger(__name__)

VERIFY_API = "https://verify.twilio.com/v2"
OtpChannel = Literal["sms", "email"]

# Stored in DB when Twilio Verify owns the code (not our generated digits).
TWILIO_VERIFY_MARKER = "__twilio_verify__"
TWILIO_VERIFY_EMAIL_MARKER = "__twilio_verify_email__"
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
        if self.twilio_code == 60223:
            return (
                "Twilio Verify email channel is disabled. In Twilio Console → Verify → Services → "
                "open your Verify Service (VA...) → Email tab → select your SendGrid integration (kiterp), "
                "then Save. The integration alone is not enough — it must be linked to the service."
            )
        if self.twilio_code == 60205:
            return (
                "Twilio Verify SMS channel is disabled. In Twilio Console → Verify → Services → "
                "open your Verify Service (VA...) → SMS tab → enable SMS, then Save."
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
    stored_code: Optional[str] = None

    @property
    def verify_marker(self) -> bool:
        return self.result.sent and self.result.via_verify


def generate_otp_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def is_valid_email(email: str) -> bool:
    e = normalize_email(email)
    return bool(e) and "@" in e and len(e) <= 254


def is_twilio_verify_stored(code: Optional[str]) -> bool:
    return code in (TWILIO_VERIFY_MARKER, DOMAIN_OFF_VERIFY_MARKER)


def is_twilio_email_verify_stored(code: Optional[str]) -> bool:
    return code == TWILIO_VERIFY_EMAIL_MARKER


def verify_marker_for_channel(channel: OtpChannel) -> str:
    return TWILIO_VERIFY_EMAIL_MARKER if channel == "email" else TWILIO_VERIFY_MARKER


class OtpService:
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
    def is_sms_configured(self) -> bool:
        return self.uses_verify or self.uses_sms

    @property
    def is_email_configured(self) -> bool:
        return self.uses_verify or self.uses_smtp_email

    @property
    def is_configured(self) -> bool:
        return self.is_sms_configured or self.is_email_configured

    def _auth(self) -> tuple[str, str]:
        return self.account_sid, self.auth_token

    def _parse_twilio_error(self, resp: httpx.Response) -> tuple[Optional[int], Optional[str]]:
        try:
            payload = resp.json()
            return payload.get("code"), payload.get("message")
        except Exception:
            return None, resp.text[:200]

    @property
    def uses_app_email(self) -> bool:
        from app.services.email_service import sendgrid_api_key

        return bool((settings.SMTP_HOST or "").strip()) or bool(sendgrid_api_key())

    @property
    def uses_smtp_email(self) -> bool:
        return self.uses_app_email

    def _email_purpose_key(self, purpose: str) -> str:
        p = purpose.lower()
        if "reset" in p or "password" in p:
            return "reset"
        if "change" in p:
            return "change"
        return "verify"

    async def _send_email_smtp(self, to: str, code: str, *, purpose: str) -> OtpSendResult:
        from app.services.email_service import send_verification_code_email

        sent = await send_verification_code_email(to, code, purpose=self._email_purpose_key(purpose))
        return OtpSendResult(sent=sent, channel="email", via_verify=False)

    async def send_otp(
        self,
        to: str,
        *,
        channel: OtpChannel,
        purpose: str,
        code: str,
    ) -> OtpSendResult:
        if channel == "email":
            to = normalize_email(to)
            if not is_valid_email(to):
                return OtpSendResult(sent=False, channel="email", twilio_message="Invalid email address")
            # Prefer app-controlled email (SMTP/SendGrid) so we set subject + template.
            # Twilio Verify email uses the SendGrid integration template and often ships with no subject.
            if self.uses_app_email:
                app_result = await self._send_email_smtp(to, code, purpose=purpose)
                if app_result.sent:
                    return app_result
                log.warning(
                    "App email OTP send failed for %s; falling back to Twilio Verify. "
                    "Regenerate SENDGRID_API_KEY in backend/.env for emails with a subject line.",
                    re.sub(r"(^.).+(@.+$)", r"\1***\2", to),
                )
            if self.uses_verify:
                verify_result = await self._send_via_verify(to, channel="email")
                if verify_result.sent:
                    return verify_result
                if self.uses_app_email:
                    log.warning(
                        "Twilio Verify email failed for %s: %s",
                        re.sub(r"(^.).+(@.+$)", r"\1***\2", to),
                        verify_result.twilio_message,
                    )
                return verify_result
            return OtpSendResult(sent=False, channel="email", twilio_message="Email delivery not configured")

        to = normalize_e164(to)
        if not is_valid_e164(to):
            return OtpSendResult(sent=False, channel="phone", twilio_message="Invalid phone number")
        if self.uses_verify:
            verify_result = await self._send_via_verify(to, channel="sms")
            if verify_result.sent:
                return verify_result
            log.warning(
                "Twilio Verify SMS failed for %s: %s — trying direct SMS fallback",
                to[-4:].rjust(len(to), "*"),
                verify_result.twilio_message,
            )
        if self.uses_sms:
            sms_result = await self.sms.send_otp(to, code, purpose=purpose)
            return OtpSendResult(
                sent=sms_result.sent,
                channel="phone",
                via_verify=False,
                twilio_code=sms_result.twilio_code,
                twilio_message=sms_result.twilio_message,
            )
        return OtpSendResult(sent=False, channel="phone")

    async def send_and_store_code(self, to: str, *, channel: OtpChannel, purpose: str) -> OtpDispatch:
        code = generate_otp_code()
        result = await self.send_otp(to, channel=channel, purpose=purpose, code=code)
        if result.sent and result.via_verify:
            return OtpDispatch(result=result, stored_code=None)
        if result.sent:
            return OtpDispatch(result=result, stored_code=code)
        return OtpDispatch(result=result, stored_code=None)

    def _verify_email_channel_configuration(self) -> str:
        from_email = (settings.FROM_EMAIL or "noreply@kiterp.com").strip()
        config: dict[str, str] = {
            "from": from_email,
            "from_name": "KITERP",
        }
        template_id = (settings.SENDGRID_OTP_TEMPLATE_ID or "").strip()
        if template_id:
            config["template_id"] = template_id
        return json.dumps(config)

    async def _send_via_verify(self, to: str, *, channel: OtpChannel) -> OtpSendResult:
        url = f"{VERIFY_API}/Services/{self.verify_service_sid}/Verifications"
        payload: dict[str, str] = {"To": to, "Channel": channel}
        if channel == "email":
            payload["ChannelConfiguration"] = self._verify_email_channel_configuration()
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    url,
                    data=payload,
                    auth=self._auth(),
                )
            if resp.status_code >= 400:
                twilio_code, message = self._parse_twilio_error(resp)
                log.error("Twilio Verify send failed (%s): %s", resp.status_code, resp.text)
                return OtpSendResult(
                    sent=False,
                    channel="email" if channel == "email" else "phone",
                    via_verify=True,
                    twilio_code=twilio_code,
                    twilio_message=message,
                )
            masked = to[-4:].rjust(len(to), "*") if channel == "sms" else re.sub(r"(^.).+(@.+$)", r"\1***\2", to)
            log.info("Twilio Verify OTP sent (%s) to %s", channel, masked)
            return OtpSendResult(
                sent=True,
                channel="email" if channel == "email" else "phone",
                via_verify=True,
            )
        except Exception:
            log.exception("Twilio Verify send error for %s (%s)", to, channel)
            return OtpSendResult(
                sent=False,
                channel="email" if channel == "email" else "phone",
                via_verify=True,
                twilio_message="Network error contacting Twilio",
            )

    async def verify_otp(self, to: str, code: str, *, channel: OtpChannel = "sms") -> OtpVerifyResult:
        to = normalize_email(to) if channel == "email" else normalize_e164(to)
        if not self.uses_verify:
            return OtpVerifyResult(approved=False, twilio_message="Verify not configured")

        url = f"{VERIFY_API}/Services/{self.verify_service_sid}/VerificationCheck"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    url,
                    data={"To": to, "Code": code.strip()},
                    auth=self._auth(),
                )
            if resp.status_code >= 400:
                _, message = self._parse_twilio_error(resp)
                log.error("Twilio Verify check failed (%s): %s", resp.status_code, resp.text)
                return OtpVerifyResult(approved=False, twilio_message=message)
            status = (resp.json().get("status") or "").lower()
            return OtpVerifyResult(approved=status == "approved")
        except Exception:
            log.exception("Twilio Verify check error for %s", to)
            return OtpVerifyResult(approved=False, twilio_message="Network error contacting Twilio")

    async def send_signup_otp(self, phone: str, *, code: str) -> OtpSendResult:
        return await self.send_otp(phone, channel="sms", purpose="vendor signup", code=code)

    async def verify_signup_otp(self, phone: str, code: str) -> OtpVerifyResult:
        return await self.verify_otp(phone, code, channel="sms")

    async def send_signup_email_otp(self, email: str, *, code: str) -> OtpSendResult:
        return await self.send_otp(email, channel="email", purpose="vendor signup", code=code)

    async def verify_signup_email_otp(self, email: str, code: str) -> OtpVerifyResult:
        return await self.verify_otp(email, code, channel="email")


# Back-compat alias
PhoneOtpService = OtpService
