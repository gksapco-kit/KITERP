"""Training repositories — programs, courses, quizzes, enrollments, certificates."""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.hr_training import (
    TrainingProgram, TrainingCourse, QuizQuestion,
    TrainingEnrollment, CourseCompletion, TrainingCertificate,
)


class TrainingRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Programs ─────────────────────────────────
    async def list_programs(self, vendor_id: UUID, status: Optional[str] = None) -> List[TrainingProgram]:
        q = select(TrainingProgram).where(TrainingProgram.vendor_id == vendor_id)
        if status:
            q = q.where(TrainingProgram.status == status)
        q = q.order_by(TrainingProgram.created_at.desc())
        r = await self.db.execute(q.options(selectinload(TrainingProgram.courses)))
        return list(r.scalars().all())

    async def get_program(self, pid: UUID, vendor_id: UUID) -> Optional[TrainingProgram]:
        r = await self.db.execute(
            select(TrainingProgram)
            .where(TrainingProgram.id == pid, TrainingProgram.vendor_id == vendor_id)
            .options(selectinload(TrainingProgram.courses).selectinload(TrainingCourse.questions))
        )
        return r.scalar_one_or_none()

    async def create_program(self, vendor_id: UUID, data: dict) -> TrainingProgram:
        p = TrainingProgram(vendor_id=vendor_id, **data)
        self.db.add(p)
        await self.db.flush()
        await self.db.refresh(p)
        return p

    async def update_program(self, p: TrainingProgram, data: dict) -> TrainingProgram:
        for k, v in data.items():
            setattr(p, k, v)
        await self.db.flush()
        await self.db.refresh(p)
        return p

    async def delete_program(self, p: TrainingProgram) -> None:
        await self.db.delete(p)
        await self.db.flush()

    # ── Courses ─────────────────────────────────
    async def list_courses(self, program_id: UUID) -> List[TrainingCourse]:
        r = await self.db.execute(
            select(TrainingCourse)
            .where(TrainingCourse.program_id == program_id)
            .order_by(TrainingCourse.sequence.asc())
            .options(selectinload(TrainingCourse.questions))
        )
        return list(r.scalars().all())

    async def get_course(self, cid: UUID) -> Optional[TrainingCourse]:
        r = await self.db.execute(
            select(TrainingCourse).where(TrainingCourse.id == cid)
            .options(selectinload(TrainingCourse.questions))
        )
        return r.scalar_one_or_none()

    async def create_course(self, program_id: UUID, data: dict, questions: Optional[List[dict]] = None) -> TrainingCourse:
        c = TrainingCourse(program_id=program_id, **data)
        self.db.add(c)
        await self.db.flush()
        if questions:
            for i, q in enumerate(questions):
                self.db.add(QuizQuestion(course_id=c.id, sequence=q.get("sequence", i), **{k: v for k, v in q.items() if k != "sequence"}))
            await self.db.flush()
        return await self.get_course(c.id)

    async def update_course(self, course_id: UUID, data: dict, questions: Optional[List[dict]] = None) -> Optional[TrainingCourse]:
        c = await self.get_course(course_id)
        if not c:
            return None
        for k, v in data.items():
            setattr(c, k, v)
        if questions is not None:
            for q in list(c.questions):
                await self.db.delete(q)
            await self.db.flush()
            for i, q in enumerate(questions):
                self.db.add(QuizQuestion(course_id=c.id, sequence=q.get("sequence", i), **{k: v for k, v in q.items() if k != "sequence"}))
        await self.db.flush()
        return await self.get_course(c.id)

    async def delete_course(self, c: TrainingCourse) -> None:
        await self.db.delete(c)
        await self.db.flush()

    # ── Enrollments ─────────────────────────────
    async def list_enrollments(self, vendor_id: UUID, program_id: Optional[UUID] = None,
                                employee_id: Optional[UUID] = None) -> List[TrainingEnrollment]:
        q = select(TrainingEnrollment).where(TrainingEnrollment.vendor_id == vendor_id)
        if program_id:
            q = q.where(TrainingEnrollment.program_id == program_id)
        if employee_id:
            q = q.where(TrainingEnrollment.employee_id == employee_id)
        q = q.order_by(TrainingEnrollment.enrolled_at.desc())
        return list((await self.db.execute(q)).scalars().all())

    async def get_enrollment(self, eid: UUID, vendor_id: UUID) -> Optional[TrainingEnrollment]:
        r = await self.db.execute(
            select(TrainingEnrollment).where(
                TrainingEnrollment.id == eid, TrainingEnrollment.vendor_id == vendor_id
            )
        )
        return r.scalar_one_or_none()

    async def enroll(self, vendor_id: UUID, program_id: UUID, employee_id: UUID,
                     due_date: Optional[date] = None) -> TrainingEnrollment:
        existing = await self.db.execute(
            select(TrainingEnrollment).where(
                TrainingEnrollment.program_id == program_id,
                TrainingEnrollment.employee_id == employee_id,
            )
        )
        e = existing.scalar_one_or_none()
        if e:
            return e
        e = TrainingEnrollment(
            vendor_id=vendor_id, program_id=program_id,
            employee_id=employee_id, due_date=due_date,
        )
        self.db.add(e)
        await self.db.flush()
        await self.db.refresh(e)
        return e

    async def list_completions(self, enrollment_id: UUID) -> List[CourseCompletion]:
        r = await self.db.execute(
            select(CourseCompletion).where(CourseCompletion.enrollment_id == enrollment_id)
        )
        return list(r.scalars().all())

    async def upsert_completion(self, enrollment_id: UUID, course_id: UUID,
                                 score_pct: Optional[int] = None, passed: bool = True,
                                 answers: Optional[dict] = None) -> CourseCompletion:
        existing = await self.db.execute(
            select(CourseCompletion).where(
                CourseCompletion.enrollment_id == enrollment_id,
                CourseCompletion.course_id == course_id,
            )
        )
        c = existing.scalar_one_or_none()
        if c:
            c.score_pct = score_pct if score_pct is not None else c.score_pct
            c.passed = passed
            c.answers = answers or c.answers
            c.attempts = (c.attempts or 1) + 1
            c.completed_at = datetime.utcnow()
        else:
            c = CourseCompletion(
                enrollment_id=enrollment_id, course_id=course_id,
                score_pct=score_pct, passed=passed, answers=answers or {},
                completed_at=datetime.utcnow(), attempts=1,
            )
            self.db.add(c)
        await self.db.flush()
        await self.db.refresh(c)
        return c

    async def recalc_progress(self, enrollment_id: UUID) -> TrainingEnrollment:
        # Compute progress = passed completions / total required courses
        e = await self.db.execute(select(TrainingEnrollment).where(TrainingEnrollment.id == enrollment_id))
        enr = e.scalar_one()
        courses = await self.db.execute(
            select(TrainingCourse).where(TrainingCourse.program_id == enr.program_id)
        )
        all_courses = list(courses.scalars().all())
        required = [c for c in all_courses if c.is_required]
        completions = await self.list_completions(enrollment_id)
        passed_ids = {c.course_id for c in completions if c.passed}
        if not required:
            pct = 100
        else:
            pct = int(round(100 * sum(1 for c in required if c.id in passed_ids) / len(required)))
        enr.progress_pct = pct
        if pct >= 100:
            if enr.status != "completed":
                enr.status = "completed"
                enr.completed_at = datetime.utcnow()
        elif pct > 0 and enr.status == "enrolled":
            enr.status = "in_progress"
        await self.db.flush()
        await self.db.refresh(enr)
        return enr

    async def issue_certificate(self, vendor_id: UUID, enrollment_id: UUID,
                                 program_name: str, employee_name: str) -> TrainingCertificate:
        # Idempotent
        existing = await self.db.execute(
            select(TrainingCertificate).where(TrainingCertificate.enrollment_id == enrollment_id)
        )
        c = existing.scalar_one_or_none()
        if c:
            return c
        cert_no = f"CERT-{datetime.utcnow().strftime('%Y%m')}-{str(uuid4())[:6].upper()}"
        html = _certificate_html(program_name, employee_name, cert_no)
        cert = TrainingCertificate(
            vendor_id=vendor_id, enrollment_id=enrollment_id,
            certificate_number=cert_no,
            title_snapshot=program_name,
            employee_name_snapshot=employee_name,
            download_html=html,
        )
        self.db.add(cert)
        await self.db.flush()
        await self.db.refresh(cert)
        return cert


