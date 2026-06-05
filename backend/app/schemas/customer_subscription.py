from datetime import datetime
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SubscriptionCreate(BaseModel):
    item_type: str = Field(..., pattern="^(product|service)$")
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    service_id: Optional[str] = None
    item_name: str
    interval: str
    price_per_cycle: float = Field(..., ge=0)
    qty: int = Field(1, ge=1, le=100)
    schedule_config: dict[str, Any] = {}


class SubscriptionStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(paused|active|cancelled)$")


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    customer_id: str
    item_type: str
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    service_id: Optional[str] = None
    item_name: str
    interval: str
    price_per_cycle: float
    qty: int
    currency: str = "INR"
    status: str
    schedule_config: dict = {}
    trial_ends_at: Optional[datetime] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    next_billing_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    customer_name: Optional[str] = None

    @field_validator(
        "id", "vendor_id", "customer_id", "product_id", "variant_id", "service_id",
        mode="before",
    )
    @classmethod
    def coerce_uuid(cls, v):
        if v is None:
            return None
        return str(v) if isinstance(v, UUID) else v

    @field_validator("price_per_cycle", mode="before")
    @classmethod
    def coerce_price(cls, v):
        return float(v) if isinstance(v, Decimal) else v

    @field_validator("schedule_config", mode="before")
    @classmethod
    def ensure_config(cls, v):
        return v or {}
