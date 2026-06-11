# app/repositories/user_repo.py
import re
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

    def _phone_digit_key(self, phone: str) -> str:
        return re.sub(r"\D", "", phone or "")

    def _phone_lookup_variants(self, phone: str) -> List[str]:
        from app.services.sms_service import normalize_e164

        raw = (phone or "").strip()
        if not raw:
            return []
        normalized = normalize_e164(raw)
        digits = self._phone_digit_key(normalized or raw)
        variants: List[str] = []
        if normalized:
            variants.append(normalized)
        if digits:
            variants.append(digits)
            variants.append(f"+{digits}")
        # de-dupe while preserving order
        seen: set[str] = set()
        out: List[str] = []
        for v in variants:
            if v and v not in seen:
                seen.add(v)
                out.append(v)
        return out

    async def list_users_by_phone(self, phone: str) -> List[User]:
        if not phone or not str(phone).strip():
            return []
        variants = self._phone_lookup_variants(phone)
        if variants:
            result = await self.db.execute(select(User).where(User.phone.in_(variants)))
            users = list(result.scalars().all())
            if users:
                return users
        digits = self._phone_digit_key(phone)
        if len(digits) < 7:
            return []
        result = await self.db.execute(
            select(User).where(
                User.phone.isnot(None),
                sqlfunc.regexp_replace(User.phone, r"[^0-9]", "", "g") == digits,
            ),
        )
        return list(result.scalars().all())

    async def phone_exists_in_db(self, phone: str) -> bool:
        return len(await self.list_users_by_phone(phone)) > 0

    async def email_exists_in_db(self, email: str) -> bool:
        return len(await self.list_users_by_email_ci(email)) > 0

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

    async def email_blocks_vendor_signup(self, email: str) -> bool:
        """True when email cannot be used for new vendor self-signup."""
        from app.services.user_cleanup import vendor_membership_count

        users = await self.list_users_by_email_ci(email)
        for user in users:
            if user.is_superuser or user.platform_staff_role:
                return True
            if await vendor_membership_count(self.db, user.id) > 0:
                return True
        return False

    async def phone_blocks_vendor_signup(self, phone: str) -> bool:
        from app.services.user_cleanup import vendor_membership_count

        users = await self.list_users_by_phone(phone)
        for user in users:
            if user.is_superuser or user.platform_staff_role:
                return True
            if await vendor_membership_count(self.db, user.id) > 0:
                return True
        return False
