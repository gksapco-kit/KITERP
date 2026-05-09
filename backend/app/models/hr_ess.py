"""Employee Self Service — announcements, expense claims, helpdesk tickets."""
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Integer, Numeric, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Announcement(Base):
    __tablename__ = "hr_announcement"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String(40), default="general")  # general / event / policy / hr / it / urgent
    audience = Column(String(40), default="all")
    audience_filter = Column(JSONB, default=dict)
    pinned = Column(Boolean, default=False)
    cover_image_url = Column(String(500))
    attachment_url = Column(String(500))

    publish_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    status = Column(String(20), default="draft")    # draft / published / archived
    published_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    reads = relationship("AnnouncementRead", back_populates="announcement", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_hr_announce_vendor_status", "vendor_id", "status"),
    )


class AnnouncementRead(Base):
    __tablename__ = "hr_announcement_read"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    announcement_id = Column(UUID(as_uuid=True), ForeignKey("hr_announcement.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), server_default=func.now())

    announcement = relationship("Announcement", back_populates="reads")

    __table_args__ = (
        UniqueConstraint("announcement_id", "employee_id", name="uq_announce_read_emp"),
    )


class ExpenseClaim(Base):
    __tablename__ = "hr_expense_claim"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)

    claim_number = Column(String(40), unique=True)
    title = Column(String(200), nullable=False)
    category = Column(String(40))   # travel / meals / lodging / supplies / training / other
    expense_date = Column(Date)
    currency = Column(String(8), default="INR")
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text)
    receipts = Column(JSONB, default=list)   # [{url, name}]

    status = Column(String(20), default="draft")   # draft / submitted / approved / rejected / paid
    submitted_at = Column(DateTime(timezone=True))
    approver_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime(timezone=True))
    decision_note = Column(Text)
    paid_at = Column(DateTime(timezone=True))
    payment_reference = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_hr_expense_vendor_status", "vendor_id", "status"),
    )


class HelpdeskTicket(Base):
    __tablename__ = "hr_helpdesk_ticket"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)

    ticket_number = Column(String(40), unique=True)
    category = Column(String(40), default="hr")   # hr / it / payroll / facilities / grievance / other
    subject = Column(String(200), nullable=False)
    description = Column(Text)
    priority = Column(String(20), default="normal")    # low / normal / high / urgent
    status = Column(String(20), default="open")        # open / in_progress / waiting / resolved / closed
    assignee_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    sla_due_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    is_anonymous = Column(Boolean, default=False)   # for grievance tickets
    attachment_url = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    comments = relationship("HelpdeskTicketComment", back_populates="ticket", cascade="all, delete-orphan", order_by="HelpdeskTicketComment.created_at")

    __table_args__ = (
        Index("ix_hr_ticket_vendor_status", "vendor_id", "status"),
    )


class HelpdeskTicketComment(Base):
    __tablename__ = "hr_helpdesk_ticket_comment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("hr_helpdesk_ticket.id", ondelete="CASCADE"), nullable=False, index=True)
    author_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    is_staff_reply = Column(Boolean, default=False)
    is_internal = Column(Boolean, default=False)
    body = Column(Text, nullable=False)
    attachment_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("HelpdeskTicket", back_populates="comments")
