# app/schemas/procurement_rfq.py
"""Pydantic DTOs for RFQ (Phase 3) and Supplier Quotation (Phase 4)."""
from __future__ import annotations

import secrets
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel


# ─────────────────────────────────────────────────────────────────
# RFQ
# ─────────────────────────────────────────────────────────────────

class RFQItemCreate(BaseModel):
    item_type: str = "product"
    product_id: Optional[str] = None
    service_id: Optional[str] = None
    variant_id: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit_of_measure: str = "piece"
    target_price: Optional[float] = None
    needed_by_date: Optional[date] = None
    technical_specs: Optional[str] = None
    notes: Optional[str] = None
    pr_item_id: Optional[str] = None


class RFQCreate(BaseModel):
    title: Optional[str] = None
    sourcing_type: str = "rfq"
    requisition_id: Optional[str] = None
    store_id: Optional[str] = None
    department: Optional[str] = None
    bid_submission_deadline: Optional[datetime] = None
    delivery_required_by: Optional[date] = None
    valid_until: Optional[date] = None
    currency: str = "INR"
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    instructions_to_suppliers: Optional[str] = None
    internal_notes: Optional[str] = None
    items: List[RFQItemCreate] = []
    supplier_ids: List[str] = []   # suppliers to invite immediately


class RFQUpdate(BaseModel):
    title: Optional[str] = None
    bid_submission_deadline: Optional[datetime] = None
    delivery_required_by: Optional[date] = None
    valid_until: Optional[date] = None
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    instructions_to_suppliers: Optional[str] = None
    internal_notes: Optional[str] = None
    items: Optional[List[RFQItemCreate]] = None


class AddSuppliersRequest(BaseModel):
    supplier_ids: List[str]


class RFQSupplierStatusUpdate(BaseModel):
    invite_status: str   # acknowledged | declined | no_response
    decline_reason: Optional[str] = None


class CloseRFQRequest(BaseModel):
    reason: Optional[str] = None


# ─────────────────────────────────────────────────────────────────
# Supplier Quotation
# ─────────────────────────────────────────────────────────────────

class QuotationItemCreate(BaseModel):
    rfq_item_id: Optional[str] = None
    item_type: str = "product"
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit_of_measure: str = "piece"
    min_order_quantity: Optional[float] = None
    unit_price: float
    discount_pct: float = 0
    hsn_code: Optional[str] = None
    tax_code: Optional[str] = None
    cgst_rate: float = 0
    sgst_rate: float = 0
    igst_rate: float = 0
    lead_time_days: Optional[int] = None
    delivery_date: Optional[date] = None
    notes: Optional[str] = None


class SupplierQuotationCreate(BaseModel):
    supplier_id: str
    rfq_id: Optional[str] = None
    supplier_reference: Optional[str] = None
    quote_type: str = "rfq_response"
    source: str = "manual"
    quote_date: date
    valid_until: Optional[date] = None
    currency: str = "INR"
    exchange_rate: float = 1
    freight_amount: float = 0
    other_charges: float = 0
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    delivery_lead_time_days: Optional[int] = None
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    items: List[QuotationItemCreate] = []


class SupplierQuotationUpdate(BaseModel):
    supplier_reference: Optional[str] = None
    quote_date: Optional[date] = None
    valid_until: Optional[date] = None
    freight_amount: Optional[float] = None
    other_charges: Optional[float] = None
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    delivery_lead_time_days: Optional[int] = None
    notes: Optional[str] = None
    items: Optional[List[QuotationItemCreate]] = None


class AcceptRejectQuotationRequest(BaseModel):
    action: str   # accept | reject
    notes: Optional[str] = None
