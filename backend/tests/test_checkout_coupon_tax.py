"""
Checkout total / coupon / GST correctness tests (revenue integrity).

Covers:
- Server recomputes subtotal/tax/total from items (intra-state CGST+SGST,
  inter-state IGST, non-GST vendor).
- Coupon validation: percentage (with max-discount cap), flat, expired,
  below-minimum, usage-limit reached, per-customer limit.
- ``record_usage`` increments the coupon counter exactly once.
- Preview integrates a valid coupon into the final total.

Runs on the in-memory SQLite harness from conftest.
"""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.security import get_password_hash
from app.models.coupon import Coupon, CouponUsage
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.services.checkout_service import CheckoutService
from app.services.coupon_service import CouponService


@pytest_asyncio.fixture
async def gst_vendor(db_session, test_vendor: Vendor) -> Vendor:
    test_vendor.is_gst_registered = True
    test_vendor.default_tax_rate = 18
    test_vendor.state = "Karnataka"
    db_session.add(test_vendor)
    await db_session.commit()
    await db_session.refresh(test_vendor)
    return test_vendor


@pytest_asyncio.fixture
async def taxed_product(db_session, test_vendor: Vendor, test_user) -> Product:
    product = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Taxed Item",
        slug=f"taxed-{uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        currency="INR",
        status="active",
        product_type="physical",
        tax_rate=18,
        created_by=test_user.id,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest_asyncio.fixture
