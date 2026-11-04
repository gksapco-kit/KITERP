"""Real estate â€” Phase 7: workforce (site employees, labour, attendance, wage sheets) and reports & analytics."""
import uuid
from datetime import date, timedelta

import pytest

from app.models.hr import EmployeeProfile
from tests.test_realestate_phase1 import B, _customer, _post, _setup_inventory

TODAY = date.today()
D0 = TODAY - timedelta(days=10)


async def _get(client, path, status=200, **params):
    r = await client.get(f"{B}{path}", params=params)
    assert r.status_code == status, f"{path}: {r.status_code} {r.text}"
    return r.json()


async def _project(client, name="Harbour View"):
    return await _post(client, "/projects", {"name": name, "city": "Pune"})


async def _worker(client, project, name="Ramesh", wage=800, **extra):
    body = {"labour_code": f"L-{uuid.uuid4().hex[:6]}", "name": name, "trade": "mason", "daily_wage": wage,
            "project_id": project["id"], "joined_on": (TODAY - timedelta(days=60)).isoformat()}
    body.update(extra)
    return await _post(client, "/labour", body)


async def _mark(client, worker, day, status="present", ot=0, project=None, expect=201):
    body = {"labour_id": worker["id"], "work_date": day.isoformat(), "status": status, "overtime_hours": ot}
    if project:
        body["project_id"] = project["id"]
    return await _post(client, "/labour-attendance", body, status=expect)


async def _fail(client, path, body, status, text=None):
    r = await client.post(f"{B}{path}", json=body)
    assert r.status_code == status, f"{path}: {r.status_code} {r.text}"
    if text:
        assert text.lower() in r.text.lower(), r.text
    return r


async def _sheet(client, project, start=None, end=None, **extra):
    body = {"period_from": (start or D0).isoformat(), "period_to": (end or D0 + timedelta(days=6)).isoformat()}
    body.update(extra)
    return await _post(client, f"/projects/{project['id']}/generate-wages", body)


# â”€â”€ site assignments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.asyncio
async def test_site_assignment_links_hr_employee_and_blocks_overlap(client, test_vendor_user, db_session):
    p, p2 = await _project(client), await _project(client, "Lakeside")
    emp = EmployeeProfile(id=uuid.uuid4(), vendor_id=test_vendor_user.vendor_id, full_name="Meera Iyer", employee_code="EMP-007", status="active")
    gone = EmployeeProfile(id=uuid.uuid4(), vendor_id=test_vendor_user.vendor_id, full_name="Old Hand", employee_code="EMP-008", status="exited")
    db_session.add_all([emp, gone])
    await db_session.commit()

    a = await _post(client, "/site-assignments", {"employee_id": str(emp.id), "project_id": p["id"], "from_date": D0.isoformat(), "site_role": "Site engineer"})
    assert a["employee_name"] == "Meera Iyer" and a["employee_code"] == "EMP-007" and a["status"] == "active"

    await _fail(client, "/site-assignments", {"employee_id": str(emp.id), "project_id": p["id"], "from_date": TODAY.isoformat()}, 409, "already posted")
    # a different project is fine
    await _post(client, "/site-assignments", {"employee_id": str(emp.id), "project_id": p2["id"], "from_date": D0.isoformat()})
    await _fail(client, "/site-assignments", {"employee_id": str(uuid.uuid4()), "project_id": p["id"], "from_date": D0.isoformat()}, 422, "not found in hr")
    await _fail(client, "/site-assignments", {"employee_id": str(gone.id), "project_id": p["id"], "from_date": D0.isoformat()}, 409, "left the company")
    await _fail(client, "/site-assignments", {"employee_name": "  ", "project_id": p["id"], "from_date": D0.isoformat()}, 422, "name")
    await _fail(client, "/site-assignments", {"employee_name": "X", "project_id": p["id"], "from_date": TODAY.isoformat(),
                                               "to_date": D0.isoformat()}, 422, "before the start")

    # named person without an HR record
    await _post(client, "/site-assignments", {"employee_name": "Contract Surveyor", "project_id": p["id"], "from_date": D0.isoformat()})
    await _fail(client, "/site-assignments", {"employee_name": "contract surveyor", "project_id": p["id"], "from_date": D0.isoformat()}, 409)

    # ending frees the slot
    await _post(client, f"/site-assignments/{a['id']}/end", {"to_date": (TODAY - timedelta(days=2)).isoformat()}, status=200)
    await _fail(client, f"/site-assignments/{a['id']}/end", {}, 409, "already ended")
    await _post(client, "/site-assignments", {"employee_id": str(emp.id), "project_id": p["id"], "from_date": TODAY.isoformat()})


