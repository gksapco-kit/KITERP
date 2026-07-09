"""Normalize social & web links before persistence and public resolution."""
from __future__ import annotations

import re
from typing import Any, Mapping


_WHATSAPP_HTTP = re.compile(r"^https?://", re.I)
_WA_ME = re.compile(r"wa\.me/", re.I)
_WEB_HOST = re.compile(r"^[\w.-]+\.[a-z]{2,}", re.I)


def _normalize_whatsapp(raw: str) -> str:
    value = raw.strip()
    if not value:
        return ""
    if _WHATSAPP_HTTP.search(value) or value.startswith("//"):
        return value
    if _WA_ME.search(value):
        return value if value.startswith("http") else f"https://{value.lstrip('/')}"
    digits = re.sub(r"\D", "", value.removeprefix("whatsapp:"))
    return f"https://wa.me/{digits}" if digits else ""


def _normalize_url(raw: str) -> str:
    value = raw.strip()
    if not value:
        return ""
    if _WHATSAPP_HTTP.search(value) or value.startswith("//"):
        return value
    if _WEB_HOST.search(value) or value.startswith("www."):
        return f"https://{value.lstrip('/')}"
    return value


def normalize_social_link_value(platform: str, raw: Any) -> str:
    if not isinstance(raw, str):
        return ""
    value = raw.strip()
    if not value:
        return ""
    key = platform.lower()
    if key == "whatsapp":
        return _normalize_whatsapp(value)
    return _normalize_url(value)


def normalize_social_links(links: Mapping[str, Any] | None) -> dict[str, str]:
    if not isinstance(links, Mapping):
        return {}
    out: dict[str, str] = {}
    for key, val in links.items():
        normalized = normalize_social_link_value(str(key), val)
        if normalized:
            out[str(key)] = normalized
    return out
