#!/usr/bin/env python3
"""
HR Seed Script — creates test data for the Attendance module.

Usage (from backend/):
    python seed_hr.py                              # auto-picks the only vendor, or lists all
    python seed_hr.py --vendor-id <uuid>           # seed into a specific existing vendor
    python seed_hr.py --list-vendors               # show all vendors and their IDs then exit
    python seed_hr.py --days 60                    # seed 60 days of attendance history (default 30)
    python seed_hr.py --clean                      # remove employees/attendance seeded into that vendor

Requires: DATABASE_URL in .env  (postgresql+asyncpg://...)

Re-running ``seed_employees`` resets each seed account password to ``Test@1234`` (same emails as ``EMPLOYEES``), so HR storefront login matches docs even if that user existed before.
"""

import asyncio
import argparse
import datetime
import random
import sys
import uuid
from decimal import Decimal
from passlib.context import CryptContext

# ── bootstrap settings before any app imports ──────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text, select
from app.config import settings
from app.database import Base
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.models.hr import (
    Department, Designation, EmployeeProfile, AttendanceRecord,
)

# ── constants ──────────────────────────────────────────────────────────────────
PWD_CTX = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEFAULT_PASSWORD = "Test@1234"

DEPARTMENTS = [
    {"name": "Engineering",    "code": "ENG"},
    {"name": "Sales",          "code": "SLS"},
    {"name": "Human Resources","code": "HR"},
    {"name": "Finance",        "code": "FIN"},
    {"name": "Operations",     "code": "OPS"},
]

DESIGNATIONS = [
    {"name": "Junior Engineer",       "level": 1},
    {"name": "Senior Engineer",       "level": 3},
    {"name": "Team Lead",             "level": 4},
    {"name": "Sales Executive",       "level": 1},
    {"name": "Sales Manager",         "level": 3},
    {"name": "HR Executive",          "level": 2},
    {"name": "HR Manager",            "level": 3},
    {"name": "Accountant",            "level": 2},
    {"name": "Finance Manager",       "level": 3},
    {"name": "Operations Executive",  "level": 2},
]

EMPLOYEES = [
    {"name": "Aakash Sharma",    "email": "aakash@seed.test",    "phone": "+919800000001", "dept": "Engineering",  "desig": "Senior Engineer",  "gender": "male",   "doj": "2022-06-01"},
    {"name": "Priya Nair",       "email": "priya@seed.test",     "phone": "+919800000002", "dept": "Engineering",  "desig": "Junior Engineer",  "gender": "female", "doj": "2023-02-15"},
    {"name": "Rohit Verma",      "email": "rohit@seed.test",     "phone": "+919800000003", "dept": "Engineering",  "desig": "Team Lead",        "gender": "male",   "doj": "2021-09-10"},
    {"name": "Sunita Menon",     "email": "sunita@seed.test",    "phone": "+919800000004", "dept": "Sales",        "desig": "Sales Manager",    "gender": "female", "doj": "2022-01-20"},
    {"name": "Karan Mehta",      "email": "karan@seed.test",     "phone": "+919800000005", "dept": "Sales",        "desig": "Sales Executive",  "gender": "male",   "doj": "2023-07-01"},
    {"name": "Deepa Iyer",       "email": "deepa@seed.test",     "phone": "+919800000006", "dept": "Human Resources", "desig": "HR Manager",   "gender": "female", "doj": "2021-04-01"},
    {"name": "Manish Gupta",     "email": "manish@seed.test",    "phone": "+919800000007", "dept": "Human Resources", "desig": "HR Executive", "gender": "male",   "doj": "2022-11-05"},
    {"name": "Lakshmi Reddy",    "email": "lakshmi@seed.test",   "phone": "+919800000008", "dept": "Finance",      "desig": "Finance Manager",  "gender": "female", "doj": "2020-08-15"},
    {"name": "Vivek Rao",        "email": "vivek@seed.test",     "phone": "+919800000009", "dept": "Finance",      "desig": "Accountant",       "gender": "male",   "doj": "2023-01-10"},
    {"name": "Anjali Singh",     "email": "anjali@seed.test",    "phone": "+919800000010", "dept": "Operations",   "desig": "Operations Executive","gender":"female","doj": "2022-05-20"},
]

