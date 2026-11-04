"""Production costing, valuation and accounting — phases 4 and 9.

* Components are issued and finished goods received at actual cost.
* A balanced journal is posted on completion and reversed on re-open.
* A linked Controlling order carries the cost lines and the completion booking.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import CoCostBooking, CoManufacturingOrder, CoOrderCostLine
from app.models.finance import FinJournalEntry, FinJournalLine
from app.models.mrp import ProductBOMItem
from app.models.procurement_special import MaterialValuation
from app.models.production import ProductionOrder
from app.models.store import Store, StoreInventory
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser
from app.models.user import User
from app.services.controlling.seed_demo import _ensure_co_accounts
from app.services.controlling.settlement import upsert_gl_mapping
from app.services.finance.coa_seeder import (
    get_or_create_default_fin_company,
    seed_default_fiscal_year,
)

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/vendors/me"


@pytest_asyncio.fixture
async def owner(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
        role="owner", permissions=[], is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    await db_session.refresh(vu)
    return vu


async def _product(db, vendor, user, name, cost=None) -> Product:
    p = Product(
        id=uuid.uuid4(), vendor_id=vendor.id, name=name,
        slug=f"{name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}",
        price=100.0, cost_price=cost, currency="INR", status="active", product_type="physical",
        quantity=0, created_by=user.id, valuation_method="fixed" if cost is not None else "moving_average",
        cost_price_fixed=cost,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@pytest_asyncio.fixture
async def component(db_session, test_vendor, test_user) -> Product:
    return await _product(db_session, test_vendor, test_user, "Raw Fabric", cost=10.0)


@pytest_asyncio.fixture
async def finished(db_session, test_vendor, test_user) -> Product:
    return await _product(db_session, test_vendor, test_user, "T-Shirt")


@pytest_asyncio.fixture
async def bom(db_session, test_vendor, finished, component):
    db_session.add(ProductBOMItem(
        vendor_id=test_vendor.id, product_id=finished.id, component_id=component.id, qty_per_unit=3,
    ))
    await db_session.commit()


@pytest_asyncio.fixture
async def store(db_session, test_vendor, component) -> Store:
    s = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Main Warehouse", is_default=True)
    db_session.add(s)
    await db_session.flush()
    db_session.add(StoreInventory(
        id=uuid.uuid4(), store_id=s.id, vendor_id=test_vendor.id, product_id=component.id, quantity=100,
    ))
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest_asyncio.fixture
async def gl(db_session: AsyncSession, test_vendor: Vendor):
    """Finance company, fiscal year, chart of accounts and CO GL mapping."""
    await seed_default_fiscal_year(db_session, test_vendor.id)
    company = await get_or_create_default_fin_company(db_session, test_vendor.id)
    wip, fg, cogs, rm = await _ensure_co_accounts(db_session, test_vendor.id)
    await upsert_gl_mapping(
        db_session, test_vendor.id, company.id,
        wip_account_id=wip.id, finished_goods_account_id=fg.id,
        cogs_account_id=cogs.id, raw_material_account_id=rm.id,
    )
    await db_session.commit()
    return {"company": company.id, "wip": wip.id, "fg": fg.id, "rm": rm.id}


def _body(finished, store, qty=2, status="confirmed") -> dict:
    return {
        "type": "mts", "status": status, "store_id": str(store.id),
        "items": [{"item_type": "product", "product_id": str(finished.id), "qty": qty, "name": "T-Shirt"}],
    }


async def _complete(client: AsyncClient, finished, store, qty=2):
    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, qty))
    assert r.status_code == 201, r.text
    oid = r.json()["id"]
    done = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    return oid, done


async def _journal_lines(db, vendor_id):
    jes = (await db.execute(
        select(FinJournalEntry).where(
            FinJournalEntry.vendor_id == vendor_id, FinJournalEntry.source_type == "co_cost_booking",
            FinJournalEntry.status == "posted",
        )
    )).scalars().all()
    return jes


async def test_completion_values_stock_and_posts_balanced_journal(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store, gl,
):
    oid, done = await _complete(client, finished, store, qty=2)
    assert done.status_code == 200, done.text
    data = done.json()

    # 2 shirts x 3 fabric x 10 = 60 of material, no routing => no labor
    assert Decimal(str(data["actual_material_cost"])) == Decimal("60.00")

    posting = (await client.get(f"{BASE}/production-orders/{oid}")).json()["inventory_posting"]
    assert posting["costing"]["total"] == "60.00"
    assert posting["costing"]["unit_cost"] == "30.0000"
    assert posting["components"][0]["unit_cost"] == "10.0000"
    assert posting["accounting"]["status"] == "posted"

    jes = await _journal_lines(db_session, test_vendor.id)
    assert len(jes) == 1
    assert jes[0].total_debit == jes[0].total_credit == Decimal("60")
    lines = (await db_session.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == jes[0].id)
    )).scalars().all()
    by_account = {ln.account_id: (ln.debit, ln.credit) for ln in lines}
    assert by_account[gl["fg"]] == (Decimal("60"), Decimal("0"))
    assert by_account[gl["rm"]] == (Decimal("0"), Decimal("60"))

    # Finished goods carry the production cost into their valuation.
    mv = (await db_session.execute(
        select(MaterialValuation).where(MaterialValuation.product_id == finished.id)
    )).scalar_one()
    assert mv.moving_avg_price == Decimal("30.0000")
    assert mv.total_stock == Decimal("2")
    await db_session.refresh(finished)
    assert finished.cost_price == Decimal("30.00")


async def test_labor_is_part_of_the_cost_and_credits_wip(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store, gl,
):
    wc = await client.post(f"{BASE}/work-centers", json={"name": "Sewing", "cost_per_hour": 50})
    assert wc.status_code in (200, 201), wc.text
    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2))
    oid = r.json()["id"]
    op = await client.post(f"{BASE}/production-orders/{oid}/operations", json={
        "name": "Stitch", "work_center_id": wc.json()["id"], "planned_hours": 2, "actual_hours": 2,
    })
    assert op.status_code in (200, 201), op.text

    done = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    assert done.status_code == 200, done.text

    posting = (await client.get(f"{BASE}/production-orders/{oid}")).json()["inventory_posting"]
    assert posting["costing"] == {
        "material": "60.00", "labor": "100.00", "total": "160.00", "unit_cost": "80.0000", "labor_basis": "actual",
    }
    jes = await _journal_lines(db_session, test_vendor.id)
    assert jes[0].total_debit == Decimal("160")
    lines = (await db_session.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == jes[0].id)
    )).scalars().all()
    by_account = {ln.account_id: ln.credit for ln in lines}
    assert by_account[gl["wip"]] == Decimal("100")
    assert by_account[gl["rm"]] == Decimal("60")


async def test_controlling_order_is_linked_with_cost_lines_and_booking(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store, gl,
):
    oid, done = await _complete(client, finished, store, qty=2)
    assert done.status_code == 200, done.text

    co = (await db_session.execute(
        select(CoManufacturingOrder).where(
            CoManufacturingOrder.vendor_id == test_vendor.id,
            CoManufacturingOrder.ref_doc_type == "production_order",
            CoManufacturingOrder.ref_doc_id == uuid.UUID(oid),
        )
    )).scalar_one()
    assert co.product_id == finished.id
    assert co.qty_planned == Decimal("2")
    assert co.settlement_status == "production_posted"
    assert co.production_completion_journal_id is not None
    cost_lines = (await db_session.execute(
        select(CoOrderCostLine).where(CoOrderCostLine.order_id == co.id)
    )).scalars().all()
    assert [(c.category, c.amount_actual) for c in cost_lines] == [("material", Decimal("60"))]
    booking = (await db_session.execute(
        select(CoCostBooking).where(CoCostBooking.order_id == co.id)
    )).scalar_one()
    assert booking.booking_type == "production_completion"
    assert booking.journal_entry_id == co.production_completion_journal_id


async def test_reopen_reverses_journal_valuation_and_controlling_order(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store, gl,
):
    oid, done = await _complete(client, finished, store, qty=2)
    assert done.status_code == 200, done.text

    back = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "in_production"})
    assert back.status_code == 200, back.text

    assert await _journal_lines(db_session, test_vendor.id) == []
    assert (await db_session.execute(
        select(func.count()).select_from(CoManufacturingOrder).where(
            CoManufacturingOrder.vendor_id == test_vendor.id, CoManufacturingOrder.ref_doc_type == "production_order",
        )
    )).scalar() == 0
    mv = (await db_session.execute(
        select(MaterialValuation).where(MaterialValuation.product_id == finished.id)
    )).scalar_one()
    assert mv.total_stock == Decimal("0")

    # Completing again posts a fresh journal.
    again = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    assert again.status_code == 200, again.text
    assert len(await _journal_lines(db_session, test_vendor.id)) == 1


async def test_reopen_is_refused_once_cogs_is_settled(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store, gl, test_user,
):
    oid, done = await _complete(client, finished, store, qty=2)
    assert done.status_code == 200, done.text

    co = (await db_session.execute(
        select(CoManufacturingOrder).where(CoManufacturingOrder.ref_doc_id == uuid.UUID(oid))
    )).scalar_one()
    co.cogs_issue_journal_id = uuid.uuid4()
    co.settlement_status = "cogs_partial"
    await db_session.commit()
    await db_session.refresh(test_user)
    await db_session.refresh(owner)

    back = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "in_production"})
    assert back.status_code == 400
    assert "cost of goods sold" in back.json()["detail"].lower()


async def test_unconfigured_gl_still_completes_and_records_why(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store,
):
    oid, done = await _complete(client, finished, store, qty=2)
    assert done.status_code == 200, done.text
    posting = (await client.get(f"{BASE}/production-orders/{oid}")).json()["inventory_posting"]
    assert posting["accounting"]["status"] == "skipped"
    assert "company" in posting["accounting"]["reason"].lower() or "gl mapping" in posting["accounting"]["reason"].lower()
    assert Decimal(str(done.json()["actual_material_cost"])) == Decimal("60.00")


async def test_closed_period_blocks_completion_and_leaves_stock_untouched(
    client: AsyncClient, db_session, owner, test_vendor, finished, component, bom, store, gl, test_user,
):
    from app.models.finance import FinPeriod

    periods = (await db_session.execute(select(FinPeriod).where(FinPeriod.vendor_id == test_vendor.id))).scalars().all()
    for p in periods:
        p.status = "closed"
    await db_session.commit()
    await db_session.refresh(test_user)
    await db_session.refresh(owner)

    store_id, component_id = store.id, component.id
    r = await client.post(f"{BASE}/production-orders", json=_body(finished, store, 2))
    assert r.status_code == 201, r.text
    oid = r.json()["id"]
    done = await client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    assert done.status_code == 400, done.text

    qty = (await db_session.execute(
        select(func.coalesce(func.sum(StoreInventory.quantity), 0)).where(
            StoreInventory.store_id == store_id, StoreInventory.product_id == component_id,
        )
    )).scalar()
    assert int(qty) == 100
