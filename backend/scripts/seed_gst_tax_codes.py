"""
Backfill: seed default GST tax codes for all existing vendors that have none.

Safe to re-run — the seeder is idempotent (skips codes already present).

Usage:
    cd backend
    python scripts/seed_gst_tax_codes.py [--vendor-id <uuid>] [--dry-run]

Without --vendor-id, processes every vendor in the database.
"""
import asyncio
import argparse
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.vendor import Vendor
from app.models.finance import FinTaxCode
from app.services.finance.coa_seeder import seed_default_tax_codes


async def main(vendor_id_str: str | None, dry_run: bool) -> None:
    mode = "DRY-RUN" if dry_run else "LIVE"
    print(f"\n{'=' * 55}")
    print(f"  GST Tax Code Backfill  [{mode}]")
    print(f"{'=' * 55}\n")

    async with AsyncSessionLocal() as db:
        q = select(Vendor)
        if vendor_id_str:
            q = q.where(Vendor.id == UUID(vendor_id_str))
        vendors = (await db.execute(q)).scalars().all()

        total = 0
        seeded = 0

        for vendor in vendors:
            total += 1
            existing = (
                await db.execute(
                    select(FinTaxCode.code).where(FinTaxCode.vendor_id == vendor.id)
                )
            ).scalars().all()

            if existing:
                print(f"  SKIP  {vendor.business_name or vendor.id}  (has {len(existing)} code(s): {', '.join(existing)})")
                continue

            print(f"  SEED  {vendor.business_name or vendor.id}")
            if not dry_run:
                created = await seed_default_tax_codes(db, vendor.id)
                for tc in created:
                    print(f"    + {tc.code}  {tc.name}  ({tc.tax_type} {tc.rate}%)")
            else:
                print(f"    (would seed GST0 / GST5 / GST12 / GST18 / GST28)")
            seeded += 1

        if not dry_run:
            await db.commit()

    print(f"\n  Done.  Vendors={total}  Seeded={seeded}  Skipped={total - seeded}")
    if dry_run:
        print("  No changes written (--dry-run mode).")
    print("=" * 55 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed default GST tax codes for vendors")
    parser.add_argument("--vendor-id", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.vendor_id, args.dry_run))
