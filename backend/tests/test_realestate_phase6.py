"""Real estate — Phase 6: leasing & rentals, facility, society and asset management."""
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

import pytest
from sqlalchemy import update

from app.models.realestate.core import ReUnit
from app.services.realestate.postsales import add_months
from tests.test_realestate_phase1 import B, _post, _setup_inventory

TODAY = date.today()
THIS_MONTH = TODAY.replace(day=1)


async def _get(client, path, status=200, **params):
    r = await client.get(f"{B}{path}", params=params)
    assert r.status_code == status, f"{path}: {r.status_code} {r.text}"
    return r.json()


async def _units(client, project):
    items = (await _get(client, "/units", project_id=project["id"], size=100))["items"]
    return sorted(items, key=lambda u: u["unit_number"])


async def _tenant(client, name="Acme Retail Pvt Ltd", **extra):
    return await _post(client, "/tenants", {"name": name, "tenant_type": "company", "phone": "9800000001", **extra})


async def _lease(client, unit, tenant, start, end, rent=100000, **extra):
    body = {"unit_id": unit["id"], "tenant_id": tenant["id"], "start_date": start.isoformat(), "end_date": end.isoformat(), "rent_amount": rent}
    body.update(extra)
    return await _post(client, "/leases", body)


async def _active_lease(client, unit, tenant, start, end, rent=100000, **extra):
    ls = await _lease(client, unit, tenant, start, end, rent, **extra)
    await _post(client, f"/leases/{ls['id']}/activate", status=200)
    return ls


def _month_len(d: date) -> int:
    return monthrange(d.year, d.month)[1]


# ═══ leasing ════════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_lease_validation_activation_and_unit_lock(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    t = await _tenant(client)
    assert t["tenant_code"].startswith("TN-")
    base = {"unit_id": u[0]["id"], "tenant_id": t["id"], "start_date": TODAY.isoformat(), "end_date": (TODAY + timedelta(days=365)).isoformat()}
    for bad in ({"rent_amount": 0}, {"rent_amount": 5000, "end_date": (TODAY - timedelta(days=1)).isoformat()},
                {"rent_amount": 5000, "rent_due_day": 30}, {"rent_amount": 5000, "escalation_percent": 150},
                {"rent_amount": 5000, "lock_in_months": 24}):
        r = await client.post(f"{B}/leases", json={**base, **bad})
        assert r.status_code == 422, (bad, r.text)

    # commercial letting defaults to 18% GST; residential stays exempt
    com = await _lease(client, u[0], t, TODAY, TODAY + timedelta(days=365), 50000, use_type="commercial")
    res = await _lease(client, u[1], t, TODAY, TODAY + timedelta(days=365), 50000)
    assert com["gst_rate"] == 18 and res["gst_rate"] == 0 and com["status"] == "draft"

    await _post(client, f"/leases/{com['id']}/activate", status=200)
    assert (await _get(client, f"/units/{u[0]['id']}"))["status"] == "leased"
    assert (await client.post(f"{B}/leases/{com['id']}/activate")).status_code == 409  # already active
    # a second lease on the occupied unit cannot be activated
    dup = await _lease(client, u[0], t, TODAY, TODAY + timedelta(days=30), 40000)
    assert (await client.post(f"{B}/leases/{dup['id']}/activate")).status_code == 409
    # active leases are locked; drafts can be edited and deleted
    assert (await client.patch(f"{B}/leases/{com['id']}", json={"rent_amount": 1})).status_code == 409
    assert (await client.patch(f"{B}/leases/{dup['id']}", json={"rent_amount": 45000})).status_code == 200
    assert (await client.delete(f"{B}/leases/{dup['id']}")).status_code == 204
    # sold / booked inventory cannot be leased
    sold = await _lease(client, u[2], t, TODAY, TODAY + timedelta(days=30), 40000)
    cust = await _post(client, "/customers", {"full_name": "Buyer", "phone": "9000000009"})
    await _post(client, "/bookings", {"unit_id": u[2]["id"], "customer_id": cust["id"]})
    assert (await client.post(f"{B}/leases/{sold['id']}/activate")).status_code == 409
    # a tenant with leases cannot be deleted
    assert (await client.delete(f"{B}/tenants/{t['id']}")).status_code == 409


