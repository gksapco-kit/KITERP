"""
Email service.

Sends transactional emails via SendGrid HTTP API (preferred) or SMTP when configured;
otherwise falls back to logging the email content (dev-mode).

Production should set SENDGRID_API_KEY (or SMTP_PASSWORD with a SendGrid key) and/or:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

logger = logging.getLogger(__name__)

# Last platform send failure (no secrets) — used for clearer OTP 503 messages.
_last_send_error: str | None = None


@dataclass
class EmailSendResult:
    ok: bool
    error: str | None = None


def last_email_send_error() -> str | None:
    return _last_send_error


def _set_last_send_error(msg: str | None) -> None:
    global _last_send_error
    _last_send_error = (msg or "").strip() or None


def resolve_from_email() -> str:
    """Sender address for platform email.

    Prefer SENDGRID_FROM_EMAIL when set (SendGrid-only setups), else FROM_EMAIL.
    Must match a verified Sender Identity in the SendGrid account for SENDGRID_API_KEY.
    """
    settings = get_settings()
    for raw in (settings.SENDGRID_FROM_EMAIL, settings.FROM_EMAIL):
        val = (raw or "").strip()
        if val:
            return val
    return "noreply@kiterp.com"


def sendgrid_api_keys() -> list[str]:
    """Configured SendGrid API keys. SENDGRID_API_KEY is primary (SendGrid-only mode).

    SMTP_PASSWORD is only included as a legacy fallback when it starts with SG.
    """
    settings = get_settings()
    keys: list[str] = []
    for raw in (settings.SENDGRID_API_KEY, settings.SMTP_PASSWORD):
        key = (raw or "").strip()
        if key.startswith("SG.") and key not in keys:
            keys.append(key)
    return keys


def sendgrid_api_key() -> str:
    keys = sendgrid_api_keys()
    return keys[0] if keys else ""


def resolve_effective_sendgrid_key(creds: dict | None = None) -> str:
    """Same key resolution for CRM integrations and platform email (.env)."""
    creds = creds or {}
    for field in ("api_key", "password"):
        val = (creds.get(field) or "").strip()
        if val.startswith("SG."):
            return val
    return sendgrid_api_key()


def email_is_configured() -> bool:
    """True when platform email can be sent (SendGrid API or SMTP with credentials)."""
    settings = get_settings()
    if sendgrid_api_keys():
        return True
    host = (settings.SMTP_HOST or "").strip()
    if not host:
        return False
    return bool((settings.SMTP_PASSWORD or "").strip() or (settings.SMTP_USER or "").strip())


def _humanize_sendgrid_error(status_code: int, body: str, from_email: str) -> str:
    lower = (body or "").lower()
    if status_code in (401, 403) and ("authorization" in lower or "permission" in lower or "unauthorized" in lower):
        return (
            "SendGrid API key was rejected. Use one valid key for both SENDGRID_API_KEY and "
            "SMTP_PASSWORD in .env.config, then restart the backend."
        )
    if status_code == 403 or "sender" in lower or ("from" in lower and "verified" in lower):
        return (
            f"SendGrid rejected FROM_EMAIL ({from_email}). In SendGrid → Settings → Sender Authentication, "
            f"verify that address (or your domain), set FROM_EMAIL to it in .env.config, and restart."
        )
    if status_code == 400:
        return "SendGrid rejected the email request. Check FROM_EMAIL and the recipient address."
    return f"SendGrid send failed (HTTP {status_code})."


async def send_email_for_vendor(
    db: AsyncSession,
    vendor_id: UUID,
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> bool:
    """Send email using the vendor CRM integration when configured, else platform .env."""
    result = await send_email_detailed_for_vendor(
        db, vendor_id, to=to, subject=subject, html=html, text=text
    )
    return result.ok


async def send_email_detailed_for_vendor(
    db: AsyncSession,
    vendor_id: UUID,
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> EmailSendResult:
    from app.integrations.registry import IntegrationRegistry

    registry = IntegrationRegistry(db)
    adapter = await registry.get_email_adapter(vendor_id)
    if adapter:
        result = await adapter.send(to=to, subject=subject, html=html, text=text)
        if result.get("ok"):
            logger.info("Email sent via vendor integration to %s (subject=%r)", to, subject)
            _set_last_send_error(None)
            return EmailSendResult(ok=True)
        logger.warning(
            "Vendor email integration failed for %s: %s — falling back to platform email",
            to, result.get("error"),
        )
    return await send_email_detailed(to=to, subject=subject, html=html, text=text)


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> bool:
    """Send an HTML email. Returns True on success, False on (silent) dev fallback."""
    result = await send_email_detailed(to=to, subject=subject, html=html, text=text)
    return result.ok


async def send_email_detailed(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> EmailSendResult:
    """Send an HTML email and return success plus a safe error message on failure."""
    settings = get_settings()
    host = (settings.SMTP_HOST or "").strip()
    from_email = resolve_from_email()
    keys = sendgrid_api_keys()
    last_error: str | None = None

    # Prefer HTTPS API (works when Docker/EC2 blocks outbound SMTP :587).
    for api_key in keys:
        ok, err = await _try_sendgrid_api(
            to=to,
            subject=subject,
            html=html,
            text=text,
            from_email=from_email,
            api_key=api_key,
        )
        if ok:
            _set_last_send_error(None)
            return EmailSendResult(ok=True)
        last_error = err or last_error

    if keys:
        logger.warning(
            "SendGrid API send failed for %s with %s key(s); trying SMTP if configured",
            to,
            len(keys),
        )

    if not host:
        if keys:
            _set_last_send_error(last_error)
            return EmailSendResult(ok=False, error=last_error)
        logger.info(
            "[email:dev] -> %s | subject=%r | text=%s",
            to, subject, (text or _strip_html(html))[:500],
        )
        msg = "Email delivery not configured"
        _set_last_send_error(msg)
        return EmailSendResult(ok=False, error=msg)

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
        msg = last_error or "SMTP library missing and SendGrid API failed"
        _set_last_send_error(msg)
        return EmailSendResult(ok=False, error=msg)

    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to
    msg["Subject"] = subject
    if text:
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
    else:
        msg.add_alternative(html, subtype="html")

    smtp_passwords: list[str | None] = []
    primary_pwd = (settings.SMTP_PASSWORD or "").strip() or None
    if primary_pwd:
        smtp_passwords.append(primary_pwd)
    for key in keys:
        if key not in smtp_passwords:
            smtp_passwords.append(key)
    if not smtp_passwords:
        smtp_passwords.append(None)

    for pwd in smtp_passwords:
        try:
            await aiosmtplib.send(
                msg,
                hostname=host,
                port=settings.SMTP_PORT or 587,
                username=settings.SMTP_USER or None,
                password=pwd,
                start_tls=True,
                timeout=15,
            )
            logger.info("Email sent via SMTP to %s (subject=%r)", to, subject)
            _set_last_send_error(None)
            return EmailSendResult(ok=True)
        except Exception as e:
            logger.warning("SMTP send failed for %s: %s", to, e)
            last_error = f"SMTP send failed: {e}"

    # Final API retry in case SMTP was blocked and a key was only tried via SMTP.
    for api_key in keys:
        ok, err = await _try_sendgrid_api(
            to=to,
            subject=subject,
            html=html,
            text=text,
            from_email=from_email,
            api_key=api_key,
        )
        if ok:
            _set_last_send_error(None)
            return EmailSendResult(ok=True)
        last_error = err or last_error

    logger.error("Failed to send email to %s: %s", to, last_error)
    _set_last_send_error(last_error)
    return EmailSendResult(ok=False, error=last_error)


async def _try_sendgrid_api(
    *,
    to: str,
    subject: str,
    html: str,
    text: Optional[str],
    from_email: str,
    api_key: str,
) -> tuple[bool, str | None]:
    """Send via SendGrid REST API (works reliably from Docker). Returns (ok, error)."""
    if not api_key.startswith("SG."):
        return False, "Invalid SendGrid API key format"
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
            return True, None
        err = _humanize_sendgrid_error(resp.status_code, resp.text, from_email)
        logger.error("SendGrid API send failed (%s): %s", resp.status_code, resp.text[:300])
        return False, err
    except Exception as e:
        logger.warning("SendGrid API send error for %s: %s", to, e)
        return False, f"Network error contacting SendGrid: {e}"


def _strip_html(html: str) -> str:
    """Cheap HTML -> text conversion for dev logs only."""
    import re
    return re.sub(r"<[^>]+>", "", html)


def _verification_email_content(purpose: str) -> tuple[str, str]:
    if purpose == "change":
        return (
            "Confirm your new KITERP email address",
            "Use this code to confirm your new email address on your KITERP account.",
        )
    if purpose in ("reset", "password"):
        return (
            "Reset your KITERP password",
            "Use this code to reset your KITERP account password.",
        )
    return (
        "Your KITERP verification code",
        "Use this code to verify your email address on your KITERP account.",
    )


def _verification_email_bodies(intro: str, code: str) -> tuple[str, str]:
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
    return html, text


async def send_verification_code_email(to: str, code: str, purpose: str = "verify") -> bool:
    """Send a 6-digit verification code via email."""
    result = await send_verification_code_email_detailed(to, code, purpose=purpose)
    return result.ok


async def send_verification_code_email_detailed(
    to: str, code: str, purpose: str = "verify"
) -> EmailSendResult:
    subject, intro = _verification_email_content(purpose)
    html, text = _verification_email_bodies(intro, code)
    return await send_email_detailed(to=to, subject=subject, html=html, text=text)


async def send_verification_code_email_for_vendor(
    db: AsyncSession,
    vendor_id: UUID,
    to: str,
    code: str,
    purpose: str = "verify",
) -> bool:
    """Send OTP email via vendor CRM integration when configured, else platform .env."""
    result = await send_verification_code_email_for_vendor_detailed(
        db, vendor_id, to, code, purpose=purpose
    )
    return result.ok


async def send_verification_code_email_for_vendor_detailed(
    db: AsyncSession,
    vendor_id: UUID,
    to: str,
    code: str,
    purpose: str = "verify",
) -> EmailSendResult:
    subject, intro = _verification_email_content(purpose)
    html, text = _verification_email_bodies(intro, code)
    return await send_email_detailed_for_vendor(
        db, vendor_id, to=to, subject=subject, html=html, text=text
    )