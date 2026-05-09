from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class TransactionType(str, Enum):
    SALE = "sale"
    RETURN = "return"
    EXCHANGE = "exchange"
    CREDIT_MEMO = "credit_memo"
    DEBIT_MEMO = "debit_memo"


class PaymentSplit(BaseModel):
    method: str  # cash, upi, card
    amount: float


class POSItem(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    name: str
    sku: Optional[str] = None
    qty: int = Field(ge=1)
    price: float = Field(ge=0)
    discount: float = 0
    tax_rate: float = 0
    hsn_code: Optional[str] = None
    total: float = 0
    item_type: Optional[str] = "product"
    booking_date: Optional[date] = None
    booking_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    booking_notes: Optional[str] = None


class POSSessionOpen(BaseModel):
    opening_cash: float = Field(default=0, ge=0)
    notes: Optional[str] = None


class POSSessionClose(BaseModel):
    closing_cash: float = Field(ge=0)
    notes: Optional[str] = None


class POSTransactionCreate(BaseModel):
    session_id: str
    customer_id: Optional[str] = None
    transaction_type: TransactionType = TransactionType.SALE
    items: List[POSItem]
    discount_type: Optional[str] = None  # percentage, flat
    discount_value: float = 0
    payment_methods: List[PaymentSplit]
    cash_received: float = 0
    notes: Optional[str] = None
    return_of: Optional[str] = None
    coupon_code: Optional[str] = None
    loyalty_points_redeem: int = 0
    restaurant_table_id: Optional[str] = None
    sales_person_vendor_user_id: Optional[str] = None


class POSReturnCreate(BaseModel):
    session_id: str
    original_transaction_id: str
    items: List[POSItem]
    payment_methods: List[PaymentSplit]
    reason: Optional[str] = None


class POSTransactionVoid(BaseModel):
    reason: Optional[str] = None


class POSTransactionMemoUpdate(BaseModel):
    """Update a credit/debit memo in place (same session)."""
    customer_id: Optional[str] = None
    items: List[POSItem]
    discount_type: Optional[str] = None
    discount_value: float = 0
    payment_methods: List[PaymentSplit]
    cash_received: float = 0
    notes: Optional[str] = None


class POSSessionResponse(BaseModel):
    id: str
    vendor_id: str
    opened_by: str
    closed_by: Optional[str] = None
    session_date: str
    opening_cash: float
    closing_cash: Optional[float] = None
    total_sales: float
    total_returns: float
    total_discount: float
    total_tax: float
    transaction_count: int
    cash_total: float
    upi_total: float
    card_total: float
    status: str
    notes: Optional[str] = None
    opened_at: Optional[str] = None
    closed_at: Optional[str] = None


class POSTransactionResponse(BaseModel):
    id: str
    vendor_id: str
    session_id: str
    cashier_id: str
    customer_id: Optional[str] = None
    transaction_number: str
    transaction_type: str
    items: list
    item_count: int
    subtotal: float
    discount_amount: float
    discount_type: Optional[str] = None
    discount_value: float
    tax_amount: float
    total: float
    payment_methods: list
    cash_received: float
    change_due: float
    status: str
    return_of: Optional[str] = None
    invoice_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    sales_person_vendor_user_id: Optional[str] = None


class ZReportResponse(BaseModel):
    session: POSSessionResponse
    transactions: List[POSTransactionResponse]
    summary: dict
