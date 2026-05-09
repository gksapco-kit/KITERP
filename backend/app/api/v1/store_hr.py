"""Storefront employee HR — login + ESS using VendorUser/User credentials (not Customer)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
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
from app.models.hr import EmployeeProfile, PayrollEntry
from app.models.hr_recruit import OnboardingTask, OnboardingChecklist
from app.models.hr_training import TrainingCertificate, TrainingProgram
from app.api.v1.vendor_hr import LeaveRequestIn, ClockInOut
from app.api.v1.vendor_hr_extra import (
    _d,
    _current_employee,
    ExpenseIn,
    TicketIn,
)
from app.services.hr_service import HRService
from app.repositories.hr_training_repo import TrainingRepo
from app.repositories.hr_recruit_repo import OnboardingChecklistRepo
from app.repositories.hr_performance_repo import GoalRepo, ReviewRepo, FeedbackRepo
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
    # Optional: store UUID or company/store code (same as ?branch= on storefront) — must match employee's outlet when they are store-pinned.
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
        "employee": {
            "id": str(emp.id),
            "employee_code": emp.employee_code,
            "full_name": user.full_name,
            "email": user.email,
        },
    }
    if branch_ctx:
        out["branch"] = branch_ctx
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


@router.post("/ess/policies/{pid}/acknowledge")
async def ess_acknowledge_policy(
    pid: UUID,
    request: Request,
    vu: VendorUser = Depends(get_current_store_hr_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """Same compliance acknowledgement as vendor ESS, for storefront employee tokens."""
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
    if e.status not in ("draft", "submitted"):
        raise HTTPException(400, f"Cannot edit a {e.status} claim")
    data = body.model_dump(exclude_none=True)
    if data.get("status") == "submitted" and not e.submitted_at:
        data["submitted_at"] = datetime.utcnow()
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