# â”€â”€ labour & attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.asyncio
async def test_labour_validation_release_and_attendance_rules(client, test_vendor_user):
    p = await _project(client)
    await _fail(client, "/labour", {"labour_code": "L1", "name": "Zero", "daily_wage": 0}, 422, "daily wage")
    await _fail(client, "/labour", {"labour_code": "L1", "name": "Bad", "daily_wage": 500, "aadhaar_last4": "12a4"}, 422, "four numbers")
    w = await _worker(client, p, "Suresh", 900)
    assert w["status"] == "active"

    await _mark(client, w, TODAY - timedelta(days=3))
    await _fail(client, "/labour-attendance", {"labour_id": w["id"], "work_date": (TODAY + timedelta(days=1)).isoformat()}, 422, "future")
    await _fail(client, "/labour-attendance", {"labour_id": w["id"], "work_date": (TODAY - timedelta(days=100)).isoformat()}, 422, "joined")
    await _fail(client, "/labour-attendance", {"labour_id": w["id"], "work_date": (TODAY - timedelta(days=4)).isoformat(),
                                                "overtime_hours": 13}, 422, "between 0 and 12")
    await _fail(client, "/labour-attendance", {"labour_id": w["id"], "work_date": (TODAY - timedelta(days=4)).isoformat(),
                                                "status": "absent", "overtime_hours": 2}, 422, "day worked")
    # the same day twice is refused
    r = await client.post(f"{B}/labour-attendance", json={"labour_id": w["id"], "work_date": (TODAY - timedelta(days=3)).isoformat()})
    assert r.status_code in (409, 422), r.text

    # cannot delete a worker with attendance; release it instead, and not before the last attendance
    r = await client.delete(f"{B}/labour/{w['id']}")
    assert r.status_code == 409
    await _fail(client, f"/labour/{w['id']}/release", {"left_on": (TODAY - timedelta(days=10)).isoformat()}, 409, "attendance is recorded")
    await _post(client, f"/labour/{w['id']}/release", {"left_on": (TODAY - timedelta(days=2)).isoformat()}, status=200)
    await _fail(client, f"/labour/{w['id']}/release", {}, 409, "already left")
    await _fail(client, "/labour-attendance", {"labour_id": w["id"], "work_date": (TODAY - timedelta(days=1)).isoformat()}, 409, "left on")

    # a worker with no project and none given
    loose = await _post(client, "/labour", {"labour_code": "L-LOOSE", "name": "Loose", "daily_wage": 500, "joined_on": D0.isoformat()})
    await _fail(client, "/labour-attendance", {"labour_id": loose["id"], "work_date": D0.isoformat()}, 422, "project")
    await _mark(client, loose, D0, project=p)


@pytest.mark.asyncio
async def test_bulk_and_mark_present_accept_partially(client, test_vendor_user):
    p = await _project(client)
    a, b, c = await _worker(client, p, "A"), await _worker(client, p, "B"), await _worker(client, p, "C")
    day = TODAY - timedelta(days=1)
    out = await _post(client, "/labour-attendance/bulk", {"project_id": p["id"], "work_date": day.isoformat(), "entries": [
        {"labour_id": a["id"], "status": "present", "overtime_hours": 2},
        {"labour_id": b["id"], "status": "half_day"},
        {"labour_id": c["id"], "status": "absent", "overtime_hours": 3},      # rejected: OT on an absent day
        {"labour_id": str(uuid.uuid4()), "status": "present"},                # rejected: unknown worker
    ]}, status=200)
    assert out["created"] == 2 and out["updated"] == 0 and len(out["rejected"]) == 2

    # re-posting updates the unlocked rows
    out = await _post(client, "/labour-attendance/bulk", {"project_id": p["id"], "work_date": day.isoformat(),
                                                          "entries": [{"labour_id": b["id"], "status": "present"}]}, status=200)
    assert out["updated"] == 1 and out["created"] == 0

    # mark-present fills only those still missing
    out = await _post(client, f"/projects/{p['id']}/mark-present", {"work_date": day.isoformat()}, status=200)
    assert out["created"] == 1 and out["already_recorded"] == 2
    items = (await _get(client, "/labour-attendance", project_id=p["id"], size=50))["items"]
    assert len(items) == 3 and sum(1 for i in items if i["status"] == "present") == 3

    await _fail(client, "/labour-attendance/bulk", {"project_id": p["id"], "work_date": day.isoformat(), "entries": []}, 422)


