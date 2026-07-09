"""Social & web links visibility mode (shared vs per business unit)."""
from __future__ import annotations

from typing import Any, Mapping

from app.utils.social_link_normalize import normalize_social_links


SOCIAL_LINKS_MODE_KEY = "social_links_mode"


def resolve_social_links_mode(settings: Mapping[str, Any] | None) -> str:
    """Return ``shared`` or ``per_unit`` (default mirrors storefront link mode)."""
    if not settings:
        return "shared"
    explicit = settings.get(SOCIAL_LINKS_MODE_KEY)
    if explicit in ("shared", "per_unit"):
        return explicit
    link_mode = settings.get("storefront_link_mode")
    return "shared" if link_mode == "single" else "per_unit"


def _clean_links(raw: Any) -> dict[str, str]:
    if not isinstance(raw, Mapping):
        return {}
    out: dict[str, str] = {}
    for key, val in raw.items():
        if isinstance(val, str) and val.strip():
            out[str(key)] = val.strip()
    return out


def resolve_public_social_links(vendor, store=None) -> dict[str, str]:
    """Resolve storefront social links — shared vendor links or per-unit overrides."""
    vendor_links = normalize_social_links(getattr(vendor, "social_links", None) or {})
    mode = resolve_social_links_mode(getattr(vendor, "settings", None))
    if mode == "shared" or not store:
        return vendor_links

    store_settings = getattr(store, "settings", None) or {}
    store_links = normalize_social_links(store_settings.get("social_links"))
    if not store_links:
        return vendor_links

    merged = dict(vendor_links)
    merged.update(store_links)
    return merged
