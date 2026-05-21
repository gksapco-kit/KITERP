#!/usr/bin/env python3
"""
Create a single Employee HR / ESS test account on an existing vendor (by slug).

Use after ``python setup_vendor.py`` (or any approved/active vendor). Then sign in at:
  http://localhost:3002/store/<slug>/hr/login

Usage (from backend/):
    python seed_dev_hr_employee.py
    python seed_dev_hr_employee.py --slug my-vendor
    python seed_dev_hr_employee.py --slug gvkrishna-store --email gvkrishna.fico@gmail.com --password Test@1234
    python seed_dev_hr_employee.py --email me@test.local --password 'MyPass1!'
"""
from __future__ import annotations

import argparse
import asyncio
import datetime
import uuid

from dotenv import load_dotenv

load_dotenv()

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.models.hr import EmployeeProfile

PWD_CTX = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEFAULT_EMAIL = "hr.worker@dev.kiterp"
DEFAULT_PASSWORD = "DevHR2024!"
DEFAULT_SLUG = "test"


async def ensure_dev_employee(
    session: AsyncSession,
    *,
    vendor_slug: str,
    email: str,
    password: str,
) -> tuple[Vendor, EmployeeProfile]:
    r = await session.execute(select(Vendor).where(Vendor.slug == vendor_slug))
    vendor = r.scalar_one_or_none()
    if not vendor:
        raise SystemExit(f"No vendor with slug {vendor_slug!r}. Create one first (e.g. setup_vendor.py).")

    r2 = await session.execute(select(User).where(User.email == email))
    user = r2.scalar_one_or_none()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            phone="+910000000001",
            full_name="Dev HR Worker",
            password_hash=PWD_CTX.hash(password),
            is_email_verified=True,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        print(f"  + User {email}")
    else:
        user.password_hash = PWD_CTX.hash(password)
        user.is_active = True
        await session.flush()
        print(f"  ✓ User exists, password reset: {email}")

    r3 = await session.execute(
        select(VendorUser).where(VendorUser.vendor_id == vendor.id, VendorUser.user_id == user.id)
    )
    vu = r3.scalar_one_or_none()
    if not vu:
        vu = VendorUser(
            id=uuid.uuid4(),
            vendor_id=vendor.id,
            user_id=user.id,
            role="staff",
            is_active=True,
            accepted_at=datetime.datetime.utcnow(),
        )
        session.add(vu)
        await session.flush()
        print(f"  + VendorUser (staff) for vendor {vendor.business_name}")
    else:
        vu.is_active = True
        await session.flush()
        print(f"  ✓ VendorUser already linked")

    r4 = await session.execute(select(EmployeeProfile).where(EmployeeProfile.vendor_user_id == vu.id))
    emp = r4.scalar_one_or_none()
    if not emp:
        emp = EmployeeProfile(
            id=uuid.uuid4(),
            vendor_id=vendor.id,
            vendor_user_id=vu.id,
            employee_code="DEV-HR-001",
            gender="other",
            employment_type="full_time",
            date_of_joining=datetime.date.today(),
            status="active",
            nationality="Indian",
        )
        session.add(emp)
        await session.flush()
        print(f"  + EmployeeProfile {emp.employee_code}")
    else:
        emp.status = "active"
        emp.is_active = True
        await session.flush()
        print(f"  ✓ EmployeeProfile exists ({emp.employee_code})")

    return vendor, emp


async def main():
    p = argparse.ArgumentParser(description="Seed one ESS / business front HR employee for local testing")
    p.add_argument("--slug", default=DEFAULT_SLUG, help=f"Vendor slug (default: {DEFAULT_SLUG})")
    p.add_argument("--email", default=DEFAULT_EMAIL, help="Login email")
    p.add_argument("--password", default=DEFAULT_PASSWORD, help="Login password")
    args = p.parse_args()

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        async with session.begin():
            vendor, _emp = await ensure_dev_employee(
                session,
                vendor_slug=args.slug.strip(),
                email=args.email.strip(),
                password=args.password,
            )

    await engine.dispose()

    print()
    print("  Business Front HR login (default dev stack):")
    print(f"    URL:      http://localhost:3002/store/{vendor.slug}/hr/login")
    print(f"    Email:    {args.email}")
    print(f"    Password: {args.password}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
