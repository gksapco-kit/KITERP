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
from app.utils.procurement_utils import next_doc_number


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
                selectinload(PurchaseRequisition.requester).selectinload(VendorUser.user),
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
        return await next_doc_number(self.db, vendor_id, "PR", width=6)

    async def list_pending_for_approver(
        self,
        vendor_id: UUID,
        approver_id: UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[PurchaseRequisition], int]:
        """PRs in submitted status whose current (lowest-level) pending step is assigned to approver_id."""
        min_pending_level = (
            select(
                PurchaseRequisitionApproval.requisition_id,
                sqlfunc.min(PurchaseRequisitionApproval.level).label("min_level"),
            )
            .where(PurchaseRequisitionApproval.status == "pending")
            .group_by(PurchaseRequisitionApproval.requisition_id)
            .subquery()
        )
        base = (
            select(PurchaseRequisition)
            .join(
                PurchaseRequisitionApproval,
                PurchaseRequisitionApproval.requisition_id == PurchaseRequisition.id,
            )
            .join(
                min_pending_level,
                and_(
                    min_pending_level.c.requisition_id == PurchaseRequisition.id,
                    PurchaseRequisitionApproval.level == min_pending_level.c.min_level,
                ),
            )
            .where(
                PurchaseRequisition.vendor_id == vendor_id,
                PurchaseRequisition.status == "submitted",
                PurchaseRequisitionApproval.approver_id == approver_id,
                PurchaseRequisitionApproval.status == "pending",
            )
        )
        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            base.options(selectinload(PurchaseRequisition.items))
            .order_by(PurchaseRequisition.submitted_at.desc().nullslast(), PurchaseRequisition.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().unique().all()), total
