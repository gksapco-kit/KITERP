# app/utils/platform_staff.py
"""Platform (admin app) access: superusers and optional support staff."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

PLATFORM_SUPPORT_ROLE = "support"


def has_platform_staff_access(user: User) -> bool:
    """True if the user may sign in at the platform admin app (port 3000)."""
    if getattr(user, "is_superuser", False):
        return True
    return getattr(user, "platform_staff_role", None) == PLATFORM_SUPPORT_ROLE


def is_support_only_staff(user: User) -> bool:
    """Support role without full superuser privileges."""
    return (not getattr(user, "is_superuser", False)) and (
        getattr(user, "platform_staff_role", None) == PLATFORM_SUPPORT_ROLE
    )
