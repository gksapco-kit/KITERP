from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import ProductionOrder


class ProductionOrderRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(
        self,
        vendor_id: UUID,
        *,
        store_id: Optional[UUID] = None,
        type_filter: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 500,
    ) -> tuple[list[ProductionOrder], int]:
        q = select(ProductionOrder).where(ProductionOrder.vendor_id == vendor_id)
        if store_id is not None:
            q = q.where(ProductionOrder.store_id == store_id)
        if type_filter:
            q = q.where(ProductionOrder.type == type_filter)
        if status:
            q = q.where(ProductionOrder.status == status)
        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            q = q.where(
                func.lower(ProductionOrder.ref).like(term)
                | func.lower(func.coalesce(ProductionOrder.customer_name, "")).like(term)
                | func.lower(func.coalesce(ProductionOrder.order_ref, "")).like(term)
            )
        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.order_by(ProductionOrder.updated_at.desc()).offset(skip).limit(limit)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def get(self, order_id: UUID, vendor_id: UUID) -> Optional[ProductionOrder]:
        r = await self.db.execute(
            select(ProductionOrder).where(
                ProductionOrder.id == order_id,
                ProductionOrder.vendor_id == vendor_id,
            )
        )
        return r.scalar_one_or_none()

    async def get_by_ref(self, vendor_id: UUID, ref: str) -> Optional[ProductionOrder]:
        r = await self.db.execute(
            select(ProductionOrder).where(
                ProductionOrder.vendor_id == vendor_id,
                ProductionOrder.ref == ref,
            )
        )
        return r.scalar_one_or_none()

    async def create(self, row: ProductionOrder) -> ProductionOrder:
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def update(self, row: ProductionOrder, data: dict[str, Any]) -> ProductionOrder:
        for k, v in data.items():
            if hasattr(row, k):
                setattr(row, k, v)
        row.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(row)
        return row

    async def delete(self, row: ProductionOrder) -> None:
        await self.db.delete(row)
        await self.db.flush()

    async def next_ref(self, vendor_id: UUID, po_type: str) -> str:
        prefix = po_type.lower()
        for _ in range(20):
            suffix = str(int(datetime.utcnow().timestamp() * 1000))[-6:]
            ref = f"{prefix.upper()}-{suffix}"
            existing = await self.get_by_ref(vendor_id, ref)
            if not existing:
                return ref
        return f"{prefix.upper()}-{uuid4().hex[:6].upper()}"
