from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean,
    Numeric, Integer, Index, Date
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base


class POSSession(Base):
    __tablename__ = "pos_session"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    # Business unit (store) this register session belongs to. One open session per (vendor, store).
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True, index=True)
    opened_by = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)
    closed_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))

    session_date = Column(Date, nullable=False)
    opening_cash = Column(Numeric(12, 2), default=0)
    closing_cash = Column(Numeric(12, 2))

    total_sales = Column(Numeric(12, 2), default=0)
    total_returns = Column(Numeric(12, 2), default=0)
    total_discount = Column(Numeric(12, 2), default=0)
    total_tax = Column(Numeric(12, 2), default=0)
    transaction_count = Column(Integer, default=0)

    cash_total = Column(Numeric(12, 2), default=0)
    upi_total = Column(Numeric(12, 2), default=0)
    card_total = Column(Numeric(12, 2), default=0)

    status = Column(String(20), default="open")  # open, closed
    notes = Column(Text)

    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_pos_session_vendor_date", "vendor_id", "session_date"),
        Index("ix_pos_session_vendor_store_status", "vendor_id", "store_id", "status"),
    )


class POSTransaction(Base):
    __tablename__ = "pos_transaction"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("pos_session.id"), nullable=False, index=True)
    # Business unit (store) this sale is attributed to. Nullable for vendors with no store records.
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True, index=True)
    cashier_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"))
    # Staff credited for the sale (VendorUser.id); used for commission / attribution.
    sales_person_vendor_user_id = Column(
        UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Sales & Distribution: Business Unit x Distribution Channel x Division this sale was posted under.
    sales_area_id = Column(UUID(as_uuid=True), ForeignKey("sales_area.id", ondelete="SET NULL"), nullable=True, index=True)
    # How this sale is/was fulfilled (own fleet, courier, pickup, third-party); usually 'pickup' for in-store POS.
    delivery_channel_id = Column(UUID(as_uuid=True), ForeignKey("delivery_channel.id", ondelete="SET NULL"), nullable=True, index=True)

    transaction_number = Column(String(30), nullable=False, index=True)
    transaction_type = Column(String(20), default="sale")  # sale, return, exchange, credit_memo, debit_memo

    items = Column(JSONB, default=[])
    item_count = Column(Integer, default=0)

    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    discount_type = Column(String(20))  # percentage, flat
    discount_value = Column(Numeric(12, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    # Split payment
    payment_methods = Column(JSONB, default=[])  # [{method: "cash", amount: 500}, {method: "upi", amount: 300}]
    cash_received = Column(Numeric(12, 2), default=0)
    change_due = Column(Numeric(12, 2), default=0)

    status = Column(String(20), default="completed")  # completed, voided, returned
    return_of = Column(UUID(as_uuid=True))  # original transaction for returns
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoice.id"))
    coupon_code = Column(String(50))
    coupon_discount = Column(Numeric(12, 2), default=0)
    loyalty_points_redeemed = Column(Integer, default=0)
    loyalty_points_earned = Column(Integer, default=0)
    loyalty_discount = Column(Numeric(12, 2), default=0)
    notes = Column(Text)

    tip_amount = Column(Numeric(12, 2), default=0)
    service_charge_amount = Column(Numeric(12, 2), default=0)

    restaurant_table_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_table.id", ondelete="SET NULL"))
    kitchen_ticket_status = Column(String(20))  # new, preparing, ready, done

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_pos_txn_vendor_created", "vendor_id", "created_at"),
        Index("ix_pos_txn_session", "session_id", "created_at"),
        Index("ix_pos_txn_vendor_store", "vendor_id", "store_id"),
        Index("ix_pos_txn_sales_area", "vendor_id", "sales_area_id"),
        Index("uq_pos_txn_vendor_number", "vendor_id", "transaction_number", unique=True),
    )
