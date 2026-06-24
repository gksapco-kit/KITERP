"""Twilio adapters for SMS, WhatsApp and Voice."""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import httpx

from app.integrations.base import SmsAdapter, VoiceAdapter, WhatsAppAdapter
from app.services.sms_service import is_valid_e164, normalize_e164

logger = logging.getLogger(__name__)

_WHATSAPP_SANDBOX_HINT = (
    "WhatsApp was not delivered. On Twilio sandbox, open WhatsApp on your phone and message "
    "+1 415 523 8886 with: join <your-sandbox-code> (Twilio Console → Messaging → Try WhatsApp). "
    "Use whatsapp_from +14155238886 in CRM → Integrations → Twilio."
)

WHATSAPP_SANDBOX_E164 = "+14155238886"


def _whatsapp_address(phone: str) -> str:
    raw = (phone or "").strip()
    if raw.startswith("whatsapp:"):
        raw = raw[len("whatsapp:"):]
    normalized = normalize_e164(raw)
    return f"whatsapp:{normalized}" if normalized else ""


async def fetch_twilio_message_status(
    account_sid: str, auth_token: str, message_sid: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages/{message_sid}.json",
            auth=(account_sid, auth_token),
        )
    if resp.status_code != 200:
        return {"status": "", "error_code": None, "error_message": ""}
    data = resp.json()
    code = data.get("error_code")
    return {
        "status": str(data.get("status") or ""),
        "error_code": int(code) if code else None,
        "error_message": str(data.get("error_message") or ""),
    }


async def wait_for_twilio_delivery(
    account_sid: str,
    auth_token: str,
    message_sid: str,
    *,
    max_wait_sec: float = 20.0,
    interval_sec: float = 2.0,
) -> dict[str, Any]:
    import time

    deadline = time.monotonic() + max_wait_sec
    last: dict[str, Any] = {"status": "", "error_code": None, "error_message": ""}
    while time.monotonic() < deadline:
        last = await fetch_twilio_message_status(account_sid, auth_token, message_sid)
        status = str(last.get("status") or "")
        if status == "delivered":
            return {**last, "confirmed": True, "timed_out": False}
        if status in {"undelivered", "failed", "canceled"}:
            return {**last, "confirmed": False, "timed_out": False}
        await asyncio.sleep(interval_sec)
    return {**last, "confirmed": False, "timed_out": True}


def is_whatsapp_only_sender(from_number: str, whatsapp_from: str = "") -> bool:
    """True when the sender cannot be used for Programmable SMS (e.g. WhatsApp sandbox)."""
    sender = normalize_e164(from_number)
    wa = normalize_e164(whatsapp_from)
    if sender == WHATSAPP_SANDBOX_E164:
        return True
    if wa and sender == wa:
        return True
    return False


async def twilio_incoming_number_sms_capable(
    account_sid: str, auth_token: str, e164: str,
) -> dict[str, Any]:
    """Check Twilio IncomingPhoneNumbers API whether this sender supports SMS."""
    phone = normalize_e164(e164)
    if not phone:
        return {
            "sms_capable": False,
            "detail": "SMS from_number is missing or invalid.",
        }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/IncomingPhoneNumbers.json",
                auth=(account_sid, auth_token),
                params={"PhoneNumber": phone},
            )
        if resp.status_code == 401:
            return {
                "sms_capable": False,
                "detail": "Twilio authentication failed — check Account SID and Auth Token.",
            }
        if resp.status_code != 200:
            return {
                "sms_capable": False,
                "detail": "Could not verify SMS sender number with Twilio.",
            }
        numbers = (resp.json() or {}).get("incoming_phone_numbers") or []
        if not numbers:
            return {
                "sms_capable": False,
                "detail": (
                    f"{phone} is not an active Twilio phone number on this account. "
                    "Buy one at Twilio Console → Phone Numbers → Buy a number (enable SMS), "
                    "then set it as from_number in CRM → Integrations → Twilio."
                ),
            }
        caps = (numbers[0] or {}).get("capabilities") or {}
        if not caps.get("sms"):
            return {
                "sms_capable": False,
                "detail": (
                    f"{phone} is on your Twilio account but SMS is not enabled for this number. "
                    "Choose a different number with SMS capability."
                ),
            }
        return {"sms_capable": True, "from_number": phone}
    except Exception as e:
        logger.warning("Twilio number capability check failed: %s", e)
        return {"sms_capable": True, "from_number": phone, "skipped": True}


