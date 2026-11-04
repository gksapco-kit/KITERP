"""Real Estate — Phase 4 models, part 1: project management (module 8) and construction (module 9)."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, Integer, Text, UniqueConstraint

from .base import REMixin, Base, UUID, choice, fk, jsonb_list, money, pct, qty, txt

COST_HEADS = [
    "land", "approvals", "construction", "materials", "labour", "marketing", "overheads", "finance", "contingency", "other",
]
WBS_STATUSES = ["not_started", "in_progress", "completed", "on_hold"]
MILESTONE_STATUSES = ["pending", "achieved", "delayed"]
WORK_ORDER_STATUSES = ["draft", "issued", "in_progress", "completed", "cancelled"]
PRIORITIES = ["low", "medium", "high", "urgent"]
QUALITY_RESULTS = ["pass", "fail", "conditional"]
QUALITY_STATUSES = ["open", "rectified", "closed"]
SEVERITIES = ["near_miss", "minor", "major", "fatal"]
INCIDENT_STATUSES = ["open", "investigating", "closed"]
INSPECTION_TYPES = ["internal", "third_party", "statutory", "rera_engineer", "fire", "structural", "other"]
INSPECTION_STATUSES = ["scheduled", "completed", "failed", "cancelled"]


class ReWbsTask(REMixin, Base):
    __tablename__ = "re_wbs_task"
    __table_args__ = (UniqueConstraint("vendor_id", "project_id", "code", name="uq_re_wbs_code"),)

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    parent_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # plain column: self reference
    tower_id = fk("re_tower")
    code = txt(30, nullable=False)
    name = txt(255, nullable=False)
    planned_start = Column(Date)
    duration_days = Column(Integer, nullable=False, default=1)
    planned_end = Column(Date)
    predecessor_ids = jsonb_list()  # finish-to-start predecessors (task ids)
    lag_days = Column(Integer, nullable=False, default=0)
    actual_start = Column(Date)
    actual_end = Column(Date)
    progress_percent = pct(0)
    weight = pct(1)
    status = choice(WBS_STATUSES, "not_started", 20)
    is_milestone = Column(Boolean, nullable=False, default=False)
    owner_name = txt(160)
    notes = Column(Text)


class ReMilestone(REMixin, Base):
    __tablename__ = "re_milestone"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    wbs_task_id = fk("re_wbs_task")
    name = txt(160, nullable=False)
    due_date = Column(Date)
    completed_on = Column(Date)
    status = choice(MILESTONE_STATUSES, "pending", 20)
    billing_triggered = Column(Boolean, nullable=False, default=False)
    remarks = Column(Text)


class ReProjectBudget(REMixin, Base):
    __tablename__ = "re_project_budget"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    cost_head = choice(COST_HEADS, "construction", 30)
    description = txt(255)
    budget_amount = money(0, nullable=False)
    revised_amount = money(0)
    notes = Column(Text)


class ReSiteProgress(REMixin, Base):
    """Daily progress report (DPR)."""

    __tablename__ = "re_site_progress"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    tower_id = fk("re_tower")
    wbs_task_id = fk("re_wbs_task")
    report_date = Column(Date, nullable=False)
    weather = txt(60)
    labour_count = Column(Integer, nullable=False, default=0)
    work_done = Column(Text)
    progress_percent = pct(0, nullable=True)  # cumulative % of the linked task after today's work
    issues = Column(Text)
    reported_by_name = txt(160)
    photos = jsonb_list()


class ReBoqItem(REMixin, Base):
    __tablename__ = "re_boq_item"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    wbs_task_id = fk("re_wbs_task")
    item_code = txt(40)
    description = txt(500, nullable=False)
    unit = txt(20, nullable=False, default="nos")
    quantity = qty(0, nullable=False)
    rate = money(0, nullable=False)
    amount = money(0)
    executed_quantity = qty(0)
    cost_head = choice(COST_HEADS, "construction", 30)
    notes = Column(Text)


class ReWorkOrder(REMixin, Base):
    __tablename__ = "re_work_order"
    __table_args__ = (UniqueConstraint("vendor_id", "wo_no", name="uq_re_work_order_no"),)

    wo_no = txt(30, nullable=False)
    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    wbs_task_id = fk("re_wbs_task")
    title = txt(255, nullable=False)
    description = Column(Text)
    assigned_to = txt(160)
    priority = choice(PRIORITIES, "medium", 10)
    due_date = Column(Date)
    status = choice(WORK_ORDER_STATUSES, "draft", 20)
    completed_on = Column(Date)


class ReQualityCheck(REMixin, Base):
    __tablename__ = "re_quality_check"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    wbs_task_id = fk("re_wbs_task")
    checklist_name = txt(255, nullable=False)
    inspected_on = Column(Date, nullable=False)
    inspector_name = txt(160)
    result = choice(QUALITY_RESULTS, "pass", 15)
    observations = Column(Text)
    rectification_due = Column(Date)
    status = choice(QUALITY_STATUSES, "open", 15)
    closed_on = Column(Date)


class ReSafetyIncident(REMixin, Base):
    __tablename__ = "re_safety_incident"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    incident_date = Column(Date, nullable=False)
    severity = choice(SEVERITIES, "near_miss", 15)
    description = Column(Text, nullable=False)
    location = txt(255)
    injured_count = Column(Integer, nullable=False, default=0)
    root_cause = Column(Text)
    corrective_action = Column(Text)
    reported_by_name = txt(160)
    status = choice(INCIDENT_STATUSES, "open", 15)
    closed_on = Column(Date)


class ReInspection(REMixin, Base):
    __tablename__ = "re_inspection"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    inspection_type = choice(INSPECTION_TYPES, "internal", 20)
    title = txt(255, nullable=False)
    inspector = txt(160)
    scheduled_on = Column(Date)
    done_on = Column(Date)
    status = choice(INSPECTION_STATUSES, "scheduled", 15)
    findings = Column(Text)
    certificate_ref = txt(120)
