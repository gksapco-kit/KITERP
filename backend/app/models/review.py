# app/models/review.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime,
    ForeignKey, Integer, Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Review(Base):
    __tablename__ = "review"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="CASCADE"), nullable=False)

    # What is being reviewed
    review_type = Column(String(20), nullable=False)  # "product" or "service"
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="CASCADE"), nullable=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="SET NULL"), nullable=True)

    # Rating & content
    rating = Column(Integer, nullable=False)  # 1-5
    title = Column(String(255))
    comment = Column(Text)

    # Vendor reply
    reply = Column(Text)
    replied_at = Column(DateTime(timezone=True))

    # Moderation
    is_verified_purchase = Column(Boolean, default=False)
    is_visible = Column(Boolean, default=True)
    is_flagged = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    customer = relationship("Customer", backref="reviews")
    product = relationship("Product", backref="reviews")
    service = relationship("Service", backref="reviews")

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
        Index("ix_review_vendor", "vendor_id"),
        Index("ix_review_product", "product_id"),
        Index("ix_review_service", "service_id"),
        Index("ix_review_customer", "customer_id"),
        Index("ix_review_type_target", "review_type", "product_id", "service_id"),
    )
