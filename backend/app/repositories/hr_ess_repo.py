"""ESS repositories — announcements, expenses, helpdesk."""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from app.models.hr_ess import (
    Announcement, AnnouncementRead, ExpenseClaim,
    HelpdeskTicket, HelpdeskTicketComment,
)


class AnnouncementRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, status: Optional[str] = None,
                   include_expired: bool = False) -> List[Announcement]:
        q = select(Announcement).where(Announcement.vendor_id == vendor_id)
        if status:
            q = q.where(Announcement.status == status)
        if not include_expired:
            q = q.where(or_(Announcement.expires_at.is_(None), Announcement.expires_at >= datetime.utcnow()))
        q = q.order_by(Announcement.pinned.desc(), Announcement.publish_at.desc().nulls_last(), Announcement.created_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def list_for_employee(self, vendor_id: UUID, employee_id: UUID) -> List[Announcement]:
        q = (
            select(Announcement)
            .where(
                Announcement.vendor_id == vendor_id,
                Announcement.status == "published",
                or_(Announcement.publish_at.is_(None), Announcement.publish_at <= datetime.utcnow()),
                or_(Announcement.expires_at.is_(None), Announcement.expires_at >= datetime.utcnow()),
            )
            .options(selectinload(Announcement.reads))
            .order_by(Announcement.pinned.desc(), Announcement.publish_at.desc().nulls_last())
        )
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, aid: UUID, vendor_id: UUID) -> Optional[Announcement]:
        r = await self.db.execute(
            select(Announcement).where(Announcement.id == aid, Announcement.vendor_id == vendor_id)
            .options(selectinload(Announcement.reads))
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> Announcement:
        a = Announcement(vendor_id=vendor_id, **data)
        self.db.add(a)
        await self.db.flush()
        await self.db.refresh(a)
        return a

    async def update(self, a: Announcement, data: dict) -> Announcement:
        for k, v in data.items():
            setattr(a, k, v)
        await self.db.flush()
        await self.db.refresh(a)
        return a

    async def delete(self, a: Announcement) -> None:
        await self.db.delete(a)
        await self.db.flush()

    async def mark_read(self, ann_id: UUID, employee_id: UUID) -> None:
        existing = await self.db.execute(
            select(AnnouncementRead).where(
                AnnouncementRead.announcement_id == ann_id,
                AnnouncementRead.employee_id == employee_id,
            )
        )
        if existing.scalar_one_or_none():
            return
        self.db.add(AnnouncementRead(announcement_id=ann_id, employee_id=employee_id))
        await self.db.flush()


class ExpenseRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def next_claim_number(self, vendor_id: UUID) -> str:
        r = await self.db.execute(
            select(func.count(ExpenseClaim.id)).where(ExpenseClaim.vendor_id == vendor_id)
        )
        n = (r.scalar() or 0) + 1
        return f"EXP-{datetime.utcnow().strftime('%Y%m')}-{n:04d}"

    async def list(self, vendor_id: UUID, status: Optional[str] = None,
                   employee_id: Optional[UUID] = None) -> List[ExpenseClaim]:
        q = select(ExpenseClaim).where(ExpenseClaim.vendor_id == vendor_id)
        if status:
            q = q.where(ExpenseClaim.status == status)
        if employee_id:
            q = q.where(ExpenseClaim.employee_id == employee_id)
        q = q.order_by(ExpenseClaim.created_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, eid: UUID, vendor_id: UUID) -> Optional[ExpenseClaim]:
        r = await self.db.execute(
            select(ExpenseClaim).where(ExpenseClaim.id == eid, ExpenseClaim.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> ExpenseClaim:
        if not data.get("claim_number"):
            data["claim_number"] = await self.next_claim_number(vendor_id)
        e = ExpenseClaim(vendor_id=vendor_id, **data)
        self.db.add(e)
        await self.db.flush()
        await self.db.refresh(e)
        return e

    async def update(self, e: ExpenseClaim, data: dict) -> ExpenseClaim:
        for k, v in data.items():
            setattr(e, k, v)
        await self.db.flush()
        await self.db.refresh(e)
        return e

    async def delete(self, e: ExpenseClaim) -> None:
        await self.db.delete(e)
        await self.db.flush()


class HelpdeskRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def next_ticket_number(self, vendor_id: UUID) -> str:
        r = await self.db.execute(
            select(func.count(HelpdeskTicket.id)).where(HelpdeskTicket.vendor_id == vendor_id)
        )
        n = (r.scalar() or 0) + 1
        return f"TKT-{datetime.utcnow().strftime('%Y%m')}-{n:04d}"

    async def list(self, vendor_id: UUID, status: Optional[str] = None,
                   employee_id: Optional[UUID] = None, assignee_user_id: Optional[UUID] = None) -> List[HelpdeskTicket]:
        q = select(HelpdeskTicket).where(HelpdeskTicket.vendor_id == vendor_id)
        if status:
            q = q.where(HelpdeskTicket.status == status)
        if employee_id:
            q = q.where(HelpdeskTicket.employee_id == employee_id)
        if assignee_user_id:
            q = q.where(HelpdeskTicket.assignee_user_id == assignee_user_id)
        q = q.order_by(HelpdeskTicket.created_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, tid: UUID, vendor_id: UUID) -> Optional[HelpdeskTicket]:
        r = await self.db.execute(
            select(HelpdeskTicket).where(HelpdeskTicket.id == tid, HelpdeskTicket.vendor_id == vendor_id)
            .options(selectinload(HelpdeskTicket.comments))
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> HelpdeskTicket:
        if not data.get("ticket_number"):
            data["ticket_number"] = await self.next_ticket_number(vendor_id)
        if not data.get("sla_due_at"):
            # default SLA: 48h normal, 24h high, 4h urgent
            hrs = {"low": 96, "normal": 48, "high": 24, "urgent": 4}.get(data.get("priority", "normal"), 48)
            data["sla_due_at"] = datetime.utcnow() + timedelta(hours=hrs)
        t = HelpdeskTicket(vendor_id=vendor_id, **data)
        self.db.add(t)
        await self.db.flush()
        await self.db.refresh(t)
        return t

    async def update(self, t: HelpdeskTicket, data: dict) -> HelpdeskTicket:
        for k, v in data.items():
            setattr(t, k, v)
        if data.get("status") == "resolved" and not t.resolved_at:
            t.resolved_at = datetime.utcnow()
        if data.get("status") == "closed" and not t.closed_at:
            t.closed_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(t)
        return t

    async def add_comment(self, ticket_id: UUID, data: dict) -> HelpdeskTicketComment:
        c = HelpdeskTicketComment(ticket_id=ticket_id, **data)
        self.db.add(c)
        await self.db.flush()
        await self.db.refresh(c)
        return c

    async def delete(self, t: HelpdeskTicket) -> None:
        await self.db.delete(t)
        await self.db.flush()
