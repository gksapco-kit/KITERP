"""Pydantic schemas for Vendor Bills (AP) and AP payments."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# TDS sections commonly deducted on payments to suppliers / contractors / professionals.
TDS_SECTIONS = {
    "192", "193", "194", "194A", "194B", "194C", "194D", "194DA", "194H", "194I", "194IA",
    "194IB", "194J", "194K", "194M", "194N", "194O", "194Q", "194R", "194S", "195",
}


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
    # GST split of tax_amount. Omit to infer from supplier / own GSTIN state codes.
    cgst_amount: Optional[Decimal] = Field(default=None, ge=0)
    sgst_amount: Optional[Decimal] = Field(default=None, ge=0)
    igst_amount: Optional[Decimal] = Field(default=None, ge=0)
    # TDS deducted from the supplier (Sec 194x). tds_amount is computed from
    # subtotal x tds_rate when only section + rate are supplied.
    tds_section: Optional[str] = Field(default=None, max_length=10)
    tds_rate: Optional[Decimal] = Field(default=None, ge=0, le=100)
    tds_amount: Optional[Decimal] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_amounts(self):
        tol = Decimal("0.01")
        if self.subtotal or self.tax_amount or self.total:
            if abs((self.subtotal + self.tax_amount) - self.total) > tol:
                raise ValueError("total must equal subtotal + tax_amount")
        split = [self.cgst_amount, self.sgst_amount, self.igst_amount]
        if any(v is not None for v in split):
            got = sum((v or Decimal("0")) for v in split)
            if abs(got - self.tax_amount) > tol:
                raise ValueError("cgst_amount + sgst_amount + igst_amount must equal tax_amount")
            if self.igst_amount and (self.cgst_amount or self.sgst_amount):
                raise ValueError("A bill cannot carry both IGST and CGST/SGST")
        if self.tds_section:
            sec = self.tds_section.strip().upper()
            if sec not in TDS_SECTIONS:
                raise ValueError(f"Unsupported TDS section '{self.tds_section}'. Use one of {sorted(TDS_SECTIONS)}.")
            self.tds_section = sec
            if self.tds_amount is None and self.tds_rate is not None:
                self.tds_amount = (self.subtotal * self.tds_rate / Decimal("100")).quantize(Decimal("0.01"))
        if self.tds_amount and not self.tds_section:
            raise ValueError("tds_section is required when TDS is deducted")
        if self.tds_amount and self.tds_amount >= self.total:
            raise ValueError("tds_amount must be less than the bill total")
        return self


class VendorBillUpdate(BaseModel):
    """Only header fields are updatable; use bill replace for line changes."""
    bill_no: Optional[str] = None
    bill_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    attachment_url: Optional[str] = None
    pm_project_id: Optional[UUID] = None


class VendorPaymentCreate(BaseModel):
    """Typed schema for recording a vendor (AP) payment (maps to FinVendorPayment)."""
    bill_id: Optional[UUID] = None
    supplier_id: UUID
    amount: Decimal = Field(..., gt=0, description="Payment amount; must be positive")
    payment_date: date
    payment_method: Optional[str] = Field(None, max_length=30)   # bank_transfer / cheque / cash / upi
    reference_no: Optional[str] = Field(None, max_length=100)
    bank_account_id: Optional[UUID] = None        # FinBankAccount paying the supplier
    notes: Optional[str] = None


class PaymentRunItemIn(BaseModel):
    bill_id: UUID
    amount: Decimal = Field(..., gt=0)


class PaymentRunCreate(BaseModel):
    """Typed schema for creating an AP payment run (maps to FinPaymentRun + items)."""
    name: Optional[str] = Field(None, max_length=200)
    payment_date: date
    bank_account_id: Optional[UUID] = None
    notes: Optional[str] = None
    items: list[PaymentRunItemIn] = []


# --- AR / payment application ------------------------------------------------

class PaymentApplicationCreate(BaseModel):
    """Apply (part of) an existing customer Payment to an Invoice."""
    payment_id: UUID
    invoice_id: UUID
    amount_applied: Decimal = Field(..., gt=0)


# Backwards-compatible alias (older imports)
CustomerReceiptCreate = PaymentApplicationCreate


# --- Bank account create / update --------------------------------------------

class BankAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    account_type: Optional[str] = Field(None, max_length=20)     # bank / cash / credit_card / wallet
    account_number: Optional[str] = Field(None, max_length=50)
    bank_name: Optional[str] = Field(None, max_length=200)
    ifsc_code: Optional[str] = Field(None, max_length=20)
    gl_account_id: Optional[UUID] = None
    currency: str = Field("INR", max_length=3)
    opening_balance: Optional[Decimal] = None
    is_active: bool = True
    notes: Optional[str] = None


class BankAccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    account_type: Optional[str] = Field(None, max_length=20)
    account_number: Optional[str] = Field(None, max_length=50)
    bank_name: Optional[str] = Field(None, max_length=200)
    ifsc_code: Optional[str] = Field(None, max_length=20)
    gl_account_id: Optional[UUID] = None
    currency: Optional[str] = Field(None, max_length=3)
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# --- Tax codes ----------------------------------------------------------------

class TaxCodeCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=100)
    rate: Decimal = Field(..., ge=0, le=100)
    tax_type: str = Field(..., min_length=1, max_length=20)      # CGST / SGST / IGST / TDS / TCS / Income ...
    gl_account_id: Optional[UUID] = None
    is_active: bool = True


class TaxCodeUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    tax_type: Optional[str] = Field(None, min_length=1, max_length=20)
    rate: Optional[Decimal] = Field(None, ge=0, le=100)
    gl_account_id: Optional[UUID] = None
    is_active: Optional[bool] = None
