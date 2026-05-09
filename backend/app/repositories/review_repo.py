# app/repositories/review_repo.py
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.repositories.base import BaseRepository
from app.models.review import Review


class ReviewRepository(BaseRepository[Review]):
    def __init__(self, db: AsyncSession):
        super().__init__(Review, db)

    async def get_by_id_with_customer(self, review_id: UUID) -> Optional[Review]:
        result = await self.db.execute(
            select(Review)
            .options(selectinload(Review.customer))
            .where(Review.id == review_id)
        )
        return result.scalar_one_or_none()

    async def list_by_product(
        self, product_id: UUID, skip: int = 0, limit: int = 20, visible_only: bool = True
    ) -> Tuple[List[Review], int]:
        query = select(Review).options(
            selectinload(Review.customer)
        ).where(Review.product_id == product_id)
        count_q = select(func.count()).select_from(Review).where(Review.product_id == product_id)

        if visible_only:
            query = query.where(Review.is_visible == True)
            count_q = count_q.where(Review.is_visible == True)

        total = (await self.db.execute(count_q)).scalar_one()
        result = await self.db.execute(
            query.order_by(Review.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all()), total

    async def list_by_service(
        self, service_id: UUID, skip: int = 0, limit: int = 20, visible_only: bool = True
    ) -> Tuple[List[Review], int]:
        query = select(Review).options(
            selectinload(Review.customer)
        ).where(Review.service_id == service_id)
        count_q = select(func.count()).select_from(Review).where(Review.service_id == service_id)

        if visible_only:
            query = query.where(Review.is_visible == True)
            count_q = count_q.where(Review.is_visible == True)

        total = (await self.db.execute(count_q)).scalar_one()
        result = await self.db.execute(
            query.order_by(Review.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all()), total

    async def list_by_vendor(
        self, vendor_id: UUID, skip: int = 0, limit: int = 20,
        review_type: Optional[str] = None,
    ) -> Tuple[List[Review], int]:
        query = select(Review).options(
            selectinload(Review.customer)
        ).where(Review.vendor_id == vendor_id)
        count_q = select(func.count()).select_from(Review).where(Review.vendor_id == vendor_id)

        if review_type:
            query = query.where(Review.review_type == review_type)
            count_q = count_q.where(Review.review_type == review_type)

        total = (await self.db.execute(count_q)).scalar_one()
        result = await self.db.execute(
            query.order_by(Review.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all()), total

    async def customer_already_reviewed(
        self, customer_id: UUID, review_type: str,
        product_id: Optional[UUID] = None, service_id: Optional[UUID] = None,
    ) -> bool:
        query = select(func.count()).select_from(Review).where(
            Review.customer_id == customer_id,
            Review.review_type == review_type,
        )
        if product_id:
            query = query.where(Review.product_id == product_id)
        if service_id:
            query = query.where(Review.service_id == service_id)

        result = (await self.db.execute(query)).scalar_one()
        return result > 0

    async def get_avg_rating(
        self, review_type: str,
        product_id: Optional[UUID] = None, service_id: Optional[UUID] = None,
    ) -> dict:
        query = select(
            func.coalesce(func.avg(Review.rating), 0),
            func.count(),
        ).where(
            Review.review_type == review_type,
            Review.is_visible == True,
        )
        if product_id:
            query = query.where(Review.product_id == product_id)
        if service_id:
            query = query.where(Review.service_id == service_id)

        result = await self.db.execute(query)
        row = result.one()
        return {"avg_rating": round(float(row[0]), 1), "review_count": row[1]}

    async def get_rating_distribution(
        self, review_type: str,
        product_id: Optional[UUID] = None, service_id: Optional[UUID] = None,
    ) -> dict:
        query = select(
            Review.rating, func.count()
        ).where(
            Review.review_type == review_type,
            Review.is_visible == True,
        ).group_by(Review.rating)
        if product_id:
            query = query.where(Review.product_id == product_id)
        if service_id:
            query = query.where(Review.service_id == service_id)

        result = await self.db.execute(query)
        dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for row in result.all():
            dist[row[0]] = row[1]
        return dist
