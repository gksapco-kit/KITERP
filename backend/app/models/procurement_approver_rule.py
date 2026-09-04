# app/models/procurement_approver_rule.py
"""Vendor-scoped procurement approver matrix rules.

A rule row defines WHO must approve a document based on dimension filters.
NULL on a dimension column means "any value" (wildcard).

Multiple rows sharing the same (vendor_id, doc_type, company_id, branch_id,
plant_id, material_type, min_amount, max_amount) form a single *rule group*.
The `level` column orders the approval chain within a group.

Exactly one of `approver_id` / `approver_role_id` must be non-null per row.
When `approver_role_id` is set, all active users holding that role are resolved
to concrete approver steps at submit time.
"""
from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey,
    Numeric, Integer, CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text
import uuid
from app.database import Base


class ProcurementApproverRule(Base):
    __tablename__ = "procurement_approver_rule"

    id = Column(
        UUID(as_uuid=True), primary_key=True,
        default=uuid.uuid4,
    )
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendor.id", ondelete="CASCADE"),
        nullable=False,
    )
    # PR | PO | INVOICE
    doc_type = Column(String(10), nullable=False)

    # Dimension filters (NULL == any)
    company_id    = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=True)
    branch_id     = Column(UUID(as_uuid=True), ForeignKey("store.id",       ondelete="CASCADE"), nullable=True)
    plant_id      = Column(UUID(as_uuid=True), ForeignKey("plant.id",       ondelete="CASCADE"), nullable=True)
    material_type = Column(String(30), nullable=True)

    # Amount band (inclusive lower, exclusive upper; NULL = unbounded)
    min_amount = Column(Numeric(14, 2), nullable=True)
    max_amount = Column(Numeric(14, 2), nullable=True)

    # Chain position within the rule group
    level = Column(Integer, nullable=False, default=1)

    # Exactly one of these must be set (enforced by DB CHECK constraint)
    approver_id      = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="CASCADE"), nullable=True)
    approver_role_id = Column(UUID(as_uuid=True), ForeignKey("vendor_role.id", ondelete="CASCADE"), nullable=True)

    # lock_chain=True: the resolved chain is fixed; users cannot add overrides.
    # lock_chain=False: users may append extra approvers above the resolved chain.
    lock_chain = Column(Boolean, nullable=False, default=False)
    is_active  = Column(Boolean, nullable=False, default=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    approver      = relationship("VendorUser", foreign_keys=[approver_id],      lazy="selectin")
    approver_role = relationship("VendorRole", foreign_keys=[approver_role_id],  lazy="selectin")
    company       = relationship("FinCompany", foreign_keys=[company_id],        lazy="selectin")
    branch        = relationship("Store",      foreign_keys=[branch_id],         lazy="selectin")
    plant         = relationship("Plant",      foreign_keys=[plant_id],          lazy="selectin")

    __table_args__ = (
        CheckConstraint(
            "(approver_id IS NOT NULL)::int + (approver_role_id IS NOT NULL)::int = 1",
            name="ck_approver_rule_one_target",
        ),
        Index("ix_apr_vendor_doctype", "vendor_id", "doc_type"),
        Index("ix_apr_company",  "vendor_id", "company_id"),
        Index("ix_apr_branch",   "vendor_id", "branch_id"),
        Index("ix_apr_plant",    "vendor_id", "plant_id"),
        Index("ix_apr_approver", "approver_id"),
        Index("ix_apr_role",     "approver_role_id"),
    )
