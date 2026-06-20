"""
Email service.

Sends transactional emails via SendGrid HTTP API (preferred) or SMTP when configured;
otherwise falls back to logging the email content (dev-mode).

Production should set SENDGRID_API_KEY (or SMTP_PASSWORD with a SendGrid key) and/or:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def sendgrid_api_key() -> str:
    settings = get_settings()
    key = (settings.SENDGRID_API_KEY or "").strip()
    if key.startswith("SG."):
        return key
    pwd = (settings.SMTP_PASSWORD or "").strip()
    if pwd.startswith("SG."):
        return pwd
    return ""


def email_is_configured() -> bool:
    """True when platform email can be sent (SendGrid API or SMTP with credentials)."""
    settings = get_settings()
    if sendgrid_api_key():
        return True
    host = (settings.SMTP_HOST or "").strip()
    if not host:
        return False
    return bool((settings.SMTP_PASSWORD or "").strip() or (settings.SMTP_USER or "").strip())


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> bool:
    """Send an HTML email. Returns True on success, False on (silent) dev fallback."""
    settings = get_settings()
    host = (settings.SMTP_HOST or "").strip()
    from_email = (settings.FROM_EMAIL or "noreply@kiterp.com").strip()
    api_key = sendgrid_api_key()

    if api_key:
        if await _try_sendgrid_api(
            to=to,
            subject=subject,
            html=html,
            text=text,
            from_email=from_email,
            api_key=api_key,
        ):
            return True
        logger.warning("SendGrid API send failed for %s; trying SMTP if configured", to)

    if not host:
        logger.info(
            "[email:dev] -> %s | subject=%r | text=%s",
            to, subject, (text or _strip_html(html))[:500],
        )
        return False

    try:
        import aiosmtplib
    except ImportError:
        logger.error(
            "aiosmtplib is not installed; cannot send real email. "
            "Falling back to log-only mode."
        )
        logger.info(
            "[email:fallback] -> %s | subject=%r | text=%s",
            to, subject, (text or _strip_html(html))[:500],
        )
        return False

    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to
    msg["Subject"] = subject
    if text:
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
    else:
        msg.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=host,
            port=settings.SMTP_PORT or 587,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            start_tls=True,
            timeout=15,
        )
        logger.info("Email sent via SMTP to %s (subject=%r)", to, subject)
        return True
    except Exception as e:
        logger.warning("SMTP send failed for %s: %s", to, e)
        if api_key and await _try_sendgrid_api(
            to=to,
            subject=subject,
            html=html,
            text=text,
            from_email=from_email,
            api_key=api_key,
        ):
            return True
        logger.exception("Failed to send email to %s", to)
        return False


async def _try_sendgrid_api(
    *,
    to: str,
    subject: str,
    html: str,
    text: Optional[str],
    from_email: str,
    api_key: str,
) -> bool:
    """Send via SendGrid REST API (works reliably from Docker)."""
    if not api_key.startswith("SG."):
        return False
    body: dict = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": from_email, "name": "KITERP"},
        "subject": subject,
        "content": [],
    }
    if text:
        body["content"].append({"type": "text/plain", "value": text})
    body["content"].append({"type": "text/html", "value": html})
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {api_key}"},
                json=body,
            )
        if resp.status_code in (200, 202):
            logger.info("Email sent via SendGrid API to %s (subject=%r)", to, subject)
            return True
        logger.error("SendGrid API send failed (%s): %s", resp.status_code, resp.text[:300])
    except Exception as e:
        logger.warning("SendGrid API send error for %s: %s", to, e)
    return False


def _strip_html(html: str) -> str:
    """Cheap HTML -> text conversion for dev logs only."""
    import re
    return re.sub(r"<[^>]+>", "", html)


async def send_verification_code_email(to: str, code: str, purpose: str = "verify") -> bool:
    """Send a 6-digit verification code via email."""
    if purpose == "change":
        subject = "Confirm your new KITERP email address"
        intro = "Use this code to confirm your new email address on your KITERP account."
    elif purpose in ("reset", "password"):
        subject = "Reset your KITERP password"
        intro = "Use this code to reset your KITERP account password."
    else:
        subject = "Your KITERP verification code"
        intro = "Use this code to verify your email address on your KITERP account."

    html = f"""\
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f7f7fb; padding:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ececf5;">
      <tr>
        <td style="background:linear-gradient(135deg,#64C3A0 0%, #13624A 100%); padding:20px 24px; color:#fff;">
          <h2 style="margin:0; font-size:18px; font-weight:600;">KITERP</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Hello,</p>
          <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">{intro}</p>
          <div style="margin:20px 0; padding:16px; text-align:center; border:1px dashed #d1d5db; border-radius:8px; background:#fafafa;">
            <span style="font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size:28px; font-weight:700; letter-spacing:6px; color:#111827;">{code}</span>
          </div>
          <p style="margin:0 0 8px; font-size:12px; color:#6b7280;">This code expires in 10 minutes.</p>
          <p style="margin:0; font-size:12px; color:#9ca3af;">If you didn't request this, you can safely ignore this email.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px; background:#fafafa; border-top:1px solid #ececf5;">
          <p style="margin:0; font-size:11px; color:#9ca3af;">© KITERP — Vendor Dashboard</p>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    text = (
        f"Hello,\n\n"
        f"{intro}\n\n"
        f"Your KITERP verification code is: {code}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— KITERP Team"
    )
    return await send_email(to=to, subject=subject, html=html, text=text)
