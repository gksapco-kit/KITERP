"""Training Management — programs, courses, quizzes, enrollments, certificates."""
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Integer, Numeric, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class TrainingProgram(Base):
    __tablename__ = "hr_training_program"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(60))    # onboarding / compliance / leadership / technical / soft_skills
    cover_image_url = Column(String(500))
    is_mandatory = Column(Boolean, default=False)
    target_audience = Column(String(40), default="all")
    audience_filter = Column(JSONB, default=dict)
    estimated_hours = Column(Numeric(5, 2))
    issues_certificate = Column(Boolean, default=True)
    status = Column(String(20), default="draft")     # draft / published / archived

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    courses = relationship("TrainingCourse", back_populates="program", cascade="all, delete-orphan", order_by="TrainingCourse.sequence")


class TrainingCourse(Base):
    __tablename__ = "hr_training_course"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id = Column(UUID(as_uuid=True), ForeignKey("hr_training_program.id", ondelete="CASCADE"), nullable=False, index=True)

    sequence = Column(Integer, default=0)
    title = Column(String(200), nullable=False)
    content_type = Column(String(20), default="text")   # text / video / pdf / quiz / scorm
    content_url = Column(String(500))                   # video / pdf / external
    body_html = Column(Text)                            # rich content for text type
    duration_min = Column(Integer)
    pass_score_pct = Column(Integer, default=70)        # for quiz
    is_required = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    program = relationship("TrainingProgram", back_populates="courses")
    questions = relationship("QuizQuestion", back_populates="course", cascade="all, delete-orphan", order_by="QuizQuestion.sequence")


class QuizQuestion(Base):
    __tablename__ = "hr_quiz_question"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("hr_training_course.id", ondelete="CASCADE"), nullable=False, index=True)

    sequence = Column(Integer, default=0)
    question = Column(Text, nullable=False)
    question_type = Column(String(20), default="single")  # single / multi / true_false
    options = Column(JSONB, default=list)                  # [{"id":"a","text":"…","is_correct":bool}]
    explanation = Column(Text)
    points = Column(Integer, default=1)

    course = relationship("TrainingCourse", back_populates="questions")


class TrainingEnrollment(Base):
    __tablename__ = "hr_training_enrollment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    program_id = Column(UUID(as_uuid=True), ForeignKey("hr_training_program.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)

    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(Date)
    status = Column(String(20), default="enrolled")    # enrolled / in_progress / completed / failed / overdue
    progress_pct = Column(Integer, default=0)
    completed_at = Column(DateTime(timezone=True))
    certificate_url = Column(String(500))

    __table_args__ = (
        UniqueConstraint("program_id", "employee_id", name="uq_enroll_program_emp"),
    )


class CourseCompletion(Base):
    __tablename__ = "hr_course_completion"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("hr_training_enrollment.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("hr_training_course.id", ondelete="CASCADE"), nullable=False, index=True)

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    score_pct = Column(Integer)
    passed = Column(Boolean, default=False)
    answers = Column(JSONB, default=dict)
    attempts = Column(Integer, default=1)

    __table_args__ = (
        UniqueConstraint("enrollment_id", "course_id", name="uq_completion_enroll_course"),
    )


class TrainingCertificate(Base):
    __tablename__ = "hr_training_certificate"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("hr_training_enrollment.id", ondelete="CASCADE"), nullable=False, index=True)

    certificate_number = Column(String(60), unique=True)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    valid_until = Column(Date)
    title_snapshot = Column(String(200))
    employee_name_snapshot = Column(String(200))
    download_html = Column(Text)
