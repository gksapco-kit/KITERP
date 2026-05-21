"""
Pydantic schemas for enterprise Journal Entry (header + lines).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# ─── Line schemas ─────────────────────────────────────────────────────────────

class JournalLineIn(BaseModel):
    account_id: UUID
    description: Optional[str] = None          # narration on the line
    # Exactly one of debit / credit must be > 0 (validated in model_validator)
    debit: Decimal = Field(default=Decimal("0"), ge=0)
    credit: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = "INR"
    fx_rate: Decimal = Field(default=Decimal("1"), gt=0)
    # Dimensions
    cost_center_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    intercompany_partner_id: Optional[UUID] = None
    store_id: Optional[UUID] = None
    # Dates
    value_date: Optional[date] = None          # cash-effect date
    # Party (open-item clearing)
    party_type: Optional[str] = None           # customer | supplier
    party_id: Optional[UUID] = None
    # Reference document
    ref_doc_type: Optional[str] = None         # purchase_order / invoice / bill / …
    ref_doc_id: Optional[UUID] = None
    ref_doc_no: Optional[str] = None
    # Tax
    tax_code: Optional[str] = None
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    # Assignment / clearing reference
    assignment: Optional[str] = None
    sequence: int = 0

    @model_validator(mode="after")
    def _check_debit_credit(self) -> "JournalLineIn":
        d, c = self.debit, self.credit
        if d > 0 and c > 0:
            raise ValueError("A line cannot have both debit and credit > 0")
        if d == 0 and c == 0:
            raise ValueError("A line must have either debit or credit > 0")
        return self


class JournalLineOut(BaseModel):
    id: UUID
    account_id: UUID
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    description: Optional[str] = None
    debit: Decimal
    credit: Decimal
    currency: str
    fx_rate: Decimal
    base_debit: Decimal
    base_credit: Decimal
    cost_center_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    intercompany_partner_id: Optional[UUID] = None
    store_id: Optional[UUID] = None
    value_date: Optional[date] = None
    party_type: Optional[str] = None
    party_id: Optional[UUID] = None
    ref_doc_type: Optional[str] = None
    ref_doc_id: Optional[UUID] = None
    ref_doc_no: Optional[str] = None
    tax_code: Optional[str] = None
    tax_amount: Decimal
    assignment: Optional[str] = None
    sequence: int

    model_config = {"from_attributes": True}


# ─── Header schemas ───────────────────────────────────────────────────────────

class JournalEntryCreate(BaseModel):
    # Business unit (posting entity; fin_company row)
    company_id: Optional[UUID] = None          # defaults to vendor's default business unit

    # Dates
    entry_date: date                           # posting date
    document_date: Optional[date] = None       # document / invoice date
    value_date: Optional[date] = None          # default value date applied to all lines

    # Classification
    document_type: str = "SA"                  # SA / DR / CR / AB / ML
    source_type: str = "manual"

    # Text fields
    reference: Optional[str] = None
    narration: Optional[str] = None
    header_text: Optional[str] = None

    # Currency
    currency: str = "INR"

    # Lines
    lines: list[JournalLineIn] = Field(min_length=2)

    # Optional GL period (fiscal year is derived from the period if set)
    period_id: Optional[UUID] = None

    @field_validator("currency")
    @classmethod
    def _upper_currency(cls, v: str) -> str:
        return v.upper()

    @model_validator(mode="after")
    def _balanced(self) -> "JournalEntryCreate":
        total_debit = sum(ln.debit for ln in self.lines)
        total_credit = sum(ln.credit for ln in self.lines)
        if total_debit != total_credit:
            raise ValueError(
                f"Journal entry is not balanced: "
                f"total debit {total_debit} ≠ total credit {total_credit}"
            )
        return self


class JournalEntryUpdate(BaseModel):
    """Allowed only while status == 'draft'."""
    company_id: Optional[UUID] = None
    entry_date: Optional[date] = None
    document_date: Optional[date] = None
    document_type: Optional[str] = None
    reference: Optional[str] = None
    narration: Optional[str] = None
    header_text: Optional[str] = None
    currency: Optional[str] = None
    period_id: Optional[UUID] = None
    lines: Optional[list[JournalLineIn]] = None

    @model_validator(mode="after")
    def _balanced_if_lines(self) -> "JournalEntryUpdate":
        if self.lines:
            total_debit = sum(ln.debit for ln in self.lines)
            total_credit = sum(ln.credit for ln in self.lines)
            if total_debit != total_credit:
                raise ValueError(
                    f"Journal entry is not balanced: "
                    f"total debit {total_debit} ≠ total credit {total_credit}"
                )
        return self


class JournalEntryOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: Optional[UUID] = None
    company_name: Optional[str] = None
    entry_no: str
    entry_date: date
    document_date: Optional[date] = None
    document_type: str
    period_id: Optional[UUID] = None
    fiscal_year_id: Optional[UUID] = None
    source_type: Optional[str] = None
    source_id: Optional[UUID] = None
    status: str
    reference: Optional[str] = None
    narration: Optional[str] = None
    header_text: Optional[str] = None
    currency: str
    total_debit: Decimal
    total_credit: Decimal
    requires_approval: bool
    approval_request_id: Optional[UUID] = None
    created_by_id: Optional[UUID] = None
    posted_by_id: Optional[UUID] = None
    lines: list[JournalLineOut] = []

    model_config = {"from_attributes": True}


# ─── Dimension schemas ────────────────────────────────────────────────────────

class CompanyOut(BaseModel):
    id: UUID
    vendor_id: UUID
    code: str
    name: str
    currency: str
    country: str
    tax_id: Optional[str] = None
    is_default: bool
    is_active: bool

    model_config = {"from_attributes": True}


class CompanyCreate(BaseModel):
    code: str
    name: str
    currency: str = "INR"
    country: str = "IN"
    tax_id: Optional[str] = None
    address: dict = {}
    is_default: bool = False


class CostCenterOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    cc_group: Optional[str] = None
    parent_id: Optional[UUID] = None
    is_active: bool

    model_config = {"from_attributes": True}


class CostCenterCreate(BaseModel):
    company_id: Optional[UUID] = None
    code: str
    name: str
    description: Optional[str] = None
    cc_group: Optional[str] = None
    parent_id: Optional[UUID] = None


class ProjectOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Decimal
    status: str
    manager_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    company_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Decimal = Decimal("0")
    status: str = "active"
    manager_id: Optional[UUID] = None


class IntercompanyPartnerOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    partner_company_id: UUID
    default_ar_account_id: Optional[UUID] = None
    default_ap_account_id: Optional[UUID] = None
    is_active: bool

    model_config = {"from_attributes": True}
