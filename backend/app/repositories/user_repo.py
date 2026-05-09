# app/repositories/user_repo.py
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.vendor_user import VendorUser
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: AsyncSession):
        super().__init__(User, db)

    async def list_users_by_email_ci(self, email: str) -> List[User]:
        if not email or not str(email).strip():
            return []
        norm = str(email).strip().lower()
        result = await self.db.execute(select(User).where(sqlfunc.lower(User.email) == norm))
        return list(result.scalars().all())

    async def list_users_by_phone(self, phone: str) -> List[User]:
        if not phone:
            return []
        result = await self.db.execute(select(User).where(User.phone == phone))
        return list(result.scalars().all())

    async def get_user_with_email_for_vendor(self, vendor_id: UUID, email: str) -> Optional[User]:
        """A user who already has a vendor_user row on this vendor with this email (case-insensitive)."""
        if not email or not str(email).strip():
            return None
        norm = str(email).strip().lower()
        q = (
            select(User)
            .join(VendorUser, VendorUser.user_id == User.id)
            .where(VendorUser.vendor_id == vendor_id, sqlfunc.lower(User.email) == norm)
        )
        r = await self.db.execute(q)
        return r.scalar_one_or_none()

    async def list_users_by_email_ci_for_vendor(self, vendor_id: UUID, email: str) -> List[User]:
        """Users with active membership on vendor matching email (CI)."""
        if not email or not str(email).strip():
            return []
        norm = str(email).strip().lower()
        q = (
            select(User)
            .join(VendorUser, VendorUser.user_id == User.id)
            .where(
                VendorUser.vendor_id == vendor_id,
                VendorUser.is_active.is_(True),
                sqlfunc.lower(User.email) == norm,
            )
        )
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def list_users_by_phone_for_vendor(self, vendor_id: UUID, phone: str) -> List[User]:
        """Users with active membership on vendor matching phone."""
        if not phone:
            return []
        q = (
            select(User)
            .join(VendorUser, VendorUser.user_id == User.id)
            .where(
                VendorUser.vendor_id == vendor_id,
                VendorUser.is_active.is_(True),
                User.phone == phone,
            )
        )
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def get_by_email(self, email: str) -> Optional[User]:
        """First user matching email (CI). Ambiguous when duplicates exist — prefer vendor-scoped helpers."""
        users = await self.list_users_by_email_ci(email)
        return users[0] if users else None

    async def get_by_phone(self, phone: str) -> Optional[User]:
        users = await self.list_users_by_phone(phone)
        return users[0] if users else None

    async def email_exists(self, email: str) -> bool:
        users = await self.list_users_by_email_ci(email)
        return len(users) > 0

    async def phone_exists(self, phone: str) -> bool:
        users = await self.list_users_by_phone(phone)
        return len(users) > 0
