# app/models/procurement_invoice.py
from sqlalchemy import (
    Column, String, Text, Date, DateTime, Boolean,
    ForeignKey, Numeric, Integer, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class VendorInvoice(Base):
    """
    AP bill issued by a supplier against a Purchase Order — SAP MIRO equivalent.
    Supports 3-way matching (PO ↔ GR ↔ Invoice) before releasing for payment.

    status: draft | posted | matched | partial_match | blocked | paid | cancelled
    match_status: unmatched | matched | partial | blocked_qty | blocked_price
    """
    __tablename__ = "vendor_invoice"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="RESTRICT"), nullable=True)

    # Invoice identification
    invoice_number = Column(String(50), nullable=False)           # internal reference
    supplier_invoice_number = Column(String(50), nullable=True)   # supplier's own ref number

    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    posting_date = Column(Date, nullable=True)

    status = Column(String(30), nullable=False, default="draft")
    match_status = Column(String(30), nullable=False, default="unmatched")

    # Amounts
    currency = Column(String(3), default="INR", nullable=False)
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    cgst_amount = Column(Numeric(14, 2), default=0)
    sgst_amount = Column(Numeric(14, 2), default=0)
    igst_amount = Column(Numeric(14, 2), default=0)
    tax_amount = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    # Payment
    amount_paid = Column(Numeric(14, 2), default=0)
    amount_due = Column(Numeric(14, 2), default=0)
    payment_terms = Column(String(50), nullable=True)

    # Block reason when match_status = blocked_qty / blocked_price
    block_reason = Column(Text, nullable=True)

    notes = Column(Text, nullable=True)
    audit_log = Column(JSONB, nullable=False, default=list)

    posted_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier", lazy="selectin")
    items = relationship(
        "VendorInvoiceItem",
        back_populates="invoice",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("vendor_id", "invoice_number", name="uq_vendor_invoice_number"),
        Index("ix_vi_vendor", "vendor_id"),
        Index("ix_vi_supplier", "vendor_id", "supplier_id"),
        Index("ix_vi_po", "purchase_order_id"),
        Index("ix_vi_status", "vendor_id", "status"),
        Index("ix_vi_match", "vendor_id", "match_status"),
    )


class VendorInvoiceItem(Base):
    """
    Line item on a vendor invoice linked to a PO item.
    Stores the 3-way match result (ordered qty vs received qty vs invoiced qty / price).
    """
    __tablename__ = "vendor_invoice_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("vendor_invoice.id", ondelete="CASCADE"), nullable=False)
    po_item_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order_item.id", ondelete="RESTRICT"), nullable=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    # Quantities for 3-way match
    ordered_qty = Column(Numeric(12, 4), default=0)    # from PO line
    received_qty = Column(Numeric(12, 4), default=0)   # from GR (goods receipts against PO line)
    invoiced_qty = Column(Numeric(12, 4), nullable=False)

    # Prices for 3-way match
    po_unit_price = Column(Numeric(14, 4), default=0)   # agreed price from PO
    unit_price = Column(Numeric(14, 4), nullable=False)  # price on supplier's invoice

    hsn_code = Column(String(10), nullable=True)
    tax_code = Column(String(20), nullable=True)
    cgst_rate = Column(Numeric(6, 2), default=0)
    sgst_rate = Column(Numeric(6, 2), default=0)
    igst_rate = Column(Numeric(6, 2), default=0)
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)

    subtotal = Column(Numeric(14, 2), default=0)
    tax_total = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    # 3-way match result per line
    qty_variance = Column(Numeric(12, 4), default=0)    # invoiced_qty - received_qty
    price_variance = Column(Numeric(14, 4), default=0)  # unit_price - po_unit_price
    match_status = Column(String(20), default="unmatched")
    # unmatched | matched | blocked_qty | blocked_price

    notes = Column(Text, nullable=True)

    invoice = relationship("VendorInvoice", back_populates="items")
    product = relationship("Product", lazy="selectin")

    __table_args__ = (
        Index("ix_vii_invoice", "invoice_id"),
        Index("ix_vii_po_item", "po_item_id"),
        Index("ix_vii_product", "product_id"),
    )
