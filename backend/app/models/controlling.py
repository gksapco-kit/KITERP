# app/models/controlling.py
"""Controlling (CO) — product cost planning, manufacturing / process / project orders,
activity types, overhead pools, planned vs actual, WIP and variance support."""
import uuid
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean,
    Numeric, Integer, Date, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CoActivityType(Base):
    """Activity category for cost absorption (machine, labor, setup, etc.)."""
    __tablename__ = "co_activity_type"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(30), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    uom = Column(String(20), default="H")  # H=hours, MH=machine hours, EA=each
    default_cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "company_id", "code", name="uq_co_act_vendor_company_code"),
        Index("ix_co_act_vendor", "vendor_id"),
    )


class CoOverheadPool(Base):
    """Overhead cost pool with allocation base (driver)."""
    __tablename__ = "co_overhead_pool"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(30), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    allocation_base = Column(String(40), nullable=False, default="labor_hours")
    # labor_hours | machine_hours | material_cost | units_produced | direct_labor_cost
    overhead_type = Column(String(20), default="indirect")  # direct | indirect
    # formula_type: fixed_rate | pct_of_base | per_machine_hour | per_labor_hour | per_unit
    formula_type = Column(String(30), default="fixed_rate")
    formula_value = Column(Numeric(18, 6), default=0)   # percentage or rate depending on formula_type
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rates = relationship("CoOverheadRate", back_populates="pool", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("vendor_id", "company_id", "code", name="uq_co_oh_pool_vendor_company_code"),
    )


class CoOverheadRate(Base):
    """Period rate for a pool (amount per one unit of allocation_base, tenant currency)."""
    __tablename__ = "co_overhead_rate"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pool_id = Column(UUID(as_uuid=True), ForeignKey("co_overhead_pool.id", ondelete="CASCADE"), nullable=False, index=True)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    rate_per_unit = Column(Numeric(18, 6), nullable=False, default=0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    pool = relationship("CoOverheadPool", back_populates="rates")

    __table_args__ = (
        Index("ix_co_oh_rate_pool_from", "pool_id", "effective_from"),
    )


class CoProductCostVersion(Base):
    """Standard / planned cost for one finished good (one version per validity)."""
    __tablename__ = "co_product_cost_version"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)
    version_code = Column(String(40), nullable=False)
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date, nullable=True)
    status = Column(String(20), default="draft")  # draft | active | archived
    routing_id = Column(UUID(as_uuid=True), ForeignKey("co_routing.id", ondelete="SET NULL"), nullable=True, index=True)
    material_total_planned = Column(Numeric(18, 4), default=0)
    activity_total_planned = Column(Numeric(18, 4), default=0)
    direct_overhead_total_planned = Column(Numeric(18, 4), default=0)
    indirect_overhead_total_planned = Column(Numeric(18, 4), default=0)
    overhead_total_planned = Column(Numeric(18, 4), default=0)
    rolled_up_unit_cost = Column(Numeric(18, 6), default=0)
    notes = Column(Text)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    routing = relationship("CoRouting")

    lines = relationship(
        "CoProductCostLine", back_populates="version", cascade="all, delete-orphan", order_by="CoProductCostLine.sequence"
    )

    __table_args__ = (
        UniqueConstraint("vendor_id", "company_id", "product_id", "version_code", name="uq_co_pcv_version"),
        Index("ix_co_pcv_product_status", "vendor_id", "product_id", "status"),
    )


