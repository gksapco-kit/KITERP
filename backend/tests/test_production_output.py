"""Partial output (phase 5): receive part of a run into stock before completion."""
import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.finance import FinJournalEntry
from app.models.mrp import StockReservation
from app.models.procurement_special import MaterialValuation
from app.models.store import StoreInventory
from tests.test_production_costing import (  # noqa: F401 — shared fixtures
    BASE, bom, component, finished, gl, owner, store, _product,
)

pytestmark = pytest.mark.asyncio


class Ctx:
    """Plain ids/handles, so nothing depends on ORM objects that a rollback expires."""

    def __init__(self, db, client, owner, user, finished, component, store):
        self.db, self.client, self.owner, self.user = db, client, owner, user
        self.fid, self.cid, self.sid = str(finished.id), str(component.id), str(store.id)
        self.vendor_id = finished.vendor_id

    async def heal(self):
        await self.db.refresh(self.user)
        await self.db.refresh(self.owner)

    def body(self, qty=10, status="confirmed"):
        return {
            "type": "mts", "status": status, "store_id": self.sid,
            "items": [{"item_type": "product", "product_id": self.fid, "qty": qty, "name": "T-Shirt"}],
        }

    async def order(self, qty=10, status="in_production"):
        r = await self.client.post(f"{BASE}/production-orders", json=self.body(qty, "confirmed"))
        assert r.status_code == 201, r.text
        oid = r.json()["id"]
        if status != "confirmed":
            moved = await self.client.put(f"{BASE}/production-orders/{oid}", json={"status": status})
            assert moved.status_code == 200, moved.text
        return oid

    async def output(self, oid, qty):
        return await self.client.post(
            f"{BASE}/production-orders/{oid}/outputs", json={"items": [{"product_id": self.fid, "qty": qty}]},
        )

    async def stock(self, product_id):
        return int((await self.db.execute(
            select(func.coalesce(func.sum(StoreInventory.quantity), 0)).where(
                StoreInventory.store_id == uuid.UUID(self.sid), StoreInventory.product_id == uuid.UUID(product_id),
            )
        )).scalar())

    async def reserved(self, oid):
        rows = (await self.db.execute(select(StockReservation).where(
            StockReservation.order_id == oid, StockReservation.product_id == uuid.UUID(self.cid),
        ))).scalars().all()
        return [(r.status, Decimal(r.reserved_qty)) for r in rows]

    async def journals(self):
        return (await self.db.execute(select(FinJournalEntry).where(
            FinJournalEntry.vendor_id == self.vendor_id, FinJournalEntry.source_type == "co_cost_booking",
            FinJournalEntry.status == "posted",
        ))).scalars().all()


@pytest.fixture
def ctx(client, db_session, owner, test_user, finished, component, store, bom, gl):
    return Ctx(db_session, client, owner, test_user, finished, component, store)


async def test_partial_output_receives_goods_and_consumes_their_share(ctx):
    oid = await ctx.order(10)
    r = await ctx.output(oid, 4)
    assert r.status_code == 201, r.text
    summary = r.json()
    assert summary["products"][0] == {
        "product_id": ctx.fid, "name": "T-Shirt", "ordered": 10, "produced": 4, "remaining": 6,
    }
    assert len(summary["outputs"]) == 1 and summary["outputs"][0]["qty"] == 4

    assert await ctx.stock(ctx.fid) == 4
    assert await ctx.stock(ctx.cid) == 100 - 12            # 30 fabric x 4/10
    assert await ctx.reserved(oid) == [("active", Decimal("18"))]  # the hold shrinks with what left stock

    order = (await ctx.client.get(f"{BASE}/production-orders/{oid}")).json()
    assert order["items"][0]["produced"] == 4 and order["progress"] == 40
    assert order["status"] == "in_production" and order["inventory_posted_at"] is None
    assert "output_recorded" in [e["action"] for e in order["audit_log"]]

    # Material cost only: 12 x 10 = 120 over 4 shirts.
    mv = (await ctx.db.execute(select(MaterialValuation).where(
        MaterialValuation.product_id == uuid.UUID(ctx.fid)))).scalar_one()
    assert mv.total_stock == Decimal("4") and mv.moving_avg_price == Decimal("30.0000")


