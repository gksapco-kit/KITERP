# app/models/procurement.py
from sqlalchemy import (
    Column, String, Text, DateTime, Date,
    ForeignKey, Numeric, Integer, Index, Boolean, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Supplier(Base):
    __tablename__ = "supplier"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # party_type: supplier | employee | partner | contractor
    party_type = Column(String(20), nullable=False, server_default="supplier")

    name = Column(String(255), nullable=False)
    contact_name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(30))
    address = Column(JSONB, default={})
    notes = Column(Text)
    is_active = Column(Boolean, default=True)

    # Business / GST
    gstin = Column(String(15), nullable=True)
    pan_number = Column(String(10), nullable=True)
    cin = Column(String(21), nullable=True)
    company_name = Column(String(255), nullable=True)

    # Financial
    opening_balance = Column(Numeric(12, 2), default=0)

    # Bank Details
    bank_name = Column(String(100), nullable=True)
    account_number = Column(String(30), nullable=True)
    account_holder_name = Column(String(255), nullable=True)
    account_type = Column(String(20), default="savings")
    ifsc_code = Column(String(15), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier", lazy="noload")

    __table_args__ = (
        Index("ix_supplier_vendor", "vendor_id"),
        Index("ix_supplier_vendor_name", "vendor_id", "name"),
    )


class PurchaseOrder(Base):
    __tablename__ = "purchase_order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)

    po_number = Column(String(20), nullable=False)
    status = Column(String(30), nullable=False, default="draft")
    # draft, sent, partial_received, received, closed, cancelled

    order_date = Column(Date)
    expected_delivery_date = Column(Date)
    notes = Column(Text)

    # Currency & exchange rate
    currency = Column(String(3), default="INR", nullable=False)
    exchange_rate = Column(Numeric(12, 6), default=1)

    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    cgst_amount = Column(Numeric(14, 2), default=0)
    sgst_amount = Column(Numeric(14, 2), default=0)
    igst_amount = Column(Numeric(14, 2), default=0)
    tax_amount = Column(Numeric(14, 2), default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    # Terms
    payment_terms = Column(String(50), nullable=True)   # e.g. "Net 30", "2/10 Net 30"
    delivery_terms = Column(String(50), nullable=True)  # Incoterms: EXW, FOB, CIF, DDP …

    # Link back to the originating Purchase Requisition
    requisition_id = Column(UUID(as_uuid=True), ForeignKey("purchase_requisition.id", ondelete="SET NULL"), nullable=True)

    # Change / approval history
    audit_log = Column(JSONB, nullable=False, default=list)

    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    received_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))

    supplier = relationship("Supplier", back_populates="purchase_orders", lazy="selectin")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", lazy="selectin", cascade="all, delete-orphan")
    receipts = relationship("PurchaseOrderReceipt", back_populates="purchase_order", lazy="noload", cascade="all, delete-orphan")
    requisition = relationship("PurchaseRequisition", foreign_keys=[requisition_id], lazy="noload")

    __table_args__ = (
        Index("ix_po_vendor", "vendor_id"),
        Index("ix_po_vendor_status", "vendor_id", "status"),
        Index("ix_po_supplier", "supplier_id"),
        Index("uq_po_vendor_number", "vendor_id", "po_number", unique=True),
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"))

    quantity_ordered = Column(Numeric(12, 4), nullable=False)
    quantity_received = Column(Numeric(12, 4), nullable=False, default=0)
    unit_cost = Column(Numeric(14, 4), nullable=False, default=0)
    total_cost = Column(Numeric(14, 2), nullable=False, default=0)

    # Unit of measure
    unit_of_measure = Column(String(20), default="PCS")

    # Location assignment
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    # Item category controls procurement type
    item_category = Column(String(20), default="standard")
    # standard | subcontract | consignment | service | third_party

    # Account assignment
    account_assignment = Column(String(20), nullable=True)
    # cost_center | project | asset | gl_account | none

    # GST / Tax per line
    hsn_code = Column(String(10), nullable=True)
    tax_code = Column(String(20), nullable=True)
    cgst_rate = Column(Numeric(6, 2), default=0)
    sgst_rate = Column(Numeric(6, 2), default=0)
    igst_rate = Column(Numeric(6, 2), default=0)
    cgst_amount = Column(Numeric(12, 2), default=0)
    sgst_amount = Column(Numeric(12, 2), default=0)
    igst_amount = Column(Numeric(12, 2), default=0)

    notes = Column(Text)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product", lazy="selectin")
    variant = relationship("ProductVariant", foreign_keys=[variant_id], lazy="selectin")
    delivery_schedules = relationship(
        "PurchaseOrderDeliverySchedule",
        back_populates="po_item",
        lazy="noload",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_poi_po", "purchase_order_id"),
        Index("ix_poi_product", "product_id"),
    )


class PurchaseOrderReceipt(Base):
    __tablename__ = "purchase_order_receipt"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="CASCADE"), nullable=False)
    received_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))

    # Movement type: gr_po=GR, gr_reversal=reversal, return_to_vendor=return to vendor
    movement_type = Column(String(30), default="gr_po")

    # Destination
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    # Quality stock classification on receipt
    quality_status = Column(String(30), default="unrestricted")
    # unrestricted | quality_inspection | blocked

    posting_date = Column(Date, nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)
    items = Column(JSONB, default=[])

    purchase_order = relationship("PurchaseOrder", back_populates="receipts")

    __table_args__ = (
        Index("ix_por_po", "purchase_order_id"),
        Index("ix_por_movement", "movement_type"),
    )


class PurchaseOrderDeliverySchedule(Base):
    """
    Multiple scheduled delivery dates / quantities for a single PO line.
    Supports blanket/scheduling-agreement style call-offs — SAP ME38 equivalent.
    """
    __tablename__ = "po_delivery_schedule"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_item_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order_item.id", ondelete="CASCADE"), nullable=False)

    delivery_date = Column(Date, nullable=False)
    scheduled_qty = Column(Numeric(12, 4), nullable=False)
    delivered_qty = Column(Numeric(12, 4), default=0)

    notes = Column(Text, nullable=True)

    po_item = relationship("PurchaseOrderItem", back_populates="delivery_schedules")

    __table_args__ = (
        Index("ix_pods_item", "po_item_id"),
        Index("ix_pods_date", "delivery_date"),
    )
