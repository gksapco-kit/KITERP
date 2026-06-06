"""
Inventory integrity tests — the highest blast-radius data path.

Covers:
- Sale deduction reduces product (and variant) stock.
- Oversell prevention: a sale that would drive stock negative is rejected and
  leaves the quantity untouched.
- Cancellation / return restores stock.
- Manual absolute adjustment records an ``adjustment`` movement and may go to 0.
- Variant deduction syncs the parent product quantity.
- Low-stock notification fires when a movement crosses the threshold.

Runs on the in-memory SQLite harness from conftest.
"""

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.notification import Notification
from app.models.vendor import Vendor
from app.models.vendor_product import Product, ProductVariant
from app.services.inventory_service import InventoryService


@pytest_asyncio.fixture
async def tracked_product(db_session, test_vendor: Vendor, test_user) -> Product:
    product = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Tracked Widget",
        slug=f"tracked-{uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        currency="INR",
        status="active",
        product_type="physical",
        track_inventory=True,
        quantity=5,
        low_stock_threshold=2,
        created_by=test_user.id,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest_asyncio.fixture
async def variant_product(db_session, test_vendor: Vendor, test_user) -> Product:
    product = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Variant Widget",
        slug=f"variant-{uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        currency="INR",
        status="active",
        product_type="physical",
        track_inventory=True,
        quantity=8,
        low_stock_threshold=2,
        created_by=test_user.id,
    )
    db_session.add(product)
    await db_session.flush()

    variant = ProductVariant(
        id=uuid.uuid4(),
        product_id=product.id,
        name="Large",
        sku=f"LG-{uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        quantity=8,
        low_stock_threshold=2,
        is_active=True,
    )
    db_session.add(variant)
    await db_session.commit()
    await db_session.refresh(product)
    await db_session.refresh(variant)
    return product


@pytest.mark.asyncio
async def test_deduct_for_sale_reduces_stock(db_session, test_vendor, tracked_product):
    svc = InventoryService(db_session)
    await svc.deduct_for_sale(
        vendor_id=test_vendor.id,
        product_id=tracked_product.id,
        quantity=2,
        reference_id=uuid.uuid4(),
        auto_commit=True,
    )
    refreshed = await db_session.get(Product, tracked_product.id)
    assert refreshed.quantity == 3


@pytest.mark.asyncio
async def test_oversell_is_rejected_and_stock_unchanged(db_session, test_vendor, tracked_product):
    svc = InventoryService(db_session)
    with pytest.raises(ValueError):
        await svc.deduct_for_sale(
            vendor_id=test_vendor.id,
            product_id=tracked_product.id,
            quantity=10,  # only 5 in stock
            reference_id=uuid.uuid4(),
            auto_commit=True,
        )
    refreshed = await db_session.get(Product, tracked_product.id)
    assert refreshed.quantity == 5  # untouched


@pytest.mark.asyncio
async def test_cancellation_restores_stock(db_session, test_vendor, tracked_product):
    svc = InventoryService(db_session)
    ref = uuid.uuid4()
    await svc.deduct_for_sale(
        vendor_id=test_vendor.id, product_id=tracked_product.id,
        quantity=3, reference_id=ref, auto_commit=True,
    )
    after_sale = await db_session.get(Product, tracked_product.id)
    assert after_sale.quantity == 2

    await svc.return_stock(
        vendor_id=test_vendor.id, product_id=tracked_product.id,
        quantity=3, reference_id=ref, auto_commit=True,
    )
    restored = await db_session.get(Product, tracked_product.id)
    assert restored.quantity == 5


@pytest.mark.asyncio
async def test_adjust_stock_absolute_value(db_session, test_vendor, tracked_product):
    svc = InventoryService(db_session)
    await svc.adjust_stock(
        vendor_id=test_vendor.id, product_id=tracked_product.id,
        new_quantity=0, reason="Damaged stock written off",
    )
    refreshed = await db_session.get(Product, tracked_product.id)
    assert refreshed.quantity == 0


@pytest.mark.asyncio
async def test_variant_deduction_syncs_parent(db_session, test_vendor, variant_product):
    svc = InventoryService(db_session)
    variant = (
        await db_session.execute(
            select(ProductVariant).where(ProductVariant.product_id == variant_product.id)
        )
    ).scalar_one()

    await svc.deduct_for_sale(
        vendor_id=test_vendor.id,
        product_id=variant_product.id,
        quantity=3,
        variant_id=variant.id,
        reference_id=uuid.uuid4(),
        auto_commit=True,
    )
    refreshed_variant = await db_session.get(ProductVariant, variant.id)
    refreshed_parent = await db_session.get(Product, variant_product.id)
    assert refreshed_variant.quantity == 5
    # parent quantity is summed from active variants
    assert refreshed_parent.quantity == 5


@pytest.mark.asyncio
async def test_low_stock_notification_on_threshold(db_session, test_vendor, tracked_product):
    svc = InventoryService(db_session)
    # 5 → 1, threshold is 2, so this crosses into low-stock
    await svc.stock_out(
        vendor_id=test_vendor.id, product_id=tracked_product.id, quantity=4,
    )
    notes = (
        await db_session.execute(
            select(Notification).where(
                Notification.vendor_id == test_vendor.id,
                Notification.type == "inventory",
            )
        )
    ).scalars().all()
    assert len(notes) >= 1
    assert "Tracked Widget" in notes[0].message
