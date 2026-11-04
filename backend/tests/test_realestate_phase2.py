"""Real estate — Phase 2: payment schedule, demands, receipts, tax & compliance, broker commissions."""
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import update

from tests.test_realestate_phase1 import B, _customer, _post, _setup_inventory


async def _plan(client, project_id, stages, name="Plan", default=True):
    plan = await _post(client, "/payment-plans", {"project_id": project_id, "name": name, "is_default": default})
    for i, (sname, pct, trig, days, milestone) in enumerate(stages, 1):
        await _post(client, "/payment-plan-stages", {
            "plan_id": plan["id"], "seq": i, "name": sname, "percent": pct, "trigger_type": trig,
            "trigger_days": days, "milestone_name": milestone,
        })
    return plan


async def _book(client, project, unit_idx=0, **extra):
    units = (await client.get(f"{B}/units", params={"project_id": project["id"], "size": 100})).json()["items"]
    unit = sorted(units, key=lambda u: u["unit_number"])[unit_idx]
    cust = await _customer(client, f"Buyer {unit_idx}", f"90000000{unit_idx:02d}")
    return await _post(client, "/bookings", {"unit_id": unit["id"], "customer_id": cust["id"], **extra})


async def _finance(client, booking_id):
    return (await client.get(f"{B}/bookings/{booking_id}/finance")).json()


async def _sign_agreement(client, booking_id):
    await _post(client, f"/bookings/{booking_id}/allot", status=200)
    ag = await _post(client, f"/bookings/{booking_id}/agreement", {"agreement_type": "agreement_for_sale"}, status=200)
    await _post(client, f"/agreements/{ag['agreement_id']}/sign", {}, status=200)
    return ag


STD_PLAN = [("Booking", 10, "on_booking", 0, None), ("On agreement", 90, "on_agreement", 0, None)]


@pytest.mark.asyncio
async def test_schedule_is_built_and_first_demand_issued(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)
    assert b["agreement_value"] == 5_000_000
    fin = await _finance(client, b["id"])
    assert [i["status"] for i in fin["schedule"]] == ["demanded", "scheduled"]
    assert fin["payable_total"] == 5_250_000  # agreement + 5% GST
    assert fin["schedule"][0]["total_due"] == 525_000
    assert len(fin["demands"]) == 1 and fin["demands"][0]["total_amount"] == 525_000
    letter = (await client.get(f"{B}/demands/{fin['demands'][0]['id']}/letter")).json()
    assert fin["demands"][0]["demand_no"] in letter["html"] or "525,000" in letter["html"]


@pytest.mark.asyncio
async def test_plan_must_total_100_percent(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], [("A", 50, "on_booking", 0, None), ("B", 40, "on_agreement", 0, None)], name="Bad")
    units = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"]
    cust = await _customer(client)
    r = await client.post(f"{B}/bookings", json={"unit_id": units[0]["id"], "customer_id": cust["id"]})
    assert r.status_code == 422 and "100%" in r.text


@pytest.mark.asyncio
async def test_rera_caps_demands_before_agreement(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], [("Booking", 15, "on_booking", 0, None), ("Rest", 85, "days_after_booking", 30, None)])
    b = await _book(client, project)
    fin = await _finance(client, b["id"])
    assert fin["demands"] == [] and fin["schedule"][0]["status"] == "due"  # 15% > 10% cap -> not demanded
    item = fin["schedule"][0]
    r = await client.post(f"{B}/payment-schedule/{item['id']}/demand")
    assert r.status_code == 409 and "RERA" in r.text


