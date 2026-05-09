"""Meta WhatsApp Cloud API adapter."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.base import WhatsAppAdapter

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

    async def send(self, *, to: str, body: str) -> dict[str, Any]:
        url = f"https://graph.facebook.com/v19.0/{self.phone_number_id}/messages"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "to": to.lstrip("+"),
                        "type": "text",
                        "text": {"body": body},
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
