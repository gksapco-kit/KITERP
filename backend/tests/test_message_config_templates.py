"""Tests for scheduled customer message templates."""
from datetime import datetime, timezone, timedelta

from app.services.message_config_service import (
    render_customer_template_text,
    resolve_active_customer_template,
)


def _config_with_templates(templates: list[dict]) -> dict:
    return {
        "events": {
            "new_orders": {
                "email_recipients": [],
                "phone_recipients": [],
                "customer_templates": templates,
            },
        },
        "vendor_channels": {"email": True, "sms": False, "whatsapp": False},
        "customer_channels": {"email": True, "sms": False, "whatsapp": False},
    }


def test_resolve_active_customer_template_by_schedule():
    now = datetime(2026, 6, 20, 12, 0, tzinfo=timezone.utc)
    cfg = _config_with_templates([
        {
            "id": "a",
            "name": "Summer",
            "message": "Hi {customer_name}",
            "start_at": "2026-06-01T00:00:00Z",
            "end_at": "2026-06-30T23:59:59Z",
            "channels": ["email"],
            "enabled": True,
        },
        {
            "id": "b",
            "name": "June promo",
            "message": "Promo {order_number}",
            "start_at": "2026-06-20T00:00:00Z",
            "end_at": "2026-06-20T23:59:59Z",
            "channels": ["email"],
            "enabled": True,
        },
    ])
    active = resolve_active_customer_template(cfg, "new_orders", "email", at=now)
    assert active is not None
    assert active["id"] == "b"


def test_resolve_skips_disabled_and_out_of_range():
    now = datetime(2026, 6, 20, 12, 0, tzinfo=timezone.utc)
    cfg = _config_with_templates([
        {
            "id": "old",
            "name": "Expired",
            "message": "Old",
            "start_at": "2026-01-01T00:00:00Z",
            "end_at": "2026-03-01T00:00:00Z",
            "channels": ["email"],
            "enabled": True,
        },
    ])
    assert resolve_active_customer_template(cfg, "new_orders", "email", at=now) is None


def test_render_customer_template_text():
    text = render_customer_template_text(
        "Hi {customer_name}, order {order_number} at {store_name}",
        {"customer_name": "Ravi", "order_number": "ORD-1", "store_name": "Store"},
    )
    assert text == "Hi Ravi, order ORD-1 at Store"