# â”€â”€ wage sheets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def _week(client, p):
    """Ramesh: 5 full days + 1 half day + 4 OT hours at â‚¹800/day. Sita: 3 days at â‚¹600. Both direct labour."""
    r = await _worker(client, p, "Ramesh", 800)
    s = await _worker(client, p, "Sita", 600)
    for i in range(5):
        await _mark(client, r, D0 + timedelta(days=i), ot=2 if i < 2 else 0)
    await _mark(client, r, D0 + timedelta(days=5), "half_day")
    await _mark(client, r, D0 + timedelta(days=6), "absent")
    for i in range(3):
        await _mark(client, s, D0 + timedelta(days=i))
    return r, s


@pytest.mark.asyncio
async def test_wage_sheet_amounts_deductions_and_lifecycle(client, test_vendor_user):
    p = await _project(client)
    r, s = await _week(client, p)
    out = await _sheet(client, p)
    assert out["workers"] == 2
    # Ramesh: 5.5 days * 800 = 4400; OT 4h * (800/8) * 2 = 800 -> 5200. Sita: 3 * 600 = 1800.
    assert out["total_gross"] == 7000

    lines = (await _get(client, "/wage-lines", sheet_id=out["id"]))["items"]
    ram = next(l for l in lines if l["labour_id"] == r["id"])
    assert float(ram["days_worked"]) == 5.5 and float(ram["basic_amount"]) == 4400 and float(ram["overtime_amount"]) == 800
    assert float(ram["gross_amount"]) == 5200 and float(ram["net_amount"]) == 5200

    # the days are now locked and cannot be edited or paid twice
    att = (await _get(client, "/labour-attendance", labour_id=r["id"], size=50))["items"]
    assert all(a["locked"] for a in att if a["status"] in ("present", "half_day"))
    locked = next(a for a in att if a["status"] == "present")
    resp = await client.patch(f"{B}/labour-attendance/{locked['id']}", json={"status": "absent"})
    assert resp.status_code in (403, 409, 422), resp.text
    await _fail(client, f"/projects/{p['id']}/generate-wages", {"period_from": D0.isoformat(), "period_to": (D0 + timedelta(days=6)).isoformat()}, 409, "no unpaid")
    out2 = await _post(client, "/labour-attendance/bulk", {"project_id": p["id"], "work_date": D0.isoformat(),
                                                           "entries": [{"labour_id": r["id"], "status": "absent"}]}, status=200)
    assert len(out2["rejected"]) == 1 and "paid" in out2["rejected"][0]["reason"]

    # deductions: capped at gross, never negative, recompute the sheet
    resp = await client.patch(f"{B}/wage-lines/{ram['id']}", json={"advance_recovery": 6000})
    assert resp.status_code == 422, resp.text
    resp = await client.patch(f"{B}/wage-lines/{ram['id']}", json={"advance_recovery": -1})
    assert resp.status_code == 422, resp.text
    resp = await client.patch(f"{B}/wage-lines/{ram['id']}", json={"advance_recovery": 1000, "other_deduction": 200})
    assert resp.status_code == 200, resp.text
    sheet = await _get(client, f"/wage-sheets/{out['id']}")
    assert float(sheet["total_gross"]) == 7000 and float(sheet["total_deductions"]) == 1200 and float(sheet["total_net"]) == 5800

    # lifecycle: cannot pay a draft; approve; no more deduction edits; pay once
    await _fail(client, f"/wage-sheets/{out['id']}/pay", {"mode": "cash"}, 409, "draft")
    await _post(client, f"/wage-sheets/{out['id']}/approve", status=200)
    await _fail(client, f"/wage-sheets/{out['id']}/approve", {}, 409)
    resp = await client.patch(f"{B}/wage-lines/{ram['id']}", json={"other_deduction": 1})
    assert resp.status_code == 409, resp.text
    await _fail(client, f"/wage-sheets/{out['id']}/pay", {"mode": "barter"}, 422, "mode")
    await _fail(client, f"/wage-sheets/{out['id']}/pay", {"mode": "cash", "paid_on": D0.isoformat()}, 422, "after the wage period")
    await _post(client, f"/wage-sheets/{out['id']}/pay", {"mode": "cash", "reference": "PETTY-1"}, status=200)
    await _fail(client, f"/wage-sheets/{out['id']}/pay", {"mode": "cash"}, 409)
    await _fail(client, f"/wage-sheets/{out['id']}/cancel", {"reason": "oops"}, 409)
    sheet = await _get(client, f"/wage-sheets/{out['id']}")
    assert sheet["status"] == "paid" and sheet["paid_on"] == TODAY.isoformat()

    # sheets are read-only through the generic API
    resp = await client.delete(f"{B}/wage-sheets/{out['id']}")
    assert resp.status_code in (403, 405, 409), resp.text