async def validate_twilio_sms_config(
    account_sid: str,
    auth_token: str,
    from_number: str | None,
    *,
    whatsapp_from: str | None = None,
) -> dict[str, Any]:
    """Preflight before sending SMS — catches WhatsApp-only senders and missing numbers."""
    sender = normalize_e164(from_number or "")
    if not sender:
        return {
            "ready": False,
            "detail": (
                "SMS from_number is not set. In CRM → Integrations → Twilio, set from_number "
                "(a Twilio phone number with SMS) — separate from whatsapp_from."
            ),
        }
    if is_whatsapp_only_sender(sender, whatsapp_from or ""):
        return {
            "ready": False,
            "detail": (
                "from_number is set to the WhatsApp sender (+14155238886 or same as whatsapp_from). "
                "That number cannot send SMS. Buy an SMS-capable Twilio phone number and set it as from_number."
            ),
        }
    cap = await twilio_incoming_number_sms_capable(account_sid, auth_token, sender)
    if not cap.get("sms_capable"):
        return {"ready": False, "detail": cap.get("detail")}
    return {"ready": True, "from_number": cap.get("from_number") or sender}


def _whatsapp_delivery_error(error_code: int | None, twilio_message: str = "") -> str:
    if error_code == 63016:
        return _WHATSAPP_SANDBOX_HINT
    msg = twilio_message or ""
    if "63016" in msg or "sandbox" in msg.lower():
        return _WHATSAPP_SANDBOX_HINT
    if error_code:
        return f"WhatsApp delivery failed (Twilio error {error_code})."
    return "WhatsApp was accepted by Twilio but not delivered. Check Twilio Console → Messaging logs."


class TwilioBase:
    api_base = "https://api.twilio.com/2010-04-01"

    def __init__(self, account_sid: str, auth_token: str, from_number: str | None):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    @property
    def auth(self) -> tuple[str, str]:
        return (self.account_sid, self.auth_token)


def _sms_delivery_error(
    error_code: int | None,
    twilio_message: str = "",
    *,
    timed_out: bool = False,
    to_phone: str = "",
) -> str:
    from app.services.sms_service import (
        is_sms_length_trial_error,
        sms_delivery_unconfirmed_hint,
        twilio_sms_user_hint,
    )

    if timed_out:
        return sms_delivery_unconfirmed_hint(to_phone)
    if error_code == 30044 or is_sms_length_trial_error(code=error_code, message=twilio_message):
        return twilio_sms_user_hint(30044, twilio_message)
    if error_code in (21608, 21610, 21211, 21408, 30004, 21606):
        return twilio_sms_user_hint(error_code, twilio_message)
    msg = twilio_message or ""
    if any(code in msg for code in ("21608", "21610", "21211", "21408", "30044", "30004", "21606")):
        return twilio_sms_user_hint(error_code, twilio_message)
    return twilio_sms_user_hint(error_code, twilio_message)


