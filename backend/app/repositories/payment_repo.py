# app/repositories/payment_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.repositories.base import BaseRepository
from app.models.payment import Payment


class PaymentRepository(BaseRepository[Payment]):
    def __init__(self, db: AsyncSession):
        super().__init__(Payment, db)

    async def get_by_order(self, order_id: UUID) -> List[Payment]:
        result = await self.db.execute(
            select(Payment)
            .where(Payment.order_id == order_id)
            .order_by(Payment.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_reference(self, reference: str) -> Optional[Payment]:
        result = await self.db.execute(
            select(Payment).where(Payment.gateway_reference == reference)
        )
        return result.scalar_one_or_none()
