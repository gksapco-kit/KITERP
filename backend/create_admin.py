# create_admin.py
"""Script to create (or reset) a platform super-admin user.

Uses ``DATABASE_URL`` from the environment (``backend/.env`` on the host, or the vars set in Docker Compose).

If ``http://localhost:8000`` is served by ``docker compose`` (container ``backend``), run this **inside**
that container so you update the same Postgres DB as the API::

    docker compose exec backend python create_admin.py --email admin@kiterp.com --password Admin@123

Running ``python create_admin.py`` only on the host while the API runs in Docker seeds a different database,
so platform login at localhost:3000 will keep failing with "incorrect password".
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func as sqlfunc
from app.config import settings
from app.models.user import User
from app.core.security import get_password_hash


async def create_admin_user(email: str, password: str, full_name: str = "Admin User"):
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        norm = str(email).strip().lower()
        result = await session.execute(select(User).where(sqlfunc.lower(User.email) == norm))
        matches = list(result.scalars().all())

        if matches:
            # Prefer an existing superuser row if duplicates share this email.
            existing_user = next((u for u in matches if u.is_superuser), matches[0])
            if len(matches) > 1:
                print(
                    f"Warning: {len(matches)} user rows share email {email!r}; "
                    f"updating user id {existing_user.id} (superuser first if any)."
                )
            existing_user.password_hash = get_password_hash(password)
            existing_user.is_superuser = True
            existing_user.platform_staff_role = None
            existing_user.is_active = True
            existing_user.is_email_verified = True
            if full_name and not (existing_user.full_name or "").strip():
                existing_user.full_name = full_name
            await session.commit()
            await session.refresh(existing_user)

            print("=" * 50)
            print("Admin user updated (password reset + superuser)")
            print("=" * 50)
            print(f"Email:    {email}")
            print(f"Password: {password}")
            print(f"User ID:  {existing_user.id}")
            print("=" * 50)
            await engine.dispose()
            return

        admin_user = User(
            email=email.strip(),
            password_hash=get_password_hash(password),
            full_name=full_name,
            is_active=True,
            is_superuser=True,
            platform_staff_role=None,
            is_email_verified=True,
        )

        session.add(admin_user)
        await session.commit()
        await session.refresh(admin_user)

        print("=" * 50)
        print("Admin user created successfully!")
        print("=" * 50)
        print(f"Email:    {email}")
        print(f"Password: {password}")
        print(f"User ID:  {admin_user.id}")
        print("=" * 50)

    await engine.dispose()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Create or reset a platform super-admin (password + is_superuser).",
    )
    parser.add_argument(
        "--email",
        default="admin@kiterp.com",
        help="Admin login email (default: admin@kiterp.com)",
    )
    parser.add_argument(
        "--password",
        default="Admin@123",
        help="Admin password (default: Admin@123)",
    )
    parser.add_argument("--name", default="Super Admin", dest="full_name", help="Display name")
    args = parser.parse_args()

    print(f"\nCreating/updating admin user: {args.email}")
    asyncio.run(create_admin_user(args.email, args.password, args.full_name))
