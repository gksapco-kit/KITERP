"""Real Estate — Phase 5 models: handover & possession (17), customer care (18) and the customer portal."""
from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Text, UniqueConstraint

from .base import REMixin, Base, UUID, choice, fk, jsonb_list, txt

HANDOVER_STATUSES = ["scheduled", "inspection", "ready", "handed_over", "cancelled"]
SNAG_CATEGORIES = ["civil", "electrical", "plumbing", "painting", "carpentry", "flooring", "fixtures", "waterproofing", "other"]
SNAG_SEVERITIES = ["minor", "major", "critical"]
SNAG_STATUSES = ["open", "in_progress", "rectified", "verified", "waived"]
TICKET_CATEGORIES = [
    "structural_defect", "defect", "payment_query", "documentation", "maintenance", "possession", "complaint", "request", "other",
]
TICKET_PRIORITIES = ["low", "medium", "high", "urgent"]
TICKET_STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"]
TICKET_CHANNELS = ["portal", "phone", "email", "walk_in", "whatsapp", "other"]
WARRANTY_COVERAGES = ["structural", "waterproofing", "electrical", "plumbing", "fittings", "general"]
WARRANTY_STATUSES = ["active", "expired", "void"]
FEEDBACK_KINDS = ["handover", "ticket", "project", "general"]

# SLA (hours) by priority. A structural-defect claim must be rectified within 30 days (RERA s.14(3)).
SLA_HOURS = {"urgent": 4, "high": 24, "medium": 72, "low": 168}
STRUCTURAL_SLA_HOURS = 30 * 24
DEFAULT_CHECKLIST = [
    "Keys & access cards handed over", "Electrical points & switches tested", "Plumbing, taps & drainage tested",
    "Doors, windows & locks checked", "Flooring, tiles & skirting checked", "Paint & wall finish checked",
    "Meter readings recorded", "Society / maintenance dues cleared", "Possession letter signed",
]


class ReHandover(REMixin, Base):
    __tablename__ = "re_handover"
    __table_args__ = (UniqueConstraint("vendor_id", "handover_no", name="uq_re_handover_no"),)

    handover_no = txt(30, nullable=False)
    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    project_id = fk("re_project")
    unit_id = fk("re_unit")
    customer_id = fk("re_customer")
    status = choice(HANDOVER_STATUSES, "scheduled", 20)
    scheduled_on = Column(Date)
    inspection_on = Column(Date)
    offered_on = Column(Date)
    handed_over_on = Column(Date)
    checklist = jsonb_list()  # [{"item": str, "done": bool, "remarks": str}]
    keys_count = Column(Integer, nullable=False, default=0)
    electricity_meter_reading = txt(30)
    water_meter_reading = txt(30)
    oc_waived = Column(Boolean, nullable=False, default=False)
    dues_waived = Column(Boolean, nullable=False, default=False)
    waiver_reason = txt(500)
    handed_over_by_name = txt(160)
    received_by_name = txt(160)
    customer_acknowledged = Column(Boolean, nullable=False, default=False)
    remarks = Column(Text)


class ReSnag(REMixin, Base):
    __tablename__ = "re_snag"

    handover_id = fk("re_handover", ondelete="CASCADE")
    booking_id = fk("re_booking", ondelete="CASCADE")
    project_id = fk("re_project")
    unit_id = fk("re_unit")
    customer_id = fk("re_customer")
    category = choice(SNAG_CATEGORIES, "other", 20)
    location = txt(120)
    description = Column(Text, nullable=False)
    severity = choice(SNAG_SEVERITIES, "minor", 15)
    status = choice(SNAG_STATUSES, "open", 15)
    reported_on = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date)
    assigned_to = txt(160)
    contractor_id = fk("re_contractor")
    rectified_on = Column(Date)
    verified_on = Column(Date)
    resolution = Column(Text)
    reported_via = txt(20, default="staff")


class ReWarranty(REMixin, Base):
    __tablename__ = "re_warranty"

    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    project_id = fk("re_project")
    unit_id = fk("re_unit")
    customer_id = fk("re_customer")
    coverage = choice(WARRANTY_COVERAGES, "general", 20)
    starts_on = Column(Date, nullable=False)
    ends_on = Column(Date, nullable=False)
    months = Column(Integer, nullable=False, default=12)
    statutory = Column(Boolean, nullable=False, default=False)  # RERA s.14(3): 5 years for structural defects
    status = choice(WARRANTY_STATUSES, "active", 15)
    terms = txt(500)


class ReTicket(REMixin, Base):
    __tablename__ = "re_ticket"
    __table_args__ = (UniqueConstraint("vendor_id", "ticket_no", name="uq_re_ticket_no"),)

    ticket_no = txt(30, nullable=False)
    customer_id = fk("re_customer", nullable=False, ondelete="CASCADE")
    booking_id = fk("re_booking")
    unit_id = fk("re_unit")
    project_id = fk("re_project")
    warranty_id = fk("re_warranty")
    category = choice(TICKET_CATEGORIES, "request", 25)
    priority = choice(TICKET_PRIORITIES, "medium", 10)
    channel = choice(TICKET_CHANNELS, "phone", 15)
    subject = txt(255, nullable=False)
    description = Column(Text)
    status = choice(TICKET_STATUSES, "open", 20)
    assigned_to_name = txt(160)
    sla_hours = Column(Integer, nullable=False, default=72)
    due_at = Column(DateTime(timezone=True))
    first_response_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    resolution = Column(Text)
    reopen_count = Column(Integer, nullable=False, default=0)
    sla_breached = Column(Boolean, nullable=False, default=False)


class ReTicketComment(REMixin, Base):
    __tablename__ = "re_ticket_comment"

    ticket_id = fk("re_ticket", nullable=False, ondelete="CASCADE")
    author_type = txt(10, nullable=False, default="staff")  # staff | customer
    author_name = txt(160)
    body = Column(Text, nullable=False)
    is_internal = Column(Boolean, nullable=False, default=False)


class ReFeedback(REMixin, Base):
    __tablename__ = "re_feedback"

    customer_id = fk("re_customer", ondelete="CASCADE")
    booking_id = fk("re_booking")
    project_id = fk("re_project")
    ticket_id = fk("re_ticket")
    handover_id = fk("re_handover")
    kind = choice(FEEDBACK_KINDS, "general", 15)
    rating = Column(Integer, nullable=False)  # 1-5
    nps = Column(Integer)  # 0-10 likelihood to recommend
    comments = Column(Text)
    submitted_via = txt(15, default="staff")


class RePortalLink(REMixin, Base):
    """A revocable, expiring link that gives one customer read access to their own booking(s)."""

    __tablename__ = "re_portal_link"

    customer_id = fk("re_customer", nullable=False, ondelete="CASCADE")
    jti = txt(64, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    created_by_name = txt(160)
    last_used_at = Column(DateTime(timezone=True))
    use_count = Column(Integer, nullable=False, default=0)
