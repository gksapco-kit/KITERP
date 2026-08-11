# app/models/customer.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date, ForeignKey,
    Numeric, Integer, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Customer(Base):
    __tablename__ = "customer"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    # Business unit this storefront account belongs to. NULL = legacy vendor-wide
    # (shared/global site with no active BU). Each BU website has its own accounts.
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True, index=True)
    # Default sales area for this customer (orders/invoices inherit when unset).
    sales_area_id = Column(UUID(as_uuid=True), ForeignKey("sales_area.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)

    # Profile
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20))
    linked_customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    # Password-reset OTP (mirrors user.verification_code)
    verification_code = Column(String(64), nullable=True)
    verification_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    avatar_url = Column(String(500))

    # Pricing group — drives which party price rules apply (retail, wholesale,
    # distributor, agent, dealer, vip, employee, institutional, government, custom).
    customer_group = Column(String(50), nullable=True, default="retail")

    # Business / GST
    gstin = Column(String(15), nullable=True)
    pan_number = Column(String(10), nullable=True)
    cin = Column(String(21), nullable=True)
    company_name = Column(String(255), nullable=True)
    billing_address = Column(JSONB, default={})

    notes = Column(Text, nullable=True)

    # Stage C — wholesale / GDP license (lite ship gate)
    wholesale_license_number = Column(String(80), nullable=True)
    wholesale_license_expires = Column(Date, nullable=True)

    # Bank Details
    bank_name = Column(String(100), nullable=True)
    account_number = Column(String(30), nullable=True)
    account_holder_name = Column(String(255), nullable=True)
    account_type = Column(String(20), default="savings")
    ifsc_code = Column(String(15), nullable=True)

    # Addresses
    shipping_addresses = Column(JSONB, default=[])
    default_address_index = Column(Integer, default=0)

    # Financial
    opening_balance = Column(Numeric(12, 2), default=0)

    notification_preferences = Column(JSONB, default=dict)

    # Stats
    is_active = Column(Boolean, default=True)
    total_orders = Column(Integer, default=0)
    total_spent = Column(Numeric(12, 2), default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    orders = relationship("Order", back_populates="customer", lazy="select")
    cart = relationship("Cart", back_populates="customer", uselist=False, lazy="select")
    wishlist = relationship("Wishlist", back_populates="customer", uselist=False, lazy="select")

    __table_args__ = (
        Index("ix_customer_email", "email"),
        Index("ix_customer_phone", "phone"),
        Index("ix_customer_linked", "linked_customer_id"),
        Index("ix_customer_vendor_store", "vendor_id", "store_id"),
    )
