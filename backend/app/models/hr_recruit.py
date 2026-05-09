"""Recruitment & Onboarding models — job postings, candidates, applications,
interviews, onboarding templates and per-employee checklists."""
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, Integer, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class JobPosting(Base):
    __tablename__ = "hr_job_posting"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True)
    designation_id = Column(UUID(as_uuid=True), ForeignKey("hr_designation.id", ondelete="SET NULL"), nullable=True)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)

    employment_type = Column(String(20), default="full_time")  # full_time / part_time / contract / intern
    location = Column(String(200))
    openings = Column(Integer, default=1)
    salary_min = Column(Numeric(12, 2))
    salary_max = Column(Numeric(12, 2))
    description = Column(Text)
    requirements = Column(Text)
    benefits = Column(Text)

    status = Column(String(20), default="draft")   # draft / open / closed / on_hold
    public_slug = Column(String(120), nullable=True, unique=True)
    posted_at = Column(DateTime(timezone=True))
    closes_at = Column(DateTime(timezone=True))

    posted_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    department = relationship("Department", foreign_keys=[department_id])
    designation = relationship("Designation", foreign_keys=[designation_id])
    store = relationship("Store", foreign_keys=[store_id])

    __table_args__ = (
        Index("ix_hr_job_vendor_status", "vendor_id", "status"),
    )


class Candidate(Base):
    __tablename__ = "hr_candidate"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    full_name = Column(String(200), nullable=False)
    email = Column(String(255))
    phone = Column(String(30))
    resume_url = Column(String(500))

    current_company = Column(String(200))
    current_designation = Column(String(150))
    total_experience_years = Column(Numeric(4, 1))
    current_ctc = Column(Numeric(14, 2))
    expected_ctc = Column(Numeric(14, 2))
    notice_period_days = Column(Integer)
    location = Column(String(200))
    source = Column(String(40))   # referral / portal / agency / walk_in / linkedin / other

    skills = Column(JSONB, default=list)
    tags = Column(JSONB, default=list)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_hr_candidate_vendor_email", "vendor_id", "email"),
    )


class JobApplication(Base):
    __tablename__ = "hr_job_application"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("hr_candidate.id", ondelete="CASCADE"), nullable=False, index=True)
    job_posting_id = Column(UUID(as_uuid=True), ForeignKey("hr_job_posting.id", ondelete="CASCADE"), nullable=False, index=True)

    current_stage = Column(String(30), default="applied")  # applied / screening / shortlisted / interviewing / offer_made / hired / rejected / withdrawn
    rating = Column(Integer)   # 1-5
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    rejection_reason = Column(Text)
    cover_letter = Column(Text)

    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    moved_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    candidate = relationship("Candidate", foreign_keys=[candidate_id])
    job_posting = relationship("JobPosting", foreign_keys=[job_posting_id])

    __table_args__ = (
        UniqueConstraint("candidate_id", "job_posting_id", name="uq_application_candidate_job"),
        Index("ix_hr_application_vendor_stage", "vendor_id", "current_stage"),
    )


class InterviewRound(Base):
    __tablename__ = "hr_interview_round"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id = Column(UUID(as_uuid=True), ForeignKey("hr_job_application.id", ondelete="CASCADE"), nullable=False, index=True)

    round_number = Column(Integer, default=1)
    round_name = Column(String(100))         # e.g. "Tech screen", "Manager round", "HR final"
    scheduled_at = Column(DateTime(timezone=True))
    duration_min = Column(Integer, default=45)
    mode = Column(String(20), default="video")    # in_person / video / phone
    location_or_link = Column(String(500))
    interviewer_user_ids = Column(JSONB, default=list)

    status = Column(String(20), default="scheduled")  # scheduled / completed / no_show / cancelled / rescheduled
    rating = Column(Integer)                  # 1-5
    feedback = Column(Text)
    recommendation = Column(String(20))       # hire / no_hire / maybe

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    application = relationship("JobApplication", foreign_keys=[application_id])

    __table_args__ = (
        Index("ix_hr_interview_vendor_when", "vendor_id", "scheduled_at"),
    )


class OnboardingTemplate(Base):
    __tablename__ = "hr_onboarding_template"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(150), nullable=False)
    description = Column(String(400))
    designation_id = Column(UUID(as_uuid=True), ForeignKey("hr_designation.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True)
    is_default = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("OnboardingTemplateItem", back_populates="template", cascade="all, delete-orphan", order_by="OnboardingTemplateItem.sequence")


class OnboardingTemplateItem(Base):
    __tablename__ = "hr_onboarding_template_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("hr_onboarding_template.id", ondelete="CASCADE"), nullable=False, index=True)

    sequence = Column(Integer, default=0)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(40), default="general")  # documents / it_setup / training / intro / policy / general
    default_due_offset_days = Column(Integer, default=7)
    default_assignee_role = Column(String(40))   # hr / manager / it / employee

    template = relationship("OnboardingTemplate", back_populates="items")


class OnboardingChecklist(Base):
    __tablename__ = "hr_onboarding_checklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("hr_onboarding_template.id", ondelete="SET NULL"), nullable=True)

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    target_completion_date = Column(Date)
    completed_at = Column(DateTime(timezone=True))
    status = Column(String(20), default="in_progress")  # in_progress / completed / overdue

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tasks = relationship("OnboardingTask", back_populates="checklist", cascade="all, delete-orphan", order_by="OnboardingTask.sequence")


class OnboardingTask(Base):
    __tablename__ = "hr_onboarding_task"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    checklist_id = Column(UUID(as_uuid=True), ForeignKey("hr_onboarding_checklist.id", ondelete="CASCADE"), nullable=False, index=True)

    sequence = Column(Integer, default=0)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(40), default="general")
    due_date = Column(Date)
    assignee_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="pending")   # pending / in_progress / done / skipped
    completed_at = Column(DateTime(timezone=True))
    attachment_url = Column(String(500))
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    checklist = relationship("OnboardingChecklist", back_populates="tasks")
