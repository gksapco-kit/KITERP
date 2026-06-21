"""Twilio adapters for SMS, WhatsApp and Voice."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.base import SmsAdapter, VoiceAdapter, WhatsAppAdapter

logger = logging.getLogger(__name__)


class TwilioBase:
    api_base = "https://api.twilio.com/2010-04-01"

    def __init__(self, account_sid: str, auth_token: str, from_number: str | None):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    @property
    def auth(self) -> tuple[str, str]:
        return (self.account_sid, self.auth_token)


class TwilioSmsAdapter(TwilioBase, SmsAdapter):
    provider = "twilio_sms"

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "TwilioSmsAdapter | None":
        creds = creds or {}
        if not creds.get("account_sid") or not creds.get("auth_token"):
            return None
        return cls(
            account_sid=creds["account_sid"],
            auth_token=creds["auth_token"],
            from_number=creds.get("from_number"),
        )

    async def send(self, *, to: str, body: str, from_number: str | None = None) -> dict[str, Any]:
        sender = from_number or self.from_number
        if not sender:
            return {"ok": False, "provider": self.provider, "error": "no_from_number"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.api_base}/Accounts/{self.account_sid}/Messages.json",
                    auth=self.auth,
                    data={"From": sender, "To": to, "Body": body},
                )
            data = resp.json() if resp.content else {}
            if resp.status_code in (200, 201):
                return {"ok": True, "provider": self.provider, "id": data.get("sid")}
            return {"ok": False, "provider": self.provider, "error": data.get("message") or resp.text[:300]}
        except Exception as e:
            logger.warning("Twilio SMS failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}


class TwilioWhatsAppAdapter(TwilioBase, WhatsAppAdapter):
    provider = "twilio_whatsapp"

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "TwilioWhatsAppAdapter | None":
        creds = creds or {}
        if not creds.get("account_sid") or not creds.get("auth_token"):
            return None
        wa_from = (creds.get("whatsapp_from") or creds.get("from_number") or "").strip()
        if not wa_from:
            return None
        return cls(
            account_sid=creds["account_sid"],
            auth_token=creds["auth_token"],
            from_number=wa_from,
        )

    async def send(self, *, to: str, body: str) -> dict[str, Any]:
        sender = self.from_number
        if not sender:
            return {"ok": False, "provider": self.provider, "error": "no_from_number"}
        wa_to = to if to.startswith("whatsapp:") else f"whatsapp:{to}"
        wa_from = sender if sender.startswith("whatsapp:") else f"whatsapp:{sender}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.api_base}/Accounts/{self.account_sid}/Messages.json",
                    auth=self.auth,
                    data={"From": wa_from, "To": wa_to, "Body": body},
                )
            data = resp.json() if resp.content else {}
            if resp.status_code in (200, 201):
                return {"ok": True, "provider": self.provider, "id": data.get("sid")}
            return {"ok": False, "provider": self.provider, "error": data.get("message") or resp.text[:300]}
        except Exception as e:
            logger.warning("Twilio WA failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}


class TwilioVoiceAdapter(TwilioBase, VoiceAdapter):
    provider = "twilio_voice"

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "TwilioVoiceAdapter | None":
        creds = creds or {}
        if not creds.get("account_sid") or not creds.get("auth_token"):
            return None
        return cls(
            account_sid=creds["account_sid"],
            auth_token=creds["auth_token"],
            from_number=creds.get("from_number"),
        )

    async def call(self, *, to: str, twiml_url: str | None = None,
                   from_number: str | None = None) -> dict[str, Any]:
        sender = from_number or self.from_number
        if not sender:
            return {"ok": False, "provider": self.provider, "error": "no_from_number"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.api_base}/Accounts/{self.account_sid}/Calls.json",
                    auth=self.auth,
                    data={
                        "From": sender, "To": to,
                        "Url": twiml_url or "http://demo.twilio.com/docs/voice.xml",
                    },
                )
            data = resp.json() if resp.content else {}
            if resp.status_code in (200, 201):
                return {"ok": True, "provider": self.provider, "id": data.get("sid")}
            return {"ok": False, "provider": self.provider, "error": data.get("message") or resp.text[:300]}
        except Exception as e:
            logger.warning("Twilio call failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}
