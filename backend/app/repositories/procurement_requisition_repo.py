# app/repositories/procurement_requisition_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func as sqlfunc
from sqlalchemy.orm import selectinload

from app.repositories.base import BaseRepository
from app.models.procurement_requisition import (
    PurchaseRequisition,
    PurchaseRequisitionItem,
    PurchaseRequisitionApproval,
)
from app.models.vendor_user import VendorUser


class PurchaseRequisitionRepository(BaseRepository[PurchaseRequisition]):
    def __init__(self, db: AsyncSession):
        super().__init__(PurchaseRequisition, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, pr_id: UUID
    ) -> Optional[PurchaseRequisition]:
        result = await self.db.execute(
            select(PurchaseRequisition)
            .options(
                selectinload(PurchaseRequisition.items),
                selectinload(PurchaseRequisition.approvals)
                .selectinload(PurchaseRequisitionApproval.approver)
                .selectinload(VendorUser.user),
            )
            .where(
                PurchaseRequisition.vendor_id == vendor_id,
                PurchaseRequisition.id == pr_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_pr_number(
        self, vendor_id: UUID, pr_number: str
    ) -> Optional[PurchaseRequisition]:
        result = await self.db.execute(
            select(PurchaseRequisition).where(
                PurchaseRequisition.vendor_id == vendor_id,
                PurchaseRequisition.pr_number == pr_number,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[PurchaseRequisition], int]:
        conditions = [PurchaseRequisition.vendor_id == vendor_id]
        if status:
            conditions.append(PurchaseRequisition.status == status)

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(PurchaseRequisition).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(PurchaseRequisition)
            .options(selectinload(PurchaseRequisition.items))
            .where(and_(*conditions))
            .order_by(PurchaseRequisition.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_next_pr_number(self, vendor_id: UUID) -> str:
        result = await self.db.execute(
            select(sqlfunc.count())
            .select_from(PurchaseRequisition)
            .where(PurchaseRequisition.vendor_id == vendor_id)
        )
        count = result.scalar_one()
        return f"PR-{str(count + 1).zfill(6)}"

    async def get_pending_approval_for_approver(
        self, vendor_id: UUID, approver_id: UUID
    ) -> List[PurchaseRequisition]:
        from sqlalchemy import join
        result = await self.db.execute(
            select(PurchaseRequisition)
            .join(
                PurchaseRequisitionApproval,
                PurchaseRequisitionApproval.requisition_id == PurchaseRequisition.id,
            )
            .where(
                PurchaseRequisition.vendor_id == vendor_id,
                PurchaseRequisitionApproval.approver_id == approver_id,
                PurchaseRequisitionApproval.status == "pending",
            )
            .order_by(PurchaseRequisition.created_at.desc())
        )
        return list(result.scalars().all())
