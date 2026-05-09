# prune_platform_admins.py
"""Leave exactly one platform super-admin (default: admin@kiterp.com).

Demotes **all other** ``is_superuser`` and ``platform_staff_role`` accounts so only the
kept email can sign in at the super-admin app (``/auth/login/platform``).

Does **not** delete user rows (they may still be vendor team members).

Run against the same DB as the API::

    docker compose exec backend python prune_platform_admins.py
    docker compose exec backend python prune_platform_admins.py --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
from typing import List

from sqlalchemy import func as sqlfunc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.user import User


async def prune_platform_admins(*, keep_email: str, dry_run: bool) -> None:
    keep_norm = keep_email.strip().lower()
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # ── Users with platform access (superuser or support staff) ──────────
        plat_stmt = select(User).where(
            or_(User.is_superuser.is_(True), User.platform_staff_role.isnot(None))
        )
        plat_result = await session.execute(plat_stmt)
        platform_users: List[User] = list(plat_result.scalars().all())

        demoted_other_email: List[str] = []
        demoted_keep_dupe: List[str] = []

        for u in platform_users:
            email_norm = (u.email or "").strip().lower()
            if email_norm != keep_norm:
                demoted_other_email.append(f"{u.id} email={u.email!r}")
                u.is_superuser = False
                u.platform_staff_role = None

        # ── Same email: keep a single superuser row ─────────────────────────
        dup_stmt = select(User).where(sqlfunc.lower(User.email) == keep_norm).order_by(User.id.asc())
        dup_result = await session.execute(dup_stmt)
        dupes: List[User] = list(dup_result.scalars().all())

        keeper: User | None = None
        if dupes:
            keeper = next((u for u in dupes if u.is_superuser), dupes[0])
            for u in dupes:
                if keeper and u.id == keeper.id:
                    u.is_superuser = True
                    u.platform_staff_role = None
                else:
                    if u.is_superuser or u.platform_staff_role:
                        demoted_keep_dupe.append(str(u.id))
                    u.is_superuser = False
                    u.platform_staff_role = None

        if dry_run:
            await session.rollback()
            print("[dry-run] Rolled back — no changes saved.")
        else:
            await session.commit()

        print("=" * 56)
        print(f"Keep platform superuser email: {keep_email!r}")
        print(f"Demoted platform access (other emails): {len(demoted_other_email)}")
        for line in demoted_other_email[:50]:
            print(f"  - {line}")
        if len(demoted_other_email) > 50:
            print(f"  ... and {len(demoted_other_email) - 50} more")

        print(f"Demoted duplicate rows for same email (extra UUIDs): {len(demoted_keep_dupe)}")
        for uid in demoted_keep_dupe[:20]:
            print(f"  - {uid}")
        if len(demoted_keep_dupe) > 20:
            print(f"  ... and {len(demoted_keep_dupe) - 20} more")

        if keeper:
            print(f"Canonical superuser row id: {keeper.id}")
        else:
            print("WARNING: No user row with that email — run create_admin.py first.")

        print("=" * 56)

    await engine.dispose()


def main() -> None:
    p = argparse.ArgumentParser(description="Demote all platform admins except one email.")
    p.add_argument(
        "--keep-email",
        default="admin@kiterp.com",
        help="Email that remains is_superuser (default: admin@kiterp.com)",
    )
    p.add_argument("--dry-run", action="store_true", help="Show actions but rollback")
    args = p.parse_args()
    asyncio.run(prune_platform_admins(keep_email=args.keep_email, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
