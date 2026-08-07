from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean,
    Numeric, Integer, Index, Date
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Invoice(Base):
    __tablename__ = "invoice"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"))
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id"))
    # Business unit (store) this invoice is attributed to. Nullable for vendors with no store records.
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True, index=True)
    # Sales & Distribution: Business Unit x Distribution Channel x Division this invoice was posted under.
    sales_area_id = Column(UUID(as_uuid=True), ForeignKey("sales_area.id", ondelete="SET NULL"), nullable=True, index=True)

    invoice_number = Column(String(30), nullable=False, index=True)
    invoice_type = Column(String(20), default="invoice")  # estimate, invoice, receipt, credit_note
    document_type = Column(String(20), default="tax_invoice")  # tax_invoice, bill_of_supply

    # Customer details snapshot
    customer_name = Column(String(255))
    customer_email = Column(String(255))
    customer_phone = Column(String(20))
    customer_gstin = Column(String(15))
    billing_address = Column(JSONB)
    shipping_address = Column(JSONB)

    # Vendor tax details snapshot
    vendor_name = Column(String(255))
    vendor_gstin = Column(String(15))
    vendor_pan = Column(String(10))
    vendor_address = Column(JSONB)

    # Line items
    items = Column(JSONB, default=[])
    # Each: {name, description, hsn_sac, qty, rate, discount, taxable_value, cgst_rate, cgst_amt, sgst_rate, sgst_amt, igst_rate, igst_amt, total}
    item_count = Column(Integer, default=0)

    # Totals
    subtotal = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    taxable_amount = Column(Numeric(12, 2), default=0)
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)
    total_tax = Column(Numeric(12, 2), default=0)
    round_off = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    amount_paid = Column(Numeric(12, 2), default=0)
    balance_due = Column(Numeric(12, 2), default=0)

    # Financial year
    financial_year = Column(String(10))  # e.g. "2025-26"
    sequence_number = Column(Integer)

    # Status
    status = Column(String(20), default="draft")  # draft, sent, paid, partially_paid, overdue, cancelled
    due_date = Column(Date)
    payment_terms = Column(String(100))

    # References
    order_number = Column(String(30), nullable=True)
    booking_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    booking_number = Column(String(30), nullable=True)
    reference_invoice_id = Column(UUID(as_uuid=True))  # for credit notes
    converted_from_id = Column(UUID(as_uuid=True))  # estimate -> invoice conversion
    # Phase-5: link to the outbound delivery that triggered this billing document
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("delivery.id", ondelete="SET NULL"), nullable=True, index=True)

    is_gst = Column(Boolean, default=True)
    place_of_supply = Column(String(100))
    is_inter_state = Column(Boolean, default=False)

    notes = Column(Text)
    terms_and_conditions = Column(Text)
    # Quotation-only custom fields: [{id, label, type, value}] — type: text|email|phone|link|image
    extra_fields = Column(JSONB, default=list)

    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_invoice_vendor_type", "vendor_id", "invoice_type"),
        Index("ix_invoice_vendor_status", "vendor_id", "status"),
        Index("ix_invoice_vendor_store", "vendor_id", "store_id"),
        Index("ix_invoice_sales_area", "vendor_id", "sales_area_id"),
        Index("ix_invoice_number", "vendor_id", "invoice_number", unique=True),
    )
