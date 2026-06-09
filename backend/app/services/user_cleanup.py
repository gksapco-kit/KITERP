"""Remove user rows and dependent rows so signup email/phone can be reused."""
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User
from app.models.vendor import VendorOwner
from app.models.vendor_user import VendorUser


async def vendor_membership_count(db: AsyncSession, user_id: UUID) -> int:
    return int(
        await db.scalar(
            select(func.count()).select_from(VendorUser).where(VendorUser.user_id == user_id),
        )
        or 0,
    )


async def purge_user_dependents(db: AsyncSession, user_id: UUID) -> None:
    """Delete rows that commonly block ``user`` deletion for test / signup accounts."""
    await db.execute(delete(Notification).where(Notification.user_id == user_id))
    await db.execute(delete(VendorOwner).where(VendorOwner.user_id == user_id))
    await db.execute(delete(VendorUser).where(VendorUser.user_id == user_id))


async def delete_user_if_orphan(
    db: AsyncSession,
    user: User,
    *,
    force: bool = False,
) -> bool:
    """
    Delete a non-platform user when they have no vendor memberships.
    ``force`` skips the membership check (caller already removed vendors).
    """
    if user.is_superuser or user.platform_staff_role:
        return False
    if not force and await vendor_membership_count(db, user.id) > 0:
        return False
    await purge_user_dependents(db, user.id)
    await db.delete(user)
    await db.flush()
    return True


async def remove_orphan_users_by_email(db: AsyncSession, email: str) -> int:
    """Delete orphan signup users (no vendor membership) matching email (CI)."""
    from app.repositories.user_repo import UserRepository

    repo = UserRepository(db)
    removed = 0
    for user in await repo.list_users_by_email_ci(email):
        if await delete_user_if_orphan(db, user):
            removed += 1
    return removed


async def remove_orphan_users_by_phone(db: AsyncSession, phone: str) -> int:
    from app.repositories.user_repo import UserRepository

    repo = UserRepository(db)
    removed = 0
    for user in await repo.list_users_by_phone(phone):
        if await delete_user_if_orphan(db, user):
            removed += 1
    return removed
