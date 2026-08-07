"""Pydantic schemas for Vendor Bills (AP)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class VendorBillLineIn(BaseModel):
    account_id: Optional[UUID] = None
    description: Optional[str] = None
    quantity: Decimal = Field(default=Decimal("1"), ge=0)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0)
    hsn_sac: Optional[str] = None
    # Cost dimensions — any combination; pm_project_id is the PM-layer tag
    cost_center_id: Optional[UUID] = None
    fin_project_id: Optional[UUID] = None
    pm_project_id: Optional[UUID] = None


class VendorBillCreate(BaseModel):
    supplier_id: UUID
    bill_no: str
    bill_date: date
    due_date: Optional[date] = None
    subtotal: Decimal = Field(default=Decimal("0"), ge=0)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    total: Decimal = Field(default=Decimal("0"), ge=0)
    notes: Optional[str] = None
    currency: str = "INR"
    attachment_url: Optional[str] = None
    po_id: Optional[UUID] = None
    # Header-level PM project tag (applied to all lines without an explicit override)
    pm_project_id: Optional[UUID] = None
    lines: list[VendorBillLineIn] = []


class VendorBillUpdate(BaseModel):
    """Only header fields are updatable; use bill replace for line changes."""
    bill_no: Optional[str] = None
    bill_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    attachment_url: Optional[str] = None
    pm_project_id: Optional[UUID] = None
