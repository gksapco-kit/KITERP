# app/models/procurement_grn.py
"""
GoodsReceiptNote (GRN) — Phase 7 procurement module.

Replaces the JSONB-based PurchaseOrderReceipt.items with first-class
relational lines.  The existing PurchaseOrderReceipt row is kept as the
GRN header; this adds a proper GRNLine table and a QC inspection sub-table.

Changes:
  GRNLine                   – one row per product/batch received, with qty
                              accepted / rejected / pending_qc
  GRNQCInspection           – QC result per line (pass/fail/hold, defect notes)
  GRNReversal               – cancellation / return document header
  GRNReversalLine           – reversal quantities per GRN line

The GRN workflow:
  draft → posted → qc_pending → qc_done → (closed | reversed)
"""
from __future__ import annotations

import uuid
from sqlalchemy import (
    Column, String, Text, Date, DateTime, Boolean,
    ForeignKey, Numeric, Integer, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class GoodsReceiptNote(Base):
    """
    GRN header document.  One GRN per physical delivery event.

    Replaces / extends PurchaseOrderReceipt for proper 3-way matching.
    Keeps a FK to the original receipt row so existing data is not lost.

    status:
      draft → posted → qc_pending → qc_done → closed | reversed
    """
    __tablename__ = "grn"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    grn_number = Column(String(30), nullable=False)

    # Source document references
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="RESTRICT"), nullable=False)
    legacy_receipt_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order_receipt.id", ondelete="SET NULL"), nullable=True)

    status = Column(String(30), nullable=False, default="draft")
    # draft | posted | qc_pending | qc_done | closed | reversed

    # Posting details
    posting_date = Column(Date, nullable=True)
    document_date = Column(Date, nullable=True)   # date on supplier's delivery challan

    # Supplier delivery reference
    supplier_delivery_number = Column(String(100), nullable=True)   # supplier's DN/DC number
    supplier_invoice_reference = Column(String(100), nullable=True)

    # Destination
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    # QC control
    requires_qc = Column(Boolean, default=False)
    qc_completed_at = Column(DateTime(timezone=True), nullable=True)
    qc_completed_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    # Totals (computed from lines)
    total_ordered_qty = Column(Numeric(12, 4), default=0)
    total_received_qty = Column(Numeric(12, 4), default=0)
    total_accepted_qty = Column(Numeric(12, 4), default=0)
    total_rejected_qty = Column(Numeric(12, 4), default=0)

    notes = Column(Text, nullable=True)
    audit_log = Column(JSONB, nullable=False, default=list)

    received_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship(
        "GRNLine",
        back_populates="grn",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    purchase_order = relationship("PurchaseOrder", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("vendor_id", "grn_number", name="uq_grn_vendor_number"),
        Index("ix_grn_vendor", "vendor_id"),
        Index("ix_grn_po", "purchase_order_id"),
        Index("ix_grn_status", "vendor_id", "status"),
    )


class GRNLine(Base):
    """
    One line per product / batch received in a GRN.

    Tracks quantities at three stages of the QC process:
      received_qty       – what arrived physically
      accepted_qty       – what passed QC (or all received if no QC)
      rejected_qty       – what failed QC (to be returned)
      pending_qc_qty     – received but not yet inspected

    Links back to the original PO line for 3-way match.
    """
    __tablename__ = "grn_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_id = Column(UUID(as_uuid=True), ForeignKey("grn.id", ondelete="CASCADE"), nullable=False)

    # PO line reference (for 3-way match)
    po_item_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order_item.id", ondelete="RESTRICT"), nullable=False)

    # Product / batch
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    batch_number = Column(String(100), nullable=True)
    supplier_batch_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    manufacturing_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)

    line_number = Column(Integer, nullable=False, default=1)
    unit_of_measure = Column(String(20), nullable=False, default="piece")

    # Quantity tracking
    ordered_qty = Column(Numeric(12, 4), nullable=False, default=0)
    received_qty = Column(Numeric(12, 4), nullable=False, default=0)
    accepted_qty = Column(Numeric(12, 4), nullable=True)        # set after QC
    rejected_qty = Column(Numeric(12, 4), nullable=True, default=0)
    pending_qc_qty = Column(Numeric(12, 4), nullable=True)

    # Pricing (from PO line for valuation)
    unit_price = Column(Numeric(14, 4), nullable=True)

    # Inventory posting details
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)
    goods_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True)

    qc_status = Column(String(20), nullable=False, default="not_required")
    # not_required | pending | passed | failed | partial_pass | hold

    notes = Column(Text, nullable=True)

    grn = relationship("GoodsReceiptNote", back_populates="lines")
    product = relationship("Product", lazy="selectin")
    variant = relationship("ProductVariant", foreign_keys=[variant_id], lazy="selectin")
    qc_inspection = relationship(
        "GRNQCInspection",
        back_populates="grn_line",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_grn_line_grn", "grn_id"),
        Index("ix_grn_line_po_item", "po_item_id"),
        Index("ix_grn_line_product", "product_id"),
    )


