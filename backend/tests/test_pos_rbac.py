"""
POS role-based access control enforcement.

The POS write routes are guarded by ``require_permission("pos.manage")``. These
tests prove the guard is wired correctly:
- A role WITHOUT ``pos.manage`` (e.g. technician / delivery_staff / staff) is 403.
- A role WITH ``pos.manage`` (e.g. cashier) is allowed through to the handler.

We override ``get_current_vendor_user`` so the role under test is deterministic,
exercising the real ``require_permission`` / ``get_effective_permissions`` logic.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.api.deps import get_current_vendor_user
from app.main import app
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser

SESSIONS_OPEN = "/api/v1/vendors/me/pos/sessions/open"


def _as_role(vendor_id, user_id, role: str):
    """Return a transient VendorUser with the given system role."""
    return VendorUser(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        user_id=user_id,
        role=role,
        permissions=[],
        is_active=True,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["technician", "delivery_staff", "staff", "support"])
async def test_pos_manage_denied_for_roles_without_permission(
    client: AsyncClient, test_vendor: Vendor, test_user, role
):
    app.dependency_overrides[get_current_vendor_user] = lambda: _as_role(
        test_vendor.id, test_user.id, role
    )
    try:
        resp = await client.post(SESSIONS_OPEN, json={"opening_cash": 0})
        assert resp.status_code == 403, f"{role} should be denied pos.manage"
        assert "pos.manage" in resp.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_vendor_user, None)


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["cashier", "manager", "owner", "admin", "sales"])
async def test_pos_manage_allowed_for_roles_with_permission(
    client: AsyncClient, test_vendor: Vendor, test_user, role
):
    app.dependency_overrides[get_current_vendor_user] = lambda: _as_role(
        test_vendor.id, test_user.id, role
    )
    try:
        resp = await client.post(SESSIONS_OPEN, json={"opening_cash": 100})
        # Must NOT be blocked by RBAC; the handler should open the session.
        assert resp.status_code != 403, f"{role} should be allowed pos.manage"
        assert resp.status_code == 201
        assert resp.json()["status"] == "open"
    finally:
        app.dependency_overrides.pop(get_current_vendor_user, None)


@pytest.mark.asyncio
async def test_per_user_permission_override_grants_access(
    client: AsyncClient, test_vendor: Vendor, test_user
):
    """A staff member with an explicit pos.manage override is allowed."""
    vu = VendorUser(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        user_id=test_user.id,
        role="staff",
        permissions=["pos.manage"],  # per-user grant on top of the role
        is_active=True,
    )
    app.dependency_overrides[get_current_vendor_user] = lambda: vu
    try:
        resp = await client.post(SESSIONS_OPEN, json={"opening_cash": 0})
        assert resp.status_code == 201
    finally:
        app.dependency_overrides.pop(get_current_vendor_user, None)