@pytest.mark.asyncio
async def test_receipts_clearing_bounce_allocation_and_tds(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)

    # online payment with 1% TDS withheld by the buyer clears immediately and settles demand 1
    rec = await _post(client, "/receipts", {
        "booking_id": b["id"], "amount": 520_000, "tds_amount": 5_000, "mode": "neft", "reference_no": "UTR1",
    })
    assert rec["status"] == "cleared" and rec["gross_amount"] == 525_000
    fin = await _finance(client, b["id"])
    assert fin["paid"] == 525_000 and fin["demands"][0]["status"] == "paid"
    assert fin["schedule"][0]["status"] == "paid"
    tds = (await client.get(f"{B}/tds-entries")).json()
    assert tds["total"] == 1 and tds["items"][0]["status"] == "pending_deposit" and tds["items"][0]["tds_amount"] == 5_000
    early = await client.post(f"{B}/tds-entries/{tds['items'][0]['id']}/certificate", json={"certificate_no": "X"})
    assert early.status_code == 409
    await _post(client, f"/tds-entries/{tds['items'][0]['id']}/deposit", {"challan_no": "CH1"}, status=200)
    await _post(client, f"/tds-entries/{tds['items'][0]['id']}/certificate", {"certificate_no": "16B-1"}, status=200)

    # cheques wait for the bank
    chq = await _post(client, "/receipts", {"booking_id": b["id"], "amount": 100_000, "mode": "cheque", "reference_no": "000123"})
    assert chq["status"] == "received"
    assert (await _finance(client, b["id"]))["paid"] == 525_000
    no_reason = await client.post(f"{B}/receipts/{chq['id']}/bounce", json={})
    assert no_reason.status_code == 422
    await _post(client, f"/receipts/{chq['id']}/bounce", {"reason": "insufficient funds"}, status=200)
    assert (await client.get(f"{B}/receipts/{chq['id']}")).json()["status"] == "bounced"
    again = await client.post(f"{B}/receipts/{chq['id']}/clear", json={})
    assert again.status_code == 409

    # a second cheque clears and is held as an advance until demand 2 is raised
    chq2 = await _post(client, "/receipts", {"booking_id": b["id"], "amount": 100_000, "mode": "cheque"})
    await _post(client, f"/receipts/{chq2['id']}/clear", {}, status=200)
    fin = await _finance(client, b["id"])
    assert fin["paid"] == 625_000
    assert (await client.get(f"{B}/receipts/{chq2['id']}")).json()["allocated_amount"] == 0

    # signing the agreement makes instalment 2 due and raises its demand; the advance is applied to it
    await _sign_agreement(client, b["id"])
    fin = await _finance(client, b["id"])
    d2 = next(d for d in fin["demands"] if d["stage_name"] == "On agreement")
    assert d2["total_amount"] == 4_725_000 and d2["paid_amount"] == 100_000 and d2["status"] == "partial"
    assert fin["balance"] == 5_250_000 - 625_000

    # cannot receive more than is payable
    over = await client.post(f"{B}/receipts", json={"booking_id": b["id"], "amount": 9_000_000, "mode": "neft"})
    assert over.status_code == 409

    # cleared receipts cannot be cancelled
    cancel = await client.post(f"{B}/receipts/{rec['id']}/cancel", json={"reason": "x"})
    assert cancel.status_code == 409

    gst = (await client.get(f"{B}/tax/gst-summary")).json()
    assert gst["invoiced"]["gst"] == 25_000 + 225_000
    assert gst["received"]["gross"] == 625_000


