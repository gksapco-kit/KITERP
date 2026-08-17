# app/models/crm.py
"""
Full CRM model set - all tables vendor-scoped.

Covers: accounts (with hierarchy), contacts, leads, pipelines, stages, deals,
activities, communication logs, support tickets + KB, marketing
(segments, campaigns, enrollments, templates, email events, suppression),
workflow automation, integrations, audit logs, AI insights, chat
conversations/messages, journey events.
"""
from sqlalchemy import (
    Column, String, Text, Boolean, Date, DateTime, ForeignKey, Integer,
    Numeric, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


# ── Accounts (companies) ─────────────────────────────────────────────────────

class CrmAccount(Base):
    __tablename__ = "crm_account"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("crm_account.id", ondelete="SET NULL"), nullable=True)

    number = Column(String(40), nullable=False)
    name = Column(String(255), nullable=False)
    industry = Column(String(100))
    region = Column(String(100))
    website = Column(String(500))
    phone = Column(String(50))
    email = Column(String(255))
    annual_revenue = Column(Numeric(14, 2))
    employee_count = Column(Integer)

    billing_address = Column(JSONB, default={})
    shipping_address = Column(JSONB, default={})
    tags = Column(JSONB, default=list)
    custom_fields = Column(JSONB, default=dict)
    notes = Column(Text)

    owner_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    children = relationship("CrmAccount", remote_side=[id])
    contacts = relationship(
        "CrmContact", back_populates="account", cascade="all, delete-orphan",
        foreign_keys="CrmContact.account_id",
    )

    __table_args__ = (
        Index("ix_crm_account_vendor_name", "vendor_id", "name"),
        Index("ix_crm_account_owner", "owner_id"),
        Index("ix_crm_account_number", "vendor_id", "number", unique=True),
    )


# ── Contacts (people) ────────────────────────────────────────────────────────

class CrmContact(Base):
    __tablename__ = "crm_contact"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("crm_account.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    record_type = Column(String(10), default="person", nullable=False)  # person | company
    salutation = Column(String(20))
    parent_contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    linked_account_id = Column(UUID(as_uuid=True), ForeignKey("crm_account.id", ondelete="SET NULL"), nullable=True)
    number = Column(String(40))

    first_name = Column(String(120), nullable=False)
    last_name = Column(String(120))
    title = Column(String(120))
    email = Column(String(255))
    phone = Column(String(50))
    mobile = Column(String(50))

    industry = Column(String(100))
    region = Column(String(100))
    website = Column(String(500))
    annual_revenue = Column(Numeric(14, 2))
    employee_count = Column(Integer)

    address = Column(JSONB, default=dict)
    tags = Column(JSONB, default=list)
    custom_fields = Column(JSONB, default=dict)
    notes = Column(Text)

    lifecycle_stage = Column(String(40), default="lead")  # lead/mql/sql/customer/evangelist
    lead_source = Column(String(80))

    do_not_email = Column(Boolean, default=False)
    do_not_call = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    last_activity_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    account = relationship("CrmAccount", back_populates="contacts", foreign_keys=[account_id])
    parent = relationship("CrmContact", remote_side=[id], foreign_keys=[parent_contact_id])

    __table_args__ = (
        Index("ix_crm_contact_vendor_email", "vendor_id", "email"),
        Index("ix_crm_contact_vendor_phone", "vendor_id", "phone"),
        Index("ix_crm_contact_account", "account_id"),
        Index("ix_crm_contact_owner", "owner_id"),
        Index("ix_crm_contact_parent", "parent_contact_id"),
        Index("ix_crm_contact_record_type", "vendor_id", "record_type"),
    )


# ── Leads ────────────────────────────────────────────────────────────────────

class CrmLead(Base):
    __tablename__ = "crm_lead"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    number = Column(String(40), nullable=False)
    first_name = Column(String(120))
    last_name = Column(String(120))
    company = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    title = Column(String(120))
    website = Column(String(500))

    source = Column(String(80))  # website/referral/ad/event/manual/import/api/chatbot
    source_campaign = Column(String(255))
    status = Column(String(40), default="new")  # new/working/contacted/qualified/unqualified/requested_for_demo/demo_scheduled/demo_completed/not_responding/contact_later/converted
    score = Column(Integer, default=0)
    rating = Column(String(20))  # hot/warm/cold

    assigned_to = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text)
    intake_payload = Column(JSONB, default=dict)
    custom_fields = Column(JSONB, default=dict)
    tags = Column(JSONB, default=list)

    converted_at = Column(DateTime(timezone=True))
    converted_contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    converted_account_id = Column(UUID(as_uuid=True), ForeignKey("crm_account.id", ondelete="SET NULL"), nullable=True)
    converted_deal_id = Column(UUID(as_uuid=True), ForeignKey("crm_deal.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_crm_lead_vendor_status", "vendor_id", "status"),
        Index("ix_crm_lead_assigned", "assigned_to"),
        Index("ix_crm_lead_email", "vendor_id", "email"),
        Index("ix_crm_lead_number", "vendor_id", "number", unique=True),
    )