class GRNQCInspection(Base):
    """QC inspection result for a single GRN line."""
    __tablename__ = "grn_qc_inspection"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_line_id = Column(UUID(as_uuid=True), ForeignKey("grn_line.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Inspection outcome
    result = Column(String(20), nullable=False, default="pending")
    # pending | passed | failed | partial_pass | hold

    inspected_qty = Column(Numeric(12, 4), nullable=True)
    accepted_qty = Column(Numeric(12, 4), nullable=True)
    rejected_qty = Column(Numeric(12, 4), nullable=True)

    # Defect details
    defect_code = Column(String(50), nullable=True)
    defect_description = Column(Text, nullable=True)
    defect_photos = Column(JSONB, nullable=True)   # list of file URLs

    inspector_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    inspected_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    grn_line = relationship("GRNLine", back_populates="qc_inspection")

    __table_args__ = (
        Index("ix_grn_qc_line", "grn_line_id"),
    )


class GRNReversal(Base):
    """
    Reversal / cancellation document for a previously posted GRN.

    A reversal reduces the previously received quantities back into the PO
    open-to-receive balance.  The inventory movement is reversed.

    reversal_type:
      full     – reverses the entire GRN
      partial  – reverses selected lines / quantities
      return   – goods physically returned to supplier (triggers purchase-return flow)
    """
    __tablename__ = "grn_reversal"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    grn_id = Column(UUID(as_uuid=True), ForeignKey("grn.id", ondelete="RESTRICT"), nullable=False)

    reversal_number = Column(String(30), nullable=False)
    reversal_type = Column(String(20), nullable=False, default="partial")
    # full | partial | return

    reversal_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="draft")
    # draft | posted | cancelled

    notes = Column(Text, nullable=True)
    audit_log = Column(JSONB, nullable=False, default=list)

    reversed_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship(
        "GRNReversalLine",
        back_populates="reversal",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("vendor_id", "reversal_number", name="uq_grn_rev_vendor_number"),
        Index("ix_grn_rev_vendor", "vendor_id"),
        Index("ix_grn_rev_grn", "grn_id"),
    )


class GRNReversalLine(Base):
    """Quantity being reversed for one GRN line."""
    __tablename__ = "grn_reversal_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reversal_id = Column(UUID(as_uuid=True), ForeignKey("grn_reversal.id", ondelete="CASCADE"), nullable=False)
    grn_line_id = Column(UUID(as_uuid=True), ForeignKey("grn_line.id", ondelete="RESTRICT"), nullable=False)

    reversed_qty = Column(Numeric(12, 4), nullable=False)
    reason = Column(Text, nullable=True)

    reversal = relationship("GRNReversal", back_populates="lines")

    __table_args__ = (
        Index("ix_grn_rev_line_reversal", "reversal_id"),
        Index("ix_grn_rev_line_grn_line", "grn_line_id"),
    )
