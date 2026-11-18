# app/models/asset_mgmt.py
"""Asset Management module (``am_*`` tables).

Owns the *physical* side of an asset: who holds it, where it is, its condition, documents, audits,
maintenance, warranty / insurance and the lifecycle timeline.  The *financial* side (cost
capitalisation, depreciation, disposal gain/loss, journal entries) stays in Finance (``fin_asset*``);
an ``AmAsset`` is optionally linked to one ``FinAsset`` through ``fin_asset_id`` and every GL touch
goes through ``app.services.asset_mgmt.finance_bridge``.
"""
import uuid

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

# ── Controlled vocabularies (validated in the service layer) ─────────────────────────────────────
ASSET_STATUSES = (
    "in_stock", "assigned", "in_transit", "under_maintenance", "reserved", "lost", "retired", "disposed",
)
ASSET_CONDITIONS = ("new", "good", "fair", "poor", "damaged")
LOCATION_TYPES = ("site", "building", "floor", "room", "store", "vehicle", "other")
ASSIGNEE_TYPES = ("employee", "department", "store", "location")
TRANSFER_STATUSES = ("draft", "requested", "approved", "in_transit", "received", "rejected", "cancelled")
REQUEST_STATUSES = ("pending", "approved", "rejected", "fulfilled", "cancelled")
AUDIT_STATUSES = ("draft", "in_progress", "completed", "cancelled")
AUDIT_RESULTS = ("pending", "found", "missing", "damaged", "wrong_location")
WORK_ORDER_TYPES = ("preventive", "corrective", "inspection")
WORK_ORDER_STATUSES = ("open", "in_progress", "completed", "cancelled")
COVERAGE_TYPES = ("warranty", "insurance", "amc")
DOCUMENT_TYPES = ("invoice", "manual", "photo", "warranty_card", "certificate", "agreement", "other")


def _pk():
    return Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _vendor():
    return Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)


def _ts():
    return Column(DateTime(timezone=True), server_default=func.now())


class AmSequence(Base):
    """Per-vendor document counters (asset tags, transfer / request / audit / work-order numbers)."""
    __tablename__ = "am_sequence"

    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), primary_key=True)
    key = Column(String(30), primary_key=True)
    next_value = Column(Integer, nullable=False, default=1)


class AmCategory(Base):
    __tablename__ = "am_category"
    __table_args__ = (UniqueConstraint("vendor_id", "name", name="uq_am_category_vendor_name"),)

    id = _pk()
    vendor_id = _vendor()
    name = Column(String(120), nullable=False)
    code = Column(String(10))                       # tag prefix, e.g. "LAP" -> LAP-000012
    parent_id = Column(UUID(as_uuid=True), ForeignKey("am_category.id", ondelete="SET NULL"))
    description = Column(Text)
    is_it_asset = Column(Boolean, default=False)    # exposes IP / MAC / OS / licence fields in the UI
    is_capitalizable = Column(Boolean, default=True)
    requires_serial = Column(Boolean, default=False)
    fin_category_id = Column(UUID(as_uuid=True), ForeignKey("fin_asset_category.id", ondelete="SET NULL"))
    default_useful_life_years = Column(Integer)
    default_depreciation_method = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = _ts()


class AmLocation(Base):
    __tablename__ = "am_location"
    __table_args__ = (UniqueConstraint("vendor_id", "name", "parent_id", name="uq_am_location_vendor_name_parent"),)

    id = _pk()
    vendor_id = _vendor()
    name = Column(String(150), nullable=False)
    code = Column(String(30))
    parent_id = Column(UUID(as_uuid=True), ForeignKey("am_location.id", ondelete="SET NULL"))
    location_type = Column(String(20), default="room")
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"))
    address = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = _ts()


