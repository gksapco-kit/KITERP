# app/schemas/controlling.py
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Activity types ───────────────────────────────────────────────────────────

class ActivityTypeCreate(BaseModel):
    company_id: UUID
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    uom: str = "H"
    default_cost_center_id: Optional[UUID] = None
    is_active: bool = True


class ActivityTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    uom: Optional[str] = None
    default_cost_center_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class ActivityTypeOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    code: str
    name: str
    description: Optional[str]
    uom: str
    default_cost_center_id: Optional[UUID]
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Overhead ─────────────────────────────────────────────────────────────────

class OverheadPoolCreate(BaseModel):
    company_id: UUID
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    allocation_base: str = "labor_hours"
    is_active: bool = True


class OverheadPoolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    allocation_base: Optional[str] = None
    is_active: Optional[bool] = None


class OverheadRateCreate(BaseModel):
    effective_from: date
    effective_to: Optional[date] = None
    rate_per_unit: Decimal = Field(default=Decimal("0"))
    notes: Optional[str] = None


class OverheadPoolOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    code: str
    name: str
    description: Optional[str]
    allocation_base: str
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class OverheadRateOut(BaseModel):
    id: UUID
    pool_id: UUID
    effective_from: date
    effective_to: Optional[date]
    rate_per_unit: Decimal
    notes: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Product cost ────────────────────────────────────────────────────────────

class ProductCostLineCreate(BaseModel):
    line_type: str  # material | activity | overhead
    description: Optional[str] = None
    component_product_id: Optional[UUID] = None
    activity_type_id: Optional[UUID] = None
    overhead_pool_id: Optional[UUID] = None
    qty_per_output_unit: Decimal = Field(default=Decimal("0"))
    unit_rate_planned: Decimal = Field(default=Decimal("0"))
    sequence: int = 0


class ProductCostLineOut(BaseModel):
    id: UUID
    version_id: UUID
    line_type: str
    description: Optional[str]
    component_product_id: Optional[UUID]
    activity_type_id: Optional[UUID]
    overhead_pool_id: Optional[UUID]
    qty_per_output_unit: Decimal
    unit_rate_planned: Decimal
    amount_planned: Decimal
    sequence: int

    class Config:
        from_attributes = True


class ProductCostVersionCreate(BaseModel):
    company_id: UUID
    product_id: UUID
    version_code: str = Field(min_length=1, max_length=40)
    valid_from: date
    valid_to: Optional[date] = None
    status: str = "draft"
    notes: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)
    lines: List[ProductCostLineCreate] = Field(default_factory=list)


class ProductCostVersionUpdate(BaseModel):
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    extra: Optional[dict[str, Any]] = None


class ProductCostVersionOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    product_id: UUID
    version_code: str
    valid_from: date
    valid_to: Optional[date]
    status: str
    material_total_planned: Decimal
    activity_total_planned: Decimal
    overhead_total_planned: Decimal
    rolled_up_unit_cost: Decimal
    notes: Optional[str]
    extra: dict[str, Any]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    lines: List[ProductCostLineOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


# ── Order operations (routing / confirmations) ───────────────────────────────

class OrderOperationCreate(BaseModel):
    sequence: int = 0
    operation_code: Optional[str] = None
    name: str = "Operation"
    activity_type_id: Optional[UUID] = None
    work_center_id: Optional[UUID] = None
    planned_qty: Decimal = Field(default=Decimal("0"))
    confirmed_qty: Decimal = Field(default=Decimal("0"))
    scrap_qty: Decimal = Field(default=Decimal("0"))
    planned_hours: Decimal = Field(default=Decimal("0"))
    actual_hours: Decimal = Field(default=Decimal("0"))
    planned_rate: Decimal = Field(default=Decimal("0"))
    actual_rate: Decimal = Field(default=Decimal("0"))
    status: str = "pending"
    source: str = "manual"
    notes: Optional[str] = None


class OrderOperationUpdate(BaseModel):
    sequence: Optional[int] = None
    operation_code: Optional[str] = None
    name: Optional[str] = None
    activity_type_id: Optional[UUID] = None
    work_center_id: Optional[UUID] = None
    planned_qty: Optional[Decimal] = None
    confirmed_qty: Optional[Decimal] = None
    scrap_qty: Optional[Decimal] = None
    planned_hours: Optional[Decimal] = None
    actual_hours: Optional[Decimal] = None
    planned_rate: Optional[Decimal] = None
    actual_rate: Optional[Decimal] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class OrderOperationOut(BaseModel):
    id: UUID
    order_id: UUID
    sequence: int
    operation_code: Optional[str]
    name: str
    activity_type_id: Optional[UUID]
    work_center_id: Optional[UUID]
    planned_qty: Decimal
    confirmed_qty: Decimal
    scrap_qty: Decimal
    planned_hours: Decimal
    actual_hours: Decimal
    planned_rate: Decimal
    actual_rate: Decimal
    status: str
    source: str
    notes: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── CO settlement / GL mapping ────────────────────────────────────────────────

class CoGlMappingOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    wip_account_id: Optional[UUID] = None
    finished_goods_account_id: Optional[UUID] = None
    cogs_account_id: Optional[UUID] = None
    production_variance_account_id: Optional[UUID] = None
    raw_material_account_id: Optional[UUID] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CoGlMappingUpsert(BaseModel):
    company_id: UUID
    wip_account_id: Optional[UUID] = None
    finished_goods_account_id: Optional[UUID] = None
    cogs_account_id: Optional[UUID] = None
    production_variance_account_id: Optional[UUID] = None
    raw_material_account_id: Optional[UUID] = None
    notes: Optional[str] = None


class CoCostBookingOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    order_id: UUID
    booking_type: str
    amount: Decimal
    qty_basis: Optional[Decimal] = None
    unit_cost: Optional[Decimal] = None
    journal_entry_id: Optional[UUID] = None
    entry_date: Optional[date] = None
    narration: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CoSettlementPostIn(BaseModel):
    entry_date: Optional[date] = None


# ── Manufacturing orders ─────────────────────────────────────────────────────

class OrderCostLineCreate(BaseModel):
    category: str
    description: Optional[str] = None
    product_id: Optional[UUID] = None
    activity_type_id: Optional[UUID] = None
    overhead_pool_id: Optional[UUID] = None
    uom: str = "EA"
    qty_planned: Decimal = Field(default=Decimal("0"))
    qty_actual: Decimal = Field(default=Decimal("0"))
    rate_planned: Decimal = Field(default=Decimal("0"))
    rate_actual: Decimal = Field(default=Decimal("0"))
    amount_planned: Decimal = Field(default=Decimal("0"))
    amount_actual: Decimal = Field(default=Decimal("0"))
    sequence: int = 0


class OrderCostLineOut(BaseModel):
    id: UUID
    order_id: UUID
    category: str
    description: Optional[str]
    product_id: Optional[UUID]
    activity_type_id: Optional[UUID]
    overhead_pool_id: Optional[UUID]
    uom: str
    qty_planned: Decimal
    qty_actual: Decimal
    rate_planned: Decimal
    rate_actual: Decimal
    amount_planned: Decimal
    amount_actual: Decimal
    sequence: int

    class Config:
        from_attributes = True


class ManufacturingOrderCreate(BaseModel):
    company_id: UUID
    order_no: Optional[str] = None
    title: Optional[str] = None
    order_kind: str = "assembly"  # assembly | process | project | internal
    status: str = "draft"
    priority: str = "medium"
    product_id: Optional[UUID] = None
    qty_planned: Decimal = Field(default=Decimal("0"))
    qty_delivered: Decimal = Field(default=Decimal("0"))
    cost_center_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    ref_doc_type: Optional[str] = None
    ref_doc_id: Optional[UUID] = None
    standard_cost_version_id: Optional[UUID] = None
    scheduled_start: Optional[date] = None
    scheduled_end: Optional[date] = None
    notes: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)
    cost_lines: List[OrderCostLineCreate] = Field(default_factory=list)


class ManufacturingOrderUpdate(BaseModel):
    title: Optional[str] = None
    order_kind: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    product_id: Optional[UUID] = None
    qty_planned: Optional[Decimal] = None
    qty_delivered: Optional[Decimal] = None
    cost_center_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    ref_doc_type: Optional[str] = None
    ref_doc_id: Optional[UUID] = None
    standard_cost_version_id: Optional[UUID] = None
    scheduled_start: Optional[date] = None
    scheduled_end: Optional[date] = None
    notes: Optional[str] = None
    extra: Optional[dict[str, Any]] = None


class ManufacturingOrderOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    order_no: str
    title: Optional[str]
    order_kind: str
    status: str
    priority: Optional[str]
    product_id: Optional[UUID]
    qty_planned: Decimal
    qty_delivered: Decimal
    cost_center_id: Optional[UUID]
    project_id: Optional[UUID]
    ref_doc_type: Optional[str]
    ref_doc_id: Optional[UUID]
    standard_cost_version_id: Optional[UUID]
    scheduled_start: Optional[date]
    scheduled_end: Optional[date]
    released_at: Optional[datetime]
    completed_at: Optional[datetime]
    notes: Optional[str]
    extra: dict[str, Any]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    cost_lines: List[OrderCostLineOut] = Field(default_factory=list)
    operations: List[OrderOperationOut] = Field(default_factory=list)
    production_completion_journal_id: Optional[UUID] = None
    cogs_issue_journal_id: Optional[UUID] = None
    settlement_status: Optional[str] = "none"
    cost_bookings: List[CoCostBookingOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class OrderCostLinePatch(BaseModel):
    qty_planned: Optional[Decimal] = None
    qty_actual: Optional[Decimal] = None
    rate_planned: Optional[Decimal] = None
    rate_actual: Optional[Decimal] = None
    amount_planned: Optional[Decimal] = None
    amount_actual: Optional[Decimal] = None
    description: Optional[str] = None


class OrderVarianceOut(BaseModel):
    order_id: UUID
    order_no: str
    planned_total: Decimal
    actual_total: Decimal
    variance: Decimal
    by_category: dict[str, dict[str, Decimal]]


class WipSummaryOut(BaseModel):
    company_id: Optional[UUID]
    open_orders: int
    wip_planned_value: Decimal
    wip_actual_cost: Decimal
    orders: List[dict[str, Any]]


class VarianceLineDetail(BaseModel):
    line_id: UUID
    category: str
    description: Optional[str]
    qty_planned: Decimal
    qty_actual: Decimal
    rate_planned: Decimal
    rate_actual: Decimal
    amount_planned: Decimal
    amount_actual: Decimal
    price_variance: Decimal
    usage_variance: Decimal
    total_variance: Decimal


class OrderVarianceDetailedOut(BaseModel):
    order_id: UUID
    order_no: str
    planned_total: Decimal
    actual_total: Decimal
    variance: Decimal
    by_category: dict[str, dict[str, Decimal]]
    price_variance_total: Decimal
    usage_variance_total: Decimal
    lines: List[VarianceLineDetail]


class WipReportOut(BaseModel):
    company_id: Optional[UUID]
    group_by: str
    groups: List[dict[str, Any]]


# ── Activity Confirmations ────────────────────────────────────────────────────

class ActivityConfirmationCreate(BaseModel):
    company_id: UUID
    order_id: UUID
    operation_id: Optional[UUID] = None
    activity_type_id: Optional[UUID] = None
    cost_center_id: Optional[UUID] = None
    confirmation_date: date
    confirmation_type: str = "labor"
    qty_confirmed: Decimal = Field(default=Decimal("0"))
    hours_confirmed: Decimal = Field(default=Decimal("0"))
    rate_per_hour: Decimal = Field(default=Decimal("0"))
    scrap_qty: Decimal = Field(default=Decimal("0"))
    yield_pct: Decimal = Field(default=Decimal("100"))
    narration: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)


class ActivityConfirmationUpdate(BaseModel):
    confirmation_date: Optional[date] = None
    confirmation_type: Optional[str] = None
    qty_confirmed: Optional[Decimal] = None
    hours_confirmed: Optional[Decimal] = None
    rate_per_hour: Optional[Decimal] = None
    scrap_qty: Optional[Decimal] = None
    yield_pct: Optional[Decimal] = None
    narration: Optional[str] = None
    status: Optional[str] = None


class ActivityConfirmationOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    order_id: UUID
    operation_id: Optional[UUID]
    activity_type_id: Optional[UUID]
    cost_center_id: Optional[UUID]
    confirmation_date: date
    confirmation_type: str
    qty_confirmed: Decimal
    hours_confirmed: Decimal
    rate_per_hour: Decimal
    total_cost: Decimal
    scrap_qty: Decimal
    yield_pct: Decimal
    status: str
    narration: Optional[str]
    journal_entry_id: Optional[UUID]
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Goods Movements ───────────────────────────────────────────────────────────

class GoodsMovementCreate(BaseModel):
    company_id: UUID
    order_id: UUID
    movement_type: str  # 261 | 262 | 101 | 102
    posting_date: date
    product_id: Optional[UUID] = None
    description: Optional[str] = None
    uom: str = "EA"
    qty: Decimal = Field(default=Decimal("0"))
    unit_cost: Decimal = Field(default=Decimal("0"))
    cost_center_id: Optional[UUID] = None
    storage_location: Optional[str] = None
    batch_no: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)


class GoodsMovementOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    order_id: UUID
    movement_type: str
    posting_date: date
    document_no: Optional[str]
    product_id: Optional[UUID]
    description: Optional[str]
    uom: str
    qty: Decimal
    unit_cost: Decimal
    total_cost: Decimal
    cost_center_id: Optional[UUID]
    storage_location: Optional[str]
    batch_no: Optional[str]
    status: str
    reversal_reason: Optional[str]
    journal_entry_id: Optional[UUID]
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Cost Allocations ─────────────────────────────────────────────────────────

class CostAllocationCreate(BaseModel):
    company_id: UUID
    period_year: int
    period_month: int
    allocation_cycle: Optional[str] = None
    sender_cost_center_id: Optional[UUID] = None
    receiver_cost_center_id: Optional[UUID] = None
    receiver_order_id: Optional[UUID] = None
    sender_account_id: Optional[UUID] = None
    receiver_account_id: Optional[UUID] = None
    allocation_method: str = "percentage"
    allocation_value: Decimal = Field(default=Decimal("0"))
    allocated_amount: Decimal = Field(default=Decimal("0"))
    narration: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)


class CostAllocationOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    period_year: int
    period_month: int
    allocation_cycle: Optional[str]
    sender_cost_center_id: Optional[UUID]
    receiver_cost_center_id: Optional[UUID]
    receiver_order_id: Optional[UUID]
    sender_account_id: Optional[UUID]
    receiver_account_id: Optional[UUID]
    allocation_method: str
    allocation_value: Decimal
    allocated_amount: Decimal
    status: str
    posting_date: Optional[date]
    narration: Optional[str]
    journal_entry_id: Optional[UUID]
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CostAllocationPostIn(BaseModel):
    entry_date: Optional[date] = None


# ── Budget Lines ──────────────────────────────────────────────────────────────

class BudgetLineCreate(BaseModel):
    company_id: UUID
    order_id: UUID
    budget_type: str = "original"
    category: str
    description: Optional[str] = None
    fiscal_year: Optional[int] = None
    period_month: Optional[int] = None
    amount_budgeted: Decimal = Field(default=Decimal("0"))
    currency: str = "USD"
    notes: Optional[str] = None


class BudgetLineUpdate(BaseModel):
    budget_type: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amount_budgeted: Optional[Decimal] = None
    notes: Optional[str] = None


class BudgetLineOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    order_id: UUID
    budget_type: str
    category: str
    description: Optional[str]
    fiscal_year: Optional[int]
    period_month: Optional[int]
    amount_budgeted: Decimal
    currency: str
    notes: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class InternalOrderBudgetVsActualOut(BaseModel):
    order_id: UUID
    order_no: str
    title: Optional[str]
    order_kind: str
    status: str
    total_budgeted: Decimal
    total_actual: Decimal
    total_variance: Decimal
    by_category: dict[str, dict[str, Decimal]]
    budget_lines: List[BudgetLineOut]


# ── Variance Runs ─────────────────────────────────────────────────────────────

class VarianceRunCreate(BaseModel):
    company_id: UUID
    period_year: int
    period_month: int
    run_type: str = "production_variance"
    run_date: date
    narration: Optional[str] = None


class VarianceRunOut(BaseModel):
    id: UUID
    vendor_id: UUID
    company_id: UUID
    period_year: int
    period_month: int
    run_type: str
    run_date: date
    total_planned: Decimal
    total_actual: Decimal
    total_variance: Decimal
    price_variance: Decimal
    usage_variance: Decimal
    overhead_variance: Decimal
    scrap_variance: Decimal
    order_count: int
    status: str
    narration: Optional[str]
    journal_entry_id: Optional[UUID]
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class VarianceRunPostIn(BaseModel):
    entry_date: Optional[date] = None


# ── Status transitions ────────────────────────────────────────────────────────

class OrderStatusTransitionIn(BaseModel):
    status: str  # released | in_progress | completed | closed | cancelled
    notes: Optional[str] = None


# ── Period-end report ─────────────────────────────────────────────────────────

class PeriodEndReportOut(BaseModel):
    company_id: Optional[UUID]
    period_year: int
    period_month: int
    open_orders: int
    completed_orders: int
    total_planned: Decimal
    total_actual: Decimal
    total_variance: Decimal
    pending_variance_runs: int
    pending_allocations: int
    goods_movements_count: int
    activity_confirmations_count: int

