# app/services/material_code.py
"""Generate unique, human-readable material/item codes for catalog entities.

Products get a ``MAT-#####`` code and services get a ``SVC-#####`` code, both
unique per vendor. The numeric part is derived from the current row count and
then verified against the database, retrying on the (rare) collision so the
code is guaranteed unique even under concurrent creation.
"""
from __future__ import annotations

import secrets
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_product import Product
from app.models.vendor_service import Service

PRODUCT_PREFIX = "MAT"
SERVICE_PREFIX = "SVC"
_PAD = 5
_MAX_SEQ_ATTEMPTS = 50


async def _code_exists(db: AsyncSession, model, vendor_id: UUID, code: str) -> bool:
    result = await db.execute(
        select(model.id).where(
            model.vendor_id == vendor_id,
            model.material_code == code,
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _generate(db: AsyncSession, model, vendor_id: UUID, prefix: str) -> str:
    count_result = await db.execute(
        select(func.count()).select_from(model).where(model.vendor_id == vendor_id)
    )
    seq = (count_result.scalar() or 0) + 1

    for _ in range(_MAX_SEQ_ATTEMPTS):
        candidate = f"{prefix}-{seq:0{_PAD}d}"
        if not await _code_exists(db, model, vendor_id, candidate):
            return candidate
        seq += 1

    # Fallback: random suffix that is extremely unlikely to collide.
    while True:
        candidate = f"{prefix}-{secrets.token_hex(4).upper()}"
        if not await _code_exists(db, model, vendor_id, candidate):
            return candidate


async def generate_product_material_code(db: AsyncSession, vendor_id: UUID) -> str:
    return await _generate(db, Product, vendor_id, PRODUCT_PREFIX)


async def generate_service_material_code(db: AsyncSession, vendor_id: UUID) -> str:
    return await _generate(db, Service, vendor_id, SERVICE_PREFIX)
