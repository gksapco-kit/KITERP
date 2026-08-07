# app/models/order.py
from sqlalchemy import (
    Column, String, Text, DateTime, Date, ForeignKey,
    Numeric, Integer, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Order(Base):
    __tablename__ = "order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String(20), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=False, index=True)
    # Business unit (store) this order is attributed to. Nullable for vendors with no store records.
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True, index=True)
    # Sales & Distribution: Business Unit x Distribution Channel x Division this order was sold under.
    sales_area_id = Column(UUID(as_uuid=True), ForeignKey("sales_area.id", ondelete="SET NULL"), nullable=True, index=True)
    # How this order is/was fulfilled (own fleet, courier, pickup, third-party).
    delivery_channel_id = Column(UUID(as_uuid=True), ForeignKey("delivery_channel.id", ondelete="SET NULL"), nullable=True, index=True)

    # ── Document classification ──────────────────────────────────────────────
    # standard | quotation | return | credit_note | debit_note | sample
    order_type = Column(String(30), nullable=False, default="standard", server_default="standard")

    # ── Commercial terms ─────────────────────────────────────────────────────
    payment_terms_code = Column(String(50), nullable=True)   # e.g. 'NET30', 'IMMEDIATE'
    payment_terms_days = Column(Integer, nullable=True)       # net days; 0 = immediate
    shipping_terms = Column(String(50), nullable=True)        # e.g. 'FOB Mumbai'
    order_reason = Column(String(100), nullable=True)         # e.g. 'promotional', 'replacement'

    # ── Key dates ────────────────────────────────────────────────────────────
    requested_delivery_date = Column(Date, nullable=True)     # customer-requested
    pricing_date = Column(Date, nullable=True)                # price determination date

    # ── Currency ─────────────────────────────────────────────────────────────
    currency = Column(String(3), nullable=False, default="INR", server_default="INR")
    exchange_rate = Column(Numeric(12, 6), nullable=False, default=1.0, server_default="1.0")

    # ── Processing blocks ────────────────────────────────────────────────────
    fulfillment_block = Column(String(100), nullable=True)    # if set, no shipment allowed
    billing_block = Column(String(100), nullable=True)        # if set, no invoice allowed

    # ── Derived lifecycle statuses ────────────────────────────────────────────
    credit_status = Column(String(20), nullable=True)         # ok | watch | blocked | not_checked
    fulfillment_status = Column(String(20), nullable=True)    # open | partial | complete | not_relevant
    billing_status = Column(String(20), nullable=True)        # open | partial | complete | not_relevant

    # Items snapshot (JSONB array)
    items = Column(JSONB, default=[])
    item_count = Column(Integer, default=0)

    # Pricing
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    shipping_amount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    # Status
    # pending → confirmed → processing → shipped → delivered → (return_requested / exchange_requested)
    # also: cancelled, refunded, returned, exchanged
    status = Column(
        String(30), nullable=False, default="pending", index=True
    )

    # Payment
    payment_status = Column(
        String(30), nullable=False, default="pending"
    )  # pending, paid, failed, refunded, partially_refunded
    payment_method = Column(String(30))
    payment_reference = Column(String(255))
    # Manual UPI proof: { utr, screenshot_url, status, submitted_at, reviewed_at, notes }
    payment_proof = Column(JSONB, nullable=True)

    # Shipping
    shipping_address = Column(JSONB)
    tracking_number = Column(String(100))
    tracking_url = Column(String(500))
    delivery_staff_id = Column(UUID(as_uuid=True), nullable=True)
    delivery_staff_name = Column(String(255), nullable=True)
    delivery_assigned_at = Column(DateTime(timezone=True), nullable=True)
    delivery_status = Column(String(30), nullable=True)  # assigned, out_for_delivery, delivered

    # Source: online, pos, booking
    source = Column(String(20), default="online", index=True)
    pos_transaction_id = Column(UUID(as_uuid=True), nullable=True)

    # Coupon
    coupon_code = Column(String(50), nullable=True)

    # Notes & cancellation
    notes = Column(Text)
    cancel_reason = Column(Text)
    # Evidence files: [{ "url": str, "kind": "image"|"video" }, ...]
    cancel_attachments = Column(JSONB, default=list)

    # Return / Exchange
    return_type = Column(String(20))  # return, exchange
    return_reason = Column(Text)
    return_status = Column(String(30))  # requested, approved, rejected, completed
    return_requested_at = Column(DateTime(timezone=True))
    return_resolved_at = Column(DateTime(timezone=True))
    return_notes = Column(Text)  # vendor notes on resolution
    refund_amount = Column(Numeric(12, 2), default=0)
    return_tracking_number = Column(String(100))
    return_tracking_url = Column(String(500))
    # Evidence files for return/exchange request
    return_attachments = Column(JSONB, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True))
    shipped_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))

    # Relationships
    customer = relationship("Customer", back_populates="orders")
    payments = relationship("Payment", back_populates="order", lazy="selectin")
    status_history = relationship(
        "OrderStatusHistory", back_populates="order",
        order_by="OrderStatusHistory.timestamp", lazy="selectin",
    )
    lines = relationship(
        "OrderLine", back_populates="order",
        order_by="OrderLine.line_no", lazy="selectin",
        cascade="all, delete-orphan",
    )
    deliveries = relationship(
        "OrderDelivery", back_populates="order",
        order_by="OrderDelivery.created_at", lazy="selectin",
    )
    partners = relationship(
        "OrderPartner", back_populates="order",
        order_by="OrderPartner.role", lazy="selectin",
        cascade="all, delete-orphan",
    )
    pricing_conditions = relationship(
        "OrderPricingCondition", back_populates="order",
        order_by="OrderPricingCondition.step_no", lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_order_vendor_status", "vendor_id", "status"),
        Index("ix_order_vendor_created", "vendor_id", "created_at"),
        Index("ix_order_vendor_store", "vendor_id", "store_id"),
        Index("ix_order_sales_area", "vendor_id", "sales_area_id"),
        Index("ix_order_type", "vendor_id", "order_type"),
        Index("uq_order_vendor_number", "vendor_id", "order_number", unique=True),
    )


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String(30))
    to_status = Column(String(30), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    changed_by_role = Column(String(20))  # vendor, customer, system
    notes = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("Order", back_populates="status_history")


class OrderLine(Base):
    """Normalized order line item — Phase-2 of sales-order maturity.

    The JSONB `order.items` cache is kept in sync alongside these rows so
    storefront, POS and mobile clients that still read the cache keep working
    without changes.
    """
    __tablename__ = "order_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    # Line numbering — 10 / 20 / 30 … (gaps allow insertion)
    line_no = Column(Integer, nullable=False, default=10)
    parent_line_id = Column(UUID(as_uuid=True), ForeignKey("order_line.id", ondelete="SET NULL"), nullable=True)

    # Item references
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="SET NULL"), nullable=True, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="SET NULL"), nullable=True, index=True)
    # product | service
    item_type = Column(String(20), nullable=False, default="product")

    # Frozen name/SKU snapshot (survives product edits after order placement)
    item_name = Column(String(500), nullable=False)
    item_sku = Column(String(100), nullable=True)
    item_image_url = Column(Text, nullable=True)

    # Line classification: standard | free_of_charge | return | text_line
    line_type = Column(String(30), nullable=False, default="standard", server_default="standard")

    # Quantity ladder
    ordered_qty = Column(Numeric(12, 3), nullable=False, default=1)
    committed_qty = Column(Numeric(12, 3), nullable=False, default=0)   # ATP
    shipped_qty = Column(Numeric(12, 3), nullable=False, default=0)
    invoiced_qty = Column(Numeric(12, 3), nullable=False, default=0)
    returned_qty = Column(Numeric(12, 3), nullable=False, default=0)
    rejected_qty = Column(Numeric(12, 3), nullable=False, default=0)
    unit_of_measure = Column(String(20), nullable=False, default="EA", server_default="EA")

    # Pricing
    list_price = Column(Numeric(12, 2), nullable=False, default=0)
    net_price = Column(Numeric(12, 2), nullable=False, default=0)       # per unit, after discount
    discount_pct = Column(Numeric(7, 4), nullable=False, default=0)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0) # per unit
    tax_rate = Column(Numeric(7, 4), nullable=False, default=0)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0)      # total for this line
    line_total = Column(Numeric(12, 2), nullable=False, default=0)      # net_price × ordered_qty

    # Plant / storage
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    # CO / GL dimensions
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"), nullable=True)
    profit_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_profit_center.id", ondelete="SET NULL"), nullable=True)

    # Batch / serial traceability
    batch_number = Column(String(100), nullable=True)
    serial_numbers = Column(JSONB, nullable=False, default=list)

    # Rejection
    rejection_reason = Column(String(255), nullable=True)

    # Notes
    line_notes = Column(Text, nullable=True)

    # Which pricing rule was applied
    price_rule_id = Column(UUID(as_uuid=True), nullable=True)
    price_rule_type = Column(String(30), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    order = relationship("Order", back_populates="lines")
    children = relationship(
        "OrderLine", foreign_keys=[parent_line_id],
        back_populates="parent", lazy="selectin",
    )
    parent = relationship(
        "OrderLine", foreign_keys=[parent_line_id],
        back_populates="children", remote_side="OrderLine.id",
    )
    schedules = relationship(
        "OrderLineSchedule", back_populates="line",
        order_by="OrderLineSchedule.schedule_no", lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("order_id", "line_no", name="uq_order_line_no"),
        Index("ix_order_line_order", "order_id"),
        Index("ix_order_line_vendor", "vendor_id"),
    )


class OrderLineSchedule(Base):
    """Per-line delivery commitment — Phase-3 of sales-order maturity.

    Each row is a promise to deliver `confirmed_qty` units by `confirmed_date`.
    A line may have multiple schedule rows for split / partial deliveries.
    """
    __tablename__ = "order_line_schedule"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_line_id = Column(UUID(as_uuid=True), ForeignKey("order_line.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # 1-based; gaps allowed so insertions are possible
    schedule_no = Column(Integer, nullable=False, default=1)

    # Dates
    requested_date = Column(Date, nullable=True)   # what the customer asked for
    confirmed_date = Column(Date, nullable=True)   # what the vendor committed to

    # Quantities
    requested_qty = Column(Numeric(12, 3), nullable=False, default=0)
    confirmed_qty = Column(Numeric(12, 3), nullable=False, default=0)
    shipped_qty = Column(Numeric(12, 3), nullable=False, default=0)

    # open | committed | partial | shipped | closed | cancelled
    status = Column(String(20), nullable=False, default="open", server_default="open")
    # in_stock | purchase_order | lead_time | manual | none
    commitment_source = Column(String(30), nullable=False, default="none", server_default="none")

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    line = relationship("OrderLine", back_populates="schedules")

    __table_args__ = (
        UniqueConstraint("order_line_id", "schedule_no", name="uq_order_line_schedule_no"),
        Index("ix_ols_order_line", "order_line_id"),
        Index("ix_ols_order", "order_id"),
    )


class OrderDelivery(Base):
    """Outbound delivery document — Phase-4 of sales-order maturity.

    One delivery covers a subset (or all) of an order's open quantity.
    Multiple deliveries are allowed per order (partial shipments).
    """
    __tablename__ = "delivery"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # DEL-00001 format; assigned by DB default from del_number_seq
    delivery_number = Column(String(30), nullable=False, unique=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="RESTRICT"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)

    # standard | returns
    delivery_type = Column(String(20), nullable=False, default="standard")
    # draft | picking | packed | goods_issued | cancelled
    status = Column(String(20), nullable=False, default="draft")

    planned_gi_date = Column(Date, nullable=True)
    actual_gi_date = Column(Date, nullable=True)

    carrier = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    shipping_address = Column(JSONB, nullable=True)

    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    order = relationship("Order", back_populates="deliveries")
    lines = relationship(
        "DeliveryLine", back_populates="delivery",
        order_by="DeliveryLine.line_no", lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_delivery_vendor", "vendor_id"),
        Index("ix_delivery_status", "vendor_id", "status"),
    )


class DeliveryLine(Base):
    """One item row inside an outbound delivery document."""
    __tablename__ = "delivery_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("delivery.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="CASCADE"), nullable=False)
    order_line_id = Column(UUID(as_uuid=True), ForeignKey("order_line.id", ondelete="SET NULL"), nullable=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    line_no = Column(Integer, nullable=False, default=1)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String(300), nullable=True)
    sku = Column(String(100), nullable=True)
    unit = Column(String(30), nullable=True, default="pcs")

    planned_qty = Column(Numeric(12, 3), nullable=False, default=0)
    picked_qty = Column(Numeric(12, 3), nullable=False, default=0)
    packed_qty = Column(Numeric(12, 3), nullable=False, default=0)
    issued_qty = Column(Numeric(12, 3), nullable=False, default=0)

    # open | picking | picked | packed | issued
    status = Column(String(20), nullable=False, default="open")

    batch_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    delivery = relationship("OrderDelivery", back_populates="lines")

    __table_args__ = (
        UniqueConstraint("delivery_id", "line_no", name="uq_delivery_line_no"),
        Index("ix_dl_order_line", "order_line_id"),
    )


class OrderPartner(Base):
    """Named partner function on a sales order — Phase-6.

    Each (order_id, role) pair is unique.  Supported roles:
      buyer        — who placed the order        (always present; seeded from customer)
      ship_to      — delivery address / contact
      bill_to      — invoice recipient
      payer        — party responsible for payment
      contact      — additional contact person
      other        — catch-all
    """
    __tablename__ = "order_partner"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # buyer | ship_to | bill_to | payer | contact | other
    role = Column(String(30), nullable=False)

    # Optional link to a known customer record
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)

    # Contact snapshot (populated from customer record or entered manually)
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(30), nullable=True)
    company_name = Column(String(255), nullable=True)
    gstin = Column(String(15), nullable=True)
    address = Column(JSONB, nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    order = relationship("Order", back_populates="partners")

    __table_args__ = (
        UniqueConstraint("order_id", "role", name="uq_order_partner_role"),
        Index("ix_op_order", "order_id"),
        Index("ix_op_vendor", "vendor_id"),
    )


class OrderPricingCondition(Base):
    """Header-level pricing condition step — Phase-7.

    Stores manually-added or auto-applied header discounts, freight
    surcharges, and other order-level pricing adjustments that are applied
    on top of per-line product price rules.
    """
    __tablename__ = "order_pricing_condition"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("order.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    step_no = Column(Integer, nullable=False, default=1)

    # header_discount | freight | surcharge | special | tax_override
    condition_type = Column(String(30), nullable=False)
    description = Column(String(255), nullable=False)

    # percent | fixed
    calc_type = Column(String(20), nullable=False, default="percent")

    value = Column(Numeric(12, 4), nullable=False, default=0)
    base_amount = Column(Numeric(14, 2), nullable=True)
    condition_amount = Column(Numeric(14, 2), nullable=False, default=0)

    is_manual = Column(Integer, nullable=False, default=1)  # 1 = True, 0 = False
    applied_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    order = relationship("Order", back_populates="pricing_conditions")

    __table_args__ = (
        Index("ix_opc_order", "order_id"),
        Index("ix_opc_vendor", "vendor_id"),
    )
