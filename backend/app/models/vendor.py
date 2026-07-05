# app/models/vendor.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, Integer, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Vendor(Base):
    __tablename__ = "vendor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Basic Info
    business_name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    business_type = Column(String(50), nullable=False)
    industry = Column(String(100))
    description = Column(Text)
    offering_type = Column(String(20), default="both", nullable=False)  # "products", "services", "both"
    
    # Contact
    primary_email = Column(String(255), nullable=False)
    primary_phone = Column(String(20), nullable=False)
    support_email = Column(String(255))
    support_phone = Column(String(20))
    
    # Address
    street_address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    country = Column(String(100), default="India")
    latitude = Column(Numeric(10, 8))
    longitude = Column(Numeric(11, 8))
    service_radius_km = Column(Integer, default=10, nullable=False)
    
    # Tax / Compliance
    gstin = Column(String(15))
    pan_number = Column(String(10))
    is_gst_registered = Column(Boolean, default=False)
    default_tax_rate = Column(Numeric(5, 2), default=0)
    
    # Branding
    logo_url = Column(Text)
    banner_url = Column(Text)
    theme_config = Column(JSONB, default={})
    custom_css = Column(Text)
    
    # Subdomain/Domain
    subdomain = Column(String(100), unique=True, nullable=False, index=True)
    custom_domain = Column(String(255), unique=True)
    domain_verified = Column(Boolean, default=False)

    # External domain & delegated registrar access
    external_domain_enabled = Column(Boolean, default=False, nullable=False)
    external_domain_scope = Column(String(20), default='all', nullable=False)   # all | per_unit
    # How DNS is configured: kit_assisted (grant KIT ERP delegated registrar access)
    # or self_managed (vendor adds the DNS records themselves).
    external_domain_dns_mode = Column(String(20), default='kit_assisted', nullable=False)
    external_domain_name = Column(String(255), nullable=True)
    external_domain_registrar = Column(String(60), nullable=True)
    external_domain_reg_email = Column(String(255), nullable=True)
    external_domain_holder = Column(String(255), nullable=True)
    external_domain_expiry = Column(Date, nullable=True)
    # not_requested | pending | active | revoked
    external_domain_access_status = Column(String(30), default='not_requested', nullable=False)
    external_domain_recovery_contact = Column(String(255), nullable=True)
    external_domain_notes = Column(Text, nullable=True)
    external_domain_access_requested_at = Column(DateTime(timezone=True), nullable=True)
    external_domain_access_granted_at = Column(DateTime(timezone=True), nullable=True)

    # Status
    status = Column(String(30), default="pending", index=True)
    verification_status = Column(String(30), default="pending")
    verified_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    
    # Settings
    settings = Column(JSONB, default={
        "timezone": "Asia/Kolkata",
        "currency": "INR",
        "language": "en",
        "notifications": {"email": True, "sms": True, "push": True},
        "features": {"products": True, "services": True, "appointments": False, "blog": True}
    })
    
    # Business Hours
    business_hours = Column(JSONB, default={})
    store_holidays = Column(JSONB, default=list)  # [{date, label, closed?}]
    
    # Order Acceptance
    order_acceptance_enabled = Column(Boolean, default=True)
    order_acceptance_hours = Column(JSONB, default={})
    
    # Social Links
    social_links = Column(JSONB, default={})
    
    # Branded App Configuration
    app_config = Column(JSONB, default={})

    # Plan
    plan_id = Column(UUID(as_uuid=True), ForeignKey("vendor_plan.id"))
    plan_expires_at = Column(DateTime(timezone=True))

    # Platform relationship manager (support user with job_role relationship_manager)
    relationship_manager_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    activated_at = Column(DateTime(timezone=True))
    deactivated_at = Column(DateTime(timezone=True))

    # Relationships
    documents = relationship("VendorDocument", back_populates="vendor", cascade="all, delete-orphan")
    bank_accounts = relationship("VendorBankAccount", back_populates="vendor", cascade="all, delete-orphan")
    owners = relationship("VendorOwner", back_populates="vendor", cascade="all, delete-orphan")
    users = relationship("VendorUser", back_populates="vendor", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="vendor", cascade="all, delete-orphan")
    services = relationship("Service", back_populates="vendor", cascade="all, delete-orphan")
    relationship_manager = relationship(
        "User",
        foreign_keys=[relationship_manager_user_id],
    )
    rm_queries = relationship(
        "VendorRmQuery",
        back_populates="vendor",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_vendor_status_created", "status", "created_at"),
    )


class VendorDocument(Base):
    __tablename__ = "vendor_document"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(50), nullable=False)
    file_url = Column(Text, nullable=False)
    file_name = Column(String(255))
    file_size = Column(Numeric)
    mime_type = Column(String(100))
    status = Column(String(30), default="pending")
    rejection_reason = Column(Text)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="documents")

    __table_args__ = (
        Index("idx_vendor_document_vendor", "vendor_id"),
        Index("idx_vendor_document_status", "status"),
    )


class VendorBankAccount(Base):
    __tablename__ = "vendor_bank_account"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    bank_name = Column(String(255), nullable=False)
    account_number = Column(String(50), nullable=False)
    account_holder_name = Column(String(255), nullable=False)
    ifsc_code = Column(String(20), nullable=False)
    account_type = Column(String(30), default="savings")
    is_primary = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="bank_accounts")

    __table_args__ = (
        Index("idx_vendor_bank_vendor", "vendor_id"),
    )


class VendorOwner(Base):
    __tablename__ = "vendor_owner"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20))
    id_type = Column(String(50))  # aadhaar, pan, passport
    id_number = Column(String(100))
    designation = Column(String(100), default="Owner")
    is_primary = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="owners")
