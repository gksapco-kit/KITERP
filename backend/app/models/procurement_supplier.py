# app/models/procurement_supplier.py
"""
Extended Supplier Master — Phase 1 procurement module.

Adds lifecycle management to the existing flat `supplier` table:
  SupplierCategory         — commodity / spend categorisation
  SupplierContact          — multiple contacts per supplier
  SupplierAddress          — multiple addresses (billing, delivery, registered)
  SupplierDocument         — compliance documents with expiry tracking
  SupplierOnboarding       — qualification workflow (draft → approved / rejected)
  SupplierPerformance      — periodic scorecard (on-time %, rejection %, price variance %)

All tables carry vendor_id (tenant) + supplier_id (FK → supplier) and are
indexed appropriately for list / filter queries.
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
# Supplier Category
# ─────────────────────────────────────────────────────────────────

class SupplierCategory(Base):
    """Spend / commodity categories used to classify suppliers (e.g. Raw Materials, IT Services)."""
    __tablename__ = "supplier_category"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(120), nullable=False)
    code = Column(String(30), nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("supplier_category.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "name", name="uq_supplier_cat_vendor_name"),
        Index("ix_supplier_cat_vendor", "vendor_id"),
    )


# ─────────────────────────────────────────────────────────────────
# Supplier ↔ Category (M:M)
# ─────────────────────────────────────────────────────────────────

class SupplierCategoryLink(Base):
    """Many-to-many: a supplier can belong to multiple categories."""
    __tablename__ = "supplier_category_link"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("supplier_category.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("supplier_id", "category_id", name="uq_supplier_cat_link"),
        Index("ix_supcatlink_supplier", "supplier_id"),
        Index("ix_supcatlink_category", "category_id"),
    )


# ─────────────────────────────────────────────────────────────────
# Supplier Contact
# ─────────────────────────────────────────────────────────────────

class SupplierContact(Base):
    """Multiple named contacts per supplier (sales rep, accounts, logistics, etc.)."""
    __tablename__ = "supplier_contact"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    designation = Column(String(120), nullable=True)
    department = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    mobile = Column(String(30), nullable=True)
    is_primary = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_supcontact_supplier", "supplier_id"),
        Index("ix_supcontact_vendor", "vendor_id"),
    )


# ─────────────────────────────────────────────────────────────────
# Supplier Address
# ─────────────────────────────────────────────────────────────────

class SupplierAddress(Base):
    """Multiple addresses per supplier — billing, registered office, dispatch, etc."""
    __tablename__ = "supplier_address"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False)

    address_type = Column(String(30), nullable=False, default="billing")
    # billing | registered | dispatch | warehouse | other

    line1 = Column(String(255), nullable=False)
    line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    country = Column(String(60), nullable=False, default="India")
    gstin = Column(String(15), nullable=True)  # GSTIN for this address/branch
    is_default = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_supaddr_supplier", "supplier_id"),
        Index("ix_supaddr_vendor", "vendor_id"),
    )


# ─────────────────────────────────────────────────────────────────
# Supplier Document
# ─────────────────────────────────────────────────────────────────

class SupplierDocument(Base):
    """Compliance / KYC documents uploaded for a supplier with expiry tracking.

    document_type examples: gstin_certificate, pan_card, msme_certificate,
    iso_certification, bank_verification, trade_license, fssai_license.

    status: valid | expiring_soon | expired | pending_verification | rejected
    """
    __tablename__ = "supplier_document"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False)

    document_type = Column(String(60), nullable=False)
    document_number = Column(String(100), nullable=True)
    file_url = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    issuing_authority = Column(String(200), nullable=True)

    status = Column(String(30), nullable=False, default="pending_verification")
    # valid | expiring_soon | expired | pending_verification | rejected

    verified_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_supdoc_supplier", "supplier_id"),
        Index("ix_supdoc_vendor", "vendor_id"),
        Index("ix_supdoc_expiry", "expiry_date"),
        Index("ix_supdoc_status", "vendor_id", "status"),
    )


# ─────────────────────────────────────────────────────────────────
# Supplier Onboarding / Qualification
# ─────────────────────────────────────────────────────────────────

class SupplierOnboarding(Base):
    """Qualification workflow for each supplier.

    status: draft → submitted → under_review → approved | rejected | on_hold
    After approval the supplier becomes eligible to receive RFQs.

    re_evaluation_due: set when a periodic re-evaluation is scheduled (e.g. annual).
    """
    __tablename__ = "supplier_onboarding"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"),
                         nullable=False, unique=True)

    status = Column(String(30), nullable=False, default="draft")
    # draft | submitted | under_review | approved | rejected | on_hold | blacklisted

    qualification_score = Column(Numeric(5, 2), nullable=True)   # 0-100
    payment_terms = Column(String(50), nullable=True)            # agreed terms e.g. "Net 30"
    credit_limit = Column(Numeric(14, 2), nullable=True)
    currency = Column(String(3), default="INR")

    # Evaluation checklist stored as JSONB list of {item, passed, notes}
    checklist = Column(JSONB, nullable=False, default=list)

    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)

    approved_at = Column(DateTime(timezone=True), nullable=True)
    re_evaluation_due = Column(Date, nullable=True)

    audit_log = Column(JSONB, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_sup_onboard_vendor", "vendor_id"),
        Index("ix_sup_onboard_status", "vendor_id", "status"),
    )


# ─────────────────────────────────────────────────────────────────
# Supplier Performance Scorecard
# ─────────────────────────────────────────────────────────────────

class SupplierPerformance(Base):
    """Periodic KPI snapshot for a supplier.

    Rows are created by the system (or manually) at the end of each
    evaluation period (monthly / quarterly / annually).

    Metrics:
      on_time_delivery_pct   — % of PO lines delivered on or before scheduled date
      quality_acceptance_pct — % of GRN items accepted (not rejected by QC)
      price_variance_pct     — avg (actual_price - agreed_price) / agreed_price × 100
      response_time_days     — avg days from RFQ issue to supplier quote submission
      overall_score          — weighted composite (0-100); populated by scoring logic
    """
    __tablename__ = "supplier_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False)

    period_type = Column(String(20), nullable=False, default="monthly")  # monthly | quarterly | annual
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # Metrics
    po_count = Column(Integer, default=0)
    on_time_delivery_pct = Column(Numeric(6, 2), nullable=True)
    quality_acceptance_pct = Column(Numeric(6, 2), nullable=True)
    price_variance_pct = Column(Numeric(7, 2), nullable=True)    # negative = below PO price (good)
    response_time_days = Column(Numeric(6, 1), nullable=True)
    overall_score = Column(Numeric(5, 2), nullable=True)

    # Weights used when computing overall_score
    weight_delivery = Column(Numeric(5, 2), default=40)
    weight_quality = Column(Numeric(5, 2), default=35)
    weight_price = Column(Numeric(5, 2), default=15)
    weight_response = Column(Numeric(5, 2), default=10)

    comments = Column(Text, nullable=True)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("supplier_id", "period_start", "period_end",
                         name="uq_supplier_perf_period"),
        Index("ix_supperf_vendor", "vendor_id"),
        Index("ix_supperf_supplier", "supplier_id"),
        Index("ix_supperf_period", "vendor_id", "period_start"),
    )
