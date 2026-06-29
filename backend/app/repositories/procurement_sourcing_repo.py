# app/repositories/procurement_sourcing_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.repositories.base import BaseRepository
from app.models.procurement_sourcing import PurchasingInfoRecord, SourceList


def _pir_load_options():
    return (
        selectinload(PurchasingInfoRecord.supplier),
        selectinload(PurchasingInfoRecord.product),
    )


def _sl_load_options():
    return (
        selectinload(SourceList.supplier),
        selectinload(SourceList.product),
    )


class PurchasingInfoRecordRepository(BaseRepository[PurchasingInfoRecord]):
    def __init__(self, db: AsyncSession):
        super().__init__(PurchasingInfoRecord, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, record_id: UUID
    ) -> Optional[PurchasingInfoRecord]:
        result = await self.db.execute(
            select(PurchasingInfoRecord)
            .options(*_pir_load_options())
            .where(
                PurchasingInfoRecord.vendor_id == vendor_id,
                PurchasingInfoRecord.id == record_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_supplier_and_product(
        self,
        vendor_id: UUID,
        supplier_id: UUID,
        product_id: UUID,
        variant_id: Optional[UUID] = None,
    ) -> Optional[PurchasingInfoRecord]:
        conditions = [
            PurchasingInfoRecord.vendor_id == vendor_id,
            PurchasingInfoRecord.supplier_id == supplier_id,
            PurchasingInfoRecord.product_id == product_id,
            PurchasingInfoRecord.is_active == True,
        ]
        if variant_id is not None:
            conditions.append(PurchasingInfoRecord.variant_id == variant_id)
        result = await self.db.execute(
            select(PurchasingInfoRecord).where(and_(*conditions)).limit(1)
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        supplier_id: Optional[UUID] = None,
        product_id: Optional[UUID] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[PurchasingInfoRecord], int]:
        from sqlalchemy import func as sqlfunc
        conditions = [PurchasingInfoRecord.vendor_id == vendor_id]
        if supplier_id is not None:
            conditions.append(PurchasingInfoRecord.supplier_id == supplier_id)
        if product_id is not None:
            conditions.append(PurchasingInfoRecord.product_id == product_id)
        if is_active is not None:
            conditions.append(PurchasingInfoRecord.is_active == is_active)

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(PurchasingInfoRecord).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(PurchasingInfoRecord)
            .options(*_pir_load_options())
            .where(and_(*conditions))
            .order_by(PurchasingInfoRecord.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total


class SourceListRepository(BaseRepository[SourceList]):
    def __init__(self, db: AsyncSession):
        super().__init__(SourceList, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, source_id: UUID
    ) -> Optional[SourceList]:
        result = await self.db.execute(
            select(SourceList)
            .options(*_sl_load_options())
            .where(
                SourceList.vendor_id == vendor_id,
                SourceList.id == source_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_product(
        self,
        vendor_id: UUID,
        product_id: UUID,
        variant_id: Optional[UUID] = None,
    ) -> List[SourceList]:
        conditions = [
            SourceList.vendor_id == vendor_id,
            SourceList.product_id == product_id,
            SourceList.is_blocked == False,
        ]
        if variant_id is not None:
            conditions.append(SourceList.variant_id == variant_id)
        result = await self.db.execute(
            select(SourceList)
            .where(and_(*conditions))
            .order_by(SourceList.priority, SourceList.is_fixed.desc())
        )
        return list(result.scalars().all())

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        supplier_id: Optional[UUID] = None,
        product_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[SourceList], int]:
        from sqlalchemy import func as sqlfunc
        conditions = [SourceList.vendor_id == vendor_id]
        if supplier_id is not None:
            conditions.append(SourceList.supplier_id == supplier_id)
        if product_id is not None:
            conditions.append(SourceList.product_id == product_id)

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(SourceList).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(SourceList)
            .options(*_sl_load_options())
            .where(and_(*conditions))
            .order_by(SourceList.priority, SourceList.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total
