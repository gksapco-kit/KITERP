"""Vendor HQ address ↔ default store.address mapping and admin sync."""
import uuid
from types import SimpleNamespace

import pytest
import pytest_asyncio

from app.models.store import Store
from app.models.vendor import Vendor
from app.utils.vendor_address import (
    apply_vendor_fallback_to_store_address,
    store_address_from_vendor,
    store_address_is_empty,
    sync_vendor_address_to_default_store,
)


def test_store_address_from_vendor_maps_keys_and_keeps_label():
    vendor = SimpleNamespace(
        street_address="FLOOR No GROUND, SURVEY NO.37,38",
        city="Hyderabad",
        state="Telangana",
        postal_code="500064",
        country="India",
        latitude=None,
        longitude=None,
    )
    mapped = store_address_from_vendor(vendor, {"label": "Business Unit / Store address"})
    assert mapped == {
        "label": "Business Unit / Store address",
        "street": "FLOOR No GROUND, SURVEY NO.37,38",
        "city": "Hyderabad",
        "state": "Telangana",
        "pincode": "500064",
        "country": "India",
    }


def test_store_address_is_empty_ignores_country_only():
    assert store_address_is_empty({})
    assert store_address_is_empty({"country": "India", "label": "HQ"})
    assert not store_address_is_empty({"street": "123 Main Street"})


def test_fallback_fills_empty_store_from_vendor():
    vendor = SimpleNamespace(
        street_address="New Street",
        city="Hyderabad",
        state="Telangana",
        postal_code="500064",
        country="India",
        latitude=None,
        longitude=None,
    )
    filled = apply_vendor_fallback_to_store_address({}, vendor)
    assert filled["street"] == "New Street"
    assert filled["pincode"] == "500064"

    kept = apply_vendor_fallback_to_store_address({"street": "123 Main Street", "city": "Hyderabad"}, vendor)
    assert kept["street"] == "123 Main Street"


@pytest_asyncio.fixture
async def vendor_with_store(db_session):
    vendor = Vendor(
        id=uuid.uuid4(),
        business_name="SR MARKETING AND SERVICES",
        display_name="SR MARKETING AND SERVICES",
        slug=f"sr-mkt-{uuid.uuid4().hex[:8]}",
        subdomain=f"sr-mkt-{uuid.uuid4().hex[:8]}",
        business_type="individual",
        offering_type="both",
        primary_email="sr@test.com",
        primary_phone="9876543210",
        street_address="FLOOR No GROUND, SURVEY NO.37,38",
        city="Hyderabad",
        state="Telangana",
        postal_code="500064",
        country="India",
        status="approved",
    )
    db_session.add(vendor)
    await db_session.flush()
    store = Store(
        vendor_id=vendor.id,
        name="SR MARKETING AND SERVICES",
        code="1000",
        address={"street": "123 Main Street", "city": "Hyderabad", "pincode": "500001", "country": "India"},
        is_default=True,
        is_active=True,
    )
    db_session.add(store)
    await db_session.commit()
    await db_session.refresh(vendor)
    await db_session.refresh(store)
    return vendor, store


@pytest.mark.asyncio
async def test_sync_overwrites_default_store_address(db_session, vendor_with_store):
    vendor, store = vendor_with_store
    updated = await sync_vendor_address_to_default_store(db_session, vendor)
    assert updated is True
    await db_session.commit()
    await db_session.refresh(store)
    assert store.address["street"] == "FLOOR No GROUND, SURVEY NO.37,38"
    assert store.address["pincode"] == "500064"
    assert store.address["city"] == "Hyderabad"
