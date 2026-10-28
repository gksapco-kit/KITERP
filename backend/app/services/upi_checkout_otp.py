"""Decide when a vendor or store update is changing UPI checkout secrets."""
from __future__ import annotations

from typing import Any, Optional

UPI_CHECKOUT_MODE_KEY = "upi_checkout_mode"


def _norm_manual_upi(raw: Any) -> Optional[tuple]:
    if not isinstance(raw, dict):
        return None
    label = str(raw.get("label") or "UPI").strip() or "UPI"
    return (
        bool(raw.get("enabled")),
        str(raw.get("upi_id") or "").strip(),
        str(raw.get("qr_code_url") or "").strip(),
        label,
    )


def _manual_upi_from_theme(theme: Any) -> tuple[bool, Optional[tuple]]:
    """(present in payload, normalized value). Absent means this update does not touch UPI."""
    if not isinstance(theme, dict):
        return False, None
    checkout = theme.get("checkout")
    if not isinstance(checkout, dict) or "manual_upi" not in checkout:
        return False, None
    return True, _norm_manual_upi(checkout.get("manual_upi"))


def vendor_update_needs_upi_otp(vendor: Any, update: dict) -> bool:
    """True when this vendor update changes the shared UPI ID/QR or the UPI scope."""
    if "theme_config" in update and update.get("theme_config") is not None:
        present, incoming = _manual_upi_from_theme(update.get("theme_config"))
        if present:
            _, current = _manual_upi_from_theme(getattr(vendor, "theme_config", None))
            if incoming != current:
                return True

    settings = update.get("settings")
    if isinstance(settings, dict) and UPI_CHECKOUT_MODE_KEY in settings:
        current_settings = getattr(vendor, "settings", None) or {}
        if settings.get(UPI_CHECKOUT_MODE_KEY) != current_settings.get(UPI_CHECKOUT_MODE_KEY):
            return True
    return False


def store_update_needs_upi_otp(store: Any, settings: Optional[dict]) -> bool:
    """True when this store update sets or clears that unit's UPI override."""
    if not isinstance(settings, dict) or "manual_upi" not in settings:
        return False
    current = _norm_manual_upi((getattr(store, "settings", None) or {}).get("manual_upi"))
    return _norm_manual_upi(settings.get("manual_upi")) != current