class CoProductCostLine(Base):
    """One planned cost element for a product cost version (material / activity / overhead)."""
    __tablename__ = "co_product_cost_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_id = Column(UUID(as_uuid=True), ForeignKey("co_product_cost_version.id", ondelete="CASCADE"), nullable=False, index=True)
    line_type = Column(String(20), nullable=False)  # material | activity | overhead
    description = Column(String(500))
    component_product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="SET NULL"))
    activity_type_id = Column(UUID(as_uuid=True), ForeignKey("co_activity_type.id", ondelete="SET NULL"))
    overhead_pool_id = Column(UUID(as_uuid=True), ForeignKey("co_overhead_pool.id", ondelete="SET NULL"))
    qty_per_output_unit = Column(Numeric(18, 6), default=0)  # components per 1 FG, or hours per 1 FG
    unit_rate_planned = Column(Numeric(18, 6), default=0)
    amount_planned = Column(Numeric(18, 4), default=0)
    sequence = Column(Integer, default=0)

    version = relationship("CoProductCostVersion", back_populates="lines")

    __table_args__ = (
        Index("ix_co_pcl_version", "version_id"),
    )


class CoManufacturingOrder(Base):
    """
    Manufacturing, assembly, process, or internal / project order.
    order_kind: assembly | process | project | internal
    """
    __tablename__ = "co_manufacturing_order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    order_no = Column(String(40), nullable=False)
    title = Column(String(200), nullable=True)
    order_kind = Column(String(20), nullable=False, default="assembly")
    status = Column(String(20), nullable=False, default="draft")
    priority = Column(String(20), default="medium")  # low | medium | high | urgent
    # draft | released | in_progress | completed | closed | cancelled
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="SET NULL"), nullable=True, index=True)
    qty_planned = Column(Numeric(18, 4), default=0)
    qty_delivered = Column(Numeric(18, 4), default=0)
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"))
    project_id = Column(UUID(as_uuid=True), ForeignKey("fin_project.id", ondelete="SET NULL"))
    # Link to source document (e.g. sales order) for traceability
    ref_doc_type = Column(String(40), nullable=True)
    ref_doc_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    # Standard cost snapshot used for planning (optional)
    standard_cost_version_id = Column(
        UUID(as_uuid=True), ForeignKey("co_product_cost_version.id", ondelete="SET NULL"), nullable=True
    )
    scheduled_start = Column(Date, nullable=True)
    scheduled_end = Column(Date, nullable=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cost_lines = relationship(
        "CoOrderCostLine", back_populates="order", cascade="all, delete-orphan", order_by="CoOrderCostLine.sequence"
    )
    operations = relationship(
        "CoOrderOperation",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="CoOrderOperation.sequence",
    )
    cost_bookings = relationship(
        "CoCostBooking",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="CoCostBooking.created_at",
    )
    # Latest GL settlements (detail also in co_cost_booking)
    production_completion_journal_id = Column(
        UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True
    )
    cogs_issue_journal_id = Column(
        UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True
    )
    settlement_status = Column(String(30), default="none")
    # none | production_posted | cogs_partial | cogs_closed

    __table_args__ = (
        UniqueConstraint("vendor_id", "order_no", name="uq_co_mo_vendor_order_no"),
        Index("ix_co_mo_vendor_status", "vendor_id", "status"),
        Index("ix_co_mo_project", "project_id"),
        Index("ix_co_mo_ref_doc", "vendor_id", "ref_doc_type", "ref_doc_id"),
    )


class CoGlMapping(Base):
    """Per-company GL accounts for CO settlement (WIP, FG, COGS, variance)."""
    __tablename__ = "co_gl_mapping"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    wip_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    finished_goods_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    cogs_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    production_variance_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    raw_material_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "company_id", name="uq_co_gl_mapping_vendor_company"),
    )


