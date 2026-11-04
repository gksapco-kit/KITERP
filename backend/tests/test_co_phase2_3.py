"""Controlling Phase 2 (state machine / integrity) and Phase 3 (accounting correctness)."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.deps import get_current_active_user, get_current_vendor_user
from app.database import get_db
from app.main import app
from app.models.controlling import CoCostBooking, CoGoodsMovement, CoManufacturingOrder
from app.models.finance import FinAccount, FinJournalEntry
from app.models.mrp import ProductBOMItem
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser
from app.services.controlling.numbering import next_number
from app.services.controlling.seed_demo import seed_co_demo_data

CO = "/api/v1/vendors/me/controlling"


@pytest_asyncio.fixture
async def co_client(db_session, test_user: User, test_vendor_user: VendorUser):
    async def _db():
        yield db_session

    # Error paths roll the shared session back, which expires these fixtures; reload on every request.
    async def _user():
        await db_session.refresh(test_user)
        return test_user

    async def _vu():
        await db_session.refresh(test_vendor_user)
        return test_vendor_user

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_active_user] = _user
    app.dependency_overrides[get_current_vendor_user] = _vu
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded(db_session, test_vendor: Vendor, test_user: User) -> dict:
    out = await seed_co_demo_data(
        db_session, test_vendor.id, test_user.id,
        demo_order_no=f"P23-{uuid.uuid4().hex[:6]}", skip_if_order_exists=False,
    )
    await db_session.commit()
    out["vendor_id"] = test_vendor.id
    return out


async def _order(client, order_id: str) -> dict:
    r = await client.get(f"{CO}/manufacturing-orders/{order_id}")
    assert r.status_code == 200, r.text
    return r.json()


async def _transition(client, order_id: str, status: str):
    return await client.post(f"{CO}/manufacturing-orders/{order_id}/transition", json={"status": status})


async def _new_order(client, company_id: str, **over) -> dict:
    body = {"company_id": company_id, "status": "in_progress", "qty_planned": "5", **over}
    r = await client.post(f"{CO}/manufacturing-orders", json=body)
    assert r.status_code == 201, r.text
    return r.json()


# ── Phase 2: state machine ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_status_only_changes_through_transition(co_client, seeded):
    cid, oid = seeded["company_id"], seeded["manufacturing_order_id"]
    r = await co_client.post(f"{CO}/manufacturing-orders", json={"company_id": cid, "status": "completed"})
    assert r.status_code == 422
    r = await co_client.patch(f"{CO}/manufacturing-orders/{oid}", json={"status": "completed", "title": "x"})
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"  # status in a PATCH body is ignored
    assert r.json()["title"] == "x"


@pytest.mark.asyncio
async def test_completed_order_is_locked_for_edits_and_actuals(co_client, seeded):
    cid, oid, comp = seeded["company_id"], seeded["manufacturing_order_id"], seeded["product_component_id"]
    assert (await _transition(co_client, oid, "completed")).status_code == 200
    line = (await _order(co_client, oid))["cost_lines"][0]

    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/cost-lines", json={"category": "other"})
    assert r.status_code == 409
    r = await co_client.patch(f"{CO}/manufacturing-orders/{oid}/cost-lines/{line['id']}", json={"qty_actual": "1"})
    assert r.status_code == 409
    r = await co_client.patch(f"{CO}/manufacturing-orders/{oid}", json={"title": "late"})
    assert r.status_code == 409
    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/operations", json={"name": "late op"})
    assert r.status_code == 409
    r = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": cid, "order_id": oid, "movement_type": "component_issue",
        "posting_date": str(date.today()), "product_id": comp, "qty": "1", "unit_cost": "1",
    })
    assert r.status_code == 409
    r = await co_client.post(f"{CO}/activity-confirmations", json={
        "company_id": cid, "order_id": oid, "confirmation_date": str(date.today()),
        "hours_confirmed": "1", "rate_per_hour": "1",
    })
    assert r.status_code == 409
    # an FG receipt is still accepted on a completed order (it feeds COGS)
    r = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": cid, "order_id": oid, "movement_type": "fg_receipt",
        "posting_date": str(date.today()), "qty": "1", "unit_cost": "0",
    })
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_draft_order_does_not_accept_actuals(co_client, seeded):
    cid = seeded["company_id"]
    draft = await _new_order(co_client, cid, status="draft")
    r = await co_client.post(f"{CO}/activity-confirmations", json={
        "company_id": cid, "order_id": draft["id"], "confirmation_date": str(date.today()),
        "hours_confirmed": "1", "rate_per_hour": "1",
    })
    assert r.status_code == 409
    assert "released" in r.json()["detail"]


@pytest.mark.asyncio
async def test_cancel_blocked_when_documents_posted(co_client, seeded):
    cid, oid, comp = seeded["company_id"], seeded["manufacturing_order_id"], seeded["product_component_id"]
    r = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": cid, "order_id": oid, "movement_type": "component_issue",
        "posting_date": str(date.today()), "product_id": comp, "qty": "1", "unit_cost": "2",
    })
    assert r.status_code == 200, r.text
    assert (await _transition(co_client, oid, "cancelled")).status_code == 409
    # a clean order can still be cancelled
    clean = await _new_order(co_client, cid, status="released")
    assert (await _transition(co_client, clean["id"], "cancelled")).status_code == 200


@pytest.mark.asyncio
async def test_line_amount_follows_qty_and_rate(co_client, seeded):
    cid = seeded["company_id"]
    o = await _new_order(co_client, cid, cost_lines=[
        {"category": "other", "qty_planned": "2", "rate_planned": "5"},
    ])
    oid, line = o["id"], o["cost_lines"][0]
    assert Decimal(line["amount_planned"]) == Decimal("10")
    r = await co_client.patch(f"{CO}/manufacturing-orders/{oid}/cost-lines/{line['id']}", json={"qty_planned": "4"})
    assert Decimal(r.json()["cost_lines"][0]["amount_planned"]) == Decimal("20")  # no stale amount
    r = await co_client.patch(f"{CO}/manufacturing-orders/{oid}/cost-lines/{line['id']}", json={"amount_actual": "77"})
    got = r.json()["cost_lines"][0]
    assert Decimal(got["amount_actual"]) == Decimal("77")
    assert Decimal(got["qty_actual"]) == Decimal("1")


@pytest.mark.asyncio
async def test_numbers_are_sequential(co_client, db_session, seeded):
    cid = seeded["company_id"]
    a = await _new_order(co_client, cid)
    b = await _new_order(co_client, cid)
    na, nb = int(a["order_no"].split("-")[1]), int(b["order_no"].split("-")[1])
    assert nb == na + 1
    vid = seeded["vendor_id"]
    n1 = await next_number(db_session, vid, "unit_test")
    n2 = await next_number(db_session, vid, "unit_test")
    assert (n1, n2) == (1, 2)


@pytest.mark.asyncio
async def test_goods_movement_documents_are_unique(co_client, seeded):
    cid, oid, comp = seeded["company_id"], seeded["manufacturing_order_id"], seeded["product_component_id"]
    nos = []
    for _ in range(3):
        r = await co_client.post(f"{CO}/goods-movements", json={
            "company_id": cid, "order_id": oid, "movement_type": "component_issue",
            "posting_date": str(date.today()), "product_id": comp, "qty": "1", "unit_cost": "1",
        })
        assert r.status_code == 200, r.text
        nos.append(r.json()["document_no"])
    assert len(set(nos)) == 3
    assert [int(n[2:]) for n in nos] == sorted(int(n[2:]) for n in nos)


@pytest.mark.asyncio
async def test_confirmation_edit_and_delete_undo_operation_and_cost(co_client, seeded):
    cid = seeded["company_id"]
    act = seeded["activity_type_id"]
    o = await _new_order(co_client, cid, cost_lines=[
        {"category": "activity", "activity_type_id": act, "qty_planned": "10", "rate_planned": "20"},
    ])
    oid = o["id"]
    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/operations", json={
        "name": "Cut", "activity_type_id": act, "planned_qty": "4", "planned_hours": "10",
    })
    assert r.status_code == 201, r.text
    op_id = r.json()["operations"][0]["id"]

    r = await co_client.post(f"{CO}/activity-confirmations", json={
        "company_id": cid, "order_id": oid, "operation_id": op_id, "activity_type_id": act,
        "confirmation_date": str(date.today()), "qty_confirmed": "1", "hours_confirmed": "5", "rate_per_hour": "20",
    })
    assert r.status_code == 200, r.text
    conf_id = r.json()["id"]
    cur = await _order(co_client, oid)
    assert Decimal(cur["operations"][0]["actual_hours"]) == Decimal("5")
    assert cur["operations"][0]["status"] == "in_progress"  # 1 of 4 confirmed: not complete
    assert Decimal(cur["cost_lines"][0]["amount_actual"]) == Decimal("100")

    r = await co_client.patch(f"{CO}/activity-confirmations/{conf_id}", json={"hours_confirmed": "8"})
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["total_cost"]) == Decimal("160")
    cur = await _order(co_client, oid)
    assert Decimal(cur["operations"][0]["actual_hours"]) == Decimal("8")
    assert Decimal(cur["cost_lines"][0]["amount_actual"]) == Decimal("160")

    assert (await co_client.delete(f"{CO}/activity-confirmations/{conf_id}")).status_code == 204
    cur = await _order(co_client, oid)
    assert Decimal(cur["operations"][0]["actual_hours"]) == Decimal("0")
    assert Decimal(cur["operations"][0]["confirmed_qty"]) == Decimal("0")
    assert Decimal(cur["cost_lines"][0]["amount_actual"]) == Decimal("0")


@pytest.mark.asyncio
async def test_goods_movement_reversal_restores_actuals(co_client, seeded):
    cid, oid, comp = seeded["company_id"], seeded["manufacturing_order_id"], seeded["product_component_id"]
    before = await _order(co_client, oid)
    mat_before = sum(Decimal(l["amount_actual"]) for l in before["cost_lines"] if l["category"] == "material")
    r = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": cid, "order_id": oid, "movement_type": "component_issue",
        "posting_date": str(date.today()), "product_id": comp, "qty": "2", "unit_cost": "10",
    })
    gm_id = r.json()["id"]
    mid = await _order(co_client, oid)
    mat_mid = sum(Decimal(l["amount_actual"]) for l in mid["cost_lines"] if l["category"] == "material")
    assert mat_mid == mat_before + Decimal("20")
    r = await co_client.post(f"{CO}/goods-movements/{gm_id}/reverse", json={"reason": "wrong item"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "reversed"
    after = await _order(co_client, oid)
    assert sum(Decimal(l["amount_actual"]) for l in after["cost_lines"] if l["category"] == "material") == mat_before
    again = await co_client.post(f"{CO}/goods-movements/{gm_id}/reverse", json={"reason": "again"})
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_fg_receipt_updates_delivered_quantity(co_client, seeded):
    cid, oid = seeded["company_id"], seeded["manufacturing_order_id"]
    r = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": cid, "order_id": oid, "movement_type": "fg_receipt",
        "posting_date": str(date.today()), "qty": "3", "unit_cost": "0",
    })
    assert r.status_code == 200, r.text
    assert Decimal((await _order(co_client, oid))["qty_delivered"]) == Decimal("7")
    gm_id = r.json()["id"]
    assert (await co_client.post(f"{CO}/goods-movements/{gm_id}/reverse", json={"reason": "x"})).status_code == 200
    assert Decimal((await _order(co_client, oid))["qty_delivered"]) == Decimal("4")


# ── Phase 2: cost versions ────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def products(db_session, test_vendor: Vendor, test_user: User) -> list:
    rows = []
    for i in range(2):
        rows.append(Product(
            id=uuid.uuid4(), vendor_id=test_vendor.id, name=f"P{i}", slug=f"p23-{i}-{uuid.uuid4().hex[:5]}",
            price=1, currency="INR", status="active", product_type="physical", quantity=1, created_by=test_user.id,
        ))
    db_session.add_all(rows)
    await db_session.commit()
    return [str(p.id) for p in rows]


@pytest.mark.asyncio
async def test_cost_version_lifecycle(co_client, seeded, products):
    cid, prod = seeded["company_id"], products[0]
    line = {"line_type": "material", "qty_per_output_unit": "2", "unit_rate_planned": "3"}

    async def make(code):
        r = await co_client.post(f"{CO}/product-costs", json={
            "company_id": cid, "product_id": prod, "version_code": code,
            "valid_from": str(date.today()), "lines": [line],
        })
        assert r.status_code == 201, r.text
        return r.json()["id"]

    v1, v2 = await make("V1"), await make("V2")
    r = await co_client.patch(f"{CO}/product-costs/{v1}", json={"status": "active"})
    assert r.status_code == 200 and r.json()["status"] == "active"
    # an active version is frozen
    assert (await co_client.post(f"{CO}/product-costs/{v1}/lines", json=line)).status_code == 409
    assert (await co_client.post(f"{CO}/product-costs/{v1}/roll-up-bom")).status_code == 409
    assert (await co_client.patch(f"{CO}/product-costs/{v1}", json={"valid_from": "2020-01-01"})).status_code == 409
    # activating the next one archives the previous standard
    assert (await co_client.patch(f"{CO}/product-costs/{v2}", json={"status": "active"})).status_code == 200
    assert (await co_client.get(f"{CO}/product-costs/{v1}")).json()["status"] == "archived"
    # archived is final
    assert (await co_client.patch(f"{CO}/product-costs/{v1}", json={"status": "active"})).status_code == 422


@pytest.mark.asyncio
async def test_cannot_activate_empty_version(co_client, seeded, products):
    r = await co_client.post(f"{CO}/product-costs", json={
        "company_id": seeded["company_id"], "product_id": products[0], "version_code": "EMPTY",
        "valid_from": str(date.today()),
    })
    vid = r.json()["id"]
    assert (await co_client.patch(f"{CO}/product-costs/{vid}", json={"status": "active"})).status_code == 422


@pytest.mark.asyncio
async def test_circular_bom_is_rejected(co_client, db_session, seeded, products, test_vendor):
    a, b = products
    db_session.add_all([
        ProductBOMItem(id=uuid.uuid4(), vendor_id=test_vendor.id, product_id=uuid.UUID(a),
                       component_id=uuid.UUID(b), qty_per_unit=1),
        ProductBOMItem(id=uuid.uuid4(), vendor_id=test_vendor.id, product_id=uuid.UUID(b),
                       component_id=uuid.UUID(a), qty_per_unit=1),
    ])
    await db_session.commit()
    r = await co_client.post(f"{CO}/product-costs", json={
        "company_id": seeded["company_id"], "product_id": a, "version_code": "CIRC",
        "valid_from": str(date.today()),
    })
    vid = r.json()["id"]
    r = await co_client.post(f"{CO}/product-costs/{vid}/roll-up-bom")
    assert r.status_code == 422
    assert "Circular" in r.json()["detail"]


# ── Phase 3: settlement ───────────────────────────────────────────────────────

async def _journal_total(db_session, journal_id) -> tuple:
    je = (await db_session.execute(select(FinJournalEntry).where(FinJournalEntry.id == journal_id))).scalar_one()
    return je.total_debit, je.total_credit, je.status


@pytest.mark.asyncio
async def test_completion_needs_a_released_order(co_client, seeded):
    cid = seeded["company_id"]
    draft = await _new_order(co_client, cid, status="draft", cost_lines=[
        {"category": "other", "qty_actual": "1", "rate_actual": "10"},
    ])
    r = await co_client.post(f"{CO}/manufacturing-orders/{draft['id']}/post-production-completion")
    assert r.status_code == 409, r.text


@pytest.mark.asyncio
async def test_completion_locks_the_order_until_reversed(co_client, seeded):
    oid = seeded["manufacturing_order_id"]
    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/post-production-completion")
    assert r.status_code == 200, r.text
    assert r.json()["settlement_status"] == "production_posted"
    line = r.json()["cost_lines"][0]
    patch = await co_client.patch(f"{CO}/manufacturing-orders/{oid}/cost-lines/{line['id']}", json={"qty_actual": "9"})
    assert patch.status_code == 409
    # reverse -> editable and re-postable again
    rev = await co_client.post(
        f"{CO}/manufacturing-orders/{oid}/reverse-production-completion", json={"reason": "wrong actuals"}
    )
    assert rev.status_code == 200, rev.text
    assert rev.json()["settlement_status"] == "none"
    patch = await co_client.patch(f"{CO}/manufacturing-orders/{oid}/cost-lines/{line['id']}", json={"qty_actual": "9"})
    assert patch.status_code == 200, patch.text
    assert (await co_client.post(f"{CO}/manufacturing-orders/{oid}/post-production-completion")).status_code == 200


@pytest.mark.asyncio
async def test_cogs_is_incremental_and_reversible(co_client, db_session, seeded):
    cid, oid = seeded["company_id"], seeded["manufacturing_order_id"]
    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/post-production-completion")
    assert r.status_code == 200, r.text
    fg_value = sum(Decimal(l["amount_actual"]) for l in r.json()["cost_lines"])
    unit = fg_value / Decimal("10")

    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/post-cogs-issue")
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["qty_cogs_posted"]) == Decimal("4")
    assert r.json()["settlement_status"] == "cogs_partial"
    # nothing new delivered -> a second COGS posting is refused instead of double counting
    assert (await co_client.post(f"{CO}/manufacturing-orders/{oid}/post-cogs-issue")).status_code == 409

    # 2 more units received -> only those 2 are released
    rec = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": cid, "order_id": oid, "movement_type": "fg_receipt",
        "posting_date": str(date.today()), "qty": "2", "unit_cost": "0",
    })
    assert rec.status_code == 200, rec.text
    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/post-cogs-issue")
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["qty_cogs_posted"]) == Decimal("6")
    rows = (await db_session.execute(
        select(CoCostBooking).where(
            CoCostBooking.order_id == uuid.UUID(oid), CoCostBooking.booking_type == "cogs_issue"
        ).order_by(CoCostBooking.created_at)
    )).scalars().all()
    assert [Decimal(b.qty_basis) for b in rows] == [Decimal("4"), Decimal("2")]
    assert Decimal(rows[1].amount) == (unit * 2).quantize(Decimal("0.0001"))

    # completion cannot be reversed while COGS stands; COGS reverses last-in-first-out
    assert (await co_client.post(
        f"{CO}/manufacturing-orders/{oid}/reverse-production-completion", json={"reason": "nope"}
    )).status_code == 409
    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/reverse-cogs-issue", json={"reason": "wrong qty"})
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["qty_cogs_posted"]) == Decimal("4")
    r = await co_client.post(f"{CO}/manufacturing-orders/{oid}/reverse-cogs-issue", json={"reason": "again"})
    assert Decimal(r.json()["qty_cogs_posted"]) == Decimal("0")
    assert r.json()["settlement_status"] == "production_posted"
    assert (await co_client.post(f"{CO}/manufacturing-orders/{oid}/reverse-cogs-issue", json={"reason": "x y z"})).status_code == 409


@pytest.mark.asyncio
async def test_receipt_return_blocked_after_cogs(co_client, seeded):
    cid, oid = seeded["company_id"], seeded["manufacturing_order_id"]
    assert (await co_client.post(f"{CO}/manufacturing-orders/{oid}/post-production-completion")).status_code == 200
    assert (await co_client.post(f"{CO}/manufacturing-orders/{oid}/post-cogs-issue")).status_code == 200
    r = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": cid, "order_id": oid, "movement_type": "fg_receipt_reversal",
        "posting_date": str(date.today()), "qty": "1", "unit_cost": "0",
    })
    assert r.status_code == 409, r.text


# ── Phase 3: WIP accumulation mode ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_wip_mode_journals_issues_and_confirmations(co_client, db_session, seeded, test_vendor):
    cid, oid, comp = seeded["company_id"], seeded["manufacturing_order_id"], seeded["product_component_id"]
    absorb = FinAccount(
        id=uuid.uuid4(), vendor_id=test_vendor.id, code="1190", name="Conversion cost absorbed",
        account_type="Asset", account_subtype="Current Asset", is_active=True,
    )
    db_session.add(absorb)
    await db_session.commit()
    absorb_id = str(absorb.id)

    r = await co_client.put(f"{CO}/co-gl-mapping", json={
        "company_id": cid, "absorption_account_id": absorb_id, "post_wip_to_gl": True,
    })
    assert r.status_code == 200, r.text
    assert r.json()["post_wip_to_gl"] is True

    r = await co_client.post(f"{CO}/goods-movements", json={
        "company_id": cid, "order_id": oid, "movement_type": "component_issue",
        "posting_date": str(date.today()), "product_id": comp, "qty": "2", "unit_cost": "10",
    })
    assert r.status_code == 200, r.text
    gm = r.json()
    assert gm["journal_entry_id"]
    dr, cr, status = await _journal_total(db_session, uuid.UUID(gm["journal_entry_id"]))
    assert dr == cr == Decimal("20") and status == "posted"

    r = await co_client.post(f"{CO}/activity-confirmations", json={
        "company_id": cid, "order_id": oid, "confirmation_date": str(date.today()),
        "hours_confirmed": "3", "rate_per_hour": "5",
    })
    assert r.status_code == 200, r.text
    conf = r.json()
    assert conf["journal_entry_id"]
    # a journalled confirmation cannot be edited, only reversed (kept for audit, status reversed)
    assert (await co_client.patch(f"{CO}/activity-confirmations/{conf['id']}", json={"hours_confirmed": "9"})).status_code == 409
    assert (await co_client.delete(f"{CO}/activity-confirmations/{conf['id']}")).status_code == 204
    assert (await _journal_total(db_session, uuid.UUID(conf["journal_entry_id"])))[2] == "void"

    r = await co_client.post(f"{CO}/goods-movements/{gm['id']}/reverse", json={"reason": "undo"})
    assert r.status_code == 200, r.text
    assert (await _journal_total(db_session, uuid.UUID(gm["journal_entry_id"])))[2] == "void"
    counter = (await db_session.execute(
        select(CoGoodsMovement).where(CoGoodsMovement.order_id == uuid.UUID(oid), CoGoodsMovement.movement_type == "component_return")
    )).scalars().all()
    assert len(counter) == 1 and counter[0].journal_entry_id is None  # net effect on the GL is nil


@pytest.mark.asyncio
async def test_wip_mode_requires_configured_accounts(co_client, seeded):
    cid, oid, comp = seeded["company_id"], seeded["manufacturing_order_id"], seeded["product_component_id"]
    await co_client.put(f"{CO}/co-gl-mapping", json={"company_id": cid, "post_wip_to_gl": True})
    r = await co_client.post(f"{CO}/activity-confirmations", json={
        "company_id": cid, "order_id": oid, "confirmation_date": str(date.today()),
        "hours_confirmed": "1", "rate_per_hour": "5",
    })
    assert r.status_code == 422
    assert "absorption" in r.json()["detail"]


# ── Phase 3: cost allocations ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cost_allocation_posts_and_reverses_a_journal(co_client, db_session, seeded, test_vendor):
    cid = seeded["company_id"]
    accounts = (await db_session.execute(
        select(FinAccount).where(FinAccount.vendor_id == test_vendor.id, FinAccount.code.in_(["1170", "5110"]))
    )).scalars().all()
    by_code = {a.code: str(a.id) for a in accounts}
    base = {
        "company_id": cid, "period_year": date.today().year, "period_month": date.today().month,
        "allocated_amount": "250", "allocation_method": "fixed_amount", "allocation_value": "250",
    }
    # no accounts -> cannot post
    r = await co_client.post(f"{CO}/cost-allocations", json=base)
    assert r.status_code == 200, r.text
    assert (await co_client.post(f"{CO}/cost-allocations/{r.json()['id']}/post", json={})).status_code == 422

    r = await co_client.post(f"{CO}/cost-allocations", json={
        **base, "sender_account_id": by_code["5110"], "receiver_account_id": by_code["1170"],
    })
    alloc_id = r.json()["id"]
    r = await co_client.post(f"{CO}/cost-allocations/{alloc_id}/post", json={})
    assert r.status_code == 200, r.text
    je_id = r.json()["journal_entry_id"]
    assert je_id
    dr, cr, status = await _journal_total(db_session, uuid.UUID(je_id))
    assert dr == cr == Decimal("250") and status == "posted"
    assert (await co_client.post(f"{CO}/cost-allocations/{alloc_id}/post", json={})).status_code == 409

    r = await co_client.post(f"{CO}/cost-allocations/{alloc_id}/reverse", json={"reason": "wrong receiver"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "reversed"
    assert (await _journal_total(db_session, uuid.UUID(je_id)))[2] == "void"
    assert (await co_client.post(f"{CO}/cost-allocations/{alloc_id}/post", json={})).status_code == 409


# ── Phase 3: variance runs ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_variance_run_covers_each_order_once(co_client, db_session, seeded):
    cid, oid = seeded["company_id"], seeded["manufacturing_order_id"]
    today = date.today()
    run_body = {"company_id": cid, "period_year": today.year, "period_month": today.month, "run_date": str(today)}

    # nothing completed yet -> nothing to settle
    assert (await co_client.post(f"{CO}/variance-runs", json=run_body)).status_code == 422

    assert (await _transition(co_client, oid, "completed")).status_code == 200
    r = await co_client.post(f"{CO}/variance-runs", json=run_body)
    assert r.status_code == 200, r.text
    run = r.json()
    assert run["order_count"] == 1
    assert Decimal(run["total_variance"]) == Decimal(run["total_actual"]) - Decimal(run["total_planned"])
    # the order is held by that run -> a second run for the same period finds nothing
    assert (await co_client.post(f"{CO}/variance-runs", json=run_body)).status_code == 422

    # posting is a reporting / lock step by default: no journal, orders stay locked
    r = await co_client.post(f"{CO}/variance-runs/{run['id']}/post", json={})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "posted" and r.json()["journal_entry_id"] is None
    assert (await co_client.post(f"{CO}/variance-runs/{run['id']}/post", json={})).status_code == 409
    assert (await co_client.delete(f"{CO}/variance-runs/{run['id']}")).status_code == 409

    # reversing the run frees the order again
    r = await co_client.post(f"{CO}/variance-runs/{run['id']}/reverse", json={"reason": "re-run"})
    assert r.status_code == 200 and r.json()["status"] == "reversed"
    r = await co_client.post(f"{CO}/variance-runs", json=run_body)
    assert r.status_code == 200, r.text
    # an open run can simply be discarded
    assert (await co_client.delete(f"{CO}/variance-runs/{r.json()['id']}")).status_code == 204


@pytest.mark.asyncio
async def test_variance_run_gl_posting_is_opt_in(co_client, db_session, seeded, test_vendor):
    cid, oid = seeded["company_id"], seeded["manufacturing_order_id"]
    today = date.today()
    var_acc = FinAccount(
        id=uuid.uuid4(), vendor_id=test_vendor.id, code="5190", name="Production variance",
        account_type="Expense", account_subtype="Cost of Goods Sold", is_active=True,
    )
    db_session.add(var_acc)
    await db_session.commit()
    var_acc_id = str(var_acc.id)
    assert (await co_client.put(f"{CO}/co-gl-mapping", json={
        "company_id": cid, "production_variance_account_id": var_acc_id,
    })).status_code == 200
    assert (await _transition(co_client, oid, "completed")).status_code == 200
    run = (await co_client.post(f"{CO}/variance-runs", json={
        "company_id": cid, "period_year": today.year, "period_month": today.month, "run_date": str(today),
    })).json()
    r = await co_client.post(f"{CO}/variance-runs/{run['id']}/post", json={"post_to_gl": True})
    assert r.status_code == 200, r.text
    if Decimal(run["total_variance"]) != 0:
        assert r.json()["journal_entry_id"]
    # a posted run blocks reversing the order's completion posting
    cur = await co_client.post(f"{CO}/manufacturing-orders/{oid}/reverse-production-completion", json={"reason": "late fix"})
    assert cur.status_code == 409
