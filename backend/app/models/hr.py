# app/models/hr.py
"""HR & Staff Management models — extends VendorUser with employee profiles,
attendance, leave management, salary structures, payroll, and offer letters."""
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, Integer, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Department(Base):
    __tablename__ = "hr_department"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20))
    description = Column(Text)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True)
    # head set after employees are created; circular ref handled at DB level with nullable FK
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    employees = relationship("EmployeeProfile", back_populates="department", foreign_keys="EmployeeProfile.department_id")
    children = relationship("Department", backref=__import__('sqlalchemy.orm', fromlist=['backref']).backref("parent", remote_side="Department.id"))

    __table_args__ = (
        Index("ix_hr_dept_vendor", "vendor_id"),
    )


class Designation(Base):
    __tablename__ = "hr_designation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    level = Column(Integer, default=1)  # seniority level; higher = senior
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employees = relationship("EmployeeProfile", back_populates="designation", foreign_keys="EmployeeProfile.designation_id")


class EmployeeProfile(Base):
    __tablename__ = "hr_employee_profile"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="CASCADE"), nullable=True, unique=True)

    # Display name when no portal login (vendor_user) is linked yet
    full_name = Column(String(200))

    # Auto-generated employee code (EMP-001 per vendor)
    employee_code = Column(String(30))

    # Personal
    date_of_birth = Column(Date)
    gender = Column(String(20))           # male / female / other / prefer_not_to_say
    blood_group = Column(String(5))
    marital_status = Column(String(20))   # single / married / divorced / widowed
    nationality = Column(String(50), default="Indian")

    # Contact
    personal_email = Column(String(255))
    personal_phone = Column(String(20))
    emergency_contact_name = Column(String(100))
    emergency_contact_phone = Column(String(20))
    emergency_contact_relation = Column(String(50))

    # Addresses (JSONB)
    current_address = Column(JSONB, default={})
    permanent_address = Column(JSONB, default={})

    # Employment
    department_id = Column(UUID(as_uuid=True), ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True)
    designation_id = Column(UUID(as_uuid=True), ForeignKey("hr_designation.id", ondelete="SET NULL"), nullable=True)
    manager_id = Column(
        UUID(as_uuid=True),
        ForeignKey("hr_employee_profile.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    employment_type = Column(String(20), default="full_time")  # full_time / part_time / contract / intern
    date_of_joining = Column(Date)
    date_of_exit = Column(Date)
    probation_end_date = Column(Date)
    notice_period_days = Column(Integer, default=30)
    status = Column(String(20), default="active")  # active / on_notice / exited / probation

    # Credentials / Access
    employee_code_custom = Column(String(50))      # user-specified code / username
    pos_pin_hash = Column(String(255))             # hashed 4-6 digit PIN for quick POS login
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)
    tagged_to_type = Column(String(30))            # store | department | location | remote | custom
    tagged_to_label = Column(String(100))          # free-text label when tagged_to_type = custom

    # Exit Information
    lwd = Column(Date)                             # Last Working Day
    exit_reason = Column(String(50))               # resignation / termination / retirement / absconding / other
    exit_interview_notes = Column(Text)
    exit_clearance = Column(JSONB, default={})     # {it: bool, finance: bool, admin: bool, hr: bool}
    notice_served = Column(Boolean, default=False)

    # Family Members
    family_members = Column(JSONB, default=[])     # [{name, relation, dob, phone, gender, blood_group}]

    # Internal notes
    notes = Column(Text)

    # Bank / Compliance
    bank_name = Column(String(100))
    account_number = Column(String(30))
    account_holder_name = Column(String(255))
    account_type = Column(String(20), default="savings")  # savings / current
    ifsc_code = Column(String(15))
    pan_number = Column(String(12))
    aadhaar_number = Column(String(12))
    uan_number = Column(String(20))    # PF
    esi_number = Column(String(20))

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    vendor_user = relationship("VendorUser", backref="employee_profile", foreign_keys=[vendor_user_id])
    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    designation = relationship("Designation", back_populates="employees", foreign_keys=[designation_id])
    manager = relationship(
        "EmployeeProfile",
        remote_side="EmployeeProfile.id",
        foreign_keys=[manager_id],
        backref="direct_reports",
    )
    documents = relationship("EmployeeDocument", back_populates="employee", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")
    leave_balances = relationship("LeaveBalance", back_populates="employee", cascade="all, delete-orphan")
    salary_structures = relationship("SalaryStructure", back_populates="employee", cascade="all, delete-orphan")
    payroll_entries = relationship("PayrollEntry", back_populates="employee", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_hr_emp_vendor", "vendor_id"),
        Index("ix_hr_emp_status", "vendor_id", "status"),
    )


class EmployeeDocument(Base):
    __tablename__ = "hr_employee_document"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type = Column(String(30), nullable=False)  # aadhaar / pan / passport / offer_letter / experience / education / other
    document_name = Column(String(255), nullable=False)
    file_url = Column(String(500))
    expiry_date = Column(Date)
    notes = Column(Text)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("EmployeeProfile", back_populates="documents")


class AttendanceRecord(Base):
    __tablename__ = "hr_attendance_record"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    clock_in = Column(DateTime(timezone=True))
    clock_out = Column(DateTime(timezone=True))
    clock_in_location = Column(JSONB)   # {lat, lng, address}
    clock_out_location = Column(JSONB)
    status = Column(String(20), default="present")  # present / absent / half_day / late / on_leave / holiday / week_off
    work_hours = Column(Numeric(4, 2))
    overtime_hours = Column(Numeric(4, 2), default=0)
    notes = Column(Text)
    marked_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id"), nullable=True)  # null = self
    # Approval workflow
    approval_status = Column(String(20), default="pending")  # pending / approved / rejected
    approved_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("EmployeeProfile", back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
        Index("ix_hr_att_date", "employee_id", "date"),
    )


class LeavePolicy(Base):
    __tablename__ = "hr_leave_policy"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)          # Casual Leave, Sick Leave, etc.
    code = Column(String(20), nullable=False)           # CL, SL, EL
    days_per_year = Column(Numeric(5, 1), default=12)
    carry_forward = Column(Boolean, default=False)
    max_carry_forward_days = Column(Numeric(5, 1), default=0)
    is_paid = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    leave_balances = relationship("LeaveBalance", back_populates="leave_policy", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="leave_policy")


class LeaveBalance(Base):
    __tablename__ = "hr_leave_balance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False)
    leave_policy_id = Column(UUID(as_uuid=True), ForeignKey("hr_leave_policy.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    allocated = Column(Numeric(5, 1), default=0)
    used = Column(Numeric(5, 1), default=0)
    carried_forward = Column(Numeric(5, 1), default=0)
    # available = allocated + carried_forward - used  (computed at read time)

    employee = relationship("EmployeeProfile", back_populates="leave_balances")
    leave_policy = relationship("LeavePolicy", back_populates="leave_balances")

    __table_args__ = (
        UniqueConstraint("employee_id", "leave_policy_id", "year", name="uq_leave_balance_emp_policy_year"),
    )


class LeaveRequest(Base):
    __tablename__ = "hr_leave_request"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_policy_id = Column(UUID(as_uuid=True), ForeignKey("hr_leave_policy.id"), nullable=False)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    days = Column(Numeric(5, 1), nullable=False)
    reason = Column(Text)
    status = Column(String(20), default="pending")   # pending / approved / rejected / cancelled
    approved_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    is_half_day = Column(Boolean, default=False)
    half_day_type = Column(String(20))               # first_half / second_half
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("EmployeeProfile", back_populates="leave_requests")
    leave_policy = relationship("LeavePolicy", back_populates="leave_requests")

    __table_args__ = (
        Index("ix_hr_leave_req_status", "employee_id", "status"),
    )


class Holiday(Base):
    __tablename__ = "hr_holiday"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    is_optional = Column(Boolean, default=False)
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SalaryStructure(Base):
    __tablename__ = "hr_salary_structure"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    effective_from = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True)

    # Flexible earnings/deductions stored as JSONB key-value dicts
    # earnings: {basic, hra, da, special_allowance, conveyance, medical, ...}
    earnings = Column(JSONB, default={})
    # deductions: {pf_employee, pf_employer, esi_employee, esi_employer, professional_tax, tds, ...}
    deductions = Column(JSONB, default={})

    ctc_annual = Column(Numeric(14, 2), default=0)
    ctc_monthly = Column(Numeric(12, 2), default=0)
    gross_monthly = Column(Numeric(12, 2), default=0)
    net_monthly = Column(Numeric(12, 2), default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("EmployeeProfile", back_populates="salary_structures")


class PayrollRun(Base):
    __tablename__ = "hr_payroll_run"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    month = Column(Integer, nullable=False)    # 1-12
    year = Column(Integer, nullable=False)
    status = Column(String(20), default="draft")  # draft / processing / processed / paid
    processed_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id"), nullable=True)
    processed_at = Column(DateTime(timezone=True))
    total_gross = Column(Numeric(14, 2), default=0)
    total_deductions = Column(Numeric(14, 2), default=0)
    total_net = Column(Numeric(14, 2), default=0)
    employee_count = Column(Integer, default=0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    version = Column(Integer, default=1, nullable=False)   # run version within a period (v1, v2 …)

    entries = relationship("PayrollEntry", back_populates="payroll_run", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("vendor_id", "month", "year", "version", name="uq_payroll_vendor_month_year_version"),
        Index("ix_hr_payroll_vendor", "vendor_id", "year", "month"),
    )


class PayrollEntry(Base):
    """Per-employee payslip within a payroll run."""
    __tablename__ = "hr_payroll_entry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_run_id = Column(UUID(as_uuid=True), ForeignKey("hr_payroll_run.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)

    earnings = Column(JSONB, default={})      # snapshot breakdown
    deductions = Column(JSONB, default={})
    days_worked = Column(Numeric(5, 1), default=0)
    days_absent = Column(Numeric(5, 1), default=0)
    leave_days = Column(Numeric(5, 1), default=0)
    overtime_hours = Column(Numeric(5, 2), default=0)
    gross_amount = Column(Numeric(12, 2), default=0)
    total_deductions = Column(Numeric(12, 2), default=0)
    net_amount = Column(Numeric(12, 2), default=0)
    status = Column(String(20), default="draft")  # draft / processed / paid

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    payroll_run = relationship("PayrollRun", back_populates="entries")
    employee = relationship("EmployeeProfile", back_populates="payroll_entries")


class OfferLetterTemplate(Base):
    """Reusable text blocks for offer letter generation, scoped by role/department/store."""
    __tablename__ = "hr_offer_letter_template"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id   = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name        = Column(String(150), nullable=False)
    description = Column(String(300), nullable=True)
    body_html   = Column(Text, nullable=False)        # may contain {{merge_var}} tokens
    layout      = Column(String(30), default="standard", nullable=False)
    is_default  = Column(Boolean, default=False, nullable=False)

    watermark_enabled = Column(Boolean, default=False, nullable=False)
    watermark_text    = Column(String(120), nullable=True)
    watermark_opacity = Column(String(10), default="0.12", nullable=False)
    watermark_style   = Column(String(30), default="diagonal_text", nullable=False)

    logo_url  = Column(String(500), nullable=True)
    show_logo = Column(Boolean, default=True, nullable=False)
    logo_shape = Column(String(20), default="rounded", nullable=False)

    # Scope — NULL means "applies to any value of that dimension"
    designation_id = Column(UUID(as_uuid=True), ForeignKey("hr_designation.id", ondelete="SET NULL"), nullable=True)
    department_id  = Column(UUID(as_uuid=True), ForeignKey("hr_department.id",  ondelete="SET NULL"), nullable=True)
    store_id       = Column(UUID(as_uuid=True), ForeignKey("store.id",           ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    designation = relationship("Designation", foreign_keys=[designation_id])
    department  = relationship("Department",  foreign_keys=[department_id])
    store       = relationship("Store",       foreign_keys=[store_id])

    __table_args__ = (
        UniqueConstraint("vendor_id", "name", name="uq_offer_letter_template_vendor_name"),
        Index("ix_offer_letter_template_scope", "vendor_id", "designation_id", "department_id", "store_id"),
    )


class OfferLetter(Base):
    __tablename__ = "hr_offer_letter"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    # Candidate
    candidate_name = Column(String(100), nullable=False)
    candidate_email = Column(String(255))
    candidate_phone = Column(String(20))

    # Role offered
    designation_id = Column(UUID(as_uuid=True), ForeignKey("hr_designation.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True)

    # Offer details
    offered_ctc = Column(Numeric(14, 2))
    offered_date = Column(Date)
    joining_date = Column(Date)
    expiry_date = Column(Date)

    status = Column(String(20), default="draft")  # draft / sent / accepted / rejected / expired
    template_id = Column(UUID(as_uuid=True), ForeignKey("hr_offer_letter_template.id", ondelete="SET NULL"), nullable=True)
    layout = Column(String(30), nullable=True)
    template_content = Column(Text)               # full HTML of the offer letter
    notes = Column(Text)

    sent_at = Column(DateTime(timezone=True))
    responded_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    designation = relationship("Designation", foreign_keys=[designation_id])
    department = relationship("Department", foreign_keys=[department_id])
    template = relationship("OfferLetterTemplate", foreign_keys=[template_id])
