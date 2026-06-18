"""Tests for order placement notification preference gating."""
from types import SimpleNamespace

from app.services.order_notification_service import (
    customer_order_email_enabled,
    customer_order_sms_enabled,
    customer_order_whatsapp_enabled,
    vendor_order_email_enabled,
    vendor_order_sms_enabled,
    vendor_order_whatsapp_enabled,
    _customer_phone,
    _pick_vendor_phone,
)


def _vendor(**settings):
    return SimpleNamespace(settings=settings)


def test_vendor_order_email_enabled_defaults_true():
    assert vendor_order_email_enabled(_vendor()) is True


def test_vendor_order_email_disabled_when_master_off():
    assert vendor_order_email_enabled(_vendor(notifications={"notifications_enabled": False})) is False


def test_vendor_order_email_disabled_when_email_off():
    assert vendor_order_email_enabled(_vendor(notifications={"email": False})) is False


def test_vendor_order_email_disabled_when_new_orders_off():
    assert vendor_order_email_enabled(_vendor(notification_events={"new_orders": False})) is False


def test_vendor_order_sms_follows_sms_toggle():
    assert vendor_order_sms_enabled(_vendor(notifications={"sms": True})) is True
    assert vendor_order_sms_enabled(_vendor(notifications={"sms": False})) is False


def test_vendor_order_whatsapp_follows_whatsapp_toggle():
    assert vendor_order_whatsapp_enabled(_vendor(notifications={"whatsapp": True})) is True
    assert vendor_order_whatsapp_enabled(_vendor(notifications={"whatsapp": False})) is False


def test_customer_order_email_respects_vendor_toggle():
    v = _vendor(notifications={"email": False})
    assert customer_order_email_enabled(v, {"orderUpdates": True}) is False


def test_customer_order_email_opt_out():
    v = _vendor()
    assert customer_order_email_enabled(v, {"orderUpdates": False}) is False
    assert customer_order_email_enabled(v, {"order_updates": False}) is False


def test_customer_order_email_enabled_when_vendor_on():
    assert customer_order_email_enabled(_vendor(), {}) is True


def test_customer_order_sms_respects_sms_enabled_pref():
    v = _vendor(notifications={"sms": True})
    assert customer_order_sms_enabled(v, {"smsEnabled": True}) is True
    assert customer_order_sms_enabled(v, {"smsEnabled": False}) is False


def test_customer_order_whatsapp_respects_order_updates():
    v = _vendor(notifications={"whatsapp": True})
    assert customer_order_whatsapp_enabled(v, {"orderUpdates": True}) is True
    assert customer_order_whatsapp_enabled(v, {"orderUpdates": False}) is False


def test_customer_phone_from_shipping_address_when_profile_empty():
    customer = SimpleNamespace(
        phone=None,
        shipping_addresses=[],
        default_address_index=0,
    )
    order = SimpleNamespace(
        shipping_address={"phone": "9182895301", "city": "Hyderabad"},
    )
    assert _customer_phone(customer, order) == "9182895301"


def test_customer_phone_prefers_profile_over_shipping():
    customer = SimpleNamespace(
        phone="9652502965",
        shipping_addresses=[],
        default_address_index=0,
    )
    order = SimpleNamespace(shipping_address={"phone": "9182895301"})
    assert _customer_phone(customer, order) == "9652502965"


def test_resolve_vendor_phone_priority():
    assert _pick_vendor_phone(
        support="9703200341", owner="+919703200341", primary="9652502965",
    ) == "9703200341"
    assert _pick_vendor_phone(
        support=None, owner="+919703200341", primary="9652502965",
    ) == "+919703200341"
    assert _pick_vendor_phone(
        support=None, owner=None, primary="9652502965",
    ) == "9652502965"
