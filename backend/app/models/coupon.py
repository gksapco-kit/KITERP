from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean,
    Numeric, Integer, Index, Date
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Coupon(Base):
    __tablename__ = "coupon"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)

    code = Column(String(50), nullable=False, index=True)
    title = Column(String(255))
    description = Column(Text)

    discount_type = Column(String(20), nullable=False)  # percentage, flat
    discount_value = Column(Numeric(12, 2), nullable=False)
    max_discount = Column(Numeric(12, 2))  # cap for percentage discounts
    min_order_amount = Column(Numeric(12, 2), default=0)

    usage_limit = Column(Integer)  # total uses allowed, null = unlimited
    usage_per_customer = Column(Integer, default=1)
    times_used = Column(Integer, default=0)

    applicable_to = Column(String(20), default="all")  # all, products, services, categories
    applicable_ids = Column(JSONB, default=[])  # product/service/category IDs

    starts_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))

    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=True)  # visible on business front

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_coupon_vendor_code", "vendor_id", "code", unique=True),
        Index("ix_coupon_vendor_active", "vendor_id", "is_active"),
    )


class CouponUsage(Base):
    __tablename__ = "coupon_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coupon_id = Column(UUID(as_uuid=True), ForeignKey("coupon.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=False)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id"))
    discount_applied = Column(Numeric(12, 2), default=0)
    used_at = Column(DateTime(timezone=True), server_default=func.now())