# Weighted distribution of statuses across workdays
WEEKDAY_STATUS_WEIGHTS = [
    ("present",   55),
    ("late",      15),
    ("absent",    10),
    ("half_day",   8),
    ("on_leave",  12),
]
WEEKDAY_STATUSES, WEEKDAY_W = zip(*WEEKDAY_STATUS_WEIGHTS)

APPROVAL_WEIGHTS = [
    ("approved",  60),
    ("pending",   30),
    ("rejected",  10),
]
APPROVAL_STATUSES, APPROVAL_W = zip(*APPROVAL_WEIGHTS)

NOTES_POOL = [
    None, None, None,  # most records have no notes
    "Working from home",
    "Client site visit",
    "Medical appointment in afternoon",
    "Training session",
    "Completed sprint deliverables",
]


def weighted_choice(options, weights):
    return random.choices(options, weights=weights, k=1)[0]


def random_clock(status: str, doj: datetime.date):
    """Return (clock_in, clock_out, work_hours, overtime_hours) for a status."""
    if status in ("absent", "on_leave", "holiday", "week_off"):
        return None, None, None, Decimal("0")

    base_in  = datetime.time(9, random.randint(0, 59))
    if status == "late":
        base_in = datetime.time(random.randint(10, 11), random.randint(0, 59))
    elif status == "half_day":
        base_in = datetime.time(9, random.randint(0, 30))

    base_out_hour = 18 if status != "half_day" else 13
    base_out = datetime.time(base_out_hour, random.randint(0, 59))

    # add occasional OT (after 18:30)
    ot_hours = Decimal("0")
    if status == "present" and random.random() < 0.2:
        extra = random.choice([0.5, 1.0, 1.5, 2.0])
        ot_hours = Decimal(str(extra))
        base_out = datetime.time(base_out_hour + int(extra), random.randint(0, 59))

    today = datetime.date.today()
    dt_in  = datetime.datetime.combine(today, base_in,  tzinfo=datetime.timezone.utc)
    dt_out = datetime.datetime.combine(today, base_out, tzinfo=datetime.timezone.utc)

    diff_hours = (dt_out - dt_in).seconds / 3600
    work_hours = Decimal(str(round(max(diff_hours, 0), 2)))

    return dt_in, dt_out, work_hours, ot_hours


# ── engine ─────────────────────────────────────────────────────────────────────
engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── helpers ────────────────────────────────────────────────────────────────────
async def list_all_vendors(session: AsyncSession) -> list[Vendor]:
    result = await session.execute(select(Vendor).order_by(Vendor.business_name))
    return list(result.scalars().all())


async def pick_vendor(session: AsyncSession, vendor_id_arg: str | None, vendor_slug_arg: str | None) -> Vendor | None:
    """Return the vendor to seed into, or None if ambiguous and user must pick."""
    if vendor_id_arg:
        result = await session.execute(select(Vendor).where(Vendor.id == uuid.UUID(vendor_id_arg)))
        v = result.scalar_one_or_none()
        if not v:
            print(f"[ERROR] Vendor {vendor_id_arg} not found.")
        return v

    if vendor_slug_arg:
        slug = vendor_slug_arg.strip()
        result = await session.execute(select(Vendor).where(Vendor.slug == slug))
        v = result.scalar_one_or_none()
        if not v:
            print(f"[ERROR] No vendor with slug {slug!r}.")
            return None
        print(f"  Selected vendor by slug: {v.business_name}  [{v.id}]")
        return v

    vendors = await list_all_vendors(session)
    if len(vendors) == 0:
        print("[ERROR] No vendors found in the database. Create a vendor first.")
        return None
    if len(vendors) == 1:
        print(f"  Auto-selected vendor: {vendors[0].business_name}  [{vendors[0].id}]")
        return vendors[0]

    # Multiple vendors — print list and ask user to specify
    print("\n[INFO] Multiple vendors found. Re-run with --vendor-id to choose one:\n")
    for v in vendors:
        print(f"  {v.id}   {v.business_name}  ({v.slug})")
    print("\n  Example:  python seed_hr.py --vendor-id " + str(vendors[0].id))
    return None


