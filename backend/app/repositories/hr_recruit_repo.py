"""Recruitment & Onboarding repositories."""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from app.models.hr_recruit import (
    JobPosting, Candidate, JobApplication, InterviewRound,
    OnboardingTemplate, OnboardingTemplateItem,
    OnboardingChecklist, OnboardingTask,
)


class JobRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, status: Optional[str] = None) -> List[JobPosting]:
        q = (
            select(JobPosting)
            .where(JobPosting.vendor_id == vendor_id)
            .options(
                selectinload(JobPosting.department),
                selectinload(JobPosting.designation),
            )
        )
        if status:
            q = q.where(JobPosting.status == status)
        q = q.order_by(JobPosting.created_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, job_id: UUID, vendor_id: UUID) -> Optional[JobPosting]:
        r = await self.db.execute(
            select(JobPosting)
            .where(JobPosting.id == job_id, JobPosting.vendor_id == vendor_id)
            .options(
                selectinload(JobPosting.department),
                selectinload(JobPosting.designation),
            )
        )
        return r.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[JobPosting]:
        r = await self.db.execute(
            select(JobPosting)
            .where(JobPosting.public_slug == slug)
            .options(
                selectinload(JobPosting.department),
                selectinload(JobPosting.designation),
            )
        )
        return r.scalar_one_or_none()

    async def list_open_public(self) -> List[JobPosting]:
        """Open jobs for the public Careers page (all vendors)."""
        q = (
            select(JobPosting)
            .where(JobPosting.status == "open")
            .options(
                selectinload(JobPosting.department),
                selectinload(JobPosting.designation),
            )
            .order_by(
                JobPosting.posted_at.desc().nullslast(),
                JobPosting.created_at.desc(),
            )
        )
        items = list((await self.db.execute(q)).scalars().all())
        now = datetime.utcnow()
        out: List[JobPosting] = []
        for j in items:
            closes = j.closes_at
            if closes is not None:
                closes_naive = closes.replace(tzinfo=None) if getattr(closes, "tzinfo", None) else closes
                if closes_naive <= now:
                    continue
            out.append(j)
        return out

    async def create(self, vendor_id: UUID, data: dict) -> JobPosting:
        item = JobPosting(vendor_id=vendor_id, **data)
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def update(self, item: JobPosting, data: dict) -> JobPosting:
        for k, v in data.items():
            setattr(item, k, v)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def delete(self, item: JobPosting) -> None:
        await self.db.delete(item)
        await self.db.flush()


class CandidateRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, search: Optional[str] = None) -> List[Candidate]:
        q = (
            select(Candidate)
            .where(Candidate.vendor_id == vendor_id)
            .options(
                selectinload(Candidate.applications).selectinload(JobApplication.job_posting),
                selectinload(Candidate.applications).selectinload(JobApplication.interviews),
            )
        )
        if search:
            s = f"%{search.lower()}%"
            q = q.where(or_(
                func.lower(Candidate.full_name).like(s),
                func.lower(Candidate.email).like(s),
                Candidate.phone.like(f"%{search}%"),
            ))
        q = q.order_by(Candidate.created_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, cid: UUID, vendor_id: UUID) -> Optional[Candidate]:
        r = await self.db.execute(
            select(Candidate).where(Candidate.id == cid, Candidate.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> Candidate:
        c = Candidate(vendor_id=vendor_id, **data)
        self.db.add(c)
        await self.db.flush()
        await self.db.refresh(c)
        return c

    async def update(self, c: Candidate, data: dict) -> Candidate:
        for k, v in data.items():
            setattr(c, k, v)
        await self.db.flush()
        await self.db.refresh(c)
        return c

    async def delete(self, c: Candidate) -> None:
        await self.db.delete(c)
        await self.db.flush()


class ApplicationRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, job_id: Optional[UUID] = None,
                   stage: Optional[str] = None) -> List[JobApplication]:
        q = (
            select(JobApplication)
            .where(JobApplication.vendor_id == vendor_id)
            .options(
                selectinload(JobApplication.candidate),
                selectinload(JobApplication.job_posting),
            )
        )
        if job_id:
            q = q.where(JobApplication.job_posting_id == job_id)
        if stage:
            q = q.where(JobApplication.current_stage == stage)
        q = q.order_by(JobApplication.applied_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, aid: UUID, vendor_id: UUID) -> Optional[JobApplication]:
        r = await self.db.execute(
            select(JobApplication)
            .where(JobApplication.id == aid, JobApplication.vendor_id == vendor_id)
            .options(
                selectinload(JobApplication.candidate),
                selectinload(JobApplication.job_posting),
            )
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> JobApplication:
        a = JobApplication(vendor_id=vendor_id, **data)
        self.db.add(a)
        await self.db.flush()
        await self.db.refresh(a)
        return a

    async def update(self, a: JobApplication, data: dict) -> JobApplication:
        for k, v in data.items():
            setattr(a, k, v)
        a.moved_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(a)
        return a

    async def delete(self, a: JobApplication) -> None:
        await self.db.delete(a)
        await self.db.flush()


class InterviewRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_application(self, app_id: UUID, vendor_id: UUID) -> List[InterviewRound]:
        r = await self.db.execute(
            select(InterviewRound)
            .where(InterviewRound.application_id == app_id, InterviewRound.vendor_id == vendor_id)
            .order_by(InterviewRound.round_number.asc())
        )
        return list(r.scalars().all())

    async def list_upcoming(self, vendor_id: UUID, limit: int = 50) -> List[InterviewRound]:
        r = await self.db.execute(
            select(InterviewRound)
            .where(
                InterviewRound.vendor_id == vendor_id,
                InterviewRound.status == "scheduled",
                InterviewRound.scheduled_at >= datetime.utcnow(),
            )
            .options(
                selectinload(InterviewRound.application).selectinload(JobApplication.candidate),
                selectinload(InterviewRound.application).selectinload(JobApplication.job_posting),
            )
            .order_by(InterviewRound.scheduled_at.asc())
            .limit(limit)
        )
        return list(r.scalars().all())

    async def get(self, iid: UUID, vendor_id: UUID) -> Optional[InterviewRound]:
        r = await self.db.execute(
            select(InterviewRound).where(InterviewRound.id == iid, InterviewRound.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> InterviewRound:
        item = InterviewRound(vendor_id=vendor_id, **data)
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def update(self, item: InterviewRound, data: dict) -> InterviewRound:
        for k, v in data.items():
            setattr(item, k, v)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def delete(self, item: InterviewRound) -> None:
        await self.db.delete(item)
        await self.db.flush()


class OnboardingTemplateRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID) -> List[OnboardingTemplate]:
        r = await self.db.execute(
            select(OnboardingTemplate)
            .where(OnboardingTemplate.vendor_id == vendor_id)
            .options(selectinload(OnboardingTemplate.items))
            .order_by(OnboardingTemplate.is_default.desc(), OnboardingTemplate.name.asc())
        )
        return list(r.scalars().all())

    async def get(self, tid: UUID, vendor_id: UUID) -> Optional[OnboardingTemplate]:
        r = await self.db.execute(
            select(OnboardingTemplate)
            .where(OnboardingTemplate.id == tid, OnboardingTemplate.vendor_id == vendor_id)
            .options(selectinload(OnboardingTemplate.items))
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict, items: List[dict]) -> OnboardingTemplate:
        t = OnboardingTemplate(vendor_id=vendor_id, **data)
        self.db.add(t)
        await self.db.flush()
        for i, it in enumerate(items or []):
            self.db.add(OnboardingTemplateItem(template_id=t.id, sequence=it.get("sequence", i), **{k: v for k, v in it.items() if k != "sequence"}))
        await self.db.flush()
        return await self.get(t.id, vendor_id)

    async def update(self, tid: UUID, vendor_id: UUID, data: dict, items: Optional[List[dict]] = None) -> OnboardingTemplate:
        t = await self.get(tid, vendor_id)
        if not t:
            return None
        for k, v in data.items():
            setattr(t, k, v)
        if items is not None:
            for it in list(t.items):
                await self.db.delete(it)
            await self.db.flush()
            for i, it in enumerate(items):
                self.db.add(OnboardingTemplateItem(template_id=t.id, sequence=it.get("sequence", i), **{k: v for k, v in it.items() if k != "sequence"}))
        await self.db.flush()
        return await self.get(t.id, vendor_id)

    async def delete(self, t: OnboardingTemplate) -> None:
        await self.db.delete(t)
        await self.db.flush()


class OnboardingChecklistRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, status: Optional[str] = None) -> List[OnboardingChecklist]:
        q = (
            select(OnboardingChecklist)
            .where(OnboardingChecklist.vendor_id == vendor_id)
            .options(selectinload(OnboardingChecklist.tasks))
        )
        if status:
            q = q.where(OnboardingChecklist.status == status)
        q = q.order_by(OnboardingChecklist.started_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, cid: UUID, vendor_id: UUID) -> Optional[OnboardingChecklist]:
        r = await self.db.execute(
            select(OnboardingChecklist)
            .where(OnboardingChecklist.id == cid, OnboardingChecklist.vendor_id == vendor_id)
            .options(selectinload(OnboardingChecklist.tasks))
        )
        return r.scalar_one_or_none()

    async def get_for_employee(self, employee_id: UUID, vendor_id: UUID) -> Optional[OnboardingChecklist]:
        r = await self.db.execute(
            select(OnboardingChecklist)
            .where(OnboardingChecklist.employee_id == employee_id, OnboardingChecklist.vendor_id == vendor_id)
            .options(selectinload(OnboardingChecklist.tasks))
            .order_by(OnboardingChecklist.started_at.desc())
            .limit(1)
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict, tasks: List[dict]) -> OnboardingChecklist:
        c = OnboardingChecklist(vendor_id=vendor_id, **data)
        self.db.add(c)
        await self.db.flush()
        for i, t in enumerate(tasks or []):
            self.db.add(OnboardingTask(checklist_id=c.id, sequence=t.get("sequence", i), **{k: v for k, v in t.items() if k != "sequence"}))
        await self.db.flush()
        return await self.get(c.id, vendor_id)

    async def update_task(self, task_id: UUID, data: dict) -> Optional[OnboardingTask]:
        r = await self.db.execute(select(OnboardingTask).where(OnboardingTask.id == task_id))
        t = r.scalar_one_or_none()
        if not t:
            return None
        for k, v in data.items():
            setattr(t, k, v)
        if data.get("status") == "done" and not t.completed_at:
            t.completed_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(t)
        return t

    async def maybe_complete(self, checklist_id: UUID) -> None:
        r = await self.db.execute(
            select(OnboardingChecklist)
            .where(OnboardingChecklist.id == checklist_id)
            .options(selectinload(OnboardingChecklist.tasks))
        )
        c = r.scalar_one_or_none()
        if not c:
            return
        all_done = all(t.status in ("done", "skipped") for t in c.tasks) if c.tasks else False
        if all_done and c.status != "completed":
            c.status = "completed"
            c.completed_at = datetime.utcnow()
            await self.db.flush()
