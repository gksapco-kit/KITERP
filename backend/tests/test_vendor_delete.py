"""Admin business-account delete must succeed when only non-order data exists."""
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.core.security import get_password_hash
from app.models.cart import Cart
from app.models.crm import CrmAccount
from app.models.customer import Customer
from app.models.lead import Lead, Quote
from app.models.notification import Notification
from app.models.order import Order
from app.models.vendor import Vendor
from app.services.vendor_service import VendorService


async def _customer(db, vendor: Vendor) -> Customer:
    customer = Customer(
        id=uuid.uuid4(),
        vendor_id=vendor.id,
        full_name="Test Customer",
        email="cust@test.com",
        password_hash=get_password_hash("password123"),
    )
    db.add(customer)
    await db.flush()
    return customer


@pytest.mark.asyncio
async def test_delete_vendor_with_crm_and_storefront_data(
    db_session, test_vendor: Vendor, test_user
):
    customer = await _customer(db_session, test_vendor)
    db_session.add(
        Cart(id=uuid.uuid4(), vendor_id=test_vendor.id, customer_id=customer.id, items=[])
    )
    db_session.add(
        Notification(
            id=uuid.uuid4(),
            vendor_id=test_vendor.id,
            title="Welcome",
            message="hello",
        )
    )
    lead = Lead(
        id=uuid.uuid4(),
        customer_name="Lead Person",
        category="dairy",
        title="Need milk crate",
    )
    db_session.add(lead)
    await db_session.flush()
    db_session.add(
        Quote(
            id=uuid.uuid4(),
            lead_id=lead.id,
            vendor_id=test_vendor.id,
            price=100,
        )
    )
    db_session.add(
        CrmAccount(
            id=uuid.uuid4(),
            vendor_id=test_vendor.id,
            number="ACC-1",
            name="Doda CRM",
        )
    )
    await db_session.commit()

    vendor_id = test_vendor.id
    await VendorService(db_session).delete_vendor(vendor_id, test_user.id)

    remaining = await db_session.get(Vendor, vendor_id)
    assert remaining is None
    assert await db_session.scalar(
        select(func.count()).select_from(Customer).where(Customer.vendor_id == vendor_id)
    ) == 0
    assert await db_session.scalar(
        select(func.count()).select_from(Quote).where(Quote.vendor_id == vendor_id)
    ) == 0
    assert await db_session.scalar(
        select(func.count()).select_from(CrmAccount).where(CrmAccount.vendor_id == vendor_id)
    ) == 0


@pytest.mark.asyncio
async def test_delete_vendor_blocked_when_customer_orders_exist(
    db_session, test_vendor: Vendor, test_user
):
    customer = await _customer(db_session, test_vendor)
    db_session.add(
        Order(
            id=uuid.uuid4(),
            order_number="ORD-1001",
            vendor_id=test_vendor.id,
            customer_id=customer.id,
            subtotal=10,
            total=10,
        )
    )
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await VendorService(db_session).delete_vendor(test_vendor.id, test_user.id)

    assert exc_info.value.status_code == 400
    assert "customer orders" in exc_info.value.detail
    assert await db_session.get(Vendor, test_vendor.id) is not None
