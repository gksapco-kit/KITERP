# app/api/v1/vendor_controlling_area.py
"""Controlling Area master data — the CO-level org unit that one or more
`FinCompany` (posting entities) roll up under. See app/models/controlling_area.py.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id
from app.models.controlling_area import CoControllingArea
from app.models.finance import FinCompany
from app.schemas.controlling_area import ControllingAreaCreate, ControllingAreaUpdate

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _ensure_default(db: AsyncSession, vendor_id: UUID) -> None:
    """Seed a "Standard" controlling area the first time a vendor touches this
    master data, and roll any unassigned companies into it — mirrors how
    `fin_company` rows are auto-created from Business Units today."""
    count = (await db.execute(
        select(func.count()).select_from(CoControllingArea).where(CoControllingArea.vendor_id == vendor_id)
    )).scalar_one() or 0

    if count == 0:
        area = CoControllingArea(vendor_id=vendor_id, code="STD", name="Standard Controlling Area", is_default=True)
        db.add(area)
        await db.flush()
    else:
        area = (await db.execute(
            select(CoControllingArea).where(CoControllingArea.vendor_id == vendor_id, CoControllingArea.is_default == True)
        )).scalars().first()
        if not area:
            area = (await db.execute(
                select(CoControllingArea).where(CoControllingArea.vendor_id == vendor_id).order_by(CoControllingArea.created_at)
            )).scalars().first()

    if area:
        await db.execute(
            update(FinCompany)
            .where(FinCompany.vendor_id == vendor_id, FinCompany.controlling_area_id.is_(None))
            .values(controlling_area_id=area.id)
        )
    await db.flush()


async def _get_area_or_404(area_id: UUID, vendor_id: UUID, db: AsyncSession) -> CoControllingArea:
    result = await db.execute(
        select(CoControllingArea).where(CoControllingArea.id == area_id, CoControllingArea.vendor_id == vendor_id)
    )
    area = result.scalar_one_or_none()
    if not area:
        raise HTTPException(status_code=404, detail="Controlling area not found")
    return area


async def _get_company_or_404(company_id: UUID, vendor_id: UUID, db: AsyncSession) -> FinCompany:
    result = await db.execute(
        select(FinCompany).where(FinCompany.id == company_id, FinCompany.vendor_id == vendor_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def _area_to_dict(a: CoControllingArea, company_count: int = 0) -> dict:
    return {
        "id": str(a.id),
        "vendor_id": str(a.vendor_id),
        "code": a.code,
        "name": a.name,
        "description": a.description,
        "currency": a.currency,
        "is_active": a.is_active,
        "is_default": a.is_default,
        "company_count": company_count,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


def _company_to_dict(c: FinCompany) -> dict:
    return {
        "id": str(c.id),
        "code": c.code,
        "name": c.name,
        "currency": c.currency,
        "is_default": c.is_default,
        "is_active": c.is_active,
        "controlling_area_id": str(c.controlling_area_id) if c.controlling_area_id else None,
    }


# ── Controlling Areas ──────────────────────────────────────────────────────────

@router.get("/controlling-areas")
async def list_controlling_areas(
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_default(db, vendor_id)
    await db.commit()

    q = select(CoControllingArea).where(CoControllingArea.vendor_id == vendor_id)
    if is_active is not None:
        q = q.where(CoControllingArea.is_active == is_active)
    q = q.order_by(CoControllingArea.is_default.desc(), CoControllingArea.code)
    result = await db.execute(q)
    areas = result.scalars().all()

    counts_result = await db.execute(
        select(FinCompany.controlling_area_id, func.count()).where(
            FinCompany.vendor_id == vendor_id, FinCompany.controlling_area_id.isnot(None)
        ).group_by(FinCompany.controlling_area_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    out = [_area_to_dict(a, counts.get(a.id, 0)) for a in areas]
    return {"controlling_areas": out, "total": len(out)}


@router.post("/controlling-areas", status_code=status.HTTP_201_CREATED)
async def create_controlling_area(
    data: ControllingAreaCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    code = data.code.strip().upper()
    dup = await db.execute(
        select(func.count()).where(CoControllingArea.vendor_id == vendor_id, CoControllingArea.code == code)
    )
    if (dup.scalar_one() or 0) > 0:
        raise HTTPException(status_code=400, detail="A controlling area with this code already exists")

    if data.is_default:
        await db.execute(
            update(CoControllingArea).where(CoControllingArea.vendor_id == vendor_id).values(is_default=False)
        )

    area = CoControllingArea(
        vendor_id=vendor_id,
        code=code,
        name=data.name.strip(),
        description=data.description,
        currency=(data.currency or "INR").strip().upper()[:3],
        is_default=bool(data.is_default),
    )
    db.add(area)
    await db.commit()
    await db.refresh(area)
    return {"controlling_area": _area_to_dict(area), "message": "Controlling area created"}


@router.put("/controlling-areas/{area_id}")
async def update_controlling_area(
    area_id: UUID,
    data: ControllingAreaUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    area = await _get_area_or_404(area_id, vendor_id, db)

    if data.code is not None:
        code = data.code.strip().upper()
        dup = await db.execute(
            select(func.count()).where(
                CoControllingArea.vendor_id == vendor_id, CoControllingArea.code == code, CoControllingArea.id != area_id
            )
        )
        if (dup.scalar_one() or 0) > 0:
            raise HTTPException(status_code=400, detail="A controlling area with this code already exists")
        area.code = code

    if data.is_default:
        await db.execute(
            update(CoControllingArea).where(CoControllingArea.vendor_id == vendor_id, CoControllingArea.id != area_id).values(is_default=False)
        )

    if data.name is not None:
        area.name = data.name.strip()
    if data.description is not None:
        area.description = data.description
    if data.currency is not None:
        area.currency = data.currency.strip().upper()[:3]
    if data.is_active is not None:
        area.is_active = data.is_active
    if data.is_default is not None:
        area.is_default = data.is_default

    await db.commit()
    await db.refresh(area)
    return {"controlling_area": _area_to_dict(area), "message": "Controlling area updated"}


@router.delete("/controlling-areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_controlling_area(
    area_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    area = await _get_area_or_404(area_id, vendor_id, db)
    if area.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default controlling area. Set another as default first.")
    in_use = (await db.execute(
        select(func.count()).where(FinCompany.controlling_area_id == area_id)
    )).scalar() or 0
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot delete a controlling area with companies assigned. Reassign them first.")
    await db.delete(area)
    await db.commit()


# ── Company assignment ────────────────────────────────────────────────────────

@router.get("/controlling-areas/{area_id}/companies")
async def list_controlling_area_companies(
    area_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_area_or_404(area_id, vendor_id, db)
    result = await db.execute(
        select(FinCompany).where(FinCompany.vendor_id == vendor_id, FinCompany.controlling_area_id == area_id).order_by(FinCompany.code)
    )
    companies = result.scalars().all()
    return {"companies": [_company_to_dict(c) for c in companies], "total": len(companies)}


@router.put("/controlling-areas/{area_id}/companies/{company_id}")
async def assign_company_to_controlling_area(
    area_id: UUID,
    company_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_area_or_404(area_id, vendor_id, db)
    company = await _get_company_or_404(company_id, vendor_id, db)
    company.controlling_area_id = area_id
    await db.commit()
    await db.refresh(company)
    return {"company": _company_to_dict(company), "message": "Company assigned to controlling area"}
