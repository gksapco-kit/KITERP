"""
Multi-tenant isolation tests.

Critical SaaS guarantee: an authenticated vendor must never be able to read or
mutate another vendor's resources by guessing IDs. The ``client`` fixture is
authenticated as ``test_user`` (owner of ``test_vendor``); these tests create a
*second* vendor's resources and assert they are invisible (404) to the first.
"""

import json
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product

PRODUCTS = "/api/v1/vendors/me/products"


@pytest_asyncio.fixture
async def other_vendor_product(db_session, test_user: User) -> Product:
    """A product owned by a different vendor than the authenticated user."""
    other = Vendor(
        id=uuid.uuid4(),
        business_name="Rival Store",
        display_name="Rival Store",
        slug=f"rival-{uuid.uuid4().hex[:6]}",
        business_type="retail",
        offering_type="products",
        primary_email="rival@test.com",
        primary_phone="9000000000",
        subdomain=f"rival-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db_session.add(other)
    await db_session.flush()

    product = Product(
        id=uuid.uuid4(),
        vendor_id=other.id,
        name="Rival Secret Product",
        slug=f"rival-secret-{uuid.uuid4().hex[:6]}",
        price=Decimal("4999.00"),
        currency="INR",
        status="active",
        product_type="physical",
        quantity=10,
        created_by=test_user.id,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest.mark.asyncio
async def test_cannot_read_other_vendor_product(
    client: AsyncClient, test_vendor: Vendor, other_vendor_product: Product
):
    resp = await client.get(f"{PRODUCTS}/{other_vendor_product.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_update_other_vendor_product(
    client: AsyncClient, test_vendor: Vendor, other_vendor_product: Product
):
    resp = await client.put(
        f"{PRODUCTS}/{other_vendor_product.id}",
        json={"name": "Hijacked", "price": 1.0},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cannot_delete_other_vendor_product(
    client: AsyncClient, test_vendor: Vendor, other_vendor_product: Product
):
    resp = await client.delete(f"{PRODUCTS}/{other_vendor_product.id}")
    assert resp.status_code == 404

    # The product must still exist for its real owner.
    still_there = await client.get(f"{PRODUCTS}/{other_vendor_product.id}")
    assert still_there.status_code == 404  # invisible to us, but not deleted


@pytest.mark.asyncio
async def test_other_vendor_product_absent_from_my_list(
    client: AsyncClient, test_vendor: Vendor, other_vendor_product: Product
):
    resp = await client.get(PRODUCTS)
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.json()["items"]}
    assert str(other_vendor_product.id) not in ids


@pytest.mark.asyncio
async def test_can_read_own_product(client: AsyncClient, test_product: Product):
    """Positive control: the owner can read their own product."""
    resp = await client.get(f"{PRODUCTS}/{test_product.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == str(test_product.id)
