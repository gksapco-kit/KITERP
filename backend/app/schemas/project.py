from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ORM = ConfigDict(from_attributes=True)


class ProjectStatus(str, Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class MilestoneItem(BaseModel):
    id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=255)
    due_date: Optional[date] = None
    completed: bool = False
    completed_at: Optional[datetime] = None


class ChecklistItem(BaseModel):
    id: Optional[str] = None
    text: str = Field(..., min_length=1, max_length=500)
    done: bool = False


class ProjectItem(BaseModel):
    id: str
    name: str
    item_type: str = "product"  # product | service
    sku: Optional[str] = None
    price: Optional[float] = None


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: ProjectPriority = ProjectPriority.MEDIUM
    store_id: Optional[UUID] = None
    sales_area_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    owner_id: Optional[UUID] = None
    owner_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    due_date: Optional[date] = None
    budget: Optional[Decimal] = None
    currency: str = "INR"
    color: Optional[str] = Field(None, max_length=7)
    tags: Optional[list[str]] = None
    milestones: Optional[list[MilestoneItem]] = None
    items: Optional[list[ProjectItem]] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    store_id: Optional[UUID] = None
    sales_area_id: Optional[UUID] = None
    items: Optional[list[ProjectItem]] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    owner_id: Optional[UUID] = None
    owner_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    due_date: Optional[date] = None
    budget: Optional[Decimal] = None
    currency: Optional[str] = None
    progress_percent: Optional[int] = Field(None, ge=0, le=100)
    color: Optional[str] = Field(None, max_length=7)
    tags: Optional[list[str]] = None
    milestones: Optional[list[MilestoneItem]] = None


class LinkedTaskSummary(BaseModel):
    id: UUID
    title: str
    status: str


class ProjectResponse(ProjectBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    project_number: str
    progress_percent: int = 0
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    task_count: Optional[int] = None
    done_task_count: Optional[int] = None


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    page: int
    size: int
    pages: int


class ProjectOverviewResponse(BaseModel):
    total_projects: int = 0
    by_status: dict[str, int] = {}
    active_count: int = 0
    overdue_count: int = 0
    total_tasks: int = 0
    open_tasks: int = 0
    completed_tasks: int = 0
    avg_progress: float = 0.0


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: Optional[UUID] = None
    assignee_name: Optional[str] = None
    parent_task_id: Optional[UUID] = None
    linked_task_ids: Optional[list[UUID]] = None
    due_date: Optional[date] = None
    position: int = 0
    labels: Optional[list[str]] = None
    checklist: Optional[list[ChecklistItem]] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[UUID] = None
    assignee_name: Optional[str] = None
    parent_task_id: Optional[UUID] = None
    linked_task_ids: Optional[list[UUID]] = None
    due_date: Optional[date] = None
    position: Optional[int] = None
    labels: Optional[list[str]] = None
    checklist: Optional[list[ChecklistItem]] = None


class TaskResponse(TaskBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    project_id: UUID
    parent_title: Optional[str] = None
    linked_tasks: Optional[list[LinkedTaskSummary]] = None
    subtask_count: int = 0
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class TaskReorderItem(BaseModel):
    id: UUID
    status: TaskStatus
    position: int


class TaskReorderRequest(BaseModel):
    items: list[TaskReorderItem]
