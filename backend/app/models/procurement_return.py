# app/models/procurement_return.py
"""
Purchase Return (PRET) — Phase 9 procurement module.

A PurchaseReturn document tracks goods returned to a supplier.

Sources:
  - A GRN line (goods received but rejected by QC or physically damaged on arrival)
  - A standalone return (goods received earlier, now returned)

Workflow:
  draft → approved → goods_dispatched → supplier_confirmed → closed
  draft → cancelled

The return triggers:
  1. Inventory deduction (reverse GoodsMovementDocument with movement_type return_to_vendor)
  2. A Debit Note (credit to AP) in the finance module
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


class PurchaseReturn(Base):
    """Purchase Return header."""
    __tablename__ = "purchase_return"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    return_number = Column(String(30), nullable=False)
    status = Column(String(30), nullable=False, default="draft")
    # draft | approved | goods_dispatched | supplier_confirmed | closed | cancelled

    # Source references
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="RESTRICT"), nullable=False)
    grn_id = Column(UUID(as_uuid=True), ForeignKey("grn.id", ondelete="SET NULL"), nullable=True)

    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)

    return_date = Column(Date, nullable=False)
    return_reason = Column(String(50), nullable=False, default="quality_rejection")
    # quality_rejection | wrong_item | excess_delivery | damaged | other

    # Supplier approval reference
    supplier_return_authorization = Column(String(100), nullable=True)  # RMA / return authorisation number
    debit_note_reference = Column(String(100), nullable=True)          # our debit note number to supplier

    # Financials
    currency = Column(String(3), nullable=False, default="INR")
    subtotal = Column(Numeric(14, 2), default=0)
    tax_amount = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), default=0)

    # GL debit note link (set when debit note is raised)
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True)

    # Logistics
    dispatched_via = Column(String(100), nullable=True)   # courier / transporter name
    dispatch_date = Column(Date, nullable=True)
    tracking_number = Column(String(100), nullable=True)

    notes = Column(Text, nullable=True)
    audit_log = Column(JSONB, nullable=False, default=list)

    approved_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship(
        "PurchaseReturnLine",
        back_populates="purchase_return",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    supplier = relationship("Supplier", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("vendor_id", "return_number", name="uq_pret_vendor_number"),
        Index("ix_pret_vendor", "vendor_id"),
        Index("ix_pret_po", "purchase_order_id"),
        Index("ix_pret_status", "vendor_id", "status"),
        Index("ix_pret_supplier", "vendor_id", "supplier_id"),
    )


class PurchaseReturnLine(Base):
    """One line per product being returned."""
    __tablename__ = "purchase_return_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_return_id = Column(UUID(as_uuid=True), ForeignKey("purchase_return.id", ondelete="CASCADE"), nullable=False)

    # Source GRN line (for traceability)
    grn_line_id = Column(UUID(as_uuid=True), ForeignKey("grn_line.id", ondelete="SET NULL"), nullable=True)
    po_item_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order_item.id", ondelete="RESTRICT"), nullable=False)

    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    batch_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)

    line_number = Column(Integer, nullable=False, default=1)
    unit_of_measure = Column(String(20), nullable=False, default="piece")

    return_qty = Column(Numeric(12, 4), nullable=False)
    unit_price = Column(Numeric(14, 4), nullable=False, default=0)

    # Tax
    cgst_rate = Column(Numeric(6, 2), default=0)
    sgst_rate = Column(Numeric(6, 2), default=0)
    igst_rate = Column(Numeric(6, 2), default=0)
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)

    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    tax_total = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    # Inventory deduction
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    reason = Column(Text, nullable=True)

    purchase_return = relationship("PurchaseReturn", back_populates="lines")
    product = relationship("Product", lazy="selectin")
    variant = relationship("ProductVariant", foreign_keys=[variant_id], lazy="selectin")

    __table_args__ = (
        Index("ix_pret_line_return", "purchase_return_id"),
        Index("ix_pret_line_product", "product_id"),
    )
