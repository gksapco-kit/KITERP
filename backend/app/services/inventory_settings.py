"""Vendor inventory / catalog coding preferences stored in Vendor.settings JSONB."""
from __future__ import annotations

from typing import Any

INVENTORY_SETTINGS_KEY = "inventory_settings"

DEFAULT_INVENTORY_SETTINGS: dict[str, Any] = {
    # When True, config-engine variant generate fills barcode automatically.
    # When False, barcode is left blank for manual entry.
    "auto_generate_barcode": True,
}


def get_inventory_settings(vendor_settings: dict | None) -> dict[str, Any]:
    raw = (vendor_settings or {}).get(INVENTORY_SETTINGS_KEY) or {}
    if not isinstance(raw, dict):
        raw = {}
    merged = {**DEFAULT_INVENTORY_SETTINGS, **raw}
    merged["auto_generate_barcode"] = bool(merged.get("auto_generate_barcode", True))
    return merged


def is_auto_generate_barcode(vendor_settings: dict | None) -> bool:
    return bool(get_inventory_settings(vendor_settings).get("auto_generate_barcode", True))
