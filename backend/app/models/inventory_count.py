# app/models/inventory_count.py
from sqlalchemy import (
    Column, String, Text, DateTime, Date, Boolean, Integer,
    ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class StockCount(Base):
    """
    A stock-count session (cycle count, full physical count, or spot-check).

    Workflow:
        draft → in_progress (lines snap system_qty) → counting
        → under_review → completed (variances posted to InventoryMovement)
        | cancelled (any pre-completed state)

    When posted, every line with a non-zero variance creates an
    InventoryMovement of type 'stock_count' and updates StoreInventory.
    """
    __tablename__ = "stock_count"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    reference_number = Column(String(40), nullable=False)  # SC-2026-0001

    count_type = Column(
        String(20), nullable=False, default="cycle_count"
    )
    # cycle_count | full_count | spot_check

    status = Column(String(20), nullable=False, default="draft")
    # draft | in_progress | counting | under_review | completed | cancelled

    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(
        UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True
    )

    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    count_date = Column(Date, nullable=True)

    # Who created / performed / reviewed
    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    counted_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    # Freeze stock: prevent other movements while count is in progress
    freeze_stock = Column(Boolean, default=False)

    # Timestamps for lifecycle milestones
    started_at = Column(DateTime(timezone=True), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)  # when variances were applied
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship("StockCountLine", back_populates="count", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_sc_vendor", "vendor_id"),
        Index("idx_sc_status", "status"),
        Index("idx_sc_store", "vendor_id", "store_id"),
        Index("idx_sc_ref", "vendor_id", "reference_number"),
    )


class StockCountLine(Base):
    """
    One line in a StockCount — tracks a single product/variant at a location.
    variance = counted_qty - system_qty  (positive = surplus, negative = short)
    """
    __tablename__ = "stock_count_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    count_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stock_count.id", ondelete="CASCADE"),
        nullable=False,
    )
    vendor_id = Column(UUID(as_uuid=True), nullable=False)

    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(
        UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True
    )

    # Snapped from StoreInventory (or Product.quantity) when count starts
    system_qty = Column(Integer, nullable=False, default=0)

    # Filled by the counter during counting phase; NULL = not yet counted
    counted_qty = Column(Integer, nullable=True)

    # Computed at post time: counted_qty - system_qty
    variance = Column(Integer, nullable=True)

    status = Column(String(20), nullable=False, default="pending")
    # pending | counted | accepted

    notes = Column(Text, nullable=True)
    counted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    count = relationship("StockCount", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")

    __table_args__ = (
        Index("idx_scl_count", "count_id"),
        Index("idx_scl_product", "product_id"),
        UniqueConstraint(
            "count_id", "product_id", "variant_id", "storage_location_id",
            name="uq_scl_count_product_variant_location",
        ),
    )
