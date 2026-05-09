# app/schemas/payment.py
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    vendor_id: str
    amount: float
    currency: str = "INR"
    method: str
    status: str
    gateway_reference: Optional[str] = None
    gateway_response: Optional[dict] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "order_id", "vendor_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v