def _certificate_html(program: str, name: str, number: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'><title>Certificate · {program}</title>
<style>
body {{ font-family: 'Georgia', serif; background:#fffaf0; margin:0; padding:40px;}}
.cert {{ max-width:900px; margin:auto; border:8px double #b8860b; padding:60px; text-align:center; background:white;}}
h1 {{ font-size:42px; color:#b8860b; margin:0 0 8px; letter-spacing:3px;}}
h2 {{ font-size:24px; color:#444; margin:0 0 30px; font-weight:normal;}}
.name {{ font-size:38px; color:#222; margin:30px 0 10px; font-style:italic;}}
.body {{ font-size:18px; color:#444; margin:30px auto; max-width:720px; line-height:1.6;}}
.program {{ font-size:24px; color:#b8860b; font-weight:bold; margin:20px 0;}}
.meta {{ display:flex; justify-content:space-between; margin-top:60px; font-size:14px; color:#666;}}
.sig {{ border-top:1px solid #999; padding-top:6px; min-width:180px;}}
</style></head>
<body><div class='cert'>
<h1>Certificate of Completion</h1>
<h2>This is to certify that</h2>
<div class='name'>{name}</div>
<div class='body'>has successfully completed the training program</div>
<div class='program'>{program}</div>
<div class='body'>and has demonstrated proficiency in the required learning outcomes.</div>
<div class='meta'><div class='sig'>Date: {datetime.utcnow().strftime('%d %b %Y')}</div>
<div class='sig'>Certificate No: {number}</div></div>
</div></body></html>"""
