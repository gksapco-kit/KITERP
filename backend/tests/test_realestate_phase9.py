"""Real estate — Phase 9: behaviour that only a real PostgreSQL proves (row locks, concurrency, production DDL).

Run with ``TEST_DATABASE_URL=postgresql+asyncpg://.../<name>_test pytest tests/test_realestate_phase9.py``.
Without it these tests are skipped (SQLite has no row locks and stores decimals as floats).
"""
import asyncio
import uuid
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, text

from app.models.realestate.supply import ReStockBalance, ReStockLedger
from app.services.realestate import booking as booking_svc
from app.services.realestate import inventory as inv
from app.services.realestate.common import Ctx, next_number
from tests.conftest import TestSession, engine
from tests.test_realestate_phase1 import B, _customer, _post, _setup_inventory

pytestmark = pytest.mark.usefixtures("postgres_only")


def _ctx(session, vendor_id, user_id) -> Ctx:
    return Ctx(db=session, vendor_id=vendor_id, user_id=user_id, actor_name="Concurrency", permissions=frozenset(), role="owner")


async def _run_parallel(n, worker):
    """Run ``worker(i, session)`` ``n`` times at once, each with its own session / transaction."""
    gate = asyncio.Event()

    async def _one(i):
        async with TestSession() as session:
            await gate.wait()
            try:
                out = await worker(i, session)
                await session.commit()
                return ("ok", out)
            except HTTPException as exc:
                await session.rollback()
                return ("http", exc.status_code)
            except Exception as exc:  # surfaced to the assertion below
                await session.rollback()
                return ("error", repr(exc))

    tasks = [asyncio.create_task(_one(i)) for i in range(n)]
    await asyncio.sleep(0.2)
    gate.set()
    return await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_only_one_of_many_simultaneous_blocks_wins(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    cust = await _customer(client)

    async def worker(i, session):
        return (await booking_svc.block_unit(_ctx(session, test_vendor_user.vendor_id, test_vendor_user.user_id),
                                             uuid.UUID(unit["id"]), customer_id=uuid.UUID(cust["id"]), hours=24)).id

    results = await _run_parallel(6, worker)
    assert [r for r in results if r[0] == "error"] == [], results
    assert sum(1 for r in results if r[0] == "ok") == 1, results
    assert sum(1 for r in results if r == ("http", 409)) == 5, results
    async with TestSession() as s:
        n_active = (await s.execute(text("select count(*) from re_unit_block where status='active'"))).scalar_one()
    assert n_active == 1


@pytest.mark.asyncio
async def test_document_numbers_are_unique_under_parallel_creation(client, test_vendor_user):
    async def worker(i, session):
        return await next_number(session, test_vendor_user.vendor_id, "lead")

    results = await _run_parallel(12, worker)
    assert [r for r in results if r[0] != "ok"] == [], results
    numbers = [r[1] for r in results]
    assert len(set(numbers)) == 12, numbers
    async with TestSession() as s:
        assert (await s.execute(text("select next_number from re_number_range where doc_type='lead'"))).scalar_one() == 13


async def _store_and_material(client):
    p = await _post(client, "/projects", {"name": "Lock Test", "city": "Pune"})
    store = await _post(client, "/site-stores", {"name": "Main", "project_id": p["id"]})
    mat = await _post(client, "/materials", {"name": "Cement", "category": "cement", "unit": "bag"})
    return p, store, mat


@pytest.mark.asyncio
async def test_parallel_stock_issues_never_drive_the_balance_negative(client, test_vendor_user):
    from datetime import date

    _, store, mat = await _store_and_material(client)
    sid, mid = uuid.UUID(store["id"]), uuid.UUID(mat["id"])

    async with TestSession() as s:
        await inv.stock_txn(_ctx(s, test_vendor_user.vendor_id, test_vendor_user.user_id), store_id=sid, material_id=mid,
                            quantity=Decimal("100"), txn_type="grn", txn_date=date.today(), reference_type="test",
                            reference_id=uuid.uuid4(), reference_no="SEED", rate=Decimal("400"))
        await s.commit()

    async def worker(i, session):
        await inv.stock_txn(_ctx(session, test_vendor_user.vendor_id, test_vendor_user.user_id), store_id=sid, material_id=mid,
                            quantity=Decimal("-30"), txn_type="issue", txn_date=date.today(), reference_type="test",
                            reference_id=uuid.uuid4(), reference_no=f"ISS-{i}")
        return i

    results = await _run_parallel(6, worker)
    assert [r for r in results if r[0] == "error"] == [], results
    assert sum(1 for r in results if r[0] == "ok") == 3, results  # 100 / 30 -> exactly three issues fit
    async with TestSession() as s:
        bal = (await s.execute(select(ReStockBalance).where(ReStockBalance.store_id == sid))).scalar_one()
        assert bal.quantity == Decimal("10.000") and bal.value == Decimal("4000.00")
        n_led = (await s.execute(select(func.count()).select_from(ReStockLedger).where(ReStockLedger.store_id == sid))).scalar_one()
        assert n_led == 4  # seed + three issues; the rejected ones left nothing behind


@pytest.mark.asyncio
async def test_first_ever_receipts_for_a_new_store_material_pair_do_not_collide(client, test_vendor_user):
    from datetime import date

    _, store, mat = await _store_and_material(client)
    sid, mid = uuid.UUID(store["id"]), uuid.UUID(mat["id"])

    async def worker(i, session):
        await inv.stock_txn(_ctx(session, test_vendor_user.vendor_id, test_vendor_user.user_id), store_id=sid, material_id=mid,
                            quantity=Decimal("10"), txn_type="grn", txn_date=date.today(), reference_type="test",
                            reference_id=uuid.uuid4(), reference_no=f"GRN-{i}", rate=Decimal("100"))
        return i

    results = await _run_parallel(5, worker)
    assert [r for r in results if r[0] != "ok"] == [], results  # none may fail on the unique (store, material) balance row
    async with TestSession() as s:
        rows = (await s.execute(select(ReStockBalance).where(ReStockBalance.store_id == sid))).scalars().all()
        assert len(rows) == 1 and rows[0].quantity == Decimal("50.000") and rows[0].value == Decimal("5000.00")


@pytest.mark.asyncio
async def test_simultaneous_receipts_cannot_overpay_a_booking(client, test_vendor_user):
    from app.models.realestate.core import ReBooking
    from app.services.realestate import payments
    from tests.test_realestate_phase5 import _registered_booking

    _, b = await _registered_booking(client)  # payable 5,250,000 incl. GST
    bid = uuid.UUID(b["id"])

    async def worker(i, session):
        ctx = _ctx(session, test_vendor_user.vendor_id, test_vendor_user.user_id)
        booking = await session.get(ReBooking, bid)
        receipt, _ = await payments.record_receipt(ctx, booking, amount=Decimal("3000000"), mode="neft", reference_no=f"UTR-{i}")
        return receipt.id

    results = await _run_parallel(2, worker)
    assert [r for r in results if r[0] == "error"] == [], results
    assert sum(1 for r in results if r[0] == "ok") == 1 and sum(1 for r in results if r == ("http", 409)) == 1, results
    async with TestSession() as s:
        assert (await s.get(ReBooking, bid)).paid_amount == Decimal("3000000.00")


# ── numeric precision and production DDL ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_money_is_stored_to_the_paisa_and_exactly(client, test_vendor_user):
    p = await _post(client, "/projects", {"name": "Precision", "city": "Pune", "gst_rate": 5})
    tower = await _post(client, "/towers", {"project_id": p["id"], "name": "T"})
    ut = await _post(client, "/unit-types", {"project_id": p["id"], "name": "1BHK", "carpet_area": 500, "super_area": 700, "base_rate": 4999.99})
    await _post(client, f"/towers/{tower['id']}/generate-units", {"unit_type_id": ut["id"], "floors_from": 1, "floors_to": 1, "units_per_floor": 1}, status=200)
    unit = (await client.get(f"{B}/units", params={"project_id": p["id"]})).json()["items"][0]
    async with TestSession() as s:
        total = (await s.execute(text("select total_price from re_unit where id = :i"), {"i": unit["id"]})).scalar_one()
    assert isinstance(total, Decimal) and total == total.quantize(Decimal("0.01"))


@pytest.mark.asyncio
async def test_realestate_schema_bootstrap_is_idempotent_and_complete(client):
    """``ensure_realestate_schema`` (the production start-up path) can run on an existing database any number of times."""
    from app import database

    original = database.engine
    database.engine = engine  # point the production helper at the test database
    try:
        monkey_url = database.settings.DATABASE_URL
        database.settings.DATABASE_URL = "postgresql+asyncpg://test"  # only the "postgresql" substring is checked
        try:
            await database.ensure_realestate_schema()
            await database.ensure_realestate_schema()
        finally:
            database.settings.DATABASE_URL = monkey_url
    finally:
        database.engine = original
    async with engine.connect() as conn:
        names = {r[0] for r in (await conn.execute(text("select table_name from information_schema.tables where table_name like 're\\_%'"))).all()}
    for must in ("re_project", "re_unit", "re_booking", "re_demand", "re_receipt", "re_gl_failure", "re_portal_link", "re_wage_sheet"):
        assert must in names, must
