"""
Transaction-scoped advisory locks so overlapping Celery runs (retries, two beat
instances, a manual trigger during the scheduled run) cannot process the same
vendor twice. The lock is released automatically on commit or rollback.
"""
from __future__ import annotations

import zlib
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def lock_key(job: str, vendor_id: UUID) -> int:
    """Stable signed 63-bit key for (job, vendor)."""
    raw = zlib.crc32(f"{job}:{vendor_id}".encode()) << 16 | (zlib.crc32(str(vendor_id).encode()) & 0xFFFF)
    return raw & 0x7FFFFFFFFFFFFFFF


async def try_job_lock(db: AsyncSession, job: str, vendor_id: UUID) -> bool:
    """
    Try to take the lock for this job+vendor. Returns False if another worker holds it.
    On non-PostgreSQL databases (tests / SQLite) there is nothing to contend on → True.
    """
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return True
    got = (await db.execute(
        text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": lock_key(job, vendor_id)}
    )).scalar()
    return bool(got)
