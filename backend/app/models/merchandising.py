# app/models/merchandising.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime,
    ForeignKey, Numeric, Integer, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Bundle(Base):
    __tablename__ = "bundle"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text)
    discount_type = Column(String(20), default="none")  # none | percentage | fixed
    discount_value = Column(Numeric(12, 2), default=0)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", backref="bundles")
    items = relationship("BundleItem", back_populates="bundle", cascade="all, delete-orphan", order_by="BundleItem.sort_order")

    __table_args__ = (
        Index("idx_bundle_vendor", "vendor_id"),
        Index("idx_bundle_slug", "vendor_id", "slug", unique=True),
        Index("idx_bundle_active", "vendor_id", "is_active"),
    )


class BundleItem(Base):
    __tablename__ = "bundle_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bundle_id = Column(UUID(as_uuid=True), ForeignKey("bundle.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    sort_order = Column(Integer, default=0)

    bundle = relationship("Bundle", back_populates="items")
    product = relationship("Product")

    __table_args__ = (
        UniqueConstraint("bundle_id", "product_id", name="uq_bundle_product"),
        Index("idx_bundle_item_bundle", "bundle_id"),
    )


class UpsellMapping(Base):
    """
    Directional link: source_product → target_product.
    relation_type: 'cross_sell' (complementary) | 'upsell' (upgrade)
    trigger_stage: where the suggestion surfaces.
    """
    __tablename__ = "upsell_mapping"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    source_product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    target_type = Column(String(20), nullable=False, default="product")  # product | category
    target_product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=True)
    target_category = Column(String(100), nullable=True)

    relation_type = Column(String(20), nullable=False)   # cross_sell | upsell
    bundle_id = Column(UUID(as_uuid=True), ForeignKey("bundle.id", ondelete="SET NULL"), nullable=True)
    trigger_stage = Column(String(20), nullable=False, default="PDP")  # PDP | CART | CHECKOUT
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor")
    source_product = relationship("Product", foreign_keys=[source_product_id], backref="outgoing_mappings")
    target_product = relationship("Product", foreign_keys=[target_product_id], backref="incoming_mappings")
    bundle = relationship("Bundle")

    __table_args__ = (
        CheckConstraint("target_type IN ('product', 'category')", name="ck_target_type"),
        CheckConstraint(
            "(target_type = 'product' AND target_product_id IS NOT NULL) OR "
            "(target_type = 'category' AND target_category IS NOT NULL)",
            name="ck_target_filled",
        ),
        CheckConstraint("source_product_id != target_product_id OR target_product_id IS NULL", name="ck_no_self_link"),
        CheckConstraint("relation_type IN ('cross_sell', 'upsell')", name="ck_relation_type"),
        CheckConstraint("trigger_stage IN ('PDP', 'CART', 'CHECKOUT')", name="ck_trigger_stage"),
        Index("idx_upsell_lookup", "vendor_id", "source_product_id", "relation_type", "trigger_stage"),
        Index("idx_upsell_target", "target_product_id"),
        Index("idx_upsell_category", "vendor_id", "target_category"),
        Index("idx_upsell_bundle", "bundle_id"),
        Index("idx_upsell_priority", "source_product_id", "relation_type", "priority"),
    )
