# app/services/hr_service.py
"""Business logic layer for HR operations."""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.security import get_password_hash
from app.repositories.hr_repo import (
    DepartmentRepo, DesignationRepo, EmployeeRepo,
    AttendanceRepo, LeaveRepo, SalaryRepo, PayrollRepo,
    OfferLetterRepo, OfferLetterTemplateRepo,
)
from app.models.hr import (
    Department, Designation, EmployeeProfile, AttendanceRecord,
    LeaveRequest, SalaryStructure, PayrollRun, PayrollEntry,
)


class HRService:
    """Facade that composes all HR repository operations with business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.dept_repo = DepartmentRepo(db)
        self.desig_repo = DesignationRepo(db)
        self.emp_repo = EmployeeRepo(db)
        self.att_repo = AttendanceRepo(db)
        self.leave_repo = LeaveRepo(db)
        self.salary_repo = SalaryRepo(db)
        self.payroll_repo = PayrollRepo(db)
        self.offer_repo = OfferLetterRepo(db)
        self.tpl_repo   = OfferLetterTemplateRepo(db)

    # ─────────────────── Departments ─────────────────────────────────

    async def list_departments(self, vendor_id: UUID) -> List[Department]:
        return await self.dept_repo.list(vendor_id)

    async def create_department(self, vendor_id: UUID, data: dict) -> Department:
        return await self.dept_repo.create(vendor_id, data)

    async def update_department(self, dept_id: UUID, vendor_id: UUID, data: dict) -> Department:
        dept = await self.dept_repo.get(dept_id, vendor_id)
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
        return await self.dept_repo.update(dept, data)

    async def delete_department(self, dept_id: UUID, vendor_id: UUID) -> None:
        dept = await self.dept_repo.get(dept_id, vendor_id)
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
        await self.dept_repo.delete(dept)

    # ─────────────────── Designations ────────────────────────────────

    async def _validate_designation(
        self,
        vendor_id: UUID,
        name: str,
        level: int,
        *,
        exclude_id: UUID | None = None,
    ) -> tuple[str, int]:
        clean_name = (name or "").strip()
        if len(clean_name) < 2:
            raise HTTPException(status_code=400, detail="Designation title must be at least 2 characters")
        if level < 1 or level > 20:
            raise HTTPException(status_code=400, detail="Seniority level must be between 1 and 20")
        q = select(Designation).where(
            Designation.vendor_id == vendor_id,
            func.lower(Designation.name) == clean_name.lower(),
            Designation.level == level,
            Designation.is_active == True,
        )
        if exclude_id:
            q = q.where(Designation.id != exclude_id)
        existing = (await self.db.execute(q)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f'Designation "{clean_name}" at level L{level} already exists',
            )
        return clean_name, level

    async def list_designations(self, vendor_id: UUID) -> List[Designation]:
        return await self.desig_repo.list(vendor_id)

    async def create_designation(self, vendor_id: UUID, data: dict) -> Designation:
        name = data.get("name", "")
        level = data.get("level", 1)
        clean_name, clean_level = await self._validate_designation(vendor_id, name, level)
        return await self.desig_repo.create(
            vendor_id, {**data, "name": clean_name, "level": clean_level}
        )

    async def update_designation(self, desig_id: UUID, vendor_id: UUID, data: dict) -> Designation:
        desig = await self.desig_repo.get(desig_id, vendor_id)
        if not desig:
            raise HTTPException(status_code=404, detail="Designation not found")
        name = data.get("name", desig.name)
        level = data.get("level", desig.level)
        clean_name, clean_level = await self._validate_designation(
            vendor_id, name, level, exclude_id=desig_id
        )
        payload = {**data, "name": clean_name, "level": clean_level}
        return await self.desig_repo.update(desig, payload)

    async def delete_designation(self, desig_id: UUID, vendor_id: UUID) -> None:
        desig = await self.desig_repo.get(desig_id, vendor_id)
        if not desig:
            raise HTTPException(status_code=404, detail="Designation not found")
        await self.desig_repo.delete(desig)

    # ─────────────────── Employees ────────────────────────────────────

    async def list_employees(self, vendor_id: UUID, **filters) -> dict:
        employees, total = await self.emp_repo.list(vendor_id, **filters)
        return {"items": employees, "total": total}

    async def list_employees_without_portal_access(
        self, vendor_id: UUID, *, search: Optional[str] = None, limit: int = 100
    ) -> List[EmployeeProfile]:
        return await self.emp_repo.list_without_portal_access(
            vendor_id, search=search, limit=limit
        )

    async def get_employee(self, emp_id: UUID, vendor_id: UUID) -> EmployeeProfile:
        emp = await self.emp_repo.get(emp_id, vendor_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        return emp

    async def create_employee(self, vendor_id: UUID, data: dict) -> EmployeeProfile:
        vu_id = data.get("vendor_user_id")
        if vu_id:
            existing = await self.emp_repo.get_by_vendor_user(vu_id)
            if existing:
                raise HTTPException(status_code=400, detail="This team member already has an employee profile")
        else:
            name = (data.get("full_name") or "").strip()
            if not name:
                raise HTTPException(
                    status_code=422,
                    detail="full_name is required when creating an employee without portal access",
                )
            if not (data.get("personal_email") or data.get("personal_phone")):
                raise HTTPException(
                    status_code=422,
                    detail="personal_email or personal_phone is required for HR-only employees",
                )
        if data.get("manager_id"):
            await self._validate_manager_id(vendor_id, data.get("manager_id"))
        return await self.emp_repo.create(vendor_id, data)

    async def _validate_manager_id(
        self,
        vendor_id: UUID,
        manager_id: Optional[UUID],
        *,
        emp_id: Optional[UUID] = None,
    ) -> None:
        if not manager_id:
            return
        if emp_id and manager_id == emp_id:
            raise HTTPException(status_code=400, detail="Employee cannot be their own reporting manager")
        mgr = await self.emp_repo.get(manager_id, vendor_id)
        if not mgr:
            raise HTTPException(status_code=400, detail="Reporting manager not found")
        if not mgr.is_active or mgr.status == "exited":
            raise HTTPException(status_code=400, detail="Reporting manager must be an active employee")

    async def update_employee(self, emp_id: UUID, vendor_id: UUID, data: dict) -> EmployeeProfile:
        emp = await self.emp_repo.get(emp_id, vendor_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        if "manager_id" in data:
            await self._validate_manager_id(vendor_id, data.get("manager_id"), emp_id=emp_id)
        return await self.emp_repo.update(emp, data)

    async def set_employee_portal_password(self, emp_id: UUID, vendor_id: UUID, new_password: str) -> None:
        """Update the linked User password used for business front HR / ESS login (email or employee code)."""
        emp = await self.emp_repo.get(emp_id, vendor_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        vu = emp.vendor_user
        if not vu or not vu.user:
            raise HTTPException(status_code=400, detail="Employee has no linked login account")
        user = vu.user
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Cannot set password for a disabled account")
        user.password_hash = get_password_hash(new_password)
        await self.db.flush()

    # ─────────────────── Attendance ───────────────────────────────────

    async def clock_in(self, employee_id: UUID, location: Optional[dict] = None) -> AttendanceRecord:
        today = date.today()
        record = await self.att_repo.get_today(employee_id, today)
        if record and record.clock_in:
            raise HTTPException(status_code=400, detail="Already clocked in today")
        now = datetime.utcnow()
        # Detect late: shift starts at 09:00
        hour = now.hour
        att_status = "late" if hour >= 9 else "present"
        data = {"clock_in": now, "status": att_status}
        if location:
            data["clock_in_location"] = location
        return await self.att_repo.upsert(employee_id, today, data)

    async def clock_out(self, employee_id: UUID, location: Optional[dict] = None) -> AttendanceRecord:
        today = date.today()
        record = await self.att_repo.get_today(employee_id, today)
        if not record or not record.clock_in:
            raise HTTPException(status_code=400, detail="Not clocked in today")
        if record.clock_out:
            raise HTTPException(status_code=400, detail="Already clocked out today")
        now = datetime.utcnow()
        delta = now - record.clock_in.replace(tzinfo=None) if record.clock_in else timedelta(0)
        work_hours = round(delta.total_seconds() / 3600, 2)
        overtime = max(0, work_hours - 8)
        data: dict = {"clock_out": now, "work_hours": work_hours, "overtime_hours": overtime}
        if location:
            data["clock_out_location"] = location
        return await self.att_repo.upsert(employee_id, today, data)

    async def mark_attendance(
        self,
        vendor_id: UUID,
        marked_by: UUID,
        employee_id: UUID,
        att_date: date,
        status: str,
        notes: Optional[str] = None,
    ) -> AttendanceRecord:
        # Verify employee belongs to vendor
        emp = await self.emp_repo.get(employee_id, vendor_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        data: dict = {"status": status}
        if notes:
            data["notes"] = notes
        return await self.att_repo.upsert(employee_id, att_date, data, marked_by=marked_by)

    async def list_attendance(self, vendor_id: UUID, **filters) -> dict:
        records, total = await self.att_repo.list(vendor_id, **filters)
        return {"items": records, "total": total}

    # ─────────────────── Leaves ───────────────────────────────────────

    async def submit_leave_request(self, employee_id: UUID, vendor_id: UUID, data: dict) -> LeaveRequest:
        policy_id = data.get("leave_policy_id")
        policy = await self.leave_repo.get_policy(policy_id, vendor_id)
        if not policy:
            raise HTTPException(status_code=404, detail="Leave policy not found")

        year = data["from_date"].year
        balance = await self.leave_repo.get_balance(employee_id, policy_id, year)
        if not balance:
            # Auto-create balance with policy allocation
            balance = await self.leave_repo.create_balance(employee_id, policy_id, year, float(policy.days_per_year))

        available = float(balance.allocated) + float(balance.carried_forward) - float(balance.used)
        days = float(data["days"])
        if days > available:
            raise HTTPException(status_code=400, detail=f"Insufficient leave balance. Available: {available:.1f} days")

        req_data = {
            "employee_id": employee_id,
            "leave_policy_id": policy_id,
            "from_date": data["from_date"],
            "to_date": data["to_date"],
            "days": days,
            "reason": data.get("reason"),
            "is_half_day": data.get("is_half_day", False),
            "half_day_type": data.get("half_day_type"),
        }
        return await self.leave_repo.create_request(req_data)

    async def approve_leave(self, req_id: UUID, vendor_id: UUID, approved_by: UUID) -> LeaveRequest:
        req = await self.leave_repo.get_request(req_id, vendor_id)
        if not req:
            raise HTTPException(status_code=404, detail="Leave request not found")
        if req.status != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot approve a {req.status} request")

        req.status = "approved"
        req.approved_by = approved_by
        req.approved_at = datetime.utcnow()
        # Deduct from balance
        balance = await self.leave_repo.get_balance(req.employee_id, req.leave_policy_id, req.from_date.year)
        if balance:
            balance.used = float(balance.used) + float(req.days)
        await self.db.flush()
        return req

    async def reject_leave(self, req_id: UUID, vendor_id: UUID, reason: str, rejected_by: UUID) -> LeaveRequest:
        req = await self.leave_repo.get_request(req_id, vendor_id)
        if not req:
            raise HTTPException(status_code=404, detail="Leave request not found")
        if req.status != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot reject a {req.status} request")
        req.status = "rejected"
        req.rejection_reason = reason
        req.approved_by = rejected_by
        req.approved_at = datetime.utcnow()
        await self.db.flush()
        return req

    async def cancel_leave(self, req_id: UUID, employee_id: UUID) -> LeaveRequest:
        from sqlalchemy import select
        from app.models.hr import LeaveRequest as LR
        result = await self.db.execute(select(LR).where(LR.id == req_id, LR.employee_id == employee_id))
        req = result.scalar_one_or_none()
        if not req:
            raise HTTPException(status_code=404, detail="Leave request not found")
        if req.status not in ("pending", "approved"):
            raise HTTPException(status_code=400, detail="Cannot cancel this request")
        # Restore balance if approved
        if req.status == "approved":
            balance = await self.leave_repo.get_balance(employee_id, req.leave_policy_id, req.from_date.year)
            if balance:
                balance.used = max(0, float(balance.used) - float(req.days))
        req.status = "cancelled"
        await self.db.flush()
        return req

    # ─────────────────── Salary ───────────────────────────────────────

    async def create_salary_structure(self, vendor_id: UUID, data: dict) -> SalaryStructure:
        emp = await self.emp_repo.get(data["employee_id"], vendor_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        # Compute totals from earnings/deductions
        earnings = data.get("earnings", {})
        deductions = data.get("deductions", {})
        gross = sum(float(v) for v in earnings.values() if isinstance(v, (int, float, str)) and str(v).replace('.', '').isdigit())
        total_ded = sum(float(v) for v in deductions.values() if isinstance(v, (int, float, str)) and str(v).replace('.', '').isdigit())
        net = gross - total_ded
        data["gross_monthly"] = round(gross, 2)
        data["net_monthly"] = round(net, 2)
        data["ctc_monthly"] = round(gross, 2)
        data["ctc_annual"] = round(gross * 12, 2)
        return await self.salary_repo.create(data)

    # ─────────────────── Payroll ──────────────────────────────────────

    async def process_payroll(self, vendor_id: UUID, month: int, year: int, processed_by: UUID) -> PayrollRun:
        from sqlalchemy import select as sa_select
        from app.models.hr import EmployeeProfile as EP, SalaryStructure as SS, AttendanceRecord as AR
        from calendar import monthrange
        import datetime as dt

        _, days_in_month = monthrange(year, month)
        from_date = dt.date(year, month, 1)
        to_date = dt.date(year, month, days_in_month)

        version = await self.payroll_repo.next_version(vendor_id, month, year)
        run = await self.payroll_repo.create_run(vendor_id, {
            "month": month, "year": year, "version": version, "status": "processing",
            "processed_by": processed_by,
        })

        # Fetch active employees
        employees, _ = await self.emp_repo.list(vendor_id, status="active", skip=0, limit=1000)

        total_gross = Decimal("0")
        total_ded = Decimal("0")
        total_net = Decimal("0")
        entry_count = 0

        for emp in employees:
            salary = await self.salary_repo.get_active(emp.id)

            # Count attendance for the period
            att_records, _ = await self.att_repo.list(
                vendor_id, employee_id=emp.id, from_date=from_date, to_date=to_date
            )
            days_present = sum(1 for a in att_records if a.status in ("present", "late", "half_day", "on_leave"))
            days_absent = sum(1 for a in att_records if a.status == "absent")
            leave_days = sum(1 for a in att_records if a.status == "on_leave")
            overtime = sum(float(a.overtime_hours or 0) for a in att_records)

            if salary and (salary.earnings or salary.deductions):
                # If no attendance records exist for the period, assume full attendance
                if not att_records:
                    days_present = days_in_month
                    days_absent = 0

                # Pro-rate salary based on attendance ratio
                ratio = Decimal(str(days_present)) / Decimal(str(days_in_month))
                earnings_snap = {k: round(float(v) * float(ratio), 2) for k, v in (salary.earnings or {}).items()}
                ded_snap = {k: float(v) for k, v in (salary.deductions or {}).items()}

                gross = Decimal(str(sum(earnings_snap.values())))
                ded = Decimal(str(sum(ded_snap.values())))
                net = gross - ded
                entry_status = "processed"
            else:
                # No salary structure — create a ₹0 pending entry so the employee appears in the run
                earnings_snap = {}
                ded_snap = {}
                gross = ded = net = Decimal("0")
                entry_status = "pending"

            entry = PayrollEntry(
                payroll_run_id=run.id,
                employee_id=emp.id,
                earnings=earnings_snap,
                deductions=ded_snap,
                days_worked=days_present,
                days_absent=days_absent,
                leave_days=leave_days,
                overtime_hours=overtime,
                gross_amount=gross,
                total_deductions=ded,
                net_amount=net,
                status=entry_status,
            )
            self.db.add(entry)
            entry_count += 1

            total_gross += gross
            total_ded += ded
            total_net += net

        run.status = "processed"
        run.processed_at = datetime.utcnow()
        run.total_gross = total_gross
        run.total_deductions = total_ded
        run.total_net = total_net
        run.employee_count = entry_count

        await self.db.flush()
        await self.db.refresh(run)
        return run

    # ─────────────────── Offer Letters ───────────────────────────────

    async def list_offers(self, vendor_id: UUID):
        return await self.offer_repo.list(vendor_id)

    async def get_offer(self, offer_id: UUID, vendor_id: UUID):
        offer = await self.offer_repo.get(offer_id, vendor_id)
        if not offer:
            raise HTTPException(status_code=404, detail="Offer letter not found")
        return offer

    async def create_offer(self, vendor_id: UUID, data: dict):
        return await self.offer_repo.create(vendor_id, data)

    async def update_offer(self, offer_id: UUID, vendor_id: UUID, data: dict):
        offer = await self.offer_repo.get(offer_id, vendor_id)
        if not offer:
            raise HTTPException(status_code=404, detail="Offer letter not found")
        if offer.status != "draft":
            raise HTTPException(status_code=400, detail="Only draft offers can be edited")
        return await self.offer_repo.update(offer, data)

    async def send_offer(self, offer_id: UUID, vendor_id: UUID):
        offer = await self.offer_repo.get(offer_id, vendor_id)
        if not offer:
            raise HTTPException(status_code=404, detail="Offer letter not found")
        offer.status = "sent"
        offer.sent_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(offer)
        return offer

    async def delete_offer(self, offer_id: UUID, vendor_id: UUID) -> None:
        offer = await self.offer_repo.get(offer_id, vendor_id)
        if not offer:
            raise HTTPException(status_code=404, detail="Offer letter not found")
        if offer.status != "draft":
            raise HTTPException(status_code=400, detail="Only draft offers can be deleted")
        await self.offer_repo.delete(offer)

    # ─────────────────── Offer Letter Templates ──────────────────────

    async def list_offer_templates(
        self, vendor_id: UUID,
        designation_id=None, department_id=None, store_id=None,
    ):
        return await self.tpl_repo.list_by_vendor(
            vendor_id, designation_id=designation_id,
            department_id=department_id, store_id=store_id,
        )

    async def get_offer_template(self, template_id: UUID, vendor_id: UUID):
        tpl = await self.tpl_repo.get(template_id, vendor_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="Offer letter template not found")
        return tpl

    async def create_offer_template(self, vendor_id: UUID, data: dict):
        return await self.tpl_repo.create(vendor_id, data)

    async def update_offer_template(self, template_id: UUID, vendor_id: UUID, data: dict):
        tpl = await self.tpl_repo.get(template_id, vendor_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="Offer letter template not found")
        return await self.tpl_repo.update(tpl, data)

    async def delete_offer_template(self, template_id: UUID, vendor_id: UUID) -> None:
        tpl = await self.tpl_repo.get(template_id, vendor_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="Offer letter template not found")
        await self.tpl_repo.delete(tpl)

    async def set_default_offer_template(self, template_id: UUID, vendor_id: UUID):
        return await self.tpl_repo.set_default(template_id, vendor_id)

    async def find_best_offer_template(
        self, vendor_id: UUID,
        designation_id=None, department_id=None, store_id=None,
    ):
        return await self.tpl_repo.find_best_match(
            vendor_id, designation_id=designation_id,
            department_id=department_id, store_id=store_id,
        )

    def render_template(self, body_html: str, offer, vendor_name: str, store_name: str = "") -> str:
        """Replace {{token}} placeholders in body_html with real offer values."""
        ctc_fmt  = f"Rs.{float(offer.offered_ctc or 0):,.0f}" if offer.offered_ctc else "As discussed"
        joining  = offer.joining_date.strftime("%d %B %Y")  if offer.joining_date  else "TBD"
        off_date = offer.offered_date.strftime("%d %B %Y")  if offer.offered_date  else datetime.utcnow().strftime("%d %B %Y")
        exp_date = offer.expiry_date.strftime("%d %B %Y")   if offer.expiry_date   else "N/A"
        desig    = offer.designation.name if getattr(offer, "designation", None) else ""
        dept     = offer.department.name  if getattr(offer, "department",  None) else ""

        tokens = {
            "candidate_name":  offer.candidate_name or "",
            "candidate_email": offer.candidate_email or "",
            "candidate_phone": offer.candidate_phone or "",
            "designation":     desig,
            "department":      dept,
            "store":           store_name,
            "vendor_name":     vendor_name,
            "offered_ctc":     ctc_fmt,
            "offered_date":    off_date,
            "joining_date":    joining,
            "expiry_date":     exp_date,
            "today":           datetime.utcnow().strftime("%d %B %Y"),
        }
        result = body_html
        for key, val in tokens.items():
            result = result.replace("{{" + key + "}}", val)
        return result

    def generate_offer_html(self, offer, vendor_name: str) -> str:
        """Generate a structured, print-quality HTML offer letter."""
        ctc          = f"Rs.\u20b9{float(offer.offered_ctc or 0):,.0f}" if offer.offered_ctc else "As discussed"
        joining      = offer.joining_date.strftime("%d %B %Y")  if offer.joining_date  else "TBD"
        offered_date = offer.offered_date.strftime("%d %B %Y")  if offer.offered_date  else datetime.utcnow().strftime("%d %B %Y")
        expiry_line  = f'<p>Kindly note that this offer expires on <strong>{offer.expiry_date.strftime("%d %B %Y")}</strong>. Please communicate your decision before this date.</p>' if offer.expiry_date else ""
        designation  = getattr(offer.designation, "name", "") if getattr(offer, "designation", None) else ""
        dept         = getattr(offer.department,  "name", "") if getattr(offer, "department",  None) else ""
        dept_line    = f" in the <strong>{dept}</strong> department" if dept else ""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Offer Letter &mdash; {offer.candidate_name}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    color: #222;
    background: #f4f4f4;
    padding: 40px 20px;
    line-height: 1.7;
  }}
  .page {{
    background: #fff;
    max-width: 780px;
    margin: 0 auto;
    padding: 60px 64px;
    box-shadow: 0 2px 16px rgba(0,0,0,.12);
    border-radius: 4px;
  }}
  /* Header */
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1a56db;
    padding-bottom: 18px;
    margin-bottom: 28px;
  }}
  .company-name {{
    font-size: 22px;
    font-weight: 700;
    color: #1a56db;
    letter-spacing: .3px;
  }}
  .doc-label {{
    text-align: right;
    font-size: 18px;
    font-weight: 600;
    color: #374151;
  }}
  .doc-label small {{
    display: block;
    font-size: 12px;
    color: #6b7280;
    font-weight: 400;
    margin-top: 4px;
  }}
  /* Summary strip */
  .summary {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 28px;
  }}
  .summary-cell {{
    padding: 12px 16px;
    border-right: 1px solid #e5e7eb;
  }}
  .summary-cell:last-child {{ border-right: none; }}
  .summary-cell label {{
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .7px;
    color: #6b7280;
    margin-bottom: 3px;
  }}
  .summary-cell span {{
    font-size: 13px;
    font-weight: 600;
    color: #111;
  }}
  /* Body */
  .salutation {{ margin-bottom: 16px; }}
  p {{ margin-bottom: 14px; }}
  /* Table */
  .details-table {{
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0 28px;
    font-size: 13px;
  }}
  .details-table th {{
    background: #eff6ff;
    color: #1e40af;
    text-align: left;
    padding: 8px 14px;
    font-weight: 600;
    border: 1px solid #dbeafe;
  }}
  .details-table td {{
    padding: 8px 14px;
    border: 1px solid #e5e7eb;
    color: #374151;
  }}
  .details-table tr:nth-child(even) td {{ background: #f9fafb; }}
  /* Signatures */
  .sig-row {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 52px;
  }}
  .sig-block {{ border-top: 1px solid #9ca3af; padding-top: 10px; }}
  .sig-block p {{ margin-bottom: 2px; font-size: 13px; }}
  .sig-block .name {{ font-weight: 600; color: #111; }}
  .sig-block .role {{ color: #6b7280; font-size: 12px; }}
  /* Footer */
  .footer {{
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
  }}
  @media print {{
    body {{ background: #fff; padding: 0; }}
    .page {{ box-shadow: none; padding: 40px; }}
  }}
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="company-name">{vendor_name}</div>
    <div class="doc-label">
      Offer Letter
      <small>Ref: OL-{str(offer.id)[:8].upper()}</small>
    </div>
  </div>

  <!-- Summary strip -->
  <div class="summary">
    <div class="summary-cell">
      <label>Date of Offer</label>
      <span>{offered_date}</span>
    </div>
    <div class="summary-cell">
      <label>Date of Joining</label>
      <span>{joining}</span>
    </div>
    <div class="summary-cell">
      <label>Annual CTC</label>
      <span>{ctc}</span>
    </div>
  </div>

  <!-- Salutation -->
  <p class="salutation">Dear <strong>{offer.candidate_name}</strong>,</p>

  <p>We are delighted to offer you the position of <strong>{designation}</strong>{dept_line} at <strong>{vendor_name}</strong>. After careful consideration of your profile, qualifications, and interview performance, we believe you will be a valuable addition to our team.</p>

  <p>Please review the offer details below:</p>

  <!-- Details table -->
  <table class="details-table">
    <thead>
      <tr><th colspan="2">Offer Details</th></tr>
    </thead>
    <tbody>
      <tr><td>Candidate Name</td><td><strong>{offer.candidate_name}</strong></td></tr>
      {'<tr><td>Designation</td><td>' + designation + '</td></tr>' if designation else ''}
      {'<tr><td>Department</td><td>' + dept + '</td></tr>' if dept else ''}
      <tr><td>Annual CTC</td><td><strong>{ctc}</strong></td></tr>
      <tr><td>Date of Offer</td><td>{offered_date}</td></tr>
      <tr><td>Expected Joining Date</td><td><strong>{joining}</strong></td></tr>
    </tbody>
  </table>

  <p>This offer is contingent upon successful completion of reference and background verification checks. Kindly sign and return a copy of this letter as your acceptance of the offer.</p>

  {expiry_line}

  <p>We look forward to welcoming you to the <strong>{vendor_name}</strong> family. Should you have any questions, please feel free to reach out to us.</p>

  <p>Yours sincerely,</p>

  <!-- Signatures -->
  <div class="sig-row">
    <div class="sig-block">
      <p class="name">{vendor_name}</p>
      <p class="role">Authorised Signatory</p>
      <p style="margin-top:40px;color:#9ca3af;font-size:12px;">Signature &amp; Date</p>
    </div>
    <div class="sig-block">
      <p class="name">{offer.candidate_name}</p>
      <p class="role">Candidate Acceptance</p>
      <p style="margin-top:40px;color:#9ca3af;font-size:12px;">Signature &amp; Date</p>
    </div>
  </div>

  <div class="footer">
    This is a computer-generated offer letter issued by {vendor_name}. For queries, contact HR.
  </div>

</div>
</body>
</html>"""
