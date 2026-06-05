from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MarketplaceLeadCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    category: str = Field(..., min_length=1, max_length=100)
    subcategory: Optional[str] = None
    description: Optional[str] = None
    budget_min: Optional[float] = Field(None, ge=0)
    budget_max: Optional[float] = Field(None, ge=0)
    location_text: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    radius_km: int = Field(10, ge=1, le=500)
    photos: List[str] = []


class MarketplaceQuoteCreate(BaseModel):
    price: float = Field(..., gt=0)
    estimated_time: Optional[str] = None
    conditions: Optional[str] = None
    message: Optional[str] = None


class MarketplaceQuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lead_id: str
    vendor_id: str
    vendor_name: Optional[str] = None
    price: float
    estimated_time: Optional[str] = None
    conditions: Optional[str] = None
    message: Optional[str] = None
    status: str
    is_selected: bool = False
    created_at: Optional[datetime] = None

    @field_validator("id", "lead_id", "vendor_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("price", mode="before")
    @classmethod
    def coerce_price(cls, v):
        return float(v) if isinstance(v, Decimal) else v


class MarketplaceLeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: Optional[str] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    title: str
    description: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location_text: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    radius_km: int = 10
    photos: List[str] = []
    status: str
    quote_count: int = 0
    quotes: List[MarketplaceQuoteResponse] = []
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    @field_validator("id", "customer_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if v is None or not isinstance(v, UUID) else str(v)

    @field_validator("budget_min", "budget_max", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if v is None:
            return None
        return float(v) if isinstance(v, Decimal) else v

    @field_validator("photos", mode="before")
    @classmethod
    def ensure_photos(cls, v):
        return v or []
