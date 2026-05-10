from __future__ import annotations

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.vendor_platform_audit import VendorPlatformAuditLog


class VendorPlatformAuditRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def count_for_vendor(self, vendor_id: UUID) -> int:
        q = select(func.count()).select_from(VendorPlatformAuditLog).where(
            VendorPlatformAuditLog.vendor_id == vendor_id
        )
        r = await self.db.execute(q)
        return int(r.scalar_one() or 0)

    async def list_for_vendor(
        self,
        vendor_id: UUID,
        *,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Tuple[VendorPlatformAuditLog, Optional[str]]]:
        q: Select = (
            select(VendorPlatformAuditLog, User.email)
            .outerjoin(User, User.id == VendorPlatformAuditLog.actor_user_id)
            .where(VendorPlatformAuditLog.vendor_id == vendor_id)
            .order_by(VendorPlatformAuditLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(q)
        return [(row[0], row[1]) for row in result.all()]
