# app/models/procurement_rfq.py
"""
Request for Quotation (RFQ) — Phase 3 procurement module.

An RFQ is the outbound side of the quotation cycle:
  1. Buyer issues RFQ (optionally sourced from an approved PR)
  2. RFQ is sent to one or more suppliers
  3. Suppliers respond with Quotations (Phase 4 — SupplierQuotation)
  4. Quotes are compared and one or more suppliers are awarded (Phase 5)
  5. Awarded suppliers produce POs

Tables:
  RequestForQuotation       – RFQ header document
  RequestForQuotationItem   – Line items (product / service / description)
  RFQSupplier               – Per-supplier invitation + response tracking
"""
from __future__ import annotations

import uuid
from sqlalchemy import (
    Column, String, Text, Date, DateTime, Boolean,
    ForeignKey, Numeric, Integer, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


# ─────────────────────────────────────────────────────────────────
# RFQ Header
# ─────────────────────────────────────────────────────────────────

class RequestForQuotation(Base):
    """
    RFQ document — issued to selected suppliers requesting price / delivery proposals.

    status flow:
      draft → issued → bids_closed → (awarded | cancelled)
      draft → cancelled

    sourcing_type:
      rfq  – standard competitive quotation
      rfi  – request for information (no formal bid expected)
      spot – one-off spot buy; single supplier
    """
    __tablename__ = "rfq"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    rfq_number = Column(String(30), nullable=False)
    title = Column(String(255), nullable=True)
    status = Column(String(30), nullable=False, default="draft")
    # draft | issued | bids_closed | awarded | cancelled

    sourcing_type = Column(String(20), nullable=False, default="rfq")
    # rfq | rfi | spot

    # Optional link to a PR that generated this RFQ
    requisition_id = Column(UUID(as_uuid=True), ForeignKey("purchase_requisition.id", ondelete="SET NULL"), nullable=True)

    # Requesting department / store
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)
    department = Column(String(100), nullable=True)

    # Dates
    bid_submission_deadline = Column(DateTime(timezone=True), nullable=True)
    delivery_required_by = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)           # validity of submitted quotes

    # Currency (all quotes expected in this currency unless noted otherwise)
    currency = Column(String(3), nullable=False, default="INR")

    # Commercial terms
    payment_terms = Column(String(100), nullable=True)
    delivery_terms = Column(String(100), nullable=True)  # Incoterms
    delivery_address = Column(JSONB, nullable=True)

    # Instructions / scope of work
    instructions_to_suppliers = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)

    # Award outcome
    awarded_at = Column(DateTime(timezone=True), nullable=True)
    awarded_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    audit_log = Column(JSONB, nullable=False, default=list)

    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship(
        "RequestForQuotationItem",
        back_populates="rfq",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    suppliers = relationship(
        "RFQSupplier",
        back_populates="rfq",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("vendor_id", "rfq_number", name="uq_rfq_vendor_number"),
        Index("ix_rfq_vendor", "vendor_id"),
        Index("ix_rfq_vendor_status", "vendor_id", "status"),
        Index("ix_rfq_requisition", "requisition_id"),
    )


# ─────────────────────────────────────────────────────────────────
# RFQ Line Items
# ─────────────────────────────────────────────────────────────────

class RequestForQuotationItem(Base):
    """One line of an RFQ — specifies what is needed so suppliers can quote."""
    __tablename__ = "rfq_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfq.id", ondelete="CASCADE"), nullable=False)

    # Link to originating PR item (for traceability)
    pr_item_id = Column(UUID(as_uuid=True), ForeignKey("purchase_requisition_item.id", ondelete="SET NULL"), nullable=True)

    line_number = Column(Integer, nullable=False, default=1)
    item_type = Column(String(20), nullable=False, default="product")
    # product | service | asset | description

    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="RESTRICT"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)   # free-text for non-catalogued items

    quantity = Column(Numeric(12, 4), nullable=False, default=1)
    unit_of_measure = Column(String(20), nullable=False, default="piece")

    # Target / budget price (optional, shown to suppliers only if instructed)
    target_price = Column(Numeric(14, 4), nullable=True)
    currency = Column(String(3), nullable=True)   # overrides RFQ-level if set

    needed_by_date = Column(Date, nullable=True)
    technical_specs = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    rfq = relationship("RequestForQuotation", back_populates="items")
    product = relationship("Product", lazy="selectin")
    service = relationship("Service", lazy="selectin")
    variant = relationship("ProductVariant", foreign_keys=[variant_id], lazy="selectin")

    __table_args__ = (
        Index("ix_rfq_item_rfq", "rfq_id"),
        Index("ix_rfq_item_product", "product_id"),
        Index("ix_rfq_item_service", "service_id"),
    )


# ─────────────────────────────────────────────────────────────────
# Per-supplier invitation
# ─────────────────────────────────────────────────────────────────

class RFQSupplier(Base):
    """
    One row per supplier invited to respond to an RFQ.

    invite_status tracks the invitation lifecycle:
      invited → acknowledged → bid_submitted | declined | no_response

    A signed token is issued when the RFQ is sent so the supplier can
    access a read-only view and submit their quote without needing an account.
    """
    __tablename__ = "rfq_supplier"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfq.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)

    invite_status = Column(String(30), nullable=False, default="invited")
    # invited | acknowledged | bid_submitted | declined | no_response

    invited_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    # Secure one-time token for supplier self-service portal access
    access_token = Column(String(64), nullable=True, unique=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)

    decline_reason = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)

    rfq = relationship("RequestForQuotation", back_populates="suppliers")
    supplier = relationship("Supplier", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("rfq_id", "supplier_id", name="uq_rfq_supplier"),
        Index("ix_rfq_supplier_rfq", "rfq_id"),
        Index("ix_rfq_supplier_supplier", "supplier_id"),
    )
