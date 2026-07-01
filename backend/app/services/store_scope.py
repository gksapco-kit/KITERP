"""Resolve Business Unit / Branch scope for filtering and reporting.

Store rows form a 2-level hierarchy: a row with parent_id=NULL is a Business
Unit; a row with parent_id set is a Branch under that Business Unit. Most
endpoints simply accept a `store_id` and filter for equality — since a Branch
is an ordinary Store row, passing a branch id "just works" with no other
changes. These helpers are for the roll-up case: a caller selects a Business
Unit (with no specific branch) and wants results aggregated across all of its
branches.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import Store


async def branch_ids_for_bu(db: AsyncSession, vendor_id: UUID, bu_id: UUID) -> List[UUID]:
    """All branch ids under a business unit (does not include the BU itself)."""
    result = await db.execute(
        select(Store.id).where(Store.vendor_id == vendor_id, Store.parent_id == bu_id)
    )
    return [row[0] for row in result.all()]


async def store_ids_in_scope(
    db: AsyncSession,
    vendor_id: UUID,
    bu_id: Optional[UUID] = None,
    branch_id: Optional[UUID] = None,
) -> Optional[List[UUID]]:
    """
    Resolve the set of store ids a filter should match:
      - branch_id given -> that single branch.
      - bu_id given (no branch) -> the BU itself + all of its branches (roll-up).
      - neither -> None, meaning "no store filter" (all stores in scope).
    """
    if branch_id:
        return [branch_id]
    if bu_id:
        return [bu_id, *await branch_ids_for_bu(db, vendor_id, bu_id)]
    return None


async def resolve_effective_store_id(
    db: AsyncSession,
    vendor_id: UUID,
    bu_id: Optional[UUID] = None,
    branch_id: Optional[UUID] = None,
) -> Optional[UUID]:
    """
    Resolve the single store id a new transaction should be written against:
      - branch_id given -> that branch.
      - bu_id given (no branch) -> the BU's default branch, else the BU itself.
      - neither -> None.
    """
    if branch_id:
        return branch_id
    if not bu_id:
        return None
    result = await db.execute(
        select(Store.id)
        .where(Store.vendor_id == vendor_id, Store.parent_id == bu_id)
        .order_by(Store.is_default.desc(), Store.created_at.asc())
        .limit(1)
    )
    default_branch_id = result.scalar_one_or_none()
    return default_branch_id or bu_id
