"""Vendor-scoped sequential numbers for CRM entities via CrmNumberRange."""
from __future__ import annotations

import re
from typing import Any, Optional, Type
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CrmNumberRange

_NUMBER_RE = re.compile(r"^([A-Z0-9]+)-(\d+)$", re.I)

# Default series seeded per vendor on first use / via seed API.
CRM_NUMBER_RANGE_DEFAULTS: dict[str, dict[str, Any]] = {
    "lead": {
        "name": "Leads",
        "prefix": "LED",
        "number_from": 1,
        "number_to": 999999,
        "pad_width": 6,
    },
    "account": {
        "name": "Accounts",
        "prefix": "ACC",
        "number_from": 1,
        "number_to": 999999,
        "pad_width": 6,
    },
    "contact": {
        "name": "Contacts",
        "prefix": "ACC",
        "number_from": 1,
        "number_to": 999999,
        "pad_width": 6,
    },
    "deal": {
        "name": "Deals",
        "prefix": "DEAL",
        "number_from": 1,
        "number_to": 999999,
        "pad_width": 6,
    },
    "activity": {
        "name": "Tasks",
        "prefix": "TSK",
        "number_from": 1,
        "number_to": 999999,
        "pad_width": 6,
    },
    "ticket": {
        "name": "Tickets",
        "prefix": "TCK",
        "number_from": 1,
        "number_to": 999999,
        "pad_width": 6,
    },
}

# Map legacy prefix → entity_type for call sites that still pass only a prefix.
_PREFIX_TO_ENTITY = {
    "LED": "lead",
    "ACC": "account",
    "DEAL": "deal",
    "TSK": "activity",
    "TCK": "ticket",
}


async def _max_existing_seq(
    db: AsyncSession,
    vendor_id: UUID,
    model: Type[Any],
    prefix: str,
) -> int:
    """Highest numeric suffix already used for this prefix on *model*."""
    table = model.__tablename__
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        result = await db.execute(
            text(f"""
                SELECT COALESCE(MAX(
                    SUBSTRING(number FROM :pat)::INTEGER
                ), 0)
                FROM {table}
                WHERE vendor_id = CAST(:vid AS uuid)
                  AND number ~ :rx
            """),
            {
                "vid": str(vendor_id),
                "pat": f"^{re.escape(prefix)}-([0-9]+)$",
                "rx": f"^{re.escape(prefix)}-[0-9]+$",
            },
        )
        return int(result.scalar_one() or 0)

    result = await db.execute(
        select(model.number).where(
            model.vendor_id == vendor_id,
            model.number.like(f"{prefix}-%"),
        )
    )
    best = 0
    for label in result.scalars().all():
        m = _NUMBER_RE.fullmatch(label or "")
        if m and m.group(1).upper() == prefix.upper():
            best = max(best, int(m.group(2)))
    return best


async def ensure_crm_number_ranges(db: AsyncSession, vendor_id: UUID) -> list[CrmNumberRange]:
    """Create missing default ranges for the vendor (idempotent)."""
    existing = (
        await db.execute(
            select(CrmNumberRange).where(CrmNumberRange.vendor_id == vendor_id)
        )
    ).scalars().all()
    by_type = {r.entity_type: r for r in existing}
    created: list[CrmNumberRange] = []
    for entity_type, defaults in CRM_NUMBER_RANGE_DEFAULTS.items():
        if entity_type in by_type:
            continue
        row = CrmNumberRange(
            vendor_id=vendor_id,
            entity_type=entity_type,
            name=defaults["name"],
            prefix=defaults["prefix"],
            number_from=defaults["number_from"],
            number_to=defaults["number_to"],
            current_number=defaults["number_from"],
            pad_width=defaults["pad_width"],
            is_active=True,
        )
        db.add(row)
        created.append(row)
    if created:
        await db.flush()
    return existing + created if created else list(existing)


async def get_or_create_range(
    db: AsyncSession,
    vendor_id: UUID,
    entity_type: str,
) -> CrmNumberRange:
    await ensure_crm_number_ranges(db, vendor_id)
    row = (
        await db.execute(
            select(CrmNumberRange)
            .where(
                CrmNumberRange.vendor_id == vendor_id,
                CrmNumberRange.entity_type == entity_type,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if not row:
        raise ValueError(f"No CRM number range configured for '{entity_type}'")
    return row


async def next_crm_number(
    db: AsyncSession,
    vendor_id: UUID,
    model: Type[Any],
    prefix: Optional[str] = None,
    *,
    entity_type: Optional[str] = None,
    width: int = 6,
) -> str:
    """Return the next label from the vendor's CrmNumberRange for this entity.

    Falls back to legacy MAX+1 behaviour only if the range table is unavailable.
    Prefer passing ``entity_type`` (e.g. ``"lead"``); ``prefix`` is used to infer
    entity_type for older call sites.
    """
    et = entity_type
    if not et and prefix:
        et = _PREFIX_TO_ENTITY.get(prefix.upper())
    if not et:
        et = "lead"

    try:
        nr = await get_or_create_range(db, vendor_id, et)
    except Exception:
        # Table missing / not migrated — legacy path
        use_prefix = (prefix or CRM_NUMBER_RANGE_DEFAULTS.get(et, {}).get("prefix") or "LED").upper()
        last = await _max_existing_seq(db, vendor_id, model, use_prefix)
        return f"{use_prefix}-{last + 1:0{width}d}"

    use_prefix = (nr.prefix or prefix or "LED").strip().upper() or "LED"
    pad = max(1, min(int(nr.pad_width or width), 12))

    # Align counter with any numbers already issued under this prefix/table
    # (e.g. after import or before ranges existed).
    existing_max = await _max_existing_seq(db, vendor_id, model, use_prefix)
    if nr.current_number <= existing_max:
        nr.current_number = existing_max + 1
    if nr.current_number < nr.number_from:
        nr.current_number = nr.number_from

    if nr.current_number > nr.number_to:
        raise ValueError(
            f"CRM number range for '{et}' is exhausted "
            f"(max {nr.number_to}). Update the range in CRM → Number Ranges."
        )

    doc_no = nr.current_number
    nr.current_number += 1
    await db.flush()
    return f"{use_prefix}-{doc_no:0{pad}d}"
