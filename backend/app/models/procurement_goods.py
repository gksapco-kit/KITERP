# app/models/procurement_goods.py
from sqlalchemy import (
    Column, String, Text, Date, DateTime, Boolean,
    ForeignKey, Numeric, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class GoodsBatch(Base):
    """
    Batch / serial / expiry tracking for goods received into stock.
    Each row represents a distinct batch of a product at a plant/storage-location.

    quality_status:
      unrestricted     — available for production/sale
      quality_inspection — quarantined pending QC
      blocked          — rejected / held

    source_type: purchase | production | transfer
    """
    __tablename__ = "goods_batch"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    batch_number = Column(String(50), nullable=False)
    serial_numbers = Column(JSONB, default=list)      # list of serial number strings when serialised

    # Dates
    manufacturing_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    best_before_date = Column(Date, nullable=True)

    # Location
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    # Quantities
    quantity_received = Column(Numeric(12, 4), nullable=False, default=0)
    quantity_available = Column(Numeric(12, 4), nullable=False, default=0)
    quantity_reserved = Column(Numeric(12, 4), default=0)
    quantity_consumed = Column(Numeric(12, 4), default=0)

    # Source
    source_type = Column(String(20), nullable=True)    # purchase | production | transfer
    source_id = Column(UUID(as_uuid=True), nullable=True)  # receipt or production order id

    # Stock quality classification
    quality_status = Column(String(30), nullable=False, default="unrestricted")

    # Stage C GDP — lot storage condition (copied from product/SLoc on create when set)
    # ambient | refrigerated | frozen | controlled_room
    storage_condition = Column(String(30), nullable=True)

    supplier_batch_number = Column(String(50), nullable=True)  # as printed on supplier label
    notes = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", lazy="noload")

    __table_args__ = (
        Index("ix_gb_vendor", "vendor_id"),
        Index("ix_gb_product", "vendor_id", "product_id"),
        Index("ix_gb_batch", "vendor_id", "product_id", "batch_number"),
        Index("ix_gb_expiry", "expiry_date"),
        Index("ix_gb_location", "vendor_id", "plant_id", "storage_location_id"),
    )


class GoodsMovementDocument(Base):
    """
    Formal goods movement document linking inventory events to source documents.
    Extends InventoryMovement with procurement-specific attributes.

    movement_type is a descriptive code:
      gr_po             GR for purchase order
      gr_reversal       Reversal of GR for purchase order
      return_to_vendor  Return to vendor
      gi_cost_center    GI for cost center
      gi_production     GI for production order
      plant_transfer    Plant-to-plant transfer
      sloc_transfer     Storage-location transfer
      receipt_no_po     Receipt without a PO
    """
    __tablename__ = "goods_movement_document"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    document_number = Column(String(30), nullable=False)
    movement_type = Column(String(30), nullable=False)  # gr_po | gr_reversal | return_to_vendor | gi_cost_center | gi_production | plant_transfer | sloc_transfer | receipt_no_po

    # Source document reference
    po_receipt_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order_receipt.id", ondelete="SET NULL"), nullable=True)
    production_order_id = Column(UUID(as_uuid=True), ForeignKey("production_order.id", ondelete="SET NULL"), nullable=True)

    # Location
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    from_storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)
    to_storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    # Lines (product, qty, batch, quality_status per movement line)
    lines = Column(JSONB, nullable=False, default=list)

    posting_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    performed_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_gmd_vendor", "vendor_id"),
        Index("ix_gmd_type", "vendor_id", "movement_type"),
        Index("ix_gmd_po_receipt", "po_receipt_id"),
        Index("ix_gmd_production_order", "production_order_id"),
    )