# ── Pipelines / Stages / Deals ───────────────────────────────────────────────

class CrmPipeline(Base):
    __tablename__ = "crm_pipeline"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    stages = relationship(
        "CrmStage", back_populates="pipeline",
        cascade="all, delete-orphan", order_by="CrmStage.sort_order",
    )


class CrmStage(Base):
    __tablename__ = "crm_stage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("crm_pipeline.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    probability = Column(Numeric(5, 2), default=0)  # 0-100
    sort_order = Column(Integer, default=0)
    is_won = Column(Boolean, default=False)
    is_lost = Column(Boolean, default=False)
    color = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    pipeline = relationship("CrmPipeline", back_populates="stages")


class CrmDeal(Base):
    __tablename__ = "crm_deal"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("crm_pipeline.id", ondelete="RESTRICT"), nullable=False, index=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("crm_stage.id", ondelete="RESTRICT"), nullable=False, index=True)

    number = Column(String(40), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    account_id = Column(UUID(as_uuid=True), ForeignKey("crm_account.id", ondelete="SET NULL"), nullable=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    amount = Column(Numeric(14, 2), default=0)
    currency = Column(String(3), default="INR")
    probability = Column(Numeric(5, 2))  # override stage default if set
    expected_close_date = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))

    status = Column(String(20), default="open")  # open/won/lost/abandoned
    lost_reason = Column(String(255))
    won_reason = Column(String(255))
    source = Column(String(80))

    sort_order = Column(Integer, default=0)  # within stage for kanban ordering
    tags = Column(JSONB, default=list)
    custom_fields = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_crm_deal_vendor_stage", "vendor_id", "stage_id"),
        Index("ix_crm_deal_owner", "owner_id"),
        Index("ix_crm_deal_status", "vendor_id", "status"),
        Index("ix_crm_deal_number", "vendor_id", "number", unique=True),
    )


# ── Activities (tasks, calls, meetings, notes) ────────────────────────────────

class CrmActivity(Base):
    __tablename__ = "crm_activity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    number = Column(String(40), nullable=False)
    type = Column(String(20), nullable=False)  # task/call/meeting/note/email
    subject = Column(String(255), nullable=False)
    description = Column(Text)

    related_type = Column(String(30))  # contact/account/lead/deal/ticket
    related_id = Column(UUID(as_uuid=True))

    due_at = Column(DateTime(timezone=True))
    reminder_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer)

    priority = Column(String(20), default="normal")  # low/normal/high/urgent
    status = Column(String(20), default="open")  # open/in_progress/completed/cancelled

    location = Column(String(255))
    meeting_url = Column(String(500))
    outcome = Column(String(255))
    custom_fields = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_crm_activity_vendor_owner", "vendor_id", "owner_id"),
        Index("ix_crm_activity_related", "related_type", "related_id"),
        Index("ix_crm_activity_due", "vendor_id", "due_at"),
        Index("ix_crm_activity_number", "vendor_id", "number", unique=True),
    )


# ── Communication logs ───────────────────────────────────────────────────────

class CrmCommunicationLog(Base):
    __tablename__ = "crm_communication_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    channel = Column(String(20), nullable=False)  # email/call/sms/whatsapp/note/chat
    direction = Column(String(10), default="outbound")  # inbound/outbound
    subject = Column(String(255))
    body = Column(Text)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())

    related_type = Column(String(30))
    related_id = Column(UUID(as_uuid=True))

    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    external_id = Column(String(255))  # provider message id (twilio sid, sendgrid, etc.)
    provider = Column(String(40))  # twilio_sms / twilio_voice / sendgrid / smtp / meta_wa / chat
    status = Column(String(40))  # sent/delivered/failed/received/read
    sentiment = Column(String(20))  # positive/neutral/negative
    metadata_json = Column("metadata", JSONB, default=dict)
    attachments = Column(JSONB, default=list)

    __table_args__ = (
        Index("ix_crm_comm_vendor_occurred", "vendor_id", "occurred_at"),
        Index("ix_crm_comm_related", "related_type", "related_id"),
        Index("ix_crm_comm_contact", "contact_id"),
    )