async def test_completion_posts_the_remainder_and_one_journal_for_the_whole_run(ctx):
    oid = await ctx.order(10)
    assert (await ctx.output(oid, 4)).status_code == 201
    done = await ctx.client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    assert done.status_code == 200, done.text

    assert await ctx.stock(ctx.fid) == 10
    assert await ctx.stock(ctx.cid) == 70
    order = (await ctx.client.get(f"{BASE}/production-orders/{oid}")).json()
    posting = order["inventory_posting"]
    assert posting["costing"]["material"] == "300.00" and posting["costing"]["total"] == "300.00"
    assert posting["costing"]["partial_outputs"] == 1
    assert sorted(c["qty"] for c in posting["components"]) == [12, 18]
    assert sorted(g["qty"] for g in posting["goods"]) == [4, 6]
    assert Decimal(str(order["actual_material_cost"])) == Decimal("300.00")
    assert order["items"][0]["produced"] == 10 and order["progress"] == 100
    assert [s for s, _ in await ctx.reserved(oid)] == ["consumed"]

    jes = await ctx.journals()
    assert len(jes) == 1 and jes[0].total_debit == jes[0].total_credit == Decimal("300")
    mv = (await ctx.db.execute(select(MaterialValuation).where(
        MaterialValuation.product_id == uuid.UUID(ctx.fid)))).scalar_one()
    assert mv.total_stock == Decimal("10") and mv.moving_avg_price == Decimal("30.0000")


async def test_labor_is_absorbed_by_the_final_receipt(ctx):
    wc = await ctx.client.post(f"{BASE}/work-centers", json={"name": "Sewing", "cost_per_hour": 50})
    oid = await ctx.order(10)
    op = await ctx.client.post(f"{BASE}/production-orders/{oid}/operations", json={
        "name": "Stitch", "work_center_id": wc.json()["id"], "planned_hours": 2, "actual_hours": 2,
    })
    assert op.status_code == 201, op.text
    assert (await ctx.output(oid, 4)).status_code == 201
    done = await ctx.client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    assert done.status_code == 200, done.text

    posting = (await ctx.client.get(f"{BASE}/production-orders/{oid}")).json()["inventory_posting"]
    assert posting["costing"]["material"] == "300.00"
    assert posting["costing"]["labor"] == "100.00"
    assert posting["costing"]["total"] == "400.00"
    assert posting["costing"]["unit_cost"] == "40.0000"          # blended over all 10
    assert posting["costing"]["final_unit_cost"] == "46.6667"    # (180 + 100) / 6
    mv = (await ctx.db.execute(select(MaterialValuation).where(
        MaterialValuation.product_id == uuid.UUID(ctx.fid)))).scalar_one()
    assert mv.total_stock == Decimal("10") and mv.moving_avg_price == Decimal("40.0000")
    assert (await ctx.journals())[0].total_debit == Decimal("400")


async def test_invalid_output_is_rejected(ctx):
    oid = await ctx.order(10)
    assert (await ctx.output(oid, 0)).status_code == 422                     # schema: qty > 0
    over = await ctx.output(oid, 11)
    await ctx.heal()
    assert over.status_code == 400 and "remain" in over.json()["detail"]
    whole = await ctx.output(oid, 10)
    await ctx.heal()
    assert whole.status_code == 400 and "Complete the order" in whole.json()["detail"]
    assert await ctx.stock(ctx.fid) == 0 and await ctx.stock(ctx.cid) == 100


async def test_output_requires_the_order_to_be_in_production(ctx):
    oid = await ctx.order(10, status="confirmed")
    r = await ctx.output(oid, 3)
    await ctx.heal()
    assert r.status_code == 409 and "in production" in r.json()["detail"]