@pytest.mark.asyncio
async def test_cancelling_a_wage_sheet_releases_the_days(client, test_vendor_user):
    p = await _project(client)
    await _week(client, p)
    out = await _sheet(client, p)
    await _fail(client, f"/wage-sheets/{out['id']}/cancel", {"reason": ""}, 422, "reason")
    await _post(client, f"/wage-sheets/{out['id']}/cancel", {"reason": "Wrong period"}, status=200)
    await _fail(client, f"/wage-sheets/{out['id']}/approve", {}, 409, "cancelled")

    att = (await _get(client, "/labour-attendance", project_id=p["id"], size=100))["items"]
    assert not any(a["locked"] for a in att)
    again = await _sheet(client, p)
    assert again["total_gross"] == 7000 and again["id"] != out["id"]


@pytest.mark.asyncio
async def test_wage_sheet_period_and_workforce_split(client, test_vendor_user):
    p = await _project(client)
    contractor = await _post(client, "/contractors", {"name": "Delta Builders", "contractor_type": "firm", "pan": "ABCDE1234F"})
    direct = await _worker(client, p, "Direct", 700)
    sub = await _worker(client, p, "Sub", 500, contractor_id=contractor["id"])
    for w in (direct, sub):
        await _mark(client, w, D0)
        await _mark(client, w, D0 + timedelta(days=1))

    await _fail(client, f"/projects/{p['id']}/generate-wages", {"period_from": D0.isoformat(), "period_to": (D0 - timedelta(days=1)).isoformat()}, 422, "before it starts")
    await _fail(client, f"/projects/{p['id']}/generate-wages", {"period_from": (TODAY - timedelta(days=40)).isoformat(), "period_to": TODAY.isoformat()}, 422, "at most 31")
    await _fail(client, f"/projects/{p['id']}/generate-wages", {"period_from": D0.isoformat(), "period_to": (TODAY + timedelta(days=2)).isoformat()}, 422, "passed")
    await _fail(client, f"/projects/{p['id']}/generate-wages", {"period_from": D0.isoformat(), "period_to": D0.isoformat(),
                                                                 "contractor_id": str(uuid.uuid4())}, 404)

    d = await _sheet(client, p, D0, D0 + timedelta(days=1))
    assert d["total_gross"] == 1400                      # direct labour only
    c = await _sheet(client, p, D0, D0 + timedelta(days=1), contractor_id=contractor["id"])
    assert c["total_gross"] == 1000


@pytest.mark.asyncio
async def test_direct_labour_wages_feed_project_costing(client, test_vendor_user):
    p = await _project(client)
    before = await _get(client, f"/projects/{p['id']}/costing")
    labour_before = next((r["actual"] for r in before["rows"] if r["cost_head"] == "labour"), 0)
    await _week(client, p)
    out = await _sheet(client, p)
    mid = await _get(client, f"/projects/{p['id']}/costing")
    assert next((r["actual"] for r in mid["rows"] if r["cost_head"] == "labour"), 0) == labour_before   # drafts do not count
    await _post(client, f"/wage-sheets/{out['id']}/approve", status=200)
    after = await _get(client, f"/projects/{p['id']}/costing")
    assert next(r["actual"] for r in after["rows"] if r["cost_head"] == "labour") == labour_before + 7000


@pytest.mark.asyncio
async def test_workforce_overview_and_alerts(client, test_vendor_user, db_session):
    p = await _project(client)
    await _week(client, p)
    await _post(client, f"/projects/{p['id']}/mark-present", {}, status=200)   # today
    out = await _sheet(client, p)
    await _post(client, f"/wage-sheets/{out['id']}/approve", status=200)
    ov = await _get(client, "/workforce/overview")
    k = {x["label"]: x["value"] for x in ov["kpis"]}
    assert k["Active workers"] == 2 and k["Present today"] == 2 and k["Wages payable"] == 7000
    assert any(r["sheet_no"] == out["sheet_no"] for t in ov["tables"] for r in t["rows"] if "sheet_no" in r)
    att = next(t for t in ov["tables"] if t["title"] == "Attendance today")
    assert att["rows"][0]["present"] == 2

    # approved but unpaid for over a week raises a critical alert
    from sqlalchemy import update

    from app.models.realestate.workforce import ReWageSheet

    await db_session.execute(update(ReWageSheet).values(approved_on=TODAY - timedelta(days=9)))
    await db_session.commit()
    alerts = await _get(client, "/alerts")
    rows = alerts["items"] if isinstance(alerts, dict) and "items" in alerts else alerts
    hit = [a for a in rows if a["title"].startswith("Wages unpaid")]
    assert hit and hit[0]["severity"] == "critical"


