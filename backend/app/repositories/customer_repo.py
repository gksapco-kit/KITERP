# app/repositories/customer_repo.py
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.repositories.base import BaseRepository
from app.models.customer import Customer


class CustomerRepository(BaseRepository[Customer]):
    def __init__(self, db: AsyncSession):
        super().__init__(Customer, db)

    async def get_by_vendor_and_email(
        self, vendor_id: UUID, email: str
    ) -> Optional[Customer]:
        result = await self.db.execute(
            select(Customer).where(
                Customer.vendor_id == vendor_id,
                Customer.email == email,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_vendor_and_phone(
        self, vendor_id: UUID, phone: str
    ) -> Optional[Customer]:
        result = await self.db.execute(
            select(Customer).where(
                Customer.vendor_id == vendor_id,
                Customer.phone == phone,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, customer_id: UUID
    ) -> Optional[Customer]:
        result = await self.db.execute(
            select(Customer).where(
                Customer.vendor_id == vendor_id,
                Customer.id == customer_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
    ) -> Tuple[List[Customer], int]:
        query = select(Customer).where(Customer.vendor_id == vendor_id)
        count_query = select(func.count()).select_from(Customer).where(
            Customer.vendor_id == vendor_id
        )

        if search:
            search_filter = or_(
                Customer.full_name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        total = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(
            query.order_by(Customer.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all()), total
