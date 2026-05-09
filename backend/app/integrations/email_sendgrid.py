"""SendGrid email adapter."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.base import EmailAdapter

logger = logging.getLogger(__name__)


class SendGridEmailAdapter(EmailAdapter):
    provider = "sendgrid"

    def __init__(self, api_key: str, from_addr: str, from_name: str | None = None):
        self.api_key = api_key
        self.from_addr = from_addr
        self.from_name = from_name

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "SendGridEmailAdapter | None":
        creds = creds or {}
        api_key = creds.get("api_key")
        if not api_key:
            return None
        return cls(
            api_key=api_key,
            from_addr=creds.get("from") or "noreply@example.com",
            from_name=creds.get("from_name"),
        )

    async def send(self, *, to: str, subject: str, html: str | None = None,
                   text: str | None = None, from_addr: str | None = None,
                   reply_to: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": from_addr or self.from_addr, "name": self.from_name or ""},
            "subject": subject,
            "content": [],
        }
        if text:
            body["content"].append({"type": "text/plain", "value": text})
        if html:
            body["content"].append({"type": "text/html", "value": html})
        if not body["content"]:
            body["content"].append({"type": "text/plain", "value": ""})
        if reply_to:
            body["reply_to"] = {"email": reply_to}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=body,
                )
            if resp.status_code in (200, 202):
                return {"ok": True, "provider": self.provider, "id": resp.headers.get("X-Message-Id")}
            return {"ok": False, "provider": self.provider, "error": resp.text[:300]}
        except Exception as e:
            logger.warning("SendGrid send failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}
