"""HR Extras API — Recruitment & Onboarding, Performance, Compliance, Training, ESS.
Mounted at /vendors/me/hr (same prefix as vendor_hr)."""
from __future__ import annotations
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_vendor_user, require_permission
from app.models.vendor_user import VendorUser
from app.models.user import User
from app.models.hr import EmployeeProfile
from app.models.hr_recruit import (
    JobPosting, Candidate, JobApplication, InterviewRound,
    OnboardingTemplate, OnboardingTemplateItem,
    OnboardingChecklist, OnboardingTask,
)
from app.models.hr_performance import (
    ReviewCycle, PerformanceGoal, PerformanceReview, ReviewKPIScore, Feedback,
)
from app.models.hr_compliance import (
    Policy, PolicyAcknowledgement, ComplianceCertification, ComplianceAuditLog,
)
from app.models.hr_training import (
    TrainingProgram, TrainingCourse, QuizQuestion,
    TrainingEnrollment, CourseCompletion, TrainingCertificate,
)
from app.models.hr_ess import (
    Announcement, AnnouncementRead, ExpenseClaim,
    HelpdeskTicket, HelpdeskTicketComment,
)
from app.repositories.hr_recruit_repo import (
    JobRepo, CandidateRepo, ApplicationRepo, InterviewRepo,
    OnboardingTemplateRepo, OnboardingChecklistRepo,
)
from app.repositories.hr_performance_repo import (
    CycleRepo, GoalRepo, ReviewRepo, FeedbackRepo,
)
from app.repositories.hr_compliance_repo import (
    PolicyRepo, CertificationRepo, AuditRepo,
)
from app.repositories.hr_training_repo import TrainingRepo
from app.services.notification_service import NotificationService
from app.repositories.hr_ess_repo import (
    AnnouncementRepo, ExpenseRepo, HelpdeskRepo,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════
# Helper: serialise SQLAlchemy → dict (recursive, lists, UUID, dates)
# ═══════════════════════════════════════════════════════════════════
def _d(obj: Any, depth: int = 0) -> Any:
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, (list, tuple)):
        return [_d(v, depth) for v in obj]
    if isinstance(obj, dict):
        return {k: _d(v, depth + 1) for k, v in obj.items()}
    if hasattr(obj, "__dict__") and depth < 3:
        exclude = {"_sa_instance_state", "password_hash"}
        return {k: _d(v, depth + 1) for k, v in obj.__dict__.items()
                if k not in exclude and not k.startswith("_")}
    return str(obj)


async def _current_employee(db: AsyncSession, vu: VendorUser) -> Optional[EmployeeProfile]:
    r = await db.execute(
        select(EmployeeProfile).where(EmployeeProfile.vendor_user_id == vu.id)
    )
    return r.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════════
# RECRUITMENT — Jobs
# ═══════════════════════════════════════════════════════════════════

class JobIn(BaseModel):
    title: str
    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    store_id: Optional[UUID] = None
    employment_type: Optional[str] = "full_time"
    location: Optional[str] = None
    openings: Optional[int] = 1
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    benefits: Optional[str] = None
    status: Optional[str] = "draft"
    public_slug: Optional[str] = None
    closes_at: Optional[datetime] = None


