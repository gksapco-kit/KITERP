# app/models/procurement_quotation.py
"""
Supplier Quotation — Phase 4 procurement module.

A SupplierQuotation is the supplier's formal response to an RFQ.
It can also be entered manually (without an RFQ) as a spot quote.

Tables:
  SupplierQuotation       – Quote header linked to RFQ + Supplier
  SupplierQuotationItem   – Per-line price / lead-time / MOQ details
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


class SupplierQuotation(Base):
    """
    A supplier's response to an RFQ (or a standalone spot quote).

    status:
      draft → submitted → under_review → (accepted | rejected | expired)

    quote_type:
      rfq_response  – formal response to an issued RFQ
      spot_quote    – standalone quote not linked to an RFQ
      proforma      – proforma invoice quote from supplier

    source:
      email | phone | portal | manual
        - portal: supplier submitted through the self-service token URL
        - manual: buyer entered quote received informally
    """
    __tablename__ = "supplier_quotation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)

    # Optional RFQ link
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfq.id", ondelete="SET NULL"), nullable=True)

    quotation_number = Column(String(30), nullable=False)           # internal SQ-000001
    supplier_reference = Column(String(100), nullable=True)         # supplier's own quote ref

    status = Column(String(30), nullable=False, default="draft")
    # draft | submitted | under_review | accepted | rejected | expired

    quote_type = Column(String(30), nullable=False, default="rfq_response")
    source = Column(String(20), nullable=False, default="manual")

    # Validity
    quote_date = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=True)

    # Financials
    currency = Column(String(3), nullable=False, default="INR")
    exchange_rate = Column(Numeric(12, 6), default=1)
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(14, 2), default=0)
    freight_amount = Column(Numeric(14, 2), default=0)
    other_charges = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    # Terms
    payment_terms = Column(String(100), nullable=True)
    delivery_terms = Column(String(100), nullable=True)     # Incoterms
    delivery_lead_time_days = Column(Integer, nullable=True)

    # GST / Tax details
    cgst_amount = Column(Numeric(14, 2), default=0)
    sgst_amount = Column(Numeric(14, 2), default=0)
    igst_amount = Column(Numeric(14, 2), default=0)

    notes = Column(Text, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)
    audit_log = Column(JSONB, nullable=False, default=list)

    submitted_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship(
        "SupplierQuotationItem",
        back_populates="quotation",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    supplier = relationship("Supplier", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("vendor_id", "quotation_number", name="uq_sq_vendor_number"),
        Index("ix_sq_vendor", "vendor_id"),
        Index("ix_sq_vendor_status", "vendor_id", "status"),
        Index("ix_sq_rfq", "rfq_id"),
        Index("ix_sq_supplier", "vendor_id", "supplier_id"),
    )


class SupplierQuotationItem(Base):
    """
    Line item on a supplier quotation.

    Links back to the original RFQ line (rfq_item_id) for comparison purposes.
    Each line captures the supplier's offered price, MOQ, lead time, and tax rates.
    """
    __tablename__ = "supplier_quotation_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("supplier_quotation.id", ondelete="CASCADE"), nullable=False)

    # Link back to the RFQ line (for comparison engine in Phase 5)
    rfq_item_id = Column(UUID(as_uuid=True), ForeignKey("rfq_item.id", ondelete="SET NULL"), nullable=True)

    line_number = Column(Integer, nullable=False, default=1)
    item_type = Column(String(20), nullable=False, default="product")

    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)

    # Quantities
    quantity = Column(Numeric(12, 4), nullable=False, default=1)
    unit_of_measure = Column(String(20), nullable=False, default="piece")
    min_order_quantity = Column(Numeric(12, 4), nullable=True)

    # Pricing
    unit_price = Column(Numeric(14, 4), nullable=False, default=0)
    discount_pct = Column(Numeric(6, 2), default=0)
    discount_amount = Column(Numeric(14, 4), default=0)
    net_unit_price = Column(Numeric(14, 4), nullable=False, default=0)    # after discount

    # Tax
    hsn_code = Column(String(10), nullable=True)
    tax_code = Column(String(20), nullable=True)
    cgst_rate = Column(Numeric(6, 2), default=0)
    sgst_rate = Column(Numeric(6, 2), default=0)
    igst_rate = Column(Numeric(6, 2), default=0)
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)

    # Totals
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    tax_total = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    # Delivery details per line
    lead_time_days = Column(Integer, nullable=True)
    delivery_date = Column(Date, nullable=True)

    notes = Column(Text, nullable=True)

    quotation = relationship("SupplierQuotation", back_populates="items")
    product = relationship("Product", lazy="selectin")
    variant = relationship("ProductVariant", foreign_keys=[variant_id], lazy="selectin")

    __table_args__ = (
        Index("ix_sqi_quotation", "quotation_id"),
        Index("ix_sqi_rfq_item", "rfq_item_id"),
        Index("ix_sqi_product", "product_id"),
    )