class AmAsset(Base):
    __tablename__ = "am_asset"
    __table_args__ = (
        UniqueConstraint("vendor_id", "asset_tag", name="uq_am_asset_vendor_tag"),
        Index("ix_am_asset_vendor_status", "vendor_id", "status"),
        Index("ix_am_asset_vendor_employee", "vendor_id", "current_employee_id"),
        Index("ix_am_asset_serial", "vendor_id", "serial_number"),
    )
    __mapper_args__ = {"eager_defaults": True}

    id = _pk()
    vendor_id = _vendor()
    asset_tag = Column(String(40), nullable=False)   # printed on the QR / barcode label
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category_id = Column(UUID(as_uuid=True), ForeignKey("am_category.id", ondelete="SET NULL"), index=True)
    parent_asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="SET NULL"), index=True)

    status = Column(String(20), nullable=False, default="in_stock")
    condition = Column(String(20), default="good")

    serial_number = Column(String(120))
    barcode = Column(String(120))                    # manufacturer / legacy barcode, scannable too
    manufacturer = Column(String(120))
    model = Column(String(120))
    image_url = Column(String(500))
    attributes = Column(JSONB, default=dict)        # free-form specs (IP, MAC, OS, RAM ...)

    # Acquisition
    acquisition_date = Column(Date)
    acquisition_cost = Column(Numeric(18, 4), default=0)
    salvage_value = Column(Numeric(18, 4), default=0)
    supplier_name = Column(String(200))
    purchase_ref = Column(String(120))               # PO / invoice number
    vendor_bill_id = Column(UUID(as_uuid=True), ForeignKey("fin_vendor_bill.id", ondelete="SET NULL"))

    # Where / with whom
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("am_location.id", ondelete="SET NULL"), index=True)
    holder_type = Column(String(20))                 # employee / department / store / location
    current_employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="SET NULL"))
    current_department_id = Column(UUID(as_uuid=True), ForeignKey("hr_department.id", ondelete="SET NULL"))

    # Usage
    is_reservable = Column(Boolean, default=False)   # shared asset that can be booked for a time slot
    meter_reading = Column(Numeric(18, 4))           # odometer / hours counter for meter-based maintenance
    meter_unit = Column(String(20))

    # Finance link (optional, unique: one physical asset <-> one fixed-asset register entry)
    fin_asset_id = Column(UUID(as_uuid=True), ForeignKey("fin_asset.id", ondelete="SET NULL"), unique=True)

    # Disposal / retirement
    disposed_on = Column(Date)
    disposal_reason = Column(Text)

    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("AmCategory", foreign_keys=[category_id])
    location = relationship("AmLocation", foreign_keys=[location_id])
    employee = relationship("EmployeeProfile", foreign_keys=[current_employee_id])
    department = relationship("Department", foreign_keys=[current_department_id])


class AmAssignment(Base):
    """Custody history: one row per check-out; ``returned_at`` is NULL while the asset is still held."""
    __tablename__ = "am_assignment"
    __table_args__ = (Index("ix_am_assignment_asset_open", "asset_id", "returned_at"),)

    id = _pk()
    vendor_id = _vendor()
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    assignee_type = Column(String(20), nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="SET NULL"), index=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("hr_department.id", ondelete="SET NULL"))
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"))
    location_id = Column(UUID(as_uuid=True), ForeignKey("am_location.id", ondelete="SET NULL"))
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    due_back_on = Column(Date)
    returned_at = Column(DateTime(timezone=True))
    condition_out = Column(String(20))
    condition_in = Column(String(20))
    acknowledged_at = Column(DateTime(timezone=True))  # employee accepted custody
    notes = Column(Text)
    return_notes = Column(Text)
    assigned_by = Column(UUID(as_uuid=True))
    received_by = Column(UUID(as_uuid=True))

    asset = relationship("AmAsset", foreign_keys=[asset_id])
    employee = relationship("EmployeeProfile", foreign_keys=[employee_id])
    department = relationship("Department", foreign_keys=[department_id])


class AmTransfer(Base):
    __tablename__ = "am_transfer"
    __table_args__ = (UniqueConstraint("vendor_id", "transfer_no", name="uq_am_transfer_vendor_no"),)

    id = _pk()
    vendor_id = _vendor()
    transfer_no = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    from_location_id = Column(UUID(as_uuid=True), ForeignKey("am_location.id", ondelete="SET NULL"))
    to_location_id = Column(UUID(as_uuid=True), ForeignKey("am_location.id", ondelete="SET NULL"))
    from_store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"))
    to_store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"))
    reason = Column(Text)
    requested_by = Column(UUID(as_uuid=True))
    approved_by = Column(UUID(as_uuid=True))
    approved_at = Column(DateTime(timezone=True))
    dispatched_at = Column(DateTime(timezone=True))
    received_by = Column(UUID(as_uuid=True))
    received_at = Column(DateTime(timezone=True))
    decision_notes = Column(Text)
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship("AmTransferLine", back_populates="transfer", cascade="all, delete-orphan")


