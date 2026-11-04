"""Gapless per-vendor document numbering for the Controlling module.

The counter row is incremented with a single ``UPDATE ... RETURNING`` inside the caller's
transaction.  The row lock is held until commit and the increment is rolled back with the
transaction, so numbers are unique and gapless even under concurrent requests.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import CoNumberSequence

SEQ_ORDER = "manufacturing_order"
SEQ_GOODS_MOVEMENT = "goods_movement"


async def next_number(db: AsyncSession, vendor_id: UUID, key: str) -> int:
    """Return the next integer for ``key`` (starting at 1) for this vendor."""
    exists = (
        await db.execute(
            select(CoNumberSequence.id).where(
                CoNumberSequence.vendor_id == vendor_id, CoNumberSequence.seq_key == key
            )
        )
    ).first()
    if not exists:
        try:
            async with db.begin_nested():
                db.add(CoNumberSequence(vendor_id=vendor_id, seq_key=key, last_value=0))
                await db.flush()
        except IntegrityError:
            # Another request created the counter first - fall through to the UPDATE.
            pass
    value = (
        await db.execute(
            update(CoNumberSequence)
            .where(CoNumberSequence.vendor_id == vendor_id, CoNumberSequence.seq_key == key)
            .values(last_value=CoNumberSequence.last_value + 1)
            .returning(CoNumberSequence.last_value)
        )
    ).scalar_one()
    return int(value)


async def next_order_no(db: AsyncSession, vendor_id: UUID) -> str:
    return f"MO-{await next_number(db, vendor_id, SEQ_ORDER):06d}"


async def next_goods_movement_no(db: AsyncSession, vendor_id: UUID) -> str:
    return f"GM{await next_number(db, vendor_id, SEQ_GOODS_MOVEMENT):06d}"
