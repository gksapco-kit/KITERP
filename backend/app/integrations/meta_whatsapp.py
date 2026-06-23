"""Meta WhatsApp Cloud API adapter."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.base import WhatsAppAdapter
from app.services.sms_service import normalize_e164

logger = logging.getLogger(__name__)


class MetaWhatsAppAdapter(WhatsAppAdapter):
    provider = "meta_whatsapp"

    def __init__(self, access_token: str, phone_number_id: str):
        self.access_token = access_token
        self.phone_number_id = phone_number_id

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "MetaWhatsAppAdapter | None":
        creds = creds or {}
        if not creds.get("access_token") or not creds.get("phone_number_id"):
            return None
        return cls(
            access_token=creds["access_token"],
            phone_number_id=creds["phone_number_id"],
        )

    async def send(
        self, *, to: str, body: str,
        media_url: str | None = None,
        footer: str | None = None,
        cta_label: str | None = None,
        cta_url: str | None = None,
    ) -> dict[str, Any]:
        url = f"https://graph.facebook.com/v19.0/{self.phone_number_id}/messages"
        to_digits = normalize_e164(to).lstrip("+")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                if media_url and media_url.startswith("http"):
                    resp = await client.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {self.access_token}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "messaging_product": "whatsapp",
                            "to": to_digits,
                            "type": "image",
                            "image": {"link": media_url, "caption": body[:1024]},
                        },
                    )
                    data = resp.json() if resp.content else {}
                    if resp.status_code in (200, 201):
                        msgs = data.get("messages") or [{}]
                        msg_id = msgs[0].get("id")
                        if cta_url and str(cta_url).startswith("http"):
                            cta_text = f"👉 {cta_label or 'Open'}\n{cta_url}"
                            if footer:
                                cta_text = f"{footer}\n\n{cta_text}"
                            await client.post(
                                url,
                                headers={
                                    "Authorization": f"Bearer {self.access_token}",
                                    "Content-Type": "application/json",
                                },
                                json={
                                    "messaging_product": "whatsapp",
                                    "to": to_digits,
                                    "type": "text",
                                    "text": {"body": cta_text[:4096]},
                                },
                            )
                        return {"ok": True, "provider": self.provider, "id": msg_id}

                full_body = body
                if footer:
                    full_body = f"{full_body}\n\n{footer}"
                if cta_url and str(cta_url).startswith("http"):
                    full_body = f"{full_body}\n\n👉 {cta_label or 'Open'}\n{cta_url}"

                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "to": to_digits,
                        "type": "text",
                        "text": {"body": full_body[:4096]},
                    },
                )
            data = resp.json() if resp.content else {}
            if resp.status_code in (200, 201):
                msgs = data.get("messages") or [{}]
                return {"ok": True, "provider": self.provider, "id": msgs[0].get("id")}
            return {"ok": False, "provider": self.provider, "error": str(data)[:300]}
        except Exception as e:
            logger.warning("Meta WA failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}