class CoCostBooking(Base):
    """Posted (or pending) cost booking tied to a manufacturing order — links to fin_journal_entry."""
    __tablename__ = "co_cost_booking"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("co_manufacturing_order.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_type = Column(String(40), nullable=False)
    # production_completion | cogs_issue | variance_adjustment | wip_accrual
    amount = Column(Numeric(18, 4), default=0)
    qty_basis = Column(Numeric(18, 6), nullable=True)
    unit_cost = Column(Numeric(18, 6), nullable=True)
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    entry_date = Column(Date, nullable=True)
    narration = Column(Text)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("CoManufacturingOrder", back_populates="cost_bookings")

    __table_args__ = (
        Index("ix_co_cb_order", "order_id", "booking_type"),
    )


class CoOrderOperation(Base):
    """
    Routing step for assembly / process orders — planned vs confirmed activity (hours, qty).
    source: manual | from_standard (generated from product standard cost activity lines).
    """
    __tablename__ = "co_order_operation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("co_manufacturing_order.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence = Column(Integer, nullable=False, default=0)
    operation_code = Column(String(30), nullable=True)
    name = Column(String(200), nullable=False, default="Operation")
    activity_type_id = Column(UUID(as_uuid=True), ForeignKey("co_activity_type.id", ondelete="SET NULL"))
    work_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"))
    planned_qty = Column(Numeric(18, 4), default=0)  # good output units for this step
    confirmed_qty = Column(Numeric(18, 4), default=0)
    scrap_qty = Column(Numeric(18, 4), default=0)
    planned_hours = Column(Numeric(18, 6), default=0)
    actual_hours = Column(Numeric(18, 6), default=0)
    planned_rate = Column(Numeric(18, 6), default=0)  # cost per hour (or per unit if uom EA)
    actual_rate = Column(Numeric(18, 6), default=0)
    status = Column(String(20), default="pending")  # pending | released | in_progress | completed
    source = Column(String(20), default="manual")  # manual | from_standard
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("CoManufacturingOrder", back_populates="operations")

    __table_args__ = (
        Index("ix_co_oo_order_seq", "order_id", "sequence"),
    )


class CoOrderCostLine(Base):
    """Planned and actual amounts for one cost element on an order."""
    __tablename__ = "co_order_cost_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("co_manufacturing_order.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(20), nullable=False)  # material | activity | overhead | scrap | other
    description = Column(String(500))
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="SET NULL"))
    activity_type_id = Column(UUID(as_uuid=True), ForeignKey("co_activity_type.id", ondelete="SET NULL"))
    overhead_pool_id = Column(UUID(as_uuid=True), ForeignKey("co_overhead_pool.id", ondelete="SET NULL"))
    uom = Column(String(20), default="EA")
    qty_planned = Column(Numeric(18, 6), default=0)
    qty_actual = Column(Numeric(18, 6), default=0)
    rate_planned = Column(Numeric(18, 6), default=0)
    rate_actual = Column(Numeric(18, 6), default=0)
    amount_planned = Column(Numeric(18, 4), default=0)
    amount_actual = Column(Numeric(18, 4), default=0)
    sequence = Column(Integer, default=0)

    order = relationship("CoManufacturingOrder", back_populates="cost_lines")

    __table_args__ = (
        Index("ix_co_ocl_order", "order_id"),
    )


# ── New extended CO models ───────────────────────────────────────────────────

class CoActivityConfirmation(Base):
    """
    Actual activity time/cost confirmation for an order or operation.
    Represents a posted time-sheet entry: hours performed, cost rate, total cost.
    confirmation_type: labor | machine | setup | other
    """
    __tablename__ = "co_activity_confirmation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("co_manufacturing_order.id", ondelete="CASCADE"), nullable=False, index=True)
    operation_id = Column(UUID(as_uuid=True), ForeignKey("co_order_operation.id", ondelete="SET NULL"), nullable=True, index=True)
    activity_type_id = Column(UUID(as_uuid=True), ForeignKey("co_activity_type.id", ondelete="SET NULL"), nullable=True)
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"), nullable=True)
    confirmation_date = Column(Date, nullable=False)
    confirmation_type = Column(String(20), default="labor")  # labor | machine | setup | other
    qty_confirmed = Column(Numeric(18, 4), default=0)       # output qty confirmed for this step
    hours_confirmed = Column(Numeric(18, 6), default=0)
    rate_per_hour = Column(Numeric(18, 6), default=0)
    total_cost = Column(Numeric(18, 4), default=0)
    scrap_qty = Column(Numeric(18, 4), default=0)
    yield_pct = Column(Numeric(7, 4), default=100)          # 0-100
    status = Column(String(20), default="posted")           # posted | reversed
    narration = Column(Text)
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("CoManufacturingOrder")

    __table_args__ = (
        Index("ix_co_ac_order_date", "order_id", "confirmation_date"),
        Index("ix_co_ac_vendor", "vendor_id", "confirmation_date"),
    )


