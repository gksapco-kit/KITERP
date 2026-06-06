"""
End-to-end HR scenario coverage.

Exercises the HR service layer and HR-extra repositories the vendor app exposes
against the in-memory SQLite harness from conftest.

Scenarios are grouped by HR module: org setup (departments/designations),
employees, attendance, leave, salary/payroll, offers, recruitment, onboarding,
performance, compliance, training, ESS, store HR login, plus tenant isolation.
"""

import uuid
from datetime import date, datetime, timedelta

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select

from app.models.hr import EmployeeProfile, LeavePolicy
from app.models.hr_performance import PerformanceReview
from app.models.vendor import Vendor
from app.models.user import User
from app.repositories.hr_compliance_repo import CertificationRepo, PolicyRepo
from app.repositories.hr_ess_repo import AnnouncementRepo, ExpenseRepo, HelpdeskRepo
from app.repositories.hr_performance_repo import CycleRepo, FeedbackRepo, GoalRepo, ReviewRepo
from app.repositories.hr_recruit_repo import (
    ApplicationRepo,
    CandidateRepo,
    InterviewRepo,
    JobRepo,
    OnboardingChecklistRepo,
    OnboardingTemplateRepo,
)
from app.repositories.hr_repo import LeaveRepo
from app.repositories.hr_training_repo import TrainingRepo
from app.services.hr_service import HRService


# ── Shared fixtures ──────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def vid(test_vendor: Vendor):
    return test_vendor.id


@pytest_asyncio.fixture
async def actor(test_user: User):
    return test_user.id


@pytest_asyncio.fixture
async def hr_employee(db_session, test_vendor: Vendor) -> EmployeeProfile:
    emp = EmployeeProfile(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        full_name="Scenario Employee",
        employee_code="HR-SC-001",
        personal_email="hr.scenario@test.local",
        status="active",
        is_active=True,
    )
    db_session.add(emp)
    await db_session.commit()
    await db_session.refresh(emp)
    return emp


@pytest_asyncio.fixture
async def leave_policy(db_session, test_vendor: Vendor) -> LeavePolicy:
    policy = LeavePolicy(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Annual Leave",
        code="AL",
        days_per_year=12,
        is_active=True,
    )
    db_session.add(policy)
    await db_session.commit()
    await db_session.refresh(policy)
    return policy


# ══════════════════════════════════════════════════════════════════════════════
# ORG SETUP — Departments & Designations
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_department_crud(db_session, vid):
    svc = HRService(db_session)
    dept = await svc.create_department(vid, {"name": "Engineering", "code": "ENG"})
    assert dept.name == "Engineering"

    depts = await svc.list_departments(vid)
    assert any(d.id == dept.id for d in depts)

    updated = await svc.update_department(dept.id, vid, {"name": "Product Engineering"})
    assert updated.name == "Product Engineering"

    await svc.delete_department(dept.id, vid)
    assert not any(d.id == dept.id for d in await svc.list_departments(vid))


@pytest.mark.asyncio
async def test_designation_crud(db_session, vid):
    svc = HRService(db_session)
    desig = await svc.create_designation(vid, {"name": "Software Engineer", "level": 3})
    assert desig.name == "Software Engineer"

    items = await svc.list_designations(vid)
    assert any(d.id == desig.id for d in items)

    updated = await svc.update_designation(desig.id, vid, {"level": 4})
    assert updated.level == 4

    await svc.delete_designation(desig.id, vid)
    assert not any(d.id == desig.id for d in await svc.list_designations(vid))


# ══════════════════════════════════════════════════════════════════════════════
# EMPLOYEES
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_employee_create_list_get_update(db_session, vid, hr_employee):
    svc = HRService(db_session)
    emp2 = await svc.create_employee(vid, {
        "full_name": "New Hire",
        "personal_email": "new.hire@test.local",
        "employee_code": "HR-SC-002",
        "status": "active",
        "is_active": True,
    })
    assert emp2.full_name == "New Hire"

    listing = await svc.list_employees(vid)
    assert listing["total"] >= 2

    fetched = await svc.get_employee(emp2.id, vid)
    assert fetched.employee_code.startswith("EMP-")

    updated = await svc.update_employee(emp2.id, vid, {"full_name": "Updated Hire"})
    assert updated.full_name == "Updated Hire"


