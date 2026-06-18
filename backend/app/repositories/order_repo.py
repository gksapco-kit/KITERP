# app/repositories/order_repo.py
import re
from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, text
from sqlalchemy.orm import selectinload, aliased

from app.repositories.base import BaseRepository
from app.models.order import Order
from app.models.customer import Customer


class OrderRepository(BaseRepository[Order]):
    def __init__(self, db: AsyncSession):
        super().__init__(Order, db)

    async def get_next_order_number(self, vendor_id: UUID) -> str:
        # Acquire a transaction-scoped advisory lock keyed on this vendor so that
        # concurrent checkouts cannot read the same MAX and generate duplicate numbers.
        # The lock is automatically released when the surrounding transaction commits
        # or rolls back — no manual release needed.
        #
        # IMPORTANT: Do not use MAX(order_number) as text — the table also holds
        # non-ORD numbers (e.g. SF-*, POS-PRD-*). Lexicographic max + split("-")[-1]
        # can pick the wrong row and reuse an existing ORD-xxxxx (uq_order_vendor_number).
        bind = self.db.get_bind()
        if bind.dialect.name == "postgresql":
            await self.db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(CAST(:vid AS TEXT)))"),
                {"vid": str(vendor_id)},
            )
            result = await self.db.execute(
                text("""
                    SELECT COALESCE(MAX(
                        SUBSTRING(o.order_number FROM '^ORD-([0-9]+)$')::INTEGER
                    ), 0)
                    FROM "order" o
                    WHERE o.vendor_id = CAST(:vid AS uuid)
                      AND o.order_number ~ '^ORD-[0-9]+$'
                """),
                {"vid": str(vendor_id)},
            )
            last_seq = int(result.scalar_one() or 0)
            return f"ORD-{last_seq + 1:05d}"

        # SQLite (e.g. unit tests): no PG advisory lock / regex operators.
        result = await self.db.execute(
            select(Order.order_number).where(
                Order.vendor_id == vendor_id,
                Order.order_number.like("ORD-%"),
            )
        )
        best = 0
        for label in result.scalars().all():
            m = re.fullmatch(r"ORD-(\d+)", label or "")
            if m:
                best = max(best, int(m.group(1)))
        return f"ORD-{best + 1:05d}"

    async def get_by_order_number(self, order_number: str) -> Optional[Order]:
        result = await self.db.execute(
            select(Order).where(Order.order_number == order_number)
        )
        return result.scalar_one_or_none()

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, order_id: UUID
    ) -> Optional[Order]:
        result = await self.db.execute(
            select(Order)
            .options(selectinload(Order.customer), selectinload(Order.payments))
            .where(
                Order.vendor_id == vendor_id,
                Order.id == order_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        search: Optional[str] = None,
        source: Optional[str] = None,
        store_id: Optional[UUID] = None,
    ) -> Tuple[List[Order], int]:
        cust = aliased(Customer)
        query = (
            select(Order)
            .options(selectinload(Order.customer))
            .outerjoin(cust, Order.customer_id == cust.id)
            .where(Order.vendor_id == vendor_id)
        )
        count_query = (
            select(func.count())
            .select_from(Order)
            .outerjoin(cust, Order.customer_id == cust.id)
            .where(Order.vendor_id == vendor_id)
        )

        if status:
            query = query.where(Order.status == status)
            count_query = count_query.where(Order.status == status)

        if source:
            query = query.where(Order.source == source)
            count_query = count_query.where(Order.source == source)

        if store_id:
            query = query.where(Order.store_id == store_id)
            count_query = count_query.where(Order.store_id == store_id)

        if search:
            like = f"%{search}%"
            search_filter = or_(
                Order.order_number.ilike(like),
                cust.full_name.ilike(like),
                cust.email.ilike(like),
                cust.phone.ilike(like),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        total = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(
            query.order_by(Order.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all()), total

    async def list_by_customer(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Order], int]:
        query = select(Order).where(
            Order.vendor_id == vendor_id,
            Order.customer_id == customer_id,
        )
        count_query = select(func.count()).select_from(Order).where(
            Order.vendor_id == vendor_id,
            Order.customer_id == customer_id,
        )

        total = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(
            query.order_by(Order.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_vendor_stats(self, vendor_id: UUID) -> dict:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # Total orders
        total = (await self.db.execute(
            select(func.count()).select_from(Order).where(Order.vendor_id == vendor_id)
        )).scalar_one()

        # Pending orders
        pending = (await self.db.execute(
            select(func.count()).select_from(Order).where(
                Order.vendor_id == vendor_id,
                Order.status.in_(["pending", "confirmed", "processing"]),
            )
        )).scalar_one()

        # Completed orders
        completed = (await self.db.execute(
            select(func.count()).select_from(Order).where(
                Order.vendor_id == vendor_id,
                Order.status == "delivered",
            )
        )).scalar_one()

        # Total revenue
        revenue_result = (await self.db.execute(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.vendor_id == vendor_id,
                Order.payment_status == "paid",
            )
        )).scalar_one()

        # Today orders
        today_orders = (await self.db.execute(
            select(func.count()).select_from(Order).where(
                Order.vendor_id == vendor_id,
                Order.created_at >= today_start,
            )
        )).scalar_one()

        # Today revenue
        today_revenue = (await self.db.execute(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.vendor_id == vendor_id,
                Order.payment_status == "paid",
                Order.created_at >= today_start,
            )
        )).scalar_one()

        return {
            "total_orders": total,
            "pending_orders": pending,
            "completed_orders": completed,
            "total_revenue": float(revenue_result),
            "today_orders": today_orders,
            "today_revenue": float(today_revenue),
        }