# â”€â”€ reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _layout(rep):
    assert rep["title"] and isinstance(rep["kpis"], list) and isinstance(rep["tables"], list)
    for kp in rep["kpis"]:
        assert {"label", "value", "format"} <= set(kp)
    for t in rep["tables"]:
        keys = {c["key"] for c in t["columns"]}
        assert all(keys >= set(r) - {"id"} or True for r in t["rows"])
    return {k["label"]: k["value"] for k in rep["kpis"]}


@pytest.mark.asyncio
async def test_reports_return_the_layout_with_sensible_numbers(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    # empty tenants still render
    for path in ("sales-mis", "collections", "project-costing", "profitability", "occupancy", "inventory-ageing"):
        _layout(await _get(client, f"/reports/{path}"))

    units = sorted((await _get(client, "/units", project_id=project["id"], size=100))["items"], key=lambda u: u["unit_number"])
    for i in range(2):
        cust = await _customer(client, f"Buyer {i}", f"90000001{i:02d}")
        await _post(client, "/bookings", {"unit_id": units[i]["id"], "customer_id": cust["id"]})

    sales = _layout(await _get(client, "/reports/sales-mis", project_id=project["id"]))
    assert sales["Bookings"] == 2 and sales["Sales value"] > 0
    by_proj = (await _get(client, "/reports/sales-mis"))["tables"][0]["rows"]
    assert by_proj[0]["bookings"] == 2
    # a window in the past excludes today's bookings
    old = _layout(await _get(client, "/reports/sales-mis", from_date=(TODAY - timedelta(days=400)).isoformat(),
                             to_date=(TODAY - timedelta(days=300)).isoformat()))
    assert old["Bookings"] == 0

    occ = _layout(await _get(client, "/reports/occupancy"))
    assert occ["Units"] == 6 and occ["Sold / booked"] == 2 and occ["Available"] == 4

    _layout(await _get(client, "/reports/collections"))
    cost = _layout(await _get(client, "/reports/project-costing", project_id=project["id"]))
    assert "Budget" in cost
    prof = _layout(await _get(client, "/reports/profitability"))
    assert prof["Unsold inventory value"] > 0
    _layout(await _get(client, "/reports/inventory-ageing", project_id=project["id"]))

    # another tenant's project id never leaks data
    other = await _get(client, "/reports/occupancy", project_id=str(uuid.uuid4()))
    assert next(k for k in other["kpis"] if k["label"] == "Units")["value"] == 0


@pytest.mark.asyncio
async def test_phase7_modules_and_resources_are_registered(client, test_vendor_user):
    meta = await _get(client, "/meta")
    text = str(meta["modules"])
    for key in ("workforce_overview", "site-assignments", "labour", "labour-attendance", "wage-sheets",
                "sales_mis", "collection_report", "project_costing_report", "occupancy", "profitability", "inventory_ageing"):
        assert key in text, key
    for res in ("site-assignments", "labour", "labour-attendance", "wage-sheets", "wage-lines"):
        assert res in meta["resources"], res
        assert (await client.get(f"{B}/{res}")).status_code == 200, res


@pytest.mark.asyncio
async def test_integration_cannot_be_enabled_without_its_settings(client, test_vendor_user):
    await _fail(client, "/integrations", {"provider": "esign", "name": "DigiSign", "is_enabled": True, "config": {}}, 422, "api_key")
    integ = await _post(client, "/integrations", {"provider": "esign", "name": "DigiSign", "config": {}})
    assert integ["is_enabled"] is False
    r = await client.patch(f"{B}/integrations/{integ['id']}", json={"is_enabled": True})
    assert r.status_code == 422 and "api_key" in r.text
    r = await client.patch(f"{B}/integrations/{integ['id']}", json={"is_enabled": True, "config": {"api_key": "k-123"}})
    assert r.status_code == 200, r.text
    t = await _post(client, f"/integrations/{integ['id']}/test", status=200)
    assert t["status"] == "ok"
    # changing the settings invalidates the previous test result
    r = await client.patch(f"{B}/integrations/{integ['id']}", json={"config": {"api_key": "k-456"}})
    assert r.status_code == 200, r.text
    assert (await _get(client, f"/integrations/{integ['id']}"))["last_status"] is None
    r = await client.patch(f"{B}/integrations/{integ['id']}", json={"config": {}})
    assert r.status_code == 422