@pytest.mark.asyncio
async def test_employee_requires_contact_without_portal(db_session, vid):
    svc = HRService(db_session)
    with pytest.raises(HTTPException) as exc:
        await svc.create_employee(vid, {"full_name": "No Contact"})
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_employee_tenant_isolation(db_session, test_vendor, hr_employee):
    other = Vendor(
        id=uuid.uuid4(),
        business_name="Other Co",
        display_name="Other Co",
        slug=f"other-{uuid.uuid4().hex[:6]}",
        business_type="retail",
        offering_type="products",
        primary_email="other@test.com",
        primary_phone="9999999999",
        subdomain=f"other-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db_session.add(other)
    await db_session.commit()

    svc = HRService(db_session)
    with pytest.raises(HTTPException) as exc:
        await svc.get_employee(hr_employee.id, other.id)
    assert exc.value.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_attendance_clock_in_and_out(db_session, hr_employee):
    svc = HRService(db_session)
    record = await svc.clock_in(hr_employee.id)
    assert record.clock_in is not None

    with pytest.raises(HTTPException) as exc:
        await svc.clock_in(hr_employee.id)
    assert "Already clocked in" in exc.value.detail

    out = await svc.clock_out(hr_employee.id)
    assert out.clock_out is not None
    assert out.work_hours is not None


@pytest.mark.asyncio
async def test_attendance_mark_and_list(db_session, vid, actor, hr_employee):
    svc = HRService(db_session)
    att_date = date(2026, 6, 3)
    rec = await svc.mark_attendance(vid, actor, hr_employee.id, att_date, "present", notes="Manual")
    assert rec.status == "present"

    listing = await svc.list_attendance(vid, employee_id=hr_employee.id, from_date=att_date, to_date=att_date)
    assert listing["total"] >= 1


# ══════════════════════════════════════════════════════════════════════════════
# LEAVE
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_leave_policy_and_holiday(db_session, vid):
    leave_repo = LeaveRepo(db_session)
    policy = await leave_repo.create_policy(vid, {
        "name": "Sick Leave", "code": "SL", "days_per_year": 6, "is_active": True,
    })
    assert policy.code == "SL"

    holiday = await leave_repo.create_holiday(vid, {
        "name": "Republic Day", "date": date(2026, 1, 26), "year": 2026,
    })
    holidays = await leave_repo.list_holidays(vid, 2026)
    assert any(h.id == holiday.id for h in holidays)


@pytest.mark.asyncio
async def test_leave_submit_approve_reject(db_session, vid, hr_employee, leave_policy, actor):
    svc = HRService(db_session)
    req = await svc.submit_leave_request(hr_employee.id, vid, {
        "leave_policy_id": leave_policy.id,
        "from_date": date(2026, 7, 1),
        "to_date": date(2026, 7, 1),
        "days": 1,
        "reason": "Personal",
    })
    assert req.status == "pending"

    approved = await svc.approve_leave(req.id, vid, approved_by=actor)
    assert approved.status == "approved"

    req2 = await svc.submit_leave_request(hr_employee.id, vid, {
        "leave_policy_id": leave_policy.id,
        "from_date": date(2026, 7, 10),
        "to_date": date(2026, 7, 10),
        "days": 1,
    })
    rejected = await svc.reject_leave(req2.id, vid, "Peak season", rejected_by=actor)
    assert rejected.status == "rejected"


# ══════════════════════════════════════════════════════════════════════════════
# SALARY & PAYROLL
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_salary_structure_and_payroll(db_session, vid, hr_employee, actor):
    svc = HRService(db_session)
    struct = await svc.create_salary_structure(vid, {
        "employee_id": hr_employee.id,
        "effective_from": date(2020, 1, 1),
        "is_active": True,
        "earnings": {"basic": 5000, "hra": 1000},
        "deductions": {"pf": 500},
    })
    assert float(struct.gross_monthly) == 6000.0
    assert float(struct.net_monthly) == 5500.0

    run = await svc.process_payroll(vid, month=6, year=2026, processed_by=actor)
    assert run.status == "processed"
    assert run.employee_count >= 1


# ══════════════════════════════════════════════════════════════════════════════
# OFFER LETTERS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_offer_letter_draft_send_guard(db_session, vid):
    svc = HRService(db_session)
    offer = await svc.create_offer(vid, {
        "candidate_name": "Alex Candidate",
        "candidate_email": "alex@test.local",
        "offered_ctc": 600000,
        "joining_date": date(2026, 8, 1),
    })
    assert offer.status == "draft"

    sent = await svc.send_offer(offer.id, vid)
    assert sent.status == "sent"

    with pytest.raises(HTTPException) as exc:
        await svc.update_offer(offer.id, vid, {"notes": "late edit"})
    assert "draft" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_offer_template_default(db_session, vid):
    svc = HRService(db_session)
    tpl = await svc.create_offer_template(vid, {
        "name": "Standard Offer",
        "body_html": "<p>Welcome {{candidate_name}}</p>",
        "is_default": True,
    })
    assert tpl.is_default is True

    best = await svc.find_best_offer_template(vid)
    assert best is not None and best.id == tpl.id


# ══════════════════════════════════════════════════════════════════════════════
# RECRUITMENT
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_recruitment_job_candidate_application(db_session, vid):
    job = await JobRepo(db_session).create(vid, {
        "title": "Store Associate",
        "employment_type": "full_time",
        "status": "open",
        "public_slug": f"store-assoc-{uuid.uuid4().hex[:8]}",
    })
    cand = await CandidateRepo(db_session).create(vid, {
        "full_name": "Priya Sharma",
        "email": "priya@test.local",
    })
    app = await ApplicationRepo(db_session).create(vid, {
        "candidate_id": cand.id,
        "job_posting_id": job.id,
        "current_stage": "applied",
    })
    assert app.current_stage == "applied"

    moved = await ApplicationRepo(db_session).update(app, {"current_stage": "shortlisted"})
    assert moved.current_stage == "shortlisted"

    items = await ApplicationRepo(db_session).list(vid, job_id=job.id)
    assert len(items) == 1


@pytest.mark.asyncio
async def test_recruitment_interview_round(db_session, vid):
    job = await JobRepo(db_session).create(vid, {
        "title": "Cashier",
        "status": "open",
        "public_slug": f"cashier-{uuid.uuid4().hex[:8]}",
    })
    cand = await CandidateRepo(db_session).create(vid, {"full_name": "Ravi Kumar"})
    app = await ApplicationRepo(db_session).create(vid, {
        "candidate_id": cand.id,
        "job_posting_id": job.id,
    })
    interview = await InterviewRepo(db_session).create(vid, {
        "application_id": app.id,
        "round_number": 1,
        "round_name": "HR screen",
        "status": "scheduled",
        "scheduled_at": datetime.utcnow() + timedelta(days=2),
    })
    assert interview.status == "scheduled"
    rounds = await InterviewRepo(db_session).list_for_application(app.id, vid)
    assert len(rounds) == 1


# ══════════════════════════════════════════════════════════════════════════════
# ONBOARDING
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_onboarding_template_and_checklist(db_session, vid, hr_employee):
    tpl_repo = OnboardingTemplateRepo(db_session)
    chk_repo = OnboardingChecklistRepo(db_session)

    tpl = await tpl_repo.create(vid, {"name": "Default Onboarding"}, [
        {"title": "Submit documents", "category": "documents"},
        {"title": "IT setup", "category": "it_setup"},
    ])
    assert len(tpl.items) == 2

    checklist = await chk_repo.create(vid, {
        "employee_id": hr_employee.id,
        "template_id": tpl.id,
        "status": "in_progress",
        "started_at": datetime.utcnow(),
    }, [
        {"title": "Submit documents", "status": "pending"},
        {"title": "IT setup", "status": "pending"},
    ])
    task_id = checklist.tasks[0].id
    await chk_repo.update_task(task_id, {"status": "done"})
    await chk_repo.update_task(checklist.tasks[1].id, {"status": "done"})
    await chk_repo.maybe_complete(checklist.id)

    refreshed = await chk_repo.get(checklist.id, vid)
    assert refreshed.status == "completed"


# ══════════════════════════════════════════════════════════════════════════════
# PERFORMANCE
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_performance_cycle_launch_and_review(db_session, vid, hr_employee, test_vendor_user):
    cycle = await CycleRepo(db_session).create(vid, {
        "name": "H1 2026",
        "period_start": date(2026, 1, 1),
        "period_end": date(2026, 6, 30),
        "self_review_required": True,
        "status": "draft",
    })
    goal = await GoalRepo(db_session).create(vid, {
        "employee_id": hr_employee.id,
        "cycle_id": cycle.id,
        "title": "Increase sales 10%",
        "weight": 50,
    })
    assert goal.title == "Increase sales 10%"

    review_repo = ReviewRepo(db_session)
    review = await review_repo.create(vid, {
        "cycle_id": cycle.id,
        "employee_id": hr_employee.id,
        "status": "self_pending",
    })
    updated = await review_repo.update(review, {
        "self_assessment": "Met targets",
        "self_rating": 4,
        "self_submitted_at": datetime.utcnow(),
        "status": "manager_pending",
    })
    assert updated.status == "manager_pending"

    fb = await FeedbackRepo(db_session).create(vid, {
        "from_user_id": test_vendor_user.id,
        "to_employee_id": hr_employee.id,
        "body": "Great teamwork this quarter",
        "feedback_type": "praise",
    })
    assert fb.body.startswith("Great")


# ══════════════════════════════════════════════════════════════════════════════
# COMPLIANCE
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_policy_publish_and_acknowledge(db_session, vid, hr_employee):
    repo = PolicyRepo(db_session)
    policy = await repo.create(vid, {
        "title": "Code of Conduct",
        "body": "<p>Be respectful</p>",
        "requires_acknowledgement": True,
        "status": "draft",
    })
    policy = await repo.update(policy, {"status": "published"}, bump_version=True)
    assert policy.status == "published"

    ack = await repo.acknowledge(policy.id, hr_employee.id, policy.version)
    assert ack.policy_id == policy.id

    pending = await repo.my_pending(vid, hr_employee.id)
    assert not any(p.id == policy.id for p in pending)


@pytest.mark.asyncio
async def test_compliance_certification(db_session, vid, hr_employee):
    cert = await CertificationRepo(db_session).create(vid, {
        "employee_id": hr_employee.id,
        "name": "Food Safety",
        "type": "certification",
        "issued_on": date(2025, 1, 1),
        "expires_on": date(2027, 1, 1),
        "status": "active",
    })
    items = await CertificationRepo(db_session).list(vid, employee_id=hr_employee.id)
    assert any(c.id == cert.id for c in items)


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_training_enroll_complete_certificate(db_session, vid, hr_employee):
    repo = TrainingRepo(db_session)
    program = await repo.create_program(vid, {
        "name": "POS Basics",
        "status": "published",
        "issues_certificate": True,
    })
    course = await repo.create_course(program.id, {
        "title": "Intro to POS",
        "sequence": 0,
        "is_required": True,
        "content_type": "video",
    })
    assert course.title == "Intro to POS"

    enr = await repo.enroll(vid, program.id, hr_employee.id)
    await repo.upsert_completion(enr.id, course.id, score_pct=90, passed=True)
    enr = await repo.recalc_progress(enr.id)
    assert enr.progress_pct == 100
    assert enr.status == "completed"

    cert = await repo.issue_certificate(vid, enr.id, program.name, hr_employee.full_name)
    assert cert.certificate_number.startswith("CERT-")


# ══════════════════════════════════════════════════════════════════════════════
# ESS — Announcements, Expenses, Helpdesk
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_announcement_publish_and_read(db_session, vid, hr_employee):
    repo = AnnouncementRepo(db_session)
    ann = await repo.create(vid, {
        "title": "Team Outing",
        "body": "Friday 4pm",
        "status": "published",
        "publish_at": datetime.utcnow() - timedelta(hours=1),
    })
    await repo.mark_read(ann.id, hr_employee.id)
    for_emp = await repo.list_for_employee(vid, hr_employee.id)
    assert any(a.id == ann.id for a in for_emp)


@pytest.mark.asyncio
async def test_expense_claim_lifecycle(db_session, vid, hr_employee):
    repo = ExpenseRepo(db_session)
    claim = await repo.create(vid, {
        "employee_id": hr_employee.id,
        "title": "Client lunch",
        "category": "meals",
        "amount": 850,
        "expense_date": date(2026, 6, 1),
        "status": "submitted",
    })
    assert claim.claim_number.startswith("EXP-")

    approved = await repo.update(claim, {"status": "approved", "decided_at": datetime.utcnow()})
    assert approved.status == "approved"

    paid = await repo.update(approved, {"status": "paid", "paid_at": datetime.utcnow()})
    assert paid.status == "paid"


@pytest.mark.asyncio
async def test_helpdesk_ticket_and_comment(db_session, vid, hr_employee, test_vendor_user):
    repo = HelpdeskRepo(db_session)
    ticket = await repo.create(vid, {
        "employee_id": hr_employee.id,
        "subject": "Payslip mismatch",
        "category": "payroll",
        "priority": "high",
    })
    assert ticket.ticket_number.startswith("TKT-")
    assert ticket.sla_due_at is not None

    comment = await repo.add_comment(ticket.id, {
        "author_user_id": test_vendor_user.id,
        "body": "We are looking into this",
        "is_staff_reply": True,
    })
    assert comment.body.startswith("We are")

    resolved = await repo.update(ticket, {"status": "resolved"})
    assert resolved.status == "resolved"
    assert resolved.resolved_at is not None
