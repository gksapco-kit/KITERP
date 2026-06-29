# app/schemas/business_partner.py
from __future__ import annotations
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class AddressIn(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


class RoleIn(BaseModel):
    role: str = Field(..., description="customer | vendor | employee | partner | contractor | <custom>")
    attributes: Optional[dict] = None


class BusinessPartnerCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    pan_number: Optional[str] = None
    cin: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[dict] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_type: Optional[str] = "savings"
    ifsc_code: Optional[str] = None
    opening_balance: Optional[float] = 0
    notes: Optional[str] = None
    avatar_url: Optional[str] = None
    roles: List[RoleIn] = Field(default_factory=list)


class BusinessPartnerUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    pan_number: Optional[str] = None
    cin: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[dict] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_type: Optional[str] = None
    ifsc_code: Optional[str] = None
    opening_balance: Optional[float] = None
    notes: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    party_status: Optional[str] = None
    payment_blocked: Optional[bool] = None
    hold_until: Optional[str] = None


class BusinessPartnerRoleResponse(BaseModel):
    id: str
    role: str
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None
    attributes: Optional[dict] = None
    is_active: bool
    created_at: Optional[str] = None


class BusinessPartnerResponse(BaseModel):
    id: str
    vendor_id: str
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    pan_number: Optional[str] = None
    cin: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[Any] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_type: Optional[str] = None
    ifsc_code: Optional[str] = None
    opening_balance: Optional[float] = None
    notes: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    party_status: str
    payment_blocked: bool
    hold_until: Optional[str] = None
    roles: List[BusinessPartnerRoleResponse] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
