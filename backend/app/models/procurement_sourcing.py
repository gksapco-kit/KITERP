# app/models/procurement_sourcing.py
from sqlalchemy import (
    Column, String, Text, Date, DateTime, Boolean,
    ForeignKey, Numeric, Integer, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class PurchasingInfoRecord(Base):
    """
    Vendor-material price/lead-time agreement — SAP ME11 / EINE equivalent.
    Stores the agreed price, min/max order qty, lead time, and validity window
    for a specific supplier↔product combination.
    """
    __tablename__ = "purchasing_info_record"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)

    # Pricing
    currency = Column(String(3), default="INR", nullable=False)
    price = Column(Numeric(14, 4), nullable=False, default=0)
    price_unit = Column(Integer, default=1)          # price per N units (e.g. price per 100 pcs)

    # Order quantity limits
    min_order_qty = Column(Numeric(12, 4), default=1)
    max_order_qty = Column(Numeric(12, 4), nullable=True)
    order_unit = Column(String(20), default="PCS")

    # Lead time
    lead_time_days = Column(Integer, default=0)
    planned_delivery_days = Column(Integer, default=0)  # GR processing + lead time

    # Validity
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)

    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier", lazy="noload")
    product = relationship("Product", foreign_keys=[product_id], lazy="noload")

    __table_args__ = (
        Index("ix_pir_vendor", "vendor_id"),
        Index("ix_pir_supplier", "vendor_id", "supplier_id"),
        Index("ix_pir_product", "vendor_id", "product_id"),
        Index("ix_pir_supplier_product", "vendor_id", "supplier_id", "product_id"),
    )


class SourceList(Base):
    """
    Authorised supply sources for a material — SAP ME01 / EORD equivalent.
    Controls which suppliers are allowed/preferred/blocked for a product,
    optionally per plant, with a validity period.
    """
    __tablename__ = "source_list"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)

    # Validity
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)

    # Source control flags
    is_fixed = Column(Boolean, default=False)    # fixed source — MRP always uses this supplier
    is_blocked = Column(Boolean, default=False)  # blocked — must not issue POs to this supplier
    priority = Column(Integer, default=0)         # lower = higher priority when multiple sources exist

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier", lazy="noload")
    product = relationship("Product", foreign_keys=[product_id], lazy="noload")

    __table_args__ = (
        Index("ix_sl_vendor", "vendor_id"),
        Index("ix_sl_product", "vendor_id", "product_id"),
        Index("ix_sl_supplier", "vendor_id", "supplier_id"),
        Index("ix_sl_product_supplier", "vendor_id", "product_id", "supplier_id"),
    )
