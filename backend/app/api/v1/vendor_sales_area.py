# app/api/v1/vendor_sales_area.py
"""Sales & Distribution (SD) master data: Division, Distribution Channel,
Delivery Channel, and Sales Area (Business Unit x Distribution Channel x Division).

Sales Organization is not a separate resource here — it reuses the existing
Business Unit (`Store` with `parent_id IS NULL`; see vendor_stores.py).
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, require_permission
from app.models.store import Store
from app.models.sales_area import SalesDivision, DistributionChannel, DeliveryChannel, SalesArea
from app.schemas.sales_area import (
    DivisionCreate, DivisionUpdate,
    DistributionChannelCreate, DistributionChannelUpdate,
    DeliveryChannelCreate, DeliveryChannelUpdate,
    SalesAreaCreate, SalesAreaUpdate,
)

router = APIRouter(dependencies=[Depends(require_permission("orders.view"))])


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _ensure_defaults(db: AsyncSession, vendor_id: UUID) -> None:
    """Seed a Default division, Retail distribution channel, and Standard
    delivery channel the first time a vendor touches this master data."""
    changed = False

    div_count = (await db.execute(
        select(func.count()).select_from(SalesDivision).where(SalesDivision.vendor_id == vendor_id)
    )).scalar_one() or 0
    if div_count == 0:
        db.add(SalesDivision(vendor_id=vendor_id, code="GEN", name="General", is_default=True))
        changed = True

    dc_count = (await db.execute(
        select(func.count()).select_from(DistributionChannel).where(DistributionChannel.vendor_id == vendor_id)
    )).scalar_one() or 0
    if dc_count == 0:
        db.add(DistributionChannel(vendor_id=vendor_id, code="RET", name="Retail", channel_type="retail", is_default=True))
        changed = True

    del_count = (await db.execute(
        select(func.count()).select_from(DeliveryChannel).where(DeliveryChannel.vendor_id == vendor_id)
    )).scalar_one() or 0
    if del_count == 0:
        db.add(DeliveryChannel(vendor_id=vendor_id, code="STD", name="Standard Delivery", mode="own_fleet", is_default=True))
        changed = True

    if changed:
        await db.flush()


async def _get_division_or_404(division_id: UUID, vendor_id: UUID, db: AsyncSession) -> SalesDivision:
    result = await db.execute(select(SalesDivision).where(SalesDivision.id == division_id, SalesDivision.vendor_id == vendor_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Division not found")
    return obj


async def _get_distribution_channel_or_404(channel_id: UUID, vendor_id: UUID, db: AsyncSession) -> DistributionChannel:
    result = await db.execute(select(DistributionChannel).where(DistributionChannel.id == channel_id, DistributionChannel.vendor_id == vendor_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Distribution channel not found")
    return obj


async def _get_delivery_channel_or_404(channel_id: UUID, vendor_id: UUID, db: AsyncSession) -> DeliveryChannel:
    result = await db.execute(select(DeliveryChannel).where(DeliveryChannel.id == channel_id, DeliveryChannel.vendor_id == vendor_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Delivery channel not found")
    return obj


async def _get_business_unit_or_404(bu_id: UUID, vendor_id: UUID, db: AsyncSession) -> Store:
    """Fetch a store that must be a root Business Unit (parent_id IS NULL)."""
    result = await db.execute(select(Store).where(Store.id == bu_id, Store.vendor_id == vendor_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Business unit not found")
    if store.parent_id is not None:
        raise HTTPException(status_code=400, detail="Store is a branch, not a business unit")
    return store


async def _get_branch_or_404(branch_id: UUID, bu_id: UUID, vendor_id: UUID, db: AsyncSession) -> Store:
    """Fetch a branch that belongs to the given business unit."""
    result = await db.execute(
        select(Store).where(Store.id == branch_id, Store.vendor_id == vendor_id, Store.parent_id == bu_id)
    )
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found for this business unit")
    return branch


def _sales_area_display_name(s, dc=None, dv=None, scope=None) -> str:
    """Never return a null/empty label for UI dropdowns."""
    if s.name and str(s.name).strip() and str(s.name).strip().lower() != "null":
        return str(s.name).strip()
    parts = []
    if scope is not None and (getattr(scope, "code", None) or getattr(scope, "name", None)):
        parts.append(scope.code or scope.name)
    if dc is not None and (dc.name or dc.code):
        parts.append(dc.name or dc.code)
    if dv is not None and (dv.name or dv.code):
        parts.append(dv.name or dv.code)
    if parts:
        return " · ".join(str(p) for p in parts if p)
    if s.code:
        return str(s.code)
    return "Sales area"


def _sales_area_to_dict(
    s: SalesArea,
    scope: Optional[Store] = None,
    root_bu: Optional[Store] = None,
    dc: Optional[DistributionChannel] = None,
    dv: Optional[SalesDivision] = None,
) -> dict:
    """scope = persisted store (business unit or branch); root_bu = owning business unit."""
    is_branch = bool(scope and scope.parent_id)
    bu = root_bu or scope
    branch = scope if is_branch else None
    return {
        "id": str(s.id),
        "vendor_id": str(s.vendor_id),
        "store_id": str(s.business_unit_id),
        "unit_type": "branch" if is_branch else "business_unit",
        "business_unit_id": str(bu.id) if bu else str(s.business_unit_id),
        "business_unit_name": bu.name if bu else None,
        "business_unit_code": bu.code if bu else None,
        "branch_id": str(branch.id) if branch else None,
        "branch_name": branch.name if branch else None,
        "branch_code": branch.code if branch else None,
        "distribution_channel_id": str(s.distribution_channel_id),
        "distribution_channel_name": dc.name if dc else None,
        "distribution_channel_code": dc.code if dc else None,
        "division_id": str(s.division_id),
        "division_name": dv.name if dv else None,
        "division_code": dv.code if dv else None,
        "code": s.code,
        "name": _sales_area_display_name(s, dc=dc, dv=dv, scope=scope),
        "is_active": s.is_active,
        "is_default": s.is_default,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _division_to_dict(d: SalesDivision) -> dict:
    return {
        "id": str(d.id),
        "vendor_id": str(d.vendor_id),
        "code": d.code,
        "name": d.name,
        "description": d.description,
        "is_active": d.is_active,
        "is_default": d.is_default,
        "sort_order": d.sort_order or 0,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def _distribution_channel_to_dict(d: DistributionChannel) -> dict:
    return {
        "id": str(d.id),
        "vendor_id": str(d.vendor_id),
        "code": d.code,
        "name": d.name,
        "channel_type": d.channel_type,
        "description": d.description,
        "is_active": d.is_active,
        "is_default": d.is_default,
        "sort_order": d.sort_order or 0,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def _delivery_channel_to_dict(d: DeliveryChannel) -> dict:
    return {
        "id": str(d.id),
        "vendor_id": str(d.vendor_id),
        "code": d.code,
        "name": d.name,
        "mode": d.mode,
        "description": d.description,
        "lead_time_days": d.lead_time_days,
        "base_charge": float(d.base_charge) if d.base_charge is not None else 0,
        "settings": d.settings or {},
        "is_active": d.is_active,
        "is_default": d.is_default,
        "sort_order": d.sort_order or 0,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


async def _stores_for_sales_areas(
    db: AsyncSession, store_ids: set[UUID]
) -> tuple[dict[UUID, Store], dict[UUID, Store]]:
    """Resolve scope stores and their root business units for sales-area rows."""
    if not store_ids:
        return {}, {}
    scopes = {
        s.id: s
        for s in (await db.execute(select(Store).where(Store.id.in_(store_ids)))).scalars().all()
    }
    parent_ids = {s.parent_id for s in scopes.values() if s.parent_id}
    roots = {
        s.id: s
        for s in (await db.execute(select(Store).where(Store.id.in_(parent_ids)))).scalars().all()
    } if parent_ids else {}
    root_by_scope: dict[UUID, Store] = {}
    for sid, scope in scopes.items():
        root_by_scope[sid] = roots[scope.parent_id] if scope.parent_id else scope
    return scopes, root_by_scope


# ── Divisions ────────────────────────────────────────────────────────────────

@router.get("/divisions")
async def list_divisions(
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_defaults(db, vendor_id)
    await db.commit()

    q = select(SalesDivision).where(SalesDivision.vendor_id == vendor_id)
    if is_active is not None:
        q = q.where(SalesDivision.is_active == is_active)
    q = q.order_by(SalesDivision.is_default.desc(), SalesDivision.sort_order, SalesDivision.name)
    result = await db.execute(q)
    divisions = result.scalars().all()
    return {"divisions": [_division_to_dict(d) for d in divisions], "total": len(divisions)}


@router.post("/divisions", status_code=status.HTTP_201_CREATED)
async def create_division(
    data: DivisionCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    code = data.code.strip().upper()
    dup = await db.execute(select(func.count()).where(SalesDivision.vendor_id == vendor_id, SalesDivision.code == code))
    if (dup.scalar_one() or 0) > 0:
        raise HTTPException(status_code=400, detail="A division with this code already exists")

    if data.is_default:
        await db.execute(update(SalesDivision).where(SalesDivision.vendor_id == vendor_id).values(is_default=False))

    division = SalesDivision(
        vendor_id=vendor_id,
        code=code,
        name=data.name.strip(),
        description=data.description,
        is_default=bool(data.is_default),
        sort_order=data.sort_order,
    )
    db.add(division)
    await db.commit()
    await db.refresh(division)
    return {"division": _division_to_dict(division), "message": "Division created"}


@router.put("/divisions/{division_id}")
async def update_division(
    division_id: UUID,
    data: DivisionUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    division = await _get_division_or_404(division_id, vendor_id, db)

    if data.code is not None:
        code = data.code.strip().upper()
        dup = await db.execute(
            select(func.count()).where(SalesDivision.vendor_id == vendor_id, SalesDivision.code == code, SalesDivision.id != division_id)
        )
        if (dup.scalar_one() or 0) > 0:
            raise HTTPException(status_code=400, detail="A division with this code already exists")
        division.code = code

    if data.is_default:
        await db.execute(
            update(SalesDivision).where(SalesDivision.vendor_id == vendor_id, SalesDivision.id != division_id).values(is_default=False)
        )

    if data.name is not None:
        division.name = data.name.strip()
    if data.description is not None:
        division.description = data.description
    if data.is_active is not None:
        division.is_active = data.is_active
    if data.is_default is not None:
        division.is_default = data.is_default
    if data.sort_order is not None:
        division.sort_order = data.sort_order

    await db.commit()
    await db.refresh(division)
    return {"division": _division_to_dict(division), "message": "Division updated"}


@router.delete("/divisions/{division_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_division(
    division_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    division = await _get_division_or_404(division_id, vendor_id, db)
    if division.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default division. Set another division as default first.")
    in_use = (await db.execute(select(func.count()).where(SalesArea.division_id == division_id))).scalar() or 0
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot delete a division used by one or more sales areas")
    await db.delete(division)
    await db.commit()


# ── Distribution Channels ─────────────────────────────────────────────────────

@router.get("/distribution-channels")
async def list_distribution_channels(
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_defaults(db, vendor_id)
    await db.commit()

    q = select(DistributionChannel).where(DistributionChannel.vendor_id == vendor_id)
    if is_active is not None:
        q = q.where(DistributionChannel.is_active == is_active)
    q = q.order_by(DistributionChannel.is_default.desc(), DistributionChannel.sort_order, DistributionChannel.name)
    result = await db.execute(q)
    channels = result.scalars().all()
    return {"distribution_channels": [_distribution_channel_to_dict(c) for c in channels], "total": len(channels)}


@router.post("/distribution-channels", status_code=status.HTTP_201_CREATED)
async def create_distribution_channel(
    data: DistributionChannelCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    code = data.code.strip().upper()
    dup = await db.execute(select(func.count()).where(DistributionChannel.vendor_id == vendor_id, DistributionChannel.code == code))
    if (dup.scalar_one() or 0) > 0:
        raise HTTPException(status_code=400, detail="A distribution channel with this code already exists")

    if data.is_default:
        await db.execute(update(DistributionChannel).where(DistributionChannel.vendor_id == vendor_id).values(is_default=False))

    channel = DistributionChannel(
        vendor_id=vendor_id,
        code=code,
        name=data.name.strip(),
        channel_type=data.channel_type,
        description=data.description,
        is_default=bool(data.is_default),
        sort_order=data.sort_order,
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"distribution_channel": _distribution_channel_to_dict(channel), "message": "Distribution channel created"}


@router.put("/distribution-channels/{channel_id}")
async def update_distribution_channel(
    channel_id: UUID,
    data: DistributionChannelUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    channel = await _get_distribution_channel_or_404(channel_id, vendor_id, db)

    if data.code is not None:
        code = data.code.strip().upper()
        dup = await db.execute(
            select(func.count()).where(DistributionChannel.vendor_id == vendor_id, DistributionChannel.code == code, DistributionChannel.id != channel_id)
        )
        if (dup.scalar_one() or 0) > 0:
            raise HTTPException(status_code=400, detail="A distribution channel with this code already exists")
        channel.code = code

    if data.is_default:
        await db.execute(
            update(DistributionChannel).where(DistributionChannel.vendor_id == vendor_id, DistributionChannel.id != channel_id).values(is_default=False)
        )

    if data.name is not None:
        channel.name = data.name.strip()
    if data.channel_type is not None:
        channel.channel_type = data.channel_type
    if data.description is not None:
        channel.description = data.description
    if data.is_active is not None:
        channel.is_active = data.is_active
    if data.is_default is not None:
        channel.is_default = data.is_default
    if data.sort_order is not None:
        channel.sort_order = data.sort_order

    await db.commit()
    await db.refresh(channel)
    return {"distribution_channel": _distribution_channel_to_dict(channel), "message": "Distribution channel updated"}


@router.delete("/distribution-channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_distribution_channel(
    channel_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    channel = await _get_distribution_channel_or_404(channel_id, vendor_id, db)
    if channel.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default distribution channel. Set another as default first.")
    in_use = (await db.execute(select(func.count()).where(SalesArea.distribution_channel_id == channel_id))).scalar() or 0
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot delete a distribution channel used by one or more sales areas")
    await db.delete(channel)
    await db.commit()


# ── Delivery Channels ──────────────────────────────────────────────────────────

@router.get("/delivery-channels")
async def list_delivery_channels(
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_defaults(db, vendor_id)
    await db.commit()

    q = select(DeliveryChannel).where(DeliveryChannel.vendor_id == vendor_id)
    if is_active is not None:
        q = q.where(DeliveryChannel.is_active == is_active)
    q = q.order_by(DeliveryChannel.is_default.desc(), DeliveryChannel.sort_order, DeliveryChannel.name)
    result = await db.execute(q)
    channels = result.scalars().all()
    return {"delivery_channels": [_delivery_channel_to_dict(c) for c in channels], "total": len(channels)}


@router.post("/delivery-channels", status_code=status.HTTP_201_CREATED)
async def create_delivery_channel(
    data: DeliveryChannelCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    code = data.code.strip().upper()
    dup = await db.execute(select(func.count()).where(DeliveryChannel.vendor_id == vendor_id, DeliveryChannel.code == code))
    if (dup.scalar_one() or 0) > 0:
        raise HTTPException(status_code=400, detail="A delivery channel with this code already exists")

    if data.is_default:
        await db.execute(update(DeliveryChannel).where(DeliveryChannel.vendor_id == vendor_id).values(is_default=False))

    channel = DeliveryChannel(
        vendor_id=vendor_id,
        code=code,
        name=data.name.strip(),
        mode=data.mode,
        description=data.description,
        lead_time_days=data.lead_time_days,
        base_charge=data.base_charge or 0,
        settings=data.settings or {},
        is_default=bool(data.is_default),
        sort_order=data.sort_order,
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"delivery_channel": _delivery_channel_to_dict(channel), "message": "Delivery channel created"}


@router.put("/delivery-channels/{channel_id}")
async def update_delivery_channel(
    channel_id: UUID,
    data: DeliveryChannelUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    channel = await _get_delivery_channel_or_404(channel_id, vendor_id, db)

    if data.code is not None:
        code = data.code.strip().upper()
        dup = await db.execute(
            select(func.count()).where(DeliveryChannel.vendor_id == vendor_id, DeliveryChannel.code == code, DeliveryChannel.id != channel_id)
        )
        if (dup.scalar_one() or 0) > 0:
            raise HTTPException(status_code=400, detail="A delivery channel with this code already exists")
        channel.code = code

    if data.is_default:
        await db.execute(
            update(DeliveryChannel).where(DeliveryChannel.vendor_id == vendor_id, DeliveryChannel.id != channel_id).values(is_default=False)
        )

    if data.name is not None:
        channel.name = data.name.strip()
    if data.mode is not None:
        channel.mode = data.mode
    if data.description is not None:
        channel.description = data.description
    if data.lead_time_days is not None:
        channel.lead_time_days = data.lead_time_days
    if data.base_charge is not None:
        channel.base_charge = data.base_charge
    if data.settings is not None:
        channel.settings = data.settings
    if data.is_active is not None:
        channel.is_active = data.is_active
    if data.is_default is not None:
        channel.is_default = data.is_default
    if data.sort_order is not None:
        channel.sort_order = data.sort_order

    await db.commit()
    await db.refresh(channel)
    return {"delivery_channel": _delivery_channel_to_dict(channel), "message": "Delivery channel updated"}


@router.delete("/delivery-channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_delivery_channel(
    channel_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    channel = await _get_delivery_channel_or_404(channel_id, vendor_id, db)
    if channel.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default delivery channel. Set another as default first.")
    await db.delete(channel)
    await db.commit()


# ── Sales Areas ────────────────────────────────────────────────────────────────

@router.get("/sales-areas")
async def list_sales_areas(
    business_unit_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(SalesArea).where(SalesArea.vendor_id == vendor_id)
    if business_unit_id:
        bu_uuid = UUID(business_unit_id)
        branch_rows = await db.execute(
            select(Store.id).where(Store.parent_id == bu_uuid, Store.vendor_id == vendor_id)
        )
        scope_ids = [bu_uuid, *branch_rows.scalars().all()]
        q = q.where(SalesArea.business_unit_id.in_(scope_ids))
    if is_active is True:
        q = q.where(or_(SalesArea.is_active.is_(True), SalesArea.is_active.is_(None)))
    elif is_active is False:
        q = q.where(SalesArea.is_active.is_(False))
    q = q.order_by(SalesArea.is_default.desc(), SalesArea.created_at)
    result = await db.execute(q)
    areas = result.scalars().all()

    store_ids = {a.business_unit_id for a in areas}
    scopes, root_bus = await _stores_for_sales_areas(db, store_ids)
    dc_ids = {a.distribution_channel_id for a in areas}
    dv_ids = {a.division_id for a in areas}
    dcs = {c.id: c for c in (await db.execute(select(DistributionChannel).where(DistributionChannel.id.in_(dc_ids)))).scalars().all()} if dc_ids else {}
    dvs = {d.id: d for d in (await db.execute(select(SalesDivision).where(SalesDivision.id.in_(dv_ids)))).scalars().all()} if dv_ids else {}

    out = [
        _sales_area_to_dict(
            a,
            scopes.get(a.business_unit_id),
            root_bus.get(a.business_unit_id),
            dcs.get(a.distribution_channel_id),
            dvs.get(a.division_id),
        )
        for a in areas
    ]
    return {"sales_areas": out, "total": len(out)}


@router.post("/sales-areas", status_code=status.HTTP_201_CREATED)
async def create_sales_area(
    data: SalesAreaCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    bu = await _get_business_unit_or_404(UUID(data.business_unit_id), vendor_id, db)
    scope = bu
    if data.branch_id:
        scope = await _get_branch_or_404(UUID(data.branch_id), bu.id, vendor_id, db)
    dc = await _get_distribution_channel_or_404(UUID(data.distribution_channel_id), vendor_id, db)
    dv = await _get_division_or_404(UUID(data.division_id), vendor_id, db)

    dup = await db.execute(
        select(func.count()).where(
            SalesArea.vendor_id == vendor_id,
            SalesArea.business_unit_id == scope.id,
            SalesArea.distribution_channel_id == dc.id,
            SalesArea.division_id == dv.id,
        )
    )
    if (dup.scalar_one() or 0) > 0:
        raise HTTPException(status_code=400, detail="This sales area combination already exists")

    if data.is_default:
        await db.execute(update(SalesArea).where(SalesArea.vendor_id == vendor_id).values(is_default=False))

    scope_label = scope.code or scope.name
    code = (data.code or "").strip() or f"{scope_label}/{dc.code}/{dv.code}"
    # Prefer explicit name; otherwise a readable route-style label (never leave null for UI).
    explicit_name = (data.name or "").strip()
    auto_name = f"{dc.name} · {dv.name}"
    if scope.code or scope.name:
        auto_name = f"{scope.code or scope.name} · {dc.name} · {dv.name}"
    sales_area = SalesArea(
        vendor_id=vendor_id,
        business_unit_id=scope.id,
        distribution_channel_id=dc.id,
        division_id=dv.id,
        code=code,
        name=explicit_name or auto_name,
        is_active=True,
        is_default=bool(data.is_default),
    )
    db.add(sales_area)
    await db.commit()
    await db.refresh(sales_area)
    return {"sales_area": _sales_area_to_dict(sales_area, scope, bu, dc, dv), "message": "Sales area created"}


@router.put("/sales-areas/{sales_area_id}")
async def update_sales_area(
    sales_area_id: UUID,
    data: SalesAreaUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SalesArea).where(SalesArea.id == sales_area_id, SalesArea.vendor_id == vendor_id))
    sales_area = result.scalar_one_or_none()
    if not sales_area:
        raise HTTPException(status_code=404, detail="Sales area not found")

    if data.is_default:
        await db.execute(
            update(SalesArea).where(SalesArea.vendor_id == vendor_id, SalesArea.id != sales_area_id).values(is_default=False)
        )

    if data.code is not None:
        sales_area.code = data.code.strip() or None
    if data.name is not None:
        sales_area.name = data.name.strip() or None
    if data.is_active is not None:
        sales_area.is_active = data.is_active
    if data.is_default is not None:
        sales_area.is_default = data.is_default

    await db.commit()
    await db.refresh(sales_area)

    scope = await db.get(Store, sales_area.business_unit_id)
    root_bu = None
    if scope:
        root_bu = await db.get(Store, scope.parent_id) if scope.parent_id else scope
    dc = await db.get(DistributionChannel, sales_area.distribution_channel_id)
    dv = await db.get(SalesDivision, sales_area.division_id)
    return {"sales_area": _sales_area_to_dict(sales_area, scope, root_bu, dc, dv), "message": "Sales area updated"}


@router.delete("/sales-areas/{sales_area_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_area(
    sales_area_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SalesArea).where(SalesArea.id == sales_area_id, SalesArea.vendor_id == vendor_id))
    sales_area = result.scalar_one_or_none()
    if not sales_area:
        raise HTTPException(status_code=404, detail="Sales area not found")
    if sales_area.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default sales area. Set another as default first.")
    await db.delete(sales_area)
    await db.commit()
