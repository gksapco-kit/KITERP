# app/repositories/vendor_role_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_role import VendorRole
from app.models.vendor_user import VendorUser
from app.repositories.base import BaseRepository


class VendorRoleRepository(BaseRepository[VendorRole]):
    def __init__(self, db: AsyncSession):
        super().__init__(VendorRole, db)

    async def list_by_vendor(self, vendor_id: UUID, include_inactive: bool = False) -> List[VendorRole]:
        conditions = [VendorRole.vendor_id == vendor_id]
        if not include_inactive:
            conditions.append(VendorRole.is_active == True)
        result = await self.db.execute(
            select(VendorRole).where(and_(*conditions)).order_by(VendorRole.is_system.desc(), VendorRole.name)
        )
        return list(result.scalars().all())

    async def get_by_vendor_and_id(self, vendor_id: UUID, role_id: UUID) -> Optional[VendorRole]:
        result = await self.db.execute(
            select(VendorRole).where(
                and_(VendorRole.vendor_id == vendor_id, VendorRole.id == role_id)
            )
        )
        return result.scalar_one_or_none()

    async def get_by_vendor_and_slug(self, vendor_id: UUID, slug: str) -> Optional[VendorRole]:
        result = await self.db.execute(
            select(VendorRole).where(
                and_(VendorRole.vendor_id == vendor_id, VendorRole.slug == slug)
            )
        )
        return result.scalar_one_or_none()

    async def slug_exists(self, vendor_id: UUID, slug: str, exclude_id: Optional[UUID] = None) -> bool:
        conditions = [VendorRole.vendor_id == vendor_id, VendorRole.slug == slug]
        if exclude_id:
            conditions.append(VendorRole.id != exclude_id)
        result = await self.db.execute(
            select(VendorRole.id).where(and_(*conditions)).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def count_assigned_users(self, vendor_id: UUID, role_id: UUID) -> int:
        """Return the number of active vendor users currently assigned to this custom role."""
        result = await self.db.execute(
            select(func.count()).where(
                and_(
                    VendorUser.vendor_id == vendor_id,
                    VendorUser.role_id == role_id,
                    VendorUser.is_active == True,
                )
            )
        )
        return result.scalar_one()
