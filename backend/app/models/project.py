from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey,
    Numeric, Integer, Index, Date,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Project(Base):
    __tablename__ = "pm_project"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    project_number = Column(String(20), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    status = Column(String(30), nullable=False, default="planning")
    # planning, active, on_hold, completed, cancelled

    priority = Column(String(20), nullable=False, default="medium")
    # low, medium, high, urgent

    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_name = Column(String(255))

    owner_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_name = Column(String(255))

    start_date = Column(Date)
    end_date = Column(Date)
    due_date = Column(Date)

    budget = Column(Numeric(14, 2))
    currency = Column(String(3), nullable=False, default="INR")

    progress_percent = Column(Integer, nullable=False, default=0)
    color = Column(String(7))

    tags = Column(JSONB, default=list)
    milestones = Column(JSONB, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))

    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_pm_project_vendor_status", "vendor_id", "status"),
        Index("uq_pm_project_vendor_number", "vendor_id", "project_number", unique=True),
    )


class ProjectTask(Base):
    __tablename__ = "pm_task"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("pm_project.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text)

    status = Column(String(30), nullable=False, default="todo")
    # todo, in_progress, review, done

    priority = Column(String(20), nullable=False, default="medium")

    assignee_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    assignee_name = Column(String(255))

    parent_task_id = Column(UUID(as_uuid=True), ForeignKey("pm_task.id", ondelete="SET NULL"), nullable=True, index=True)
    linked_task_ids = Column(JSONB, default=list)

    due_date = Column(Date)
    position = Column(Integer, nullable=False, default=0)

    labels = Column(JSONB, default=list)
    checklist = Column(JSONB, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))

    project = relationship("Project", back_populates="tasks")

    __table_args__ = (
        Index("ix_pm_task_project_status", "project_id", "status"),
        Index("ix_pm_task_project_position", "project_id", "status", "position"),
    )