class CrmCallRecording(Base):
    __tablename__ = "crm_call_recording"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    communication_id = Column(UUID(as_uuid=True), ForeignKey("crm_communication_log.id", ondelete="CASCADE"), nullable=True)
    url = Column(String(500))
    duration_seconds = Column(Integer)
    transcript = Column(Text)
    sentiment = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Support tickets + KB ─────────────────────────────────────────────────────

class CrmSlaPolicy(Base):
    __tablename__ = "crm_sla_policy"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    priority = Column(String(20), default="normal")
    response_target_minutes = Column(Integer, default=240)
    resolution_target_minutes = Column(Integer, default=2880)
    business_hours = Column(JSONB, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CrmTicket(Base):
    __tablename__ = "crm_ticket"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    number = Column(String(40), nullable=False)
    subject = Column(String(255), nullable=False)
    description = Column(Text)

    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("crm_account.id", ondelete="SET NULL"), nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    sla_policy_id = Column(UUID(as_uuid=True), ForeignKey("crm_sla_policy.id", ondelete="SET NULL"), nullable=True)

    priority = Column(String(20), default="normal")  # low/normal/high/urgent
    status = Column(String(30), default="open")  # open/pending/on_hold/resolved/closed
    source = Column(String(40), default="manual")  # manual/email/chat/web/phone

    first_response_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    sla_breached = Column(Boolean, default=False)

    tags = Column(JSONB, default=list)
    custom_fields = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_crm_ticket_vendor_status", "vendor_id", "status"),
        Index("ix_crm_ticket_number", "vendor_id", "number", unique=True),
        Index("ix_crm_ticket_contact", "contact_id"),
        Index("ix_crm_ticket_assigned", "assigned_to"),
    )


class CrmTicketComment(Base):
    __tablename__ = "crm_ticket_comment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("crm_ticket.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)

    body = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    attachments = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CrmKbArticle(Base):
    __tablename__ = "crm_kb_article"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    body = Column(Text)
    summary = Column(Text)
    tags = Column(JSONB, default=list)
    status = Column(String(20), default="draft")  # draft/published/archived
    view_count = Column(Integer, default=0)
    helpful_count = Column(Integer, default=0)
    author_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_crm_kb_vendor_slug", "vendor_id", "slug", unique=True),
        Index("ix_crm_kb_vendor_status", "vendor_id", "status"),
    )


# ── Marketing automation ─────────────────────────────────────────────────────

class CrmSegment(Base):
    __tablename__ = "crm_segment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    filter_dsl = Column(JSONB, default=dict)  # JSON DSL: {field, op, value} groups
    contact_count = Column(Integer, default=0)
    last_computed_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CrmEmailTemplate(Base):
    __tablename__ = "crm_email_template"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    subject = Column(String(255), nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text)
    merge_tags = Column(JSONB, default=list)
    channel = Column(String(20), default="email")  # email/sms/whatsapp
    description = Column(Text)
    attachments = Column(JSONB, default=list)  # [{url, type, name}]
    schedule_start = Column(DateTime(timezone=True))
    schedule_end = Column(DateTime(timezone=True))
    settings = Column(JSONB, default=dict)  # cta_label, cta_url, footer_text
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CrmCampaign(Base):
    __tablename__ = "crm_campaign"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(30), nullable=False, default="one_off")  # one_off/drip
    channel = Column(String(20), default="email")  # email/sms/whatsapp
    status = Column(String(20), default="draft")  # draft/scheduled/active/paused/completed
    template_id = Column(UUID(as_uuid=True), ForeignKey("crm_email_template.id", ondelete="SET NULL"), nullable=True)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("crm_segment.id", ondelete="SET NULL"), nullable=True)
    scheduled_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    sent_count = Column(Integer, default=0)
    open_count = Column(Integer, default=0)
    click_count = Column(Integer, default=0)
    bounce_count = Column(Integer, default=0)
    unsubscribe_count = Column(Integer, default=0)

    settings = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (Index("ix_crm_campaign_vendor_status", "vendor_id", "status"),)


