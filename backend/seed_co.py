#!/usr/bin/env python3
"""
Seed Controlling (CO) demo data for an existing vendor.

  python seed_co.py                    # first vendor + its owner user
  python seed_co.py --vendor-id <uuid> # specific tenant

Requires DATABASE_URL (same as the API). Run finance COA seed first if the tenant
has no chart of accounts (this script calls the same coa_seeder helpers).
"""
from __future__ import annotations

import argparse
import asyncio
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.vendor import Vendor
from app.models.vendor_owner import VendorOwner
from app.services.controlling.seed_demo import seed_co_demo_data


async def _main() -> None:
    p = argparse.ArgumentParser(description="Seed CO demo manufacturing / costing data")
    p.add_argument("--vendor-id", type=str, default=None, help="Vendor UUID")
    p.add_argument(
        "--order-no",
        type=str,
        default="CO-DEMO-001",
        help="Manufacturing order number (default CO-DEMO-001)",
    )
    p.add_argument(
        "--force",
        action="store_true",
        help="Create a new order even if order-no already exists (uses unique suffix)",
    )
    args = p.parse_args()

    async with AsyncSessionLocal() as db:
        if args.vendor_id:
            vid = uuid.UUID(args.vendor_id)
        else:
            r = await db.execute(select(Vendor).limit(1))
            v = r.scalar_one_or_none()
            if not v:
                print("No vendor in database. Create a vendor or pass --vendor-id.")
                return
            vid = v.id
            print(f"Using vendor {vid}")

        r_own = await db.execute(
            select(VendorOwner).where(VendorOwner.vendor_id == vid, VendorOwner.is_primary.is_(True)).limit(1)
        )
        owner = r_own.scalar_one_or_none()
        if not owner:
            r_own2 = await db.execute(select(VendorOwner).where(VendorOwner.vendor_id == vid).limit(1))
            owner = r_own2.scalar_one_or_none()
        if not owner:
            print(f"No VendorOwner for vendor {vid}; cannot set product.created_by.")
            return

        order_no = args.order_no
        if args.force:
            order_no = f"{args.order_no}-{uuid.uuid4().hex[:6].upper()}"

        summary = await seed_co_demo_data(
            db,
            vid,
            owner.user_id,
            demo_order_no=order_no,
            skip_if_order_exists=not args.force,
        )
        await db.commit()
        print(summary)


if __name__ == "__main__":
    asyncio.run(_main())
