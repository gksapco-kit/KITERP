"""Generate unique per-vendor store / company codes."""
import re
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import Store

# Default company code for the first outlet when a business is created.
DEFAULT_BUSINESS_COMPANY_CODE = "1000"


def store_code_base_from_label(label: str) -> str:
    """Uppercase alphanumeric code fragment from a name or slug (max 20 chars)."""
    s = re.sub(r"[^a-zA-Z0-9]+", "", (label or "").upper())
    return (s[:20] if s else "MAIN")


async def allocate_unique_store_code(
    db: AsyncSession,
    vendor_id: UUID,
    preferred_base: str,
) -> str:
    """Return a unique Store.code for this vendor; collision-safe suffix."""
    base = store_code_base_from_label(preferred_base)[:50]
    if not base:
        base = "MAIN"
    candidate = base
    suffix = 1
    while True:
        r = await db.execute(
            select(func.count())
            .select_from(Store)
            .where(Store.vendor_id == vendor_id, Store.code == candidate)
        )
        if (r.scalar_one() or 0) == 0:
            return candidate
        suffix += 1
        candidate = f"{base[:40]}-{suffix}"[:50]


async def allocate_default_business_store_code(db: AsyncSession, vendor_id: UUID) -> str:
    """Company code for the default store created with a new business (starts at 1000)."""
    return await allocate_unique_store_code(db, vendor_id, DEFAULT_BUSINESS_COMPANY_CODE)


async def ensure_default_store_if_missing(
    db: AsyncSession,
    vendor_id: UUID,
    location_name: str,
) -> bool:
    """
    If the vendor has no stores yet, create a default outlet with company code 1000
    (or uniquified). Used for legacy tenants and as a safety net after signup.
    Returns True if a row was created.
    """
    r = await db.execute(
        select(func.count()).select_from(Store).where(Store.vendor_id == vendor_id)
    )
    if (r.scalar_one() or 0) > 0:
        return False
    code = await allocate_default_business_store_code(db, vendor_id)
    name = (location_name or "Main location").strip()[:200] or "Main location"
    db.add(
        Store(
            vendor_id=vendor_id,
            name=name,
            code=code,
            description=None,
            address={},
            is_default=True,
            is_active=True,
        )
    )
    await db.flush()
    return True
