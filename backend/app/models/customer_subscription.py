"""Active customer subscriptions for recurring product/service billing."""
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.database import Base


class CustomerSubscription(Base):
    __tablename__ = "customer_subscription"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=False, index=True)

    item_type = Column(String(20), nullable=False)  # product | service
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id"), nullable=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id"), nullable=True)

    item_name = Column(String(500), nullable=False)
    interval = Column(String(30), nullable=False)
    price_per_cycle = Column(Numeric(12, 2), nullable=False)
    qty = Column(Integer, default=1)
    currency = Column(String(10), default="INR")

    status = Column(String(20), default="active")  # trialing, active, paused, cancelled, expired
    schedule_config = Column(JSONB, default={})

    trial_ends_at = Column(DateTime(timezone=True))
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    next_billing_at = Column(DateTime(timezone=True))
    cancelled_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_customer_subscription_vendor_status", "vendor_id", "status"),
        Index("ix_customer_subscription_customer", "customer_id", "status"),
    )
