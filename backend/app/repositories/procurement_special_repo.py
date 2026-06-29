# app/repositories/procurement_special_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func as sqlfunc

from app.repositories.base import BaseRepository
from app.models.procurement_special import (
    MaterialValuation,
    SubcontractingOrder,
    ConsignmentStock,
    ServiceEntrySheet,
)


class MaterialValuationRepository(BaseRepository[MaterialValuation]):
    def __init__(self, db: AsyncSession):
        super().__init__(MaterialValuation, db)

    async def get_by_product(
        self,
        vendor_id: UUID,
        product_id: UUID,
        variant_id: Optional[UUID] = None,
        plant_id: Optional[UUID] = None,
    ) -> Optional[MaterialValuation]:
        conditions = [
            MaterialValuation.vendor_id == vendor_id,
            MaterialValuation.product_id == product_id,
        ]
        conditions.append(
            MaterialValuation.variant_id == variant_id
            if variant_id else MaterialValuation.variant_id.is_(None)
        )
        conditions.append(
            MaterialValuation.plant_id == plant_id
            if plant_id else MaterialValuation.plant_id.is_(None)
        )
        result = await self.db.execute(
            select(MaterialValuation).where(and_(*conditions)).limit(1)
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        product_id: Optional[UUID] = None,
        plant_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[MaterialValuation], int]:
        conditions = [MaterialValuation.vendor_id == vendor_id]
        if product_id:
            conditions.append(MaterialValuation.product_id == product_id)
        if plant_id:
            conditions.append(MaterialValuation.plant_id == plant_id)

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(MaterialValuation).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(MaterialValuation)
            .where(and_(*conditions))
            .order_by(MaterialValuation.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total


class SubcontractingOrderRepository(BaseRepository[SubcontractingOrder]):
    def __init__(self, db: AsyncSession):
        super().__init__(SubcontractingOrder, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, sc_id: UUID
    ) -> Optional[SubcontractingOrder]:
        result = await self.db.execute(
            select(SubcontractingOrder).where(
                SubcontractingOrder.vendor_id == vendor_id,
                SubcontractingOrder.id == sc_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        status: Optional[str] = None,
        supplier_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[SubcontractingOrder], int]:
        conditions = [SubcontractingOrder.vendor_id == vendor_id]
        if status:
            conditions.append(SubcontractingOrder.status == status)
        if supplier_id:
            conditions.append(SubcontractingOrder.supplier_id == supplier_id)

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(SubcontractingOrder).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(SubcontractingOrder)
            .where(and_(*conditions))
            .order_by(SubcontractingOrder.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total


class ConsignmentStockRepository(BaseRepository[ConsignmentStock]):
    def __init__(self, db: AsyncSession):
        super().__init__(ConsignmentStock, db)

    async def get_by_supplier_and_product(
        self,
        vendor_id: UUID,
        supplier_id: UUID,
        product_id: UUID,
        plant_id: Optional[UUID] = None,
    ) -> Optional[ConsignmentStock]:
        conditions = [
            ConsignmentStock.vendor_id == vendor_id,
            ConsignmentStock.supplier_id == supplier_id,
            ConsignmentStock.product_id == product_id,
        ]
        if plant_id:
            conditions.append(ConsignmentStock.plant_id == plant_id)
        result = await self.db.execute(
            select(ConsignmentStock).where(and_(*conditions)).limit(1)
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        supplier_id: Optional[UUID] = None,
        plant_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[ConsignmentStock], int]:
        conditions = [ConsignmentStock.vendor_id == vendor_id]
        if supplier_id:
            conditions.append(ConsignmentStock.supplier_id == supplier_id)
        if plant_id:
            conditions.append(ConsignmentStock.plant_id == plant_id)

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(ConsignmentStock).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(ConsignmentStock)
            .where(and_(*conditions))
            .order_by(ConsignmentStock.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total


class ServiceEntrySheetRepository(BaseRepository[ServiceEntrySheet]):
    def __init__(self, db: AsyncSession):
        super().__init__(ServiceEntrySheet, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, ses_id: UUID
    ) -> Optional[ServiceEntrySheet]:
        result = await self.db.execute(
            select(ServiceEntrySheet).where(
                ServiceEntrySheet.vendor_id == vendor_id,
                ServiceEntrySheet.id == ses_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_entry_number(
        self, vendor_id: UUID, entry_number: str
    ) -> Optional[ServiceEntrySheet]:
        result = await self.db.execute(
            select(ServiceEntrySheet).where(
                ServiceEntrySheet.vendor_id == vendor_id,
                ServiceEntrySheet.entry_number == entry_number,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        status: Optional[str] = None,
        purchase_order_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[ServiceEntrySheet], int]:
        conditions = [ServiceEntrySheet.vendor_id == vendor_id]
        if status:
            conditions.append(ServiceEntrySheet.status == status)
        if purchase_order_id:
            conditions.append(ServiceEntrySheet.purchase_order_id == purchase_order_id)

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(ServiceEntrySheet).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(ServiceEntrySheet)
            .where(and_(*conditions))
            .order_by(ServiceEntrySheet.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total
