"""SendGrid email adapter."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.base import EmailAdapter

logger = logging.getLogger(__name__)


def parse_sendgrid_error(raw: str, status_code: int = 0) -> str:
    """Turn SendGrid JSON error bodies into short, actionable messages."""
    import json

    text = (raw or "").strip()
    try:
        data = json.loads(text)
        errors = data.get("errors") or []
        messages = [str(e.get("message", "")).strip() for e in errors if e.get("message")]
        if messages:
            combined = " ".join(messages)
            lower = combined.lower()
            if status_code == 401 or "authorization grant" in lower or "unauthorized" in lower:
                return (
                    "SendGrid API key is invalid, expired, or revoked. "
                    "Create a new key in SendGrid → Settings → API Keys "
                    "(enable Mail Send), then paste it in the password or API key field."
                )
            if "sender" in lower or "from address" in lower or "verified" in lower:
                return (
                    f"SendGrid rejected the sender address: {combined}. "
                    "Verify your from_email as a Single Sender or Domain in SendGrid."
                )
            return combined
    except (json.JSONDecodeError, TypeError, AttributeError):
        pass
    if status_code == 401:
        return (
            "SendGrid API key is invalid, expired, or revoked. "
            "Create a new key in SendGrid → Settings → API Keys."
        )
    return text[:300] if text else "SendGrid send failed."


class SendGridEmailAdapter(EmailAdapter):
    provider = "sendgrid"

    def __init__(self, api_key: str, from_addr: str, from_name: str | None = None):
        self.api_key = api_key
        self.from_addr = from_addr
        self.from_name = from_name

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "SendGridEmailAdapter | None":
        creds = creds or {}
        api_key = (creds.get("api_key") or creds.get("password") or "").strip()
        if not api_key.startswith("SG."):
            return None
        return cls(
            api_key=api_key,
            from_addr=creds.get("from") or creds.get("from_email") or "noreply@example.com",
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
            return {
                "ok": False,
                "provider": self.provider,
                "error": parse_sendgrid_error(resp.text, resp.status_code),
            }
        except Exception as e:
            logger.warning("SendGrid send failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}