async def test_reversing_an_output_restores_stock_hold_and_valuation(ctx):
    oid = await ctx.order(10)
    out_id = (await ctx.output(oid, 4)).json()["outputs"][0]["id"]
    r = await ctx.client.delete(f"{BASE}/production-orders/{oid}/outputs/{out_id}")
    assert r.status_code == 200, r.text
    assert r.json()["outputs"] == [] and r.json()["products"][0]["produced"] == 0

    assert await ctx.stock(ctx.fid) == 0 and await ctx.stock(ctx.cid) == 100
    assert await ctx.reserved(oid) == [("active", Decimal("30"))]
    order = (await ctx.client.get(f"{BASE}/production-orders/{oid}")).json()
    assert order["items"][0]["produced"] == 0 and order["progress"] == 0
    mv = (await ctx.db.execute(select(MaterialValuation).where(
        MaterialValuation.product_id == uuid.UUID(ctx.fid)))).scalar_one()
    assert mv.total_stock == Decimal("0")


async def test_reversal_is_refused_when_the_goods_were_already_used(ctx):
    oid = await ctx.order(10)
    out_id = (await ctx.output(oid, 4)).json()["outputs"][0]["id"]
    row = (await ctx.db.execute(select(StoreInventory).where(
        StoreInventory.store_id == uuid.UUID(ctx.sid), StoreInventory.product_id == uuid.UUID(ctx.fid)))).scalar_one()
    row.quantity = 1  # 3 of the 4 shirts were sold
    await ctx.db.commit()
    await ctx.heal()

    r = await ctx.client.delete(f"{BASE}/production-orders/{oid}/outputs/{out_id}")
    await ctx.heal()
    assert r.status_code == 409
    assert await ctx.stock(ctx.cid) == 88  # nothing was half-reversed


async def test_cancel_and_draft_are_blocked_while_output_is_in_stock(ctx):
    oid = await ctx.order(10)
    out_id = (await ctx.output(oid, 4)).json()["outputs"][0]["id"]
    blocked = await ctx.client.put(f"{BASE}/production-orders/{oid}", json={"status": "cancelled"})
    await ctx.heal()
    assert blocked.status_code == 409 and "Reverse the recorded output" in blocked.json()["detail"]

    assert (await ctx.client.delete(f"{BASE}/production-orders/{oid}/outputs/{out_id}")).status_code == 200
    ok = await ctx.client.put(f"{BASE}/production-orders/{oid}", json={"status": "cancelled"})
    assert ok.status_code == 200, ok.text


async def test_reopen_reverses_only_the_final_receipt(ctx):
    oid = await ctx.order(10)
    assert (await ctx.output(oid, 4)).status_code == 201
    assert (await ctx.client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})).status_code == 200

    back = await ctx.client.put(f"{BASE}/production-orders/{oid}", json={"status": "in_production"})
    assert back.status_code == 200, back.text
    assert await ctx.stock(ctx.fid) == 4 and await ctx.stock(ctx.cid) == 88
    assert await ctx.journals() == []
    assert await ctx.reserved(oid) == [("active", Decimal("18"))]
    order = (await ctx.client.get(f"{BASE}/production-orders/{oid}")).json()
    assert order["inventory_posting"] is None
    assert Decimal(str(order["actual_material_cost"])) == Decimal("120")

    again = await ctx.client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})
    assert again.status_code == 200, again.text
    assert await ctx.stock(ctx.fid) == 10 and await ctx.stock(ctx.cid) == 70
    assert len(await ctx.journals()) == 1


async def test_reconciliation_stays_clean_with_partial_output(ctx, gl):
    oid = await ctx.order(10)
    assert (await ctx.output(oid, 3)).status_code == 201
    assert (await ctx.client.get(f"{BASE}/production/reconciliation")).json()["total"] == 0

    assert (await ctx.client.put(f"{BASE}/production-orders/{oid}", json={"status": "completed"})).status_code == 200
    report = (await ctx.client.get(f"{BASE}/production/reconciliation")).json()
    assert report["total"] == 0, report["issues"]


async def test_only_production_managers_can_record_output(ctx, test_vendor):
    oid = await ctx.order(10)
    ctx.owner.permissions = ["production.view"]
    ctx.owner.role = "staff"
    await ctx.db.commit()
    await ctx.heal()
    assert (await ctx.client.get(f"{BASE}/production-orders/{oid}/outputs")).status_code == 200
    r = await ctx.output(oid, 2)
    assert r.status_code == 403
