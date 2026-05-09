"""Storefront employee HR: login (X-Vendor-Slug), JWT, /me, ESS profile."""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.models.hr import EmployeeProfile
from app.core.security import get_password_hash

HR_SLUG = "hr-e2e-store"
HR_EMAIL = "hr.e2e@test.local"
HR_PASSWORD = "HrE2E_Test_9"


@pytest_asyncio.fixture
async def hr_vendor_and_employee(db_session):
    """Approved vendor (slug) + staff user + employee profile for store HR login."""
    vendor = Vendor(
        id=uuid.uuid4(),
        business_name="HR E2E Store",
        display_name="HR E2E Store",
        slug=HR_SLUG,
        business_type="retail",
        offering_type="both",
        primary_email="store-hr-e2e@test.com",
        primary_phone="9876543210",
        subdomain=f"hr-e2e-{uuid.uuid4().hex[:8]}",
        status="approved",
    )
    db_session.add(vendor)
    await db_session.flush()

    emp_user = User(
        id=uuid.uuid4(),
        email=HR_EMAIL,
        full_name="HR E2E Employee",
        password_hash=get_password_hash(HR_PASSWORD),
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(emp_user)
    await db_session.flush()

    vu = VendorUser(
        id=uuid.uuid4(),
        vendor_id=vendor.id,
        user_id=emp_user.id,
        role="staff",
        is_active=True,
    )
    db_session.add(vu)
    await db_session.flush()

    emp = EmployeeProfile(
        id=uuid.uuid4(),
        vendor_id=vendor.id,
        vendor_user_id=vu.id,
        employee_code="E2E-001",
        status="active",
    )
    db_session.add(emp)
    await db_session.commit()
    await db_session.refresh(vendor)
    return vendor, emp_user, vu, emp


@pytest_asyncio.fixture
async def store_hr_client(db_session, hr_vendor_and_employee):
    """ASGI client with DB override only (real JWT from login)."""

    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_store_hr_login_success(store_hr_client: AsyncClient):
    r = await store_hr_client.post(
        "/api/v1/store/hr/login",
        json={"login": HR_EMAIL, "password": HR_PASSWORD},
        headers={"X-Vendor-Slug": HR_SLUG},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("access_token")
    assert body.get("employee", {}).get("email") == HR_EMAIL


@pytest.mark.asyncio
async def test_store_hr_login_wrong_password(store_hr_client: AsyncClient):
    r = await store_hr_client.post(
        "/api/v1/store/hr/login",
        json={"login": HR_EMAIL, "password": "wrong-password"},
        headers={"X-Vendor-Slug": HR_SLUG},
    )
    assert r.status_code == 401
    assert "Invalid password" in (r.json().get("detail") or "")


@pytest.mark.asyncio
async def test_store_hr_login_unknown_email(store_hr_client: AsyncClient):
    r = await store_hr_client.post(
        "/api/v1/store/hr/login",
        json={"login": "nobody@example.com", "password": "x"},
        headers={"X-Vendor-Slug": HR_SLUG},
    )
    assert r.status_code == 401
    assert "No employee profile" in (r.json().get("detail") or "")


@pytest.mark.asyncio
async def test_store_hr_login_missing_vendor_header(store_hr_client: AsyncClient):
    r = await store_hr_client.post(
        "/api/v1/store/hr/login",
        json={"login": HR_EMAIL, "password": HR_PASSWORD},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_store_hr_me_and_ess_profile(store_hr_client: AsyncClient):
    login = await store_hr_client.post(
        "/api/v1/store/hr/login",
        json={"login": HR_EMAIL, "password": HR_PASSWORD},
        headers={"X-Vendor-Slug": HR_SLUG},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = await store_hr_client.get(
        "/api/v1/store/hr/me",
        headers={"Authorization": f"Bearer {token}", "X-Vendor-Slug": HR_SLUG},
    )
    assert me.status_code == 200, me.text
    assert me.json().get("email") == HR_EMAIL

    prof = await store_hr_client.get(
        "/api/v1/store/hr/ess/profile",
        headers={"Authorization": f"Bearer {token}", "X-Vendor-Slug": HR_SLUG},
    )
    assert prof.status_code == 200, prof.text
    data = prof.json()
    assert data.get("employee") is not None
    assert data["employee"].get("employee_code") == "E2E-001"


@pytest.mark.asyncio
async def test_store_hr_vendor_active_status_allowed(store_hr_client: AsyncClient, db_session, hr_vendor_and_employee):
    """``active`` vendors resolve like catalog (legacy rows)."""
    vendor, *_ = hr_vendor_and_employee
    vendor.status = "active"
    await db_session.commit()

    r = await store_hr_client.post(
        "/api/v1/store/hr/login",
        json={"login": HR_EMAIL, "password": HR_PASSWORD},
        headers={"X-Vendor-Slug": HR_SLUG},
    )
    assert r.status_code == 200, r.text
