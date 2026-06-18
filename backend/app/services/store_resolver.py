"""Resolve the business unit (store) a transaction should be attributed to.

Used when creating orders, POS transactions and invoices so dashboard/reports
can be scoped per store. Falls back to the vendor's default (or oldest active)
store, matching how historical rows were backfilled.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import Store
from app.models.vendor_user import VendorUser


async def get_default_store_id(db: AsyncSession, vendor_id: UUID) -> Optional[UUID]:
    """The vendor's default store (is_default first, then oldest active)."""
    row = await db.execute(
        select(Store.id)
        .where(Store.vendor_id == vendor_id, Store.is_active == True)  # noqa: E712
        .order_by(Store.is_default.desc(), Store.created_at.asc())
        .limit(1)
    )
    return row.scalars().first()


async def _store_for_branch(db: AsyncSession, vendor_id: UUID, branch: str) -> Optional[UUID]:
    """Match a branch code or store UUID string to an active store."""
    from sqlalchemy import or_

    filters = [Store.code == branch]
    try:
        filters.append(Store.id == UUID(branch))
    except (ValueError, AttributeError, TypeError):
        pass
    row = await db.execute(
        select(Store.id).where(
            Store.vendor_id == vendor_id,
            Store.is_active == True,  # noqa: E712
            or_(*filters),
        )
    )
    return row.scalars().first()


async def _store_for_vendor_user(db: AsyncSession, vendor_id: UUID, vendor_user_id: UUID) -> Optional[UUID]:
    row = await db.execute(
        select(VendorUser.store_id).where(
            VendorUser.id == vendor_user_id, VendorUser.vendor_id == vendor_id
        )
    )
    return row.scalars().first()


async def _store_for_user(db: AsyncSession, vendor_id: UUID, user_id: UUID) -> Optional[UUID]:
    row = await db.execute(
        select(VendorUser.store_id).where(
            VendorUser.user_id == user_id, VendorUser.vendor_id == vendor_id
        )
    )
    return row.scalars().first()


async def resolve_store_id(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    store_id: Optional[UUID | str] = None,
    branch: Optional[str] = None,
    vendor_user_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
) -> Optional[UUID]:
    """Resolve the store to attribute a transaction to.

    Priority: explicit store_id → branch code → staff member's assigned store →
    vendor's default store. Returns None only when the vendor has no store records.
    """
    if store_id:
        if isinstance(store_id, UUID):
            return store_id
        try:
            return UUID(str(store_id))
        except (ValueError, TypeError):
            pass

    if branch:
        sid = await _store_for_branch(db, vendor_id, branch)
        if sid:
            return sid

    if vendor_user_id:
        sid = await _store_for_vendor_user(db, vendor_id, vendor_user_id)
        if sid:
            return sid

    if user_id:
        sid = await _store_for_user(db, vendor_id, user_id)
        if sid:
            return sid

    return await get_default_store_id(db, vendor_id)
