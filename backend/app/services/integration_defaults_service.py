"""Platform (.env) defaults for CRM integration setup forms."""
from __future__ import annotations

from typing import Any

from app.config import get_settings
from app.services.email_service import resolve_effective_sendgrid_key, sendgrid_api_key

_SECRET_FIELDS = frozenset({"password", "auth_token", "api_key"})


def _non_empty(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def get_platform_integration_defaults(provider: str) -> dict[str, Any]:
    """Return suggested credentials/settings from platform environment variables."""
    provider = (provider or "").strip().lower()
    settings = get_settings()

    if provider == "smtp":
        creds: dict[str, str] = {}
        host = (settings.SMTP_HOST or "").strip()
        if host:
            creds["host"] = host
        if settings.SMTP_PORT:
            creds["port"] = str(settings.SMTP_PORT)
        user = (settings.SMTP_USER or "").strip()
        if user:
            creds["username"] = user
        sg_key = sendgrid_api_key()
        pwd = (settings.SMTP_PASSWORD or "").strip()
        if sg_key:
            creds["password"] = sg_key
            if not host:
                creds["host"] = "smtp.sendgrid.net"
            if not user:
                creds["username"] = "apikey"
        elif pwd:
            creds["password"] = pwd
        form_settings: dict[str, str] = {}
        if settings.FROM_EMAIL:
            form_settings["from_email"] = settings.FROM_EMAIL.strip()
        configured = bool(creds.get("host") and (creds.get("password") or creds.get("username")))
        return {
            "provider": provider,
            "configured": configured,
            "credentials": creds,
            "settings": form_settings,
            "key_source": "SENDGRID_API_KEY" if sg_key and (settings.SENDGRID_API_KEY or "").strip().startswith("SG.") else (
                "SMTP_PASSWORD" if pwd.startswith("SG.") else None
            ),
        }

    if provider == "sendgrid":
        key = sendgrid_api_key()
        creds = {"api_key": key} if key else {}
        form_settings = {}
        if settings.FROM_EMAIL:
            form_settings["from_email"] = settings.FROM_EMAIL.strip()
        return {
            "provider": provider,
            "configured": bool(key),
            "credentials": creds,
            "settings": form_settings,
            "key_source": "SENDGRID_API_KEY" if (settings.SENDGRID_API_KEY or "").strip().startswith("SG.") else (
                "SMTP_PASSWORD" if (settings.SMTP_PASSWORD or "").strip().startswith("SG.") else None
            ),
        }

    if provider == "twilio":
        creds = {}
        if settings.TWILIO_ACCOUNT_SID:
            creds["account_sid"] = settings.TWILIO_ACCOUNT_SID.strip()
        if settings.TWILIO_AUTH_TOKEN:
            creds["auth_token"] = settings.TWILIO_AUTH_TOKEN.strip()
        form_settings = {}
        if settings.TWILIO_FROM_NUMBER:
            form_settings["from_number"] = settings.TWILIO_FROM_NUMBER.strip()
        if settings.TWILIO_WHATSAPP_FROM:
            form_settings["whatsapp_from"] = settings.TWILIO_WHATSAPP_FROM.strip()
        configured = bool(creds.get("account_sid") and creds.get("auth_token"))
        return {
            "provider": provider,
            "configured": configured,
            "credentials": creds,
            "settings": form_settings,
        }

    return {"provider": provider, "configured": False, "credentials": {}, "settings": {}}


def get_delivery_status(integrations: list | None = None) -> dict[str, Any]:
    """Report whether email, SMS, and WhatsApp can send for this vendor."""
    by_provider: dict[str, Any] = {}
    for item in integrations or []:
        provider = getattr(item, "provider", None) or (item.get("provider") if isinstance(item, dict) else None)
        if provider:
            by_provider[str(provider)] = item

    def _settings(obj) -> dict:
        if obj is None:
            return {}
        raw = getattr(obj, "settings", None) if not isinstance(obj, dict) else obj.get("settings")
        return dict(raw or {})

    def _connected(obj) -> bool:
        if obj is None:
            return False
        status = getattr(obj, "status", None) if not isinstance(obj, dict) else obj.get("status")
        return status == "connected"

    smtp_def = get_platform_integration_defaults("smtp")
    sg_def = get_platform_integration_defaults("sendgrid")
    twilio_def = get_platform_integration_defaults("twilio")

    smtp_i = by_provider.get("smtp")
    sg_i = by_provider.get("sendgrid")
    twilio_i = by_provider.get("twilio")
    meta_i = by_provider.get("meta_whatsapp")

    email_ready = (
        _connected(smtp_i) or _connected(sg_i)
        or smtp_def.get("configured") or sg_def.get("configured")
    )
    email_provider = None
    if _connected(sg_i) or sg_def.get("configured"):
        email_provider = "sendgrid"
    elif _connected(smtp_i) or smtp_def.get("configured"):
        email_provider = "smtp"

    twilio_settings = {**(twilio_def.get("settings") or {}), **_settings(twilio_i)}
    twilio_ok = _connected(twilio_i) or twilio_def.get("configured")
    from_number = (twilio_settings.get("from_number") or "").strip()
    whatsapp_from = (twilio_settings.get("whatsapp_from") or "").strip()

    sms_missing: list[str] = []
    if not twilio_ok:
        sms_missing.append("Connect Twilio in CRM → Integrations (Account SID + Auth Token)")
    elif not from_number:
        sms_missing.append("Set from_number in Twilio integration settings (E.164, e.g. +14704999996)")

    wa_missing: list[str] = []
    meta_ok = _connected(meta_i)
    if meta_ok:
        whatsapp_ready = True
        whatsapp_provider = "meta_whatsapp"
    elif twilio_ok and whatsapp_from:
        whatsapp_ready = True
        whatsapp_provider = "twilio"
    else:
        whatsapp_ready = False
        whatsapp_provider = None
        if not twilio_ok and not meta_ok:
            wa_missing.append("Connect Twilio or Meta WhatsApp in CRM → Integrations")
        if twilio_ok and not whatsapp_from:
            wa_missing.append(
                "Set whatsapp_from in Twilio settings (sandbox: +14155238886 — separate from SMS from_number)"
            )
            wa_missing.append(
                "Each recipient must join the Twilio WhatsApp sandbox on their phone before messages arrive"
            )

    return {
        "email": {
            "ready": email_ready,
            "provider": email_provider,
            "missing": [] if email_ready else ["Connect SMTP or SendGrid in CRM → Integrations"],
        },
        "sms": {
            "ready": twilio_ok and bool(from_number),
            "provider": "twilio" if twilio_ok else None,
            "missing": sms_missing,
        },
        "whatsapp": {
            "ready": whatsapp_ready,
            "provider": whatsapp_provider,
            "missing": wa_missing,
        },
        "integrations_url": "/crm/integrations",
    }


def merge_platform_defaults(
    provider: str,
    creds: dict[str, Any],
    settings: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Fill blank form fields from platform .env for tests and saves."""
    defaults = get_platform_integration_defaults(provider)
    merged_creds = dict(defaults.get("credentials") or {})
    merged_creds.update({k: v for k, v in creds.items() if _non_empty(v)})
    merged_settings = dict(defaults.get("settings") or {})
    merged_settings.update({k: v for k, v in settings.items() if _non_empty(v)})
    return merged_creds, merged_settings


def resolve_credentials_for_test(
    provider: str,
    *,
    incoming: dict[str, Any] | None,
    stored: dict[str, Any] | None,
    incoming_settings: dict[str, Any] | None,
    stored_settings: dict[str, Any] | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Resolve credentials for integration tests.

    Priority for secrets: form input → platform .env (same as send_email) → saved integration.
    Priority for other fields: platform .env → saved → form overrides all when provided.
    """
    provider = (provider or "").strip().lower()
    incoming = incoming or {}
    stored = stored or {}
    incoming_settings = incoming_settings or {}
    stored_settings = stored_settings or {}

    platform_creds, platform_settings = merge_platform_defaults(provider, {}, {})

    merged: dict[str, Any] = dict(platform_creds)
    merged_settings: dict[str, Any] = dict(platform_settings)

    for key, value in stored.items():
        if key in _SECRET_FIELDS:
            continue
        if _non_empty(value):
            merged[key] = value.strip() if isinstance(value, str) else value

    for key, value in (stored_settings or {}).items():
        if _non_empty(value) and not _non_empty(merged_settings.get(key)):
            merged_settings[key] = value.strip() if isinstance(value, str) else value

    for key, value in incoming.items():
        if _non_empty(value):
            merged[key] = value.strip() if isinstance(value, str) else value

    for key, value in incoming_settings.items():
        if _non_empty(value):
            merged_settings[key] = value.strip() if isinstance(value, str) else value

    if provider in {"smtp", "sendgrid"}:
        explicit = resolve_effective_sendgrid_key(incoming)
        platform = sendgrid_api_key()
        stored_key = resolve_effective_sendgrid_key(stored)
        key = explicit or platform or stored_key
        if key:
            if provider == "smtp":
                merged["password"] = key
                if not _non_empty(merged.get("host")):
                    merged["host"] = "smtp.sendgrid.net"
                if not _non_empty(merged.get("username")):
                    merged["username"] = "apikey"
            else:
                merged["api_key"] = key
    elif provider == "twilio":
        for field in ("auth_token", "account_sid"):
            if not _non_empty(merged.get(field)):
                for source in (incoming, platform_creds, stored):
                    val = (source.get(field) or "").strip()
                    if val:
                        merged[field] = val
                        break

    return merged, merged_settings
