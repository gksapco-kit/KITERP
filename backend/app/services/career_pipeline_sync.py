"""Mirror platform Careers inbox applications into vendor HR recruitment pipeline."""
from __future__ import annotations

import re
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hr_recruit import Candidate, JobApplication, JobPosting
from app.models.platform_career_application import PlatformCareerApplication
from app.repositories.hr_recruit_repo import ApplicationRepo, CandidateRepo

CAREER_TO_PIPELINE_STAGE = {
    "new": "applied",
    "reviewed": "screening",
    "shortlisted": "shortlisted",
    "rejected": "rejected",
}

PIPELINE_TO_CAREER_STATUS = {
    "applied": "new",
    "screening": "reviewed",
    "shortlisted": "shortlisted",
    "interviewing": "shortlisted",
    "offer_made": "shortlisted",
    "hired": "shortlisted",
    "rejected": "rejected",
    "withdrawn": "rejected",
}


def career_status_to_pipeline_stage(status: Optional[str]) -> str:
    key = (status or "new").strip().lower()
    return CAREER_TO_PIPELINE_STAGE.get(key, "applied")


def pipeline_stage_to_career_status(stage: Optional[str]) -> Optional[str]:
    key = (stage or "").strip().lower()
    return PIPELINE_TO_CAREER_STATUS.get(key)


def _parse_skills_from_cover(cover_note: Optional[str]) -> list[str]:
    if not cover_note:
        return []
    match = re.search(r"Skills:\s*([^\n]+)", cover_note, re.I)
    if not match:
        return []
    return [
        part.strip()[:80]
        for part in match.group(1).replace(";", ",").split(",")
        if part.strip()
    ][:40]


async def _match_job_by_title(db: AsyncSession, title: str) -> Optional[UUID]:
    normalized = title.strip().lower()
    if not normalized:
        return None

    result = await db.execute(
        select(JobPosting.id)
        .where(func.lower(JobPosting.title) == normalized)
        .order_by(JobPosting.created_at.desc())
        .limit(2)
    )
    matches = list(result.scalars().all())
    if len(matches) == 1:
        return matches[0]

    result = await db.execute(
        select(JobPosting.id, JobPosting.title)
        .where(JobPosting.status == "open")
        .order_by(JobPosting.created_at.desc())
    )
    partial: list[UUID] = []
    for job_id, job_title in result.all():
        job_normalized = (job_title or "").strip().lower()
        if not job_normalized:
            continue
        if normalized in job_normalized or job_normalized in normalized:
            partial.append(job_id)
            if len(partial) > 1:
                break
    if len(partial) == 1:
        return partial[0]

    return None


async def _resolve_from_existing_hr_application(
    db: AsyncSession,
    row: PlatformCareerApplication,
) -> Optional[UUID]:
    email = (row.email or "").strip().lower()
    if not email:
        return None

    result = await db.execute(
        select(JobApplication.job_posting_id, JobPosting.title)
        .join(Candidate, JobApplication.candidate_id == Candidate.id)
        .join(JobPosting, JobApplication.job_posting_id == JobPosting.id)
        .where(func.lower(Candidate.email) == email)
        .order_by(
            JobApplication.moved_at.desc().nullslast(),
            JobApplication.applied_at.desc(),
        )
    )
    matches = list(result.all())
    if not matches:
        return None

    title_hints = [
        t.strip().lower()
        for t in ((row.position_title or ""), (row.course or ""))
        if t and t.strip()
    ]
    if title_hints:
        for job_id, job_title in matches:
            normalized = (job_title or "").strip().lower()
            if normalized in title_hints or any(h in normalized or normalized in h for h in title_hints):
                return job_id

    if (row.status or "").strip().lower() == "rejected":
        rejected = await db.execute(
            select(JobApplication.job_posting_id)
            .join(Candidate, JobApplication.candidate_id == Candidate.id)
            .where(
                func.lower(Candidate.email) == email,
                JobApplication.current_stage == "rejected",
            )
            .order_by(JobApplication.moved_at.desc().nullslast())
            .limit(1)
        )
        rejected_job_id = rejected.scalar_one_or_none()
        if rejected_job_id:
            return rejected_job_id

    unique_job_ids = list(dict.fromkeys(job_id for job_id, _ in matches))
    if len(unique_job_ids) == 1:
        return unique_job_ids[0]

    return matches[0][0]


