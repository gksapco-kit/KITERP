# app/repositories/procurement_goods_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func as sqlfunc

from app.repositories.base import BaseRepository
from app.models.procurement_goods import GoodsBatch, GoodsMovementDocument


class GoodsBatchRepository(BaseRepository[GoodsBatch]):
    def __init__(self, db: AsyncSession):
        super().__init__(GoodsBatch, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, batch_id: UUID
    ) -> Optional[GoodsBatch]:
        result = await self.db.execute(
            select(GoodsBatch).where(
                GoodsBatch.vendor_id == vendor_id,
                GoodsBatch.id == batch_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_batch_number(
        self,
        vendor_id: UUID,
        product_id: UUID,
        batch_number: str,
    ) -> Optional[GoodsBatch]:
        result = await self.db.execute(
            select(GoodsBatch).where(
                GoodsBatch.vendor_id == vendor_id,
                GoodsBatch.product_id == product_id,
                GoodsBatch.batch_number == batch_number,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        product_id: Optional[UUID] = None,
        plant_id: Optional[UUID] = None,
        quality_status: Optional[str] = None,
        expiring_within_days: Optional[int] = None,
        is_active: Optional[bool] = True,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[GoodsBatch], int]:
        from datetime import date, timedelta
        conditions = [GoodsBatch.vendor_id == vendor_id]
        if product_id is not None:
            conditions.append(GoodsBatch.product_id == product_id)
        if plant_id is not None:
            conditions.append(GoodsBatch.plant_id == plant_id)
        if quality_status is not None:
            conditions.append(GoodsBatch.quality_status == quality_status)
        if is_active is not None:
            conditions.append(GoodsBatch.is_active == is_active)
        if expiring_within_days is not None:
            cutoff = date.today() + timedelta(days=expiring_within_days)
            conditions.append(GoodsBatch.expiry_date <= cutoff)
            conditions.append(GoodsBatch.expiry_date.isnot(None))

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(GoodsBatch).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(GoodsBatch)
            .where(and_(*conditions))
            .order_by(GoodsBatch.expiry_date.asc().nullslast(), GoodsBatch.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total


class GoodsMovementDocumentRepository(BaseRepository[GoodsMovementDocument]):
    def __init__(self, db: AsyncSession):
        super().__init__(GoodsMovementDocument, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, doc_id: UUID
    ) -> Optional[GoodsMovementDocument]:
        result = await self.db.execute(
            select(GoodsMovementDocument).where(
                GoodsMovementDocument.vendor_id == vendor_id,
                GoodsMovementDocument.id == doc_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_next_document_number(self, vendor_id: UUID) -> str:
        result = await self.db.execute(
            select(sqlfunc.count())
            .select_from(GoodsMovementDocument)
            .where(GoodsMovementDocument.vendor_id == vendor_id)
        )
        count = result.scalar_one()
        return f"GMD-{str(count + 1).zfill(8)}"

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        movement_type: Optional[str] = None,
        plant_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[GoodsMovementDocument], int]:
        conditions = [GoodsMovementDocument.vendor_id == vendor_id]
        if movement_type is not None:
            conditions.append(GoodsMovementDocument.movement_type == movement_type)
        if plant_id is not None:
            conditions.append(GoodsMovementDocument.plant_id == plant_id)

        count_result = await self.db.execute(
            select(sqlfunc.count())
            .select_from(GoodsMovementDocument)
            .where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(GoodsMovementDocument)
            .where(and_(*conditions))
            .order_by(GoodsMovementDocument.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total
