"""
Regression tests for POSService.create_transaction.

Covers the failure modes behind the generic "A database error occurred" toast:
- transaction numbers must be sequential and continue from existing data
- tip / service charge are stored and included in the total
- a customer-level compliance failure (wholesale licence) surfaces its real
  message instead of an internal MissingGreenlet error
- friendly DB error mapping covers the common Postgres failure types
"""

import uuid
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.vendor_pos import _friendly_db_error
from app.core.security import get_password_hash
from app.models.customer import Customer
from app.models.pos import POSSession, POSTransaction
from app.models.store import Store
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.services.pos_service import POSService


@pytest_asyncio.fixture
async def store(db_session: AsyncSession, test_vendor: Vendor) -> Store:
    s = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Main BU")
    db_session.add(s)
    await db_session.commit()
    return s


@pytest_asyncio.fixture
async def pos_session(
    db_session: AsyncSession, test_vendor: Vendor, test_user: User, store: Store
) -> POSSession:
    sess = POSSession(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        store_id=store.id,
        opened_by=test_user.id,
        session_date=date.today(),
        status="open",
    )
    db_session.add(sess)
    await db_session.commit()
    return sess


@pytest.fixture
def ctx(test_vendor, test_user, pos_session, store, test_product):
    """Plain values captured up-front (ORM objects expire after a rollback)."""
    return {
        "vendor_id": test_vendor.id,
        "cashier_id": test_user.id,
        "session_id": pos_session.id,
        "store_id": store.id,
        "product_id": str(test_product.id),
        "product_name": test_product.name,
    }


async def _sell(db: AsyncSession, c: dict, **kw):
    return await POSService(db).create_transaction(
        vendor_id=c["vendor_id"],
        session_id=c["session_id"],
        cashier_id=c["cashier_id"],
        store_id=c["store_id"],
        items=[{
            "product_id": c["product_id"],
            "name": c["product_name"],
            "qty": 1,
            "price": 100,
            "discount": 0,
            "tax_rate": 0,
            "item_type": "product",
        }],
        payment_methods=[{"method": "upi", "amount": 100}],
        transaction_type="sale",
        **kw,
    )


@pytest.mark.asyncio
async def test_consecutive_sales_get_sequential_numbers(db_session, ctx):
    first = await _sell(db_session, ctx)
    second = await _sell(db_session, ctx)
    assert first["txn"].transaction_number == "POS-000001"
    assert second["txn"].transaction_number == "POS-000002"


@pytest.mark.asyncio
async def test_numbering_continues_from_existing_transactions(db_session, ctx):
    """The sequence must be seeded from the highest existing POS number."""
    db_session.add(POSTransaction(
        id=uuid.uuid4(),
        vendor_id=ctx["vendor_id"],
        session_id=ctx["session_id"],
        cashier_id=ctx["cashier_id"],
        transaction_number="POS-000041",
        transaction_type="sale",
        items=[],
        subtotal=0,
        total=0,
        status="completed",
    ))
    await db_session.commit()

    result = await _sell(db_session, ctx)
    assert result["txn"].transaction_number == "POS-000042"


@pytest.mark.asyncio
async def test_tip_and_service_charge_are_stored_and_totalled(db_session, ctx):
    result = await _sell(db_session, ctx, tip_amount=10, service_charge_amount=5)
    txn = result["txn"]
    assert float(txn.tip_amount) == 10
    assert float(txn.service_charge_amount) == 5
    assert float(txn.total) == 115  # 100 item + 10 tip + 5 service charge


@pytest.mark.asyncio
async def test_missing_wholesale_licence_surfaces_real_message(
    db_session, test_vendor, ctx
):
    """Previously this was masked as a MissingGreenlet / generic database error."""
    test_vendor.settings = {"pharma": {"wholesale_license_check": True}}
    customer = Customer(
        id=uuid.uuid4(),
        vendor_id=ctx["vendor_id"],
        full_name="No Licence Buyer",
        password_hash=get_password_hash("x"),
    )
    db_session.add(customer)
    await db_session.commit()

    with pytest.raises(ValueError, match="wholesale license number required"):
        await _sell(db_session, ctx, customer_id=customer.id)


@pytest.mark.parametrize(
    "message, expected",
    [
        ('null value in column "total" violates not-null constraint', "Missing required value"),
        ("duplicate key value violates unique constraint", "already exists"),
        ('column "tip_amount" of relation "pos_transaction" does not exist', "out of date"),
        ("current transaction is aborted, commands ignored", "step in this sale failed"),
        ("numeric field overflow", "too large"),
        ("greenlet_spawn has not been called", "internal error"),
        ("something totally unexpected", "database error occurred"),
    ],
)
def test_friendly_db_error_messages(message, expected):
    assert expected in _friendly_db_error(Exception(message))
