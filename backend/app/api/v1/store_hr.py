"""Business Front employee HR — login + ESS using VendorUser/User credentials (not Customer)."""
from __future__ import annotations

from datetime import date, datetime, timedelta
import uuid as _uuid
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, or_, func as sqlfunc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_store_hr_vendor_id, get_current_store_hr_vendor_user
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.models.hr import EmployeeProfile, PayrollEntry, AttendanceRecord
from app.models.hr_recruit import OnboardingTask, OnboardingChecklist
from app.models.hr_training import TrainingCertificate, TrainingProgram
from app.api.v1.vendor_hr import LeaveRequestIn, ClockInOut
from app.api.v1.vendor_hr_extra import (
    _d,
    _current_employee,
    ExpenseIn,
    TicketIn,
    TicketCommentIn,
    ReviewSelfIn,
    CompletionIn,
)
from app.repositories.hr_repo import LeaveRepo
from app.services.hr_service import HRService
from app.repositories.hr_training_repo import TrainingRepo
from app.repositories.hr_recruit_repo import OnboardingChecklistRepo
from app.repositories.hr_performance_repo import CycleRepo, GoalRepo, ReviewRepo, FeedbackRepo
from app.repositories.hr_ess_repo import (
    AnnouncementRepo,
    ExpenseRepo,
    HelpdeskRepo,
)
from app.repositories.hr_compliance_repo import PolicyRepo, AuditRepo
from app.services.notification_service import NotificationService
from app.models.store import Store

router = APIRouter()


class StoreHrLogin(BaseModel):
    login: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    # Optional: store UUID or company/store code (same as ?branch= on business front) — must match employee"s outlet when they are store-pinned.
    branch: Optional[str] = Field(None, max_length=80)


