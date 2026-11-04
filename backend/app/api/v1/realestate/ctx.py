"""FastAPI dependencies that resolve tenant, acting user and permissions for real-estate routes."""
from functools import lru_cache

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_vendor_user, get_effective_permissions, require_permission
from app.database import get_db
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.services.realestate.common import Ctx


@lru_cache(maxsize=None)
def ctx_dep(perm: str):
    """Dependency factory: require ``perm`` (e.g. ``realestate.sales``) and return a :class:`Ctx`."""

    async def _dep(
        vendor_user: VendorUser = Depends(require_permission(perm)),
        user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ) -> Ctx:
        return Ctx(
            db=db,
            vendor_id=vendor_user.vendor_id,
            user_id=user.id,
            actor_name=(getattr(user, "full_name", None) or getattr(user, "email", "") or "user"),
            permissions=frozenset(get_effective_permissions(vendor_user)),
            role=str(vendor_user.role or ""),
        )

    return _dep


async def _any_ctx(
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Ctx:
    return Ctx(
        db=db,
        vendor_id=vendor_user.vendor_id,
        user_id=user.id,
        actor_name=(getattr(user, "full_name", None) or getattr(user, "email", "") or "user"),
        permissions=frozenset(get_effective_permissions(vendor_user)),
        role=str(vendor_user.role or ""),
    )


def view_ctx():
    return Depends(ctx_dep("realestate.view"))


def perm_ctx(perm: str):
    return Depends(ctx_dep(perm))


def any_ctx():
    return Depends(_any_ctx)
