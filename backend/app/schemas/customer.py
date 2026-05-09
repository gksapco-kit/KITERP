# app/schemas/customer.py
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class AddressItem(BaseModel):
    street_address: str = Field(..., min_length=5, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    postal_code: str = Field(..., min_length=4, max_length=20)
    country: str = Field(default="India", max_length=100)
    label: str = Field(default="home", max_length=50)  # home, work, other


class CustomerCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    password: str = Field(..., min_length=8, max_length=100)

    @model_validator(mode="after")
    def require_email_or_phone(self):
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required")
        return self


class CustomerLogin(BaseModel):
    login: str = Field(..., min_length=3, description="Email address or phone number")
    password: str = Field(..., min_length=1)


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    avatar_url: Optional[str] = None
    shipping_addresses: Optional[List[AddressItem]] = None
    default_address_index: Optional[int] = None
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=30)
    account_holder_name: Optional[str] = Field(None, max_length=255)
    account_type: Optional[str] = Field(None, pattern=r"^(savings|current)$")
    ifsc_code: Optional[str] = Field(None, max_length=15)


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    shipping_addresses: Optional[list] = []
    default_address_index: int = 0
    is_active: bool = True
    total_orders: int = 0
    total_spent: float = 0
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_type: Optional[str] = None
    ifsc_code: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    @field_validator("total_spent", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        return float(v) if v is not None else 0


class CustomerListResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
    page: int
    size: int
    pages: int