class TaskUpdateBody(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    attachment_url: Optional[str] = None
    due_date: Optional[date] = None


def _json_breakdown_to_rows(blob: Any) -> List[Dict[str, Any]]:
    if blob is None:
        return []
    if isinstance(blob, list):
        return blob
    if isinstance(blob, dict):
        rows = []
        for k, v in blob.items():
            try:
                amt = float(v) if v is not None else 0.0
            except (TypeError, ValueError):
                amt = 0.0
            rows.append({"component": str(k), "amount": amt})
        return rows
    return []


def _payslip_public(entry: PayrollEntry) -> Dict[str, Any]:
    run = entry.payroll_run
    period_label = month = year = None
    if run:
        month, year = run.month, run.year
        period_label = f"{month}/{year}"
    return {
        "id": str(entry.id),
        "period_label": period_label,
        "month": month,
        "year": year,
        "status": entry.status,
        "gross_pay": float(entry.gross_amount or 0),
        "net_pay": float(entry.net_amount or 0),
        "currency": "INR",
        "earnings": _json_breakdown_to_rows(entry.earnings),
        "deductions": _json_breakdown_to_rows(entry.deductions),
    }


async def _resolve_login_employee_candidates(
    db: AsyncSession, vendor_id: UUID, login_raw: str
) -> List[EmployeeProfile]:
    login_norm = login_raw.strip()
    if not login_norm:
        return []
    stmt = (
        select(EmployeeProfile)
        .join(VendorUser, EmployeeProfile.vendor_user_id == VendorUser.id)
        .join(User, VendorUser.user_id == User.id)
        .where(
            EmployeeProfile.vendor_id == vendor_id,
            VendorUser.is_active == True,
            or_(
                sqlfunc.lower(User.email) == login_norm.lower(),
                sqlfunc.lower(EmployeeProfile.employee_code) == login_norm.lower(),
                sqlfunc.lower(EmployeeProfile.employee_code_custom) == login_norm.lower(),
            ),
        )
        .options(selectinload(EmployeeProfile.vendor_user).selectinload(VendorUser.user))
    )
    r = await db.execute(stmt)
    return list(r.scalars().unique().all())


async def _resolve_store_for_branch(
    db: AsyncSession, vendor_id: UUID, branch_raw: str
) -> Optional[Store]:
    raw = (branch_raw or "").strip()
    if not raw:
        return None
    try:
        uid = UUID(raw)
        r = await db.execute(select(Store).where(Store.vendor_id == vendor_id, Store.id == uid))
        st = r.scalar_one_or_none()
        if st:
            return st
    except (ValueError, TypeError):
        pass
    r2 = await db.execute(
        select(Store).where(
            Store.vendor_id == vendor_id,
            sqlfunc.lower(Store.code) == raw.lower(),
        )
    )
    return r2.scalar_one_or_none()


@router.post("/login")
async def store_hr_login(
    body: StoreHrLogin,
    vendor_id: UUID = Depends(get_store_hr_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    candidates = await _resolve_login_employee_candidates(db, vendor_id, body.login)
    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "No employee profile on this store for that email or employee code. "
                "Use the same vendor as in the URL (e.g. run seed_hr.py --vendor-slug <slug>), "
                "or ask HR to add you as an employee."
            ),
        )

    matching: List[EmployeeProfile] = []
    for emp in candidates:
        u = emp.vendor_user.user if emp.vendor_user else None
        if u and u.password_hash and verify_password(body.password, u.password_hash):
            matching.append(emp)

    if len(matching) == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password for this account.",
        )
    if len(matching) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Multiple employee profiles match this login. Use your employee code or contact HR.",
        )

    emp = matching[0]
    user = emp.vendor_user.user
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is disabled")

    # Detect OTP login before clearing — used to trigger must_change_password in response
    was_otp_login = bool(getattr(user, "portal_temp_password", None))
    if was_otp_login:
        user.portal_temp_password = None
        user.portal_temp_password_expires_at = None
        db.add(user)
        await db.flush()

    vu = emp.vendor_user

    branch_ctx: Optional[Dict[str, Any]] = None
    br = (body.branch or "").strip()
    if br:
        st = await _resolve_store_for_branch(db, vendor_id, br)
        if not st:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown store branch or code: {br}",
            )
        emp_store = emp.store_id
        vu_store = vu.store_id
        pinned = emp_store or vu_store
        if pinned and pinned != st.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "This employee is assigned to a different location. "
                    "Use the branch link from your manager, or open Employee Login without a branch in the URL."
                ),
            )
        branch_ctx = {"id": str(st.id), "code": st.code, "name": st.name}

    token = create_access_token(
        {
            "sub": str(user.id),
            "vendor_id": str(vendor_id),
            "vendor_user_id": str(vu.id),
            "role": "store_hr_employee",
            **({"branch_store_id": branch_ctx["id"]} if branch_ctx else {}),
        }
    )
    out: Dict[str, Any] = {
        "access_token": token,
        "token_type": "bearer",
        "must_change_password": was_otp_login,
        "employee": {
            "id": str(emp.id),
            "employee_code": emp.employee_code,
            "full_name": user.full_name,
            "email": user.email,
        },
    }
    if branch_ctx:
        out["branch"] = branch_ctx
    await db.commit()
    return out


