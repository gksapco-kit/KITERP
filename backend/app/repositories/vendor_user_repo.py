# app/repositories/vendor_user_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_user import VendorUser
from app.repositories.base import BaseRepository


class VendorUserRepository(BaseRepository[VendorUser]):
    def __init__(self, db: AsyncSession):
        super().__init__(VendorUser, db)

    async def get_by_vendor_and_user(self, vendor_id: UUID, user_id: UUID) -> Optional[VendorUser]:
        """Return one membership row; duplicates must not use scalar_one_or_none() without limit."""
        result = await self.db.execute(
            select(VendorUser)
            .where(and_(VendorUser.vendor_id == vendor_id, VendorUser.user_id == user_id))
            .order_by(VendorUser.created_at.desc())
            .limit(1)
        )
        return result.scalars().first()

    async def list_all_for_vendor_and_user(self, vendor_id: UUID, user_id: UUID) -> List[VendorUser]:
        result = await self.db.execute(
            select(VendorUser)
            .where(and_(VendorUser.vendor_id == vendor_id, VendorUser.user_id == user_id))
            .order_by(VendorUser.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_user_id(self, user_id: UUID) -> Optional[VendorUser]:
        result = await self.db.execute(
            select(VendorUser)
            .where(and_(VendorUser.user_id == user_id, VendorUser.is_active == True))
            .order_by(VendorUser.created_at.asc())
            .limit(1)
        )
        return result.scalars().first()

    async def get_with_details(self, vendor_user_id: UUID) -> Optional[VendorUser]:
        result = await self.db.execute(
            select(VendorUser)
            .options(selectinload(VendorUser.user), selectinload(VendorUser.custom_role))
            .where(VendorUser.id == vendor_user_id)
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self, vendor_id: UUID, skip: int = 0, limit: int = 50, include_inactive: bool = False
    ) -> List[VendorUser]:
        conditions = [VendorUser.vendor_id == vendor_id]
        if not include_inactive:
            conditions.append(VendorUser.is_active == True)
        result = await self.db.execute(
            select(VendorUser)
            .options(selectinload(VendorUser.user), selectinload(VendorUser.custom_role))
            .where(and_(*conditions))
            .order_by(VendorUser.created_at)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_by_vendor(self, vendor_id: UUID, include_inactive: bool = False) -> int:
        conditions = [VendorUser.vendor_id == vendor_id]
        if not include_inactive:
            conditions.append(VendorUser.is_active == True)
        result = await self.db.execute(
            select(func.count()).select_from(VendorUser).where(and_(*conditions))
        )
        return result.scalar_one()

    async def get_user_with_role(self, vendor_id: UUID, user_id: UUID) -> Optional[VendorUser]:
        result = await self.db.execute(
            select(VendorUser)
            .options(selectinload(VendorUser.user), selectinload(VendorUser.custom_role))
            .where(and_(
                VendorUser.vendor_id == vendor_id,
                VendorUser.user_id == user_id,
                VendorUser.is_active == True,
            ))
            .order_by(VendorUser.created_at.desc())
            .limit(1)
        )
        return result.scalars().first()
