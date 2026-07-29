# app/models/product_group.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey, Index, Integer,
    Numeric, CheckConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base

# A group can serve one or more purposes at once — kept as a tag list so a
# single group (e.g. "Diwali Combo") can double as a bundle AND a reporting tag.
PRODUCT_GROUP_TYPES = ("general", "pricing", "bundle", "reporting")

MAX_HIERARCHY_DEPTH = 6  # SAP PRODH supports 3 levels; we allow up to 6 (L0–L5)


class ProductGroup(Base):
    """SAP-style product group hierarchy.

    Supports up to MAX_HIERARCHY_DEPTH levels. Each group can have a
    parent_id pointing to another ProductGroup in the same vendor's tree.
    A materialized 'path' column (e.g. 'electronics/mobile/smartphones')
    enables efficient subtree queries via LIKE 'electronics/%'.

    Pricing resolution: walk up the ancestor chain and use the first
    node that has a non-'none' discount_type (most-specific wins).
    """
    __tablename__ = "product_group"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # ── Hierarchy ─────────────────────────────────────────────────────
    parent_id = Column(UUID(as_uuid=True), ForeignKey("product_group.id", ondelete="RESTRICT"), nullable=True)
    # Short SAP-style business code (e.g. "SERV-01", "PHARMA"). Optional.
    code = Column(String(30), nullable=True)
    # Depth in the tree: 0 = root, 1 = first-level child, etc.
    level = Column(Integer, nullable=False, default=0)
    # Materialized ancestor slug path: "electronics/mobile/phones"
    # Enables fast subtree queries with WHERE path LIKE '{path}/%'
    path = Column(String(2000), nullable=False, default="")

    # ── Basic info ────────────────────────────────────────────────────
    name = Column(String(150), nullable=False)
    slug = Column(String(170), nullable=False)
    description = Column(Text)
    image_url = Column(String(2000))

    # Subset of PRODUCT_GROUP_TYPES — what this group is used for.
    group_types = Column(JSONB, nullable=False, default=["general"])

    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    # ── Group-level pricing (used when "pricing" is in group_types) ───
    # If discount_type == "none", pricing is inherited from the nearest ancestor
    # that has a non-"none" discount (SAP-style condition resolution).
    discount_type = Column(String(20), default="none")   # none | percentage | fixed
    discount_value = Column(Numeric(12, 2), default=0)

    # ── Bundle / kit selling (used when "bundle" is in group_types) ───
    bundle_price = Column(Numeric(12, 2), nullable=True)  # fixed sell price for the bundle
    bundle_discount_type = Column(String(20), default="none")
    bundle_discount_value = Column(Numeric(12, 2), default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────
    children = relationship(
        "ProductGroup", back_populates="parent", lazy="noload",
        order_by="ProductGroup.sort_order, ProductGroup.name",
        foreign_keys="ProductGroup.parent_id",
    )
    parent = relationship(
        "ProductGroup", back_populates="children", lazy="noload",
        remote_side=[id], foreign_keys="ProductGroup.parent_id",
    )
    items = relationship(
        "ProductGroupItem", back_populates="group",
        cascade="all, delete-orphan", order_by="ProductGroupItem.sort_order",
    )

    __table_args__ = (
        Index("idx_product_group_vendor", "vendor_id"),
        Index("idx_product_group_slug", "vendor_id", "slug", unique=True),
        Index("idx_product_group_active", "vendor_id", "is_active"),
        Index("idx_product_group_parent", "vendor_id", "parent_id"),
        Index("idx_product_group_path", "vendor_id", "path"),
    )


class ProductGroupItem(Base):
    """One product or service that belongs to a ProductGroup (many-to-many member)."""
    __tablename__ = "product_group_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("product_group.id", ondelete="CASCADE"), nullable=False)

    item_type = Column(String(10), nullable=False)  # product | service
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="CASCADE"), nullable=True)

    # Recipe quantity — relevant when the group is sold as a bundle.
    quantity = Column(Numeric(12, 3), default=1)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("ProductGroup", back_populates="items")
    product = relationship("Product", foreign_keys=[product_id])
    service = relationship("Service", foreign_keys=[service_id])

    __table_args__ = (
        CheckConstraint(
            "(item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL) OR "
            "(item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL)",
            name="ck_product_group_item_type",
        ),
        Index("idx_product_group_item_group", "group_id"),
        Index(
            "idx_product_group_item_unique_product", "group_id", "product_id",
            unique=True, postgresql_where=text("product_id IS NOT NULL"),
        ),
        Index(
            "idx_product_group_item_unique_service", "group_id", "service_id",
            unique=True, postgresql_where=text("service_id IS NOT NULL"),
        ),
    )