@router.get("/me")
async def store_hr_me(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    u = vu.user
    return {
        "vendor_user_id": str(vu.id),
        "employee_id": str(emp.id) if emp else None,
        "employee_code": emp.employee_code if emp else None,
        "full_name": u.full_name if u else None,
        "email": u.email if u else None,
    }


class HrForgotPasswordRequest(BaseModel):
    login: str = Field(..., min_length=1)


@router.post("/forgot-password")
async def hr_forgot_password(
    body: HrForgotPasswordRequest,
    vendor_id: UUID = Depends(get_store_hr_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Employee forgot password — looks up their account and returns a
    non-sensitive hint so they can contact HR with their login identifier.
    Always returns 200 to avoid user enumeration.
    """
    candidates = await _resolve_login_employee_candidates(db, vendor_id, body.login)
    if not candidates:
        return {"found": False}
    emp = candidates[0]
    user = emp.vendor_user.user if emp.vendor_user else None
    return {
        "found": True,
        "employee_name": emp.full_name or (user.full_name if user else None),
        "login": user.email if user else None,
    }


class HrChangePasswordIn(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


@router.post("/change-password")
async def hr_change_password(
    body: HrChangePasswordIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """Employee self-service password change (including mandatory change after first OTP login)."""
    from app.core.security import verify_password, get_password_hash
    user = vu.user
    if not user or not verify_password(body.current_password, user.password_hash or ""):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    user.password_hash = get_password_hash(body.new_password)
    db.add(user)
    await db.commit()
    return {"success": True}


@router.get("/ess/profile")
async def ess_profile(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return {"employee": None}

    r = await db.execute(
        select(EmployeeProfile)
        .where(EmployeeProfile.id == emp.id)
        .options(
            selectinload(EmployeeProfile.vendor_user).selectinload(VendorUser.user),
            selectinload(EmployeeProfile.department),
            selectinload(EmployeeProfile.designation),
        )
    )
    emp = r.scalar_one()
    pending_policies = await PolicyRepo(db).my_pending(vu.vendor_id, emp.id)
    announcements = await AnnouncementRepo(db).list_for_employee(vu.vendor_id, emp.id)
    expenses = await ExpenseRepo(db).list(vu.vendor_id, employee_id=emp.id)
    tickets = await HelpdeskRepo(db).list(vu.vendor_id, employee_id=emp.id)
    enrollments = await TrainingRepo(db).list_enrollments(vu.vendor_id, employee_id=emp.id)

    store_payload = None
    if emp.store_id:
        st_r = await db.execute(
            select(Store).where(Store.id == emp.store_id, Store.vendor_id == vu.vendor_id)
        )
        st = st_r.scalar_one_or_none()
        if st:
            store_payload = {"id": str(st.id), "name": st.name, "code": st.code}

    return {
        "employee": _d(emp),
        "work_location": {
            "store": store_payload,
            "tagged_to_type": emp.tagged_to_type,
            "tagged_to_label": emp.tagged_to_label,
        },
        "pending_policies": [_d(p) for p in pending_policies],
        "announcements": [_d(a) for a in announcements[:5]],
        "expense_summary": {
            "draft": sum(1 for x in expenses if x.status == "draft"),
            "submitted": sum(1 for x in expenses if x.status == "submitted"),
            "approved": sum(1 for x in expenses if x.status == "approved"),
        },
        "ticket_summary": {
            "open": sum(1 for t in tickets if t.status == "open"),
            "in_progress": sum(1 for t in tickets if t.status == "in_progress"),
            "resolved": sum(1 for t in tickets if t.status == "resolved"),
        },
        "training_summary": {
            "enrolled": sum(1 for e in enrollments if e.status in ("enrolled", "in_progress")),
            "completed": sum(1 for e in enrollments if e.status == "completed"),
            "overdue": sum(1 for e in enrollments if e.status == "overdue"),
        },
    }


class ESSProfileUpdate(BaseModel):
    personal_email: Optional[str] = Field(None, max_length=255)
    personal_phone: Optional[str] = Field(None, max_length=20)
    emergency_contact_name: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)
    emergency_contact_relation: Optional[str] = Field(None, max_length=50)


@router.patch("/ess/profile")
async def ess_update_profile(
    body: ESSProfileUpdate,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """Employee self-service: update personal contact and emergency details."""
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    data = body.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(emp, k, v)
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return _d(emp)


@router.post("/ess/policies/{pid}/acknowledge")
async def ess_acknowledge_policy(
    pid: UUID,
    request: Request,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """Same compliance acknowledgement as vendor ESS, for business front employee tokens."""
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(status_code=400, detail="Employee profile required")
    p = await PolicyRepo(db).get(pid, vu.vendor_id)
    if not p or p.status != "published":
        raise HTTPException(status_code=404, detail="Policy not available")
    ip = request.client.host if request.client else None
    ack = await PolicyRepo(db).acknowledge(p.id, emp.id, p.version, ip=ip)
    await AuditRepo(db).log(
        vu.vendor_id,
        "acknowledge",
        "policy",
        p.id,
        summary=f"Acknowledged v{p.version}",
        actor_user_id=vu.id,
    )
    await db.commit()
    return _d(ack)


@router.post("/ess/attendance/clock-in")
async def ess_clock_in(
    body: ClockInOut,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found. Please contact HR.")
    record = await svc.clock_in(emp.id, body.location)
    await db.commit()
    return _d(record)


@router.post("/ess/attendance/clock-out")
async def ess_clock_out(
    body: ClockInOut,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found.")
    record = await svc.clock_out(emp.id, body.location)
    await db.commit()
    return _d(record)


@router.get("/ess/attendance/today")
async def ess_attendance_today(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
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


@router.get("/ess/attendance")
async def ess_attendance_history(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        return {"items": [], "total": 0}
    result = await svc.list_attendance(
        vu.vendor_id,
        employee_id=emp.id,
        from_date=from_date,
        to_date=to_date,
        status=None,
        skip=0,
        limit=500,
    )
    return {"items": [_d(r) for r in result["items"]], "total": result["total"]}


ESS_ATTENDANCE_STATUSES = frozenset({
    "present", "absent", "late", "half_day", "on_leave", "holiday", "week_off",
})
ESS_MARK_RANGE_MAX_DAYS = 90


class EssMarkAttendanceIn(BaseModel):
    date: date
    status: str
    notes: Optional[str] = None


class EssMarkRangeIn(BaseModel):
    from_date: date
    to_date: date
    status: str = "present"
    notes: Optional[str] = None
    skip_weekends: bool = True
    skip_existing: bool = True


async def _ess_employee_or_404(svc: HRService, vu: VendorUser) -> EmployeeProfile:
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(
            status_code=404,
            detail="No employee profile found. Please contact HR.",
        )
    return emp


def _validate_ess_attendance_status(status: str) -> str:
    s = (status or "").strip().lower()
    if s not in ESS_ATTENDANCE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {', '.join(sorted(ESS_ATTENDANCE_STATUSES))}",
        )
    return s


@router.post("/ess/attendance/mark")
async def ess_mark_attendance(
    body: EssMarkAttendanceIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark attendance for the logged-in employee only (one day)."""
    svc = HRService(db)
    emp = await _ess_employee_or_404(svc, vu)
    att_status = _validate_ess_attendance_status(body.status)
    if body.date > date.today():
        raise HTTPException(status_code=400, detail="Cannot mark attendance for a future date.")
    record = await svc.mark_attendance(
        vendor_id=vu.vendor_id,
        marked_by=vu.id,
        employee_id=emp.id,
        att_date=body.date,
        status=att_status,
        notes=body.notes,
    )
    await db.commit()
    return _d(record)


@router.post("/ess/attendance/mark-range")
async def ess_mark_attendance_range(
    body: EssMarkRangeIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-mark attendance for the logged-in employee across a date range."""
    if body.from_date > body.to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")
    if body.to_date > date.today():
        raise HTTPException(status_code=400, detail="Cannot mark attendance for future dates.")

    max_days = (body.to_date - body.from_date).days + 1
    if max_days > ESS_MARK_RANGE_MAX_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Range cannot exceed {ESS_MARK_RANGE_MAX_DAYS} days",
        )

    svc = HRService(db)
    emp = await _ess_employee_or_404(svc, vu)
    att_status = _validate_ess_attendance_status(body.status)

    created = 0
    skipped = 0
    current = body.from_date
    while current <= body.to_date:
        if body.skip_weekends and current.weekday() >= 5:
            current += timedelta(days=1)
            continue

        existing_res = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == emp.id,
                AttendanceRecord.date == current,
            )
        )
        existing_rec = existing_res.scalar_one_or_none()

        if existing_rec:
            if body.skip_existing:
                skipped += 1
                current += timedelta(days=1)
                continue
            await db.delete(existing_rec)

        db.add(
            AttendanceRecord(
                id=_uuid.uuid4(),
                employee_id=emp.id,
                date=current,
                status=att_status,
                notes=body.notes,
                marked_by=vu.id,
                approval_status="pending",
            )
        )
        created += 1
        current += timedelta(days=1)

    await db.commit()
    return {
        "created": created,
        "skipped": skipped,
        "message": f"Marked {created} day(s); skipped {skipped} existing.",
    }


@router.get("/ess/leaves")
async def ess_my_leaves(
    year: Optional[int] = None,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
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


@router.get("/ess/leave-policies")
async def ess_leave_policies(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    return [_d(p) for p in await svc.leave_repo.list_policies(vu.vendor_id)]


@router.post("/ess/leaves", status_code=201)
async def ess_submit_leave(
    body: LeaveRequestIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found.")
    req = await svc.submit_leave_request(emp.id, vu.vendor_id, body.model_dump())
    await db.commit()
    return _d(req)


@router.delete("/ess/leaves/{req_id}/cancel")
async def ess_cancel_leave(
    req_id: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="No employee profile found.")
    req = await svc.cancel_leave(req_id, emp.id)
    await db.commit()
    return _d(req)


@router.get("/ess/payslips")
async def ess_payslips(
    year: Optional[int] = None,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        return {"items": [], "total": 0}
    entries = await svc.payroll_repo.list_employee_payslips(emp.id)
    if year is not None:
        filtered = [e for e in entries if e.payroll_run and e.payroll_run.year == year]
    else:
        filtered = entries
    return {"items": [_payslip_public(e) for e in filtered], "total": len(filtered)}


@router.get("/ess/payslips/{entry_id}")
async def ess_payslip_detail(
    entry_id: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = HRService(db)
    emp = await svc.emp_repo.get_by_vendor_user(vu.id)
    if not emp:
        raise HTTPException(status_code=404, detail="Not found")
    entry = await svc.payroll_repo.get_entry(entry_id)
    if not entry or str(entry.employee_id) != str(emp.id):
        raise HTTPException(status_code=404, detail="Not found")
    return _payslip_public(entry)


@router.get("/ess/training")
async def ess_training(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return {"enrollments": []}
    items = await TrainingRepo(db).list_enrollments(vu.vendor_id, employee_id=emp.id)
    if not items:
        return {"enrollments": []}

    eids = [e.id for e in items]
    pid_set = {e.program_id for e in items}

    cert_by_enr: Dict[UUID, UUID] = {}
    if eids:
        cr = await db.execute(select(TrainingCertificate).where(TrainingCertificate.enrollment_id.in_(eids)))
        for cert in cr.scalars().all():
            cert_by_enr[cert.enrollment_id] = cert.id

    prog_by_id: Dict[UUID, TrainingProgram] = {}
    if pid_set:
        pr = await db.execute(select(TrainingProgram).where(TrainingProgram.id.in_(pid_set)))
        for p in pr.scalars().all():
            prog_by_id[p.id] = p

    out = []
    for enr in items:
        d = _d(enr)
        prog = prog_by_id.get(enr.program_id)
        if prog:
            d["program"] = _d(prog)
        cid = cert_by_enr.get(enr.id)
        if cid:
            d["certificate_id"] = str(cid)
        out.append(d)
    return {"enrollments": out}


@router.get("/ess/training/certificates/{cid}", response_class=HTMLResponse)
async def ess_certificate_download(
    cid: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(404, "Certificate not found")

    r = await db.execute(
        select(TrainingCertificate).where(
            TrainingCertificate.id == cid, TrainingCertificate.vendor_id == vu.vendor_id
        )
    )
    cert = r.scalar_one_or_none()
    if not cert:
        raise HTTPException(404, "Certificate not found")

    enr = await TrainingRepo(db).get_enrollment(cert.enrollment_id, vu.vendor_id)
    if not enr or str(enr.employee_id) != str(emp.id):
        raise HTTPException(404, "Certificate not found")

    return HTMLResponse(content=cert.download_html or "<p>Certificate body missing</p>", status_code=200)


@router.get("/ess/performance")
async def ess_performance(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return {"reviews": [], "goals": [], "feedback": []}
    revs = await ReviewRepo(db).list(vu.vendor_id, employee_id=emp.id)
    goals = await GoalRepo(db).list(vu.vendor_id, employee_id=emp.id)
    fb = await FeedbackRepo(db).list(vu.vendor_id, employee_id=emp.id)
    return {
        "reviews": [_d(r) for r in revs],
        "goals": [_d(g) for g in goals],
        "feedback": [_d(f) for f in fb],
    }


@router.post("/ess/expenses/receipt")
async def ess_upload_expense_receipt(
    file: UploadFile = File(...),
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
):
    """Upload receipt / media for employee expense claims. No application size cap."""
    from app.services.expense_receipt_upload import save_expense_receipt

    return await save_expense_receipt(file, vu.vendor_id)


@router.get("/ess/expenses")
async def ess_my_expenses(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return []
    items = await ExpenseRepo(db).list(vu.vendor_id, employee_id=emp.id)
    return [_d(i) for i in items]


@router.post("/ess/expenses", status_code=201)
async def ess_create_expense(
    body: ExpenseIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(400, "Employee profile required to file claims")
    data = body.model_dump(exclude_none=True)
    data["employee_id"] = emp.id
    if data.get("status") == "submitted":
        data["submitted_at"] = datetime.utcnow()
    e = await ExpenseRepo(db).create(vu.vendor_id, data)
    await db.commit()
    return _d(e)


@router.put("/ess/expenses/{eid}")
async def ess_update_expense(
    eid: UUID,
    body: ExpenseIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    e = await ExpenseRepo(db).get(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    emp = await _current_employee(db, vu)
    if not emp or str(e.employee_id) != str(emp.id):
        raise HTTPException(403, "Not your expense claim")
    if e.status not in ("draft", "submitted", "rejected"):
        raise HTTPException(400, f"Cannot edit a {e.status} claim")
    data = body.model_dump(exclude_none=True)
    if data.get("status") == "submitted":
        if not e.submitted_at:
            data["submitted_at"] = datetime.utcnow()
        if e.status == "rejected":
            data["decision_note"] = None
            data["decided_at"] = None
            data["approver_user_id"] = None
    e = await ExpenseRepo(db).update(e, data)
    await db.commit()
    return _d(e)


@router.delete("/ess/expenses/{eid}", status_code=204)
async def ess_delete_expense(
    eid: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    e = await ExpenseRepo(db).get(eid, vu.vendor_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    emp = await _current_employee(db, vu)
    if not emp or str(e.employee_id) != str(emp.id):
        raise HTTPException(403, "Not your expense claim")
    if e.status not in ("draft",):
        raise HTTPException(400, "Only draft claims can be deleted")
    await ExpenseRepo(db).delete(e)
    await db.commit()


@router.get("/ess/helpdesk")
async def ess_helpdesk_list(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return []
    items = await HelpdeskRepo(db).list(vu.vendor_id, employee_id=emp.id)
    return [_d(i) for i in items]


@router.post("/ess/helpdesk", status_code=201)
async def ess_helpdesk_create(
    body: TicketIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(400, "Employee profile required")
    data = body.model_dump(exclude_none=True)
    data["employee_id"] = emp.id
    t = await HelpdeskRepo(db).create(vu.vendor_id, data)
    await NotificationService(db).notify_ticket_event(
        vu.vendor_id, t.id, t.ticket_number or str(t.id)[:8], t.subject, "Created",
    )
    await db.commit()
    return _d(t)


@router.get("/ess/announcements")
async def ess_announcements(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return {"items": []}
    items = await AnnouncementRepo(db).list_for_employee(vu.vendor_id, emp.id)
    out = []
    for a in items:
        d = _d(a)
        d["read_by_me"] = any(r.employee_id == emp.id for r in (a.reads or []))
        out.append(d)
    return {"items": out}


@router.put("/ess/announcements/{aid}/read", status_code=204)
async def ess_announcement_read(
    aid: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return
    await AnnouncementRepo(db).mark_read(aid, emp.id)
    await db.commit()


@router.get("/ess/onboarding")
async def ess_onboarding(
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        return None
    c = await OnboardingChecklistRepo(db).get_for_employee(emp.id, vu.vendor_id)
    return _d(c) if c else None


@router.put("/ess/onboarding/tasks/{task_id}")
async def ess_onboarding_task_update(
    task_id: UUID,
    body: TaskUpdateBody,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(404, "Employee profile not found")

    r = await db.execute(
        select(OnboardingTask)
        .join(OnboardingChecklist, OnboardingTask.checklist_id == OnboardingChecklist.id)
        .where(
            OnboardingTask.id == task_id,
            OnboardingChecklist.vendor_id == vu.vendor_id,
            OnboardingChecklist.employee_id == emp.id,
        )
    )
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    repo = OnboardingChecklistRepo(db)
    t = await repo.update_task(task_id, body.model_dump(exclude_none=True))
    if not t:
        raise HTTPException(404, "Task not found")
    await repo.maybe_complete(t.checklist_id)
    await db.commit()
    return _d(t)


# ── ESS: holidays (read-only) ────────────────────────────────────────────────

@router.get("/ess/holidays")
async def ess_holidays(
    year: Optional[int] = Query(None),
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    yr = year or date.today().year
    items = await LeaveRepo(db).list_holidays(vu.vendor_id, yr)
    return [_d(h) for h in items]


# ── ESS: compliance policy reader ─────────────────────────────────────────────

@router.get("/ess/policies/{pid}")
async def ess_get_policy(
    pid: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    p = await PolicyRepo(db).get(pid, vu.vendor_id)
    if not p or p.status != "published":
        raise HTTPException(status_code=404, detail="Policy not available")
    pending = await PolicyRepo(db).my_pending(vu.vendor_id, emp.id)
    pending_ids = {str(x.id) for x in pending}
    d = _d(p)
    d["pending_acknowledgement"] = str(p.id) in pending_ids
    # Employees do not need admin acknowledgement audit list
    d.pop("acknowledgements", None)
    return d


# ── ESS: training enrollment & course completion ─────────────────────────────

async def _ess_enrollment_for_employee(
    db: AsyncSession, vu: VendorUser, eid: UUID
) -> tuple[EmployeeProfile, Any]:
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    enr = await TrainingRepo(db).get_enrollment(eid, vu.vendor_id)
    if not enr or str(enr.employee_id) != str(emp.id):
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return emp, enr


@router.get("/ess/training/enrollments/{eid}")
async def ess_get_enrollment(
    eid: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    _, enr = await _ess_enrollment_for_employee(db, vu, eid)
    completions = await TrainingRepo(db).list_completions(eid)
    prog = await TrainingRepo(db).get_program(enr.program_id, vu.vendor_id)
    out = {**_d(enr), "completions": [_d(c) for c in completions]}
    if prog:
        out["program"] = _d(prog)
    return out


@router.post("/ess/training/enrollments/{eid}/complete-course")
async def ess_complete_course(
    eid: UUID,
    body: CompletionIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    emp, enr = await _ess_enrollment_for_employee(db, vu, eid)
    course = await TrainingRepo(db).get_course(body.course_id)
    if not course or str(course.program_id) != str(enr.program_id):
        raise HTTPException(status_code=404, detail="Course not found")

    score_pct = body.score_pct
    passed = body.passed if body.passed is not None else True
    if course.questions and body.answers:
        correct_total = 0
        correct = 0
        for q in course.questions:
            correct_total += int(q.points or 1)
            ans = body.answers.get(str(q.id))
            if ans is None:
                continue
            correct_options = {o.get("id") for o in (q.options or []) if o.get("is_correct")}
            given = set(ans) if isinstance(ans, list) else {ans}
            if given == correct_options and correct_options:
                correct += int(q.points or 1)
        score_pct = int(round(100 * correct / correct_total)) if correct_total else 100
        passed = score_pct >= int(course.pass_score_pct or 70)

    await TrainingRepo(db).upsert_completion(
        eid, body.course_id, score_pct=score_pct, passed=passed, answers=body.answers,
    )
    enr = await TrainingRepo(db).recalc_progress(eid)
    if enr.status == "completed":
        program = await TrainingRepo(db).get_program(enr.program_id, vu.vendor_id)
        if program and program.issues_certificate:
            r2 = await db.execute(
                select(EmployeeProfile)
                .where(EmployeeProfile.id == emp.id)
                .options(selectinload(EmployeeProfile.vendor_user).selectinload(VendorUser.user))
            )
            emp_row = r2.scalar_one_or_none()
            name = (
                emp_row.vendor_user.user.full_name
                if emp_row and emp_row.vendor_user and emp_row.vendor_user.user
                else "Employee"
            )
            cert = await TrainingRepo(db).issue_certificate(vu.vendor_id, enr.id, program.name, name)
            enr.certificate_url = f"/api/v1/store/hr/ess/training/certificates/{cert.id}"
            await db.flush()
    await db.commit()
    completions = await TrainingRepo(db).list_completions(eid)
    return {**_d(enr), "completions": [_d(c) for c in completions]}


# ── ESS: helpdesk detail & comments ───────────────────────────────────────────

async def _ess_ticket_for_employee(
    db: AsyncSession, vu: VendorUser, tid: UUID
) -> tuple[EmployeeProfile, Any]:
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    t = await HelpdeskRepo(db).get(tid, vu.vendor_id)
    if not t or str(t.employee_id) != str(emp.id):
        raise HTTPException(status_code=404, detail="Ticket not found")
    return emp, t


def _ticket_public(t) -> Dict[str, Any]:
    d = _d(t)
    comments = d.get("comments") or []
    d["comments"] = [c for c in comments if not c.get("is_internal")]
    return d


@router.get("/ess/helpdesk/{tid}")
async def ess_helpdesk_get(
    tid: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    _, t = await _ess_ticket_for_employee(db, vu, tid)
    return _ticket_public(t)


@router.post("/ess/helpdesk/{tid}/comments", status_code=201)
async def ess_helpdesk_comment(
    tid: UUID,
    body: TicketCommentIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    _, t = await _ess_ticket_for_employee(db, vu, tid)
    c = await HelpdeskRepo(db).add_comment(tid, {
        "author_user_id": vu.id,
        "body": body.body,
        "is_internal": False,
        "is_staff_reply": False,
        "attachment_url": body.attachment_url,
    })
    await NotificationService(db).notify_ticket_event(
        vu.vendor_id, t.id, t.ticket_number or str(t.id)[:8], t.subject, "Comment",
    )
    await db.commit()
    return _d(c)


# ── ESS: performance review actions ──────────────────────────────────────────

async def _ess_review_for_employee(
    db: AsyncSession, vu: VendorUser, rid: UUID
):
    emp = await _current_employee(db, vu)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    r = await ReviewRepo(db).get(rid, vu.vendor_id)
    if not r or str(r.employee_id) != str(emp.id):
        raise HTTPException(status_code=404, detail="Review not found")
    return emp, r


@router.get("/ess/performance/reviews/{rid}")
async def ess_get_review(
    rid: UUID,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    _, r = await _ess_review_for_employee(db, vu, rid)
    cycle = await CycleRepo(db).get(r.cycle_id, vu.vendor_id)
    out = _d(r)
    if cycle:
        out["cycle"] = _d(cycle)
    return out


@router.put("/ess/performance/reviews/{rid}/self")
async def ess_submit_self_review(
    rid: UUID,
    body: ReviewSelfIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    _, r = await _ess_review_for_employee(db, vu, rid)
    if r.status not in ("self_pending", "draft"):
        raise HTTPException(status_code=400, detail="Self-review is not open for this cycle")
    data: Dict[str, Any] = {
        "self_assessment": body.self_assessment,
        "self_rating": body.self_rating,
        "self_submitted_at": datetime.utcnow(),
    }
    if r.status in ("self_pending", "draft"):
        data["status"] = "manager_pending"
    r = await ReviewRepo(db).update(r, {k: v for k, v in data.items() if v is not None})
    kpi_scores = body.kpi_self_scores
    if kpi_scores:
        existing = {s.kpi_key: s for s in r.kpi_scores}
        scores_to_save = []
        for s in kpi_scores:
            ex = existing.get(s.get("kpi_key"))
            scores_to_save.append({
                "kpi_key": s.get("kpi_key"),
                "label": s.get("label") or (ex.label if ex else None),
                "weight": s.get("weight") or (float(ex.weight) if ex and ex.weight else 10),
                "self_score": s.get("self_score"),
                "manager_score": ex.manager_score if ex else None,
                "comments": s.get("comments") or (ex.comments if ex else None),
            })
        await ReviewRepo(db).upsert_kpi_scores(rid, scores_to_save)
    await db.commit()
    return _d(await ReviewRepo(db).get(rid, vu.vendor_id))


class ReviewAckIn(BaseModel):
    note: Optional[str] = None


@router.put("/ess/performance/reviews/{rid}/acknowledge")
async def ess_acknowledge_review(
    rid: UUID,
    body: ReviewAckIn,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    _, r = await _ess_review_for_employee(db, vu, rid)
    if r.status != "manager_submitted":
        raise HTTPException(status_code=400, detail="This review is not ready for acknowledgement")
    r = await ReviewRepo(db).update(r, {
        "employee_acknowledgement": body.note,
        "acknowledged_at": datetime.utcnow(),
        "status": "acknowledged",
    })
    await db.commit()
    return _d(r)
