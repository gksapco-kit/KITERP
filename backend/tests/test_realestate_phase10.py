"""Real estate — Phase 10: scheduled jobs, additive schema upgrades and a constant-query customer portal."""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import event, text, update

from app.api.v1.realestate import ratelimit
from app.models.realestate.core import ReUnitBlock
from app.services.realestate import scheduler
from tests.conftest import TestSession, engine
from tests.test_realestate_phase1 import B, _post, _setup_inventory
from tests.test_realestate_phase5 import PUB, _registered_booking
from tests.test_realestate_phase6 import TODAY, _active_lease, _get, _tenant, _units


# ── scheduled jobs ──────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_daily_job_frees_expired_blocks_and_expires_leases_and_warranties(client, test_vendor_user, db_session):
    project, *_ = await _setup_inventory(client)
    units = await _units(client, project)
    await _post(client, f"/units/{units[0]['id']}/block", {"hours": 2, "reason": "walk-in"}, status=200)
    await db_session.execute(update(ReUnitBlock).values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
    await db_session.commit()

    out = await scheduler.run_daily(TestSession)
    rep = out[str(test_vendor_user.vendor_id)]
    assert "error" not in rep, rep
    assert rep["housekeeping"]["blocks_released"] == 1
    assert rep["billing"] == {"rent_invoices": 0, "maintenance_bills": 0}  # billing is opt-in
    assert (await _get(client, f"/units/{units[0]['id']}"))["status"] == "available"
    # a second run has nothing left to do
    again = (await scheduler.run_daily(TestSession))[str(test_vendor_user.vendor_id)]
    assert again["housekeeping"] == {"blocks_released": 0, "leases_expired": 0, "warranties_expired": 0}


@pytest.mark.asyncio
async def test_auto_billing_is_opt_in_and_idempotent(client, test_vendor_user, db_session):
    project, *_ = await _setup_inventory(client)
    units = await _units(client, project)
    tenant = await _tenant(client)
    await _active_lease(client, units[0], tenant, TODAY, TODAY + timedelta(days=365), rent=80000)
    vid = str(test_vendor_user.vendor_id)

    rep = (await scheduler.run_daily(TestSession))[vid]
    assert rep["billing"]["rent_invoices"] == 0
    assert (await _get(client, "/rent-invoices"))["total"] == 0

    await _post(client, "/automation-settings", {"key": "auto_billing", "value": {"rent": True, "maintenance": True}})
    rep = (await scheduler.run_daily(TestSession))[vid]
    assert "error" not in rep, rep
    assert rep["billing"]["rent_invoices"] == 1
    again = (await scheduler.run_daily(TestSession))[vid]
    assert again["billing"]["rent_invoices"] == 0  # the month is already billed
    inv = await _get(client, "/rent-invoices")
    assert inv["total"] == 1 and inv["items"][0]["status"] == "issued"


@pytest.mark.asyncio
async def test_daily_job_retries_failed_ledger_postings(client, test_vendor_user, monkeypatch):
    await _registered_booking(client)  # no finance accounts in tests -> the demand cannot be posted
    open_before = (await client.get(f"{B}/gl-failures", params={"status": "open"})).json()["total"]
    assert open_before >= 1

    class _JE:
        id = uuid.uuid4()

    async def fake_post_event(db, vendor_id, source_type, source_id, payload):
        return _JE()

    monkeypatch.setattr("app.services.finance.posting.post_event", fake_post_event)
    rep = (await scheduler.run_daily(TestSession))[str(test_vendor_user.vendor_id)]
    assert rep["gl_retry"]["resolved"] == open_before
    assert (await client.get(f"{B}/gl-failures", params={"status": "open"})).json()["total"] == 0


@pytest.mark.asyncio
async def test_one_failing_vendor_does_not_stop_the_others(client, test_vendor_user, monkeypatch):
    await _setup_inventory(client)
    calls = []

    async def boom(db, vendor_id, today=None):
        calls.append(vendor_id)
        raise RuntimeError("simulated failure")

    monkeypatch.setattr(scheduler, "run_for_vendor", boom)
    out = await scheduler.run_daily(TestSession)
    assert out[str(test_vendor_user.vendor_id)]["error"] == "simulated failure" and len(calls) == 1


def test_celery_beat_has_the_daily_realestate_job():
    from app import worker

    if not worker.CELERY_AVAILABLE:
        pytest.skip("celery not installed")
    entry = worker.celery_app.conf.beat_schedule["realestate-daily"]
    assert entry["task"] == "realestate.daily" and entry["schedule"] == 86400


# ── customer portal: constant number of queries ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_portal_query_count_does_not_grow_with_bookings(client, test_vendor_user):
    ratelimit.reset_memory()
    project, b1 = await _registered_booking(client)
    link = await _post(client, f"/customers/{b1['customer_id']}/portal-link", {"days": 7}, status=200)
    h = {"X-Portal-Token": link["token"]}

    counter = {"n": 0}

    def _count(*_a, **_k):
        counter["n"] += 1

    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        counter["n"] = 0
        one = await client.get(f"{PUB}/portal/me", headers=h)
        queries_one = counter["n"]
        assert one.status_code == 200 and len(one.json()["bookings"]) == 1

        # give the same customer two more bookings on other units, then measure again
        from tests.test_realestate_phase2 import _book

        for idx in (1, 2):
            await _book(client, project, unit_idx=idx, customer_id=b1["customer_id"])
        counter["n"] = 0
        many = await client.get(f"{PUB}/portal/me", headers=h)
        queries_many = counter["n"]
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)
    assert many.status_code == 200 and len(many.json()["bookings"]) == 3
    assert queries_many == queries_one, (queries_one, queries_many)


# ── additive schema upgrade (PostgreSQL) ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_missing_columns_are_added_and_backfilled(client, test_vendor_user, postgres_only):
    from app import database

    await _post(client, "/leads", {"full_name": "Seed"})  # creates the number-range row (padding NOT NULL default 5)
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE re_number_range DROP COLUMN padding"))
        await conn.execute(text("ALTER TABLE re_setting DROP COLUMN description"))

    original, url = database.engine, database.settings.DATABASE_URL
    database.engine, database.settings.DATABASE_URL = engine, "postgresql+asyncpg://test"
    try:
        await database.ensure_realestate_schema()
        await database.ensure_realestate_schema()  # idempotent
    finally:
        database.engine, database.settings.DATABASE_URL = original, url

    async with engine.connect() as conn:
        pad = (await conn.execute(text("select padding from re_number_range where doc_type='lead'"))).scalar_one()
        nullable = (await conn.execute(text(
            "select is_nullable from information_schema.columns where table_name='re_number_range' and column_name='padding'"))).scalar_one()
        desc_back = (await conn.execute(text(
            "select count(*) from information_schema.columns where table_name='re_setting' and column_name='description'"))).scalar_one()
    assert pad == 5 and nullable == "NO" and desc_back == 1


@pytest.mark.asyncio
async def test_alembic_baseline_revision_is_chained_and_importable():
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "re001_realestate_baseline.py"
    spec = importlib.util.spec_from_file_location("re001", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.revision == "re001_realestate_baseline" and mod.down_revision == "prod010_production_hardening"
    assert (path.parent / "prod010_production_hardening.py").exists()
