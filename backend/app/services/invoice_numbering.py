"""Resolve per-vendor invoice / quotation / receipt number prefix and suffix from saved settings."""

from __future__ import annotations

import re
from typing import Any

DEFAULT_PREFIX_BY_TYPE = {
    "estimate": "EST",
    "invoice": "INV",
    "receipt": "RCT",
    "credit_note": "CN",
}

_SETTINGS_KEY_BY_TYPE = {
    "estimate": "quotation_settings",
    "invoice": "invoice_settings",
    "receipt": "invoice_settings",
    "credit_note": "invoice_settings",
}


def _sanitize_prefix(raw: Any, default: str) -> str:
    s = re.sub(r"[^A-Za-z0-9/]", "", str(raw or "").strip().upper())
    s = re.sub(r"/+", "/", s).strip("/")
    if not s:
        return default
    return s[:24]


def _sanitize_suffix(raw: Any) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "", str(raw or "").strip())[:16]


def _settings_blob(vendor_settings: dict | None, invoice_type: str) -> dict:
    settings = vendor_settings if isinstance(vendor_settings, dict) else {}
    key = _SETTINGS_KEY_BY_TYPE.get(invoice_type, "invoice_settings")
    blob = settings.get(key) or {}
    if not isinstance(blob, dict):
        blob = {}
    if invoice_type == "receipt":
        pos = settings.get("pos_receipt_settings") or {}
        if isinstance(pos, dict) and (pos.get("number_prefix") or pos.get("number_suffix")):
            return {**blob, **{k: pos[k] for k in ("number_prefix", "number_suffix") if k in pos}}
    return blob


def resolve_number_prefix_suffix(vendor_settings: dict | None, invoice_type: str) -> tuple[str, str]:
    """Return (prefix, suffix) for a new document of ``invoice_type``."""
    default_prefix = DEFAULT_PREFIX_BY_TYPE.get(invoice_type, "INV")
    blob = _settings_blob(vendor_settings, invoice_type)
    prefix = _sanitize_prefix(blob.get("number_prefix"), default_prefix)
    suffix = _sanitize_suffix(blob.get("number_suffix"))
    return prefix, suffix


def resolve_number_prefix_suffix_with_overrides(
    vendor_settings: dict | None,
    invoice_type: str,
    *,
    prefix_override: str | None = None,
    suffix_override: str | None = None,
) -> tuple[str, str]:
    """Vendor defaults from settings, with optional per-create overrides."""
    base_prefix, base_suffix = resolve_number_prefix_suffix(vendor_settings, invoice_type)
    default_prefix = DEFAULT_PREFIX_BY_TYPE.get(invoice_type, "INV")
    if prefix_override is not None:
        if str(prefix_override).strip():
            prefix = _sanitize_prefix(prefix_override, default_prefix)
        else:
            prefix = base_prefix
    else:
        prefix = base_prefix
    if suffix_override is not None:
        suffix = _sanitize_suffix(suffix_override)
    else:
        suffix = base_suffix
    return prefix, suffix


def format_invoice_number(prefix: str, financial_year: str, sequence: int, suffix: str = "") -> str:
    fy_short = financial_year.replace("-", "")
    base = f"{prefix}/{fy_short}/{sequence:04d}"
    if suffix:
        return f"{base}-{suffix}"
    return base
