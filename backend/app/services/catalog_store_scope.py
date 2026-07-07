"""Business-unit (store) catalog availability for products and services."""
from __future__ import annotations

from typing import Iterable, Literal, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import ProductStore, ServiceStore, Store

StoreScope = Literal["all", "selected"]


async def validate_store_ids(db: AsyncSession, vendor_id: UUID, store_ids: Iterable[str]) -> list[UUID]:
    ids = [UUID(s) for s in store_ids]
    if not ids:
        return []
    result = await db.execute(
        select(Store.id).where(Store.vendor_id == vendor_id, Store.id.in_(ids), Store.is_active == True)
    )
    found = {row[0] for row in result.all()}
    missing = [str(i) for i in ids if i not in found]
    if missing:
        raise HTTPException(400, f"Invalid or inactive business unit(s): {', '.join(missing)}")
    return ids


async def sync_product_stores(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    store_scope: StoreScope,
    store_ids: Optional[list[str]],
) -> None:
    await db.execute(delete(ProductStore).where(ProductStore.product_id == product_id))
    if store_scope != "selected":
        return
    validated = await validate_store_ids(db, vendor_id, store_ids or [])
    if not validated:
        raise HTTPException(400, "Select at least one business unit when scope is 'selected'")
    for sid in validated:
        db.add(ProductStore(vendor_id=vendor_id, product_id=product_id, store_id=sid))


async def sync_service_stores(
    db: AsyncSession,
    vendor_id: UUID,
    service_id: UUID,
    store_scope: StoreScope,
    store_ids: Optional[list[str]],
) -> None:
    await db.execute(delete(ServiceStore).where(ServiceStore.service_id == service_id))
    if store_scope != "selected":
        return
    validated = await validate_store_ids(db, vendor_id, store_ids or [])
    if not validated:
        raise HTTPException(400, "Select at least one business unit when scope is 'selected'")
    for sid in validated:
        db.add(ServiceStore(vendor_id=vendor_id, service_id=service_id, store_id=sid))


async def get_product_store_ids(db: AsyncSession, product_id: UUID) -> list[str]:
    result = await db.execute(
        select(ProductStore.store_id).where(ProductStore.product_id == product_id)
    )
    return [str(row[0]) for row in result.all()]


async def get_service_store_ids(db: AsyncSession, service_id: UUID) -> list[str]:
    result = await db.execute(
        select(ServiceStore.store_id).where(ServiceStore.service_id == service_id)
    )
    return [str(row[0]) for row in result.all()]


def product_available_at_store(store_id: UUID):
    """SQLAlchemy filter: product visible at the given business unit."""
    assigned = select(ProductStore.product_id).where(ProductStore.store_id == store_id)
    from app.models.vendor_product import Product
    return or_(
        Product.store_scope.in_(("all", None)),
        Product.id.in_(assigned),
    )


def service_available_at_store(store_id: UUID):
    """SQLAlchemy filter: service visible at the given business unit."""
    assigned = select(ServiceStore.service_id).where(ServiceStore.store_id == store_id)
    from app.models.vendor_service import Service
    return or_(
        Service.store_scope.in_(("all", None)),
        Service.id.in_(assigned),
    )


async def resolve_store_id(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    store_id: Optional[str] = None,
    branch: Optional[str] = None,
) -> Optional[UUID]:
    """Resolve store UUID from store_id param or branch code/id string."""
    if store_id:
        try:
            sid = UUID(store_id)
        except ValueError:
            raise HTTPException(400, "Invalid store_id")
        row = await db.execute(
            select(Store.id, Store.is_open).where(Store.vendor_id == vendor_id, Store.id == sid, Store.is_active == True)
        )
        result_row = row.one_or_none()
        if not result_row:
            raise HTTPException(404, "Business unit not found")
        if result_row[1] is False:
            raise HTTPException(422, "This business unit is currently closed")
        return sid
    if branch:
        cleaned = branch.strip()
        filters = [func.lower(Store.code) == cleaned.lower()]
        try:
            filters.append(Store.id == UUID(cleaned))
        except ValueError:
            pass
        row = await db.execute(
            select(Store.id, Store.is_open).where(
                Store.vendor_id == vendor_id,
                Store.is_active == True,
                or_(*filters),
            )
        )
        result_row = row.one_or_none()
        if not result_row:
            raise HTTPException(404, "Business unit not found")
        if result_row[1] is False:
            raise HTTPException(422, "This business unit is currently closed")
        return result_row[0]
    return None