@pytest.mark.asyncio
async def test_cancel_demand_and_regenerate_guard(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)
    fin = await _finance(client, b["id"])
    # the schedule already has a demand -> cannot be regenerated
    r = await client.post(f"{B}/bookings/{b['id']}/schedule/regenerate", json={})
    assert r.status_code == 409
    await _post(client, f"/demands/{fin['demands'][0]['id']}/cancel", {"reason": "issued in error"}, status=200)
    fin = await _finance(client, b["id"])
    assert fin["schedule"][0]["status"] == "due"
    # re-raise it
    res = await _post(client, f"/bookings/{b['id']}/raise-demands", status=200)
    assert len(res["created"]) == 1
    # a booking with a demand that has money against it cannot lose the demand
    await _post(client, "/receipts", {"booking_id": b["id"], "amount": 525_000, "mode": "upi"})
    fin = await _finance(client, b["id"])
    live = next(d for d in fin["demands"] if d["status"] == "paid")
    r = await client.post(f"{B}/demands/{live['id']}/cancel", json={"reason": "no"})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_overdue_and_interest(client, test_vendor_user, db_session):
    from app.models.realestate.receivables import ReDemand

    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)
    assert (await client.get(f"{B}/collections/overdue")).json()["count"] == 0
    await db_session.execute(update(ReDemand).values(due_date=date.today() - timedelta(days=40)))
    await db_session.commit()
    rep = (await client.get(f"{B}/collections/overdue")).json()
    assert rep["count"] == 1 and rep["items"][0]["days_overdue"] == 40
    assert rep["buckets"]["31-60"]["amount"] == 525_000
    # 10.5% p.a. for 40 days on 525,000
    assert rep["total_interest"] == pytest.approx(525_000 * 0.105 * 40 / 365, abs=1)
    ageing = (await client.get(f"{B}/collections/receivables-ageing")).json()
    assert ageing["totals"]["d31_60"] == 525_000
    summary = (await client.get(f"{B}/collections/summary")).json()
    assert summary["overdue"] == 525_000 and summary["bookings"] == 1
    fin = await _finance(client, b["id"])
    assert fin["overdue"] == 525_000 and fin["interest_accrued"] > 0
    alerts = (await client.get(f"{B}/alerts")).json()
    assert any("overdue" in a["title"].lower() for a in alerts["items"])


@pytest.mark.asyncio
async def test_milestone_triggers_demands(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], [
        ("Booking", 10, "on_booking", 0, None), ("Plinth", 40, "milestone", 0, "Plinth"),
        ("Possession", 50, "on_possession", 0, None)])
    b = await _book(client, project)
    await _sign_agreement(client, b["id"])  # lifts the pre-agreement RERA cap
    res = await _post(client, f"/projects/{project['id']}/trigger-milestone", {"milestone_name": "plinth"}, status=200)
    assert res["instalments_triggered"] == 1 and res["demands_created"] == 1
    fin = await _finance(client, b["id"])
    plinth = next(d for d in fin["demands"] if d["stage_name"] == "Plinth")
    assert plinth["total_amount"] == 2_100_000
    assert plinth["due_date"] == (date.today() + timedelta(days=15)).isoformat()
    # idempotent
    again = await _post(client, f"/projects/{project['id']}/trigger-milestone", {"milestone_name": "Plinth"}, status=200)
    assert again["instalments_triggered"] == 0