class AmTransferLine(Base):
    __tablename__ = "am_transfer_line"

    id = _pk()
    transfer_id = Column(UUID(as_uuid=True), ForeignKey("am_transfer.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    condition_out = Column(String(20))
    condition_in = Column(String(20))
    received = Column(Boolean, default=False)
    notes = Column(Text)

    transfer = relationship("AmTransfer", back_populates="lines")
    asset = relationship("AmAsset", foreign_keys=[asset_id])


class AmRequest(Base):
    __tablename__ = "am_request"
    __table_args__ = (UniqueConstraint("vendor_id", "request_no", name="uq_am_request_vendor_no"),)

    id = _pk()
    vendor_id = _vendor()
    request_no = Column(String(30), nullable=False)
    request_type = Column(String(20), default="new")       # new / replacement
    title = Column(String(200), nullable=False)
    justification = Column(Text)
    category_id = Column(UUID(as_uuid=True), ForeignKey("am_category.id", ondelete="SET NULL"))
    quantity = Column(Integer, default=1)
    priority = Column(String(10), default="medium")
    needed_by = Column(Date)
    requester_employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="SET NULL"), index=True)
    requester_user_id = Column(UUID(as_uuid=True))
    status = Column(String(20), nullable=False, default="pending")
    decided_by = Column(UUID(as_uuid=True))
    decided_at = Column(DateTime(timezone=True))
    decision_notes = Column(Text)
    fulfilled_asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="SET NULL"))
    fulfilled_at = Column(DateTime(timezone=True))
    purchase_requisition_id = Column(UUID(as_uuid=True))   # soft reference to a procurement PR
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AmAudit(Base):
    __tablename__ = "am_audit"
    __table_args__ = (UniqueConstraint("vendor_id", "audit_no", name="uq_am_audit_vendor_no"),)

    id = _pk()
    vendor_id = _vendor()
    audit_no = Column(String(30), nullable=False)
    name = Column(String(200), nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    scope_location_id = Column(UUID(as_uuid=True), ForeignKey("am_location.id", ondelete="SET NULL"))
    scope_category_id = Column(UUID(as_uuid=True), ForeignKey("am_category.id", ondelete="SET NULL"))
    scope_store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"))
    planned_date = Column(Date)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = _ts()

    lines = relationship("AmAuditLine", back_populates="audit", cascade="all, delete-orphan")


class AmAuditLine(Base):
    __tablename__ = "am_audit_line"
    __table_args__ = (UniqueConstraint("audit_id", "asset_id", name="uq_am_audit_line_asset"),)

    id = _pk()
    audit_id = Column(UUID(as_uuid=True), ForeignKey("am_audit.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    expected_location_id = Column(UUID(as_uuid=True), ForeignKey("am_location.id", ondelete="SET NULL"))
    result = Column(String(20), nullable=False, default="pending")
    found_location_id = Column(UUID(as_uuid=True), ForeignKey("am_location.id", ondelete="SET NULL"))
    condition_observed = Column(String(20))
    unexpected = Column(Boolean, default=False)      # scanned although it was not in the audit scope
    scanned_at = Column(DateTime(timezone=True))
    scanned_by = Column(UUID(as_uuid=True))
    resolved = Column(Boolean, default=False)        # variance has been actioned
    notes = Column(Text)

    audit = relationship("AmAudit", back_populates="lines")
    asset = relationship("AmAsset", foreign_keys=[asset_id])


class AmMaintenancePlan(Base):
    """Recurring preventive-maintenance schedule (time-based and/or meter-based) for one asset."""
    __tablename__ = "am_maintenance_plan"

    id = _pk()
    vendor_id = _vendor()
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    interval_days = Column(Integer)
    interval_meter = Column(Numeric(18, 4))
    last_done_on = Column(Date)
    last_done_meter = Column(Numeric(18, 4))
    next_due_on = Column(Date, index=True)
    priority = Column(String(10), default="medium")
    estimated_cost = Column(Numeric(18, 4), default=0)
    service_provider = Column(String(200))           # supplier name (copied from the master when supplier_id is set)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="SET NULL"), index=True)
    is_active = Column(Boolean, default=True)
    created_at = _ts()

    asset = relationship("AmAsset", foreign_keys=[asset_id])


class AmWorkOrder(Base):
    __tablename__ = "am_work_order"
    __table_args__ = (UniqueConstraint("vendor_id", "wo_no", name="uq_am_work_order_vendor_no"),)

    id = _pk()
    vendor_id = _vendor()
    wo_no = Column(String(30), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("am_maintenance_plan.id", ondelete="SET NULL"))
    wo_type = Column(String(20), default="corrective")
    title = Column(String(200), nullable=False)
    description = Column(Text)
    priority = Column(String(10), default="medium")
    status = Column(String(20), nullable=False, default="open")
    scheduled_on = Column(Date, index=True)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    assigned_employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="SET NULL"))
    service_provider = Column(String(200))           # supplier name (copied from the master when supplier_id is set)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="SET NULL"), index=True)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="SET NULL"), index=True)
    vendor_bill_id = Column(UUID(as_uuid=True), ForeignKey("fin_vendor_bill.id", ondelete="SET NULL"), index=True)
    cost_labor = Column(Numeric(18, 4), default=0)
    cost_parts = Column(Numeric(18, 4), default=0)
    cost_total = Column(Numeric(18, 4), default=0)
    parts = Column(JSONB, default=list)              # [{name, qty, unit_cost, product_id?}]
    downtime_hours = Column(Numeric(10, 2))
    meter_reading = Column(Numeric(18, 4))
    resolution_notes = Column(Text)
    capitalize = Column(Boolean, default=False)      # add cost to the asset's book value instead of expensing
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    created_by = Column(UUID(as_uuid=True))
    created_at = _ts()
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    asset = relationship("AmAsset", foreign_keys=[asset_id])


class AmCoverage(Base):
    """Warranty, insurance policy or annual maintenance contract covering an asset."""
    __tablename__ = "am_coverage"
    __table_args__ = (Index("ix_am_coverage_end", "vendor_id", "end_date"),)

    id = _pk()
    vendor_id = _vendor()
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    coverage_type = Column(String(20), nullable=False)
    provider = Column(String(200))
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="SET NULL"), index=True)
    reference_no = Column(String(120))               # policy / contract / warranty number
    start_date = Column(Date)
    end_date = Column(Date)
    cost = Column(Numeric(18, 4), default=0)
    coverage_amount = Column(Numeric(18, 4))
    contact = Column(String(200))
    terms = Column(Text)
    renewal_alert_days = Column(Integer, default=30)
    last_alerted_on = Column(Date)
    is_active = Column(Boolean, default=True)
    created_at = _ts()

    asset = relationship("AmAsset", foreign_keys=[asset_id])


