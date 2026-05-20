# app/repositories/hr_repo.py
"""Data-access layer for all HR models."""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update, or_
from sqlalchemy.orm import selectinload

from app.models.hr import (
    Department, Designation, EmployeeProfile, EmployeeDocument,
    AttendanceRecord, LeavePolicy, LeaveBalance, LeaveRequest, Holiday,
    SalaryStructure, PayrollRun, PayrollEntry, OfferLetter, OfferLetterTemplate,
)
from app.models.store import Store
from app.models.vendor_user import VendorUser
from app.models.user import User


# ─────────────────────── Departments ────────────────────────────────────────

class DepartmentRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID) -> List[Department]:
        result = await self.db.execute(
            select(Department)
            .where(Department.vendor_id == vendor_id, Department.is_active == True)
            .order_by(Department.name)
        )
        return list(result.scalars().all())

    async def get(self, dept_id: UUID, vendor_id: UUID) -> Optional[Department]:
        result = await self.db.execute(
            select(Department).where(Department.id == dept_id, Department.vendor_id == vendor_id)
        )
        return result.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> Department:
        dept = Department(vendor_id=vendor_id, **data)
        self.db.add(dept)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def update(self, dept: Department, data: dict) -> Department:
        for k, v in data.items():
            setattr(dept, k, v)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def delete(self, dept: Department) -> None:
        dept.is_active = False
        await self.db.flush()


# ─────────────────────── Designations ───────────────────────────────────────

class DesignationRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID) -> List[Designation]:
        result = await self.db.execute(
            select(Designation)
            .where(Designation.vendor_id == vendor_id, Designation.is_active == True)
            .order_by(Designation.level, Designation.name)
        )
        return list(result.scalars().all())

    async def get(self, desig_id: UUID, vendor_id: UUID) -> Optional[Designation]:
        result = await self.db.execute(
            select(Designation).where(Designation.id == desig_id, Designation.vendor_id == vendor_id)
        )
        return result.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> Designation:
        desig = Designation(vendor_id=vendor_id, **data)
        self.db.add(desig)
        await self.db.flush()
        await self.db.refresh(desig)
        return desig

    async def update(self, desig: Designation, data: dict) -> Designation:
        for k, v in data.items():
            setattr(desig, k, v)
        await self.db.flush()
        await self.db.refresh(desig)
        return desig

    async def delete(self, desig: Designation) -> None:
        desig.is_active = False
        await self.db.flush()


# ─────────────────────── Employee Profiles ───────────────────────────────────

class EmployeeRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _load_options(self):
        return [
            selectinload(EmployeeProfile.department),
            selectinload(EmployeeProfile.designation),
            selectinload(EmployeeProfile.vendor_user).selectinload(VendorUser.user),
            selectinload(EmployeeProfile.manager).selectinload(EmployeeProfile.vendor_user).selectinload(
                VendorUser.user
            ),
        ]

    async def list(
        self,
        vendor_id: UUID,
        *,
        department_id: Optional[UUID] = None,
        status: Optional[str] = None,
        employment_type: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[EmployeeProfile], int]:
        q = select(EmployeeProfile).where(EmployeeProfile.vendor_id == vendor_id)
        if department_id:
            q = q.where(EmployeeProfile.department_id == department_id)
        if status:
            q = q.where(EmployeeProfile.status == status)
        if employment_type:
            q = q.where(EmployeeProfile.employment_type == employment_type)
        opts = await self._load_options()
        q = q.options(*opts)
        total_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(total_q)).scalar_one()
        q = q.offset(skip).limit(limit).order_by(EmployeeProfile.employee_code)
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def get(self, emp_id: UUID, vendor_id: UUID) -> Optional[EmployeeProfile]:
        opts = await self._load_options()
        result = await self.db.execute(
            select(EmployeeProfile)
            .options(*opts)
            .where(EmployeeProfile.id == emp_id, EmployeeProfile.vendor_id == vendor_id)
        )
        return result.scalar_one_or_none()

    async def get_by_vendor_user(self, vendor_user_id: UUID) -> Optional[EmployeeProfile]:
        result = await self.db.execute(
            select(EmployeeProfile).where(EmployeeProfile.vendor_user_id == vendor_user_id)
        )
        return result.scalar_one_or_none()

    async def list_without_portal_access(
        self,
        vendor_id: UUID,
        *,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[EmployeeProfile]:
        """Active HR profiles not yet linked to a vendor_user (no Staff Access row)."""
        q = (
            select(EmployeeProfile)
            .where(
                EmployeeProfile.vendor_id == vendor_id,
                EmployeeProfile.vendor_user_id.is_(None),
                EmployeeProfile.is_active.is_(True),
                EmployeeProfile.status != "exited",
            )
            .order_by(EmployeeProfile.full_name, EmployeeProfile.employee_code)
            .limit(limit)
        )
        if search and str(search).strip():
            term = f"%{str(search).strip().lower()}%"
            q = q.where(
                or_(
                    func.lower(EmployeeProfile.full_name).like(term),
                    func.lower(EmployeeProfile.employee_code).like(term),
                    func.lower(EmployeeProfile.personal_email).like(term),
                )
            )
        opts = await self._load_options()
        q = q.options(*opts)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create(self, vendor_id: UUID, data: dict) -> EmployeeProfile:
        store_id = data.get("store_id")
        if store_id:
            # Count employees already tagged to this store to get entity-specific code
            from app.models.store import Store
            store_result = await self.db.execute(
                select(Store).where(Store.id == store_id)
            )
            store = store_result.scalar_one_or_none()
            prefix = (store.code or store.name[:3]).upper() if store else "EMP"
            count_result = await self.db.execute(
                select(func.count()).select_from(EmployeeProfile)
                .where(EmployeeProfile.vendor_id == vendor_id, EmployeeProfile.store_id == store_id)
            )
        else:
            prefix = "EMP"
            count_result = await self.db.execute(
                select(func.count()).select_from(EmployeeProfile).where(EmployeeProfile.vendor_id == vendor_id)
            )
        count = count_result.scalar_one()
        data["employee_code"] = f"{prefix}-{count + 1:03d}"
        emp = EmployeeProfile(vendor_id=vendor_id, **data)
        self.db.add(emp)
        await self.db.flush()
        await self.db.refresh(emp)
        return emp

    async def update(self, emp: EmployeeProfile, data: dict) -> EmployeeProfile:
        for k, v in data.items():
            setattr(emp, k, v)
        await self.db.flush()
        await self.db.refresh(emp)
        return emp


# ─────────────────────── Attendance ─────────────────────────────────────────

class AttendanceRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_today(self, employee_id: UUID, today: date) -> Optional[AttendanceRecord]:
        result = await self.db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == employee_id,
                AttendanceRecord.date == today,
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        vendor_id: UUID,
        *,
        employee_id: Optional[UUID] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[List[AttendanceRecord], int]:
        q = (
            select(AttendanceRecord)
            .join(EmployeeProfile, AttendanceRecord.employee_id == EmployeeProfile.id)
            .where(EmployeeProfile.vendor_id == vendor_id)
            .options(selectinload(AttendanceRecord.employee))
        )
        if employee_id:
            q = q.where(AttendanceRecord.employee_id == employee_id)
        if from_date:
            q = q.where(AttendanceRecord.date >= from_date)
        if to_date:
            q = q.where(AttendanceRecord.date <= to_date)
        if status:
            q = q.where(AttendanceRecord.status == status)

        total_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(total_q)).scalar_one()
        q = q.order_by(AttendanceRecord.date.desc()).offset(skip).limit(limit)
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def upsert(self, employee_id: UUID, att_date: date, data: dict, marked_by: Optional[UUID] = None) -> AttendanceRecord:
        existing = await self.get_today(employee_id, att_date)
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            if marked_by:
                existing.marked_by = marked_by
            await self.db.flush()
            await self.db.refresh(existing)
            return existing
        record = AttendanceRecord(employee_id=employee_id, date=att_date, marked_by=marked_by, **data)
        self.db.add(record)
        await self.db.flush()
        await self.db.refresh(record)
        return record


# ─────────────────────── Leave ──────────────────────────────────────────────

class LeaveRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_policies(self, vendor_id: UUID) -> List[LeavePolicy]:
        result = await self.db.execute(
            select(LeavePolicy)
            .where(LeavePolicy.vendor_id == vendor_id, LeavePolicy.is_active == True)
        )
        return list(result.scalars().all())

    async def get_policy(self, policy_id: UUID, vendor_id: UUID) -> Optional[LeavePolicy]:
        result = await self.db.execute(
            select(LeavePolicy).where(LeavePolicy.id == policy_id, LeavePolicy.vendor_id == vendor_id)
        )
        return result.scalar_one_or_none()

    async def create_policy(self, vendor_id: UUID, data: dict) -> LeavePolicy:
        p = LeavePolicy(vendor_id=vendor_id, **data)
        self.db.add(p)
        await self.db.flush()
        await self.db.refresh(p)
        return p

    async def update_policy(self, p: LeavePolicy, data: dict) -> LeavePolicy:
        for k, v in data.items():
            setattr(p, k, v)
        await self.db.flush()
        await self.db.refresh(p)
        return p

    async def get_balance(self, employee_id: UUID, policy_id: UUID, year: int) -> Optional[LeaveBalance]:
        result = await self.db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_policy_id == policy_id,
                LeaveBalance.year == year,
            )
        )
        return result.scalar_one_or_none()

    async def list_balances(self, employee_id: UUID, year: int) -> List[LeaveBalance]:
        result = await self.db.execute(
            select(LeaveBalance)
            .options(selectinload(LeaveBalance.leave_policy))
            .where(LeaveBalance.employee_id == employee_id, LeaveBalance.year == year)
        )
        return list(result.scalars().all())

    async def create_balance(self, employee_id: UUID, policy_id: UUID, year: int, allocated: float) -> LeaveBalance:
        b = LeaveBalance(employee_id=employee_id, leave_policy_id=policy_id, year=year, allocated=allocated)
        self.db.add(b)
        await self.db.flush()
        await self.db.refresh(b)
        return b

    async def list_requests(
        self,
        vendor_id: UUID,
        *,
        employee_id: Optional[UUID] = None,
        status: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[LeaveRequest], int]:
        q = (
            select(LeaveRequest)
            .join(EmployeeProfile, LeaveRequest.employee_id == EmployeeProfile.id)
            .where(EmployeeProfile.vendor_id == vendor_id)
            .options(
                selectinload(LeaveRequest.employee),
                selectinload(LeaveRequest.leave_policy),
            )
        )
        if employee_id:
            q = q.where(LeaveRequest.employee_id == employee_id)
        if status:
            q = q.where(LeaveRequest.status == status)
        if from_date:
            q = q.where(LeaveRequest.from_date >= from_date)
        if to_date:
            q = q.where(LeaveRequest.to_date <= to_date)
        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.order_by(LeaveRequest.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def get_request(self, req_id: UUID, vendor_id: UUID) -> Optional[LeaveRequest]:
        result = await self.db.execute(
            select(LeaveRequest)
            .join(EmployeeProfile, LeaveRequest.employee_id == EmployeeProfile.id)
            .where(LeaveRequest.id == req_id, EmployeeProfile.vendor_id == vendor_id)
            .options(selectinload(LeaveRequest.employee), selectinload(LeaveRequest.leave_policy))
        )
        return result.scalar_one_or_none()

    async def create_request(self, data: dict) -> LeaveRequest:
        r = LeaveRequest(**data)
        self.db.add(r)
        await self.db.flush()
        await self.db.refresh(r)
        return r

    async def list_holidays(self, vendor_id: UUID, year: int) -> List[Holiday]:
        result = await self.db.execute(
            select(Holiday).where(Holiday.vendor_id == vendor_id, Holiday.year == year).order_by(Holiday.date)
        )
        return list(result.scalars().all())

    async def create_holiday(self, vendor_id: UUID, data: dict) -> Holiday:
        h = Holiday(vendor_id=vendor_id, **data)
        self.db.add(h)
        await self.db.flush()
        await self.db.refresh(h)
        return h

    async def get_holiday(self, holiday_id: UUID, vendor_id: UUID) -> Optional[Holiday]:
        result = await self.db.execute(
            select(Holiday).where(Holiday.id == holiday_id, Holiday.vendor_id == vendor_id)
        )
        return result.scalar_one_or_none()


# ─────────────────────── Salary ──────────────────────────────────────────────

class SalaryRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID, employee_id: Optional[UUID] = None) -> List[SalaryStructure]:
        q = (
            select(SalaryStructure)
            .join(EmployeeProfile, SalaryStructure.employee_id == EmployeeProfile.id)
            .where(EmployeeProfile.vendor_id == vendor_id)
            .options(selectinload(SalaryStructure.employee))
        )
        if employee_id:
            q = q.where(SalaryStructure.employee_id == employee_id)
        result = await self.db.execute(q.order_by(SalaryStructure.effective_from.desc()))
        return list(result.scalars().all())

    async def get(self, struct_id: UUID, vendor_id: UUID) -> Optional[SalaryStructure]:
        result = await self.db.execute(
            select(SalaryStructure)
            .join(EmployeeProfile, SalaryStructure.employee_id == EmployeeProfile.id)
            .where(SalaryStructure.id == struct_id, EmployeeProfile.vendor_id == vendor_id)
        )
        return result.scalar_one_or_none()

    async def get_active(self, employee_id: UUID) -> Optional[SalaryStructure]:
        result = await self.db.execute(
            select(SalaryStructure)
            .where(SalaryStructure.employee_id == employee_id, SalaryStructure.is_active == True)
            .order_by(SalaryStructure.effective_from.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> SalaryStructure:
        # Deactivate existing active structures for this employee
        await self.db.execute(
            update(SalaryStructure)
            .where(SalaryStructure.employee_id == data["employee_id"], SalaryStructure.is_active == True)
            .values(is_active=False)
        )
        s = SalaryStructure(**data)
        self.db.add(s)
        await self.db.flush()
        await self.db.refresh(s)
        return s


# ─────────────────────── Payroll ─────────────────────────────────────────────

class PayrollRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_runs(self, vendor_id: UUID, year: Optional[int] = None) -> List[PayrollRun]:
        q = select(PayrollRun).where(PayrollRun.vendor_id == vendor_id)
        if year:
            q = q.where(PayrollRun.year == year)
        result = await self.db.execute(
            q.order_by(PayrollRun.year.desc(), PayrollRun.month.desc(), PayrollRun.version.desc())
        )
        return list(result.scalars().all())

    async def next_version(self, vendor_id: UUID, month: int, year: int) -> int:
        """Return the next version number for a given vendor/month/year."""
        from sqlalchemy import func as sqlfunc
        result = await self.db.execute(
            select(sqlfunc.max(PayrollRun.version)).where(
                PayrollRun.vendor_id == vendor_id,
                PayrollRun.month == month,
                PayrollRun.year == year,
            )
        )
        max_ver = result.scalar()
        return (max_ver or 0) + 1

    async def delete_run(self, run_id: UUID, vendor_id: UUID) -> bool:
        result = await self.db.execute(
            select(PayrollRun).where(PayrollRun.id == run_id, PayrollRun.vendor_id == vendor_id)
        )
        run = result.scalar_one_or_none()
        if not run:
            return False
        await self.db.delete(run)
        return True

    async def get_run(self, run_id: UUID, vendor_id: UUID) -> Optional[PayrollRun]:
        result = await self.db.execute(
            select(PayrollRun)
            .options(
                selectinload(PayrollRun.entries).selectinload(PayrollEntry.employee),
            )
            .where(PayrollRun.id == run_id, PayrollRun.vendor_id == vendor_id)
        )
        return result.scalar_one_or_none()

    async def create_run(self, vendor_id: UUID, data: dict) -> PayrollRun:
        run = PayrollRun(vendor_id=vendor_id, **data)
        self.db.add(run)
        await self.db.flush()
        await self.db.refresh(run)
        return run

    async def get_entry(self, entry_id: UUID) -> Optional[PayrollEntry]:
        result = await self.db.execute(
            select(PayrollEntry)
            .options(selectinload(PayrollEntry.employee), selectinload(PayrollEntry.payroll_run))
            .where(PayrollEntry.id == entry_id)
        )
        return result.scalar_one_or_none()

    async def list_employee_payslips(self, employee_id: UUID) -> List[PayrollEntry]:
        result = await self.db.execute(
            select(PayrollEntry)
            .options(selectinload(PayrollEntry.payroll_run))
            .where(PayrollEntry.employee_id == employee_id)
            .order_by(PayrollEntry.created_at.desc())
        )
        return list(result.scalars().all())


# ─────────────────────── Offer Letters ───────────────────────────────────────

class OfferLetterTemplateRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _base_query(self):
        return (
            select(OfferLetterTemplate)
            .options(
                selectinload(OfferLetterTemplate.designation),
                selectinload(OfferLetterTemplate.department),
                selectinload(OfferLetterTemplate.store),
            )
        )

    async def list_by_vendor(
        self, vendor_id: UUID,
        designation_id: Optional[UUID] = None,
        department_id:  Optional[UUID] = None,
        store_id:        Optional[UUID] = None,
    ) -> List[OfferLetterTemplate]:
        """Return templates for this vendor. When scope filters are supplied,
        only include rows whose scoped column either matches or is NULL."""
        q = self._base_query().where(OfferLetterTemplate.vendor_id == vendor_id)
        if designation_id is not None:
            q = q.where(
                (OfferLetterTemplate.designation_id == designation_id) |
                (OfferLetterTemplate.designation_id.is_(None))
            )
        if department_id is not None:
            q = q.where(
                (OfferLetterTemplate.department_id == department_id) |
                (OfferLetterTemplate.department_id.is_(None))
            )
        if store_id is not None:
            q = q.where(
                (OfferLetterTemplate.store_id == store_id) |
                (OfferLetterTemplate.store_id.is_(None))
            )
        result = await self.db.execute(q.order_by(OfferLetterTemplate.is_default.desc(), OfferLetterTemplate.name))
        return list(result.scalars().all())

    async def get(self, template_id: UUID, vendor_id: UUID) -> Optional[OfferLetterTemplate]:
        result = await self.db.execute(
            self._base_query().where(
                OfferLetterTemplate.id == template_id,
                OfferLetterTemplate.vendor_id == vendor_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> OfferLetterTemplate:
        tpl = OfferLetterTemplate(vendor_id=vendor_id, **data)
        self.db.add(tpl)
        await self.db.flush()
        await self.db.refresh(tpl)
        return tpl

    async def update(self, tpl: OfferLetterTemplate, data: dict) -> OfferLetterTemplate:
        for k, v in data.items():
            setattr(tpl, k, v)
        await self.db.flush()
        await self.db.refresh(tpl)
        return tpl

    async def delete(self, tpl: OfferLetterTemplate) -> None:
        await self.db.delete(tpl)
        await self.db.flush()

    async def set_default(self, template_id: UUID, vendor_id: UUID) -> OfferLetterTemplate:
        """Clear default on all templates for this vendor, then set it on the target."""
        await self.db.execute(
            update(OfferLetterTemplate)
            .where(OfferLetterTemplate.vendor_id == vendor_id)
            .values(is_default=False)
        )
        tpl = await self.get(template_id, vendor_id)
        if not tpl:
            raise ValueError("Template not found")
        tpl.is_default = True
        await self.db.flush()
        await self.db.refresh(tpl)
        return tpl

    async def find_best_match(
        self, vendor_id: UUID,
        designation_id: Optional[UUID] = None,
        department_id:  Optional[UUID] = None,
        store_id:        Optional[UUID] = None,
    ) -> Optional[OfferLetterTemplate]:
        """Return the most specific template for the given candidate context.
        Score: designation match=4, department match=2, store match=1. Conflicts excluded."""
        candidates = await self.list_by_vendor(vendor_id, designation_id, department_id, store_id)
        if not candidates:
            return None

        def score(t: OfferLetterTemplate) -> int:
            return (
                (4 if t.designation_id == designation_id and designation_id is not None else 0) +
                (2 if t.department_id  == department_id  and department_id  is not None else 0) +
                (1 if t.store_id       == store_id       and store_id        is not None else 0) +
                (0 if not t.is_default else -1)   # default is a tie-breaker, not a boost
            )

        return max(candidates, key=score)


class OfferLetterRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, vendor_id: UUID) -> List[OfferLetter]:
        result = await self.db.execute(
            select(OfferLetter)
            .options(
                selectinload(OfferLetter.designation),
                selectinload(OfferLetter.department),
            )
            .where(OfferLetter.vendor_id == vendor_id)
            .order_by(OfferLetter.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, offer_id: UUID, vendor_id: UUID) -> Optional[OfferLetter]:
        result = await self.db.execute(
            select(OfferLetter)
            .options(
                selectinload(OfferLetter.designation),
                selectinload(OfferLetter.department),
            )
            .where(OfferLetter.id == offer_id, OfferLetter.vendor_id == vendor_id)
        )
        return result.scalar_one_or_none()

    async def create(self, vendor_id: UUID, data: dict) -> OfferLetter:
        offer = OfferLetter(vendor_id=vendor_id, **data)
        self.db.add(offer)
        await self.db.flush()
        await self.db.refresh(offer)
        return offer

    async def update(self, offer: OfferLetter, data: dict) -> OfferLetter:
        for k, v in data.items():
            setattr(offer, k, v)
        await self.db.flush()
        await self.db.refresh(offer)
        return offer

    async def delete(self, offer: OfferLetter) -> None:
        await self.db.delete(offer)
        await self.db.flush()
