"""Stage B serialization — hierarchy, status workflow, sale enforcement."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pharma import PharmaSerialUnit, BatchTransaction
from app.models.procurement_goods import GoodsBatch
from app.models.vendor_product import Product
from app.services.pharma_batch import append_pharma_audit, next_batch_number

VALID_LEVELS = frozenset({"unit", "pack", "case", "pallet"})
# status transitions
TRANSITIONS: dict[str, set[str]] = {
    "active": {"shipped", "recalled", "destroyed"},
    "shipped": {"recalled", "destroyed", "active"},  # active = return
    "recalled": {"destroyed"},
    "destroyed": set(),
}
LEVEL_RANK = {"unit": 0, "pack": 1, "case": 2, "pallet": 3}


def _serial_dict(s: PharmaSerialUnit) -> dict[str, Any]:
    return {
        "id": str(s.id),
        "goods_batch_id": str(s.goods_batch_id),
        "serial_number": s.serial_number,
        "parent_id": str(s.parent_id) if s.parent_id else None,
        "level": s.level,
        "status": s.status,
        "meta": s.meta or {},
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


async def create_serial_unit(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    goods_batch_id: UUID,
    serial_number: str,
    level: str = "unit",
    parent_id: Optional[UUID] = None,
    actor_id: Optional[UUID] = None,
    meta: Optional[dict] = None,
) -> PharmaSerialUnit:
    level = (level or "unit").lower()
    if level not in VALID_LEVELS:
        raise HTTPException(400, f"level must be one of {sorted(VALID_LEVELS)}")
    sn = serial_number.strip()
    if not sn:
        raise HTTPException(400, "serial_number required")

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

    exists = (
        await db.execute(
            select(PharmaSerialUnit).where(
                PharmaSerialUnit.vendor_id == vendor_id,
                PharmaSerialUnit.serial_number == sn,
            )
        )
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(400, "Serial number already exists")

    if parent_id:
        parent = (
            await db.execute(
                select(PharmaSerialUnit).where(
                    PharmaSerialUnit.id == parent_id,
                    PharmaSerialUnit.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if not parent:
            raise HTTPException(400, "Parent serial not found")
        if LEVEL_RANK.get(level, 0) >= LEVEL_RANK.get(parent.level or "unit", 0):
            raise HTTPException(400, "Child level must be below parent (unit < pack < case < pallet)")
        if parent.goods_batch_id != goods_batch_id:
            raise HTTPException(400, "Parent must belong to the same goods batch")

    s = PharmaSerialUnit(
        vendor_id=vendor_id,
        goods_batch_id=goods_batch_id,
        serial_number=sn,
        level=level,
        parent_id=parent_id,
        status="active",
        meta=meta or {},
    )
    db.add(s)
    await db.flush()
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="pharma_serial_unit",
        entity_id=s.id,
        action="commission",
        actor_id=actor_id,
        meaning="author",
        new_value={"serial_number": sn, "level": level, "status": "active"},
        esign_verified=False,
    )
    try:
        from app.services.pharma_epcis import record_serial_lifecycle_event
        await record_serial_lifecycle_event(
            db,
            vendor_id=vendor_id,
            serials=[s],
            biz_step="commissioning",
            disposition="active",
            actor_id=actor_id,
            source_type="serial_commission",
            source_id=s.id,
        )
    except Exception:
        pass
    return s


async def commission_serials_for_batch(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    goods_batch_id: UUID,
    quantity: int,
    prefix: str = "SN",
    level: str = "unit",
    actor_id: Optional[UUID] = None,
) -> list[PharmaSerialUnit]:
    """Auto-commission N unit serials on GR/production for serial_managed products."""
    qty = max(0, int(quantity))
    if qty == 0:
        return []
    created: list[PharmaSerialUnit] = []
    for i in range(qty):
        # Use sequence-like uniqueness
        base = await next_batch_number(db, vendor_id, prefix=prefix, pad_width=6, purpose="serial")
        sn = f"{base}-{i + 1:03d}" if qty > 1 else base
        # next_batch_number already unique per call; for multi append index
        if qty > 1:
            sn = f"{prefix}-{goods_batch_id.hex[:8].upper()}-{datetime.now(timezone.utc).strftime('%H%M%S')}-{i + 1:04d}"
        try:
            s = await create_serial_unit(
                db,
                vendor_id=vendor_id,
                goods_batch_id=goods_batch_id,
                serial_number=sn,
                level=level,
                actor_id=actor_id,
                meta={"auto_commissioned": True},
            )
            created.append(s)
        except HTTPException:
            # collision — retry with uuid suffix
            sn2 = f"{sn}-{i}"
            s = await create_serial_unit(
                db,
                vendor_id=vendor_id,
                goods_batch_id=goods_batch_id,
                serial_number=sn2,
                level=level,
                actor_id=actor_id,
                meta={"auto_commissioned": True},
            )
            created.append(s)
    return created


async def aggregate_serials(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    parent_serial_number: str,
    child_ids: list[UUID],
    goods_batch_id: UUID,
    parent_level: str = "pack",
    actor_id: Optional[UUID] = None,
) -> PharmaSerialUnit:
    """Create/ensure parent and attach children under it."""
    if not child_ids:
        raise HTTPException(400, "child_ids required")
    children = (
        await db.execute(
            select(PharmaSerialUnit).where(
                PharmaSerialUnit.vendor_id == vendor_id,
                PharmaSerialUnit.id.in_(child_ids),
            )
        )
    ).scalars().all()
    if len(children) != len(set(child_ids)):
        raise HTTPException(400, "One or more child serials not found")
    for c in children:
        if c.status != "active":
            raise HTTPException(400, f"Child {c.serial_number} must be active to aggregate")
        if c.goods_batch_id != goods_batch_id:
            raise HTTPException(400, "All children must share the goods batch")

    existing = (
        await db.execute(
            select(PharmaSerialUnit).where(
                PharmaSerialUnit.vendor_id == vendor_id,
                PharmaSerialUnit.serial_number == parent_serial_number.strip(),
            )
        )
    ).scalar_one_or_none()
    if existing:
        parent = existing
        if parent.level != parent_level:
            raise HTTPException(400, "Existing parent has a different level")
    else:
        parent = await create_serial_unit(
            db,
            vendor_id=vendor_id,
            goods_batch_id=goods_batch_id,
            serial_number=parent_serial_number,
            level=parent_level,
            actor_id=actor_id,
        )

    for c in children:
        if LEVEL_RANK.get(c.level or "unit", 0) >= LEVEL_RANK.get(parent.level or "pack", 1):
            raise HTTPException(400, f"Cannot nest {c.level} under {parent.level}")
        c.parent_id = parent.id
    await db.flush()
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="pharma_serial_unit",
        entity_id=parent.id,
        action="aggregate",
        actor_id=actor_id,
        new_value={"children": [str(c.id) for c in children]},
    )
    try:
        from app.services.pharma_epcis import record_serial_lifecycle_event
        await record_serial_lifecycle_event(
            db,
            vendor_id=vendor_id,
            serials=list(children),
            biz_step="packing",
            disposition="active",
            parent=parent,
            actor_id=actor_id,
            source_type="serial_aggregate",
            source_id=parent.id,
        )
    except Exception:
        pass
    return parent


async def transition_serial(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    serial_id: UUID,
    new_status: str,
    actor_id: Optional[UUID] = None,
    cascade: bool = True,
    notes: Optional[str] = None,
) -> PharmaSerialUnit:
    new_status = (new_status or "").lower()
    s = (
        await db.execute(
            select(PharmaSerialUnit).where(
                PharmaSerialUnit.id == serial_id,
                PharmaSerialUnit.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Serial not found")
    allowed = TRANSITIONS.get(s.status, set())
    if new_status not in allowed:
        raise HTTPException(
            400,
            f"Cannot transition {s.status} → {new_status}; allowed: {sorted(allowed) or 'none'}",
        )
    old = s.status
    s.status = new_status
    meta = dict(s.meta or {})
    meta["last_transition"] = {
        "from": old,
        "to": new_status,
        "at": datetime.now(timezone.utc).isoformat(),
        "notes": notes,
    }
    s.meta = meta
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="pharma_serial_unit",
        entity_id=s.id,
        action="status_change",
        actor_id=actor_id,
        meaning="approver" if new_status in ("shipped", "recalled", "destroyed") else "author",
        old_value={"status": old},
        new_value={"status": new_status, "notes": notes},
    )
    biz_map = {
        "shipped": ("shipping", "in_transit"),
        "recalled": ("recalling", "recalled"),
        "destroyed": ("destroying", "destroyed"),
        "active": ("receiving", "active"),
    }
    if new_status in biz_map:
        try:
            from app.services.pharma_epcis import record_serial_lifecycle_event
            step, disp = biz_map[new_status]
            await record_serial_lifecycle_event(
                db,
                vendor_id=vendor_id,
                serials=[s],
                biz_step=step,
                disposition=disp,
                actor_id=actor_id,
                source_type="serial_transition",
                source_id=s.id,
            )
        except Exception:
            pass
    if cascade:
        children = (
            await db.execute(
                select(PharmaSerialUnit).where(
                    PharmaSerialUnit.vendor_id == vendor_id,
                    PharmaSerialUnit.parent_id == s.id,
                )
            )
        ).scalars().all()
        for child in children:
            if child.status == old or (
                new_status in ("recalled", "destroyed") and child.status in ("active", "shipped")
            ):
                try:
                    await transition_serial(
                        db,
                        vendor_id=vendor_id,
                        serial_id=child.id,
                        new_status=new_status,
                        actor_id=actor_id,
                        cascade=True,
                        notes=notes,
                    )
                except HTTPException:
                    pass
    await db.flush()
    return s


async def disaggregate_serials(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    parent_id: UUID,
    actor_id: Optional[UUID] = None,
) -> list[PharmaSerialUnit]:
    """Detach all children from a parent serial (inverse of aggregate).

    The parent remains active but at its original level with no children.
    Children are detached (parent_id set to None) and remain active as standalone units.
    Both parent and children are audited.  An EPCIS unpacking event is emitted.
    """
    parent = (
        await db.execute(
            select(PharmaSerialUnit).where(
                PharmaSerialUnit.id == parent_id,
                PharmaSerialUnit.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not parent:
        raise HTTPException(404, "Parent serial not found")
    if parent.level == "unit":
        raise HTTPException(400, "Unit-level serials cannot be disaggregated (no hierarchy)")

    children = (
        await db.execute(
            select(PharmaSerialUnit).where(
                PharmaSerialUnit.vendor_id == vendor_id,
                PharmaSerialUnit.parent_id == parent_id,
            )
        )
    ).scalars().all()
    if not children:
        raise HTTPException(400, "No children attached to this serial — nothing to disaggregate")

    for c in children:
        c.parent_id = None
    await db.flush()

    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="pharma_serial_unit",
        entity_id=parent.id,
        action="disaggregate",
        actor_id=actor_id,
        meaning="author",
        new_value={"children_released": [str(c.id) for c in children]},
    )
    try:
        from app.services.pharma_epcis import record_serial_lifecycle_event
        await record_serial_lifecycle_event(
            db,
            vendor_id=vendor_id,
            serials=list(children),
            biz_step="unpacking",
            disposition="active",
            actor_id=actor_id,
            source_type="serial_disaggregate",
            source_id=parent.id,
        )
    except Exception:
        pass
    await db.flush()
    return list(children)


async def consume_serials_for_sale(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    product_id: UUID,
    quantity: int,
    source_id: Optional[UUID] = None,
    source_type: str = "sale",
    serial_numbers: Optional[list[str]] = None,
) -> list[dict[str, Any]]:
    """
    When product is serial_managed, mark N active unit serials as shipped.
    Prefer explicit serial_numbers; else FEFO-ish by created_at.
    """
    product = await db.get(Product, product_id)
    if not product or not getattr(product, "serial_managed", False):
        return []

    qty = abs(int(quantity))
    if qty <= 0:
        return []

    # Batches for this product with active unit serials
    q = (
        select(PharmaSerialUnit)
        .join(GoodsBatch, GoodsBatch.id == PharmaSerialUnit.goods_batch_id)
        .where(
            PharmaSerialUnit.vendor_id == vendor_id,
            GoodsBatch.product_id == product_id,
            PharmaSerialUnit.status == "active",
            PharmaSerialUnit.level == "unit",
        )
        .order_by(PharmaSerialUnit.created_at.asc())
    )
    if serial_numbers:
        sns = [s.strip() for s in serial_numbers if s and str(s).strip()]
        q = q.where(PharmaSerialUnit.serial_number.in_(sns))

    rows = (await db.execute(q.limit(qty))).scalars().all()
    if len(rows) < qty:
        raise ValueError(
            f"Insufficient active serials for {getattr(product, 'name', product_id)}: "
            f"need {qty}, have {len(rows)}"
        )

    details: list[dict[str, Any]] = []
    for s in rows:
        s.status = "shipped"
        meta = dict(s.meta or {})
        meta["shipped_via"] = {"source_type": source_type, "source_id": str(source_id) if source_id else None}
        s.meta = meta
        details.append(_serial_dict(s))
        await append_pharma_audit(
            db,
            vendor_id=vendor_id,
            entity_type="pharma_serial_unit",
            entity_id=s.id,
            action="ship",
            new_value={"source_type": source_type, "source_id": str(source_id) if source_id else None},
        )
    try:
        from app.services.pharma_epcis import record_serial_lifecycle_event
        await record_serial_lifecycle_event(
            db,
            vendor_id=vendor_id,
            serials=list(rows),
            biz_step="shipping",
            disposition="in_transit",
            source_type=source_type,
            source_id=source_id,
        )
    except Exception:
        pass
    await db.flush()
    return details


async def count_active_serials(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    goods_batch_id: Optional[UUID] = None,
) -> int:
    q = select(func.count()).select_from(PharmaSerialUnit).where(
        PharmaSerialUnit.vendor_id == vendor_id,
        PharmaSerialUnit.status == "active",
    )
    if goods_batch_id:
        q = q.where(PharmaSerialUnit.goods_batch_id == goods_batch_id)
    return int((await db.execute(q)).scalar() or 0)