async def _resolve_job_posting_id(db: AsyncSession, row: PlatformCareerApplication) -> Optional[UUID]:
    if row.job_posting_id:
        return row.job_posting_id

    for title in (
        (row.position_title or "").strip(),
        (row.course or "").strip(),
    ):
        if not title:
            continue
        job_id = await _match_job_by_title(db, title)
        if job_id:
            row.job_posting_id = job_id
            await db.flush()
            return job_id

    job_id = await _resolve_from_existing_hr_application(db, row)
    if job_id:
        row.job_posting_id = job_id
        await db.flush()
        return job_id

    return None


async def sync_career_application_to_pipeline(
    db: AsyncSession,
    row: PlatformCareerApplication,
) -> Optional[dict[str, Any]]:
    """Create or update HR candidate + job application for a platform career row."""
    job_id = await _resolve_job_posting_id(db, row)
    if not job_id:
        return None

    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        return None

    email = (row.email or "").strip().lower()
    if not email:
        return None

    stage = career_status_to_pipeline_stage(row.status)
    skills_list = _parse_skills_from_cover(row.cover_note)
    cv_url = (row.cv_url or "").strip() or None
    exp = float(row.graduation_year) if row.graduation_year is not None else None

    cand_repo = CandidateRepo(db)
    candidate = None
    for item in await cand_repo.list(job.vendor_id, search=email):
        if (item.email or "").strip().lower() == email:
            candidate = item
            break

    candidate_data: dict[str, Any] = {
        "full_name": (row.full_name or "")[:200],
        "email": email[:255],
        "phone": (row.phone or "")[:30] or None,
        "resume_url": cv_url,
        "current_company": (row.college or "")[:200] or None,
        "current_designation": (row.course or "")[:150] or None,
        "total_experience_years": exp,
        "location": (row.city or "")[:200] or None,
        "source": "portal",
    }
    if skills_list:
        candidate_data["skills"] = skills_list
    if row.cover_note:
        candidate_data["notes"] = row.cover_note[:4000]

    if candidate is None:
        candidate = await cand_repo.create(job.vendor_id, candidate_data)
    else:
        await cand_repo.update(candidate, {k: v for k, v in candidate_data.items() if v is not None})

    app_repo = ApplicationRepo(db)
    applications = await app_repo.list(job.vendor_id, job_id=job.id)
    application = next((a for a in applications if a.candidate_id == candidate.id), None)

    app_data: dict[str, Any] = {
        "current_stage": stage,
        "cover_letter": (row.cover_note or "")[:4000] or None,
    }
    if stage == "rejected":
        reason = (row.admin_note or "").strip()
        if reason:
            app_data["rejection_reason"] = reason[:4000]

    if application is None:
        application = await app_repo.create(
            job.vendor_id,
            {
                "candidate_id": candidate.id,
                "job_posting_id": job.id,
                **app_data,
            },
        )
    else:
        application = await app_repo.update(application, app_data)

    return {
        "job_posting_id": str(job.id),
        "application_id": str(application.id),
        "candidate_id": str(candidate.id),
        "current_stage": application.current_stage,
    }


async def sync_pipeline_stage_to_career_application(
    db: AsyncSession,
    application: JobApplication,
) -> Optional[str]:
    """Mirror HR pipeline stage changes back into the platform Careers inbox."""
    career_status = pipeline_stage_to_career_status(application.current_stage)
    if not career_status:
        return None

    candidate = application.candidate
    if candidate is None and application.candidate_id:
        candidate = (
            await db.execute(select(Candidate).where(Candidate.id == application.candidate_id))
        ).scalar_one_or_none()

    email = (candidate.email or "").strip().lower() if candidate else ""
    if not email:
        return None

    job_id = application.job_posting_id
    query = (
        select(PlatformCareerApplication)
        .where(func.lower(PlatformCareerApplication.email) == email)
        .order_by(PlatformCareerApplication.created_at.desc())
    )
    if job_id:
        query = query.where(
            or_(
                PlatformCareerApplication.job_posting_id == job_id,
                PlatformCareerApplication.job_posting_id.is_(None),
            )
        )

    rows = list((await db.execute(query)).scalars().all())
    if not rows:
        return None

    row: Optional[PlatformCareerApplication] = None
    if job_id:
        row = next((item for item in rows if item.job_posting_id == job_id), None)
    if row is None and len(rows) == 1:
        row = rows[0]
    if row is None:
        row = rows[0]

    if not row.job_posting_id and job_id:
        row.job_posting_id = job_id

    row.status = career_status
    if career_status == "rejected":
        reason = (application.rejection_reason or "").strip()
        if reason:
            row.admin_note = reason[:4000]

    await db.flush()
    return career_status
