"""Vendor-scoped sequential numbers for CRM entities."""
from __future__ import annotations

import re
from typing import Any, Type
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

_NUMBER_RE = re.compile(r"^([A-Z]+)-(\d+)$")


async def next_crm_number(
    db: AsyncSession,
    vendor_id: UUID,
    model: Type[Any],
    prefix: str,
    *,
    width: int = 6,
) -> str:
    """Return the next ``PREFIX-000001`` style label for *model* / *vendor_id*."""
    table = model.__tablename__
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        lock_key = f"{vendor_id}:{prefix}"
        await db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
            {"k": lock_key},
        )
        result = await db.execute(
            text(f"""
                SELECT COALESCE(MAX(
                    SUBSTRING(number FROM '^{prefix}-([0-9]+)$')::INTEGER
                ), 0)
                FROM {table}
                WHERE vendor_id = CAST(:vid AS uuid)
                  AND number ~ '^{prefix}-[0-9]+$'
            """),
            {"vid": str(vendor_id)},
        )
        last_seq = int(result.scalar_one() or 0)
        return f"{prefix}-{last_seq + 1:0{width}d}"

    result = await db.execute(
        select(model.number).where(
            model.vendor_id == vendor_id,
            model.number.like(f"{prefix}-%"),
        )
    )
    best = 0
    for label in result.scalars().all():
        m = _NUMBER_RE.fullmatch(label or "")
        if m and m.group(1) == prefix:
            best = max(best, int(m.group(2)))
    return f"{prefix}-{best + 1:0{width}d}"
