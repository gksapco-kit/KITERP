"""
Shared test fixtures.

Uses an in-memory SQLite database so tests are self-contained and do not
require a running PostgreSQL instance.
"""

import asyncio
import os
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.database import Base, get_db


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_element, _compiler, **_kw):
    """Allow in-memory SQLite tests to create tables that use PostgreSQL JSONB."""
    return "JSON"
from app.models.user import User
from app.models.vendor import Vendor, VendorOwner
from app.models.vendor_user import VendorUser
from app.models.vendor_product import Product, ProductImage
from app.core.security import get_password_hash, create_access_token
from app.api.deps import get_current_active_user
from app.main import app

# ── SQLite async engine (aiosqlite) ─────────────────────────────

#
# Set ``TEST_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/<name>_test`` to run the suite against a real
# PostgreSQL (row locks, numeric precision and the production DDL path are NOT exercised by SQLite).  The database
# name must contain "test": the schema is dropped and rebuilt at the start of the session.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "").strip()
USE_POSTGRES = TEST_DATABASE_URL.startswith("postgresql")
if USE_POSTGRES and "test" not in TEST_DATABASE_URL.rsplit("/", 1)[-1].lower():
    raise RuntimeError("TEST_DATABASE_URL must point at a database whose name contains 'test' (it is wiped on every run)")

TEST_DB_URL = TEST_DATABASE_URL if USE_POSTGRES else "sqlite+aiosqlite:///:memory:"

if USE_POSTGRES:
    from sqlalchemy.pool import NullPool

    engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
else:
    engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


_pg_schema_ready = False


async def _pg_prepare_schema() -> None:
    """PostgreSQL: build the schema once per session, exactly as production does (create_all + re_* DDL)."""
    global _pg_schema_ready
    if _pg_schema_ready:
        return
    import app.models.realestate  # noqa: F401

    from sqlalchemy import text
    from sqlalchemy.engine import make_url
    from sqlalchemy.pool import NullPool

    # drop_all cannot order the store <-> vendor_user foreign-key cycle and dropping hundreds of tables in one
    # transaction exhausts max_locks_per_transaction, so recreate the (disposable) test database instead.
    url = make_url(TEST_DB_URL)
    admin = create_async_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool)
    async with admin.connect() as conn:
        await conn.execute(text(
            "select pg_terminate_backend(pid) from pg_stat_activity where datname = :d and pid <> pg_backend_pid()"), {"d": url.database})
        await conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}"'))
        await conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    await admin.dispose()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    _pg_schema_ready = True


async def _pg_truncate_all() -> None:
    """Empty only the tables that hold rows (truncating every table at once exhausts the lock table)."""
    from sqlalchemy import text

    async with engine.connect() as conn:
        names = [r[0] for r in (await conn.execute(text("select tablename from pg_tables where schemaname = 'public'"))).all()]
        dirty: list[str] = []
        for i in range(0, len(names), 100):
            chunk = names[i:i + 100]
            probe = " union all ".join(f"select '{n}' where exists (select 1 from \"{n}\")" for n in chunk)
            dirty += [r[0] for r in (await conn.execute(text(probe))).all()]
        await conn.rollback()
    if dirty:
        async with engine.begin() as conn:
            await conn.execute(text("TRUNCATE " + ", ".join(f'"{n}"' for n in dirty) + " RESTART IDENTITY CASCADE"))


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """SQLite: create all tables before each test, drop after.  PostgreSQL: one schema, truncated per test."""
    if USE_POSTGRES:
        await _pg_prepare_schema()
        await _pg_truncate_all()
        yield
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def postgres_only():
    """Skip tests that only mean something against a real PostgreSQL (row locks, concurrency, DDL)."""
    if not USE_POSTGRES:
        pytest.skip("needs TEST_DATABASE_URL pointing at a PostgreSQL test database")


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """A verified, active user for auth."""
    user = User(
        id=uuid.uuid4(),
        email="vendor@test.com",
        full_name="Test Vendor",
        password_hash=get_password_hash("password123"),
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_vendor(db_session: AsyncSession, test_user: User) -> Vendor:
    """A vendor linked to test_user via VendorOwner."""
    vendor = Vendor(
        id=uuid.uuid4(),
        business_name="Test Store",
        display_name="Test Store",
        slug=f"test-store-{uuid.uuid4().hex[:6]}",
        business_type="retail",
        offering_type="products",
        primary_email="store@test.com",
        primary_phone="9876543210",
        subdomain=f"test-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db_session.add(vendor)
    await db_session.flush()

    owner = VendorOwner(
        vendor_id=vendor.id,
        user_id=test_user.id,
        full_name=test_user.full_name,
        email=test_user.email,
        is_primary=True,
    )
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(vendor)
    return vendor


@pytest_asyncio.fixture
async def test_vendor_user(
    db_session: AsyncSession, test_vendor: Vendor, test_user: User
) -> VendorUser:
    """Vendor membership with owner role (full finance / CO permissions)."""
    vu = VendorUser(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        user_id=test_user.id,
        role="owner",
        permissions=[],
        is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    await db_session.refresh(vu)
    return vu


@pytest_asyncio.fixture
async def test_product(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    """A pre-existing product for read/update/delete tests."""
    product = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Existing Product",
        slug="existing-product",
        price=999.00,
        currency="INR",
        status="active",
        product_type="physical",
        quantity=50,
        created_by=test_user.id,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest_asyncio.fixture
async def auth_token(test_user: User) -> str:
    """JWT access token for test_user."""
    return create_access_token({"sub": str(test_user.id)})


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, test_user: User) -> AsyncGenerator[AsyncClient, None]:
    """
    HTTPX AsyncClient hitting the real FastAPI app with dependency overrides:
    - get_db → test SQLite session
    - get_current_active_user → test_user (skip JWT validation)
    """
    async def _override_db():
        yield db_session

    async def _override_user():
        return test_user

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_active_user] = _override_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
