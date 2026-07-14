from pydantic import BaseModel, Field
from typing import Optional, List

from app.schemas.order import GuestCartItem


class CheckoutPreviewRequest(BaseModel):
    shipping_method_id: str = "free"
    coupon_code: Optional[str] = Field(None, max_length=50)
    shipping_state: Optional[str] = Field(None, max_length=100)
    store_id: Optional[str] = Field(None, max_length=36)
    branch_code: Optional[str] = Field(None, max_length=64)


class GuestCheckoutPreviewRequest(CheckoutPreviewRequest):
    items: List[GuestCartItem] = Field(..., min_length=1)


class RazorpayCreateRequest(BaseModel):
    order_id: str


class RazorpayVerifyRequest(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