async def get_or_create_marker(session: AsyncSession, vendor: Vendor) -> VendorUser:
    """Return the owner/admin VendorUser who will be recorded as attendance marker."""
    # Prefer an existing owner or admin on this vendor
    result = await session.execute(
        select(VendorUser).where(
            VendorUser.vendor_id == vendor.id,
            VendorUser.role.in_(["owner", "admin"]),
            VendorUser.is_active == True,
        ).limit(1)
    )
    vu = result.scalar_one_or_none()
    if vu:
        print(f"  ✓ Using existing vendor owner/admin as marker  [{vu.id}]")
        return vu

    # No owner exists yet — create a seed owner user
    result2 = await session.execute(select(User).where(User.email == "owner@seed.test"))
    user = result2.scalar_one_or_none()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email="owner@seed.test",
            phone="+910000000099",
            full_name="Seed Owner",
            password_hash=PWD_CTX.hash(DEFAULT_PASSWORD),
            is_email_verified=True,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        print(f"  + Created seed owner user: {user.email}")

    result3 = await session.execute(
        select(VendorUser).where(VendorUser.vendor_id == vendor.id, VendorUser.user_id == user.id)
    )
    vu = result3.scalar_one_or_none()
    if not vu:
        vu = VendorUser(
            id=uuid.uuid4(),
            vendor_id=vendor.id,
            user_id=user.id,
            role="owner",
            is_active=True,
        )
        session.add(vu)
        await session.flush()
        print(f"  + Created seed VendorUser (owner)")
    return vu


