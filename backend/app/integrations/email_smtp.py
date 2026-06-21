"""SMTP-based email adapter (uses platform SMTP_* settings or per-vendor creds)."""
from __future__ import annotations

import logging
from typing import Any

from app.config import settings
from app.integrations.base import EmailAdapter

logger = logging.getLogger(__name__)


class SmtpEmailAdapter(EmailAdapter):
    provider = "smtp"

    def __init__(self, host: str, port: int, user: str, password: str,
                 from_addr: str, use_tls: bool = True):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.from_addr = from_addr
        self.use_tls = use_tls

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "SmtpEmailAdapter | None":
        creds = creds or {}
        host = creds.get("host") or settings.SMTP_HOST
        if not host:
            return None
        return cls(
            host=host,
            port=int(creds.get("port") or settings.SMTP_PORT or 587),
            user=creds.get("user") or creds.get("username") or settings.SMTP_USER,
            password=creds.get("password") or settings.SMTP_PASSWORD,
            from_addr=creds.get("from") or creds.get("from_email") or settings.FROM_EMAIL,
            use_tls=bool(creds.get("use_tls", True)),
        )

    async def send(self, *, to: str, subject: str, html: str | None = None,
                   text: str | None = None, from_addr: str | None = None,
                   reply_to: str | None = None) -> dict[str, Any]:
        try:
            import aiosmtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_addr or self.from_addr
            msg["To"] = to
            if reply_to:
                msg["Reply-To"] = reply_to
            if text:
                msg.attach(MIMEText(text, "plain", "utf-8"))
            if html:
                msg.attach(MIMEText(html, "html", "utf-8"))

            await aiosmtplib.send(
                msg,
                hostname=self.host,
                port=self.port,
                username=self.user or None,
                password=self.password or None,
                start_tls=self.use_tls,
                timeout=30,
            )
            return {"ok": True, "provider": self.provider}
        except Exception as e:
            logger.warning("SMTP send failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}
