"""Smoke test: every vendor report / analytics GET endpoint answers without a server or validation error.

Routes are discovered from the FastAPI app, so new report endpoints are covered automatically.
Each is called with no query params (the frontend always sends at least dates, which are optional
everywhere) and again with the date window the report pages send by default.

This catches the class of bug where a page's default params are rejected (422) or a query crashes
(5xx) and the UI quietly renders "no data".
"""
import uuid
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser

pytestmark = pytest.mark.asyncio


def _report_routes() -> list[str]:
    out = []
    for r in app.routes:
        path = getattr(r, "path", "")
        methods = getattr(r, "methods", None) or set()
        if (
            "GET" in methods
            and "{" not in path
            and path.startswith("/api/v1/vendors/me/")
            and ("report" in path or "analytic" in path)
        ):
            out.append(path)
    return sorted(set(out))


ROUTES = _report_routes()

# Endpoints that cannot run on the SQLite test database (Postgres-only SQL) or that are
# export/stream endpoints. Keep this list short and explain each entry.
SKIP: dict[str, str] = {}


@pytest_asyncio.fixture
async def owner(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="owner", permissions=[], is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    return vu


def _fill_required(resp, params: dict, today: date):
    """Build params for 'field required' query errors, or None if something else is wrong."""
    try:
        errors = resp.json().get("detail", [])
    except Exception:
        return None
    if not isinstance(errors, list) or not errors:
        return None
    month_start = today.replace(day=1)
    known = {
        "from_date": month_start.isoformat(), "to_date": today.isoformat(),
        "date_from": month_start.isoformat(), "date_to": today.isoformat(),
        "start_date": month_start.isoformat(), "end_date": today.isoformat(),
        "year": today.year, "month": today.month,
        "period_year": today.year, "period_month": today.month,
    }
    filled = dict(params)
    for err in errors:
        if err.get("type") != "missing":
            return None
        name = str(err.get("field", "")).split("->")[-1].strip()
        if name not in known:
            return None
        filled[name] = known[name]
    return filled


def test_routes_were_discovered():
    assert len(ROUTES) > 20, "report route discovery found suspiciously few endpoints"


async def test_report_endpoints_do_not_fail(client: AsyncClient, owner: VendorUser):
    today = date.today()
    windows = [
        {},
        {"date_from": (today - timedelta(days=29)).isoformat(), "date_to": today.isoformat()},
    ]
    failures: list[str] = []
    not_ok: dict[str, int] = {}
    for path in ROUTES:
        if path in SKIP:
            continue
        for params in windows:
            resp = await client.get(path, params=params)
            if resp.status_code == 422:
                # Some reports legitimately require a period; supply it and retry once.
                filled = _fill_required(resp, params, today)
                if filled is not None:
                    resp = await client.get(path, params=filled)
            # 401/403/404 mean "not available to this role/offering" - not a report bug.
            if resp.status_code >= 500 or resp.status_code == 422:
                failures.append(f"{resp.status_code} {path} {params or '(no params)'}: {resp.text[:160]}")
                break
        else:
            if resp.status_code != 200:
                not_ok[path] = resp.status_code
    assert not failures, "Report endpoints failing:\n" + "\n".join(failures)

    # Guard against a vacuous pass: most endpoints must actually return data (200), not 403/404.
    ok = len(ROUTES) - len(SKIP) - len(not_ok)
    assert ok >= 0.8 * (len(ROUTES) - len(SKIP)), (
        "Too many report endpoints are not reachable by an owner:\n"
        + "\n".join(f"{c} {p}" for p, c in sorted(not_ok.items()))
    )