class TwilioSmsAdapter(TwilioBase, SmsAdapter):
    provider = "twilio_sms"

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "TwilioSmsAdapter | None":
        creds = creds or {}
        if not creds.get("account_sid") or not creds.get("auth_token"):
            return None
        adapter = cls(
            account_sid=creds["account_sid"],
            auth_token=creds["auth_token"],
            from_number=creds.get("from_number"),
        )
        adapter._whatsapp_from = str(creds.get("whatsapp_from") or "")
        return adapter

    async def send(
        self, *, to: str, body: str, from_number: str | None = None,
        require_delivery: bool = False,
    ) -> dict[str, Any]:
        sender = normalize_e164(from_number or self.from_number or "")
        to_normalized = normalize_e164(to)
        if not sender:
            return {
                "ok": False,
                "provider": self.provider,
                "error": "no_from_number",
                "detail": (
                    "SMS from_number is not set. In CRM → Integrations → Twilio, set from_number "
                    "(your Twilio phone number) — it is separate from whatsapp_from."
                ),
            }
        if not to_normalized:
            return {"ok": False, "provider": self.provider, "error": "invalid_to_number"}

        whatsapp_from = getattr(self, "_whatsapp_from", "") or ""
        preflight = await validate_twilio_sms_config(
            self.account_sid, self.auth_token, sender, whatsapp_from=whatsapp_from,
        )
        if not preflight.get("ready"):
            return {
                "ok": False,
                "provider": self.provider,
                "error": "invalid_from_number",
                "detail": preflight.get("detail"),
            }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.api_base}/Accounts/{self.account_sid}/Messages.json",
                    auth=self.auth,
                    data={"From": sender, "To": to_normalized, "Body": body},
                )
            data = resp.json() if resp.content else {}
            if resp.status_code not in (200, 201):
                code = data.get("code")
                err_msg = data.get("message") or resp.text[:300]
                return {
                    "ok": False,
                    "provider": self.provider,
                    "error": err_msg,
                    "code": int(code) if code else None,
                    "detail": _sms_delivery_error(int(code) if code else None, str(err_msg), to_phone=to_normalized),
                }

            message_sid = data.get("sid")
            status = str(data.get("status") or "")
            if not message_sid:
                return {"ok": False, "provider": self.provider, "error": "no_message_sid"}

            if require_delivery:
                delivery = await wait_for_twilio_delivery(
                    self.account_sid, self.auth_token, message_sid,
                )
                delivery_status = str(delivery.get("status") or "")
                error_code = delivery.get("error_code")
                error_message = str(delivery.get("error_message") or "")
                if delivery_status == "delivered":
                    return {
                        "ok": True,
                        "provider": self.provider,
                        "id": message_sid,
                        "status": delivery_status,
                        "delivery_status": delivery_status,
                    }
                if delivery.get("timed_out"):
                    return {
                        "ok": False,
                        "provider": self.provider,
                        "id": message_sid,
                        "error": "delivery_unconfirmed",
                        "code": error_code,
                        "status": delivery_status,
                        "delivery_status": delivery_status,
                        "detail": _sms_delivery_error(
                            error_code, error_message,
                            timed_out=True, to_phone=to_normalized,
                        ),
                    }
                return {
                    "ok": False,
                    "provider": self.provider,
                    "id": message_sid,
                    "error": "delivery_failed",
                    "code": error_code,
                    "status": delivery_status,
                    "delivery_status": delivery_status,
                    "detail": _sms_delivery_error(
                        error_code, error_message, to_phone=to_normalized,
                    ),
                }

            if status in {"", "queued", "sending", "sent", "accepted"}:
                await asyncio.sleep(3)
                polled = await fetch_twilio_message_status(
                    self.account_sid, self.auth_token, message_sid,
                )
                delivery_status = str(polled.get("status") or "")
                error_code = polled.get("error_code")
                if delivery_status in {"undelivered", "failed", "canceled"}:
                    return {
                        "ok": False,
                        "provider": self.provider,
                        "id": message_sid,
                        "error": "delivery_failed",
                        "code": error_code,
                        "status": delivery_status,
                        "delivery_status": delivery_status,
                        "detail": _sms_delivery_error(
                            error_code,
                            str(polled.get("error_message") or ""),
                            to_phone=to_normalized,
                        ),
                    }

            return {
                "ok": True,
                "provider": self.provider,
                "id": message_sid,
                "status": status,
                "delivery_status": status,
            }
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
        # WhatsApp sender is separate from SMS from_number — do not fall back to SMS number.
        wa_from = (creds.get("whatsapp_from") or "").strip()
        if not wa_from:
            return None
        return cls(
            account_sid=creds["account_sid"],
            auth_token=creds["auth_token"],
            from_number=wa_from,
        )

    async def _post_message(self, payload: dict[str, str]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{self.api_base}/Accounts/{self.account_sid}/Messages.json",
                    auth=self.auth,
                    data=payload,
                )
            data = resp.json() if resp.content else {}
            if resp.status_code not in (200, 201):
                err = data.get("message") or resp.text[:300]
                code = data.get("code")
                return {
                    "ok": False,
                    "provider": self.provider,
                    "error": err,
                    "code": int(code) if code else None,
                    "detail": _whatsapp_delivery_error(int(code) if code else None, str(err)),
                }

            message_sid = data.get("sid")
            status = str(data.get("status") or "")
            if message_sid and status in {"", "queued", "sending", "sent"}:
                await asyncio.sleep(3)
                polled = await fetch_twilio_message_status(
                    self.account_sid, self.auth_token, message_sid,
                )
                delivery_status = str(polled.get("status") or "")
                error_code = polled.get("error_code")
                if delivery_status in {"undelivered", "failed"}:
                    return {
                        "ok": False,
                        "provider": self.provider,
                        "id": message_sid,
                        "error": "delivery_failed",
                        "code": error_code,
                        "detail": _whatsapp_delivery_error(error_code),
                    }

            return {"ok": True, "provider": self.provider, "id": message_sid, "status": status}
        except Exception as e:
            logger.warning("Twilio WA failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}

    async def _try_send_rich_card(
        self,
        wa_from: str,
        wa_to: str,
        *,
        body: str,
        footer: str | None,
        media_url: str | None,
        cta_label: str | None,
        cta_url: str | None,
        media_type: str | None = None,
    ) -> dict[str, Any] | None:
        use_card = bool(media_url) and (media_type or "image") == "image"
        if not use_card and not (cta_url and str(cta_url).startswith("http")):
            return None

        if not use_card:
            return None

        card: dict[str, Any] = {"body": body[:1024]}
        if footer:
            card["footer"] = footer[:60]
        if media_url:
            card["media"] = [media_url]
        if cta_url and str(cta_url).startswith("http"):
            card["actions"] = [{
                "type": "URL",
                "title": (cta_label or "Explore Now")[:20],
                "url": str(cta_url)[:1600],
            }]

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                create = await client.post(
                    "https://content.twilio.com/v1/Content",
                    auth=self.auth,
                    json={
                        "friendly_name": f"kiterp-wa-{uuid.uuid4().hex[:10]}",
                        "language": "en",
                        "types": {"whatsapp/card": card},
                    },
                )
            if create.status_code not in (200, 201):
                logger.warning("Twilio WA content create failed: %s", create.text[:300])
                return None
            content_sid = (create.json() or {}).get("sid")
            if not content_sid:
                return None
            return await self._post_message({
                "From": wa_from,
                "To": wa_to,
                "ContentSid": content_sid,
            })
        except Exception as e:
            logger.warning("Twilio WA rich card failed: %s", e)
            return None

    async def send(
        self, *, to: str, body: str,
        media_url: str | None = None,
        footer: str | None = None,
        cta_label: str | None = None,
        cta_url: str | None = None,
        media_type: str | None = None,
    ) -> dict[str, Any]:
        wa_from = _whatsapp_address(self.from_number or "")
        if not wa_from:
            return {"ok": False, "provider": self.provider, "error": "no_from_number"}
        wa_to = _whatsapp_address(to)
        if not wa_to or not is_valid_e164(wa_to.replace("whatsapp:", "", 1)):
            return {
                "ok": False,
                "provider": self.provider,
                "error": "invalid_to_number",
                "detail": "Enter a valid mobile number with country code (e.g. +919876543210).",
            }

        rich = await self._try_send_rich_card(
            wa_from, wa_to,
            body=body, footer=footer, media_url=media_url,
            cta_label=cta_label, cta_url=cta_url, media_type=media_type,
        )
        if rich and rich.get("ok"):
            return rich
        if rich and not rich.get("ok") and not media_url:
            return rich

        full_body = body
        if footer:
            full_body = f"{full_body}\n\n{footer}"
        if cta_url and str(cta_url).startswith("http"):
            full_body = f"{full_body}\n\n👉 {cta_label or 'Explore Now'}\n{cta_url}"

        payload: dict[str, str] = {"From": wa_from, "To": wa_to, "Body": full_body}
        if media_url:
            payload["MediaUrl"] = media_url
        return await self._post_message(payload)


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
