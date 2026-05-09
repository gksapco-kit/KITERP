"""
Shared test fixtures.

Uses an in-memory SQLite database so tests are self-contained and do not
require a running PostgreSQL instance.
"""

import asyncio
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

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


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