class CrmCampaignStep(Base):
    __tablename__ = "crm_campaign_step"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("crm_campaign.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, default=0)
    delay_minutes = Column(Integer, default=0)
    channel = Column(String(20), default="email")
    template_id = Column(UUID(as_uuid=True), ForeignKey("crm_email_template.id", ondelete="SET NULL"), nullable=True)
    condition = Column(JSONB, default=dict)
    action = Column(JSONB, default=dict)


class CrmCampaignEnrollment(Base):
    __tablename__ = "crm_campaign_enrollment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("crm_campaign.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    current_step = Column(Integer, default=0)
    status = Column(String(20), default="active")  # active/paused/completed/exited
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    next_action_at = Column(DateTime(timezone=True))
    last_action_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    exit_reason = Column(String(120))

    __table_args__ = (
        Index("ix_crm_enrollment_next", "vendor_id", "next_action_at"),
        Index("ix_crm_enrollment_unique", "campaign_id", "contact_id", unique=True),
    )


class CrmEmailEvent(Base):
    __tablename__ = "crm_email_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("crm_campaign.id", ondelete="CASCADE"), nullable=True, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="CASCADE"), nullable=True, index=True)
    event = Column(String(30), nullable=False)  # send/open/click/bounce/unsubscribe/spam
    target_url = Column(String(500))
    user_agent = Column(String(500))
    ip = Column(String(50))
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())


class CrmSuppressionEntry(Base):
    __tablename__ = "crm_suppression_entry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(20), nullable=False)  # email/sms/whatsapp
    address = Column(String(255), nullable=False)
    reason = Column(String(120))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_crm_suppression_unique", "vendor_id", "channel", "address", unique=True),)


# ── Number ranges (document series for leads, contacts, deals, …) ─────────────

class CrmNumberRange(Base):
    """Per-vendor sequential number series for CRM entities (leads, contacts, …)."""
    __tablename__ = "crm_number_range"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    # lead | account | contact | deal | activity | ticket
    entity_type = Column(String(40), nullable=False)
    name = Column(String(120), nullable=False)
    prefix = Column(String(20), nullable=False, default="LED")
    number_from = Column(Integer, nullable=False, default=1)
    number_to = Column(Integer, nullable=False, default=999999)
    # Next number to issue (Finance-style). Starts at number_from.
    current_number = Column(Integer, nullable=False, default=1)
    pad_width = Column(Integer, nullable=False, default=6)
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "entity_type", name="uq_crm_nr_vendor_entity"),
        Index("ix_crm_nr_vendor_entity", "vendor_id", "entity_type"),
    )


# ── Workflow automation ──────────────────────────────────────────────────────

class CrmWorkflow(Base):
    __tablename__ = "crm_workflow"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger = Column(JSONB, default=dict)  # {event, entity, conditions...}
    steps = Column(JSONB, default=list)  # ordered list of action specs
    status = Column(String(20), default="active")  # active/paused/draft
    requires_approval = Column(Boolean, default=False)
    last_run_at = Column(DateTime(timezone=True))
    run_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CrmWorkflowRun(Base):
    __tablename__ = "crm_workflow_run"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("crm_workflow.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(40))
    entity_id = Column(UUID(as_uuid=True))
    status = Column(String(20), default="running")  # running/success/failed/skipped
    log = Column(JSONB, default=list)
    error = Column(Text)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))


# ── Integrations / Audit / AI / Chat / Journey ───────────────────────────────

class CrmIntegration(Base):
    __tablename__ = "crm_integration"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(40), nullable=False)  # twilio_sms / twilio_voice / twilio_wa / sendgrid / openai / google_calendar / outlook / meta / stripe / razorpay / generic_webhook
    label = Column(String(120))
    status = Column(String(20), default="connected")  # connected/disconnected/error
    encrypted_credentials = Column(Text)  # Fernet ciphertext of JSON
    settings = Column(JSONB, default=dict)
    last_synced_at = Column(DateTime(timezone=True))
    last_error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (Index("ix_crm_integration_vendor_provider", "vendor_id", "provider", unique=True),)


class CrmAuditLog(Base):
    __tablename__ = "crm_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    actor_type = Column(String(20), default="user")  # user/system/customer/api
    entity = Column(String(60), nullable=False)
    entity_id = Column(UUID(as_uuid=True))
    action = Column(String(40), nullable=False)  # create/update/delete/login/etc.
    before = Column(JSONB)
    after = Column(JSONB)
    ip = Column(String(50))
    user_agent = Column(String(500))
    request_path = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_crm_audit_vendor_created", "vendor_id", "created_at"),
        Index("ix_crm_audit_entity", "entity", "entity_id"),
    )


class CrmAiInsight(Base):
    __tablename__ = "crm_ai_insight"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    kind = Column(String(40), nullable=False)  # scoring/summary/next_action/sentiment/forecast
    content = Column(JSONB, default=dict)
    model = Column(String(80))
    confidence = Column(Numeric(5, 2))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_crm_ai_entity", "entity_type", "entity_id"),
        Index("ix_crm_ai_vendor_kind", "vendor_id", "kind"),
    )


