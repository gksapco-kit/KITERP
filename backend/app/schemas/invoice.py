from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class InvoiceType(str, Enum):
    ESTIMATE = "estimate"
    INVOICE = "invoice"
    RECEIPT = "receipt"
    CREDIT_NOTE = "credit_note"


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class QuotationExtraFieldType(str, Enum):
    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    LINK = "link"
    IMAGE = "image"


class QuotationExtraField(BaseModel):
    id: Optional[str] = None
    label: str = Field(min_length=1, max_length=120)
    type: QuotationExtraFieldType = QuotationExtraFieldType.TEXT
    value: str = ""
    values: Optional[List[str]] = None


class InvoiceLineItem(BaseModel):
    name: str
    description: Optional[str] = None
    hsn_sac: Optional[str] = None
    qty: float = Field(ge=0)
    rate: float = Field(ge=0)
    discount: float = 0
    tax_rate: float = 0  # overall tax rate (e.g. 18 for 18%)


class InvoiceCreate(BaseModel):
    invoice_type: InvoiceType = InvoiceType.INVOICE
    store_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_gstin: Optional[str] = None
    billing_address: Optional[dict] = None
    shipping_address: Optional[dict] = None
    items: List[InvoiceLineItem]
    discount_amount: float = 0
    place_of_supply: Optional[str] = None
    is_inter_state: bool = False
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    order_id: Optional[str] = None
    extra_fields: Optional[List[QuotationExtraField]] = None


class InvoiceUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_gstin: Optional[str] = None
    billing_address: Optional[dict] = None
    shipping_address: Optional[dict] = None
    items: Optional[List[InvoiceLineItem]] = None
    discount_amount: Optional[float] = None
    place_of_supply: Optional[str] = None
    is_inter_state: Optional[bool] = None
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    status: Optional[InvoiceStatus] = None
    extra_fields: Optional[List[QuotationExtraField]] = None


class InvoiceConvert(BaseModel):
    """Convert estimate to invoice."""
    pass


class RecordPayment(BaseModel):
    amount: float = Field(gt=0)
    payment_method: str = "cash"
    reference: Optional[str] = None
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: str
    vendor_id: str
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    invoice_number: str
    invoice_type: str
    document_type: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_gstin: Optional[str] = None
    billing_address: Optional[dict] = None
    shipping_address: Optional[dict] = None
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    items: list
    item_count: int
    subtotal: float
    discount_amount: float
    taxable_amount: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_tax: float
    round_off: float
    total: float
    amount_paid: float
    balance_due: float
    financial_year: Optional[str] = None
    status: str
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    is_gst: bool
    place_of_supply: Optional[str] = None
    is_inter_state: bool
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    extra_fields: Optional[list] = None
    reference_invoice_id: Optional[str] = None
    converted_from_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
