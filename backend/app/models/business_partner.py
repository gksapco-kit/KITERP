# app/models/business_partner.py
"""
Business Partner — the single identity master for every party (customer, vendor,
employee, contractor, partner, …).

One BusinessPartner row = one real-world person or organisation.
BusinessPartnerRole rows attach the roles that party plays for this vendor,
and each role row optionally links to the existing domain table:
  - "customer"   → customer.id
  - "vendor"     → supplier.id    (party_type = "supplier")
  - "employee"   → supplier.id    (party_type = "employee") + optional hr_employee_profile
  - "partner"    → supplier.id    (party_type = "partner")
  - "contractor" → supplier.id    (party_type = "contractor")
  - <custom>     → supplier.id    (party_type = "supplier")

Existing customer/supplier rows created BEFORE this module exist without a
business_partner_id — they continue to work unchanged. When the user "extends"
a legacy record, a BP row is created and the role link is written back.
"""

from sqlalchemy import (
    Column, String, Text, DateTime, Boolean,
    Numeric, ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class BusinessPartner(Base):
    __tablename__ = "business_partner"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendor.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Identity fields (shared across all roles) ────────────────
    name = Column(String(255), nullable=False)
    contact_name = Column(String(255))      # primary contact person
    email = Column(String(255))
    phone = Column(String(30))

    # Business / Tax registration
    gstin = Column(String(15))
    pan_number = Column(String(10))
    cin = Column(String(21))
    company_name = Column(String(255))

    # Address
    address = Column(JSONB, default={})     # {street, city, state, postal_code, country}
    addresses = Column(JSONB, default=[])   # additional addresses

    # Bank
    bank_name = Column(String(100))
    account_number = Column(String(30))
    account_holder_name = Column(String(255))
    account_type = Column(String(20), default="savings")
    ifsc_code = Column(String(15))

    # Financial
    opening_balance = Column(Numeric(12, 2), default=0)

    # Metadata
    notes = Column(Text)
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True)

    # Status flags (mirror the supplier/customer status model)
    party_status = Column(String(20), default="active")   # active | on_hold | blocked
    payment_blocked = Column(Boolean, default=False)
    hold_until = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    roles = relationship(
        "BusinessPartnerRole",
        back_populates="business_partner",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_bp_vendor", "vendor_id"),
        Index("ix_bp_vendor_name", "vendor_id", "name"),
        Index("ix_bp_vendor_gstin", "vendor_id", "gstin"),
        Index("ix_bp_vendor_phone", "vendor_id", "phone"),
        Index("ix_bp_vendor_email", "vendor_id", "email"),
    )


class BusinessPartnerRole(Base):
    """
    Each row represents one role a BusinessPartner plays for this vendor.
    A partner can have multiple roles simultaneously (e.g. vendor + customer).
    """
    __tablename__ = "business_partner_role"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendor.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    business_partner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("business_partner.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role identifier: customer | vendor | employee | partner | contractor | <custom>
    role = Column(String(50), nullable=False)

    # ── Links to domain tables ────────────────────────────────────
    # Only one of these is populated depending on role
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customer.id", ondelete="SET NULL"),
        nullable=True,
    )
    supplier_id = Column(
        UUID(as_uuid=True),
        ForeignKey("supplier.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Role-specific extra attributes (credit_limit, payment_terms, etc.)
    attributes = Column(JSONB, default={})

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    business_partner = relationship("BusinessPartner", back_populates="roles", lazy="noload")
    customer = relationship("Customer", lazy="noload")
    supplier = relationship("Supplier", lazy="noload")

    __table_args__ = (
        # Each BP can only hold one of each role per vendor
        UniqueConstraint("vendor_id", "business_partner_id", "role", name="uq_bp_role"),
        Index("ix_bpr_vendor_bp", "vendor_id", "business_partner_id"),
        Index("ix_bpr_customer", "customer_id"),
        Index("ix_bpr_supplier", "supplier_id"),
    )
