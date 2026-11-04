"""Access control shared by every Production / MRP route.

- ``production_view``   : read access (``production.view``) + module enabled.
- ``production_manage`` : write access (``production.manage``) + module enabled.

The module-enabled flag mirrors the frontend rule (``flagEnabled`` in
``vendorModuleSettings.ts``): the module is on unless ``settings.production_enabled``
is explicitly ``false``. Enforcing it here means disabling the module in settings
also blocks direct API calls, not just the sidebar entry.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_vendor_id, require_permission
from app.database import get_db
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser

MODULE_FLAG = "production_enabled"


async def ensure_production_enabled(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    settings = (
        await db.execute(select(Vendor.settings).where(Vendor.id == vendor_id))
    ).scalar_one_or_none()
    if isinstance(settings, dict) and settings.get(MODULE_FLAG) is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The Production module is disabled for this account.",
        )


_view_perm = require_permission("production.view")
_manage_perm = require_permission("production.view", "production.manage")


async def production_view(
    _enabled: None = Depends(ensure_production_enabled),
    vu: VendorUser = Depends(_view_perm),
) -> VendorUser:
    return vu


async def production_manage(
    _enabled: None = Depends(ensure_production_enabled),
    vu: VendorUser = Depends(_manage_perm),
) -> VendorUser:
    return vu