class AmDocument(Base):
    __tablename__ = "am_document"

    id = _pk()
    vendor_id = _vendor()
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type = Column(String(20), default="other")
    name = Column(String(255), nullable=False)
    file_url = Column(String(600), nullable=False)
    content_type = Column(String(120))
    size = Column(Integer)
    is_image = Column(Boolean, default=False)
    notes = Column(Text)
    uploaded_by = Column(UUID(as_uuid=True))
    created_at = _ts()


class AmEvent(Base):
    """Append-only lifecycle timeline of an asset."""
    __tablename__ = "am_event"
    __table_args__ = (Index("ix_am_event_asset_time", "asset_id", "created_at"),)

    id = _pk()
    vendor_id = _vendor()
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(30), nullable=False)
    summary = Column(String(500))
    data = Column(JSONB, default=dict)
    actor_user_id = Column(UUID(as_uuid=True))
    created_at = _ts()


class AmReservation(Base):
    __tablename__ = "am_reservation"
    __table_args__ = (Index("ix_am_reservation_asset_time", "asset_id", "start_at", "end_at"),)

    id = _pk()
    vendor_id = _vendor()
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="SET NULL"))
    reserved_by = Column(UUID(as_uuid=True))
    start_at = Column(DateTime(timezone=True), nullable=False)
    end_at = Column(DateTime(timezone=True), nullable=False)
    purpose = Column(String(300))
    status = Column(String(20), nullable=False, default="booked")   # booked / cancelled / completed
    created_at = _ts()

    asset = relationship("AmAsset", foreign_keys=[asset_id])
    employee = relationship("EmployeeProfile", foreign_keys=[employee_id])


class AmLicense(Base):
    """Software licence pool with seat tracking (IT assets)."""
    __tablename__ = "am_license"

    id = _pk()
    vendor_id = _vendor()
    name = Column(String(200), nullable=False)
    publisher = Column(String(200))
    license_type = Column(String(20), default="per_seat")   # per_seat / site / subscription
    license_key = Column(Text)
    total_seats = Column(Integer, default=1)
    purchase_date = Column(Date)
    expiry_date = Column(Date)
    cost = Column(Numeric(18, 4), default=0)
    renewal_alert_days = Column(Integer, default=30)
    last_alerted_on = Column(Date)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = _ts()

    seats = relationship("AmLicenseSeat", back_populates="license", cascade="all, delete-orphan")


class AmLicenseSeat(Base):
    __tablename__ = "am_license_seat"

    id = _pk()
    license_id = Column(UUID(as_uuid=True), ForeignKey("am_license.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = _vendor()
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="SET NULL"), index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("am_asset.id", ondelete="SET NULL"))
    assigned_at = _ts()
    revoked_at = Column(DateTime(timezone=True))

    license = relationship("AmLicense", back_populates="seats")
    employee = relationship("EmployeeProfile", foreign_keys=[employee_id])
