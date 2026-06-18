# app/models/customer.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey,
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
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)

    # Profile
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20))
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(String(500))

    # Business / GST
    gstin = Column(String(15), nullable=True)
    pan_number = Column(String(10), nullable=True)
    cin = Column(String(21), nullable=True)
    company_name = Column(String(255), nullable=True)
    billing_address = Column(JSONB, default={})

    notes = Column(Text, nullable=True)

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
        Index(
            "ix_customer_vendor_email", "vendor_id", "email",
            unique=True,
            postgresql_where=Column("email").isnot(None),
        ),
        Index(
            "ix_customer_vendor_phone", "vendor_id", "phone",
            unique=True,
            postgresql_where=Column("phone").isnot(None),
        ),
    )
