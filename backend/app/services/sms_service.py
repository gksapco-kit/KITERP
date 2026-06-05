"""SMS delivery — Twilio when configured, otherwise no-op (dev mode)."""
from __future__ import annotations

import logging

import httpx

from app.config import settings

log = logging.getLogger(__name__)

TWILIO_API = "https://api.twilio.com/2010-04-01"


class SmsService:
    def __init__(self) -> None:
        self.account_sid = (settings.TWILIO_ACCOUNT_SID or "").strip()
        self.auth_token = (settings.TWILIO_AUTH_TOKEN or "").strip()
        self.from_number = (settings.TWILIO_FROM_NUMBER or "").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token and self.from_number)

    async def send_sms(self, to: str, body: str) -> bool:
        if not self.is_configured:
            return False
        to = (to or "").strip()
        if not to:
            return False
        url = f"{TWILIO_API}/Accounts/{self.account_sid}/Messages.json"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    url,
                    data={"To": to, "From": self.from_number, "Body": body},
                    auth=(self.account_sid, self.auth_token),
                )
            if resp.status_code >= 400:
                log.error("Twilio SMS failed (%s): %s", resp.status_code, resp.text)
                return False
            log.info("SMS sent to %s", to[-4:].rjust(len(to), "*") if len(to) > 4 else "****")
            return True
        except Exception:
            log.exception("Twilio SMS error for %s", to)
            return False

    async def send_otp(self, phone: str, code: str, *, purpose: str = "verification") -> bool:
        body = f"Your {purpose} code is {code}. It expires in 10 minutes."
        return await self.send_sms(phone, body)
