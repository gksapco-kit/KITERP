# app/schemas/commission.py
"""Pydantic schemas for the commission module."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─── Payee ────────────────────────────────────────────────────────────────────

class CommissionPayeeCreate(BaseModel):
    display_name: str
    code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    external_user_id: Optional[str] = None
    link_type: str = "external"  # vendor_user | supplier | customer | external
    vendor_user_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    default_payout_method: str = "bank_transfer"
    # bank_source: 'master' = read from linked master record, 'custom' = fields below
    bank_source: str = "master"
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    wallet_provider: Optional[str] = None
    wallet_id: Optional[str] = None
    currency: str = "INR"
    status: str = "active"


class CommissionPayeeUpdate(BaseModel):
    display_name: Optional[str] = None
    code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    external_user_id: Optional[str] = None
    default_payout_method: Optional[str] = None
    bank_source: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    wallet_provider: Optional[str] = None
    wallet_id: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = None


# ─── Plan ─────────────────────────────────────────────────────────────────────

class CommissionPlanCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    status: str = "active"
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    payee_scope: str = "any"
    priority: int = 10
    stackable: bool = False
    settings: Dict[str, Any] = {}


class CommissionPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    payee_scope: Optional[str] = None
    priority: Optional[int] = None
    stackable: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


# ─── Rule ─────────────────────────────────────────────────────────────────────

class CommissionRuleCreate(BaseModel):
    name: Optional[str] = None
    priority: int = 10
    is_active: bool = True
    applies_to: str = "all"
    product_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    uom: Optional[str] = None
    store_id: Optional[UUID] = None
    customer_group: Optional[str] = None
    channel: str = "any"
    event_tag: Optional[str] = None
    team_id: Optional[UUID] = None
    min_qty: Optional[Decimal] = None
    min_amount: Optional[Decimal] = None
    window_type: str = "per_line"
    period: Optional[str] = None
    revenue_threshold: Optional[Decimal] = None
    count_threshold: Optional[int] = None
    calculation_type: str = "percentage"
    value_numeric: Optional[Decimal] = None
    value_currency: Optional[Decimal] = None
    points_per_unit: Optional[Decimal] = None
    equity_units: Optional[Decimal] = None
    tier_table: Optional[List[Dict[str, Any]]] = None
    time_rate: Optional[Dict[str, Any]] = None
    cap_amount: Optional[Decimal] = None
    floor_amount: Optional[Decimal] = None
    payee_share_percent: Optional[Decimal] = None


class CommissionRuleUpdate(CommissionRuleCreate):
    pass


# ─── Assignment ───────────────────────────────────────────────────────────────

class CommissionAssignmentCreate(BaseModel):
    plan_id: UUID
    payee_id: UUID
    store_id: Optional[UUID] = None
    team_id: Optional[UUID] = None
    location: Optional[str] = None
    group_name: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    weight_percent: Decimal = Decimal("100")
    is_active: bool = True
    notes: Optional[str] = None


class CommissionAssignmentUpdate(BaseModel):
    store_id: Optional[UUID] = None
    team_id: Optional[UUID] = None
    location: Optional[str] = None
    group_name: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    weight_percent: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# ─── Payout Run ───────────────────────────────────────────────────────────────

class PayoutRunCreate(BaseModel):
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    payee_ids: Optional[List[str]] = None
    payment_method: str = "bank_transfer"
    notes: Optional[str] = None


class PayoutRunAction(BaseModel):
    notes: Optional[str] = None