class CoGoodsMovement(Base):
    """
    Goods movement tied to a manufacturing order.
    movement_type:
      261 = goods issue (component to order)
      262 = return of component from order
      101 = goods receipt (FG from order)
      102 = return of FG to order
    """
    __tablename__ = "co_goods_movement"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("co_manufacturing_order.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type = Column(String(10), nullable=False)       # 261 | 262 | 101 | 102
    posting_date = Column(Date, nullable=False)
    document_no = Column(String(40), nullable=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    description = Column(String(500))
    uom = Column(String(20), default="EA")
    qty = Column(Numeric(18, 6), default=0)
    unit_cost = Column(Numeric(18, 6), default=0)
    total_cost = Column(Numeric(18, 4), default=0)
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"), nullable=True)
    storage_location = Column(String(50), nullable=True)
    batch_no = Column(String(50), nullable=True)
    status = Column(String(20), default="posted")           # posted | reversed
    reversal_reason = Column(Text, nullable=True)
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("CoManufacturingOrder")

    __table_args__ = (
        Index("ix_co_gm_order_type", "order_id", "movement_type"),
        Index("ix_co_gm_vendor_date", "vendor_id", "posting_date"),
    )


class CoCostAllocation(Base):
    """
    Period-end cost center allocation run (sender → receiver).
    allocation_method: percentage | fixed_amount | quantity_based | headcount
    status: planned | posted | reversed
    """
    __tablename__ = "co_cost_allocation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=False)
    allocation_cycle = Column(String(40), nullable=True)     # named cycle, e.g. "ADMIN-ALLOC"
    sender_cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"), nullable=True)
    receiver_cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"), nullable=True)
    receiver_order_id = Column(UUID(as_uuid=True), ForeignKey("co_manufacturing_order.id", ondelete="SET NULL"), nullable=True)
    sender_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"), nullable=True)
    receiver_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"), nullable=True)
    allocation_method = Column(String(30), default="percentage")
    allocation_value = Column(Numeric(18, 6), default=0)    # e.g. 25.00 for 25%
    allocated_amount = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="planned")
    posting_date = Column(Date, nullable=True)
    narration = Column(Text)
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_co_ca_vendor_period", "vendor_id", "period_year", "period_month"),
        Index("ix_co_ca_sender_cc", "sender_cost_center_id"),
    )


class CoBudgetLine(Base):
    """
    Budget planning line for an internal order or project.
    budget_type: original | revised | supplement
    category: material | labor | overhead | other
    """
    __tablename__ = "co_budget_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("co_manufacturing_order.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_type = Column(String(20), default="original")    # original | revised | supplement
    category = Column(String(30), nullable=False)           # material | labor | overhead | other
    description = Column(String(500))
    fiscal_year = Column(Integer, nullable=True)
    period_month = Column(Integer, nullable=True)
    amount_budgeted = Column(Numeric(18, 4), default=0)
    currency = Column(String(10), default="USD")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("CoManufacturingOrder")

    __table_args__ = (
        Index("ix_co_bl_order", "order_id"),
        Index("ix_co_bl_vendor_year", "vendor_id", "fiscal_year"),
    )


