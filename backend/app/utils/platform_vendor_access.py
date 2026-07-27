# app/utils/platform_vendor_access.py
"""Rules for which vendors a platform staff user may access from the admin app."""
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.vendor import Vendor
from app.utils.platform_staff import is_relationship_manager_job_role


def relationship_manager_list_scope(current_user: User) -> Optional[UUID]:
    """Non-superuser relationship managers only see vendors assigned to them.

    Prefer ``relationship_manager_list_scope_async`` when a DB session is available
    so custom roles with ``vendors.scope_assigned`` are respected.
    """
    if current_user.is_superuser:
        return None
    from app.utils.platform_staff import PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER

    if getattr(current_user, "platform_staff_job_role", None) == PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER:
        return current_user.id
    return None


async def relationship_manager_list_scope_async(
    db: AsyncSession, current_user: User
) -> Optional[UUID]:
    """Like ``relationship_manager_list_scope`` but includes custom RM-scoped roles."""
    if current_user.is_superuser:
        return None
    job = getattr(current_user, "platform_staff_job_role", None)
    if await is_relationship_manager_job_role(db, job):
        return current_user.id
    return None


async def ensure_vendor_visible_to_platform_staff(
    current_user: User,
    vendor: Vendor,
    db: Optional[AsyncSession] = None,
) -> None:
    from app.services.platform_crm_tenant import is_platform_crm_vendor

    # Internal Kiterp tenant (platform CRM / HR) is visible to all platform staff.
    if is_platform_crm_vendor(vendor):
        return

    if db is not None:
        scope = await relationship_manager_list_scope_async(db, current_user)
    else:
        scope = relationship_manager_list_scope(current_user)
    if scope is None:
        return
    if vendor.relationship_manager_user_id != scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned relationship manager for this vendor",
        )
