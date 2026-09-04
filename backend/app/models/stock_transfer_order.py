# app/models/stock_transfer_order.py
from sqlalchemy import (
    Column, String, Text, DateTime, Integer,
    ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class StockTransferOrder(Base):
    """
    Formal stock transfer order between two stores (or storage locations).

    Workflow:
        draft → submitted → dispatched (stock in-transit) → received (completed)
        | cancelled (any pre-received state)

    When dispatched:  quantity deducted from from_store + InTransit record created.
    When received:    InTransit cleared + quantity added to to_store.
    """
    __tablename__ = "stock_transfer_order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    reference_number = Column(String(40), nullable=False)  # STO-YYYY-NNNN

    status = Column(String(20), nullable=False, default="draft")
    # draft | submitted | dispatched | received | cancelled

    from_store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="RESTRICT"), nullable=False)
    to_store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="RESTRICT"), nullable=False)

    from_storage_location_id = Column(
        UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True
    )
    to_storage_location_id = Column(
        UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True
    )

    notes = Column(Text, nullable=True)
    expected_date = Column(DateTime(timezone=True), nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    dispatched_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    received_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship("StockTransferOrderLine", back_populates="order", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_sto_vendor", "vendor_id"),
        Index("idx_sto_status", "vendor_id", "status"),
        Index("idx_sto_ref", "vendor_id", "reference_number"),
    )


class StockTransferOrderLine(Base):
    """One product/variant line within a transfer order."""
    __tablename__ = "stock_transfer_order_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stock_transfer_order.id", ondelete="CASCADE"),
        nullable=False,
    )
    vendor_id = Column(UUID(as_uuid=True), nullable=False)

    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    requested_qty = Column(Integer, nullable=False)
    dispatched_qty = Column(Integer, nullable=True)   # set on dispatch
    received_qty = Column(Integer, nullable=True)     # set on receipt (may differ from dispatched)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("StockTransferOrder", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")

    __table_args__ = (
        Index("idx_stol_order", "order_id"),
        Index("idx_stol_product", "product_id"),
    )
