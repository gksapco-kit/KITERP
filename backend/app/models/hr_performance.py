"""Performance Management models — review cycles, goals, appraisals, KPIs, feedback."""
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, Integer, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class ReviewCycle(Base):
    __tablename__ = "hr_review_cycle"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(150), nullable=False)
    description = Column(Text)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    review_type = Column(String(30), default="annual")  # annual / quarterly / probation / 360 / project
    rating_scale_max = Column(Integer, default=5)
    self_review_required = Column(Boolean, default=True)
    manager_review_required = Column(Boolean, default=True)
    peer_review_count = Column(Integer, default=0)
    enable_kpi_scoring = Column(Boolean, default=True)
    kpi_template = Column(JSONB, default=list)   # [{key, label, weight}]

    status = Column(String(20), default="draft")  # draft / launched / closed
    launched_at = Column(DateTime(timezone=True))
    closes_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    reviews = relationship("PerformanceReview", back_populates="cycle", cascade="all, delete-orphan")


class PerformanceGoal(Base):
    __tablename__ = "hr_performance_goal"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("hr_review_cycle.id", ondelete="SET NULL"), nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("hr_performance_goal.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(40))   # business / personal / development / behavioural
    target_value = Column(String(100))
    weight = Column(Numeric(5, 2), default=10)   # %
    progress_pct = Column(Integer, default=0)
    start_date = Column(Date)
    target_date = Column(Date)
    status = Column(String(20), default="active")  # active / completed / dropped / on_hold

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PerformanceReview(Base):
    __tablename__ = "hr_performance_review"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("hr_review_cycle.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    status = Column(String(30), default="draft")
    # draft / self_pending / self_submitted / manager_pending / manager_submitted / acknowledged / closed
    self_assessment = Column(Text)
    self_rating = Column(Numeric(3, 2))
    self_submitted_at = Column(DateTime(timezone=True))

    manager_comments = Column(Text)
    overall_rating = Column(Numeric(3, 2))
    strengths = Column(Text)
    improvement_areas = Column(Text)
    promotion_recommended = Column(Boolean, default=False)
    salary_change_suggestion_pct = Column(Numeric(5, 2))
    manager_submitted_at = Column(DateTime(timezone=True))

    employee_acknowledgement = Column(Text)
    acknowledged_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cycle = relationship("ReviewCycle", back_populates="reviews")
    kpi_scores = relationship("ReviewKPIScore", back_populates="review", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("cycle_id", "employee_id", name="uq_review_cycle_emp"),
        Index("ix_hr_review_vendor_status", "vendor_id", "status"),
    )


class ReviewKPIScore(Base):
    __tablename__ = "hr_review_kpi_score"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id = Column(UUID(as_uuid=True), ForeignKey("hr_performance_review.id", ondelete="CASCADE"), nullable=False, index=True)

    kpi_key = Column(String(60), nullable=False)
    label = Column(String(150))
    weight = Column(Numeric(5, 2), default=10)
    self_score = Column(Numeric(3, 2))
    manager_score = Column(Numeric(3, 2))
    comments = Column(Text)

    review = relationship("PerformanceReview", back_populates="kpi_scores")


class Feedback(Base):
    __tablename__ = "hr_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    from_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    to_employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)

    feedback_type = Column(String(20), default="praise")   # praise / constructive / coaching / values
    visibility = Column(String(20), default="private")     # private / manager / public
    title = Column(String(200))
    body = Column(Text, nullable=False)
    related_competency = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