async def a_customer(db_session, test_vendor: Vendor) -> Customer:
    customer = Customer(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        full_name="Coupon Customer",
        email="coupon@test.com",
        phone="9888877766",
        password_hash=get_password_hash("password123"),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


def _items(product: Product, qty: int = 2, price: float = 100.0):
    return [{"product_id": str(product.id), "qty": qty, "price": price, "name": product.name}]


# ── Tax computation ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_intra_state_cgst_sgst_split(db_session, gst_vendor, taxed_product):
    svc = CheckoutService(db_session)
    preview = await svc.preview(
        gst_vendor, _items(taxed_product), shipping_method_id="free",
        shipping_state="Karnataka",
    )
    assert preview["subtotal"] == 200.0
    assert preview["is_inter_state"] is False
    assert preview["cgst_amount"] == 18.0
    assert preview["sgst_amount"] == 18.0
    assert preview["igst_amount"] == 0.0
    assert preview["tax_amount"] == 36.0
    assert preview["total"] == 236.0


@pytest.mark.asyncio
async def test_inter_state_igst(db_session, gst_vendor, taxed_product):
    svc = CheckoutService(db_session)
    preview = await svc.preview(
        gst_vendor, _items(taxed_product), shipping_method_id="free",
        shipping_state="Maharashtra",
    )
    assert preview["is_inter_state"] is True
    assert preview["igst_amount"] == 36.0
    assert preview["cgst_amount"] == 0.0
    assert preview["tax_amount"] == 36.0
    assert preview["total"] == 236.0


@pytest.mark.asyncio
async def test_non_gst_vendor_no_tax(db_session, test_vendor, taxed_product):
    # test_vendor is not GST-registered by default
    svc = CheckoutService(db_session)
    preview = await svc.preview(
        test_vendor, _items(taxed_product), shipping_state="Karnataka",
    )
    assert preview["tax_amount"] == 0.0
    assert preview["total"] == 200.0


@pytest.mark.asyncio
async def test_shipping_added_to_total(db_session, test_vendor, taxed_product):
    svc = CheckoutService(db_session)
    preview = await svc.preview(
        test_vendor, _items(taxed_product), shipping_method_id="express",
    )
    # express = 99
    assert preview["shipping_amount"] == 99.0
    assert preview["total"] == 299.0


@pytest.mark.asyncio
async def test_free_delivery_threshold_waives_shipping(db_session, test_vendor, taxed_product):
    test_vendor.settings = {
        "delivery_conditions": {
            "enabled": True,
            "free_delivery_threshold": 499,
            "minimum_delivery_charge": 49,
        },
    }
    db_session.add(test_vendor)
    await db_session.commit()
    await db_session.refresh(test_vendor)

    svc = CheckoutService(db_session)
    below = await svc.preview(
        test_vendor, _items(taxed_product, qty=2, price=100.0), shipping_method_id="express",
    )
    assert below["shipping_amount"] == 49.0
    assert below["free_delivery_applied"] is False

    above = await svc.preview(
        test_vendor, _items(taxed_product, qty=5, price=100.0), shipping_method_id="express",
    )
    assert above["subtotal"] == 500.0
    assert above["shipping_amount"] == 99.0
    assert above["free_delivery_applied"] is False
    assert above["total"] == 599.0

    above_free = await svc.preview(
        test_vendor, _items(taxed_product, qty=5, price=100.0), shipping_method_id="free",
    )
    assert above_free["shipping_amount"] == 0.0
    assert above_free["free_delivery_applied"] is True
    assert above_free["total"] == 500.0


@pytest.mark.asyncio
async def test_free_delivery_threshold_exact_amount(db_session, test_vendor, taxed_product):
    test_vendor.settings = {
        "delivery_conditions": {
            "enabled": True,
            "free_delivery_threshold": 499,
            "minimum_delivery_charge": 49,
        },
    }
    db_session.add(test_vendor)
    await db_session.commit()
    await db_session.refresh(test_vendor)

    svc = CheckoutService(db_session)
    preview = await svc.preview(
        test_vendor,
        _items(taxed_product, qty=1, price=499.0),
        shipping_method_id="express",
    )
    assert preview["subtotal"] == 499.0
    assert preview["shipping_amount"] == 99.0
    assert preview["free_delivery_applied"] is False
    assert preview["total"] == 598.0

    preview_free = await svc.preview(
        test_vendor,
        _items(taxed_product, qty=1, price=499.0),
        shipping_method_id="free",
    )
    assert preview_free["shipping_amount"] == 0.0
    assert preview_free["free_delivery_applied"] is True


@pytest.mark.asyncio
async def test_calculate_gst_disabled(db_session, gst_vendor, taxed_product):
    gst_vendor.settings = {
        "delivery_conditions": {
            "enabled": True,
            "calculate_gst": False,
        },
    }
    db_session.add(gst_vendor)
    await db_session.commit()
    await db_session.refresh(gst_vendor)

    svc = CheckoutService(db_session)
    preview = await svc.preview(
        gst_vendor, _items(taxed_product), shipping_method_id="free",
        shipping_state="Karnataka",
    )
    assert preview["calculate_gst"] is False
    assert preview["tax_amount"] == 0.0
    assert preview["total"] == 200.0


# ── Coupon validation ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_coupon_percentage_with_cap(db_session, test_vendor):
    svc = CouponService(db_session)
    db_session.add(Coupon(
        vendor_id=test_vendor.id, code="SAVE10", discount_type="percentage",
        discount_value=Decimal("10"), max_discount=Decimal("50"), is_active=True,
    ))
    await db_session.commit()

    # 10% of 1000 = 100, capped at 50
    result = await svc.validate_coupon(test_vendor.id, "SAVE10", 1000.0)
    assert result["valid"] is True
    assert result["discount_amount"] == 50.0


@pytest.mark.asyncio
async def test_coupon_flat_discount(db_session, test_vendor):
    svc = CouponService(db_session)
    db_session.add(Coupon(
        vendor_id=test_vendor.id, code="FLAT100", discount_type="flat",
        discount_value=Decimal("100"), is_active=True,
    ))
    await db_session.commit()

    result = await svc.validate_coupon(test_vendor.id, "FLAT100", 500.0)
    assert result["valid"] is True
    assert result["discount_amount"] == 100.0


@pytest.mark.asyncio
async def test_coupon_expired(db_session, test_vendor):
    svc = CouponService(db_session)
    db_session.add(Coupon(
        vendor_id=test_vendor.id, code="OLD", discount_type="flat",
        discount_value=Decimal("100"), is_active=True,
        expires_at=datetime.utcnow() - timedelta(days=1),
    ))
    await db_session.commit()

    result = await svc.validate_coupon(test_vendor.id, "OLD", 500.0)
    assert result["valid"] is False
    assert "expired" in result["message"].lower()


@pytest.mark.asyncio
async def test_coupon_below_minimum(db_session, test_vendor):
    svc = CouponService(db_session)
    db_session.add(Coupon(
        vendor_id=test_vendor.id, code="MIN500", discount_type="flat",
        discount_value=Decimal("100"), min_order_amount=Decimal("500"), is_active=True,
    ))
    await db_session.commit()

    result = await svc.validate_coupon(test_vendor.id, "MIN500", 100.0)
    assert result["valid"] is False


@pytest.mark.asyncio
async def test_coupon_usage_limit_reached(db_session, test_vendor):
    svc = CouponService(db_session)
    db_session.add(Coupon(
        vendor_id=test_vendor.id, code="LIMITED", discount_type="flat",
        discount_value=Decimal("100"), usage_limit=1, times_used=1, is_active=True,
    ))
    await db_session.commit()

    result = await svc.validate_coupon(test_vendor.id, "LIMITED", 500.0)
    assert result["valid"] is False
    assert "limit" in result["message"].lower()


@pytest.mark.asyncio
async def test_coupon_per_customer_limit(db_session, test_vendor, a_customer):
    svc = CouponService(db_session)
    coupon = Coupon(
        vendor_id=test_vendor.id, code="ONCE", discount_type="flat",
        discount_value=Decimal("100"), usage_per_customer=1, is_active=True,
    )
    db_session.add(coupon)
    await db_session.flush()
    db_session.add(CouponUsage(
        coupon_id=coupon.id, customer_id=a_customer.id,
        order_id=uuid.uuid4(), discount_applied=Decimal("100"),
    ))
    await db_session.commit()

    result = await svc.validate_coupon(
        test_vendor.id, "ONCE", 500.0, customer_id=a_customer.id,
    )
    assert result["valid"] is False


@pytest.mark.asyncio
async def test_record_usage_increments_counter_once(db_session, test_vendor, a_customer):
    svc = CouponService(db_session)
    coupon = Coupon(
        vendor_id=test_vendor.id, code="TRACK", discount_type="flat",
        discount_value=Decimal("100"), is_active=True, times_used=0,
    )
    db_session.add(coupon)
    await db_session.commit()

    await svc.record_usage(coupon.id, a_customer.id, uuid.uuid4(), 100.0)
    refreshed = await db_session.get(Coupon, coupon.id)
    assert refreshed.times_used == 1


@pytest.mark.asyncio
async def test_invalid_code_rejected(db_session, test_vendor):
    svc = CouponService(db_session)
    result = await svc.validate_coupon(test_vendor.id, "NOPE", 500.0)
    assert result["valid"] is False
    assert "invalid" in result["message"].lower()


# ── Preview integrates coupon ────────────────────────────────────

@pytest.mark.asyncio
async def test_preview_applies_coupon_to_total(db_session, test_vendor, taxed_product):
    db_session.add(Coupon(
        vendor_id=test_vendor.id, code="TENOFF", discount_type="percentage",
        discount_value=Decimal("10"), is_active=True,
    ))
    await db_session.commit()

    svc = CheckoutService(db_session)
    preview = await svc.preview(
        test_vendor, _items(taxed_product), coupon_code="TENOFF",
    )
    # subtotal 200, 10% off = 20, no tax (non-GST), no shipping
    assert preview["discount_amount"] == 20.0
    assert preview["coupon_valid"] is True
    assert preview["total"] == 180.0
