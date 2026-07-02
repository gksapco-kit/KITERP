# app/models/vendor_category.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class VendorCategory(Base):
    __tablename__ = "vendor_category"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("vendor_category.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(100), nullable=False)
    slug = Column(String(120), nullable=False)
    description = Column(String(500))
    image_url = Column(String(2000))

    # "product", "service", or "both"
    applies_to = Column(String(20), nullable=False, default="both")
    is_active = Column(Boolean, default=True)
    is_visible = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    # Configurable custom fields for products/services under this category
    # e.g. [{"name": "Color", "type": "select", "options": ["Red","Blue"]}, {"name": "Size", "type": "text"}]
    custom_fields = Column(JSONB, default=[])

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    children = relationship("VendorCategory", back_populates="parent", lazy="noload",
                            order_by="VendorCategory.sort_order, VendorCategory.name")
    parent = relationship("VendorCategory", back_populates="children", remote_side=[id], lazy="noload")

    __table_args__ = (
        Index("idx_vendor_category_vendor", "vendor_id"),
        Index("idx_vendor_category_slug", "vendor_id", "slug", unique=True),
        Index("idx_vendor_category_applies", "vendor_id", "applies_to"),
        Index("idx_vendor_category_parent", "vendor_id", "parent_id"),
    )