@pytest.mark.asyncio
async def test_rent_billing_proration_gst_idempotency_and_payments(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    t = await _tenant(client)
    start = add_months(THIS_MONTH, -5).replace(day=16)
    ls = await _active_lease(client, u[0], t, start, add_months(start, 24) - timedelta(days=1), 100000,
                             use_type="commercial", maintenance_charge=5000, rent_due_day=7)
    out = await _post(client, f"/leases/{ls['id']}/bill-rent", {}, status=200)
    assert len(out["created"]) == 6 and out["skipped"] == 0
    invs = (await _get(client, "/rent-invoices", lease_id=ls["id"], sort="period_start", size=50))["items"]
    first = invs[0]
    dim = _month_len(start)
    days = dim - 15
    rent = round(100000 * days / dim, 2)
    maint = round(5000 * days / dim, 2)
    assert first["days_billed"] == days and first["rent_amount"] == pytest.approx(rent)
    assert first["gst_amount"] == pytest.approx(round((rent + maint) * 0.18, 2))
    assert first["total_amount"] == pytest.approx(rent + maint + first["gst_amount"], abs=0.02)
    assert first["period_start"] == start.isoformat() and first["due_date"] >= first["period_start"]
    full = invs[1]
    assert full["rent_amount"] == 100000 and full["total_amount"] == pytest.approx(105000 * 1.18)
    assert full["due_date"] == full["period_start"][:8] + "07"

    again = await _post(client, f"/leases/{ls['id']}/bill-rent", {}, status=200)
    assert again["created"] == [] and again["skipped"] == 6  # idempotent
    # unbillable ranges are refused
    far = await client.post(f"{B}/leases/{ls['id']}/bill-rent", json={"upto": (TODAY + timedelta(days=2000)).isoformat()})
    assert far.status_code in (200, 422)
    draft = await _lease(client, u[1], t, TODAY, TODAY + timedelta(days=100), 1000)
    assert (await client.post(f"{B}/leases/{draft['id']}/bill-rent", json={})).status_code == 409

    # payments: partial -> overpay refused -> settled
    inv = full
    total = inv["total_amount"]
    p1 = await _post(client, f"/rent-invoices/{inv['id']}/receive", {"amount": 50000, "mode": "neft", "reference": "UTR1"}, status=200)
    assert p1["status"] == "partial" and p1["receipt_no"].startswith("OR-")
    assert (await client.post(f"{B}/rent-invoices/{inv['id']}/receive", json={"amount": total})).status_code == 409
    assert (await client.post(f"{B}/rent-invoices/{inv['id']}/receive", json={"amount": 0})).status_code in (409, 422)
    assert (await client.post(f"{B}/rent-invoices/{inv['id']}/receive", json={"amount": 10, "mode": "bitcoin"})).status_code == 422
    tomorrow = (TODAY + timedelta(days=1)).isoformat()
    assert (await client.post(f"{B}/rent-invoices/{inv['id']}/receive", json={"amount": 10, "paid_on": tomorrow})).status_code == 422
    p2 = await _post(client, f"/rent-invoices/{inv['id']}/receive", {"amount": round(total - 50000, 2), "mode": "cheque"}, status=200)
    assert p2["status"] == "paid"
    assert (await client.post(f"{B}/rent-invoices/{inv['id']}/receive", json={"amount": 1})).status_code == 409
    # paid invoices cannot be cancelled; unpaid can, and a cancelled month is not silently re-billed
    assert (await client.post(f"{B}/rent-invoices/{inv['id']}/cancel", json={"reason": "x"})).status_code == 409
    other = invs[2]
    assert (await client.post(f"{B}/rent-invoices/{other['id']}/cancel", json={})).status_code == 422
    await _post(client, f"/rent-invoices/{other['id']}/cancel", {"reason": "billed in error"}, status=200)
    rebill = await _post(client, f"/leases/{ls['id']}/bill-rent", {}, status=200)
    assert rebill["created"] == []
    # only the due date of an invoice can be edited
    assert (await client.patch(f"{B}/rent-invoices/{invs[3]['id']}", json={"total_amount": 1})).json()["total_amount"] == invs[3]["total_amount"]
    receipts = (await _get(client, "/ops-receipts", kind="rent"))["items"]
    assert len(receipts) == 2 and sum(r["amount"] for r in receipts) == pytest.approx(total)


@pytest.mark.asyncio
async def test_escalation_schedule_compounds_and_applies(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    t = await _tenant(client)
    start = add_months(THIS_MONTH, -8)
    ls = await _active_lease(client, u[0], t, start, add_months(start, 24) - timedelta(days=1), 100000,
                             escalation_percent=10, escalation_every_months=6)
    steps = (await _get(client, "/lease-escalations", lease_id=ls["id"], sort="effective_on"))["items"]
    assert [s["new_rent"] for s in steps] == [110000, 121000, 133100]
    assert [s["status"] for s in steps] == ["scheduled"] * 3
    out = await _post(client, f"/leases/{ls['id']}/bill-rent", {}, status=200)
    assert len(out["created"]) == 9
    invs = (await _get(client, "/rent-invoices", lease_id=ls["id"], sort="period_start", size=50))["items"]
    assert [i["rent_amount"] for i in invs] == [100000] * 6 + [110000] * 3
    steps = (await _get(client, "/lease-escalations", lease_id=ls["id"], sort="effective_on"))["items"]
    assert [s["status"] for s in steps] == ["applied", "scheduled", "scheduled"]
    # escalation rows are read-only
    assert (await client.patch(f"{B}/lease-escalations/{steps[0]['id']}", json={"percent": 0})).status_code in (404, 405)


@pytest.mark.asyncio
async def test_termination_lock_in_and_deposit_refund_with_dues_adjusted(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    t = await _tenant(client, "Rahul Sharma", tenant_type="individual")
    start = add_months(THIS_MONTH, -3)
    ls = await _active_lease(client, u[0], t, start, add_months(start, 12) - timedelta(days=1), 50000,
                             security_deposit=200000, lock_in_months=6)
    # deposit: cannot exceed the agreed amount
    assert (await client.post(f"{B}/leases/{ls['id']}/receive-deposit", json={"amount": 250000})).status_code == 409
    part = await _post(client, f"/leases/{ls['id']}/receive-deposit", {"amount": 150000, "mode": "neft"}, status=200)
    assert part["status"] == "pending"
    done = await _post(client, f"/leases/{ls['id']}/receive-deposit", {"amount": 50000, "mode": "cheque"}, status=200)
    assert done["status"] == "held"
    assert (await client.post(f"{B}/leases/{ls['id']}/refund-deposit", json={})).status_code == 409  # lease still running

    await _post(client, f"/leases/{ls['id']}/bill-rent", {"upto": add_months(THIS_MONTH, 1).isoformat()}, status=200)
    invs = (await _get(client, "/rent-invoices", lease_id=ls["id"], sort="period_start", size=50))["items"]
    assert len(invs) == 5

    body = {"terminated_on": TODAY.isoformat(), "reason": "Moving out"}
    assert (await client.post(f"{B}/leases/{ls['id']}/terminate", json=body)).status_code == 409  # inside lock-in
    assert (await client.post(f"{B}/leases/{ls['id']}/terminate", json={**body, "reason": ""})).status_code in (409, 422)
    out = await _post(client, f"/leases/{ls['id']}/terminate", {**body, "waive_lock_in": "yes"}, status=200)
    assert out["cancelled_invoices"] == 1  # next month's rent is no longer due
    assert (await _get(client, f"/units/{u[0]['id']}"))["status"] == "available"
    assert (await _get(client, f"/leases/{ls['id']}"))["status"] == "terminated"

    # refund: deduct damages, then settle unpaid rent from what is left
    assert (await client.post(f"{B}/leases/{ls['id']}/refund-deposit", json={"deductions": 20000})).status_code == 422  # no reason
    assert (await client.post(f"{B}/leases/{ls['id']}/refund-deposit", json={"deductions": 900000, "reason": "x"})).status_code == 409
    res = await _post(client, f"/leases/{ls['id']}/refund-deposit",
                      {"deductions": 20000, "reason": "Wall damage", "adjust_dues": "yes"}, status=200)
    assert res["adjusted_against_dues"] == 180000 and res["refund"] == 0
    lease = await _get(client, f"/leases/{ls['id']}")
    assert lease["deposit_status"] == "refunded" and lease["deposit_deductions"] == 200000
    live = (await _get(client, "/rent-invoices", lease_id=ls["id"], sort="period_start", size=50))["items"]
    assert [i["status"] for i in live] == ["paid", "paid", "paid", "partial", "cancelled"]
    assert (await client.post(f"{B}/leases/{ls['id']}/refund-deposit", json={})).status_code == 409


@pytest.mark.asyncio
async def test_renewal_rolls_deposit_and_expiry_frees_the_unit(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    t = await _tenant(client)
    start, end = TODAY - timedelta(days=340), TODAY + timedelta(days=20)
    ls = await _active_lease(client, u[0], t, start, end, 80000, security_deposit=100000, notice_period_days=30)
    await _post(client, f"/leases/{ls['id']}/receive-deposit", {"amount": 100000}, status=200)
    rn = (await _get(client, "/leasing/renewals", days=60))["tables"][0]["rows"]
    assert [r["stage"] for r in rn if r["lease_no"] == ls["lease_no"]] == ["notice_due"]

    new_end = end + timedelta(days=365)
    assert (await client.post(f"{B}/leases/{ls['id']}/renew", json={"new_end_date": end.isoformat(), "rent_increase_percent": 5})).status_code == 422
    assert (await client.post(f"{B}/leases/{ls['id']}/renew", json={"new_end_date": new_end.isoformat(), "rent_increase_percent": 500})).status_code == 422
    r = await _post(client, f"/leases/{ls['id']}/renew", {"new_end_date": new_end.isoformat(), "rent_increase_percent": 10})
    assert (await client.post(f"{B}/leases/{ls['id']}/renew", json={"new_end_date": new_end.isoformat()})).status_code == 409
    nxt = await _get(client, f"/leases/{r['id']}")
    assert nxt["status"] == "draft" and nxt["rent_amount"] == 88000 and nxt["start_date"] == (end + timedelta(days=1)).isoformat()
    stages = (await _get(client, "/leasing/renewals", days=60))["tables"][0]["rows"]
    assert [x["stage"] for x in stages if x["lease_no"] == ls["lease_no"]] == ["renewal_in_progress"]

    await _post(client, f"/leases/{r['id']}/activate", status=200)
    assert (await _get(client, f"/leases/{ls['id']}"))["status"] == "renewed"
    new = await _get(client, f"/leases/{r['id']}")
    old = await _get(client, f"/leases/{ls['id']}")
    assert new["deposit_received"] == 100000 and new["deposit_status"] == "held" and old["deposit_status"] == "transferred"
    assert (await client.post(f"{B}/leases/{ls['id']}/refund-deposit", json={})).status_code == 409
    assert (await _get(client, f"/units/{u[0]['id']}"))["status"] == "leased"

    # a lease that ran out is expired lazily and its unit becomes available again
    gone = await _active_lease(client, u[1], t, TODAY - timedelta(days=400), TODAY - timedelta(days=10), 20000)
    assert (await _get(client, f"/units/{u[1]['id']}"))["status"] == "leased"
    await _get(client, "/leasing/overview")
    assert (await _get(client, f"/leases/{gone['id']}"))["status"] == "expired"
    assert (await _get(client, f"/units/{u[1]['id']}"))["status"] == "available"


@pytest.mark.asyncio
async def test_bulk_monthly_billing_and_overview(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    t = await _tenant(client)
    start = add_months(THIS_MONTH, -2)
    a = await _active_lease(client, u[0], t, start, add_months(start, 12) - timedelta(days=1), 40000)
    await _active_lease(client, u[1], t, start, add_months(start, 12) - timedelta(days=1), 60000, maintenance_charge=2000)
    out = await _post(client, "/rent-invoices/generate", {"month": TODAY.isoformat()}, status=200)
    assert len(out["created"]) == 2 and out["skipped"] == []
    again = await _post(client, "/rent-invoices/generate", {"month": TODAY.isoformat()}, status=200)
    assert again["created"] == [] and len(again["skipped"]) == 2
    # a month before the leases began bills nothing
    pre = await _post(client, "/rent-invoices/generate", {"month": add_months(THIS_MONTH, -6).isoformat()}, status=200)
    assert pre["created"] == []
    ov = await _get(client, "/leasing/overview")
    kpi = {k["label"]: k["value"] for k in ov["kpis"]}
    assert kpi["Active leases"] == 2 and kpi["Monthly rent roll"] == 102000
    assert kpi["Rent receivable"] == pytest.approx(102000)
    # invoices for earlier months are overdue; the aging table is populated
    await _post(client, f"/leases/{a['id']}/bill-rent", {}, status=200)
    ov = await _get(client, "/leasing/overview")
    assert {k["label"]: k["value"] for k in ov["kpis"]}["Overdue"] > 0
    assert sum(r["amount"] for r in ov["tables"][0]["rows"]) == pytest.approx({k["label"]: k["value"] for k in ov["kpis"]}["Rent receivable"])
    assert ov["actions"][0]["path"] == "/rent-invoices/generate"


# ═══ facility ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_facility_work_orders_and_preventive_maintenance(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    asset = await _post(client, "/assets", {"name": "Passenger lift 1", "category": "lift", "project_id": project["id"], "purchase_cost": 1_500_000,
                                           "purchase_date": (TODAY - timedelta(days=400)).isoformat()})
    assert asset["asset_code"].startswith("AS-")
    sch = await _post(client, "/pm-schedules", {"name": "Lift quarterly service", "asset_id": asset["id"], "category": "lift", "frequency_days": 30,
                                               "next_due_on": (TODAY - timedelta(days=1)).isoformat(), "assigned_to": "Technician A"})
    assert sch["project_id"] == project["id"]
    assert (await client.post(f"{B}/pm-schedules", json={"name": "bad", "asset_id": asset["id"], "frequency_days": 0, "next_due_on": TODAY.isoformat()})).status_code == 422

    run = await _post(client, "/pm-schedules/run-due", status=200)
    assert len(run["created"]) == 1 and run["skipped"] == []
    again = await _post(client, "/pm-schedules/run-due", status=200)
    assert again["created"] == [] and len(again["skipped"]) == 1  # one open job per schedule
    wo = (await _get(client, "/facility-work-orders", pm_schedule_id=sch["id"]))["items"][0]
    assert wo["status"] == "assigned" and wo["wo_no"].startswith("FWO-") and wo["assigned_to"] == "Technician A"

    assert (await client.post(f"{B}/facility-work-orders/{wo['id']}/complete", json={"resolution": ""})).status_code == 422
    assert (await client.post(f"{B}/facility-work-orders/{wo['id']}/complete", json={"resolution": "ok", "labour_cost": -5})).status_code == 422
    await _post(client, f"/facility-work-orders/{wo['id']}/start", status=200)
    await _post(client, f"/facility-work-orders/{wo['id']}/complete", {"resolution": "Greased and tested", "labour_cost": 1000, "material_cost": 2500}, status=200)
    done = await _get(client, f"/facility-work-orders/{wo['id']}")
    assert done["status"] == "completed" and done["total_cost"] == 3500
    assert (await client.post(f"{B}/facility-work-orders/{wo['id']}/cancel", json={"reason": "x"})).status_code == 409
    await _post(client, f"/facility-work-orders/{wo['id']}/close", status=200)

    sch2 = await _get(client, f"/pm-schedules/{sch['id']}")
    assert sch2["last_done_on"] == TODAY.isoformat() and sch2["next_due_on"] == (TODAY + timedelta(days=30)).isoformat()
    a2 = await _get(client, f"/assets/{asset['id']}")
    assert a2["last_maintenance_on"] == TODAY.isoformat()
    hist = (await _get(client, "/asset-maintenance", asset_id=asset["id"]))["items"]
    assert len(hist) == 1 and hist[0]["kind"] == "preventive" and hist[0]["cost"] == 3500
    assert (await _post(client, "/pm-schedules/run-due", status=200))["created"] == []  # nothing due now

    # ad-hoc work order: needs a location, derives project from the unit, due date follows priority
    assert (await client.post(f"{B}/facility-work-orders", json={"title": "Leak"})).status_code == 422
    adhoc = await _post(client, "/facility-work-orders", {"title": "Water leak in 2BHK", "category": "plumbing", "priority": "urgent", "unit_id": u[0]["id"]})
    assert adhoc["project_id"] == project["id"] and adhoc["status"] == "open"
    assert adhoc["due_date"] == (date.fromisoformat(adhoc["requested_on"]) + timedelta(days=1)).isoformat()
    await _post(client, f"/facility-work-orders/{adhoc['id']}/assign", {"assigned_to": "Plumber Raju"}, status=200)
    assert (await client.post(f"{B}/facility-work-orders/{adhoc['id']}/assign", json={})).status_code == 422
    await _post(client, f"/facility-work-orders/{adhoc['id']}/cancel", {"reason": "Duplicate"}, status=200)
    assert (await client.post(f"{B}/facility-work-orders/{adhoc['id']}/start")).status_code == 409
    ov = await _get(client, "/facility/overview")
    assert {k["label"]: k["value"] for k in ov["kpis"]}["Maintenance cost"] == 3500


@pytest.mark.asyncio
async def test_utility_meter_readings_validate_and_compute(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    assert (await client.post(f"{B}/utility-meters", json={"meter_no": "M-0", "utility_type": "electricity"})).status_code == 422  # no location
    m = await _post(client, "/utility-meters", {"meter_no": "EM-101", "unit_id": u[0]["id"], "rate_per_unit": 8, "multiplier": 1, "opening_reading": 100})
    assert m["project_id"] == project["id"] and m["last_reading"] == 100
    d1, d2, d3 = (TODAY - timedelta(days=20)), (TODAY - timedelta(days=10)), (TODAY - timedelta(days=5))
    r1 = await _post(client, "/meter-readings", {"meter_id": m["id"], "reading_on": d1.isoformat(), "reading": 150})
    assert r1["previous_reading"] == 100 and r1["consumption"] == 50 and r1["amount"] == 400 and r1["unit_id"] == u[0]["id"]
    assert (await client.post(f"{B}/meter-readings", json={"meter_id": m["id"], "reading_on": d1.isoformat(), "reading": 160})).status_code == 409
    assert (await client.post(f"{B}/meter-readings", json={"meter_id": m["id"], "reading_on": (d1 - timedelta(days=3)).isoformat(), "reading": 160})).status_code == 409
    assert (await client.post(f"{B}/meter-readings", json={"meter_id": m["id"], "reading_on": d2.isoformat(), "reading": 140})).status_code == 422
    assert (await client.post(f"{B}/meter-readings", json={"meter_id": m["id"], "reading_on": (TODAY + timedelta(days=1)).isoformat(), "reading": 200})).status_code == 422
    r2 = await _post(client, "/meter-readings", {"meter_id": m["id"], "reading_on": d2.isoformat(), "reading": 140, "is_reset": True})
    assert r2["consumption"] == 140 and r2["amount"] == 1120  # replaced meter counts from zero
    r3 = await _post(client, "/meter-readings", {"meter_id": m["id"], "reading_on": d3.isoformat(), "reading": 190})
    assert r3["previous_reading"] == 140 and r3["consumption"] == 50
    assert (await _get(client, f"/utility-meters/{m['id']}"))["last_reading"] == 190
    assert (await client.patch(f"{B}/utility-meters/{m['id']}", json={"opening_reading": 5})).status_code == 409
    assert (await client.delete(f"{B}/utility-meters/{m['id']}")).status_code == 409
    assert (await client.delete(f"{B}/meter-readings/{r3['id']}")).status_code in (404, 405)


@pytest.mark.asyncio
async def test_housekeeping_and_security_logs(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    hk = await _post(client, "/housekeeping", {"project_id": project["id"], "area": "Lobby", "task": "Mop and polish", "assigned_to": "Sunita"})
    assert hk["status"] == "scheduled"
    assert (await client.post(f"{B}/housekeeping/{hk['id']}/complete", json={"rating": 6})).status_code == 422
    await _post(client, f"/housekeeping/{hk['id']}/complete", {"rating": 4, "checked_by": "Supervisor"}, status=200)
    assert (await client.post(f"{B}/housekeeping/{hk['id']}/complete", json={})).status_code == 409
    hk2 = await _post(client, "/housekeeping", {"project_id": project["id"], "area": "Terrace", "task": "Sweep"})
    assert (await client.post(f"{B}/housekeeping/{hk2['id']}/miss", json={})).status_code == 422
    await _post(client, f"/housekeeping/{hk2['id']}/miss", {"reason": "Rain"}, status=200)

    patrol = await _post(client, "/security-logs", {"project_id": project["id"], "log_type": "patrol", "details": "Night round clear"})
    assert patrol["resolved"] is True
    inc = await _post(client, "/security-logs", {"project_id": project["id"], "log_type": "incident", "severity": "critical", "details": "Gate tailgating"})
    assert inc["resolved"] is False and inc["occurred_at"]
    future = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    assert (await client.post(f"{B}/security-logs", json={"project_id": project["id"], "details": "x", "occurred_at": future})).status_code == 422
    ov = await _get(client, "/facility/overview")
    k = {x["label"]: x["value"] for x in ov["kpis"]}
    assert k["Unresolved security"] == 1 and k["Housekeeping done (month)"] == 50
    assert (await client.post(f"{B}/security-logs/{inc['id']}/resolve", json={})).status_code == 422
    await _post(client, f"/security-logs/{inc['id']}/resolve", {"action_taken": "Guard briefed, CCTV reviewed"}, status=200)
    assert (await client.post(f"{B}/security-logs/{inc['id']}/resolve", json={"action_taken": "again"})).status_code == 409


# ═══ society ════════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_society_maintenance_billing_utilities_and_collections(client, test_vendor_user, db_session):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    # units 0 and 1 are occupied; unit 1 has no recorded area
    await db_session.execute(update(ReUnit).where(ReUnit.id.in_([UUID(u[0]["id"]), UUID(u[1]["id"])])).values(status="handed_over"))
    await db_session.execute(update(ReUnit).where(ReUnit.id == UUID(u[1]["id"])).values(super_area=0, built_up_area=0, carpet_area=0))
    await db_session.commit()

    r1 = await _post(client, "/residents", {"unit_id": u[0]["id"], "name": "Meera Iyer", "resident_type": "owner", "is_primary": True, "phone": "9811111111"})
    assert r1["project_id"] == project["id"] and r1["status"] == "active"
    assert (await client.post(f"{B}/residents", json={"unit_id": u[0]["id"], "name": "Other", "is_primary": True})).status_code == 409
    await _post(client, "/residents", {"unit_id": u[0]["id"], "name": "Son", "resident_type": "family"})

    plan = await _post(client, "/maintenance-plans", {"project_id": project["id"], "name": "Standard", "rate": 3, "sinking_fund_rate": 1, "gst_rate": 18, "due_day": 10})
    assert (await client.post(f"{B}/maintenance-plans", json={"project_id": project["id"], "name": "Second", "rate": 2})).status_code == 409  # one active plan
    assert (await client.post(f"{B}/maintenance-plans", json={"project_id": project["id"], "name": "Zero", "rate": 0, "is_active": False})).status_code == 422

    meter = await _post(client, "/utility-meters", {"meter_no": "EM-1", "unit_id": u[0]["id"], "rate_per_unit": 8})
    await _post(client, "/meter-readings", {"meter_id": meter["id"], "reading_on": TODAY.isoformat(), "reading": 100})

    gen = await _post(client, f"/maintenance-plans/{plan['id']}/generate", {"month": TODAY.isoformat()}, status=200)
    assert len(gen["created"]) == 1 and gen["skipped"] == [{"unit": u[1]["unit_number"], "reason": "no area recorded"}]
    bill = (await _get(client, "/maintenance-bills", plan_id=plan["id"]))["items"][0]
    assert bill["maintenance_amount"] == 3000 and bill["sinking_fund"] == 1000 and bill["utility_amount"] == 800
    assert bill["gst_amount"] == pytest.approx(720) and bill["total_amount"] == pytest.approx(5520)
    assert bill["resident_id"] == r1["id"] and bill["period_start"] == THIS_MONTH.isoformat() and bill["bill_no"].startswith("MB-")
    reading = (await _get(client, "/meter-readings", meter_id=meter["id"]))["items"][0]
    assert reading["billed"] is True

    again = await _post(client, f"/maintenance-plans/{plan['id']}/generate", {"month": TODAY.isoformat()}, status=200)
    assert again["created"] == [] and {s["reason"] for s in again["skipped"]} == {"already billed", "no area recorded"}

    # collections
    p = await _post(client, f"/maintenance-bills/{bill['id']}/receive", {"amount": 2000, "mode": "upi", "reference": "UPI1"}, status=200)
    assert p["status"] == "partial"
    assert (await client.post(f"{B}/maintenance-bills/{bill['id']}/receive", json={"amount": 9999})).status_code == 409
    assert (await client.post(f"{B}/maintenance-bills/{bill['id']}/cancel", json={"reason": "x"})).status_code == 409  # not issued any more
    await _post(client, f"/maintenance-bills/{bill['id']}/receive", {"amount": 3520}, status=200)
    assert (await _get(client, f"/maintenance-bills/{bill['id']}"))["status"] == "paid"
    assert len((await _get(client, "/ops-receipts", kind="maintenance"))["items"]) == 2

    ov = await _get(client, "/society/overview")
    k = {x["label"]: x["value"] for x in ov["kpis"]}
    assert k["Billed"] == pytest.approx(5520) and k["Collected"] == pytest.approx(5520) and k["Collection"] == 100 and k["Residents"] == 2

    # a cancelled bill releases its utility charges for the next bill and is not silently re-raised
    plan_q = await _post(client, f"/maintenance-plans/{plan['id']}/generate", {"month": add_months(THIS_MONTH, 1).isoformat()}, status=200)
    nxt = (await _get(client, "/maintenance-bills", plan_id=plan["id"], sort="-period_start"))["items"][0]
    assert len(plan_q["created"]) == 1 and nxt["utility_amount"] == 0  # reading already billed in month 1
    await _post(client, f"/maintenance-bills/{nxt['id']}/cancel", {"reason": "Wrong plan"}, status=200)
    regen = await _post(client, f"/maintenance-plans/{plan['id']}/generate", {"month": add_months(THIS_MONTH, 1).isoformat()}, status=200)
    assert regen["created"] == [] and "cancelled" in {s["reason"] for s in regen["skipped"]}

    # quarterly plans bill from the start of a quarter only
    await client.patch(f"{B}/maintenance-plans/{plan['id']}", json={"frequency": "quarterly"})
    assert (await client.post(f"{B}/maintenance-plans/{plan['id']}/generate", json={"month": date(TODAY.year + 1, 2, 1).isoformat()})).status_code == 422
    jan = await _post(client, f"/maintenance-plans/{plan['id']}/generate", {"month": date(TODAY.year + 1, 1, 1).isoformat()}, status=200)
    qb = (await _get(client, "/maintenance-bills", plan_id=plan["id"], sort="-period_start"))["items"][0]
    assert len(jan["created"]) == 1 and qb["maintenance_amount"] == 9000 and qb["period_end"] == date(TODAY.year + 1, 3, 31).isoformat()
    assert (await client.delete(f"{B}/maintenance-plans/{plan['id']}")).status_code == 409


@pytest.mark.asyncio
async def test_visitors_residents_and_notices(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    res = await _post(client, "/residents", {"unit_id": u[0]["id"], "name": "Kiran Rao", "is_primary": True})
    assert (await client.post(f"{B}/visitors", json={"visitor_name": "Courier"})).status_code == 422  # which unit?
    other = await _post(client, "/residents", {"unit_id": u[1]["id"], "name": "Neighbour"})
    assert (await client.post(f"{B}/visitors", json={"visitor_name": "X", "unit_id": u[0]["id"], "resident_id": other["id"]})).status_code == 422
    v = await _post(client, "/visitors", {"visitor_name": "Plumber", "resident_id": res["id"], "purpose": "Repair", "vehicle_no": "MH12AB1234"})
    assert v["pass_no"].startswith("VP-") and v["unit_id"] == u[0]["id"] and v["project_id"] == project["id"]
    assert (await client.post(f"{B}/visitors/{v['id']}/check-out")).status_code == 409
    await _post(client, f"/visitors/{v['id']}/check-in", status=200)
    assert (await client.post(f"{B}/visitors/{v['id']}/check-in")).status_code == 409
    assert {x["label"]: x["value"] for x in (await _get(client, "/society/overview"))["kpis"]}["Visitors inside"] == 1
    await _post(client, f"/visitors/{v['id']}/check-out", status=200)
    assert (await client.post(f"{B}/visitors/{v['id']}/deny", json={"reason": "late"})).status_code == 409
    v2 = await _post(client, "/visitors", {"visitor_name": "Salesman", "unit_id": u[0]["id"]})
    assert (await client.post(f"{B}/visitors/{v2['id']}/deny", json={})).status_code == 422
    await _post(client, f"/visitors/{v2['id']}/deny", {"reason": "Not expected"}, status=200)

    # moving out
    await _post(client, f"/residents/{res['id']}/move-out", {}, status=200)
    got = await _get(client, f"/residents/{res['id']}")
    assert got["status"] == "moved_out" and got["is_primary"] is False and got["moved_out_on"] == TODAY.isoformat()
    assert (await client.post(f"{B}/residents/{res['id']}/move-out", json={})).status_code == 409
    await _post(client, "/residents", {"unit_id": u[0]["id"], "name": "New owner", "is_primary": True})  # primary slot is free again

    # notices
    stale = {"title": "Old", "body": "x", "valid_until": (TODAY - timedelta(days=1)).isoformat()}
    assert (await client.post(f"{B}/notices", json=stale)).status_code == 422
    n = await _post(client, "/notices", {"title": "Water shutdown", "body": "Tank cleaning on Sunday", "category": "maintenance",
                                         "project_id": project["id"], "valid_until": (TODAY + timedelta(days=5)).isoformat()})
    assert n["is_published"] is False
    await _post(client, f"/notices/{n['id']}/publish", status=200)
    assert (await client.post(f"{B}/notices/{n['id']}/publish")).status_code == 409
    assert {x["label"]: x["value"] for x in (await _get(client, "/society/overview"))["kpis"]}["Live notices"] == 1
    await _post(client, f"/notices/{n['id']}/unpublish", status=200)
    assert (await client.post(f"{B}/notices/{n['id']}/unpublish")).status_code == 409


# ═══ assets ═════════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_asset_depreciation_transfer_and_disposal(client, test_vendor_user):
    p1, *_ = await _setup_inventory(client)
    p2 = await _post(client, "/projects", {"name": "Lakeview", "city": "Pune"})
    base = {"name": "DG set 125kVA", "category": "dg_set", "project_id": p1["id"], "location": "Basement"}
    for bad in ({"purchase_cost": 1000, "salvage_value": 2000}, {"purchase_cost": 1000, "depreciation_method": "wdv"},
                {"purchase_cost": 1000, "purchase_date": (TODAY + timedelta(days=3)).isoformat()}, {"purchase_cost": 1000, "useful_life_years": 0}):
        assert (await client.post(f"{B}/assets", json={**base, **bad})).status_code == 422, bad

    slm = await _post(client, "/assets", {**base, "purchase_cost": 1_200_000, "salvage_value": 200_000, "useful_life_years": 10,
                                          "purchase_date": (TODAY - timedelta(days=730)).isoformat()})
    bv = await _get(client, f"/assets/{slm['id']}/book-value")
    assert 1_000_000 < bv["book_value"] < 1_001_000 and bv["accumulated_depreciation"] == pytest.approx(1_200_000 - bv["book_value"])
    eol = await _get(client, f"/assets/{slm['id']}/book-value", on=(TODAY + timedelta(days=4000)).isoformat())
    assert eol["book_value"] == 200_000  # never below salvage
    wdv = await _post(client, "/assets", {**base, "name": "Pump", "category": "pump", "purchase_cost": 100_000, "depreciation_method": "wdv", "depreciation_rate": 20,
                                          "purchase_date": (TODAY - timedelta(days=365)).isoformat()})
    w = await _get(client, f"/assets/{wdv['id']}/book-value")
    assert 79_900 < w["book_value"] < 80_200

    # service history moves the next-service date
    assert (await client.post(f"{B}/asset-maintenance", json={"asset_id": slm["id"], "performed_on": TODAY.isoformat(), "next_due_on": TODAY.isoformat()})).status_code == 422
    nd = (TODAY + timedelta(days=90)).isoformat()
    await _post(client, "/asset-maintenance", {"asset_id": slm["id"], "kind": "preventive", "cost": 4500, "next_due_on": nd})
    got = await _get(client, f"/assets/{slm['id']}")
    assert got["last_maintenance_on"] == TODAY.isoformat() and got["next_maintenance_on"] == nd
    assert (await client.delete(f"{B}/assets/{slm['id']}")).status_code == 409  # has history

    # transfers
    assert (await client.post(f"{B}/asset-transfers", json={"asset_id": slm["id"], "to_project_id": p1["id"], "to_location": "Basement"})).status_code == 422
    assert (await client.post(f"{B}/asset-transfers", json={"asset_id": slm["id"]})).status_code == 422
    tr = await _post(client, "/asset-transfers", {"asset_id": slm["id"], "to_project_id": p2["id"], "to_location": "Terrace", "reason": "New site"})
    assert tr["status"] == "pending" and tr["from_project_id"] == p1["id"] and tr["from_location"] == "Basement"
    assert (await client.post(f"{B}/asset-transfers", json={"asset_id": slm["id"], "to_location": "Roof"})).status_code == 409
    assert (await client.post(f"{B}/asset-disposals", json={"asset_id": slm["id"], "method": "sale", "proceeds": 1})).status_code == 409  # transfer pending
    await _post(client, f"/asset-transfers/{tr['id']}/complete", status=200)
    moved = await _get(client, f"/assets/{slm['id']}")
    assert moved["project_id"] == p2["id"] and moved["location"] == "Terrace"
    assert (await client.post(f"{B}/asset-transfers/{tr['id']}/cancel")).status_code == 409

    # disposal books gain / loss against book value, retires the asset and its PM schedules
    sch = await _post(client, "/pm-schedules", {"name": "DG service", "asset_id": slm["id"], "next_due_on": nd})
    assert (await client.post(f"{B}/asset-disposals", json={"asset_id": slm["id"], "method": "donation", "proceeds": 100})).status_code == 422
    disp = await _post(client, "/asset-disposals", {"asset_id": slm["id"], "method": "sale", "proceeds": 1_100_000, "buyer": "Scrap Traders"})
    assert disp["book_value"] == pytest.approx(bv["book_value"], abs=50)
    assert disp["gain_loss"] == pytest.approx(1_100_000 - disp["book_value"])
    final = await _get(client, f"/assets/{slm['id']}")
    assert final["status"] == "disposed" and final["disposed_on"] == TODAY.isoformat()
    assert (await _get(client, f"/pm-schedules/{sch['id']}"))["is_active"] is False
    assert (await client.post(f"{B}/asset-disposals", json={"asset_id": slm["id"], "method": "scrap"})).status_code == 409
    assert (await client.post(f"{B}/asset-maintenance", json={"asset_id": slm["id"], "kind": "breakdown"})).status_code == 409
    assert (await client.patch(f"{B}/assets/{slm['id']}", json={"name": "renamed"})).status_code == 409
    assert (await client.post(f"{B}/asset-transfers", json={"asset_id": slm["id"], "to_location": "Roof"})).status_code == 409

    ov = await _get(client, "/assets/overview")
    k = {x["label"]: x["value"] for x in ov["kpis"]}
    assert k["Assets in service"] == 1 and k["Disposed"] == 1 and k["Purchase cost"] == 100_000
    assert [r["name"] for r in ov["tables"][2]["rows"]] == ["Pump"]


@pytest.mark.asyncio
async def test_phase6_modules_resources_and_alerts_are_registered(client, test_vendor_user):
    meta = await _get(client, "/meta")
    for key in ("tenants", "leases", "rent-invoices", "lease-escalations", "ops-receipts", "facility-work-orders", "pm-schedules", "utility-meters",
                "meter-readings", "housekeeping", "security-logs", "residents", "maintenance-plans", "maintenance-bills", "visitors", "notices",
                "assets", "asset-maintenance", "asset-transfers", "asset-disposals"):
        assert key in meta["resources"], key
    tabs = {m["id"]: {t.get("resource") or t.get("view") for t in m["tabs"]} for m in meta["modules"]}
    assert {"leasing_overview", "renewals", "tenants", "leases"} <= tabs["leasing"]
    assert {"facility_overview", "facility-work-orders"} <= tabs["facility"]
    assert {"society_overview", "maintenance-bills"} <= tabs["society"]
    assert {"assets_overview", "assets"} <= tabs["assets"]

    # something overdue in each area shows up in the notification feed
    project, *_ = await _setup_inventory(client)
    u = await _units(client, project)
    t = await _tenant(client)
    start = add_months(THIS_MONTH, -2)
    ls = await _active_lease(client, u[0], t, start, TODAY + timedelta(days=30), 10000)
    await _post(client, f"/leases/{ls['id']}/bill-rent", {}, status=200)
    await _post(client, "/security-logs", {"project_id": project["id"], "log_type": "alarm", "details": "Fire alarm panel fault"})
    alerts = (await _get(client, "/alerts"))
    titles = " | ".join(a["title"] for a in (alerts["items"] if isinstance(alerts, dict) and "items" in alerts else alerts))
    assert "Rent overdue" in titles and "Lease " in titles and "security" in titles.lower()
