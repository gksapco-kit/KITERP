# app/models/order.py
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey,
    Numeric, Integer, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Order(Base):
    __tablename__ = "order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String(20), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=False, index=True)

    # Items snapshot (JSONB array)
    items = Column(JSONB, default=[])
    item_count = Column(Integer, default=0)

    # Pricing
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    shipping_amount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    # Status
    # pending → confirmed → processing → shipped → delivered → (return_requested / exchange_requested)
    # also: cancelled, refunded, returned, exchanged
    status = Column(
        String(30), nullable=False, default="pending", index=True
    )

    # Payment
    payment_status = Column(
        String(30), nullable=False, default="pending"
    )  # pending, paid, failed, refunded, partially_refunded
    payment_method = Column(String(30))
    payment_reference = Column(String(255))

    # Shipping
    shipping_address = Column(JSONB)
    tracking_number = Column(String(100))
    tracking_url = Column(String(500))
    delivery_staff_id = Column(UUID(as_uuid=True), nullable=True)
    delivery_staff_name = Column(String(255), nullable=True)
    delivery_assigned_at = Column(DateTime(timezone=True), nullable=True)
    delivery_status = Column(String(30), nullable=True)  # assigned, out_for_delivery, delivered

    # Source: online, pos, booking
    source = Column(String(20), default="online", index=True)
    pos_transaction_id = Column(UUID(as_uuid=True), nullable=True)

    # Coupon
    coupon_code = Column(String(50), nullable=True)

    # Notes & cancellation
    notes = Column(Text)
    cancel_reason = Column(Text)
    # Evidence files: [{ "url": str, "kind": "image"|"video" }, ...]
    cancel_attachments = Column(JSONB, default=list)

    # Return / Exchange
    return_type = Column(String(20))  # return, exchange
    return_reason = Column(Text)
    return_status = Column(String(30))  # requested, approved, rejected, completed
    return_requested_at = Column(DateTime(timezone=True))
    return_resolved_at = Column(DateTime(timezone=True))
    return_notes = Column(Text)  # vendor notes on resolution
    refund_amount = Column(Numeric(12, 2), default=0)
    return_tracking_number = Column(String(100))
    return_tracking_url = Column(String(500))
    # Evidence files for return/exchange request
    return_attachments = Column(JSONB, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True))
    shipped_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))

    # Relationships
    customer = relationship("Customer", back_populates="orders")
    payments = relationship("Payment", back_populates="order", lazy="selectin")
    status_history = relationship("OrderStatusHistory", back_populates="order", order_by="OrderStatusHistory.timestamp", lazy="selectin")

    __table_args__ = (
        Index("ix_order_vendor_status", "vendor_id", "status"),
        Index("ix_order_vendor_created", "vendor_id", "created_at"),
        Index("uq_order_vendor_number", "vendor_id", "order_number", unique=True),
    )


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String(30))
    to_status = Column(String(30), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    changed_by_role = Column(String(20))  # vendor, customer, system
    notes = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("Order", back_populates="status_history")
