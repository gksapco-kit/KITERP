"""Stage C GDP lite — storage conditions, excursion log, wholesale license gate."""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.pharma import PharmaTempExcursion
from app.models.procurement_goods import GoodsBatch
from app.models.storage_location import StorageLocation
from app.services.pharma_batch import append_pharma_audit

VALID_CONDITIONS = frozenset({"ambient", "refrigerated", "frozen", "controlled_room"})
VALID_SEVERITY = frozenset({"minor", "major", "critical"})


def _excursion_dict(e: PharmaTempExcursion) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "storage_location_id": str(e.storage_location_id) if e.storage_location_id else None,
        "goods_batch_id": str(e.goods_batch_id) if e.goods_batch_id else None,
        "recorded_at": e.recorded_at.isoformat() if e.recorded_at else None,
        "temp_c": float(e.temp_c) if e.temp_c is not None else None,
        "duration_minutes": e.duration_minutes,
        "status": e.status,
        "severity": e.severity,
        "notes": e.notes,
        "actions": e.actions or [],
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "closed_at": e.closed_at.isoformat() if e.closed_at else None,
    }


async def create_temp_excursion(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    temp_c: float,
    storage_location_id: Optional[UUID] = None,
    goods_batch_id: Optional[UUID] = None,
    duration_minutes: Optional[int] = None,
    severity: str = "minor",
    notes: Optional[str] = None,
    actor_id: Optional[UUID] = None,
    recorded_at: Optional[datetime] = None,
) -> PharmaTempExcursion:
    severity = (severity or "minor").lower()
    if severity not in VALID_SEVERITY:
        raise HTTPException(400, f"severity must be one of {sorted(VALID_SEVERITY)}")
    if storage_location_id is None and goods_batch_id is None:
        raise HTTPException(400, "storage_location_id or goods_batch_id required")

    if storage_location_id:
        loc = (
            await db.execute(
                select(StorageLocation).where(
                    StorageLocation.id == storage_location_id,
                    StorageLocation.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if not loc:
            raise HTTPException(404, "Storage location not found")

    if goods_batch_id:
        batch = (
            await db.execute(
                select(GoodsBatch).where(
                    GoodsBatch.id == goods_batch_id,
                    GoodsBatch.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if not batch:
            raise HTTPException(404, "Goods batch not found")

    e = PharmaTempExcursion(
        vendor_id=vendor_id,
        storage_location_id=storage_location_id,
        goods_batch_id=goods_batch_id,
        recorded_at=recorded_at or datetime.now(timezone.utc),
        temp_c=Decimal(str(temp_c)),
        duration_minutes=duration_minutes,
        severity=severity,
        notes=notes,
        created_by=actor_id,
        status="open",
        actions=[],
    )
    db.add(e)
    await db.flush()
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="pharma_temp_excursion",
        entity_id=e.id,
        action="create",
        actor_id=actor_id,
        new_value={"temp_c": temp_c, "severity": severity},
    )
    return e


async def update_temp_excursion(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    excursion_id: UUID,
    status: Optional[str] = None,
    notes: Optional[str] = None,
    action: Optional[str] = None,
    actor_id: Optional[UUID] = None,
) -> PharmaTempExcursion:
    e = (
        await db.execute(
            select(PharmaTempExcursion).where(
                PharmaTempExcursion.id == excursion_id,
                PharmaTempExcursion.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Excursion not found")
    if status is not None:
        st = status.lower()
        if st not in ("open", "investigating", "closed"):
            raise HTTPException(400, "status must be open|investigating|closed")
        e.status = st
        if st == "closed":
            e.closed_at = datetime.now(timezone.utc)
    if notes is not None:
        e.notes = notes
    if action:
        acts = list(e.actions or [])
        acts.append({
            "at": datetime.now(timezone.utc).isoformat(),
            "by": str(actor_id) if actor_id else None,
            "action": action,
        })
        e.actions = acts
    await db.flush()
    return e


def assert_customer_wholesale_license(
    customer: Optional[Customer],
    *,
    required: bool,
) -> None:
    """Block ship when wholesale license check is enabled and license missing/expired."""
    if not required:
        return
    if customer is None:
        raise HTTPException(400, "Customer required for wholesale license check")
    number = getattr(customer, "wholesale_license_number", None)
    expires = getattr(customer, "wholesale_license_expires", None)
    if not number or not str(number).strip():
        raise HTTPException(400, "Customer wholesale license number required")
    if expires and expires < date.today():
        raise HTTPException(400, f"Customer wholesale license expired on {expires.isoformat()}")


async def count_open_excursions(db: AsyncSession, vendor_id: UUID) -> int:
    from sqlalchemy import func
    return int(
        (
            await db.execute(
                select(func.count()).select_from(PharmaTempExcursion).where(
                    PharmaTempExcursion.vendor_id == vendor_id,
                    PharmaTempExcursion.status.in_(["open", "investigating"]),
                )
            )
        ).scalar()
        or 0
    )
