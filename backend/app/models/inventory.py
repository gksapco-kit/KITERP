# app/models/inventory.py
from sqlalchemy import (
    Column, String, Text, DateTime,
    ForeignKey, Integer, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class InventoryMovement(Base):
    """
    Tracks every stock change for a product or product variant.
    movement_type: stock_in, stock_out, adjustment, sale, sale_return, order_cancel, transfer

    document_number: human-readable document reference (e.g. GRC-000001, ADJ-000003).
      Generated automatically per movement type using DocumentSequence.
      NULL for rows created before inv010 migration (backfilled separately).
    document_line_no: 1-based line within the posting event (for multi-line PO receipts etc.)
    """
    __tablename__ = "inventory_movement"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"))

    movement_type = Column(String(30), nullable=False)
    # stock_in, stock_out, adjustment, sale, sale_return, order_cancel,
    # transfer, initial, purchase, purchase_return, stock_count

    quantity = Column(Integer, nullable=False)  # positive = in, negative = out
    quantity_before = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)

    reason = Column(Text)
    reference_type = Column(String(30))  # order, pos_transaction, manual, import
    reference_id = Column(UUID(as_uuid=True))

    # Document numbering — nullable so pre-migration rows remain valid
    document_number = Column(String(30), nullable=True)
    document_line_no = Column(Integer, nullable=False, default=1)

    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)
    to_store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)  # for transfers
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)
    to_storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    performed_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    extra_data = Column("metadata", JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product")

    __table_args__ = (
        Index("idx_inv_vendor", "vendor_id"),
        Index("idx_inv_product", "product_id"),
        Index("idx_inv_variant", "variant_id"),
        Index("idx_inv_type", "movement_type"),
        Index("idx_inv_created", "created_at"),
        Index("idx_inv_ref", "reference_type", "reference_id"),
        Index("idx_inv_docnum", "vendor_id", "document_number"),
        UniqueConstraint(
            "vendor_id", "document_number", "document_line_no",
            name="uq_inv_mvt_docnum_line",
        ),
    )
