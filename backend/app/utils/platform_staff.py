# app/utils/platform_staff.py
"""Platform (admin app) access: superusers and optional support staff."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.user import User

PLATFORM_SUPPORT_ROLE = "support"

PLATFORM_JOB_ROLE_SALES = "sales"
PLATFORM_JOB_ROLE_CRM = "crm"
PLATFORM_JOB_ROLE_CONSULTING = "consulting"
PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER = "relationship_manager"
PLATFORM_JOB_ROLE_TEAM_MANAGER = "team_manager"

PLATFORM_JOB_ROLES: frozenset[str] = frozenset(
    {
        PLATFORM_JOB_ROLE_SALES,
        PLATFORM_JOB_ROLE_CRM,
        PLATFORM_JOB_ROLE_CONSULTING,
        PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER,
        PLATFORM_JOB_ROLE_TEAM_MANAGER,
    }
)


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


async def resolve_platform_job_role_permissions(
    db: AsyncSession, job_role: Optional[str]
) -> list[str]:
    """Return permission keys for a built-in or custom job role slug."""
    if not job_role:
        return []
    from app.models.platform_job_role import BUILTIN_PLATFORM_JOB_ROLE_DEFS, PlatformJobRole

    builtin = BUILTIN_PLATFORM_JOB_ROLE_DEFS.get(job_role)
    if builtin:
        return list(builtin["permissions"])

    result = await db.execute(
        select(PlatformJobRole).where(
            PlatformJobRole.slug == job_role,
            PlatformJobRole.is_active.is_(True),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return []
    return list(row.permissions or [])


async def is_valid_platform_job_role(db: AsyncSession, job_role: str) -> bool:
    if job_role in PLATFORM_JOB_ROLES:
        return True
    from app.models.platform_job_role import PlatformJobRole

    result = await db.execute(
        select(PlatformJobRole.id).where(
            PlatformJobRole.slug == job_role,
            PlatformJobRole.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none() is not None


async def job_role_has_permission(
    db: AsyncSession, job_role: Optional[str], permission: str
) -> bool:
    perms = await resolve_platform_job_role_permissions(db, job_role)
    return permission in perms


async def is_team_manager_job_role(db: AsyncSession, job_role: Optional[str]) -> bool:
    if job_role == PLATFORM_JOB_ROLE_TEAM_MANAGER:
        return True
    return await job_role_has_permission(db, job_role, "staff.can_manage_team")


async def is_relationship_manager_job_role(db: AsyncSession, job_role: Optional[str]) -> bool:
    if job_role == PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER:
        return True
    return await job_role_has_permission(db, job_role, "vendors.scope_assigned")


async def list_assignable_job_roles(db: AsyncSession) -> list[dict]:
    """Built-in + active custom roles for dropdowns."""
    from app.models.platform_job_role import BUILTIN_PLATFORM_JOB_ROLE_DEFS, PlatformJobRole

    items: list[dict] = []
    for slug, meta in BUILTIN_PLATFORM_JOB_ROLE_DEFS.items():
        items.append(
            {
                "slug": slug,
                "name": meta["name"],
                "description": meta.get("description"),
                "permissions": list(meta["permissions"]),
                "is_builtin": True,
                "is_active": True,
                "id": None,
            }
        )
    result = await db.execute(
        select(PlatformJobRole).where(PlatformJobRole.is_active.is_(True)).order_by(PlatformJobRole.name)
    )
    for row in result.scalars().all():
        items.append(
            {
                "slug": row.slug,
                "name": row.name,
                "description": row.description,
                "permissions": list(row.permissions or []),
                "is_builtin": False,
                "is_active": bool(row.is_active),
                "id": str(row.id),
            }
        )
    return items


async def count_users_by_job_roles(db: AsyncSession, slugs: Sequence[str]) -> dict[str, int]:
    if not slugs:
        return {}
    from app.models.user import User

    result = await db.execute(
        select(User.platform_staff_job_role, func.count())
        .where(
            User.platform_staff_role == PLATFORM_SUPPORT_ROLE,
            User.platform_staff_job_role.in_(list(slugs)),
        )
        .group_by(User.platform_staff_job_role)
    )
    return {slug: int(n) for slug, n in result.all() if slug}