async def seed_departments(session: AsyncSession, vendor_id: uuid.UUID) -> dict[str, Department]:
    dept_map = {}
    for d in DEPARTMENTS:
        result = await session.execute(
            select(Department).where(Department.vendor_id == vendor_id, Department.name == d["name"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            dept_map[d["name"]] = existing
        else:
            dept = Department(id=uuid.uuid4(), vendor_id=vendor_id, **d)
            session.add(dept)
            dept_map[d["name"]] = dept
    await session.flush()
    print(f"  ✓ {len(dept_map)} departments ready")
    return dept_map


async def seed_designations(session: AsyncSession, vendor_id: uuid.UUID) -> dict[str, Designation]:
    desig_map = {}
    for d in DESIGNATIONS:
        result = await session.execute(
            select(Designation).where(Designation.vendor_id == vendor_id, Designation.name == d["name"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            desig_map[d["name"]] = existing
        else:
            desig = Designation(id=uuid.uuid4(), vendor_id=vendor_id, **d)
            session.add(desig)
            desig_map[d["name"]] = desig
    await session.flush()
    print(f"  ✓ {len(desig_map)} designations ready")
    return desig_map


async def seed_employees(
    session: AsyncSession,
    vendor: Vendor,
    marker_vu: VendorUser,
    dept_map: dict,
    desig_map: dict,
) -> list[EmployeeProfile]:
    profiles = []
    for idx, e in enumerate(EMPLOYEES, start=1):
        # Check if user already exists
        result = await session.execute(select(User).where(User.email == e["email"]))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                id=uuid.uuid4(),
                email=e["email"],
                phone=e["phone"],
                full_name=e["name"],
                password_hash=PWD_CTX.hash(DEFAULT_PASSWORD),
                is_email_verified=True,
                is_active=True,
            )
            session.add(user)
            await session.flush()
        else:
            # Same email may already exist (vendor signup, another seed). Force seed password
            # so ``Test@1234`` always works after re-running seed_hr for this vendor.
            user.password_hash = PWD_CTX.hash(DEFAULT_PASSWORD)
            user.is_active = True
            user.full_name = e["name"]
            await session.flush()

        # VendorUser
        result2 = await session.execute(
            select(VendorUser).where(VendorUser.vendor_id == vendor.id, VendorUser.user_id == user.id)
        )
        vu = result2.scalar_one_or_none()
        if not vu:
            vu = VendorUser(
                id=uuid.uuid4(),
                vendor_id=vendor.id,
                user_id=user.id,
                role="staff",
                is_active=True,
                invited_by=marker_vu.user_id,
                accepted_at=datetime.datetime.utcnow(),
            )
            session.add(vu)
            await session.flush()

        # EmployeeProfile
        result3 = await session.execute(
            select(EmployeeProfile).where(EmployeeProfile.vendor_user_id == vu.id)
        )
        emp = result3.scalar_one_or_none()
        if not emp:
            emp = EmployeeProfile(
                id=uuid.uuid4(),
                vendor_id=vendor.id,
                vendor_user_id=vu.id,
                employee_code=f"EMP-{idx:03d}",
                gender=e["gender"],
                department_id=dept_map[e["dept"]].id,
                designation_id=desig_map[e["desig"]].id,
                employment_type="full_time",
                date_of_joining=datetime.date.fromisoformat(e["doj"]),
                status="active",
                nationality="Indian",
            )
            session.add(emp)
            await session.flush()
            print(f"  + Employee: {e['name']}  [{emp.employee_code}]")
        else:
            print(f"  ✓ Employee exists: {e['name']}")

        profiles.append(emp)
    return profiles


async def seed_attendance(
    session: AsyncSession,
    employees: list[EmployeeProfile],
    owner_vu: VendorUser,
    days: int,
):
    today = datetime.date.today()
    created = 0
    skipped = 0

    for emp in employees:
        for delta in range(days, -1, -1):
            att_date = today - datetime.timedelta(days=delta)

            # Skip future
            if att_date > today:
                continue

            weekday = att_date.weekday()  # 0=Mon … 6=Sun

            # Sunday → week_off, Saturday → 50% week_off
            if weekday == 6:
                status = "week_off"
            elif weekday == 5 and random.random() < 0.5:
                status = "week_off"
            else:
                status = weighted_choice(WEEKDAY_STATUSES, WEEKDAY_W)

            approval = weighted_choice(APPROVAL_STATUSES, APPROVAL_W)
            # Week-off and holiday always auto-approved
            if status in ("week_off", "holiday"):
                approval = "approved"

            rejection_reason = None
            if approval == "rejected":
                rejection_reason = random.choice([
                    "Insufficient documentation",
                    "Unapproved absence",
                    "No prior notice given",
                    "Policy violation",
                ])

            ci, co, wh, oth = random_clock(status, emp.date_of_joining)

            # Set clock_in / clock_out relative to the actual date
            if ci is not None:
                ci = ci.replace(
                    year=att_date.year, month=att_date.month, day=att_date.day
                )
            if co is not None:
                co = co.replace(
                    year=att_date.year, month=att_date.month, day=att_date.day
                )

            # Check for duplicate
            result = await session.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.employee_id == emp.id,
                    AttendanceRecord.date == att_date,
                )
            )
            if result.scalar_one_or_none():
                skipped += 1
                continue

            rec = AttendanceRecord(
                id=uuid.uuid4(),
                employee_id=emp.id,
                date=att_date,
                status=status,
                clock_in=ci,
                clock_out=co,
                work_hours=wh,
                overtime_hours=oth,
                notes=random.choice(NOTES_POOL),
                marked_by=owner_vu.id,
                approval_status=approval,
                approved_by=owner_vu.id if approval in ("approved", "rejected") else None,
                approved_at=datetime.datetime.utcnow() if approval in ("approved", "rejected") else None,
                rejection_reason=rejection_reason,
            )
            session.add(rec)
            created += 1

    await session.flush()
    print(f"  + Attendance: {created} records created, {skipped} skipped (already existed)")


async def clean_seed_data(session: AsyncSession, vendor: Vendor):
    """Remove seed employees/attendance from a specific vendor."""
    seed_emails = [e["email"] for e in EMPLOYEES]
    deleted_emps = 0
    for email in seed_emails:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            # Delete vendor_user (cascades to employee_profile and attendance)
            await session.execute(
                text('DELETE FROM vendor_user WHERE vendor_id=:vid AND user_id=:uid'),
                {"vid": str(vendor.id), "uid": str(user.id)}
            )
            # Delete the user only if they have no other vendor memberships
            remaining = await session.execute(
                select(VendorUser).where(VendorUser.user_id == user.id)
            )
            if not remaining.scalar_one_or_none():
                await session.execute(text('DELETE FROM "user" WHERE id=:uid'), {"uid": str(user.id)})
            deleted_emps += 1
    # Remove seed owner user if created by us
    await session.execute(text('DELETE FROM "user" WHERE email=\'owner@seed.test\''))
    print(f"  Removed {deleted_emps} seed employee(s) from vendor '{vendor.business_name}'.")


# ── main ───────────────────────────────────────────────────────────────────────
async def main(vendor_id_arg: str | None, vendor_slug_arg: str | None, days: int, clean: bool, list_vendors: bool):
    async with SessionLocal() as session:
        async with session.begin():

            # --list-vendors: just print and exit
            if list_vendors:
                vendors = await list_all_vendors(session)
                if not vendors:
                    print("No vendors found.")
                else:
                    print(f"\n{'ID':<38}  {'Vendor Name':<35}  Slug")
                    print("-" * 90)
                    for v in vendors:
                        print(f"  {v.id}  {v.business_name:<35}  {v.slug}")
                    print(f"\nRe-run:  python seed_hr.py --vendor-id <ID>  or  --vendor-slug <slug>\n")
                return

            # Resolve vendor
            vendor = await pick_vendor(session, vendor_id_arg, vendor_slug_arg)
            if vendor is None:
                return

            if clean:
                print(f"\n[CLEAN] Removing seed employees from '{vendor.business_name}'...")
                await clean_seed_data(session, vendor)
                return

            print(f"\n[SEED] Seeding HR test data into '{vendor.business_name}'")
            print(f"   Vendor ID : {vendor.id}")
            print(f"   Attendance: last {days} days")
            print(f"   Password  : {DEFAULT_PASSWORD} (all seed accounts)\n")

            # 1. Marker VendorUser (use existing owner, no new vendor created)
            print("── Users ──────────────────────────────────────────────")
            marker_vu = await get_or_create_marker(session, vendor)

            # 2. Departments & Designations
            print("\n── Departments ────────────────────────────────────────")
            dept_map = await seed_departments(session, vendor.id)

            print("\n── Designations ───────────────────────────────────────")
            desig_map = await seed_designations(session, vendor.id)

            # 3. Employees
            print("\n── Employees ──────────────────────────────────────────")
            employees = await seed_employees(session, vendor, marker_vu, dept_map, desig_map)

            # 4. Attendance
            print("\n── Attendance ─────────────────────────────────────────")
            await seed_attendance(session, employees, marker_vu, days)

    print("\n[DONE] Seed complete!")
    print(f"\n   Log into vendor '{vendor.business_name}' and visit HR -> Employees / Attendance")
    print(f"   All seed employee accounts use password: {DEFAULT_PASSWORD}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed HR test data into an existing vendor")
    parser.add_argument("--vendor-id",    help="Target vendor UUID (auto-picks if only one vendor exists)")
    parser.add_argument("--vendor-slug",  help="Target vendor by storefront slug (e.g. test)")
    parser.add_argument("--list-vendors", action="store_true", help="List all vendors and exit")
    parser.add_argument("--days",         type=int, default=30, help="Days of attendance history (default: 30)")
    parser.add_argument("--clean",        action="store_true", help="Remove seed employees from the vendor")
    args = parser.parse_args()

    if args.vendor_id and args.vendor_slug:
        print("Use only one of --vendor-id or --vendor-slug.")
        raise SystemExit(2)
    asyncio.run(main(args.vendor_id, args.vendor_slug, args.days, args.clean, args.list_vendors))
