"""Rules for which vendors are addressable from the public business front and store-scoped APIs (slug / headers)."""
from typing import Optional


def vendor_live_on_storefront(vendor_status: Optional[str]) -> bool:
    """Approved vendors are live; ``active`` is accepted for legacy rows."""
    return vendor_status in ("approved", "active")