class CrmChatConversation(Base):
    __tablename__ = "crm_chat_conversation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    visitor_id = Column(String(120))  # cookie/anon id from widget
    visitor_name = Column(String(120))
    visitor_email = Column(String(255))
    visitor_phone = Column(String(40))
    channel = Column(String(20), default="widget")  # widget/whatsapp/sms/email
    status = Column(String(20), default="open")  # open/awaiting_agent/closed
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    bot_handled = Column(Boolean, default=True)
    last_message_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Lead conversion tracking
    converted_lead_id = Column(UUID(as_uuid=True), ForeignKey("crm_lead.id", ondelete="SET NULL"), nullable=True, index=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)

    # Ticket conversion tracking
    converted_ticket_id = Column(UUID(as_uuid=True), ForeignKey("crm_ticket.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_converted_at = Column(DateTime(timezone=True), nullable=True)

    messages = relationship("CrmChatMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="CrmChatMessage.created_at")

    __table_args__ = (
        Index("ix_crm_chat_conv_vendor_status", "vendor_id", "status"),
        Index("ix_crm_chat_conv_visitor", "vendor_id", "visitor_id"),
    )


class CrmChatMessage(Base):
    __tablename__ = "crm_chat_message"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("crm_chat_conversation.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)  # customer/agent/bot/system
    sender_id = Column(UUID(as_uuid=True))  # user/contact/customer id when applicable
    body = Column(Text)
    attachments = Column(JSONB, default=list)
    metadata_json = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("CrmChatConversation", back_populates="messages")


class CrmJourneyEvent(Base):
    __tablename__ = "crm_journey_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    visitor_id = Column(String(120))
    event_type = Column(String(60), nullable=False)  # page_view/product_view/add_to_cart/email_open/email_click/call/ticket_open/deal_stage_change
    payload = Column(JSONB, default=dict)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_crm_journey_vendor_time", "vendor_id", "occurred_at"),
        Index("ix_crm_journey_contact", "contact_id"),
        Index("ix_crm_journey_visitor", "vendor_id", "visitor_id"),
    )


class CrmLeadIntakeToken(Base):
    """Per-vendor token for public lead intake endpoints (forms, ads)."""
    __tablename__ = "crm_lead_intake_token"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(64), nullable=False, unique=True, index=True)
    label = Column(String(120))
    source_default = Column(String(80), default="form")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True))


# ── Collections: payment follow-ups & credit control ─────────────────────────

class CrmPaymentFollowup(Base):
    """Collections follow-up for overdue / promised payments."""
    __tablename__ = "crm_payment_followup"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    number = Column(String(40), nullable=False)
    party_name = Column(String(255), nullable=False)
    party_phone = Column(String(40))
    party_email = Column(String(255))
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    amount_due = Column(Numeric(14, 2), default=0)
    currency = Column(String(10), default="INR")
    invoice_ref = Column(String(120))
    due_date = Column(Date)
    next_followup_at = Column(DateTime(timezone=True))
    channel = Column(String(20), default="call")  # call/email/sms/whatsapp/visit
    priority = Column(String(20), default="normal")  # low/normal/high/urgent
    status = Column(String(30), default="open")  # open/promised/partial/paid/cancelled
    promise_date = Column(Date)
    notes = Column(Text)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_crm_pf_vendor_status", "vendor_id", "status"),
        Index("ix_crm_pf_vendor_next", "vendor_id", "next_followup_at"),
        Index("ix_crm_pf_number", "vendor_id", "number", unique=True),
    )


class CrmCreditControl(Base):
    """Per-party credit / max-payment controls for CRM collections."""
    __tablename__ = "crm_credit_control"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    party_name = Column(String(255), nullable=False)
    party_phone = Column(String(40))
    party_email = Column(String(255))
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contact.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True, index=True)
    # Maximum outstanding credit allowed
    credit_limit = Column(Numeric(14, 2), default=0)
    # Maximum amount allowed in a single payment / invoice
    max_payment_amount = Column(Numeric(14, 2), default=0)
    # Tracked outstanding (manual until AR sync)
    current_outstanding = Column(Numeric(14, 2), default=0)
    payment_terms_days = Column(Integer, default=30)
    payment_blocked = Column(Boolean, default=False)
    block_reason = Column(String(255))
    status = Column(String(30), default="active")  # active/watch/blocked
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_crm_cc_vendor_status", "vendor_id", "status"),
        Index("ix_crm_cc_vendor_party", "vendor_id", "party_name"),
    )
