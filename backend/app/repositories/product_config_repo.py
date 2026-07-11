# app/repositories/product_config_repo.py
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.base import BaseRepository
from app.models.product_config import ProductConfigAttribute, ProductConfigOption, ProductConfigRule


class ConfigAttributeRepository(BaseRepository[ProductConfigAttribute]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductConfigAttribute, db)

    async def list_for_product(self, vendor_id: UUID, product_id: UUID) -> list[ProductConfigAttribute]:
        result = await self.db.execute(
            select(ProductConfigAttribute)
            .where(
                ProductConfigAttribute.product_id == product_id,
                ProductConfigAttribute.vendor_id == vendor_id,
            )
            .order_by(ProductConfigAttribute.display_order, ProductConfigAttribute.display_name)
        )
        return list(result.scalars().all())


class ConfigOptionRepository(BaseRepository[ProductConfigOption]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductConfigOption, db)

    async def list_for_attributes(self, attribute_ids: list[UUID]) -> list[ProductConfigOption]:
        if not attribute_ids:
            return []
        result = await self.db.execute(
            select(ProductConfigOption)
            .where(ProductConfigOption.attribute_id.in_(attribute_ids))
            .order_by(ProductConfigOption.sort_order, ProductConfigOption.display_name)
        )
        return list(result.scalars().all())


class ConfigRuleRepository(BaseRepository[ProductConfigRule]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductConfigRule, db)

    async def list_for_product(self, vendor_id: UUID, product_id: UUID, active_only: bool = False) -> list[ProductConfigRule]:
        stmt = select(ProductConfigRule).where(
            ProductConfigRule.product_id == product_id,
            ProductConfigRule.vendor_id == vendor_id,
        )
        if active_only:
            stmt = stmt.where(ProductConfigRule.is_active.is_(True))
        stmt = stmt.order_by(ProductConfigRule.priority, ProductConfigRule.name)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
