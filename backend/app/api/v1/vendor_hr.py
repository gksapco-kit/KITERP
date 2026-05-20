# app/api/v1/vendor_hr.py
"""HR & Staff Management API – mounted at /vendors/me/hr"""
from __future__ import annotations
from typing import Optional, List, Any
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_user, require_permission
from app.models.vendor_user import VendorUser
from app.services.hr_service import HRService

router = APIRouter()

_OPTIONAL_EMP_DATE_FIELDS_IN = (
    "date_of_birth",
    "date_of_joining",
    "probation_end_date",
    "lwd",
)
_OPTIONAL_EMP_DATE_FIELDS_UPDATE = _OPTIONAL_EMP_DATE_FIELDS_IN + ("date_of_exit",)


def _coerce_optional_date(v: Any) -> Optional[date]:
    if v is None or v == "":
        return None
    return v


# ═══════════════════════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════════════════════

class DeptIn(BaseModel):
    name: str = Field(..., max_length=100)
    code: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None
    parent_id: Optional[UUID] = None

class DeptUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class DesigIn(BaseModel):
    name: str = Field(..., max_length=100)
    level: int = 1

class DesigUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[int] = None
    is_active: Optional[bool] = None


class EmployeeIn(BaseModel):
    vendor_user_id: Optional[UUID] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    employee_code_custom: Optional[str] = Field(None, max_length=50)
    pos_pin: Optional[str] = Field(None, min_length=4, max_length=6, pattern=r"^\d+$")
    store_id: Optional[UUID] = None
    tagged_to_type: Optional[str] = Field(None, max_length=30)
    tagged_to_label: Optional[str] = Field(None, max_length=100)
    lwd: Optional[date] = None
    exit_reason: Optional[str] = Field(None, max_length=50)
    exit_interview_notes: Optional[str] = None
    exit_clearance: Optional[dict] = None
    notice_served: Optional[bool] = None
    family_members: Optional[List[dict]] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    current_address: Optional[dict] = None
    permanent_address: Optional[dict] = None
    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    employment_type: Optional[str] = "full_time"
    date_of_joining: Optional[date] = None
    probation_end_date: Optional[date] = None
    notice_period_days: Optional[int] = 30
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_type: Optional[str] = "savings"
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = Field(None, max_length=12)
    uan_number: Optional[str] = None
    esi_number: Optional[str] = None
    notes: Optional[str] = None

    @field_validator(*_OPTIONAL_EMP_DATE_FIELDS_IN, mode="before")
    @classmethod
    def _optional_dates(cls, v: Any) -> Optional[date]:
        return _coerce_optional_date(v)


