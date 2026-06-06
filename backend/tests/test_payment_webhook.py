"""
Tests for Razorpay payment verification + webhook handling.

These cover the highest-risk money paths:
- Webhook signature verification (accept valid HMAC, reject invalid / missing secret in prod).
- Client-side payment signature verification.
- Webhook idempotency: a duplicate ``payment.captured`` must not re-finalize an
  already-paid order or change the recorded payment reference.

Runs against the in-memory SQLite harness from conftest. The webhook is exercised
through ``PaymentGatewayService`` directly (the FastAPI route is a thin wrapper).
"""

import hashlib
import hmac
import json
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio

from app.config import settings
from app.core.security import get_password_hash
from app.models.customer import Customer
from app.models.order import Order
from app.models.payment import Payment
from app.models.vendor import Vendor
from app.services.payment_gateway_service import PaymentGatewayService

RZP_ORDER_ID = "order_rzp_test_123"
RZP_PAYMENT_ID = "pay_rzp_test_abc"


@pytest_asyncio.fixture
async def order_setup(db_session, test_vendor: Vendor):
    """A pending order + customer + payment row linked to a Razorpay order id."""
    customer = Customer(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        full_name="Webhook Buyer",
        email="buyer@test.com",
        phone="9999999999",
        password_hash=get_password_hash("password123"),
    )
    db_session.add(customer)
    await db_session.flush()

    order = Order(
        id=uuid.uuid4(),
        order_number="ORD-00001",
        vendor_id=test_vendor.id,
        customer_id=customer.id,
        items=[],
        item_count=0,
        subtotal=Decimal("100"),
        total=Decimal("100"),
        status="pending",
        payment_status="pending",
        payment_method="upi",
    )
    db_session.add(order)
    await db_session.flush()

    payment = Payment(
        id=uuid.uuid4(),
        order_id=order.id,
        vendor_id=test_vendor.id,
        amount=Decimal("100"),
        method="upi",
        status="pending",
        gateway_response={"razorpay_order_id": RZP_ORDER_ID},
    )
    db_session.add(payment)
    await db_session.commit()

    return {"vendor": test_vendor, "customer": customer, "order": order}


def _webhook_payload(order: Order, vendor: Vendor) -> dict:
    return {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": RZP_PAYMENT_ID,
                    "order_id": RZP_ORDER_ID,
                    "notes": {
                        "order_id": str(order.id),
                        "vendor_id": str(vendor.id),
                    },
                }
            }
        },
    }


# ── Webhook signature verification ───────────────────────────────

def test_webhook_signature_valid_hmac(db_session, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setattr(settings, "DEBUG", False)
    gw = PaymentGatewayService(db_session)

    body = b'{"event":"payment.captured"}'
    good = hmac.new(b"whsec_test", body, hashlib.sha256).hexdigest()

    assert gw.verify_webhook_signature(body, good) is True
    assert gw.verify_webhook_signature(body, "deadbeef") is False
    assert gw.verify_webhook_signature(body, "") is False


def test_webhook_signature_rejected_when_no_secret_in_prod(db_session, monkeypatch):
    """With no webhook secret configured and DEBUG off, all webhooks are rejected."""
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    monkeypatch.setattr(settings, "DEBUG", False)
    gw = PaymentGatewayService(db_session)

    assert gw.verify_webhook_signature(b"{}", "anything") is False


def test_webhook_signature_dev_bypass_only_in_debug(db_session, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    monkeypatch.setattr(settings, "DEBUG", True)
    gw = PaymentGatewayService(db_session)

    assert gw.verify_webhook_signature(b"{}", "") is True


# ── Client payment signature verification ────────────────────────

def test_razorpay_signature_valid_and_invalid(db_session, test_vendor, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_live_x")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "secret_live")
    monkeypatch.setattr(settings, "DEBUG", False)
    gw = PaymentGatewayService(db_session)

    body = f"{RZP_ORDER_ID}|{RZP_PAYMENT_ID}"
    good = hmac.new(b"secret_live", body.encode(), hashlib.sha256).hexdigest()

    assert gw.verify_razorpay_signature(RZP_ORDER_ID, RZP_PAYMENT_ID, good, test_vendor) is True
    assert gw.verify_razorpay_signature(RZP_ORDER_ID, RZP_PAYMENT_ID, "bad", test_vendor) is False


def test_razorpay_signature_dev_mode(db_session, test_vendor, monkeypatch):
    """In DEBUG with no keys, only the literal dev signature passes."""
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")
    monkeypatch.setattr(settings, "DEBUG", True)
    gw = PaymentGatewayService(db_session)

    assert gw.verify_razorpay_signature(RZP_ORDER_ID, RZP_PAYMENT_ID, "dev_sig", test_vendor) is True
    assert gw.verify_razorpay_signature(RZP_ORDER_ID, RZP_PAYMENT_ID, "wrong", test_vendor) is False


# ── Webhook idempotency + finalization ───────────────────────────

@pytest.mark.asyncio
async def test_webhook_finalizes_pending_order(db_session, order_setup):
    gw = PaymentGatewayService(db_session)
    payload = _webhook_payload(order_setup["order"], order_setup["vendor"])

    result = await gw.handle_razorpay_webhook(payload)
    assert result["ok"] is True
    assert result["order_id"] == str(order_setup["order"].id)

    refreshed = await db_session.get(Order, order_setup["order"].id)
    assert refreshed.payment_status == "paid"
    assert refreshed.status == "confirmed"
    assert refreshed.payment_reference == RZP_PAYMENT_ID


@pytest.mark.asyncio
async def test_webhook_is_idempotent_on_duplicate(db_session, order_setup):
    """A second identical webhook must not re-finalize or alter the order."""
    gw = PaymentGatewayService(db_session)
    payload = _webhook_payload(order_setup["order"], order_setup["vendor"])

    first = await gw.handle_razorpay_webhook(payload)
    assert first["ok"] is True
    assert not first.get("already_paid")

    second = await gw.handle_razorpay_webhook(payload)
    assert second["ok"] is True
    assert second["already_paid"] is True

    refreshed = await db_session.get(Order, order_setup["order"].id)
    assert refreshed.payment_status == "paid"
    assert refreshed.payment_reference == RZP_PAYMENT_ID


@pytest.mark.asyncio
async def test_webhook_ignores_unrelated_events(db_session, order_setup):
    gw = PaymentGatewayService(db_session)
    result = await gw.handle_razorpay_webhook({"event": "order.paid", "payload": {}})
    assert result["ok"] is True
    assert result["ignored"] == "order.paid"

    refreshed = await db_session.get(Order, order_setup["order"].id)
    assert refreshed.payment_status == "pending"


@pytest.mark.asyncio
async def test_webhook_missing_ids(db_session):
    gw = PaymentGatewayService(db_session)
    payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {}}},
    }
    result = await gw.handle_razorpay_webhook(payload)
    assert result["ok"] is False
    assert result["error"] == "missing_ids"


@pytest.mark.asyncio
async def test_webhook_order_not_found(db_session, test_vendor):
    gw = PaymentGatewayService(db_session)
    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_missing",
                    "order_id": "order_missing",
                    "notes": {
                        "order_id": str(uuid.uuid4()),
                        "vendor_id": str(test_vendor.id),
                    },
                }
            }
        },
    }
    result = await gw.handle_razorpay_webhook(payload)
    assert result["ok"] is False
    assert result["error"] == "order_not_found"
