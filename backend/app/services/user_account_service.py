"""Self-service account deletion for vendor portal users."""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.models.order import Order
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.repositories.vendor_repo import VendorRepository
from app.services.user_cleanup import delete_user_if_orphan, purge_user_dependents


class UserAccountService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.vendor_repo = VendorRepository(db)

    async def _delete_owned_vendor(self, vendor_id: UUID, actor_id: UUID) -> None:
        vendor = await self.vendor_repo.get_by_id(vendor_id)
        if not vendor:
            return

        try:
            await self.db.delete(vendor)
            await self.db.flush()
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "One of your business accounts still has linked records and cannot be removed. "
                    "Contact support to close it before deleting your login."
                ),
            ) from exc

    async def assert_can_delete(self, user: User) -> None:
        if user.is_superuser or user.platform_staff_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Platform administrator accounts cannot be deleted from this screen.",
            )

        user_id = user.id
        memberships = (
            await self.db.scalars(
                select(VendorUser).where(VendorUser.user_id == user_id),
            )
        ).all()

        owner_vendor_ids = {vu.vendor_id for vu in memberships if vu.role == "owner"}

        for vendor_id in owner_vendor_ids:
            order_count = await self.db.scalar(
                select(func.count()).select_from(Order).where(Order.vendor_id == vendor_id),
            )
            if order_count and order_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "You own a business with customer orders. Contact your relationship manager "
                        "or platform support to close the business account before deleting your login."
                    ),
                )

    async def validate_delete_password(self, user: User, password: str) -> None:
        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is incorrect",
            )
        await self.assert_can_delete(user)

    async def delete_my_account(self, user: User, password: str) -> None:
        await self.validate_delete_password(user, password)
        await self._perform_delete(user)

    async def delete_my_account_confirmed(self, user: User) -> None:
        await self.assert_can_delete(user)
        await self._perform_delete(user)

    async def _perform_delete(self, user: User) -> None:
        user_id = user.id
        memberships = (
            await self.db.scalars(
                select(VendorUser).where(VendorUser.user_id == user_id),
            )
        ).all()

        owner_vendor_ids = {vu.vendor_id for vu in memberships if vu.role == "owner"}

        for vendor_id in owner_vendor_ids:
            await self._delete_owned_vendor(vendor_id, user_id)

        remaining = (
            await self.db.scalars(
                select(VendorUser).where(VendorUser.user_id == user_id),
            )
        ).all()
        for vu in remaining:
            await self.db.delete(vu)
        await self.db.flush()

        user = await self.db.get(User, user_id)
        if not user:
            await self.db.commit()
            return

        try:
            deleted = await delete_user_if_orphan(self.db, user, force=True)
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Your account could not be deleted because it is still linked to business data. "
                    "Contact support for help."
                ),
            ) from exc

        if not deleted:
            await purge_user_dependents(self.db, user_id)
            await self.db.delete(user)
            await self.db.flush()

        await self.db.commit()
