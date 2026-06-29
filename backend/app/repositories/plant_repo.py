# app/repositories/plant_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.repositories.base import BaseRepository
from app.models.plant import Plant


class PlantRepository(BaseRepository[Plant]):
    def __init__(self, db: AsyncSession):
        super().__init__(Plant, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, plant_id: UUID
    ) -> Optional[Plant]:
        result = await self.db.execute(
            select(Plant).where(
                Plant.vendor_id == vendor_id,
                Plant.id == plant_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_store_and_code(
        self, vendor_id: UUID, store_id: UUID, code: str
    ) -> Optional[Plant]:
        result = await self.db.execute(
            select(Plant).where(
                Plant.vendor_id == vendor_id,
                Plant.store_id == store_id,
                Plant.code == code,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_store(
        self,
        vendor_id: UUID,
        store_id: UUID,
        is_active: Optional[bool] = None,
    ) -> List[Plant]:
        query = select(Plant).where(
            Plant.vendor_id == vendor_id,
            Plant.store_id == store_id,
        )
        if is_active is not None:
            query = query.where(Plant.is_active == is_active)
        query = query.order_by(Plant.sort_order, Plant.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())
