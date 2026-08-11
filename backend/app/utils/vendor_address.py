"""Map vendor HQ address columns onto store.address JSON.

Admin edits vendor.street_address / city / state / postal_code / country.
The vendor app Addresses card reads store.address {street, city, state, pincode, country}.
These helpers keep the default business-unit address in sync with HQ.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.store import Store

VENDOR_ADDRESS_UPDATE_FIELDS = frozenset({
    "street_address",
    "city",
    "state",
    "postal_code",
    "country",
    "latitude",
    "longitude",
})


def store_address_is_empty(address: Any) -> bool:
    if not isinstance(address, dict):
        return True
    return not any(str(address.get(k) or "").strip() for k in ("street", "city", "state", "pincode"))


def store_address_from_vendor(vendor: Any, existing: Optional[dict] = None) -> dict:
    """Copy vendor HQ columns onto store.address keys, preserving extras such as label."""
    out = dict(existing) if isinstance(existing, dict) else {}
    mapping = {
        "street": getattr(vendor, "street_address", None),
        "city": getattr(vendor, "city", None),
        "state": getattr(vendor, "state", None),
        "pincode": getattr(vendor, "postal_code", None),
        "country": getattr(vendor, "country", None),
    }
    for key, value in mapping.items():
        text = str(value).strip() if value is not None else ""
        if text:
            out[key] = text
        else:
            out.pop(key, None)

    lat = getattr(vendor, "latitude", None)
    lng = getattr(vendor, "longitude", None)
    if lat is not None:
        out["latitude"] = float(lat)
    if lng is not None:
        out["longitude"] = float(lng)
    return out


async def sync_vendor_address_to_default_store(db: AsyncSession, vendor: Any) -> bool:
    """Overwrite the default (or first) business-unit address with vendor HQ.

    Branches (parent_id set) are left alone. Returns True if a store was updated.
    """
    vendor_id = getattr(vendor, "id", None)
    if not vendor_id:
        return False

    result = await db.execute(
        select(Store)
        .where(Store.vendor_id == vendor_id, Store.parent_id.is_(None))
        .order_by(Store.is_default.desc(), Store.created_at.asc())
    )
    store = result.scalars().first()
    if not store:
        return False

    existing = store.address if isinstance(store.address, dict) else {}
    store.address = store_address_from_vendor(vendor, existing)
    flag_modified(store, "address")
    return True


def apply_vendor_fallback_to_store_address(address: Any, vendor: Any) -> dict:
    """If store.address has no street/city/state/pincode, fill from vendor HQ."""
    current = address if isinstance(address, dict) else {}
    if not store_address_is_empty(current) or vendor is None:
        return current
    return store_address_from_vendor(vendor, current)