@router.get("/jobs")
async def list_jobs(
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await JobRepo(db).list(vu.vendor_id, status=status)
    return [_d(i) for i in items]


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    j = await JobRepo(db).get(job_id, vu.vendor_id)
    if not j:
        raise HTTPException(404, "Job not found")
    return _d(j)


@router.post("/jobs", status_code=201)
async def create_job(
    body: JobIn,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_none=True)
    if data.get("status") == "open" and not data.get("posted_at"):
        data["posted_at"] = datetime.utcnow()
    data["posted_by"] = vu.id
    j = await JobRepo(db).create(vu.vendor_id, data)
    await AuditRepo(db).log(vu.vendor_id, "create", "job_posting", j.id,
                             summary=f"Posted job '{j.title}'", actor_user_id=vu.id)
    await db.commit()
    return _d(j)


@router.put("/jobs/{job_id}")
async def update_job(
    job_id: UUID,
    body: JobIn,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    j = await JobRepo(db).get(job_id, vu.vendor_id)
    if not j:
        raise HTTPException(404, "Job not found")
    data = body.model_dump(exclude_none=True)
    if data.get("status") == "open" and not j.posted_at:
        data["posted_at"] = datetime.utcnow()
    j = await JobRepo(db).update(j, data)
    await AuditRepo(db).log(vu.vendor_id, "update", "job_posting", j.id,
                             summary=f"Updated job '{j.title}'", actor_user_id=vu.id)
    await db.commit()
    return _d(j)


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(
    job_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    j = await JobRepo(db).get(job_id, vu.vendor_id)
    if not j:
        raise HTTPException(404, "Job not found")
    await JobRepo(db).delete(j)
    await db.commit()


# Public job board (no auth)
@router.get("/public/jobs/{slug}")
async def get_public_job(slug: str, db: AsyncSession = Depends(get_db)):
    j = await JobRepo(db).get_by_slug(slug)
    if not j or j.status != "open":
        raise HTTPException(404, "Job not available")
    return _d(j)


# ═══════════════════════════════════════════════════════════════════
# RECRUITMENT — Candidates
# ═══════════════════════════════════════════════════════════════════

class CandidateIn(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    resume_url: Optional[str] = None
    current_company: Optional[str] = None
    current_designation: Optional[str] = None
    total_experience_years: Optional[float] = None
    current_ctc: Optional[float] = None
    expected_ctc: Optional[float] = None
    notice_period_days: Optional[int] = None
    location: Optional[str] = None
    source: Optional[str] = None
    skills: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


@router.get("/candidates")
async def list_candidates(
    search: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await CandidateRepo(db).list(vu.vendor_id, search=search)
    return [_d(i) for i in items]


@router.get("/candidates/{cid}")
async def get_candidate(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    c = await CandidateRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Candidate not found")
    # also load applications
    apps = await ApplicationRepo(db).list(vu.vendor_id)
    apps = [a for a in apps if a.candidate_id == c.id]
    return {**_d(c), "applications": [_d(a) for a in apps]}


@router.post("/candidates", status_code=201)
async def create_candidate(
    body: CandidateIn,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    c = await CandidateRepo(db).create(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(c)


@router.put("/candidates/{cid}")
async def update_candidate(
    cid: UUID,
    body: CandidateIn,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    c = await CandidateRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Candidate not found")
    c = await CandidateRepo(db).update(c, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(c)


@router.delete("/candidates/{cid}", status_code=204)
async def delete_candidate(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    c = await CandidateRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Candidate not found")
    await CandidateRepo(db).delete(c)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# RECRUITMENT — Applications (with stage transitions)
# ═══════════════════════════════════════════════════════════════════

class AppIn(BaseModel):
    candidate_id: UUID
    job_posting_id: UUID
    cover_letter: Optional[str] = None
    current_stage: Optional[str] = "applied"
    rating: Optional[int] = None
    owner_user_id: Optional[UUID] = None


class StageMove(BaseModel):
    stage: str
    rejection_reason: Optional[str] = None
    rating: Optional[int] = None


@router.get("/applications")
async def list_applications(
    job_id: Optional[UUID] = None,
    stage: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await ApplicationRepo(db).list(vu.vendor_id, job_id=job_id, stage=stage)
    return [_d(a) for a in items]


@router.get("/applications/{aid}")
async def get_application(
    aid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    a = await ApplicationRepo(db).get(aid, vu.vendor_id)
    if not a:
        raise HTTPException(404, "Application not found")
    rounds = await InterviewRepo(db).list_for_application(aid, vu.vendor_id)
    return {**_d(a), "interviews": [_d(r) for r in rounds]}


@router.post("/applications", status_code=201)
async def create_application(
    body: AppIn,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    a = await ApplicationRepo(db).create(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(a)


@router.post("/applications/{aid}/move-stage")
async def move_stage(
    aid: UUID,
    body: StageMove,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    a = await ApplicationRepo(db).get(aid, vu.vendor_id)
    if not a:
        raise HTTPException(404, "Application not found")
    valid = {"applied", "screening", "shortlisted", "interviewing", "offer_made", "hired", "rejected", "withdrawn"}
    if body.stage not in valid:
        raise HTTPException(400, f"Invalid stage. Allowed: {sorted(valid)}")
    data = {"current_stage": body.stage}
    if body.rating is not None:
        data["rating"] = body.rating
    if body.stage == "rejected" and body.rejection_reason:
        data["rejection_reason"] = body.rejection_reason
    a = await ApplicationRepo(db).update(a, data)
    await AuditRepo(db).log(vu.vendor_id, "update", "job_application", a.id,
                             summary=f"Moved to '{body.stage}'", actor_user_id=vu.id)
    cand = await CandidateRepo(db).get(a.candidate_id, vu.vendor_id) if a.candidate_id else None
    cand_name = (cand.full_name if cand else "Candidate")
    await NotificationService(db).notify_application_stage(vu.vendor_id, a.id, cand_name, body.stage)
    await db.commit()
    return _d(a)


@router.delete("/applications/{aid}", status_code=204)
async def delete_application(
    aid: UUID,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    a = await ApplicationRepo(db).get(aid, vu.vendor_id)
    if not a:
        raise HTTPException(404, "Application not found")
    await ApplicationRepo(db).delete(a)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# RECRUITMENT — Interviews
# ═══════════════════════════════════════════════════════════════════

class InterviewIn(BaseModel):
    application_id: UUID
    round_number: Optional[int] = 1
    round_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_min: Optional[int] = 45
    mode: Optional[str] = "video"
    location_or_link: Optional[str] = None
    interviewer_user_ids: Optional[List[UUID]] = None
    status: Optional[str] = "scheduled"
    rating: Optional[int] = None
    feedback: Optional[str] = None
    recommendation: Optional[str] = None


@router.get("/interviews")
async def list_interviews(
    upcoming: bool = True,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    if upcoming:
        items = await InterviewRepo(db).list_upcoming(vu.vendor_id)
    else:
        r = await db.execute(
            select(InterviewRound).where(InterviewRound.vendor_id == vu.vendor_id)
            .options(selectinload(InterviewRound.application).selectinload(JobApplication.candidate))
            .order_by(InterviewRound.scheduled_at.desc())
        )
        items = list(r.scalars().all())
    return [_d(i) for i in items]


@router.post("/interviews", status_code=201)
async def create_interview(
    body: InterviewIn,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_none=True)
    if data.get("interviewer_user_ids"):
        data["interviewer_user_ids"] = [str(x) for x in data["interviewer_user_ids"]]
    item = await InterviewRepo(db).create(vu.vendor_id, data)
    cand_name = "Candidate"
    try:
        app_obj = await ApplicationRepo(db).get(item.application_id, vu.vendor_id)
        if app_obj and app_obj.candidate_id:
            c = await CandidateRepo(db).get(app_obj.candidate_id, vu.vendor_id)
            if c:
                cand_name = c.full_name
    except Exception:
        pass
    if item.scheduled_at:
        await NotificationService(db).notify_interview_scheduled(
            vu.vendor_id, item.application_id, item.scheduled_at, cand_name,
        )
    await db.commit()
    return _d(item)


@router.put("/interviews/{iid}")
async def update_interview(
    iid: UUID,
    body: InterviewIn,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    item = await InterviewRepo(db).get(iid, vu.vendor_id)
    if not item:
        raise HTTPException(404, "Interview not found")
    data = body.model_dump(exclude_none=True)
    if data.get("interviewer_user_ids"):
        data["interviewer_user_ids"] = [str(x) for x in data["interviewer_user_ids"]]
    item = await InterviewRepo(db).update(item, data)
    await db.commit()
    return _d(item)


@router.delete("/interviews/{iid}", status_code=204)
async def delete_interview(
    iid: UUID,
    vu: VendorUser = Depends(require_permission("hr.recruitment")),
    db: AsyncSession = Depends(get_db),
):
    item = await InterviewRepo(db).get(iid, vu.vendor_id)
    if not item:
        raise HTTPException(404, "Interview not found")
    await InterviewRepo(db).delete(item)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# ONBOARDING — Templates & Checklists
# ═══════════════════════════════════════════════════════════════════

class TplItemIn(BaseModel):
    sequence: Optional[int] = 0
    title: str
    description: Optional[str] = None
    category: Optional[str] = "general"
    default_due_offset_days: Optional[int] = 7
    default_assignee_role: Optional[str] = None


class OnboardingTplIn(BaseModel):
    name: str
    description: Optional[str] = None
    designation_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    is_default: Optional[bool] = False
    items: Optional[List[TplItemIn]] = []


@router.get("/onboarding/templates")
async def list_onb_templates(
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await OnboardingTemplateRepo(db).list(vu.vendor_id)
    return [_d(i) for i in items]


@router.post("/onboarding/templates", status_code=201)
async def create_onb_template(
    body: OnboardingTplIn,
    vu: VendorUser = Depends(require_permission("hr.onboarding")),
    db: AsyncSession = Depends(get_db),
):
    items = [it.model_dump(exclude_none=True) for it in (body.items or [])]
    head = body.model_dump(exclude={"items"}, exclude_none=True)
    t = await OnboardingTemplateRepo(db).create(vu.vendor_id, head, items)
    await db.commit()
    return _d(t)


@router.get("/onboarding/templates/{tid}")
async def get_onb_template(
    tid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    t = await OnboardingTemplateRepo(db).get(tid, vu.vendor_id)
    if not t:
        raise HTTPException(404, "Template not found")
    return _d(t)


@router.put("/onboarding/templates/{tid}")
async def update_onb_template(
    tid: UUID,
    body: OnboardingTplIn,
    vu: VendorUser = Depends(require_permission("hr.onboarding")),
    db: AsyncSession = Depends(get_db),
):
    items = [it.model_dump(exclude_none=True) for it in (body.items or [])] if body.items is not None else None
    head = body.model_dump(exclude={"items"}, exclude_none=True)
    t = await OnboardingTemplateRepo(db).update(tid, vu.vendor_id, head, items)
    if not t:
        raise HTTPException(404, "Template not found")
    await db.commit()
    return _d(t)


@router.delete("/onboarding/templates/{tid}", status_code=204)
async def delete_onb_template(
    tid: UUID,
    vu: VendorUser = Depends(require_permission("hr.onboarding")),
    db: AsyncSession = Depends(get_db),
):
    t = await OnboardingTemplateRepo(db).get(tid, vu.vendor_id)
    if not t:
        raise HTTPException(404, "Template not found")
    await OnboardingTemplateRepo(db).delete(t)
    await db.commit()


class ChecklistIn(BaseModel):
    employee_id: UUID
    template_id: Optional[UUID] = None
    target_completion_date: Optional[date] = None
    extra_tasks: Optional[List[Dict[str, Any]]] = None  # additional ad-hoc tasks


@router.get("/onboarding/checklists")
async def list_checklists(
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await OnboardingChecklistRepo(db).list(vu.vendor_id, status=status)
    return [_d(i) for i in items]


@router.post("/onboarding/checklists", status_code=201)
async def create_checklist(
    body: ChecklistIn,
    vu: VendorUser = Depends(require_permission("hr.onboarding")),
    db: AsyncSession = Depends(get_db),
):
    tasks: List[dict] = []
    if body.template_id:
        t = await OnboardingTemplateRepo(db).get(body.template_id, vu.vendor_id)
        if t:
            for i, it in enumerate(t.items):
                due = (date.today() + timedelta(days=int(it.default_due_offset_days or 0))) if it.default_due_offset_days is not None else None
                tasks.append({
                    "sequence": i,
                    "title": it.title,
                    "description": it.description,
                    "category": it.category,
                    "due_date": due,
                })
    for i, et in enumerate(body.extra_tasks or [], start=len(tasks)):
        tasks.append({"sequence": i, **et})
    c = await OnboardingChecklistRepo(db).create(
        vu.vendor_id,
        {
            "employee_id": body.employee_id,
            "template_id": body.template_id,
            "target_completion_date": body.target_completion_date,
        },
        tasks,
    )
    await db.commit()
    return _d(c)


@router.get("/onboarding/checklists/{cid}")
async def get_checklist(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    c = await OnboardingChecklistRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Checklist not found")
    return _d(c)


class TaskUpdateIn(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    attachment_url: Optional[str] = None
    assignee_user_id: Optional[UUID] = None
    due_date: Optional[date] = None


@router.put("/onboarding/tasks/{task_id}")
async def update_task(
    task_id: UUID,
    body: TaskUpdateIn,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    repo = OnboardingChecklistRepo(db)
    t = await repo.update_task(task_id, body.model_dump(exclude_none=True))
    if not t:
        raise HTTPException(404, "Task not found")
    await repo.maybe_complete(t.checklist_id)
    await db.commit()
    return _d(t)


@router.get("/onboarding/my-checklist")
async def my_checklist(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(404, "Employee profile not found for current user")
    c = await OnboardingChecklistRepo(db).get_for_employee(emp.id, vu.vendor_id)
    return _d(c) if c else None


# ═══════════════════════════════════════════════════════════════════
# PERFORMANCE — Cycles
# ═══════════════════════════════════════════════════════════════════

class CycleIn(BaseModel):
    name: str
    description: Optional[str] = None
    period_start: date
    period_end: date
    review_type: Optional[str] = "annual"
    rating_scale_max: Optional[int] = 5
    self_review_required: Optional[bool] = True
    manager_review_required: Optional[bool] = True
    peer_review_count: Optional[int] = 0
    enable_kpi_scoring: Optional[bool] = True
    kpi_template: Optional[List[Dict[str, Any]]] = None
    closes_at: Optional[datetime] = None


@router.get("/perf/cycles")
async def list_cycles(
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await CycleRepo(db).list(vu.vendor_id)
    return [_d(i) for i in items]


@router.get("/perf/cycles/{cid}")
async def get_cycle(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    c = await CycleRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Cycle not found")
    return _d(c)


@router.post("/perf/cycles", status_code=201)
async def create_cycle(
    body: CycleIn,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    c = await CycleRepo(db).create(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(c)


@router.put("/perf/cycles/{cid}")
async def update_cycle(
    cid: UUID,
    body: CycleIn,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    c = await CycleRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Cycle not found")
    c = await CycleRepo(db).update(c, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(c)


@router.post("/perf/cycles/{cid}/launch")
async def launch_cycle(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    """Launch a review cycle: creates draft PerformanceReview records for every active employee."""
    c = await CycleRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Cycle not found")
    if c.status == "launched":
        return _d(c)
    # auto-create reviews for every active employee
    r = await db.execute(
        select(EmployeeProfile).where(
            EmployeeProfile.vendor_id == vu.vendor_id,
            EmployeeProfile.is_active == True,  # noqa
        )
    )
    employees = list(r.scalars().all())
    review_repo = ReviewRepo(db)
    for emp in employees:
        # check if already exists
        ex = await db.execute(
            select(PerformanceReview).where(
                PerformanceReview.cycle_id == c.id,
                PerformanceReview.employee_id == emp.id,
            )
        )
        if ex.scalar_one_or_none():
            continue
        initial_status = "self_pending" if c.self_review_required else "manager_pending"
        await review_repo.create(vu.vendor_id, {
            "cycle_id": c.id,
            "employee_id": emp.id,
            "status": initial_status,
        })
    c.status = "launched"
    c.launched_at = datetime.utcnow()
    await db.flush()
    await NotificationService(db).notify_hr_event(
        vendor_id=vu.vendor_id,
        title="Performance Cycle Launched",
        message=f"'{c.name}' is now active for {len(employees)} employee(s).",
        notif_type="hr.performance",
        reference_id=str(c.id),
        reference_type="review_cycle",
    )
    await db.commit()
    return _d(c)


@router.post("/perf/cycles/{cid}/close")
async def close_cycle(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    c = await CycleRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Cycle not found")
    c.status = "closed"
    c.closed_at = datetime.utcnow()
    await db.flush()
    await db.commit()
    return _d(c)


@router.delete("/perf/cycles/{cid}", status_code=204)
async def delete_cycle(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    c = await CycleRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Cycle not found")
    await CycleRepo(db).delete(c)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# PERFORMANCE — Goals
# ═══════════════════════════════════════════════════════════════════

class GoalIn(BaseModel):
    employee_id: UUID
    cycle_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    target_value: Optional[str] = None
    weight: Optional[float] = 10
    progress_pct: Optional[int] = 0
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    status: Optional[str] = "active"


@router.get("/perf/goals")
async def list_goals(
    employee_id: Optional[UUID] = None,
    cycle_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await GoalRepo(db).list(vu.vendor_id, employee_id=employee_id, cycle_id=cycle_id)
    return [_d(i) for i in items]


@router.post("/perf/goals", status_code=201)
async def create_goal(
    body: GoalIn,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    g = await GoalRepo(db).create(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(g)


@router.put("/perf/goals/{gid}")
async def update_goal(
    gid: UUID,
    body: GoalIn,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    g = await GoalRepo(db).get(gid, vu.vendor_id)
    if not g:
        raise HTTPException(404, "Goal not found")
    g = await GoalRepo(db).update(g, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(g)


@router.delete("/perf/goals/{gid}", status_code=204)
async def delete_goal(
    gid: UUID,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    g = await GoalRepo(db).get(gid, vu.vendor_id)
    if not g:
        raise HTTPException(404, "Goal not found")
    await GoalRepo(db).delete(g)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# PERFORMANCE — Reviews
# ═══════════════════════════════════════════════════════════════════

class ReviewSelfIn(BaseModel):
    self_assessment: Optional[str] = None
    self_rating: Optional[float] = None
    kpi_self_scores: Optional[List[Dict[str, Any]]] = None  # [{kpi_key, label, weight, self_score}]


class ReviewManagerIn(BaseModel):
    manager_comments: Optional[str] = None
    overall_rating: Optional[float] = None
    strengths: Optional[str] = None
    improvement_areas: Optional[str] = None
    promotion_recommended: Optional[bool] = None
    salary_change_suggestion_pct: Optional[float] = None
    kpi_manager_scores: Optional[List[Dict[str, Any]]] = None


@router.get("/perf/reviews")
async def list_reviews(
    cycle_id: Optional[UUID] = None,
    employee_id: Optional[UUID] = None,
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await ReviewRepo(db).list(vu.vendor_id, cycle_id=cycle_id,
                                       employee_id=employee_id, status=status)
    return [_d(i) for i in items]


@router.get("/perf/reviews/{rid}")
async def get_review(
    rid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    r = await ReviewRepo(db).get(rid, vu.vendor_id)
    if not r:
        raise HTTPException(404, "Review not found")
    return _d(r)


@router.put("/perf/reviews/{rid}/self")
async def submit_self_review(
    rid: UUID,
    body: ReviewSelfIn,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    r = await ReviewRepo(db).get(rid, vu.vendor_id)
    if not r:
        raise HTTPException(404, "Review not found")
    data: Dict[str, Any] = {
        "self_assessment": body.self_assessment,
        "self_rating": body.self_rating,
        "self_submitted_at": datetime.utcnow(),
    }
    if r.status in ("self_pending", "draft"):
        data["status"] = "manager_pending"
    r = await ReviewRepo(db).update(r, {k: v for k, v in data.items() if v is not None})
    if body.kpi_self_scores:
        # merge by kpi_key
        existing = {s.kpi_key: s for s in r.kpi_scores}
        scores_to_save = []
        for s in body.kpi_self_scores:
            ex = existing.get(s.get("kpi_key"))
            scores_to_save.append({
                "kpi_key": s.get("kpi_key"),
                "label": s.get("label") or (ex.label if ex else None),
                "weight": s.get("weight") or (float(ex.weight) if ex and ex.weight else 10),
                "self_score": s.get("self_score"),
                "manager_score": ex.manager_score if ex else None,
                "comments": s.get("comments") or (ex.comments if ex else None),
            })
        await ReviewRepo(db).upsert_kpi_scores(rid, scores_to_save)
    await db.commit()
    return _d(await ReviewRepo(db).get(rid, vu.vendor_id))


@router.put("/perf/reviews/{rid}/manager")
async def submit_manager_review(
    rid: UUID,
    body: ReviewManagerIn,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    r = await ReviewRepo(db).get(rid, vu.vendor_id)
    if not r:
        raise HTTPException(404, "Review not found")
    data: Dict[str, Any] = body.model_dump(exclude={"kpi_manager_scores"}, exclude_none=True)
    data["manager_submitted_at"] = datetime.utcnow()
    data["status"] = "acknowledged" if r.status == "acknowledged" else "manager_submitted"
    if not data.get("reviewer_user_id"):
        data["reviewer_user_id"] = vu.id
    r = await ReviewRepo(db).update(r, data)
    if body.kpi_manager_scores:
        existing = {s.kpi_key: s for s in r.kpi_scores}
        scores_to_save = []
        for s in body.kpi_manager_scores:
            ex = existing.get(s.get("kpi_key"))
            scores_to_save.append({
                "kpi_key": s.get("kpi_key"),
                "label": s.get("label") or (ex.label if ex else None),
                "weight": s.get("weight") or (float(ex.weight) if ex and ex.weight else 10),
                "self_score": ex.self_score if ex else None,
                "manager_score": s.get("manager_score"),
                "comments": s.get("comments") or (ex.comments if ex else None),
            })
        await ReviewRepo(db).upsert_kpi_scores(rid, scores_to_save)
    await db.commit()
    return _d(await ReviewRepo(db).get(rid, vu.vendor_id))


@router.put("/perf/reviews/{rid}/acknowledge")
async def acknowledge_review(
    rid: UUID,
    body: Dict[str, Any],
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    r = await ReviewRepo(db).get(rid, vu.vendor_id)
    if not r:
        raise HTTPException(404, "Review not found")
    r = await ReviewRepo(db).update(r, {
        "employee_acknowledgement": body.get("note"),
        "acknowledged_at": datetime.utcnow(),
        "status": "acknowledged",
    })
    await db.commit()
    return _d(r)


@router.get("/perf/me")
async def my_performance(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return {"reviews": [], "goals": [], "feedback": []}
    revs = await ReviewRepo(db).list(vu.vendor_id, employee_id=emp.id)
    goals = await GoalRepo(db).list(vu.vendor_id, employee_id=emp.id)
    fb = await FeedbackRepo(db).list(vu.vendor_id, employee_id=emp.id)
    return {
        "reviews": [_d(r) for r in revs],
        "goals": [_d(g) for g in goals],
        "feedback": [_d(f) for f in fb],
    }


# ═══════════════════════════════════════════════════════════════════
# PERFORMANCE — Feedback
# ═══════════════════════════════════════════════════════════════════

class FeedbackIn(BaseModel):
    to_employee_id: UUID
    feedback_type: Optional[str] = "praise"
    visibility: Optional[str] = "private"
    title: Optional[str] = None
    body: str
    related_competency: Optional[str] = None


@router.get("/perf/feedback")
async def list_feedback(
    employee_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await FeedbackRepo(db).list(vu.vendor_id, employee_id=employee_id)
    return [_d(i) for i in items]


@router.post("/perf/feedback", status_code=201)
async def create_feedback(
    body: FeedbackIn,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_none=True)
    data["from_user_id"] = vu.id
    f = await FeedbackRepo(db).create(vu.vendor_id, data)
    await db.commit()
    return _d(f)


@router.delete("/perf/feedback/{fid}", status_code=204)
async def delete_feedback(
    fid: UUID,
    vu: VendorUser = Depends(require_permission("hr.performance")),
    db: AsyncSession = Depends(get_db),
):
    ok = await FeedbackRepo(db).delete(fid, vu.vendor_id)
    if not ok:
        raise HTTPException(404, "Feedback not found")
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# COMPLIANCE — Policies
# ═══════════════════════════════════════════════════════════════════

class PolicyIn(BaseModel):
    title: str
    category: Optional[str] = None
    summary: Optional[str] = None
    body: Optional[str] = None
    status: Optional[str] = "draft"
    effective_from: Optional[date] = None
    expires_on: Optional[date] = None
    requires_acknowledgement: Optional[bool] = True
    audience: Optional[str] = "all"
    audience_filter: Optional[Dict[str, Any]] = None
    attachment_url: Optional[str] = None


@router.get("/policies")
async def list_policies(
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await PolicyRepo(db).list(vu.vendor_id, status=status)
    return [_d(i) for i in items]


@router.get("/policies/{pid}")
async def get_policy(
    pid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    p = await PolicyRepo(db).get(pid, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    return _d(p)


@router.post("/policies", status_code=201)
async def create_policy(
    body: PolicyIn,
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    p = await PolicyRepo(db).create(vu.vendor_id, body.model_dump(exclude_none=True))
    await AuditRepo(db).log(vu.vendor_id, "create", "policy", p.id,
                             summary=f"Created policy '{p.title}'", actor_user_id=vu.id)
    await db.commit()
    return _d(p)


@router.put("/policies/{pid}")
async def update_policy(
    pid: UUID,
    body: PolicyIn,
    bump_version: bool = False,
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    p = await PolicyRepo(db).get(pid, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    p = await PolicyRepo(db).update(p, body.model_dump(exclude_none=True), bump_version=bump_version)
    await AuditRepo(db).log(vu.vendor_id, "update", "policy", p.id,
                             summary=f"Updated policy '{p.title}' (v{p.version})", actor_user_id=vu.id)
    await db.commit()
    return _d(p)


@router.post("/policies/{pid}/publish")
async def publish_policy(
    pid: UUID,
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    p = await PolicyRepo(db).get(pid, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    p.status = "published"
    p.published_at = datetime.utcnow()
    p.published_by = vu.id
    await db.flush()
    await AuditRepo(db).log(vu.vendor_id, "publish", "policy", p.id,
                             summary=f"Published '{p.title}' v{p.version}", actor_user_id=vu.id)
    await NotificationService(db).notify_policy_published(vu.vendor_id, p.id, p.title)
    await db.commit()
    return _d(p)


@router.delete("/policies/{pid}", status_code=204)
async def delete_policy(
    pid: UUID,
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    p = await PolicyRepo(db).get(pid, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    await PolicyRepo(db).delete(p)
    await db.commit()


@router.post("/policies/{pid}/acknowledge")
async def acknowledge_policy(
    pid: UUID,
    request: Request,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    p = await PolicyRepo(db).get(pid, vu.vendor_id)
    if not p or p.status != "published":
        raise HTTPException(404, "Policy not available")
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(400, "Only employees can acknowledge")
    ip = request.client.host if request.client else None
    ack = await PolicyRepo(db).acknowledge(p.id, emp.id, p.version, ip=ip)
    await AuditRepo(db).log(vu.vendor_id, "acknowledge", "policy", p.id,
                             summary=f"Acknowledged v{p.version}", actor_user_id=vu.id)
    await db.commit()
    return _d(ack)


@router.get("/policies/me/pending")
async def my_pending_policies(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return []
    items = await PolicyRepo(db).my_pending(vu.vendor_id, emp.id)
    return [_d(p) for p in items]


# ═══════════════════════════════════════════════════════════════════
# COMPLIANCE — Certifications
# ═══════════════════════════════════════════════════════════════════

class CertIn(BaseModel):
    employee_id: UUID
    name: str
    type: Optional[str] = None
    issued_by: Optional[str] = None
    cert_number: Optional[str] = None
    issued_on: Optional[date] = None
    expires_on: Optional[date] = None
    document_url: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "active"


@router.get("/certifications")
async def list_certifications(
    employee_id: Optional[UUID] = None,
    expiring_within_days: Optional[int] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await CertificationRepo(db).list(
        vu.vendor_id, employee_id=employee_id, expiring_within_days=expiring_within_days
    )
    return [_d(i) for i in items]


@router.post("/certifications", status_code=201)
async def create_cert(
    body: CertIn,
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    c = await CertificationRepo(db).create(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(c)


@router.put("/certifications/{cid}")
async def update_cert(
    cid: UUID,
    body: CertIn,
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    c = await CertificationRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Certification not found")
    c = await CertificationRepo(db).update(c, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(c)


@router.delete("/certifications/{cid}", status_code=204)
async def delete_cert(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    c = await CertificationRepo(db).get(cid, vu.vendor_id)
    if not c:
        raise HTTPException(404, "Certification not found")
    await CertificationRepo(db).delete(c)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# COMPLIANCE — Audit log
# ═══════════════════════════════════════════════════════════════════

@router.get("/audit-logs")
async def list_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    limit: int = Query(200, le=1000),
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    items = await AuditRepo(db).list(vu.vendor_id, entity_type=entity_type,
                                      entity_id=entity_id, limit=limit)
    return [_d(i) for i in items]


@router.get("/audit-logs/export-csv")
async def export_audit_csv(
    vu: VendorUser = Depends(require_permission("hr.compliance")),
    db: AsyncSession = Depends(get_db),
):
    import csv, io
    items = await AuditRepo(db).list(vu.vendor_id, limit=5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["When", "Actor", "Action", "Entity Type", "Entity ID", "Summary"])
    for it in items:
        w.writerow([
            it.created_at.isoformat() if it.created_at else "",
            it.actor_label or (str(it.actor_user_id) if it.actor_user_id else ""),
            it.action, it.entity_type,
            str(it.entity_id) if it.entity_id else "",
            it.summary or "",
        ])
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="hr-audit-logs.csv"'},
    )


# ═══════════════════════════════════════════════════════════════════
# TRAINING — Programs / Courses / Quizzes
# ═══════════════════════════════════════════════════════════════════

class ProgramIn(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_mandatory: Optional[bool] = False
    target_audience: Optional[str] = "all"
    audience_filter: Optional[Dict[str, Any]] = None
    estimated_hours: Optional[float] = None
    issues_certificate: Optional[bool] = True
    status: Optional[str] = "draft"


@router.get("/training/programs")
async def list_programs(
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await TrainingRepo(db).list_programs(vu.vendor_id, status=status)
    return [_d(i) for i in items]


@router.get("/training/programs/{pid}")
async def get_program(
    pid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    p = await TrainingRepo(db).get_program(pid, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Program not found")
    return _d(p)


@router.post("/training/programs", status_code=201)
async def create_program(
    body: ProgramIn,
    vu: VendorUser = Depends(require_permission("hr.training")),
    db: AsyncSession = Depends(get_db),
):
    p = await TrainingRepo(db).create_program(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(p)


@router.put("/training/programs/{pid}")
async def update_program(
    pid: UUID,
    body: ProgramIn,
    vu: VendorUser = Depends(require_permission("hr.training")),
    db: AsyncSession = Depends(get_db),
):
    p = await TrainingRepo(db).get_program(pid, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Program not found")
    p = await TrainingRepo(db).update_program(p, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(p)


@router.delete("/training/programs/{pid}", status_code=204)
async def delete_program(
    pid: UUID,
    vu: VendorUser = Depends(require_permission("hr.training")),
    db: AsyncSession = Depends(get_db),
):
    p = await TrainingRepo(db).get_program(pid, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Program not found")
    await TrainingRepo(db).delete_program(p)
    await db.commit()


class QuestionIn(BaseModel):
    sequence: Optional[int] = 0
    question: str
    question_type: Optional[str] = "single"
    options: Optional[List[Dict[str, Any]]] = None
    explanation: Optional[str] = None
    points: Optional[int] = 1


class CourseIn(BaseModel):
    sequence: Optional[int] = 0
    title: str
    content_type: Optional[str] = "text"
    content_url: Optional[str] = None
    body_html: Optional[str] = None
    duration_min: Optional[int] = None
    pass_score_pct: Optional[int] = 70
    is_required: Optional[bool] = True
    questions: Optional[List[QuestionIn]] = None


@router.post("/training/programs/{pid}/courses", status_code=201)
async def create_course(
    pid: UUID,
    body: CourseIn,
    vu: VendorUser = Depends(require_permission("hr.training")),
    db: AsyncSession = Depends(get_db),
):
    p = await TrainingRepo(db).get_program(pid, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Program not found")
    questions = [q.model_dump(exclude_none=True) for q in (body.questions or [])]
    head = body.model_dump(exclude={"questions"}, exclude_none=True)
    c = await TrainingRepo(db).create_course(p.id, head, questions)
    await db.commit()
    return _d(c)


@router.put("/training/courses/{cid}")
async def update_course(
    cid: UUID,
    body: CourseIn,
    vu: VendorUser = Depends(require_permission("hr.training")),
    db: AsyncSession = Depends(get_db),
):
    questions = [q.model_dump(exclude_none=True) for q in body.questions] if body.questions is not None else None
    head = body.model_dump(exclude={"questions"}, exclude_none=True)
    c = await TrainingRepo(db).update_course(cid, head, questions)
    if not c:
        raise HTTPException(404, "Course not found")
    await db.commit()
    return _d(c)


@router.delete("/training/courses/{cid}", status_code=204)
async def delete_course(
    cid: UUID,
    vu: VendorUser = Depends(require_permission("hr.training")),
    db: AsyncSession = Depends(get_db),
):
    c = await TrainingRepo(db).get_course(cid)
    if not c:
        raise HTTPException(404, "Course not found")
    await TrainingRepo(db).delete_course(c)
    await db.commit()


# Enrollments
class EnrollIn(BaseModel):
    program_id: UUID
    employee_ids: List[UUID]
    due_date: Optional[date] = None


@router.post("/training/enroll", status_code=201)
async def bulk_enroll(
    body: EnrollIn,
    vu: VendorUser = Depends(require_permission("hr.training")),
    db: AsyncSession = Depends(get_db),
):
    repo = TrainingRepo(db)
    program = await repo.get_program(body.program_id, vu.vendor_id)
    out = []
    notif = NotificationService(db)
    for emp_id in body.employee_ids:
        e = await repo.enroll(vu.vendor_id, body.program_id, emp_id, body.due_date)
        out.append(_d(e))
        if program:
            await notif.notify_training_enrolled(vu.vendor_id, e.id, program.name)
    await db.commit()
    return out


@router.get("/training/enrollments")
async def list_enrollments(
    program_id: Optional[UUID] = None,
    employee_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await TrainingRepo(db).list_enrollments(vu.vendor_id, program_id=program_id, employee_id=employee_id)
    return [_d(i) for i in items]


@router.get("/training/enrollments/{eid}")
async def get_enrollment(
    eid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    e = await TrainingRepo(db).get_enrollment(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Enrollment not found")
    completions = await TrainingRepo(db).list_completions(eid)
    return {**_d(e), "completions": [_d(c) for c in completions]}


class CompletionIn(BaseModel):
    course_id: UUID
    score_pct: Optional[int] = None
    passed: Optional[bool] = True
    answers: Optional[Dict[str, Any]] = None


@router.post("/training/enrollments/{eid}/complete-course")
async def complete_course(
    eid: UUID,
    body: CompletionIn,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    e = await TrainingRepo(db).get_enrollment(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Enrollment not found")
    course = await TrainingRepo(db).get_course(body.course_id)
    if not course:
        raise HTTPException(404, "Course not found")
    # auto-score quizzes
    score_pct = body.score_pct
    passed = body.passed if body.passed is not None else True
    if course.questions and body.answers:
        correct_total = 0
        correct = 0
        for q in course.questions:
            correct_total += int(q.points or 1)
            ans = body.answers.get(str(q.id))
            if ans is None:
                continue
            correct_options = {o.get("id") for o in (q.options or []) if o.get("is_correct")}
            given = set(ans) if isinstance(ans, list) else {ans}
            if given == correct_options and correct_options:
                correct += int(q.points or 1)
        score_pct = int(round(100 * correct / correct_total)) if correct_total else 100
        passed = score_pct >= int(course.pass_score_pct or 70)
    await TrainingRepo(db).upsert_completion(
        eid, body.course_id, score_pct=score_pct, passed=passed, answers=body.answers,
    )
    enr = await TrainingRepo(db).recalc_progress(eid)
    # issue cert if completed & program issues
    if enr.status == "completed":
        program = await TrainingRepo(db).get_program(enr.program_id, vu.vendor_id)
        if program and program.issues_certificate:
            # need employee name
            r2 = await db.execute(
                select(EmployeeProfile).where(EmployeeProfile.id == enr.employee_id)
                .options(selectinload(EmployeeProfile.vendor_user).selectinload(VendorUser.user))
            )
            emp = r2.scalar_one_or_none()
            name = emp.vendor_user.user.full_name if emp and emp.vendor_user and emp.vendor_user.user else "Employee"
            cert = await TrainingRepo(db).issue_certificate(vu.vendor_id, enr.id, program.name, name)
            enr.certificate_url = f"/api/v1/vendors/me/hr/training/certificates/{cert.id}/download"
            await db.flush()
    await db.commit()
    return _d(enr)


@router.get("/training/me")
async def my_training(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return []
    items = await TrainingRepo(db).list_enrollments(vu.vendor_id, employee_id=emp.id)
    return [_d(i) for i in items]


@router.get("/training/certificates/{cid}/download")
async def download_certificate(
    cid: UUID,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(TrainingCertificate).where(
            TrainingCertificate.id == cid, TrainingCertificate.vendor_id == vu.vendor_id
        )
    )
    cert = r.scalar_one_or_none()
    if not cert:
        raise HTTPException(404, "Certificate not found")
    return HTMLResponse(content=cert.download_html or "<p>Certificate body missing</p>", status_code=200)


# ═══════════════════════════════════════════════════════════════════
# ESS — Profile aggregator
# ═══════════════════════════════════════════════════════════════════

@router.get("/ess/me/profile")
async def my_ess_profile(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """Unified ESS dashboard data: profile, leave balances, holidays, announcements,
    pending policies, training, and ticket/expense summary."""
    emp = await _current_employee(db, vu)
    if not emp:
        return {"employee": None}

    # eager-load relevant nested
    r = await db.execute(
        select(EmployeeProfile).where(EmployeeProfile.id == emp.id)
        .options(
            selectinload(EmployeeProfile.vendor_user).selectinload(VendorUser.user),
            selectinload(EmployeeProfile.department),
            selectinload(EmployeeProfile.designation),
        )
    )
    emp = r.scalar_one()
    pending_policies = await PolicyRepo(db).my_pending(vu.vendor_id, emp.id)
    announcements = await AnnouncementRepo(db).list_for_employee(vu.vendor_id, emp.id)
    expenses = await ExpenseRepo(db).list(vu.vendor_id, employee_id=emp.id)
    tickets = await HelpdeskRepo(db).list(vu.vendor_id, employee_id=emp.id)
    enrollments = await TrainingRepo(db).list_enrollments(vu.vendor_id, employee_id=emp.id)
    return {
        "employee": _d(emp),
        "pending_policies": [_d(p) for p in pending_policies],
        "announcements": [_d(a) for a in announcements[:5]],
        "expense_summary": {
            "draft": sum(1 for x in expenses if x.status == "draft"),
            "submitted": sum(1 for x in expenses if x.status == "submitted"),
            "approved": sum(1 for x in expenses if x.status == "approved"),
        },
        "ticket_summary": {
            "open": sum(1 for t in tickets if t.status == "open"),
            "in_progress": sum(1 for t in tickets if t.status == "in_progress"),
            "resolved": sum(1 for t in tickets if t.status == "resolved"),
        },
        "training_summary": {
            "enrolled": sum(1 for e in enrollments if e.status in ("enrolled", "in_progress")),
            "completed": sum(1 for e in enrollments if e.status == "completed"),
            "overdue": sum(1 for e in enrollments if e.status == "overdue"),
        },
    }


# ESS — Announcements
class AnnouncementIn(BaseModel):
    title: str
    body: str
    category: Optional[str] = "general"
    audience: Optional[str] = "all"
    audience_filter: Optional[Dict[str, Any]] = None
    pinned: Optional[bool] = False
    cover_image_url: Optional[str] = None
    attachment_url: Optional[str] = None
    publish_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    status: Optional[str] = "draft"


@router.get("/ess/announcements")
async def list_announcements(
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await AnnouncementRepo(db).list(vu.vendor_id, status=status, include_expired=True)
    return [_d(i) for i in items]


@router.get("/ess/me/announcements")
async def my_announcements(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return []
    items = await AnnouncementRepo(db).list_for_employee(vu.vendor_id, emp.id)
    out = []
    for a in items:
        d = _d(a)
        d["read_by_me"] = any(r.employee_id == emp.id for r in (a.reads or []))
        out.append(d)
    return out


@router.post("/ess/announcements", status_code=201)
async def create_announcement(
    body: AnnouncementIn,
    vu: VendorUser = Depends(require_permission("hr.ess.admin")),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_none=True)
    data["published_by"] = vu.id
    if data.get("status") == "published" and not data.get("publish_at"):
        data["publish_at"] = datetime.utcnow()
    a = await AnnouncementRepo(db).create(vu.vendor_id, data)
    if a.status == "published":
        await NotificationService(db).notify_announcement(vu.vendor_id, a.id, a.title)
    await db.commit()
    return _d(a)


@router.put("/ess/announcements/{aid}")
async def update_announcement(
    aid: UUID,
    body: AnnouncementIn,
    vu: VendorUser = Depends(require_permission("hr.ess.admin")),
    db: AsyncSession = Depends(get_db),
):
    a = await AnnouncementRepo(db).get(aid, vu.vendor_id)
    if not a:
        raise HTTPException(404, "Announcement not found")
    a = await AnnouncementRepo(db).update(a, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(a)


@router.delete("/ess/announcements/{aid}", status_code=204)
async def delete_announcement(
    aid: UUID,
    vu: VendorUser = Depends(require_permission("hr.ess.admin")),
    db: AsyncSession = Depends(get_db),
):
    a = await AnnouncementRepo(db).get(aid, vu.vendor_id)
    if not a:
        raise HTTPException(404, "Announcement not found")
    await AnnouncementRepo(db).delete(a)
    await db.commit()


@router.post("/ess/announcements/{aid}/read", status_code=204)
async def mark_announcement_read(
    aid: UUID,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return
    await AnnouncementRepo(db).mark_read(aid, emp.id)
    await db.commit()


# ESS — Expenses
class ExpenseIn(BaseModel):
    title: str
    category: Optional[str] = None
    expense_date: Optional[date] = None
    currency: Optional[str] = "INR"
    amount: float
    description: Optional[str] = None
    receipts: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = "draft"


class ExpenseDecide(BaseModel):
    decision: str  # approved | rejected
    note: Optional[str] = None


@router.post("/ess/expenses/receipt")
async def upload_expense_receipt_vendor(
    file: UploadFile = File(...),
    vu: VendorUser = Depends(get_current_vendor_user),
):
    """Upload receipt / media for expense claims (vendor HR portal). No size cap in app."""
    from app.services.expense_receipt_upload import save_expense_receipt

    return await save_expense_receipt(file, vu.vendor_id)


@router.get("/ess/expenses")
async def list_expenses(
    status: Optional[str] = None,
    employee_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await ExpenseRepo(db).list(vu.vendor_id, status=status, employee_id=employee_id)
    return [_d(i) for i in items]


@router.get("/ess/me/expenses")
async def my_expenses(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return []
    items = await ExpenseRepo(db).list(vu.vendor_id, employee_id=emp.id)
    return [_d(i) for i in items]


@router.get("/ess/expenses/{eid}")
async def get_expense(
    eid: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    e = await ExpenseRepo(db).get(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    return _d(e)


@router.post("/ess/expenses", status_code=201)
async def create_expense(
    body: ExpenseIn,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(400, "Employee profile required to file claims")
    data = body.model_dump(exclude_none=True)
    data["employee_id"] = emp.id
    if data.get("status") == "submitted":
        data["submitted_at"] = datetime.utcnow()
    e = await ExpenseRepo(db).create(vu.vendor_id, data)
    await db.commit()
    return _d(e)


@router.put("/ess/expenses/{eid}")
async def update_expense(
    eid: UUID,
    body: ExpenseIn,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    e = await ExpenseRepo(db).get(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    if e.status not in ("draft", "submitted"):
        raise HTTPException(400, f"Cannot edit a {e.status} claim")
    data = body.model_dump(exclude_none=True)
    if data.get("status") == "submitted" and not e.submitted_at:
        data["submitted_at"] = datetime.utcnow()
    e = await ExpenseRepo(db).update(e, data)
    await db.commit()
    return _d(e)


@router.post("/ess/expenses/{eid}/decide")
async def decide_expense(
    eid: UUID,
    body: ExpenseDecide,
    vu: VendorUser = Depends(require_permission("hr.ess.admin")),
    db: AsyncSession = Depends(get_db),
):
    e = await ExpenseRepo(db).get(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(400, "Decision must be approved or rejected")
    if body.decision == "rejected" and not (body.note or "").strip():
        raise HTTPException(400, "Rejection reason is required")
    e = await ExpenseRepo(db).update(e, {
        "status": body.decision,
        "decided_at": datetime.utcnow(),
        "decision_note": body.note,
        "approver_user_id": vu.id,
    })
    await NotificationService(db).notify_expense_status(
        vu.vendor_id, e.id, e.claim_number or str(e.id)[:8], body.decision,
    )
    await db.commit()
    return _d(e)


@router.post("/ess/expenses/{eid}/mark-paid")
async def mark_expense_paid(
    eid: UUID,
    body: Dict[str, Any] = None,
    vu: VendorUser = Depends(require_permission("hr.ess.admin")),
    db: AsyncSession = Depends(get_db),
):
    e = await ExpenseRepo(db).get(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    if e.status != "approved":
        raise HTTPException(400, "Only approved expenses can be marked paid")
    body = body or {}
    e = await ExpenseRepo(db).update(e, {
        "status": "paid",
        "paid_at": datetime.utcnow(),
        "payment_reference": body.get("payment_reference"),
    })
    await NotificationService(db).notify_expense_status(
        vu.vendor_id, e.id, e.claim_number or str(e.id)[:8], "paid",
    )
    await db.commit()
    # Finance GL: post expense payment
    try:
        from app.services.finance.posting import post_event
        await post_event(db, vu.vendor_id, "expense", e.id, {
            "amount": float(e.amount or 0),
            "narration": f"Expense Claim {e.claim_number or str(e.id)[:8]}: {e.category or 'General'}",
        })
        await db.commit()
    except Exception:
        pass
    return _d(e)


@router.delete("/ess/expenses/{eid}", status_code=204)
async def delete_expense(
    eid: UUID,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    e = await ExpenseRepo(db).get(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    if e.status not in ("draft",):
        raise HTTPException(400, "Only draft claims can be deleted")
    await ExpenseRepo(db).delete(e)
    await db.commit()


# ESS — Helpdesk
class TicketIn(BaseModel):
    category: Optional[str] = "hr"
    subject: str
    description: Optional[str] = None
    priority: Optional[str] = "normal"
    is_anonymous: Optional[bool] = False
    attachment_url: Optional[str] = None


class TicketUpdateIn(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_user_id: Optional[UUID] = None


class TicketCommentIn(BaseModel):
    body: str
    is_internal: Optional[bool] = False
    attachment_url: Optional[str] = None


@router.get("/ess/tickets")
async def list_tickets(
    status: Optional[str] = None,
    assignee_user_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await HelpdeskRepo(db).list(vu.vendor_id, status=status, assignee_user_id=assignee_user_id)
    return [_d(i) for i in items]


@router.get("/ess/me/tickets")
async def my_tickets(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return []
    items = await HelpdeskRepo(db).list(vu.vendor_id, employee_id=emp.id)
    return [_d(i) for i in items]


@router.get("/ess/tickets/{tid}")
async def get_ticket(
    tid: UUID,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    t = await HelpdeskRepo(db).get(tid, vu.vendor_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    return _d(t)


@router.post("/ess/tickets", status_code=201)
async def create_ticket(
    body: TicketIn,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(400, "Employee profile required")
    data = body.model_dump(exclude_none=True)
    data["employee_id"] = emp.id
    t = await HelpdeskRepo(db).create(vu.vendor_id, data)
    await NotificationService(db).notify_ticket_event(
        vu.vendor_id, t.id, t.ticket_number or str(t.id)[:8], t.subject, "Created",
    )
    await db.commit()
    return _d(t)


@router.put("/ess/tickets/{tid}")
async def update_ticket(
    tid: UUID,
    body: TicketUpdateIn,
    vu: VendorUser = Depends(require_permission("hr.ess.admin")),
    db: AsyncSession = Depends(get_db),
):
    t = await HelpdeskRepo(db).get(tid, vu.vendor_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    t = await HelpdeskRepo(db).update(t, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(t)


@router.post("/ess/tickets/{tid}/comments", status_code=201)
async def add_ticket_comment(
    tid: UUID,
    body: TicketCommentIn,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    t = await HelpdeskRepo(db).get(tid, vu.vendor_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    is_staff = bool(t.assignee_user_id and t.assignee_user_id == vu.id) or "hr.ess.admin" in (vu.permissions or [])
    c = await HelpdeskRepo(db).add_comment(tid, {
        "author_user_id": vu.id,
        "body": body.body,
        "is_internal": bool(body.is_internal) and is_staff,
        "is_staff_reply": is_staff,
        "attachment_url": body.attachment_url,
    })
    # if open and replied to, advance status
    if t.status == "open" and is_staff:
        await HelpdeskRepo(db).update(t, {"status": "in_progress"})
    await NotificationService(db).notify_ticket_event(
        vu.vendor_id, t.id, t.ticket_number or str(t.id)[:8], t.subject,
        "Reply" if is_staff else "Comment",
    )
    await db.commit()
    return _d(c)


@router.delete("/ess/tickets/{tid}", status_code=204)
async def delete_ticket(
    tid: UUID,
    vu: VendorUser = Depends(require_permission("hr.ess.admin")),
    db: AsyncSession = Depends(get_db),
):
    t = await HelpdeskRepo(db).get(tid, vu.vendor_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    await HelpdeskRepo(db).delete(t)
    await db.commit()
