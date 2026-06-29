# app/repositories/business_partner_repo.py
from typing import Optional, List, Tuple
from uuid import UUID
import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func as sqlfunc, or_

from app.models.business_partner import BusinessPartner, BusinessPartnerRole


def _norm_name(v: str | None) -> str:
    return (v or "").strip().lower()


def _norm_phone(v: str | None) -> str:
    return re.sub(r"\D", "", v or "")


class BusinessPartnerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Reads ─────────────────────────────────────────────────────

    async def get(self, vendor_id: UUID, bp_id: UUID) -> Optional[BusinessPartner]:
        result = await self.db.execute(
            select(BusinessPartner).where(
                BusinessPartner.vendor_id == vendor_id,
                BusinessPartner.id == bp_id,
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        vendor_id: UUID,
        search: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[BusinessPartner], int]:
        conditions = [BusinessPartner.vendor_id == vendor_id]

        if is_active is not None:
            conditions.append(BusinessPartner.is_active == is_active)

        if search:
            q = f"%{search.lower()}%"
            conditions.append(or_(
                BusinessPartner.name.ilike(q),
                BusinessPartner.email.ilike(q),
                BusinessPartner.phone.ilike(q),
                BusinessPartner.gstin.ilike(q),
                BusinessPartner.contact_name.ilike(q),
            ))

        base_q = select(BusinessPartner).where(and_(*conditions))

        if role:
            # filter BPs that have this role
            base_q = base_q.join(
                BusinessPartnerRole,
                and_(
                    BusinessPartnerRole.business_partner_id == BusinessPartner.id,
                    BusinessPartnerRole.role == role,
                    BusinessPartnerRole.is_active == True,
                ),
            )

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(base_q.subquery())
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            base_q.order_by(BusinessPartner.name).offset(skip).limit(limit)
        )
        return list(result.scalars().all()), total

    async def find_duplicate(
        self,
        vendor_id: UUID,
        name: str,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        gstin: Optional[str] = None,
        exclude_id: Optional[UUID] = None,
    ) -> Optional[BusinessPartner]:
        """Return first existing BP that matches name, phone, email, or GSTIN."""
        stmt = select(BusinessPartner).where(BusinessPartner.vendor_id == vendor_id)
        if exclude_id:
            stmt = stmt.where(BusinessPartner.id != exclude_id)
        result = await self.db.execute(stmt)
        candidates = list(result.scalars().all())

        norm_name = _norm_name(name)
        norm_phone = _norm_phone(phone)
        norm_email = (email or "").strip().lower()
        norm_gstin = (gstin or "").strip().upper()

        for bp in candidates:
            if norm_name and _norm_name(bp.name) == norm_name:
                return bp
            if norm_phone and _norm_phone(bp.phone) == norm_phone:
                return bp
            if norm_email and (bp.email or "").strip().lower() == norm_email:
                return bp
            if norm_gstin and (bp.gstin or "").strip().upper() == norm_gstin:
                return bp
        return None

    # ── Writes ────────────────────────────────────────────────────

    async def create(self, bp: BusinessPartner) -> BusinessPartner:
        self.db.add(bp)
        await self.db.flush()   # get id without committing
        return bp

    async def get_role(
        self, vendor_id: UUID, bp_id: UUID, role: str
    ) -> Optional[BusinessPartnerRole]:
        result = await self.db.execute(
            select(BusinessPartnerRole).where(
                BusinessPartnerRole.vendor_id == vendor_id,
                BusinessPartnerRole.business_partner_id == bp_id,
                BusinessPartnerRole.role == role,
            )
        )
        return result.scalar_one_or_none()

    async def add_role(self, role_row: BusinessPartnerRole) -> BusinessPartnerRole:
        self.db.add(role_row)
        await self.db.flush()
        return role_row

    async def remove_role(self, vendor_id: UUID, bp_id: UUID, role: str) -> bool:
        row = await self.get_role(vendor_id, bp_id, role)
        if not row:
            return False
        await self.db.delete(row)
        return True
