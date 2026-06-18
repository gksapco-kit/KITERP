from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class DiscountType(str, Enum):
    PERCENTAGE = "percentage"
    FLAT = "flat"


class CouponCreate(BaseModel):
    code: str = Field(min_length=3, max_length=50)
    store_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    discount_type: DiscountType
    discount_value: float = Field(gt=0)
    max_discount: Optional[float] = None
    min_order_amount: float = 0
    usage_limit: Optional[int] = None
    usage_per_customer: int = 1
    applicable_to: str = "all"  # all, products, services, categories
    applicable_ids: List[str] = []
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: bool = True
    is_public: bool = True


class CouponUpdate(BaseModel):
    store_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    max_discount: Optional[float] = None
    min_order_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    usage_per_customer: Optional[int] = None
    applicable_to: Optional[str] = None
    applicable_ids: Optional[List[str]] = None
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None


class CouponValidate(BaseModel):
    code: str
    order_total: float = 0


class CouponResponse(BaseModel):
    id: str
    vendor_id: str
    store_id: Optional[str] = None
    code: str
    title: Optional[str] = None
    description: Optional[str] = None
    discount_type: str
    discount_value: float
    max_discount: Optional[float] = None
    min_order_amount: float
    usage_limit: Optional[int] = None
    usage_per_customer: int
    times_used: int
    applicable_to: str
    applicable_ids: list
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: bool
    is_public: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CouponValidationResponse(BaseModel):
    valid: bool
    discount_amount: float = 0
    message: str = ""
    coupon: Optional[CouponResponse] = None
