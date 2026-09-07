"""Resolve the org dimensions (company / branch / plant) a procurement document posts against.

The approver matrix routes on exactly these three columns and treats NULL as a
wildcard, so a document that leaves them empty can only ever match catch-all
rules. Resolution is read-only — a vendor that has never opened Finance simply
resolves to a NULL company rather than having one created underneath them.
"""
from __future__ import annotations

from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinCompany
from app.models.plant import Plant
from app.models.store import Store
from app.services.store_resolver import resolve_store_id


def _as_uuid(raw: object) -> Optional[UUID]:
    if raw in (None, ""):
        return None
    if isinstance(raw, UUID):
        return raw
    try:
        return UUID(str(raw))
    except (ValueError, TypeError, AttributeError):
        return None


async def _company_id_by_code(db: AsyncSession, vendor_id: UUID, code: Optional[str]) -> Optional[UUID]:
    code = (code or "").strip()[:20]
    if not code:
        return None
    row = await db.execute(
        select(FinCompany.id)
        .where(
            FinCompany.vendor_id == vendor_id,
            FinCompany.code == code,
            FinCompany.is_active.is_(True),
        )
        .limit(1)
    )
    return row.scalars().first()


async def resolve_company_id(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
) -> Optional[UUID]:
    """The finance company a store books against.

    Finance keeps one FinCompany per store code (see
    `_sync_fin_companies_from_stores`), so a store maps to its company by code.
    Branches fall back to their parent business unit, since vendors that only
    book at BU level never get a company row for the branch itself.
    """
    if store_id:
        store = await db.get(Store, store_id)
        if store is not None and store.vendor_id == vendor_id:
            company_id = await _company_id_by_code(db, vendor_id, store.code)
            if company_id:
                return company_id
            if store.parent_id:
                parent = await db.get(Store, store.parent_id)
                if parent is not None and parent.vendor_id == vendor_id:
                    company_id = await _company_id_by_code(db, vendor_id, parent.code)
                    if company_id:
                        return company_id

    row = await db.execute(
        select(FinCompany.id)
        .where(FinCompany.vendor_id == vendor_id, FinCompany.is_active.is_(True))
        .order_by(FinCompany.is_default.desc(), FinCompany.code)
        .limit(1)
    )
    return row.scalars().first()


async def _owned_plant_id(db: AsyncSession, vendor_id: UUID, plant_id: Optional[UUID]) -> Optional[UUID]:
    if not plant_id:
        return None
    plant = await db.get(Plant, plant_id)
    if plant is None or plant.vendor_id != vendor_id:
        return None
    return plant.id


async def resolve_po_org_context(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    branch_id: object = None,
    plant_id: object = None,
    company_id: object = None,
    line_plant_ids: Iterable[object] = (),
    vendor_user_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
) -> tuple[Optional[UUID], Optional[UUID], Optional[UUID]]:
    """Return (company_id, branch_id, plant_id) for a purchase order.

    Ids supplied by the caller are checked against the vendor before use so a
    stale or cross-tenant picker value degrades to the default rather than
    writing a foreign key that belongs to another tenant.
    """
    branch = _as_uuid(branch_id)
    if branch is not None:
        store = await db.get(Store, branch)
        if store is None or store.vendor_id != vendor_id or not store.is_active:
            branch = None
    branch = await resolve_store_id(
        db,
        vendor_id,
        store_id=branch,
        vendor_user_id=vendor_user_id,
        user_id=user_id,
    )

    plant = await _owned_plant_id(db, vendor_id, _as_uuid(plant_id))
    if plant is None:
        for raw in line_plant_ids:
            plant = await _owned_plant_id(db, vendor_id, _as_uuid(raw))
            if plant is not None:
                break

    company = _as_uuid(company_id)
    if company is not None:
        row = await db.get(FinCompany, company)
        if row is None or row.vendor_id != vendor_id:
            company = None
    if company is None:
        company = await resolve_company_id(db, vendor_id, branch)

    return company, branch, plant
