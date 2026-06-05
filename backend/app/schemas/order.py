# app/schemas/order.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID
from enum import Enum
from decimal import Decimal


class OrderStatus(str, Enum):
    QUOTE_REQUESTED = "quote_requested"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURN_REQUESTED = "return_requested"
    EXCHANGE_REQUESTED = "exchange_requested"
    RETURNED = "returned"
    EXCHANGED = "exchanged"
    REFUNDED = "refunded"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    COD = "cod"
    UPI = "upi"
    CARD = "card"
    NETBANKING = "netbanking"
    WALLET = "wallet"
    RAZORPAY = "razorpay"


class ShippingAddress(BaseModel):
    street_address: str
    city: str
    state: str
    postal_code: str
    country: str = "India"
    label: Optional[str] = "home"


class OrderItemResponse(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    name: str
    qty: int
    price: float
    image_url: Optional[str] = None


class CheckoutRequest(BaseModel):
    shipping_address: ShippingAddress
    payment_method: PaymentMethod
    shipping_method_id: str = "free"
    notes: Optional[str] = Field(None, max_length=500)
    coupon_code: Optional[str] = Field(None, max_length=50)


class GuestCustomerInfo(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)


class GuestCartItem(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    name: str
    qty: int = Field(..., ge=1, le=100)
    price: float = Field(..., ge=0)
    image_url: Optional[str] = None


class GuestCheckoutRequest(BaseModel):
    customer: GuestCustomerInfo
    items: List[GuestCartItem] = Field(..., min_length=1)
    shipping_address: ShippingAddress
    payment_method: PaymentMethod
    shipping_method_id: str = "free"
    notes: Optional[str] = Field(None, max_length=500)
    coupon_code: Optional[str] = Field(None, max_length=50)


class QuoteRequest(BaseModel):
    service_id: Optional[str] = None
    service_name: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    item_type: Optional[str] = "service"  # "service" or "product"
    form_data: Optional[dict] = {}
    # Legacy fields kept for backwards compat
    message: Optional[str] = Field(None, max_length=1000)
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None


class OrderAttachment(BaseModel):
    url: str = Field(..., min_length=1, max_length=2000)
    kind: Literal["image", "video"] = "image"


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    notes: Optional[str] = None
    cancel_reason: Optional[str] = Field(None, min_length=5, max_length=500)
    cancel_attachments: Optional[List[OrderAttachment]] = Field(None, max_length=10)


class OrderCancelRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)
    attachments: Optional[List[OrderAttachment]] = Field(None, max_length=10)


class ReturnExchangeRequest(BaseModel):
    return_type: str = Field(..., pattern="^(return|exchange)$")
    reason: str = Field(..., min_length=5, max_length=500)
    attachments: Optional[List[OrderAttachment]] = Field(None, max_length=10)


class ReturnResolveRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    notes: Optional[str] = Field(None, max_length=500)
    refund_amount: Optional[float] = None
    return_tracking_number: Optional[str] = Field(None, max_length=100)
    return_tracking_url: Optional[str] = Field(None, max_length=500)


class OrderStatusHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    from_status: Optional[str] = None
    to_status: str
    changed_by: Optional[str] = None
    changed_by_role: Optional[str] = None
    notes: Optional[str] = None
    timestamp: Optional[str] = None

    @field_validator("id", "changed_by", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("timestamp", mode="before")
    @classmethod
    def coerce_datetime(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    vendor_id: str
    customer_id: str
    items: List[OrderItemResponse] = []
    item_count: int = 0
    subtotal: float = 0
    tax_amount: float = 0
    discount_amount: float = 0
    shipping_amount: float = 0
    total: float = 0
    status: str
    payment_status: str
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    shipping_address: Optional[dict] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    source: Optional[str] = "online"
    pos_transaction_id: Optional[str] = None
    notes: Optional[str] = None
    coupon_code: Optional[str] = None
    cancel_reason: Optional[str] = None
    cancel_attachments: Optional[List[dict]] = None
    return_type: Optional[str] = None
    return_reason: Optional[str] = None
    return_status: Optional[str] = None
    return_notes: Optional[str] = None
    return_attachments: Optional[List[dict]] = None
    refund_amount: float = 0
    return_tracking_number: Optional[str] = None
    return_tracking_url: Optional[str] = None
    return_requested_at: Optional[str] = None
    return_resolved_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    confirmed_at: Optional[str] = None
    shipped_at: Optional[str] = None
    delivered_at: Optional[str] = None
    status_history: List[OrderStatusHistoryItem] = []

    @field_validator("id", "vendor_id", "customer_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator(
        "subtotal", "tax_amount", "discount_amount",
        "shipping_amount", "total", "refund_amount", mode="before"
    )
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator(
        "created_at", "updated_at", "confirmed_at",
        "shipped_at", "delivered_at",
        "return_requested_at", "return_resolved_at", mode="before"
    )
    @classmethod
    def coerce_datetime(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int
    page: int
    size: int
    pages: int


class OrderStatsResponse(BaseModel):
    total_orders: int = 0
    pending_orders: int = 0
    completed_orders: int = 0
    total_revenue: float = 0
    today_orders: int = 0
    today_revenue: float = 0
