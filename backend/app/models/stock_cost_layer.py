# app/models/stock_cost_layer.py
"""
FIFO cost layers for inventory valuation.

Each incoming stock event (stock_in, purchase receipt, initial) creates a
new layer with a unit_cost. When stock is consumed (sale, stock_out,
transfer) layers are consumed FIFO, cheapest-first among same date.

consumed_qty  ≤ received_qty
is_exhausted  = (consumed_qty >= received_qty)
"""
from sqlalchemy import (
    Column, String, Text, DateTime, Boolean,
    ForeignKey, Index, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base


class StockCostLayer(Base):
    __tablename__ = "stock_cost_layer"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    # Source movement that created this layer
    movement_id = Column(UUID(as_uuid=True), ForeignKey("inventory_movement.id", ondelete="SET NULL"), nullable=True)

    received_qty = Column(Numeric(12, 4), nullable=False)
    consumed_qty = Column(Numeric(12, 4), nullable=False, default=0)
    unit_cost = Column(Numeric(14, 6), nullable=False)  # per-unit cost at receipt

    # Snapshot of total cost for this layer
    total_cost = Column(Numeric(18, 6), nullable=False)   # received_qty * unit_cost

    is_exhausted = Column(Boolean, nullable=False, default=False)

    # Human-readable source type: purchase, stock_in, initial, production, adjustment
    source_type = Column(String(30), nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_scl_vendor_product", "vendor_id", "product_id"),
        Index("idx_scl_fifo", "vendor_id", "product_id", "variant_id", "is_exhausted", "created_at"),
        Index("idx_scl_movement", "movement_id"),
    )
