"""Build integration edit-form payloads for the reconfigure UI."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.encryption import decrypt_json
from app.models.crm import CrmIntegration
from app.services.payment_integration_service import get_payment_webhook_url, is_payment_provider

_SECRET_CREDENTIAL_KEYS = frozenset({
    "password",
    "auth_token",
    "api_key",
    "access_token",
    "client_secret",
    "refresh_token",
})


def _is_secret_credential_key(key: str) -> bool:
    key_lower = (key or "").lower()
    if key_lower in _SECRET_CREDENTIAL_KEYS:
        return True
    if key_lower == "account_sid":
        return False
    if "password" in key_lower:
        return True
    if key_lower.endswith("_token") or key_lower.endswith("_secret"):
        return True
    if key_lower.endswith("_key") and key_lower != "account_sid":
        return True
    return False


def redact_integration_settings(settings: dict[str, Any] | None) -> dict[str, Any]:
    """Hide saved phone numbers and emails on the integrations list until OTP is confirmed."""
    out = dict(settings or {})
    for key, value in list(out.items()):
        lower = (key or "").lower()
        sensitive = (
            lower in {"from_number", "whatsapp_from", "voice_caller_id", "from_email", "phone", "email"}
            or "phone" in lower
            or lower.endswith("_number")
            or lower.endswith("_email")
        )
        if sensitive and value not in (None, ""):
            out[key] = ""
    return out


def build_integration_form_payload(integration: CrmIntegration) -> dict[str, Any]:
    """Return settings, all saved credentials, and which fields are secrets."""
    creds = decrypt_json(integration.encrypted_credentials) or {}
    credentials: dict[str, str] = {}
    stored_secrets: list[str] = []

    for key, value in creds.items():
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        text = str(value).strip()
        credentials[key] = text
        if _is_secret_credential_key(key):
            stored_secrets.append(key)

    payload: dict[str, Any] = {
        "id": integration.id,
        "provider": integration.provider,
        "label": integration.label,
        "status": integration.status,
        "settings": dict(integration.settings or {}),
        "credentials": credentials,
        "stored_secrets": stored_secrets,
    }
    if is_payment_provider(integration.provider):
        payload["webhook_url"] = get_payment_webhook_url(integration.provider)
    return payload
