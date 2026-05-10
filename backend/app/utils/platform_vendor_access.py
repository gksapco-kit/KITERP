# app/utils/platform_vendor_access.py
"""Rules for which vendors a platform staff user may access from the admin app."""
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.models.user import User
from app.models.vendor import Vendor
from app.utils.platform_staff import PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER


def relationship_manager_list_scope(current_user: User) -> Optional[UUID]:
    """Non-superuser relationship managers only see vendors assigned to them."""
    if current_user.is_superuser:
        return None
    if getattr(current_user, "platform_staff_job_role", None) == PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER:
        return current_user.id
    return None


async def ensure_vendor_visible_to_platform_staff(current_user: User, vendor: Vendor) -> None:
    scope = relationship_manager_list_scope(current_user)
    if scope is None:
        return
    if vendor.relationship_manager_user_id != scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned relationship manager for this vendor",
        )
