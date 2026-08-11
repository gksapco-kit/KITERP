"""Generate unique per-vendor store / business unit codes."""
import re
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import Store

# Default business unit code for the first outlet when a business is created.
DEFAULT_BUSINESS_UNIT_CODE = "1000"


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
    """Business unit code for the default store created with a new business (starts at 1000)."""
    return await allocate_unique_store_code(db, vendor_id, DEFAULT_BUSINESS_UNIT_CODE)


def branch_code_prefix(parent_code: str | None, parent_name: str | None = None) -> str:
    """Uppercase BU code used as the branch-code prefix (e.g. 1000 -> 1000-01)."""
    raw = (parent_code or "").strip()
    if not raw and parent_name:
        raw = store_code_base_from_label(parent_name)
    return (raw or "MAIN").upper()[:50]


async def _store_code_taken(
    db: AsyncSession,
    vendor_id: UUID,
    code: str,
    exclude_store_id: UUID | None = None,
) -> bool:
    q = select(func.count()).select_from(Store).where(
        Store.vendor_id == vendor_id,
        Store.code == code,
    )
    if exclude_store_id is not None:
        q = q.where(Store.id != exclude_store_id)
    return (await db.execute(q)).scalar_one() or 0 > 0


async def allocate_unique_branch_code(
    db: AsyncSession,
    vendor_id: UUID,
    parent: Store,
) -> str:
    """Allocate the next branch code under a business unit: {BU_CODE}-01, -02, …"""
    prefix = branch_code_prefix(parent.code, parent.name)
    pattern_prefix = f"{prefix}-"

    r = await db.execute(
        select(Store.code).where(
            Store.vendor_id == vendor_id,
            Store.parent_id == parent.id,
            Store.code.isnot(None),
        )
    )
    max_suffix = 0
    for code in r.scalars().all():
        if not code:
            continue
        upper = code.strip().upper()
        if not upper.startswith(pattern_prefix):
            continue
        tail = upper[len(pattern_prefix) :]
        if tail.isdigit():
            max_suffix = max(max_suffix, int(tail))

    suffix = max_suffix + 1
    width = max(2, len(str(suffix)))
    while True:
        candidate = f"{prefix}-{suffix:0{width}d}"[:50]
        if not await _store_code_taken(db, vendor_id, candidate):
            return candidate
        suffix += 1
        width = max(width, len(str(suffix)))


async def normalize_branch_code_for_parent(
    db: AsyncSession,
    vendor_id: UUID,
    parent: Store,
    raw_code: str,
    exclude_store_id: UUID | None = None,
) -> str:
    """
    Ensure a branch code is unique for the vendor and tied to its parent BU prefix.
    Accepts full codes (1000-02) or suffix-only (02 -> 1000-02).
    """
    prefix = branch_code_prefix(parent.code, parent.name)
    pattern_prefix = f"{prefix}-"
    cleaned = (raw_code or "").strip().upper()
    if not cleaned:
        return await allocate_unique_branch_code(db, vendor_id, parent)
    if cleaned.startswith(pattern_prefix):
        code = cleaned[:50]
    elif cleaned.isdigit():
        width = max(2, len(cleaned))
        code = f"{prefix}-{cleaned:0{width}d}"[:50]
    else:
        code = f"{pattern_prefix}{cleaned}"[:50]
    if not code.startswith(pattern_prefix):
        raise ValueError(f"Branch code must belong to business unit {prefix} (expected prefix {pattern_prefix})")
    if await _store_code_taken(db, vendor_id, code, exclude_store_id):
        raise ValueError(f"Branch code '{code}' is already in use")
    return code


async def ensure_store_code_unique(
    db: AsyncSession,
    vendor_id: UUID,
    code: str,
    exclude_store_id: UUID | None = None,
) -> None:
    if await _store_code_taken(db, vendor_id, code, exclude_store_id):
        raise ValueError(f"Store code '{code}' is already in use")


async def ensure_default_store_if_missing(
    db: AsyncSession,
    vendor_id: UUID,
    location_name: str,
) -> bool:
    """
    If the vendor has no stores yet, create a default outlet with business unit code 1000
    (or uniquified). Used for legacy tenants and as a safety net after signup.
    Returns True if a row was created.
    """
    r = await db.execute(
        select(func.count()).select_from(Store).where(Store.vendor_id == vendor_id)
    )
    if (r.scalar_one() or 0) > 0:
        return False
    from app.models.vendor import Vendor
    from app.utils.vendor_address import store_address_from_vendor

    vendor = await db.get(Vendor, vendor_id)
    code = await allocate_default_business_store_code(db, vendor_id)
    name = (location_name or "Main location").strip()[:200] or "Main location"
    db.add(
        Store(
            vendor_id=vendor_id,
            name=name,
            code=code,
            description=None,
            address=store_address_from_vendor(vendor) if vendor else {},
            is_default=True,
            is_active=True,
            is_open=True,
        )
    )
    await db.flush()
    return True
