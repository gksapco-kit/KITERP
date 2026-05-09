# app/models/cart.py
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Cart(Base):
    __tablename__ = "cart"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=False, index=True)

    # Items stored as JSONB array:
    # [{ "product_id": "...", "variant_id": "...", "name": "...",
    #    "qty": 1, "price": 10.00, "image_url": "..." }]
    items = Column(JSONB, default=[])

    # Coupon / Discount
    coupon_code = Column(String(50))
    discount_amount = Column(Numeric(12, 2), default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    customer = relationship("Customer", back_populates="cart")

    __table_args__ = (
        Index("ix_cart_vendor_customer", "vendor_id", "customer_id", unique=True),
    )
