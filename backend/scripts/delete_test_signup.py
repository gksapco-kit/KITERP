#!/usr/bin/env python3
"""Remove a test vendor signup so the same email/phone can register again.

Usage (on EC2 / Docker):
  docker compose --env-file .env.config -f docker-compose.prod.yml exec backend \
    python scripts/delete_test_signup.py --email ravikumardakavarapu7866@gmail.com

  docker compose exec backend python scripts/delete_test_signup.py --email test@example.com

Dry run (no deletes):
  python scripts/delete_test_signup.py --email test@example.com --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.repositories.user_repo import UserRepository
from app.services.user_cleanup import delete_user_if_orphan, remove_orphan_users_by_email, remove_orphan_users_by_phone
from app.services.vendor_service import VendorService


async def run(email: str | None, phone: str | None, dry_run: bool) -> int:
    if not email and not phone:
        print("Provide --email and/or --phone")
        return 1

    async with AsyncSessionLocal() as db:
        repo = UserRepository(db)
        users: list[User] = []
        if email:
            users.extend(await repo.list_users_by_email_ci(email))
        if phone:
            for u in await repo.list_users_by_phone(phone):
                if u not in users:
                    users.append(u)

        if not users:
            print("No users found for the given email/phone.")
            if not dry_run:
                removed = 0
                if email:
                    removed += await remove_orphan_users_by_email(db, email)
                if phone:
                    removed += await remove_orphan_users_by_phone(db, phone)
                if removed:
                    await db.commit()
                    print(f"Removed {removed} orphan user row(s) with no vendor membership.")
            return 0

        admin = await db.scalar(select(User).where(User.is_superuser.is_(True)).limit(1))
        if not admin and not dry_run:
            print("ERROR: No superuser in DB — cannot call delete_vendor. Create a superuser first.")
            return 1

        svc = VendorService(db)
        deleted_vendors = 0
        deleted_users = 0

        for user in users:
            print(f"User {user.id} | email={user.email!r} | phone={user.phone!r}")
            vu_rows = await db.execute(
                select(VendorUser.vendor_id).where(VendorUser.user_id == user.id),
            )
            vendor_ids = list({row[0] for row in vu_rows.all()})

            for vid in vendor_ids:
                if dry_run:
                    print(f"  [dry-run] would delete vendor {vid}")
                    continue
                try:
                    await svc.delete_vendor(vid, admin.id)
                    deleted_vendors += 1
                    print(f"  Deleted vendor {vid}")
                except Exception as exc:
                    print(f"  FAILED vendor {vid}: {exc}")
                    await db.rollback()
                    return 1

            remaining_vu = await db.scalar(
                select(func.count()).select_from(VendorUser).where(VendorUser.user_id == user.id),
            )
            if remaining_vu:
                print(f"  User still linked to {remaining_vu} vendor(s) — not deleting user row.")
                continue

            if user.is_superuser or user.platform_staff_role:
                print("  Skipping platform/superuser account.")
                continue

            if dry_run:
                print(f"  [dry-run] would delete user {user.id}")
            else:
                if await delete_user_if_orphan(db, user, force=True):
                    deleted_users += 1
                    print(f"  Deleted user {user.id}")
                else:
                    print(f"  Could not delete user {user.id} (still linked or platform account).")

        if not dry_run:
            await db.commit()

        print(
            f"Done. vendors_removed={deleted_vendors}, users_removed={deleted_users}"
            + (" (dry-run)" if dry_run else ""),
        )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Delete test signup by email or phone")
    parser.add_argument("--email", help="Contact email to remove")
    parser.add_argument("--phone", help="Phone in E.164 form, e.g. +919876543210")
    parser.add_argument("--dry-run", action="store_true", help="List what would be deleted")
    args = parser.parse_args()
    return asyncio.run(run(args.email, args.phone, args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
