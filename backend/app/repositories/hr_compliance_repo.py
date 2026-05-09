"""Compliance repositories — policies, certifications, audit log."""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from app.models.hr_compliance import (
    Policy, PolicyAcknowledgement, ComplianceCertification, ComplianceAuditLog,
)


class PolicyRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, status: Optional[str] = None) -> List[Policy]:
        q = select(Policy).where(Policy.vendor_id == vendor_id)
        if status:
            q = q.where(Policy.status == status)
        q = q.order_by(Policy.updated_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, pid: UUID, vendor_id: UUID) -> Optional[Policy]:
        r = await self.db.execute(
            select(Policy).where(Policy.id == pid, Policy.vendor_id == vendor_id)
            .options(selectinload(Policy.acknowledgements))
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> Policy:
        p = Policy(vendor_id=vendor_id, **data)
        self.db.add(p)
        await self.db.flush()
        await self.db.refresh(p)
        return p

    async def update(self, p: Policy, data: dict, bump_version: bool = False) -> Policy:
        for k, v in data.items():
            setattr(p, k, v)
        if bump_version:
            p.version = (p.version or 1) + 1
        await self.db.flush()
        await self.db.refresh(p)
        return p

    async def delete(self, p: Policy) -> None:
        await self.db.delete(p)
        await self.db.flush()

    async def acknowledge(self, policy_id: UUID, employee_id: UUID, version: int,
                           ip: Optional[str] = None, notes: Optional[str] = None) -> PolicyAcknowledgement:
        # idempotent: if already acked at same version, return existing
        existing = await self.db.execute(
            select(PolicyAcknowledgement).where(
                PolicyAcknowledgement.policy_id == policy_id,
                PolicyAcknowledgement.employee_id == employee_id,
                PolicyAcknowledgement.policy_version == version,
            )
        )
        ack = existing.scalar_one_or_none()
        if ack:
            return ack
        ack = PolicyAcknowledgement(
            policy_id=policy_id, employee_id=employee_id,
            policy_version=version, ip_address=ip, notes=notes,
        )
        self.db.add(ack)
        await self.db.flush()
        await self.db.refresh(ack)
        return ack

    async def my_pending(self, vendor_id: UUID, employee_id: UUID) -> List[Policy]:
        # Published policies requiring acknowledgement that this employee has not acknowledged at current version
        published = await self.db.execute(
            select(Policy).where(
                Policy.vendor_id == vendor_id,
                Policy.status == "published",
                Policy.requires_acknowledgement.is_(True),
            )
        )
        items = list(published.scalars().all())
        if not items:
            return []
        ids = [p.id for p in items]
        acked = await self.db.execute(
            select(PolicyAcknowledgement.policy_id, PolicyAcknowledgement.policy_version).where(
                PolicyAcknowledgement.employee_id == employee_id,
                PolicyAcknowledgement.policy_id.in_(ids),
            )
        )
        acked_set = {(pid, ver) for pid, ver in acked.all()}
        return [p for p in items if (p.id, p.version) not in acked_set]


class CertificationRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, employee_id: Optional[UUID] = None,
                   expiring_within_days: Optional[int] = None) -> List[ComplianceCertification]:
        q = select(ComplianceCertification).where(ComplianceCertification.vendor_id == vendor_id)
        if employee_id:
            q = q.where(ComplianceCertification.employee_id == employee_id)
        if expiring_within_days is not None:
            cutoff = date.today() + timedelta(days=expiring_within_days)
            q = q.where(
                ComplianceCertification.expires_on.isnot(None),
                ComplianceCertification.expires_on <= cutoff,
            )
        q = q.order_by(ComplianceCertification.expires_on.asc().nulls_last())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, cid: UUID, vendor_id: UUID) -> Optional[ComplianceCertification]:
        r = await self.db.execute(
            select(ComplianceCertification).where(
                ComplianceCertification.id == cid, ComplianceCertification.vendor_id == vendor_id
            )
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> ComplianceCertification:
        c = ComplianceCertification(vendor_id=vendor_id, **data)
        self.db.add(c)
        await self.db.flush()
        await self.db.refresh(c)
        return c

    async def update(self, c: ComplianceCertification, data: dict) -> ComplianceCertification:
        for k, v in data.items():
            setattr(c, k, v)
        await self.db.flush()
        await self.db.refresh(c)
        return c

    async def delete(self, c: ComplianceCertification) -> None:
        await self.db.delete(c)
        await self.db.flush()


class AuditRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(self, vendor_id: UUID, action: str, entity_type: str,
                  entity_id: Optional[UUID] = None, summary: Optional[str] = None,
                  diff: Optional[dict] = None, actor_user_id: Optional[UUID] = None,
                  actor_label: Optional[str] = None, ip: Optional[str] = None) -> ComplianceAuditLog:
        item = ComplianceAuditLog(
            vendor_id=vendor_id, action=action, entity_type=entity_type,
            entity_id=entity_id, summary=summary, diff=diff or {},
            actor_user_id=actor_user_id, actor_label=actor_label, ip_address=ip,
        )
        self.db.add(item)
        await self.db.flush()
        return item

    async def list(self, vendor_id: UUID, entity_type: Optional[str] = None,
                   entity_id: Optional[UUID] = None, limit: int = 200) -> List[ComplianceAuditLog]:
        q = select(ComplianceAuditLog).where(ComplianceAuditLog.vendor_id == vendor_id)
        if entity_type:
            q = q.where(ComplianceAuditLog.entity_type == entity_type)
        if entity_id:
            q = q.where(ComplianceAuditLog.entity_id == entity_id)
        q = q.order_by(ComplianceAuditLog.created_at.desc()).limit(limit)
        return list((await self.db.execute(q)).scalars().all())