class EmployeePortalPasswordIn(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    employee_code_custom: Optional[str] = Field(None, max_length=50)
    pos_pin: Optional[str] = Field(None, min_length=4, max_length=6, pattern=r"^\d+$")
    store_id: Optional[UUID] = None
    tagged_to_type: Optional[str] = Field(None, max_length=30)
    tagged_to_label: Optional[str] = Field(None, max_length=100)
    lwd: Optional[date] = None
    exit_reason: Optional[str] = Field(None, max_length=50)
    exit_interview_notes: Optional[str] = None
    exit_clearance: Optional[dict] = None
    notice_served: Optional[bool] = None
    family_members: Optional[List[dict]] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    current_address: Optional[dict] = None
    permanent_address: Optional[dict] = None
    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    employment_type: Optional[str] = None
    date_of_joining: Optional[date] = None
    date_of_exit: Optional[date] = None
    probation_end_date: Optional[date] = None
    notice_period_days: Optional[int] = None
    status: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_type: Optional[str] = None
    ifsc_code: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = Field(None, max_length=12)
    uan_number: Optional[str] = None
    esi_number: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator(*_OPTIONAL_EMP_DATE_FIELDS_UPDATE, mode="before")
    @classmethod
    def _optional_dates(cls, v: Any) -> Optional[date]:
        return _coerce_optional_date(v)


class DocumentIn(BaseModel):
    document_type: str
    document_name: str
    file_url: Optional[str] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None


class ClockInOut(BaseModel):
    location: Optional[dict] = None   # {lat, lng, address}


class MarkAttendance(BaseModel):
    employee_id: UUID
    date: date
    status: str  # present / absent / half_day / late / on_leave / holiday / week_off
    notes: Optional[str] = None


class UpdateAttendance(BaseModel):
    status: Optional[str] = None
    clock_in: Optional[str] = None   # ISO datetime string
    clock_out: Optional[str] = None
    work_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    notes: Optional[str] = None
    approval_status: Optional[str] = None  # pending / approved / rejected
    rejection_reason: Optional[str] = None


class LeavePolicyIn(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=20)
    days_per_year: float = 12
    carry_forward: bool = False
    max_carry_forward_days: float = 0
    is_paid: bool = True

class LeavePolicyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    days_per_year: Optional[float] = None
    carry_forward: Optional[bool] = None
    max_carry_forward_days: Optional[float] = None
    is_paid: Optional[bool] = None
    is_active: Optional[bool] = None


class LeaveRequestIn(BaseModel):
    leave_policy_id: UUID
    from_date: date
    to_date: date
    days: float
    reason: Optional[str] = None
    is_half_day: bool = False
    half_day_type: Optional[str] = None


class LeaveApproval(BaseModel):
    rejection_reason: Optional[str] = None


class HolidayIn(BaseModel):
    name: str = Field(..., max_length=100)
    date: date
    is_optional: bool = False
    year: int


class SalaryStructureIn(BaseModel):
    employee_id: UUID
    effective_from: date
    earnings: dict = {}
    deductions: dict = {}


class PayrollProcessIn(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)


class OfferLetterIn(BaseModel):
    candidate_name: str
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    designation_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    store_id: Optional[UUID] = None          # entity / branch
    offered_ctc: Optional[float] = None
    offered_date: Optional[date] = None
    joining_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    template_id: Optional[UUID] = None      # if set, render this template as content

class OfferLetterUpdate(OfferLetterIn):
    candidate_name: Optional[str] = None  # type: ignore[assignment]
    template_content: Optional[str] = None


class OfferLetterTemplateIn(BaseModel):
    name: str
    description: Optional[str] = None
    body_html: str
    designation_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    store_id: Optional[UUID] = None
    is_default: bool = False

class OfferLetterTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    body_html: Optional[str] = None
    designation_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    store_id: Optional[UUID] = None
    is_default: Optional[bool] = None


# ═══════════════════════════════════════════════════════════════════
# Helper serialisers
# ═══════════════════════════════════════════════════════════════════

def _d(obj: Any, depth: int = 0) -> Any:
    """Recursively serialise SQLAlchemy model to dict."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, (list, tuple)):
        return [_d(v, depth) for v in obj]
    if hasattr(obj, "__dict__") and depth < 3:
        exclude = {"_sa_instance_state", "password_hash"}
        return {k: _d(v, depth + 1) for k, v in obj.__dict__.items() if k not in exclude and not k.startswith("_")}
    return str(obj)


# ═══════════════════════════════════════════════════════════════════
# Departments
# ═══════════════════════════════════════════════════════════════════

@router.get("/departments")
async def list_departments(
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    items = await svc.list_departments(vu.vendor_id)
    return [_d(i) for i in items]


@router.post("/departments", status_code=201)
async def create_department(
    body: DeptIn,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    dept = await svc.create_department(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(dept)


@router.put("/departments/{dept_id}")
async def update_department(
    dept_id: UUID,
    body: DeptUpdate,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    dept = await svc.update_department(dept_id, vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(dept)


@router.delete("/departments/{dept_id}", status_code=204)
async def delete_department(
    dept_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    await svc.delete_department(dept_id, vu.vendor_id)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# Designations
# ═══════════════════════════════════════════════════════════════════

@router.get("/designations")
async def list_designations(
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    return [_d(i) for i in await svc.list_designations(vu.vendor_id)]


@router.post("/designations", status_code=201)
async def create_designation(
    body: DesigIn,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    desig = await svc.create_designation(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(desig)


@router.put("/designations/{desig_id}")
async def update_designation(
    desig_id: UUID,
    body: DesigUpdate,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    desig = await svc.update_designation(desig_id, vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(desig)


@router.delete("/designations/{desig_id}", status_code=204)
async def delete_designation(
    desig_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    await svc.delete_designation(desig_id, vu.vendor_id)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# Employees
# ═══════════════════════════════════════════════════════════════════

@router.get("/employees/eligible-for-access")
async def list_employees_eligible_for_access(
    search: Optional[str] = None,
    limit: int = Query(100, ge=1, le=200),
    vu: VendorUser = Depends(require_permission("team.invite")),
    db: AsyncSession = Depends(get_db),
):
    """HR employees not yet granted portal access — for Staff Access Control invite."""
    svc = HRService(db)
    items = await svc.list_employees_without_portal_access(
        vu.vendor_id, search=search, limit=limit
    )
    return {
        "items": [
            {
                "id": str(e.id),
                "full_name": e.full_name,
                "employee_code": e.employee_code,
                "personal_email": e.personal_email,
                "personal_phone": e.personal_phone,
                "department": e.department.name if e.department else None,
                "designation": e.designation.name if e.designation else None,
            }
            for e in items
        ],
    }


@router.get("/employees")
async def list_employees(
    department_id: Optional[UUID] = None,
    status: Optional[str] = None,
    employment_type: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    result = await svc.list_employees(
        vu.vendor_id,
        department_id=department_id,
        status=status,
        employment_type=employment_type,
        search=search,
        skip=skip,
        limit=limit,
    )
    return {"items": [_d(e) for e in result["items"]], "total": result["total"]}


@router.get("/employees/{emp_id}")
async def get_employee(
    emp_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    return _d(await svc.get_employee(emp_id, vu.vendor_id))


@router.get("/employees/next-code")
async def preview_next_employee_code(
    store_id: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Return what the next auto-generated employee code would be for a given employer (store)."""
    from sqlalchemy import select, func
    from app.models.hr import EmployeeProfile
    if store_id:
        from app.models.store import Store
        from uuid import UUID as _UUID
        store_result = await db.execute(select(Store).where(Store.id == _UUID(store_id)))
        store = store_result.scalar_one_or_none()
        prefix = (store.code or store.name[:3]).upper() if store else "EMP"
        count_result = await db.execute(
            select(func.count()).select_from(EmployeeProfile)
            .where(EmployeeProfile.vendor_id == vu.vendor_id, EmployeeProfile.store_id == _UUID(store_id))
        )
    else:
        prefix = "EMP"
        count_result = await db.execute(
            select(func.count()).select_from(EmployeeProfile).where(EmployeeProfile.vendor_id == vu.vendor_id)
        )
    count = count_result.scalar_one()
    return {"next_code": f"{prefix}-{count + 1:03d}"}


@router.post("/employees", status_code=201)
async def create_employee(
    body: EmployeeIn,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    from passlib.context import CryptContext
    svc = HRService(db)
    data = body.model_dump(exclude_none=True)
    if "pos_pin" in data:
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        data["pos_pin_hash"] = ctx.hash(data.pop("pos_pin"))
    emp = await svc.create_employee(vu.vendor_id, data)
    if data.get("lwd") is not None:
        from app.services.hr_access_sync import sync_lwd_to_vendor_user_access
        await sync_lwd_to_vendor_user_access(db, emp, lwd=emp.lwd, previous_lwd=None)

    # Auto-provision portal access + initial OTP so admin can share credentials immediately
    try:
        await _provision_portal_otp(db, emp, vu.vendor_id, vu.user_id)
    except HTTPException:
        pass  # Employee has no code/email yet — admin can generate OTP later from Credentials tab

    await db.commit()
    await db.refresh(emp)
    return _d(emp)


@router.put("/employees/{emp_id}")
async def update_employee(
    emp_id: UUID,
    body: EmployeeUpdate,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    from passlib.context import CryptContext
    svc = HRService(db)
    data = body.model_dump(exclude_none=True)
    if "manager_id" in body.model_fields_set:
        data["manager_id"] = body.manager_id
    for field in _OPTIONAL_EMP_DATE_FIELDS_UPDATE:
        if field in body.model_fields_set:
            data[field] = getattr(body, field)
    if "pos_pin" in data:
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        data["pos_pin_hash"] = ctx.hash(data.pop("pos_pin"))
    prev_emp = await svc.get_employee(emp_id, vu.vendor_id)
    previous_lwd = prev_emp.lwd if prev_emp else None
    emp = await svc.update_employee(emp_id, vu.vendor_id, data)
    if "lwd" in data:
        from app.services.hr_access_sync import sync_lwd_to_vendor_user_access
        await sync_lwd_to_vendor_user_access(
            db, emp, lwd=emp.lwd, previous_lwd=previous_lwd,
        )
    await db.commit()
    emp = await svc.get_employee(emp_id, vu.vendor_id)
    return _d(emp)


@router.post("/employees/{emp_id}/portal-password")
async def set_employee_portal_password(
    emp_id: UUID,
    body: EmployeePortalPasswordIn,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Set password for employee storefront HR / ESS login (linked User account)."""
    svc = HRService(db)
    await svc.set_employee_portal_password(emp_id, vu.vendor_id, body.password)
    await db.commit()
    return {"success": True, "message": "Employee portal password updated"}


OTP_VALIDITY_HOURS = 72


async def _provision_portal_otp(db, emp, vendor_id, invited_by_user_id):
    """
    Internal helper: generate a 10-char OTP for an employee's portal login.
    Auto-creates a User + VendorUser if the employee has no portal account yet.
    Returns (otp, login_identifier).
    """
    import secrets
    import string
    from datetime import datetime, timezone, timedelta
    from app.core.security import get_password_hash
    from app.models.user import User
    from app.models.vendor_user import VendorUser as VU

    alphabet = string.ascii_letters + string.digits
    otp = ''.join(secrets.choice(alphabet) for _ in range(10))
    expires_at = datetime.now(timezone.utc) + timedelta(hours=OTP_VALIDITY_HOURS)

    vu_link = emp.vendor_user
    if not vu_link or not vu_link.user:
        login_email = (emp.personal_email or "").strip() or None
        code = (emp.employee_code_custom or emp.employee_code or "").strip()
        if not login_email and code:
            login_email = f"{code.lower().replace(' ', '')}@portal.local"
        if not login_email:
            raise HTTPException(
                status_code=400,
                detail="Employee has no email or employee code. Add one before generating portal access.",
            )

        new_user = User(
            email=login_email,
            full_name=emp.full_name or code,
            password_hash=get_password_hash(otp),
            portal_temp_password=otp,
            portal_temp_password_expires_at=expires_at,
            is_active=True,
            is_email_verified=False,
            is_phone_verified=False,
        )
        db.add(new_user)
        await db.flush()

        now = datetime.now(timezone.utc)
        new_vu = VU(
            vendor_id=vendor_id,
            user_id=new_user.id,
            role="staff",
            is_active=True,
            invited_by=invited_by_user_id,
            invited_at=now,
            accepted_at=now,
        )
        db.add(new_vu)
        await db.flush()

        emp.vendor_user_id = new_vu.id
        db.add(emp)
        return otp, login_email, expires_at

    user = vu_link.user
    from app.core.security import get_password_hash as _hash
    user.password_hash = _hash(otp)
    user.portal_temp_password = otp
    user.portal_temp_password_expires_at = expires_at
    db.add(user)
    login = user.email or emp.employee_code_custom or emp.employee_code or ""
    return otp, login, expires_at


@router.post("/employees/{emp_id}/portal-otp")
async def generate_employee_portal_otp(
    emp_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate / regenerate a one-time temporary password (valid {OTP_VALIDITY_HOURS}h).
    Auto-provisions a portal user if the employee has none yet.
    """
    svc = HRService(db)
    emp = await svc.get_employee(emp_id, vu.vendor_id)
    otp, login, expires_at = await _provision_portal_otp(db, emp, vu.vendor_id, vu.user_id)
    await db.commit()
    await db.refresh(emp)
    return {
        "otp": otp,
        "login": login,
        "expires_at": expires_at.isoformat(),
        "employee_name": emp.full_name or login,
    }


@router.get("/employees/{emp_id}/documents")
async def list_documents(
    emp_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.get_employee(emp_id, vu.vendor_id)
    return [_d(d) for d in emp.documents]


@router.post("/employees/{emp_id}/documents", status_code=201)
async def add_document(
    emp_id: UUID,
    body: DocumentIn,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.models.hr import EmployeeDocument
    svc = HRService(db)
    emp = await svc.get_employee(emp_id, vu.vendor_id)
    doc = EmployeeDocument(employee_id=emp.id, **body.model_dump(exclude_none=True))
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return _d(doc)


@router.delete("/employees/{emp_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    emp_id: UUID,
    doc_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.hr import EmployeeDocument
    svc = HRService(db)
    await svc.get_employee(emp_id, vu.vendor_id)  # ownership check
    result = await db.execute(select(EmployeeDocument).where(EmployeeDocument.id == doc_id, EmployeeDocument.employee_id == emp_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# Attendance
# ═══════════════════════════════════════════════════════════════════

@router.post("/attendance/clock-in")
async def clock_in(
    body: ClockInOut,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found. Please contact HR.")
    record = await svc.clock_in(emp.id, body.location)
    await db.commit()
    return _d(record)


@router.post("/attendance/clock-out")
async def clock_out(
    body: ClockInOut,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found.")
    record = await svc.clock_out(emp.id, body.location)
    await db.commit()
    return _d(record)


@router.get("/attendance/my-today")
async def my_today(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        return {"clocked_in": False, "clocked_out": False, "employee": None}
    record = await svc.att_repo.get_today(emp.id, date.today())
    return {
        "employee_id": str(emp.id),
        "employee_code": emp.employee_code,
        "clocked_in": record is not None and record.clock_in is not None,
        "clocked_out": record is not None and record.clock_out is not None,
        "record": _d(record),
    }


@router.get("/attendance")
async def list_attendance(
    employee_id: Optional[UUID] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    vu: VendorUser = Depends(require_permission("hr.attendance")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    result = await svc.list_attendance(
        vu.vendor_id,
        employee_id=employee_id,
        from_date=from_date,
        to_date=to_date,
        status=status,
        skip=skip,
        limit=limit,
    )
    return {"items": [_d(r) for r in result["items"]], "total": result["total"]}


@router.post("/attendance/mark")
async def mark_attendance(
    body: MarkAttendance,
    vu: VendorUser = Depends(require_permission("hr.attendance")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    record = await svc.mark_attendance(
        vendor_id=vu.vendor_id,
        marked_by=vu.id,
        employee_id=body.employee_id,
        att_date=body.date,
        status=body.status,
        notes=body.notes,
    )
    await db.commit()
    return _d(record)


class MarkRangeBody(BaseModel):
    employee_ids: list[UUID] = []   # empty = all active employees in vendor
    from_date: date
    to_date: date
    status: str = "present"
    notes: Optional[str] = None
    skip_weekends: bool = True
    skip_existing: bool = True


@router.post("/attendance/mark-range")
async def mark_attendance_range(
    body: MarkRangeBody,
    vu: VendorUser = Depends(require_permission("hr.attendance")),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-mark attendance for one or more employees across a date range."""
    from sqlalchemy import select as _sel
    from app.models.hr import EmployeeProfile, AttendanceRecord
    import datetime as _dt
    import uuid as _uuid

    if body.from_date > body.to_date:
        from fastapi import HTTPException
        raise HTTPException(400, "from_date must be <= to_date")

    max_days = (body.to_date - body.from_date).days + 1
    if max_days > 366:
        from fastapi import HTTPException
        raise HTTPException(400, "Range cannot exceed 366 days")

    # Resolve employees
    if body.employee_ids:
        emp_result = await db.execute(
            _sel(EmployeeProfile).where(
                EmployeeProfile.vendor_id == vu.vendor_id,
                EmployeeProfile.id.in_(body.employee_ids),
                EmployeeProfile.is_active == True,
            )
        )
    else:
        emp_result = await db.execute(
            _sel(EmployeeProfile).where(
                EmployeeProfile.vendor_id == vu.vendor_id,
                EmployeeProfile.is_active == True,
                EmployeeProfile.status == "active",
            )
        )
    employees = list(emp_result.scalars().all())

    if not employees:
        return {"created": 0, "skipped": 0, "message": "No active employees found"}

    created = 0
    skipped = 0

    current = body.from_date
    while current <= body.to_date:
        weekday = current.weekday()
        if body.skip_weekends and weekday >= 5:
            current += _dt.timedelta(days=1)
            continue

        for emp in employees:
            existing_res = await db.execute(
                _sel(AttendanceRecord).where(
                    AttendanceRecord.employee_id == emp.id,
                    AttendanceRecord.date == current,
                )
            )
            existing_rec = existing_res.scalar_one_or_none()

            if existing_rec:
                if body.skip_existing:
                    skipped += 1
                    continue
                await db.delete(existing_rec)

            rec = AttendanceRecord(
                id=_uuid.uuid4(),
                employee_id=emp.id,
                date=current,
                status=body.status,
                notes=body.notes,
                marked_by=vu.id,
                approval_status="pending",
            )
            db.add(rec)
            created += 1

        current += _dt.timedelta(days=1)

    await db.commit()
    return {
        "created": created,
        "skipped": skipped,
        "employees": len(employees),
        "days_in_range": max_days,
        "message": f"Marked {created} records for {len(employees)} employee(s) · {skipped} skipped",
    }


@router.put("/attendance/{record_id}")
async def update_attendance(
    record_id: UUID,
    body: UpdateAttendance,
    vu: VendorUser = Depends(require_permission("hr.attendance")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.hr import AttendanceRecord
    import datetime as dt

    stmt = select(AttendanceRecord).where(
        AttendanceRecord.id == record_id
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        from fastapi import HTTPException
        raise HTTPException(404, "Attendance record not found")

    update_data = body.model_dump(exclude_none=True)

    # Parse datetime strings for clock_in / clock_out
    for field in ("clock_in", "clock_out"):
        if field in update_data and isinstance(update_data[field], str):
            update_data[field] = dt.datetime.fromisoformat(update_data[field])

    # Handle approval
    if "approval_status" in update_data:
        if update_data["approval_status"] == "approved":
            update_data["approved_by"] = vu.id
            update_data["approved_at"] = dt.datetime.utcnow()
        elif update_data["approval_status"] == "rejected":
            update_data["approved_by"] = vu.id
            update_data["approved_at"] = dt.datetime.utcnow()

    for k, v in update_data.items():
        setattr(record, k, v)

    await db.commit()
    await db.refresh(record)
    return _d(record)


@router.get("/attendance/report")
async def attendance_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    vu: VendorUser = Depends(require_permission("hr.attendance")),
    db: AsyncSession = Depends(get_db),
):
    from calendar import monthrange
    import datetime as dt
    _, days_in_month = monthrange(year, month)
    from_date = dt.date(year, month, 1)
    to_date = dt.date(year, month, days_in_month)
    svc = HRService(db)
    result = await svc.list_attendance(vu.vendor_id, from_date=from_date, to_date=to_date, skip=0, limit=5000)
    records = result["items"]

    # Aggregate per employee
    by_emp: dict[str, dict] = {}
    for r in records:
        eid = str(r.employee_id)
        if eid not in by_emp:
            emp = r.employee
            by_emp[eid] = {
                "employee_id": eid,
                "employee_code": emp.employee_code if emp else "",
                "present": 0, "absent": 0, "late": 0, "half_day": 0,
                "on_leave": 0, "holiday": 0, "week_off": 0,
                "overtime_hours": 0.0, "total_work_hours": 0.0,
            }
        s = r.status or "present"
        if s in by_emp[eid]:
            by_emp[eid][s] += 1
        by_emp[eid]["overtime_hours"] += float(r.overtime_hours or 0)
        by_emp[eid]["total_work_hours"] += float(r.work_hours or 0)
    return {"month": month, "year": year, "summary": list(by_emp.values())}


# ═══════════════════════════════════════════════════════════════════
# Leaves
# ═══════════════════════════════════════════════════════════════════

@router.get("/leaves/policies")
async def list_leave_policies(
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    return [_d(p) for p in await svc.leave_repo.list_policies(vu.vendor_id)]


@router.post("/leaves/policies", status_code=201)
async def create_leave_policy(
    body: LeavePolicyIn,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    p = await svc.leave_repo.create_policy(vu.vendor_id, body.model_dump())
    await db.commit()
    return _d(p)


@router.put("/leaves/policies/{policy_id}")
async def update_leave_policy(
    policy_id: UUID,
    body: LeavePolicyUpdate,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    p = await svc.leave_repo.get_policy(policy_id, vu.vendor_id)
    if not p:
        raise HTTPException(status_code=404, detail="Leave policy not found")
    p = await svc.leave_repo.update_policy(p, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(p)


@router.get("/leaves/balances")
async def get_leave_balances(
    employee_id: UUID,
    year: int = Query(default=None),
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    yr = year or date.today().year
    balances = await svc.leave_repo.list_balances(employee_id, yr)
    result = []
    for b in balances:
        bd = _d(b)
        bd["available"] = float(b.allocated) + float(b.carried_forward) - float(b.used)
        result.append(bd)
    return result


@router.post("/leaves/request", status_code=201)
async def submit_leave_request(
    body: LeaveRequestIn,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found.")
    req = await svc.submit_leave_request(emp.id, vu.vendor_id, body.model_dump())
    await db.commit()
    return _d(req)


@router.get("/leaves/requests")
async def list_leave_requests(
    employee_id: Optional[UUID] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    requests, total = await svc.leave_repo.list_requests(
        vu.vendor_id, employee_id=employee_id, status=status,
        from_date=from_date, to_date=to_date, skip=skip, limit=limit,
    )
    return {"items": [_d(r) for r in requests], "total": total}


@router.put("/leaves/requests/{req_id}/approve")
async def approve_leave(
    req_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.leave_approve")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    req = await svc.approve_leave(req_id, vu.vendor_id, vu.id)
    await db.commit()
    return _d(req)


@router.put("/leaves/requests/{req_id}/reject")
async def reject_leave(
    req_id: UUID,
    body: LeaveApproval,
    vu: VendorUser = Depends(require_permission("hr.leave_approve")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    req = await svc.reject_leave(req_id, vu.vendor_id, body.rejection_reason or "", vu.id)
    await db.commit()
    return _d(req)


@router.put("/leaves/requests/{req_id}/cancel")
async def cancel_leave(
    req_id: UUID,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found.")
    req = await svc.cancel_leave(req_id, emp.id)
    await db.commit()
    return _d(req)


@router.get("/leaves/my")
async def my_leaves(
    year: Optional[int] = None,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        return {"employee": None, "requests": [], "balances": []}
    yr = year or date.today().year
    requests, _ = await svc.leave_repo.list_requests(vu.vendor_id, employee_id=emp.id, skip=0, limit=200)
    balances = await svc.leave_repo.list_balances(emp.id, yr)
    bal_data = []
    for b in balances:
        bd = _d(b)
        bd["available"] = float(b.allocated) + float(b.carried_forward) - float(b.used)
        bal_data.append(bd)
    return {"requests": [_d(r) for r in requests], "balances": bal_data}


@router.get("/leaves/holidays")
async def list_holidays(
    year: int = Query(default=None),
    vu: VendorUser = Depends(require_permission("hr.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    yr = year or date.today().year
    return [_d(h) for h in await svc.leave_repo.list_holidays(vu.vendor_id, yr)]


@router.post("/leaves/holidays", status_code=201)
async def create_holiday(
    body: HolidayIn,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    h = await svc.leave_repo.create_holiday(vu.vendor_id, body.model_dump())
    await db.commit()
    return _d(h)


@router.delete("/leaves/holidays/{holiday_id}", status_code=204)
async def delete_holiday(
    holiday_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    h = await svc.leave_repo.get_holiday(holiday_id, vu.vendor_id)
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found")
    await db.delete(h)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# Salary
# ═══════════════════════════════════════════════════════════════════

@router.get("/salary/structures")
async def list_salary_structures(
    employee_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("hr.salary_view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    return [_d(s) for s in await svc.salary_repo.list(vu.vendor_id, employee_id=employee_id)]


@router.post("/salary/structures", status_code=201)
async def create_salary_structure(
    body: SalaryStructureIn,
    vu: VendorUser = Depends(require_permission("hr.salary_manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    s = await svc.create_salary_structure(vu.vendor_id, body.model_dump())
    await db.commit()
    return _d(s)


@router.get("/salary/structures/{struct_id}")
async def get_salary_structure(
    struct_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.salary_view")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    s = await svc.salary_repo.get(struct_id, vu.vendor_id)
    if not s:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    return _d(s)


# ═══════════════════════════════════════════════════════════════════
# Payroll
# ═══════════════════════════════════════════════════════════════════

@router.get("/payroll")
async def list_payroll_runs(
    year: Optional[int] = None,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    return [_d(r) for r in await svc.payroll_repo.list_runs(vu.vendor_id, year=year)]


@router.post("/payroll/process", status_code=201)
async def process_payroll(
    body: PayrollProcessIn,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    run = await svc.process_payroll(vu.vendor_id, body.month, body.year, vu.id)
    await db.commit()
    return _d(run)


@router.get("/payroll/{run_id}")
async def get_payroll_run(
    run_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    run = await svc.payroll_repo.get_run(run_id, vu.vendor_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    return _d(run)


@router.put("/payroll/{run_id}/finalize")
async def finalize_payroll(
    run_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    run = await svc.payroll_repo.get_run(run_id, vu.vendor_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    run.status = "processed"
    await db.commit()
    # Finance GL: post payroll expense
    try:
        from app.services.finance.posting import post_event
        await post_event(db, vu.vendor_id, "payroll", run_id, {
            "gross_total": float(run.total_gross or 0),
            "net_total": float(run.total_net or 0),
            "tds_total": 0,
            "entry_date": run.pay_date if hasattr(run, "pay_date") else None,
            "narration": f"Payroll Run {run.period_label if hasattr(run, 'period_label') else str(run_id)[:8]}",
        })
        await db.commit()
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Finance GL: failed to post payroll run %s", run_id)
    return _d(run)


@router.put("/payroll/{run_id}/mark-paid")
async def mark_payroll_paid(
    run_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    run = await svc.payroll_repo.get_run(run_id, vu.vendor_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    run.status = "paid"
    for entry in run.entries:
        entry.status = "paid"
    await db.commit()
    return _d(run)


@router.delete("/payroll/{run_id}", status_code=204)
async def delete_payroll_run(
    run_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    deleted = await svc.payroll_repo.delete_run(run_id, vu.vendor_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    await db.commit()


@router.get("/payroll/{run_id}/export-csv")
async def export_payroll_csv(
    run_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    """Download payroll run as CSV."""
    import csv, io
    from fastapi.responses import StreamingResponse
    from sqlalchemy import select as _sel
    from sqlalchemy.orm import selectinload as _sil
    from app.models.hr import PayrollRun as _PR, PayrollEntry as _PE, EmployeeProfile as _EP
    from app.models.vendor_user import VendorUser as _VU
    from app.models.user import User as _U

    result = await db.execute(
        _sel(_PR)
        .options(
            _sil(_PR.entries).options(
                _sil(_PE.employee).options(
                    _sil(_EP.vendor_user).options(
                        _sil(_VU.user)
                    )
                )
            )
        )
        .where(_PR.id == run_id, _PR.vendor_id == vu.vendor_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    period = f"{run.year}-{str(run.month).zfill(2)}"
    filename = f"payroll_{period}_v{getattr(run, 'version', 1)}.csv"

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Employee Code", "Employee Name", "Days Worked", "Days Absent", "Leave Days",
        "Overtime Hrs", "Gross (INR)", "Deductions (INR)", "Net (INR)", "Status"
    ])

    for entry in run.entries:
        emp = entry.employee
        emp_code = emp.employee_code if emp else ""
        name = ""
        try:
            if emp and emp.vendor_user and emp.vendor_user.user:
                name = emp.vendor_user.user.full_name or ""
        except Exception:
            pass
        writer.writerow([
            emp_code, name,
            float(entry.days_worked or 0),
            float(entry.days_absent or 0),
            float(entry.leave_days or 0),
            float(entry.overtime_hours or 0),
            float(entry.gross_amount or 0),
            float(entry.total_deductions or 0),
            float(entry.net_amount or 0),
            entry.status,
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/payroll/{run_id}/entries/{entry_id}")
async def get_payslip(
    run_id: UUID,
    entry_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    entry = await svc.payroll_repo.get_entry(entry_id)
    if not entry or str(entry.payroll_run_id) != str(run_id):
        raise HTTPException(status_code=404, detail="Payslip not found")
    return _d(entry)


@router.get("/payroll/{run_id}/entries/{entry_id}/payslip-html", response_class=HTMLResponse)
async def get_payslip_html(
    run_id: UUID,
    entry_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.payroll")),
    db: AsyncSession = Depends(get_db),
):
    """Returns an HTML payslip ready for print/PDF."""
    svc = HRService(db)
    entry = await svc.payroll_repo.get_entry(entry_id)
    if not entry or str(entry.payroll_run_id) != str(run_id):
        raise HTTPException(status_code=404, detail="Payslip not found")
    run = entry.payroll_run
    emp = entry.employee
    emp_vu = emp.vendor_user if emp else None
    emp_user = emp_vu.user if emp_vu else None
    emp_name = emp_user.full_name if emp_user else (emp.employee_code if emp else "Employee")
    month_name = datetime(run.year, run.month, 1).strftime("%B %Y")
    earnings_rows = "".join(
        f"<tr><td>{k.replace('_', ' ').title()}</td><td>₹{float(v):,.2f}</td></tr>"
        for k, v in (entry.earnings or {}).items()
    )
    ded_rows = "".join(
        f"<tr><td>{k.replace('_', ' ').title()}</td><td>₹{float(v):,.2f}</td></tr>"
        for k, v in (entry.deductions or {}).items()
    )
    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body {{ font-family: Arial, sans-serif; margin: 30px; color: #333; }}
  h1 {{ color: #1a73e8; }} h2 {{ color: #555; font-size:14px; }}
  table {{ width:100%; border-collapse:collapse; margin:10px 0; }}
  th {{ background:#1a73e8; color:#fff; padding:8px; text-align:left; }}
  td {{ padding:6px 8px; border-bottom:1px solid #eee; }}
  .totals {{ font-weight:bold; background:#f5f5f5; }}
  .net {{ color:#1a73e8; font-size:18px; font-weight:bold; }}
</style>
</head>
<body>
  <h1>Pay Slip — {month_name}</h1>
  <h2>Employee: {emp_name} ({emp.employee_code if emp else ""})</h2>
  <p>Days Worked: {float(entry.days_worked):.0f} | Absent: {float(entry.days_absent):.0f} | Leave: {float(entry.leave_days):.0f} | OT Hours: {float(entry.overtime_hours):.1f}</p>
  <table>
    <tr><th>Earnings</th><th>Amount</th></tr>
    {earnings_rows}
    <tr class="totals"><td>Gross Pay</td><td>₹{float(entry.gross_amount):,.2f}</td></tr>
  </table>
  <table>
    <tr><th>Deductions</th><th>Amount</th></tr>
    {ded_rows}
    <tr class="totals"><td>Total Deductions</td><td>₹{float(entry.total_deductions):,.2f}</td></tr>
  </table>
  <p class="net">Net Pay: ₹{float(entry.net_amount):,.2f}</p>
</body></html>"""
    return HTMLResponse(content=html)


@router.get("/payroll/my-payslips")
async def my_payslips(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        return []
    entries = await svc.payroll_repo.list_employee_payslips(emp.id)
    return [_d(e) for e in entries]


# ═══════════════════════════════════════════════════════════════════
# Offer Letters
# ═══════════════════════════════════════════════════════════════════

@router.get("/offers")
async def list_offers(
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    return [_d(o) for o in await svc.list_offers(vu.vendor_id)]


@router.post("/offers", status_code=201)
async def create_offer(
    body: OfferLetterIn,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload as _sil
    from app.models.hr import OfferLetter as _OL
    from app.repositories.vendor_repo import VendorRepository

    svc = HRService(db)
    payload = body.model_dump(exclude_none=True)
    template_id = payload.pop("template_id", None)
    store_id    = payload.pop("store_id", None)

    offer = await svc.create_offer(vu.vendor_id, payload)
    await db.commit()

    # Reload with eager-loaded relationships to avoid greenlet/lazy-load error
    result = await db.execute(
        select(_OL)
        .options(_sil(_OL.designation), _sil(_OL.department))
        .where(_OL.id == offer.id)
    )
    offer = result.scalar_one()

    # Resolve vendor name for template rendering
    vendor = await VendorRepository(db).get_by_id(vu.vendor_id)
    vendor_name = vendor.business_name if vendor else "Company"

    # Determine store name for merge fields
    store_name = ""
    if store_id:
        from app.models.store import Store as _Store
        store_res = await db.execute(select(_Store).where(_Store.id == store_id))
        store_obj = store_res.scalar_one_or_none()
        store_name = store_obj.name if store_obj else ""

    if not offer.template_content:
        tpl = None
        if template_id:
            tpl = await svc.tpl_repo.get(template_id, vu.vendor_id)
        if not tpl:
            tpl = await svc.find_best_offer_template(
                vu.vendor_id,
                designation_id=offer.designation_id,
                department_id=offer.department_id,
                store_id=store_id,
            )
        if tpl:
            offer.template_content = svc.render_template(tpl.body_html, offer, vendor_name, store_name)
        else:
            offer.template_content = svc.generate_offer_html(offer, vendor_name)
        await db.commit()
        await db.refresh(offer)

    return _d(offer)


@router.put("/offers/{offer_id}")
async def update_offer(
    offer_id: UUID,
    body: OfferLetterUpdate,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    offer = await svc.update_offer(offer_id, vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    return _d(offer)


@router.post("/offers/{offer_id}/send")
async def send_offer(
    offer_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    offer = await svc.send_offer(offer_id, vu.vendor_id)
    await db.commit()
    return _d(offer)


@router.get("/offers/{offer_id}/pdf", response_class=HTMLResponse)
async def get_offer_pdf(
    offer_id: UUID,
    regenerate: bool = Query(False, description="Force regenerate the HTML from the stored template or default layout"),
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload as _sil
    from app.models.hr import OfferLetter as _OL
    from app.repositories.vendor_repo import VendorRepository

    svc = HRService(db)
    vendor = await VendorRepository(db).get_by_id(vu.vendor_id)
    vendor_name = vendor.business_name if vendor else "Company"

    # Always reload with eager-loaded relationships so designation/department names are available
    result = await db.execute(
        select(_OL)
        .options(_sil(_OL.designation), _sil(_OL.department))
        .where(_OL.id == offer_id, _OL.vendor_id == vu.vendor_id)
    )
    offer = result.scalar_one_or_none()
    if not offer:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Offer letter not found")

    # If content exists and not forced regenerate, return stored content
    if offer.template_content and not regenerate:
        # Check if it looks like old/bad HTML (no DOCTYPE or no <table) — regenerate automatically
        content = offer.template_content
        if "<!DOCTYPE" not in content and "<table" not in content:
            regenerate = True

    if not offer.template_content or regenerate:
        html = svc.generate_offer_html(offer, vendor_name)
        # Persist the fresh HTML
        offer.template_content = html
        await db.commit()
        return HTMLResponse(content=html, media_type="text/html; charset=utf-8")

    return HTMLResponse(content=offer.template_content, media_type="text/html; charset=utf-8")


@router.delete("/offers/{offer_id}", status_code=204)
async def delete_offer(
    offer_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    await svc.delete_offer(offer_id, vu.vendor_id)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# Offer Letter Templates
# ═══════════════════════════════════════════════════════════════════

@router.get("/offer-templates")
async def list_offer_templates(
    designation_id: Optional[UUID] = Query(None),
    department_id:  Optional[UUID] = Query(None),
    store_id:        Optional[UUID] = Query(None),
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    templates = await svc.list_offer_templates(
        vu.vendor_id,
        designation_id=designation_id,
        department_id=department_id,
        store_id=store_id,
    )
    return [_d(t) for t in templates]


@router.post("/offer-templates", status_code=201)
async def create_offer_template(
    body: OfferLetterTemplateIn,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    tpl = await svc.create_offer_template(vu.vendor_id, body.model_dump(exclude_none=True))
    await db.commit()
    await db.refresh(tpl)
    return _d(tpl)


@router.get("/offer-templates/{template_id}")
async def get_offer_template(
    template_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    return _d(await svc.get_offer_template(template_id, vu.vendor_id))


@router.put("/offer-templates/{template_id}")
async def update_offer_template(
    template_id: UUID,
    body: OfferLetterTemplateUpdate,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    tpl = await svc.update_offer_template(
        template_id, vu.vendor_id,
        body.model_dump(exclude_unset=True),
    )
    await db.commit()
    await db.refresh(tpl)
    return _d(tpl)


@router.delete("/offer-templates/{template_id}", status_code=204)
async def delete_offer_template(
    template_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    await svc.delete_offer_template(template_id, vu.vendor_id)
    await db.commit()


@router.post("/offer-templates/{template_id}/default")
async def set_default_offer_template(
    template_id: UUID,
    vu: VendorUser = Depends(require_permission("hr.offers")),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    tpl = await svc.set_default_offer_template(template_id, vu.vendor_id)
    await db.commit()
    await db.refresh(tpl)
    return _d(tpl)


# ═══════════════════════════════════════════════════════════════════
# Dev-only: Seed test HR data for the current vendor
# ═══════════════════════════════════════════════════════════════════

@router.post("/seed-test-data")
async def seed_hr_test_data(
    days: int = Query(30, ge=1, le=90),
    vu: VendorUser = Depends(require_permission("hr.manage")),
    db: AsyncSession = Depends(get_db),
):
    """
    Seed realistic HR test data (departments, designations, employees,
    attendance records) into the current vendor. Idempotent — safe to call
    multiple times; existing records are skipped.
    """
    import datetime as dt
    import random
    import uuid as _uuid
    from decimal import Decimal
    from passlib.context import CryptContext
    from sqlalchemy import select as _select, func as _func
    from app.models.user import User
    from app.models.vendor_user import VendorUser as VU
    from app.models.hr import (
        Department as Dept, Designation as Desig,
        EmployeeProfile as EmpProf, AttendanceRecord as AttRec,
    )

    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    vendor_id = vu.vendor_id

    SEED_DEPARTMENTS = [
        {"name": "Engineering",     "code": "ENG"},
        {"name": "Sales",           "code": "SLS"},
        {"name": "Human Resources", "code": "HR"},
        {"name": "Finance",         "code": "FIN"},
        {"name": "Operations",      "code": "OPS"},
    ]
    SEED_DESIGNATIONS = [
        {"name": "Junior Engineer",        "level": 1},
        {"name": "Senior Engineer",        "level": 3},
        {"name": "Team Lead",              "level": 4},
        {"name": "Sales Executive",        "level": 1},
        {"name": "Sales Manager",          "level": 3},
        {"name": "HR Executive",           "level": 2},
        {"name": "HR Manager",             "level": 3},
        {"name": "Accountant",             "level": 2},
        {"name": "Finance Manager",        "level": 3},
        {"name": "Operations Executive",   "level": 2},
    ]
    SEED_EMPLOYEES = [
        {"name": "Aakash Sharma",  "email": "aakash.seed@test.local",  "phone": "+919800000001", "dept": "Engineering",     "desig": "Senior Engineer",        "gender": "male",   "doj": "2022-06-01"},
        {"name": "Priya Nair",     "email": "priya.seed@test.local",   "phone": "+919800000002", "dept": "Engineering",     "desig": "Junior Engineer",        "gender": "female", "doj": "2023-02-15"},
        {"name": "Rohit Verma",    "email": "rohit.seed@test.local",   "phone": "+919800000003", "dept": "Engineering",     "desig": "Team Lead",              "gender": "male",   "doj": "2021-09-10"},
        {"name": "Sunita Menon",   "email": "sunita.seed@test.local",  "phone": "+919800000004", "dept": "Sales",           "desig": "Sales Manager",          "gender": "female", "doj": "2022-01-20"},
        {"name": "Karan Mehta",    "email": "karan.seed@test.local",   "phone": "+919800000005", "dept": "Sales",           "desig": "Sales Executive",        "gender": "male",   "doj": "2023-07-01"},
        {"name": "Deepa Iyer",     "email": "deepa.seed@test.local",   "phone": "+919800000006", "dept": "Human Resources", "desig": "HR Manager",             "gender": "female", "doj": "2021-04-01"},
        {"name": "Manish Gupta",   "email": "manish.seed@test.local",  "phone": "+919800000007", "dept": "Human Resources", "desig": "HR Executive",           "gender": "male",   "doj": "2022-11-05"},
        {"name": "Lakshmi Reddy",  "email": "lakshmi.seed@test.local", "phone": "+919800000008", "dept": "Finance",         "desig": "Finance Manager",        "gender": "female", "doj": "2020-08-15"},
        {"name": "Vivek Rao",      "email": "vivek.seed@test.local",   "phone": "+919800000009", "dept": "Finance",         "desig": "Accountant",             "gender": "male",   "doj": "2023-01-10"},
        {"name": "Anjali Singh",   "email": "anjali.seed@test.local",  "phone": "+919800000010", "dept": "Operations",      "desig": "Operations Executive",   "gender": "female", "doj": "2022-05-20"},
    ]

    WEEKDAY_STATUSES = ["present", "present", "present", "present", "present",
                        "late", "late", "absent", "half_day", "on_leave"]
    APPROVAL_POOL = ["approved", "approved", "approved", "pending", "pending", "rejected"]

    created_depts = 0
    created_desigs = 0
    created_emps = 0
    created_att = 0

    # ── 1. Departments ──────────────────────────────────────────────
    dept_map: dict[str, _uuid.UUID] = {}
    for d in SEED_DEPARTMENTS:
        r = await db.execute(_select(Dept).where(Dept.vendor_id == vendor_id, Dept.name == d["name"]))
        dept = r.scalar_one_or_none()
        if not dept:
            dept = Dept(id=_uuid.uuid4(), vendor_id=vendor_id, name=d["name"], code=d["code"])
            db.add(dept)
            created_depts += 1
        await db.flush()
        dept_map[d["name"]] = dept.id

    # ── 2. Designations ─────────────────────────────────────────────
    desig_map: dict[str, _uuid.UUID] = {}
    for d in SEED_DESIGNATIONS:
        r = await db.execute(_select(Desig).where(Desig.vendor_id == vendor_id, Desig.name == d["name"]))
        desig = r.scalar_one_or_none()
        if not desig:
            desig = Desig(id=_uuid.uuid4(), vendor_id=vendor_id, name=d["name"], level=d["level"])
            db.add(desig)
            created_desigs += 1
        await db.flush()
        desig_map[d["name"]] = desig.id

    # ── 3. Employees ────────────────────────────────────────────────
    emp_profiles: list[EmpProf] = []
    for idx, e in enumerate(SEED_EMPLOYEES, start=1):
        # User
        r = await db.execute(_select(User).where(User.email == e["email"]))
        user = r.scalar_one_or_none()
        if not user:
            user = User(
                id=_uuid.uuid4(),
                email=e["email"],
                phone=e["phone"],
                full_name=e["name"],
                password_hash=pwd_ctx.hash("Seed@1234"),
                is_email_verified=True,
                is_active=True,
            )
            db.add(user)
            await db.flush()

        # VendorUser
        r2 = await db.execute(_select(VU).where(VU.vendor_id == vendor_id, VU.user_id == user.id))
        vendor_user = r2.scalar_one_or_none()
        if not vendor_user:
            vendor_user = VU(
                id=_uuid.uuid4(),
                vendor_id=vendor_id,
                user_id=user.id,
                role="staff",
                is_active=True,
                invited_by=vu.user_id,
                accepted_at=dt.datetime.utcnow(),
            )
            db.add(vendor_user)
            await db.flush()

        # EmployeeProfile
        r3 = await db.execute(_select(EmpProf).where(EmpProf.vendor_user_id == vendor_user.id))
        emp = r3.scalar_one_or_none()
        if not emp:
            # count for employee code
            cnt = await db.execute(
                _select(_func.count()).select_from(EmpProf).where(EmpProf.vendor_id == vendor_id)
            )
            code_num = (cnt.scalar_one() or 0) + 1
            emp = EmpProf(
                id=_uuid.uuid4(),
                vendor_id=vendor_id,
                vendor_user_id=vendor_user.id,
                employee_code=f"EMP-{code_num:03d}",
                gender=e["gender"],
                department_id=dept_map.get(e["dept"]),
                designation_id=desig_map.get(e["desig"]),
                employment_type="full_time",
                date_of_joining=dt.date.fromisoformat(e["doj"]),
                status="active",
                nationality="Indian",
            )
            db.add(emp)
            await db.flush()
            created_emps += 1

        emp_profiles.append(emp)

    # ── 4. Attendance ────────────────────────────────────────────────
    today = dt.date.today()
    for emp in emp_profiles:
        for delta in range(days, -1, -1):
            att_date = today - dt.timedelta(days=delta)
            weekday = att_date.weekday()

            if weekday == 6:
                status = "week_off"
            elif weekday == 5 and random.random() < 0.5:
                status = "week_off"
            else:
                status = random.choice(WEEKDAY_STATUSES)

            approval = random.choice(APPROVAL_POOL)
            if status in ("week_off", "holiday"):
                approval = "approved"

            rejection_reason = None
            if approval == "rejected":
                rejection_reason = random.choice([
                    "Insufficient documentation",
                    "Unapproved absence",
                    "No prior notice given",
                ])

            # clock times
            clock_in = clock_out = work_hours = None
            overtime_hours = Decimal("0")
            if status not in ("absent", "on_leave", "holiday", "week_off"):
                in_h = 9 if status != "late" else random.randint(10, 11)
                in_m = random.randint(0, 59)
                out_h = 13 if status == "half_day" else 18
                out_m = random.randint(0, 59)
                clock_in  = dt.datetime(att_date.year, att_date.month, att_date.day, in_h, in_m,
                                        tzinfo=dt.timezone.utc)
                clock_out = dt.datetime(att_date.year, att_date.month, att_date.day, out_h, out_m,
                                        tzinfo=dt.timezone.utc)
                diff = (clock_out - clock_in).seconds / 3600
                work_hours = Decimal(str(round(diff, 2)))
                if status == "present" and random.random() < 0.15:
                    ot = random.choice([0.5, 1.0, 1.5])
                    overtime_hours = Decimal(str(ot))

            # skip if already exists
            existing = await db.execute(
                _select(AttRec).where(AttRec.employee_id == emp.id, AttRec.date == att_date)
            )
            if existing.scalar_one_or_none():
                continue

            rec = AttRec(
                id=_uuid.uuid4(),
                employee_id=emp.id,
                date=att_date,
                status=status,
                clock_in=clock_in,
                clock_out=clock_out,
                work_hours=work_hours,
                overtime_hours=overtime_hours,
                marked_by=vu.id,
                approval_status=approval,
                approved_by=vu.id if approval in ("approved", "rejected") else None,
                approved_at=dt.datetime.utcnow() if approval in ("approved", "rejected") else None,
                rejection_reason=rejection_reason,
            )
            db.add(rec)
            created_att += 1

    # ── 5. Extended HR modules: Recruitment / Onboarding / Performance /
    #      Compliance / Training / ESS — all idempotent.
    from app.models.hr_recruit import (
        JobPosting as JP, Candidate as Cand, JobApplication as JA,
        OnboardingTemplate as OT, OnboardingTemplateItem as OTI,
    )
    from app.models.hr_performance import ReviewCycle as RC
    from app.models.hr_compliance import Policy as Pol
    from app.models.hr_training import TrainingProgram as TP, TrainingCourse as TC, QuizQuestion as QQ
    from app.models.hr_ess import Announcement as Anc

    created_jobs = created_cands = created_apps = 0
    created_onb = created_cycles = created_policies = 0
    created_programs = created_announcements = 0

    # ----- Recruitment: 2 jobs -----
    SEED_JOBS = [
        {
            "title": "Senior Engineer",
            "dept": "Engineering",
            "desig": "Senior Engineer",
            "openings": 2,
            "salary_min": Decimal("800000"),
            "salary_max": Decimal("1500000"),
            "description": "Build and scale our backend platform.",
            "requirements": "5+ years Python/FastAPI experience.",
            "status": "open",
        },
        {
            "title": "Sales Executive",
            "dept": "Sales",
            "desig": "Sales Executive",
            "openings": 3,
            "salary_min": Decimal("300000"),
            "salary_max": Decimal("600000"),
            "description": "Drive new business across SMB accounts.",
            "requirements": "1+ years inside-sales experience.",
            "status": "open",
        },
    ]
    job_objs: list = []
    for j in SEED_JOBS:
        r = await db.execute(_select(JP).where(JP.vendor_id == vendor_id, JP.title == j["title"]))
        jp = r.scalar_one_or_none()
        if not jp:
            jp = JP(
                id=_uuid.uuid4(), vendor_id=vendor_id,
                title=j["title"],
                department_id=dept_map.get(j["dept"]),
                designation_id=desig_map.get(j["desig"]),
                openings=j["openings"],
                salary_min=j["salary_min"], salary_max=j["salary_max"],
                description=j["description"], requirements=j["requirements"],
                status=j["status"],
                posted_at=dt.datetime.utcnow(),
                posted_by=vu.id,
            )
            db.add(jp)
            await db.flush()
            created_jobs += 1
        job_objs.append(jp)

    # ----- Recruitment: 3 candidates + applications -----
    SEED_CANDIDATES = [
        {"full_name": "Akhil Joshi",   "email": "akhil.cand@test.local",   "phone": "+919900000001", "current_company": "Acme Tech",  "current_ctc": Decimal("900000"),  "expected_ctc": Decimal("1200000"), "source": "linkedin",  "stage": "screening"},
        {"full_name": "Rina Pillai",   "email": "rina.cand@test.local",    "phone": "+919900000002", "current_company": "Globex",     "current_ctc": Decimal("700000"),  "expected_ctc": Decimal("1100000"), "source": "referral",  "stage": "interviewing"},
        {"full_name": "Suresh Kumar",  "email": "suresh.cand@test.local",  "phone": "+919900000003", "current_company": "Initech",    "current_ctc": Decimal("400000"),  "expected_ctc": Decimal("550000"),  "source": "portal",    "stage": "applied"},
    ]
    for idx, c in enumerate(SEED_CANDIDATES):
        r = await db.execute(_select(Cand).where(Cand.vendor_id == vendor_id, Cand.email == c["email"]))
        cand = r.scalar_one_or_none()
        if not cand:
            cand = Cand(
                id=_uuid.uuid4(), vendor_id=vendor_id,
                full_name=c["full_name"], email=c["email"], phone=c["phone"],
                current_company=c["current_company"],
                current_ctc=c["current_ctc"], expected_ctc=c["expected_ctc"],
                source=c["source"],
            )
            db.add(cand)
            await db.flush()
            created_cands += 1
        # link to first or second job
        target_job = job_objs[idx % len(job_objs)] if job_objs else None
        if target_job:
            ex = await db.execute(_select(JA).where(
                JA.candidate_id == cand.id, JA.job_posting_id == target_job.id,
            ))
            if not ex.scalar_one_or_none():
                db.add(JA(
                    id=_uuid.uuid4(), vendor_id=vendor_id,
                    candidate_id=cand.id, job_posting_id=target_job.id,
                    current_stage=c["stage"], rating=random.choice([3, 4, 5]),
                    owner_user_id=vu.id,
                ))
                created_apps += 1

    # ----- Onboarding: 1 template w/ 5 tasks -----
    r = await db.execute(_select(OT).where(OT.vendor_id == vendor_id, OT.name == "New Hire Onboarding"))
    onb_tpl = r.scalar_one_or_none()
    if not onb_tpl:
        onb_tpl = OT(
            id=_uuid.uuid4(), vendor_id=vendor_id,
            name="New Hire Onboarding",
            description="Standard 30-day onboarding flow for new hires.",
            is_default=True,
        )
        db.add(onb_tpl)
        await db.flush()
        items = [
            ("Sign offer letter & NDA",     "policy",    1,  "hr"),
            ("Submit ID & address proofs",  "documents", 2,  "hr"),
            ("Provision laptop & accounts", "it_setup",  3,  "it"),
            ("Org-wide intro session",      "intro",     5,  "hr"),
            ("Complete role-based training","training",  14, "manager"),
        ]
        for seq, (title, cat, due_off, role) in enumerate(items, start=1):
            db.add(OTI(
                id=_uuid.uuid4(), template_id=onb_tpl.id,
                sequence=seq, title=title, category=cat,
                default_due_offset_days=due_off, default_assignee_role=role,
            ))
        created_onb = 1

    # ----- Performance: 1 review cycle -----
    cycle_name = f"Annual Review {dt.date.today().year}"
    r = await db.execute(_select(RC).where(RC.vendor_id == vendor_id, RC.name == cycle_name))
    cycle = r.scalar_one_or_none()
    if not cycle:
        today_d = dt.date.today()
        cycle = RC(
            id=_uuid.uuid4(), vendor_id=vendor_id,
            name=cycle_name,
            description="Yearly performance appraisal cycle.",
            period_start=dt.date(today_d.year, 1, 1),
            period_end=dt.date(today_d.year, 12, 31),
            review_type="annual",
            rating_scale_max=5,
            self_review_required=True,
            manager_review_required=True,
            enable_kpi_scoring=True,
            kpi_template=[
                {"key": "delivery", "label": "Delivery & Execution", "weight": 30},
                {"key": "quality",  "label": "Quality of Work",       "weight": 25},
                {"key": "collab",   "label": "Collaboration",         "weight": 20},
                {"key": "growth",   "label": "Learning & Growth",     "weight": 15},
                {"key": "values",   "label": "Company Values",        "weight": 10},
            ],
            status="draft",
        )
        db.add(cycle)
        created_cycles = 1

    # ----- Compliance: 2 policies -----
    SEED_POLICIES = [
        {
            "title": "Code of Conduct",
            "category": "conduct",
            "summary": "Expectations for professional behaviour at the workplace.",
            "body": "<p>All employees are expected to conduct themselves with integrity, respect, and professionalism…</p>",
        },
        {
            "title": "Information Security Policy",
            "category": "it",
            "summary": "Rules for handling company data, devices, and access.",
            "body": "<p>Protect company information at all times. Do not share credentials…</p>",
        },
    ]
    for p in SEED_POLICIES:
        r = await db.execute(_select(Pol).where(Pol.vendor_id == vendor_id, Pol.title == p["title"]))
        if r.scalar_one_or_none():
            continue
        db.add(Pol(
            id=_uuid.uuid4(), vendor_id=vendor_id,
            title=p["title"], category=p["category"],
            summary=p["summary"], body=p["body"],
            version=1, status="published",
            requires_acknowledgement=True,
            audience="all",
            effective_from=dt.date.today(),
            published_at=dt.datetime.utcnow(),
            published_by=vu.id,
        ))
        created_policies += 1

    # ----- Training: 1 program w/ 2 courses + 1 quiz -----
    r = await db.execute(_select(TP).where(TP.vendor_id == vendor_id, TP.name == "Workplace Safety Essentials"))
    program = r.scalar_one_or_none()
    if not program:
        program = TP(
            id=_uuid.uuid4(), vendor_id=vendor_id,
            name="Workplace Safety Essentials",
            description="Mandatory safety induction for all employees.",
            category="compliance",
            is_mandatory=True, target_audience="all",
            estimated_hours=Decimal("2"),
            issues_certificate=True,
            status="published",
        )
        db.add(program)
        await db.flush()

        course1 = TC(
            id=_uuid.uuid4(), program_id=program.id,
            sequence=1, title="Introduction to Workplace Safety",
            content_type="text",
            body_html=(
                "<h2>Workplace Safety</h2>"
                "<p>This module covers fire safety, ergonomics, and emergency exits…</p>"
            ),
            duration_min=30, is_required=True,
        )
        course2 = TC(
            id=_uuid.uuid4(), program_id=program.id,
            sequence=2, title="Safety Quiz",
            content_type="quiz",
            duration_min=15, pass_score_pct=70, is_required=True,
        )
        db.add(course1); db.add(course2)
        await db.flush()

        db.add(QQ(
            id=_uuid.uuid4(), course_id=course2.id,
            sequence=1,
            question="What is the first thing to do in case of a fire alarm?",
            question_type="single",
            options=[
                {"id": "a", "text": "Pack up your belongings", "is_correct": False},
                {"id": "b", "text": "Use the nearest emergency exit calmly", "is_correct": True},
                {"id": "c", "text": "Wait for further instructions",  "is_correct": False},
                {"id": "d", "text": "Take the elevator down", "is_correct": False},
            ],
            explanation="Always evacuate via the nearest stairwell — never use elevators.",
            points=1,
        ))
        created_programs = 1

    # ----- ESS: 1 announcement -----
    ann_title = "Welcome to the new HR portal"
    r = await db.execute(_select(Anc).where(Anc.vendor_id == vendor_id, Anc.title == ann_title))
    if not r.scalar_one_or_none():
        db.add(Anc(
            id=_uuid.uuid4(), vendor_id=vendor_id,
            title=ann_title,
            body=(
                "<p>We are excited to launch our new self-service portal! "
                "Submit expenses, raise tickets, view your reviews, and more.</p>"
            ),
            category="general",
            audience="all",
            status="published",
            publish_at=dt.datetime.utcnow(),
            published_by=vu.id,
            pinned=True,
        ))
        created_announcements = 1

    await db.commit()
    return {
        "status": "ok",
        "created": {
            "departments": created_depts,
            "designations": created_desigs,
            "employees": created_emps,
            "attendance_records": created_att,
            "job_postings": created_jobs,
            "candidates": created_cands,
            "applications": created_apps,
            "onboarding_templates": created_onb,
            "review_cycles": created_cycles,
            "policies": created_policies,
            "training_programs": created_programs,
            "announcements": created_announcements,
        },
        "message": (
            f"Seeded {created_emps} employees with {created_att} attendance records, "
            f"{created_jobs} job postings, {created_cands} candidates, "
            f"{created_policies} policies, {created_programs} training program(s), "
            f"and {created_announcements} announcement(s)."
        ),
    }
