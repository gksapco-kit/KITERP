from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey,
    Numeric, Integer, Index, Date, Time, Boolean
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Booking(Base):
    __tablename__ = "booking"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=False, index=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id"))

    booking_number = Column(String(20), nullable=False, index=True)

    service_name = Column(String(255))
    service_price = Column(Numeric(12, 2), default=0)

    booking_date = Column(Date, nullable=False)
    start_time = Column(Time)
    end_time = Column(Time)
    duration_minutes = Column(Integer)

    status = Column(String(30), nullable=False, default="pending")
    # pending, confirmed, in_progress, completed, cancelled, no_show

    customer_name = Column(String(255))
    customer_email = Column(String(255))
    customer_phone = Column(String(20))

    notes = Column(Text)
    cancel_reason = Column(Text)

    assigned_to = Column(UUID(as_uuid=True), ForeignKey("user.id"))

    subtotal = Column(Numeric(12, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), default=0)

    payment_status = Column(String(20), default="pending")
    payment_method = Column(String(30))

    invoice_id = Column(UUID(as_uuid=True), nullable=True)
    order_id = Column(UUID(as_uuid=True), nullable=True)

    # Staff assignment
    assigned_staff_id = Column(UUID(as_uuid=True), nullable=True)
    assigned_staff_name = Column(String(255), nullable=True)
    completed_by_id = Column(UUID(as_uuid=True), nullable=True)
    completed_by_name = Column(String(255), nullable=True)
    delivery_notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)

    # History, followups, media
    status_history = Column(JSONB, default=list)
    followups = Column(JSONB, default=list)
    attachments = Column(JSONB, default=list)

    metadata_ = Column("metadata", JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    completion_otp = Column(String(10), nullable=True)
    completion_otp_expires_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_booking_vendor_status", "vendor_id", "status"),
        Index("ix_booking_vendor_date", "vendor_id", "booking_date"),
        Index("uq_booking_vendor_number", "vendor_id", "booking_number", unique=True),
    )
