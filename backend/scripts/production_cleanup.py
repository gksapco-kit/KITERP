"""Audit (and optionally repair) production data for every vendor.

Dry run by default:

    python -m scripts.production_cleanup                    # report only
    python -m scripts.production_cleanup --vendor <uuid>    # one vendor
    python -m scripts.production_cleanup --apply            # release stale reservations

Only unambiguous corrections are applied (reservations held by orders that no longer hold
materials). Stock/ledger mismatches are listed for a person to review: fixing them can touch stock
that has since moved, so they are never changed automatically.

Run from the ``backend`` directory with the same environment (DATABASE_URL) as the API.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from collections import Counter
from uuid import UUID

from app.database import AsyncSessionLocal
from app.services.production_reconcile import find_issues, repair_safe_issues
from app.services.production_scheduler import vendor_ids


async def run(only_vendor: UUID | None, apply: bool) -> int:
    async with AsyncSessionLocal() as db:
        ids = [only_vendor] if only_vendor else await vendor_ids(db)

    total_errors = 0
    for vid in ids:
        async with AsyncSessionLocal() as db:
            issues = await find_issues(db, vid)
            by_code = Counter(i["code"] for i in issues)
            errors = sum(1 for i in issues if i["severity"] == "error")
            total_errors += errors
            print(f"\nvendor {vid}: {len(issues)} issue(s), {errors} error(s)")
            for code, n in sorted(by_code.items()):
                print(f"  {code}: {n}")
            for i in issues:
                if i["severity"] == "error":
                    print(f"    - {i['ref'] or i['order_id']}: {i['detail']}")
            if apply and any(i["fixable"] for i in issues):
                res = await repair_safe_issues(db, vid)
                await db.commit()
                print(f"  repaired: {res}")
    print(f"\n{'Applied' if apply else 'Dry run'} - {total_errors} error-level issue(s) across {len(ids)} vendor(s).")
    return 1 if total_errors else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--vendor", type=UUID, help="limit to one vendor id")
    parser.add_argument("--apply", action="store_true", help="release stale reservations (default is report only)")
    args = parser.parse_args()
    sys.exit(asyncio.run(run(args.vendor, args.apply)))


if __name__ == "__main__":
    main()
