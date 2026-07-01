"""Work centers and routing operations for the (vendor-scoped) Production Orders module.

This is intentionally separate and lighter-weight than the `co_*` Controlling
module (`app/models/controlling.py`), which models a full SAP-CO style
manufacturing/costing flow scoped by `company_id` (a `fin_company`, i.e. a
legal entity under double-entry accounting). The shop-floor Production
Order module (`ProductionOrder`) is scoped only by `vendor_id`/`store_id` and
does not require a finance company to exist, so routing here mirrors that
same lightweight scoping.
"""
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Numeric, DateTime, ForeignKey,
    UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class WorkCenter(Base):
    """A machine, workstation or crew that performs production operations."""
    __tablename__ = "work_center"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True, index=True)

    code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Planning: hours/units available per day — used to flag overloaded centers when scheduling.
    capacity_per_day = Column(Numeric(10, 2), nullable=True)
    # Costing: labor+overhead rate absorbed per hour of operation time run here (Phase 7 roll-up).
    cost_per_hour = Column(Numeric(12, 2), nullable=False, default=0)

    is_active = Column(Boolean, default=True, server_default="true")
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_work_center_vendor_code"),
        Index("idx_work_center_vendor", "vendor_id"),
        Index("idx_work_center_plant", "vendor_id", "plant_id"),
    )


class ProductionOperation(Base):
    """One routing step of a production order (e.g. Cutting -> Stitching -> QC -> Packing)."""
    __tablename__ = "production_operation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    production_order_id = Column(
        UUID(as_uuid=True), ForeignKey("production_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    work_center_id = Column(UUID(as_uuid=True), ForeignKey("work_center.id", ondelete="SET NULL"), nullable=True, index=True)

    sequence = Column(Integer, nullable=False, default=0)
    name = Column(String(200), nullable=False, default="Operation")
    status = Column(String(20), nullable=False, default="pending")  # pending | in_progress | completed | skipped

    planned_hours = Column(Numeric(10, 2), nullable=True, default=0)
    actual_hours = Column(Numeric(10, 2), nullable=True)

    # Scheduling (feeds the operation-level timeline; the order-level Gantt uses target_date instead).
    planned_start = Column(DateTime(timezone=True), nullable=True)
    planned_end = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_prod_op_order_seq", "production_order_id", "sequence"),
        Index("idx_prod_op_vendor", "vendor_id"),
        Index("idx_prod_op_work_center", "work_center_id"),
    )
