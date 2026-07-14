# app/repositories/customer_repo.py
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.repositories.base import BaseRepository
from app.models.customer import Customer


def _store_scope_clause(store_id: Optional[UUID]):
    """Match a BU-scoped account, or vendor-wide (NULL) when no BU is active."""
    if store_id is None:
        return Customer.store_id.is_(None)
    return Customer.store_id == store_id


class CustomerRepository(BaseRepository[Customer]):
    def __init__(self, db: AsyncSession):
        super().__init__(Customer, db)

    async def get_by_vendor_and_email(
        self, vendor_id: UUID, email: str, store_id: Optional[UUID] = None
    ) -> Optional[Customer]:
        """Return one customer; prefer rows with a login password over guest checkout stubs."""
        email_norm = (email or "").strip().lower()
        result = await self.db.execute(
            select(Customer)
            .where(
                Customer.vendor_id == vendor_id,
                _store_scope_clause(store_id),
                func.lower(Customer.email) == email_norm,
            )
            .order_by(
                # Non-empty password first so register/login see real accounts over guests.
                (Customer.password_hash == "").asc(),
                Customer.created_at.desc(),
            )
            .limit(1)
        )
        return result.scalars().first()

    async def get_by_vendor_and_phone(
        self, vendor_id: UUID, phone: str, store_id: Optional[UUID] = None
    ) -> Optional[Customer]:
        """Return one customer; prefer passworded accounts; never raise on duplicates."""
        from app.services.sms_service import normalize_e164

        normalized = normalize_e164(phone)
        result = await self.db.execute(
            select(Customer)
            .where(
                Customer.vendor_id == vendor_id,
                _store_scope_clause(store_id),
                Customer.phone == normalized,
            )
            .order_by(
                (Customer.password_hash == "").asc(),
                Customer.created_at.desc(),
            )
            .limit(1)
        )
        found = result.scalars().first()
        if found or normalized == phone:
            return found
        # Fallback for legacy rows stored without E.164 prefix
        result = await self.db.execute(
            select(Customer)
            .where(
                Customer.vendor_id == vendor_id,
                _store_scope_clause(store_id),
                Customer.phone == phone,
            )
            .order_by(
                (Customer.password_hash == "").asc(),
                Customer.created_at.desc(),
            )
            .limit(1)
        )
        return result.scalars().first()

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

    async def get_by_vendor_store_and_id(
        self, vendor_id: UUID, customer_id: UUID, store_id: Optional[UUID]
    ) -> Optional[Customer]:
        result = await self.db.execute(
            select(Customer).where(
                Customer.vendor_id == vendor_id,
                Customer.id == customer_id,
                _store_scope_clause(store_id),
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
