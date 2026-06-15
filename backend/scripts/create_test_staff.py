"""Create a demo staff user on vendor slug=test for local testing."""
import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser

STAFF_EMAIL = "staff@kiterp.com"
STAFF_PASSWORD = "Staff@123"
STAFF_NAME = "Demo Staff"
VENDOR_SLUG = "test"


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as db:
        vendor = (
            await db.execute(select(Vendor).where(Vendor.slug == VENDOR_SLUG))
        ).scalar_one_or_none()
        if not vendor:
            print(f"ERROR: vendor slug={VENDOR_SLUG!r} not found. Run setup_vendor.py first.")
            await engine.dispose()
            return

        owner_vu = (
            await db.execute(
                select(VendorUser).where(
                    VendorUser.vendor_id == vendor.id,
                    VendorUser.role == "owner",
                )
            )
        ).scalar_one_or_none()

        user = (
            await db.execute(select(User).where(User.email == STAFF_EMAIL))
        ).scalar_one_or_none()
        if not user:
            user = User(
                email=STAFF_EMAIL,
                full_name=STAFF_NAME,
                password_hash=get_password_hash(STAFF_PASSWORD),
                is_active=True,
                is_email_verified=True,
                is_phone_verified=False,
            )
            db.add(user)
            await db.flush()
            print(f"Created user {STAFF_EMAIL}")
        else:
            user.password_hash = get_password_hash(STAFF_PASSWORD)
            user.is_active = True
            user.is_email_verified = True
            user.full_name = STAFF_NAME
            print(f"Updated user {STAFF_EMAIL}")

        vu = (
            await db.execute(
                select(VendorUser).where(
                    VendorUser.vendor_id == vendor.id,
                    VendorUser.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if not vu:
            vu = VendorUser(
                vendor_id=vendor.id,
                user_id=user.id,
                role="staff",
                is_active=True,
                invited_by=owner_vu.user_id if owner_vu else user.id,
                invited_at=datetime.now(timezone.utc),
            )
            db.add(vu)
            print("Linked staff to vendor")
        else:
            vu.role = "staff"
            vu.is_active = True
            print("Updated vendor membership to staff")

        await db.commit()

    await engine.dispose()
    print("=" * 50)
    print("Staff user ready")
    print("=" * 50)
    print(f"Vendor:   {VENDOR_SLUG} (Demo Store)")
    print(f"Email:    {STAFF_EMAIL}")
    print(f"Password: {STAFF_PASSWORD}")
    print(f"Role:     staff")
    print("Login:    http://127.0.0.1:3001/login")
    print("Table Data menu: hidden (staff cannot see it)")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
