"""Performance Management repositories."""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models.hr_performance import (
    ReviewCycle, PerformanceGoal, PerformanceReview, ReviewKPIScore, Feedback,
)
from app.models.hr import EmployeeProfile


class CycleRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID) -> List[ReviewCycle]:
        r = await self.db.execute(
            select(ReviewCycle).where(ReviewCycle.vendor_id == vendor_id)
            .order_by(ReviewCycle.period_start.desc())
        )
        return list(r.scalars().all())

    async def get(self, cid: UUID, vendor_id: UUID) -> Optional[ReviewCycle]:
        r = await self.db.execute(
            select(ReviewCycle).where(ReviewCycle.id == cid, ReviewCycle.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> ReviewCycle:
        c = ReviewCycle(vendor_id=vendor_id, **data)
        self.db.add(c)
        await self.db.flush()
        await self.db.refresh(c)
        return c

    async def update(self, c: ReviewCycle, data: dict) -> ReviewCycle:
        for k, v in data.items():
            setattr(c, k, v)
        await self.db.flush()
        await self.db.refresh(c)
        return c

    async def delete(self, c: ReviewCycle) -> None:
        await self.db.delete(c)
        await self.db.flush()


class GoalRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, employee_id: Optional[UUID] = None,
                   cycle_id: Optional[UUID] = None) -> List[PerformanceGoal]:
        q = select(PerformanceGoal).where(PerformanceGoal.vendor_id == vendor_id)
        if employee_id:
            q = q.where(PerformanceGoal.employee_id == employee_id)
        if cycle_id:
            q = q.where(PerformanceGoal.cycle_id == cycle_id)
        q = q.order_by(PerformanceGoal.created_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get(self, gid: UUID, vendor_id: UUID) -> Optional[PerformanceGoal]:
        r = await self.db.execute(
            select(PerformanceGoal).where(PerformanceGoal.id == gid, PerformanceGoal.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> PerformanceGoal:
        g = PerformanceGoal(vendor_id=vendor_id, **data)
        self.db.add(g)
        await self.db.flush()
        await self.db.refresh(g)
        return g

    async def update(self, g: PerformanceGoal, data: dict) -> PerformanceGoal:
        for k, v in data.items():
            setattr(g, k, v)
        await self.db.flush()
        await self.db.refresh(g)
        return g

    async def delete(self, g: PerformanceGoal) -> None:
        await self.db.delete(g)
        await self.db.flush()


class ReviewRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, cycle_id: Optional[UUID] = None,
                   employee_id: Optional[UUID] = None, status: Optional[str] = None) -> List[PerformanceReview]:
        q = select(PerformanceReview).where(PerformanceReview.vendor_id == vendor_id)
        if cycle_id:
            q = q.where(PerformanceReview.cycle_id == cycle_id)
        if employee_id:
            q = q.where(PerformanceReview.employee_id == employee_id)
        if status:
            q = q.where(PerformanceReview.status == status)
        q = q.order_by(PerformanceReview.created_at.desc())
        r = await self.db.execute(q.options(selectinload(PerformanceReview.kpi_scores)))
        return list(r.scalars().all())

    async def get(self, rid: UUID, vendor_id: UUID) -> Optional[PerformanceReview]:
        r = await self.db.execute(
            select(PerformanceReview)
            .where(PerformanceReview.id == rid, PerformanceReview.vendor_id == vendor_id)
            .options(selectinload(PerformanceReview.kpi_scores))
        )
        return r.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> PerformanceReview:
        r = PerformanceReview(vendor_id=vendor_id, **data)
        self.db.add(r)
        await self.db.flush()
        await self.db.refresh(r)
        return r

    async def update(self, r: PerformanceReview, data: dict) -> PerformanceReview:
        for k, v in data.items():
            setattr(r, k, v)
        await self.db.flush()
        await self.db.refresh(r)
        return r

    async def upsert_kpi_scores(self, review_id: UUID, scores: List[dict]) -> None:
        # delete existing
        existing = await self.db.execute(select(ReviewKPIScore).where(ReviewKPIScore.review_id == review_id))
        for s in existing.scalars().all():
            await self.db.delete(s)
        await self.db.flush()
        for s in scores or []:
            self.db.add(ReviewKPIScore(review_id=review_id, **s))
        await self.db.flush()


class FeedbackRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, employee_id: Optional[UUID] = None) -> List[Feedback]:
        q = select(Feedback).where(Feedback.vendor_id == vendor_id)
        if employee_id:
            q = q.where(Feedback.to_employee_id == employee_id)
        q = q.order_by(Feedback.created_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def create(self, vendor_id: UUID, data: dict) -> Feedback:
        f = Feedback(vendor_id=vendor_id, **data)
        self.db.add(f)
        await self.db.flush()
        await self.db.refresh(f)
        return f

    async def delete(self, fid: UUID, vendor_id: UUID) -> bool:
        r = await self.db.execute(select(Feedback).where(Feedback.id == fid, Feedback.vendor_id == vendor_id))
        f = r.scalar_one_or_none()
        if not f:
            return False
        await self.db.delete(f)
        await self.db.flush()
        return True