class CoVarianceRun(Base):
    """
    Period-end variance settlement run — posts production variances to P&L accounts.
    run_type: production_variance | overhead_variance | price_variance
    status: open | posted | reversed
    """
    __tablename__ = "co_variance_run"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=False)
    run_type = Column(String(30), default="production_variance")
    run_date = Column(Date, nullable=False)
    total_planned = Column(Numeric(18, 4), default=0)
    total_actual = Column(Numeric(18, 4), default=0)
    total_variance = Column(Numeric(18, 4), default=0)
    price_variance = Column(Numeric(18, 4), default=0)
    usage_variance = Column(Numeric(18, 4), default=0)
    overhead_variance = Column(Numeric(18, 4), default=0)
    scrap_variance = Column(Numeric(18, 4), default=0)
    order_count = Column(Integer, default=0)
    status = Column(String(20), default="open")
    narration = Column(Text)
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_co_vr_vendor_period", "vendor_id", "period_year", "period_month"),
    )


# ── Work Centers ──────────────────────────────────────────────────────────────

class CoWorkCenter(Base):
    """Machine / labour station with cost rates for activity-based costing."""
    __tablename__ = "co_work_center"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    wc_type = Column(String(20), default="machine")  # machine | labor | outsource
    capacity_uom = Column(String(10), default="H")   # H=hours, MH=machine-hours
    # Direct cost rates
    labor_rate_per_hour = Column(Numeric(18, 6), default=0)
    machine_rate_per_hour = Column(Numeric(18, 6), default=0)
    # Direct overhead absorbed per machine-hour
    direct_overhead_rate = Column(Numeric(18, 6), default=0)
    # Capacity (planned hours per period)
    capacity_hours_per_period = Column(Numeric(10, 2), default=0)
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, server_default="true")
    notes = Column(Text)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    routing_operations = relationship("CoRoutingOperation", back_populates="work_center")

    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_co_wc_company_code"),
        Index("ix_co_wc_company", "company_id", "is_active"),
    )


# ── Routings ──────────────────────────────────────────────────────────────────

class CoRouting(Base):
    """Production routing — ordered sequence of operations for a product."""
    __tablename__ = "co_routing"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="SET NULL"), nullable=True, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    version = Column(String(20), default="1")
    status = Column(String(20), default="draft")  # draft | active | obsolete
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    uom = Column(String(10), default="EA")
    lot_size = Column(Numeric(18, 4), default=1)    # base qty the routing is defined for
    notes = Column(Text)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    operations = relationship(
        "CoRoutingOperation", back_populates="routing",
        cascade="all, delete-orphan",
        order_by="CoRoutingOperation.seq_no",
    )

    __table_args__ = (
        UniqueConstraint("company_id", "code", "version", name="uq_co_routing_code_ver"),
        Index("ix_co_routing_product", "company_id", "product_id"),
    )


class CoRoutingOperation(Base):
    """One operation step within a routing."""
    __tablename__ = "co_routing_operation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routing_id = Column(UUID(as_uuid=True), ForeignKey("co_routing.id", ondelete="CASCADE"), nullable=False, index=True)
    work_center_id = Column(UUID(as_uuid=True), ForeignKey("co_work_center.id", ondelete="SET NULL"), nullable=True, index=True)
    activity_type_id = Column(UUID(as_uuid=True), ForeignKey("co_activity_type.id", ondelete="SET NULL"), nullable=True)
    seq_no = Column(Integer, default=10)
    operation_code = Column(String(50))
    description = Column(String(200))
    # Time components (hours per lot_size units unless noted)
    setup_hrs = Column(Numeric(10, 4), default=0)
    run_hrs_per_unit = Column(Numeric(10, 6), default=0)   # per output unit
    teardown_hrs = Column(Numeric(10, 4), default=0)
    machine_hrs_per_unit = Column(Numeric(10, 6), default=0)
    # Costing overrides (if blank, taken from work center rates)
    labor_rate_override = Column(Numeric(18, 6), nullable=True)
    machine_rate_override = Column(Numeric(18, 6), nullable=True)
    # Direct overhead percentage on top of direct labor+machine cost
    direct_overhead_pct = Column(Numeric(7, 4), default=0)
    notes = Column(Text)
    extra = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    routing = relationship("CoRouting", back_populates="operations")
    work_center = relationship("CoWorkCenter", back_populates="routing_operations")
