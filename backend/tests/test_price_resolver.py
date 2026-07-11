"""Multi-condition price resolution: party (retail/distributor/agent…),
quantity tiers, and channel price rules actually applying to sale contexts."""
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.vendor_product import Product, ProductPriceRule
from app.services.price_resolver import resolve_items_pricing, resolve_price_for_product, PriceContext


@pytest_asyncio.fixture
async def priced_product(db_session: AsyncSession, test_vendor: Vendor) -> Product:
    product = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Widget",
        slug=f"widget-{uuid.uuid4().hex[:6]}",
        price=1000.00,
        currency="INR",
        status="active",
        product_type="physical",
        quantity=100,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest_asyncio.fixture
async def distributor_customer(db_session: AsyncSession, test_vendor: Vendor) -> Customer:
    customer = Customer(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        full_name="Acme Distribution",
        email="acme@example.com",
        password_hash="x",
        customer_group="distributor",
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


@pytest.mark.asyncio
async def test_party_rule_applies_for_matching_customer_group(
    db_session: AsyncSession, test_vendor: Vendor, priced_product: Product, distributor_customer: Customer,
):
    rule = ProductPriceRule(
        vendor_id=test_vendor.id,
        product_id=priced_product.id,
        rule_type="party",
        name="Distributor rate",
        customer_group="distributor",
        price=800.00,
        is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()

    resolution = await resolve_price_for_product(
        db_session, test_vendor.id, priced_product.id,
        base_price=float(priced_product.price),
        ctx=PriceContext(quantity=1, customer_id=distributor_customer.id, customer_group="distributor"),
    )
    assert resolution.matched is True
    assert resolution.price == 800.0
    assert resolution.rule_type == "party"


@pytest.mark.asyncio
async def test_retail_customer_does_not_get_distributor_price(
    db_session: AsyncSession, test_vendor: Vendor, priced_product: Product,
):
    rule = ProductPriceRule(
        vendor_id=test_vendor.id,
        product_id=priced_product.id,
        rule_type="party",
        name="Distributor rate",
        customer_group="distributor",
        price=800.00,
        is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()

    resolution = await resolve_price_for_product(
        db_session, test_vendor.id, priced_product.id,
        base_price=float(priced_product.price),
        ctx=PriceContext(quantity=1, customer_group="retail"),
    )
    assert resolution.matched is False
    assert resolution.price == 1000.0


@pytest.mark.asyncio
async def test_quantity_tier_beats_lower_priority_party_rule(
    db_session: AsyncSession, test_vendor: Vendor, priced_product: Product, distributor_customer: Customer,
):
    db_session.add_all([
        ProductPriceRule(
            vendor_id=test_vendor.id, product_id=priced_product.id,
            rule_type="party", name="Distributor rate",
            customer_group="distributor", price=800.00, is_active=True, priority=0,
        ),
        ProductPriceRule(
            vendor_id=test_vendor.id, product_id=priced_product.id,
            rule_type="quantity", name="Bulk 50+", min_quantity=50,
            price=700.00, is_active=True, priority=1,
        ),
    ])
    await db_session.commit()

    resolution = await resolve_price_for_product(
        db_session, test_vendor.id, priced_product.id,
        base_price=float(priced_product.price),
        ctx=PriceContext(quantity=60, customer_id=distributor_customer.id, customer_group="distributor"),
    )
    assert resolution.price == 700.0
    assert resolution.rule_type == "quantity"


@pytest.mark.asyncio
async def test_channel_discount_percentage_applies(
    db_session: AsyncSession, test_vendor: Vendor, priced_product: Product,
):
    rule = ProductPriceRule(
        vendor_id=test_vendor.id, product_id=priced_product.id,
        rule_type="channel", name="POS 5% off",
        channel="pos", discount_percentage=5, is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()

    resolution = await resolve_price_for_product(
        db_session, test_vendor.id, priced_product.id,
        base_price=float(priced_product.price),
        ctx=PriceContext(quantity=1, channel="pos"),
    )
    assert resolution.price == 950.0


@pytest.mark.asyncio
async def test_resolve_items_pricing_overrides_cart_items_for_distributor(
    db_session: AsyncSession, test_vendor: Vendor, priced_product: Product, distributor_customer: Customer,
):
    rule = ProductPriceRule(
        vendor_id=test_vendor.id, product_id=priced_product.id,
        rule_type="party", name="Distributor rate",
        customer_group="distributor", price=800.00, is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()

    items = [{"product_id": str(priced_product.id), "qty": 2, "price": 1000.0, "name": "Widget"}]
    resolved = await resolve_items_pricing(
        db_session, test_vendor.id, items,
        customer_id=distributor_customer.id, channel="online",
    )
    assert resolved[0]["price"] == 800.0
    assert resolved[0]["list_price"] == 1000.0
    assert resolved[0]["price_rule"]["type"] == "party"


@pytest.mark.asyncio
async def test_resolve_items_pricing_skips_service_items(
    db_session: AsyncSession, test_vendor: Vendor, priced_product: Product, distributor_customer: Customer,
):
    rule = ProductPriceRule(
        vendor_id=test_vendor.id, product_id=priced_product.id,
        rule_type="party", name="Distributor rate",
        customer_group="distributor", price=800.00, is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()

    items = [{"product_id": str(priced_product.id), "qty": 1, "price": 1000.0, "item_type": "service"}]
    resolved = await resolve_items_pricing(
        db_session, test_vendor.id, items, customer_id=distributor_customer.id,
    )
    assert resolved[0]["price"] == 1000.0
    assert "price_rule" not in resolved[0]
