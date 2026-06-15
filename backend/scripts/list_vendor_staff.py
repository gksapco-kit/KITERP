"""List vendor team users for local dev (emails + roles)."""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload

from app.config import settings
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as db:
        vendors = (await db.execute(select(Vendor).order_by(Vendor.created_at))).scalars().all()
        print(f"Vendors: {len(vendors)}")
        for v in vendors:
            print(f"\n--- {v.display_name or v.business_name} (slug={v.slug}, id={v.id}) status={v.status} ---")
            q = (
                select(VendorUser)
                .where(VendorUser.vendor_id == v.id)
                .options(selectinload(VendorUser.user), selectinload(VendorUser.custom_role))
            )
            rows = (await db.execute(q)).scalars().all()
            if not rows:
                print("  (no team members)")
            for vu in rows:
                u = vu.user
                email = u.email if u else "?"
                name = u.full_name if u else "?"
                role = vu.role or "member"
                role_name = vu.custom_role.name if vu.custom_role else None
                print(f"  {email!r} | {name!r} | role={role!r} | custom_role={role_name!r}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
