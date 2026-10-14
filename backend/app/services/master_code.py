"""Short human-readable master codes for customers / suppliers.

Examples: C-0042, V-0007, E-0001, P-0003, CT-0012
"""
from __future__ import annotations

import re
from typing import Any, Type
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

_NUMBER_RE = re.compile(r"^([A-Z0-9]+)-(\d+)$", re.I)

# Role / party_type → prefix
MASTER_CODE_PREFIX: dict[str, str] = {
    "customer": "C",
    "supplier": "V",
    "vendor": "V",
    "employee": "E",
    "partner": "P",
    "contractor": "CT",
}

_PAD = 4


def prefix_for(kind: str) -> str:
    return MASTER_CODE_PREFIX.get((kind or "").lower(), "V")


async def _max_existing_seq(
    db: AsyncSession,
    vendor_id: UUID,
    model: Type[Any],
    prefix: str,
) -> int:
    table = model.__tablename__
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        result = await db.execute(
            text(f"""
                SELECT COALESCE(MAX(
                    SUBSTRING(master_code FROM :pat)::INTEGER
                ), 0)
                FROM {table}
                WHERE vendor_id = CAST(:vid AS uuid)
                  AND master_code ~ :rx
            """),
            {
                "vid": str(vendor_id),
                "pat": f"^{re.escape(prefix)}-([0-9]+)$",
                "rx": f"^{re.escape(prefix)}-[0-9]+$",
            },
        )
        return int(result.scalar_one() or 0)

    result = await db.execute(
        select(model.master_code).where(
            model.vendor_id == vendor_id,
            model.master_code.like(f"{prefix}-%"),
        )
    )
    best = 0
    for label in result.scalars().all():
        m = _NUMBER_RE.fullmatch(label or "")
        if m and m.group(1).upper() == prefix.upper():
            best = max(best, int(m.group(2)))
    return best


async def allocate_master_code(
    db: AsyncSession,
    vendor_id: UUID,
    model: Type[Any],
    kind: str,
) -> str:
    """Return the next short code for this vendor + kind (e.g. C-0042)."""
    prefix = prefix_for(kind)
    nxt = await _max_existing_seq(db, vendor_id, model, prefix) + 1
    return f"{prefix}-{str(nxt).zfill(_PAD)}"