@pytest.mark.asyncio
async def test_commission_settlement_and_clawback_on_cancellation(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    broker = await _post(client, "/brokers", {"name": "Prime Realty", "pan": "AAAPA1234A"})
    assert broker["tds_percent"] == 2
    await _post(client, "/commission-rules", {
        "name": "Standard 2%", "basis": "percent_of_agreement", "rate": 2, "payout_trigger": "on_booking"})
    b = await _book(client, project, broker_id=broker["id"])
    coms = (await client.get(f"{B}/commissions", params={"booking_id": b["id"]})).json()["items"]
    assert len(coms) == 1 and coms[0]["gross_amount"] == 100_000 and coms[0]["status"] == "eligible"
    assert coms[0]["tds_amount"] == 2_000

    settle = await _post(client, f"/brokers/{broker['id']}/settle", {"mode": "neft"})
    assert settle["gross_amount"] == 100_000 and settle["tds_amount"] == 2_000 and settle["status"] == "approved"
    nothing = await client.post(f"{B}/brokers/{broker['id']}/settle", json={})
    assert nothing.status_code == 409
    await _post(client, f"/settlements/{settle['id']}/pay", {"mode": "neft", "reference_no": "UTR9"}, status=200)
    assert (await client.get(f"{B}/settlements/{settle['id']}")).json()["status"] == "paid"
    assert (await client.get(f"{B}/commissions/{coms[0]['id']}")).json()["status"] == "settled"

    # booking cancelled after the commission was paid -> clawback row
    await _post(client, f"/bookings/{b['id']}/cancel-request", {"reason": "buyer withdrew", "forfeiture_percent": 10}, status=200)
    canc = (await client.get(f"{B}/cancellations")).json()["items"][0]
    await _post(client, f"/cancellations/{canc['id']}/approve", status=200)
    coms = (await client.get(f"{B}/commissions", params={"booking_id": b["id"], "kind": "clawback"})).json()["items"]
    assert len(coms) == 1 and coms[0]["net_amount"] < 0
    stmt = (await client.get(f"{B}/brokers/{broker['id']}/statement")).json()
    assert stmt["broker"] == "Prime Realty" and stmt["payable_now"] < 0 and stmt["paid_to_date"] > 0
    blocked = await client.post(f"{B}/brokers/{broker['id']}/settle", json={})
    assert blocked.status_code == 409  # clawback carries forward


@pytest.mark.asyncio
async def test_commission_waits_for_agreement_trigger_and_cancellation_reverses_unpaid(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    broker = await _post(client, "/brokers", {"name": "Late Payer"})
    await _post(client, "/commission-rules", {
        "name": "On agreement", "basis": "percent_of_agreement", "rate": 1, "payout_trigger": "on_agreement"})
    b = await _book(client, project, broker_id=broker["id"])
    com = (await client.get(f"{B}/commissions", params={"booking_id": b["id"]})).json()["items"][0]
    assert com["status"] == "accrued"
    assert (await client.post(f"{B}/brokers/{broker['id']}/settle", json={})).status_code == 409
    await _sign_agreement(client, b["id"])
    com = (await client.get(f"{B}/commissions/{com['id']}")).json()
    assert com["status"] == "eligible"
    # cancel before settlement: unpaid commission is simply reversed
    await _post(client, f"/bookings/{b['id']}/cancel-request", {"reason": "x"}, status=200)
    canc = (await client.get(f"{B}/cancellations")).json()["items"][0]
    await _post(client, f"/cancellations/{canc['id']}/approve", status=200)
    com = (await client.get(f"{B}/commissions/{com['id']}")).json()
    assert com["status"] == "reversed"


@pytest.mark.asyncio
async def test_settlement_needs_approval_when_rule_matches(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    broker = await _post(client, "/brokers", {"name": "Big Broker"})
    await _post(client, "/commission-rules", {"name": "2%", "basis": "percent_of_agreement", "rate": 2, "payout_trigger": "on_booking"})
    await _post(client, "/approval-rules", {"entity_type": "settlement", "name": "Large payouts", "field": "amount", "min_value": 50_000})
    await _book(client, project, broker_id=broker["id"])
    s = await _post(client, f"/brokers/{broker['id']}/settle", {})
    assert s["status"] == "pending_approval"
    early = await client.post(f"{B}/settlements/{s['id']}/pay", json={})
    assert early.status_code == 409
    req = (await client.get(f"{B}/approval-requests", params={"status": "pending"})).json()["items"][0]
    await _post(client, f"/approval-requests/{req['id']}/approve", {"comments": "ok"}, status=200)
    assert (await client.get(f"{B}/settlements/{s['id']}")).json()["status"] == "approved"


@pytest.mark.asyncio
async def test_incentive_tds_and_approval(client, test_vendor_user):
    broker = await _post(client, "/brokers", {"name": "Star", "tds_percent": 2})
    inc = await _post(client, "/incentives", {"broker_id": broker["id"], "scheme_name": "Diwali bonus", "amount": 50_000})
    assert inc["status"] == "proposed" and inc["tds_amount"] == 1_000
    await _post(client, f"/incentives/{inc['id']}/approve", status=200)
    assert (await client.get(f"{B}/incentives/{inc['id']}")).json()["status"] == "approved"
    s = await _post(client, f"/brokers/{broker['id']}/settle", {})
    assert s["gross_amount"] == 50_000 and s["net_amount"] == 49_000


@pytest.mark.asyncio
async def test_commission_rule_validation(client, test_vendor_user):
    r = await client.post(f"{B}/commission-rules", json={"name": "bad", "rate": 150})
    assert r.status_code == 422
    r = await client.post(f"{B}/commission-rules", json={"name": "fixed", "basis": "fixed_per_unit", "rate": 0})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_rera_account_withdrawal_limits(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)
    await _post(client, "/receipts", {"booking_id": b["id"], "amount": 525_000, "mode": "neft"})
    dep = await _post(client, "/rera-entries", {
        "project_id": project["id"], "kind": "deposit", "amount": 1_000_000, "entry_date": date.today().isoformat()})
    assert dep["status"] == "approved"

    # status cannot be forced through the API
    forced = await _post(client, "/rera-entries", {
        "project_id": project["id"], "kind": "withdrawal", "amount": 100, "status": "approved",
        "entry_date": date.today().isoformat()})
    assert forced["status"] == "requested"
    await _post(client, f"/rera-entries/{forced['id']}/reject", {"remarks": "test"}, status=200)

    wd = await _post(client, "/rera-entries", {
        "project_id": project["id"], "kind": "withdrawal", "amount": 400_000, "entry_date": date.today().isoformat()})
    needs_cert = await client.post(f"{B}/rera-entries/{wd['id']}/approve", json={})
    assert needs_cert.status_code == 422
    await client.patch(f"{B}/rera-entries/{wd['id']}", json={
        "certified_completion_percent": 50, "certified_by": "CA Mehta", "certificate_ref": "FORM3/001"})
    await _post(client, f"/rera-entries/{wd['id']}/approve", {}, status=200)

    wd2 = await _post(client, "/rera-entries", {
        "project_id": project["id"], "kind": "withdrawal", "amount": 200_000, "entry_date": date.today().isoformat(),
        "certified_completion_percent": 50, "certified_by": "CA Mehta", "certificate_ref": "FORM3/002"})
    over = await client.post(f"{B}/rera-entries/{wd2['id']}/approve", json={})
    assert over.status_code == 409  # 50% of 1,000,000 = 500,000, 400,000 already withdrawn

    acct = (await client.get(f"{B}/tax/rera-account", params={"project_id": project["id"]})).json()
    row = acct["projects"][0]
    assert row["deposited"] == 1_000_000 and row["withdrawn"] == 400_000 and row["compliant"] is True
    assert row["required_reserve"] == pytest.approx(525_000 * 0.7)


@pytest.mark.asyncio
async def test_tax_reconciliation_flags_issues(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)
    await _post(client, "/receipts", {"booking_id": b["id"], "amount": 520_000, "tds_amount": 5_000, "mode": "neft"})
    rec = (await client.get(f"{B}/tax/reconciliation")).json()
    titles = [i["title"] for i in rec["issues"]]
    assert any("GST invoiced" in t for t in titles)  # no GSTR-3B filed
    assert rec["tds"]["entries"] == 1
    assert any("RERA reserve" in t for t in titles)  # nothing deposited yet


@pytest.mark.asyncio
async def test_new_buttons_available_for_custom_create_resources(client, test_vendor_user):
    meta = (await client.get(f"{B}/meta")).json()["resources"]
    for key in ("bookings", "quotations", "receipts"):
        assert meta[key]["can_create"] is True and meta[key]["create_fields"], key
    assert "unit_id" in meta["bookings"]["create_fields"]
    assert meta["demands"]["can_create"] is False
    assert uuid.UUID(str(uuid.uuid4()))
