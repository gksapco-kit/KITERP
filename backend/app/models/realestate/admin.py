"""Real Estate — Phase 0 / Module 24: administration foundation.

Number ranges, document vault, letter templates, approval workflow, audit log,
integrations and GL event mapping.
"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String, Text, UniqueConstraint

from .base import REMixin, Base, EncryptedSecrets, JSONB, UUID, choice, fk, jsonb_dict, jsonb_list, money, now_utc, txt

APPROVAL_STATUSES = ["pending", "approved", "rejected", "cancelled"]
INTEGRATION_PROVIDERS = [
    "payment_gateway", "sms", "whatsapp", "email", "esign", "tally", "rera_portal", "maps", "other",
]
TEMPLATE_TYPES = [
    # Letters & agreements
    "allotment_letter", "demand_letter", "payment_receipt", "agreement_for_sale", "sale_deed",
    "lease_agreement", "lease_deed", "possession_letter", "cancellation_letter", "refund_letter",
    "welcome_letter", "noc",
    # Printable financial documents
    "cost_sheet", "quotation", "statement_of_account", "payment_schedule", "demand_note",
    "other",
]

class ReNumberRange(REMixin, Base):
    """Per-document-type running number (booking, allotment, demand, receipt, work order, ...)."""

    __tablename__ = "re_number_range"
    __table_args__ = (UniqueConstraint("vendor_id", "doc_type", name="uq_re_number_range"),)

    doc_type = txt(40, nullable=False)
    prefix = txt(20, nullable=False, default="DOC")
    next_number = Column(Integer, nullable=False, default=1)
    padding = Column(Integer, nullable=False, default=5)
    include_year = Column(Boolean, nullable=False, default=True)
    last_year = Column(Integer, nullable=True)
    reset_yearly = Column(Boolean, nullable=False, default=False)


class ReDocument(REMixin, Base):
    """Digital document vault — attachable to any real-estate entity."""

    __tablename__ = "re_document"

    entity_type = txt(40, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    doc_type = txt(60, nullable=False, default="other")
    title = txt(255, nullable=False)
    file_url = txt(1000)
    file_name = txt(255)
    version = Column(Integer, nullable=False, default=1)
    issued_on = Column(Date)
    expires_on = Column(Date)
    tags = jsonb_list()
    notes = Column(Text)
    uploaded_by_name = txt(160)


class ReTemplate(REMixin, Base):
    """Merge-field letter/agreement templates (override the built-in defaults).

    ``print_settings`` is a JSONB bag with optional print/layout overrides:
        logo_url, header_html, footer_html, page_size ("A4" | "Letter" | "Legal"),
        orientation ("portrait" | "landscape"), margin_mm (int),
        font_family, font_size_px (int), custom_css,
        show_signature (bool), signatory_name, signature_url, watermark.
    """

    __tablename__ = "re_template"

    template_type = choice(TEMPLATE_TYPES, "other", 40)
    name = txt(160, nullable=False)
    subject = txt(255)
    body = Column(Text, nullable=False, default="")
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    # Print / layout configuration (nullable so existing rows keep working)
    print_settings = jsonb_dict()


class ReApprovalRule(REMixin, Base):
    """Rule that routes a document to approval when ``field >= min_value``."""

    __tablename__ = "re_approval_rule"

    entity_type = txt(40, nullable=False, index=True)
    name = txt(160, nullable=False)
    field = txt(60, nullable=False, default="amount")
    min_value = Column(Numeric(16, 2), nullable=False, default=0)
    approver_permission = txt(60, nullable=False, default="realestate.approve")
    is_active = Column(Boolean, nullable=False, default=True)
    description = Column(Text)


class ReApprovalRequest(REMixin, Base):
    __tablename__ = "re_approval_request"

    entity_type = txt(40, nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    entity_ref = txt(80)
    rule_id = fk("re_approval_rule")
    title = txt(255)
    amount = money()
    reason = Column(Text)
    status = choice(APPROVAL_STATUSES, "pending", 20)
    requested_by_user_id = Column(UUID(as_uuid=True))
    requested_by_name = txt(160)
    decided_by_user_id = Column(UUID(as_uuid=True))
    decided_by_name = txt(160)
    decided_at = Column(DateTime(timezone=True))
    comments = Column(Text)


class ReAuditLog(Base):
    """Append-only trail of create / update / delete / workflow actions."""

    __tablename__ = "re_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    entity_type = txt(40, nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), index=True)
    entity_ref = txt(120)
    action = txt(40, nullable=False)
    actor_user_id = Column(UUID(as_uuid=True))
    actor_name = txt(160)
    changes = jsonb_dict()
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)


class ReIntegration(REMixin, Base):
    __tablename__ = "re_integration"

    provider = choice(INTEGRATION_PROVIDERS, "other", 40)
    name = txt(160, nullable=False)
    config = Column(EncryptedSecrets, default=dict)  # secret-looking values are encrypted at rest
    is_enabled = Column(Boolean, nullable=False, default=False)
    last_tested_at = Column(DateTime(timezone=True))
    last_status = txt(40)
    last_message = txt(500)


SETTING_KEYS = ["auto_billing", "alert_digest", "notifications"]


class ReSetting(REMixin, Base):
    """Per-vendor switches for scheduled / automatic behaviour (one row per key)."""

    __tablename__ = "re_setting"
    __table_args__ = (UniqueConstraint("vendor_id", "key", name="uq_re_setting"),)

    key = choice(SETTING_KEYS, "auto_billing", 40)
    value = jsonb_dict()
    description = txt(255)


GL_FAILURE_STATUSES = ["open", "resolved"]


class ReGlFailure(REMixin, Base):
    """A real-estate document that could not be posted to the general ledger (kept so it can be retried)."""

    __tablename__ = "re_gl_failure"
    __table_args__ = (UniqueConstraint("vendor_id", "source_type", "source_id", name="uq_re_gl_failure_source"),)

    source_type = txt(40, nullable=False, index=True)
    source_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    reference = txt(255)
    amount = money()
    error = Column(Text)
    payload = jsonb_dict()
    attempts = Column(Integer, nullable=False, default=1)
    status = choice(GL_FAILURE_STATUSES, "open", 20)
    journal_id = Column(UUID(as_uuid=True))
    last_attempt_at = Column(DateTime(timezone=True), default=now_utc)
    resolved_at = Column(DateTime(timezone=True))
