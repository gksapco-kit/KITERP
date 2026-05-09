# app/models/mrp.py
from sqlalchemy import (
    Column, String, Text, DateTime, Numeric,
    ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class ProductBOMItem(Base):
    """
    Bill of Materials: maps a finished product to its component raw materials.
    qty_per_unit = how many units of component_id are needed to produce 1 unit of product_id.
    """
    __tablename__ = "product_bom_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    qty_per_unit = Column(Numeric(12, 4), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", foreign_keys=[product_id])
    component = relationship("Product", foreign_keys=[component_id])

    __table_args__ = (
        Index("idx_bom_vendor", "vendor_id"),
        Index("idx_bom_product", "product_id"),
        Index("idx_bom_component", "component_id"),
    )


class StockReservation(Base):
    """
    Reserves a quantity of a product for a specific order so it cannot
    be allocated to other orders.
    order_type: "production_order" | "sales_order"
    order_id: local UUID string for production orders; UUID for sales orders
    status: active | released | consumed
    """
    __tablename__ = "stock_reservation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    order_type = Column(String(30), nullable=False)
    order_id = Column(String(100), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    reserved_qty = Column(Numeric(12, 4), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    released_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("Product")

    __table_args__ = (
        Index("idx_resv_vendor", "vendor_id"),
        Index("idx_resv_order", "order_type", "order_id"),
        Index("idx_resv_product", "product_id"),
        Index("idx_resv_status", "status"),
    )
