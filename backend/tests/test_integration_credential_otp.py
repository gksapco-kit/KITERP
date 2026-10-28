"""Grant checks for the integration credential OTP. No database."""
from datetime import datetime, timedelta, timezone

from app.services.integration_credential_otp import (
    _digest,
    code_matches,
    grant_matches,
)


def _now():
    return datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)


def test_code_matches_only_before_expiry():
    now = _now()
    state = {
        "code_hash": _digest("123456"),
        "via_verify": False,
        "expires_at": (now + timedelta(minutes=5)).isoformat(),
    }
    assert code_matches(state, "123456", now)
    assert not code_matches(state, "000000", now)
    assert not code_matches(state, "123456", now + timedelta(minutes=6))


def test_verify_marker_is_not_a_local_code():
    now = _now()
    state = {
        "code_hash": _digest("123456"),
        "via_verify": True,
        "expires_at": (now + timedelta(minutes=5)).isoformat(),
    }
    assert not code_matches(state, "123456", now)


def test_upi_save_requires_otp_only_when_the_id_changes():
    from types import SimpleNamespace
    from app.services.upi_checkout_otp import store_update_needs_upi_otp, vendor_update_needs_upi_otp

    vendor = SimpleNamespace(
        theme_config={"checkout": {"manual_upi": {"enabled": True, "upi_id": "shop@upi", "qr_code_url": "", "label": "UPI"}}},
        settings={"upi_checkout_mode": "shared"},
    )
    same_theme = {"theme_config": vendor.theme_config}
    assert vendor_update_needs_upi_otp(vendor, same_theme) is False
    changed = {
        "theme_config": {
            "checkout": {"manual_upi": {"enabled": True, "upi_id": "other@upi", "qr_code_url": "", "label": "UPI"}},
        },
    }
    assert vendor_update_needs_upi_otp(vendor, changed) is True
    assert vendor_update_needs_upi_otp(vendor, {"settings": {"timezone": "Asia/Kolkata"}}) is False
    assert vendor_update_needs_upi_otp(vendor, {"settings": {"upi_checkout_mode": "per_unit"}}) is True

    store = SimpleNamespace(settings={"manual_upi": {"enabled": True, "upi_id": "shop@upi", "qr_code_url": "", "label": "UPI"}})
    assert store_update_needs_upi_otp(store, {"name": "Ravi"}) is False
    assert store_update_needs_upi_otp(store, {"manual_upi": store.settings["manual_upi"]}) is False
    assert store_update_needs_upi_otp(store, {"manual_upi": None}) is True


def test_grant_matches_until_expiry():
    now = _now()
    state = {
        "grant_hash": _digest("token-abc"),
        "grant_expires_at": (now + timedelta(minutes=10)).isoformat(),
    }
    assert grant_matches(state, "token-abc", now)
    assert not grant_matches(state, "other", now)
    assert not grant_matches(state, None, now)
    assert not grant_matches(state, "token-abc", now + timedelta(minutes=11))
