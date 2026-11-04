"""Real estate — Phase 4: project planning, construction, procurement, inventory, contractors and payables."""
from datetime import date, timedelta

import pytest

from tests.test_realestate_phase1 import B, _post, _setup_inventory
from tests.test_realestate_phase2 import _book, _plan, _sign_agreement

TODAY = date.today()


async def _get(client, path, **params):
    r = await client.get(f"{B}{path}", params=params)
    assert r.status_code == 200, f"{path}: {r.status_code} {r.text}"
    return r.json()


async def _project(client):
    p = await _post(client, "/projects", {"name": "Harbour View", "city": "Mumbai"})
    return p


async def _task(client, project_id, name, days, preds=(), **extra):
    return await _post(client, "/wbs", {
        "project_id": project_id, "name": name, "duration_days": days, "planned_start": TODAY.isoformat(),
        "predecessor_ids": list(preds), **extra})


# ── scheduling ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_critical_path_float_and_cycle_detection(client, test_vendor_user):
    p = await _project(client)
    a = await _task(client, p["id"], "Excavation", 5)
    b = await _task(client, p["id"], "Foundation", 3, [a["id"]])
    c = await _task(client, p["id"], "Utilities", 2, [a["code"]])  # a task code is accepted too
    d = await _task(client, p["id"], "Plinth", 4, [b["id"], c["id"]])
    assert a["code"].startswith("WBS-") and c["predecessor_ids"] == [a["id"]]

    s = await _get(client, f"/projects/{p['id']}/schedule")
    rows = {r["name"]: r for r in s["tasks"]}
    assert s["duration_days"] == 12 and s["finish"] == (TODAY + timedelta(days=11)).isoformat()
    assert s["critical_path"] == [a["id"], b["id"], d["id"]]
    assert rows["Utilities"]["float_days"] == 1 and not rows["Utilities"]["critical"]
    assert rows["Plinth"]["start"] == (TODAY + timedelta(days=8)).isoformat()

    # a back-edge would make a cycle; self-dependency and unknown ids are rejected too
    cyc = await client.patch(f"{B}/wbs/{a['id']}", json={"predecessor_ids": [d["id"]]})
    assert cyc.status_code == 422 and "cycle" in cyc.text
    assert (await client.patch(f"{B}/wbs/{a['id']}", json={"predecessor_ids": [a["id"]]})).status_code == 422
    assert (await client.patch(f"{B}/wbs/{a['id']}", json={"predecessor_ids": ["nope"]})).status_code == 422
    # a task other tasks depend on cannot be deleted
    assert (await client.delete(f"{B}/wbs/{a['id']}")).status_code == 409


@pytest.mark.asyncio
async def test_progress_via_endpoint_and_daily_report(client, test_vendor_user):
    p = await _project(client)
    a = await _task(client, p["id"], "Excavation", 5)
    b = await _task(client, p["id"], "Foundation", 5, [a["id"]], weight=3)

    r = await _post(client, f"/wbs/{a['id']}/progress", {"percent": 50}, status=200)
    assert "50%" in r["message"]
    assert (await client.get(f"{B}/wbs/{a['id']}")).json()["status"] == "in_progress"
    back = await client.post(f"{B}/wbs/{a['id']}/progress", json={"percent": 20})
    assert back.status_code == 409
    over = await client.post(f"{B}/wbs/{a['id']}/progress", json={"percent": 120})
    assert over.status_code == 422

    # a DPR drives the linked task's progress
    await _post(client, "/site-progress", {
        "project_id": p["id"], "wbs_task_id": b["id"], "report_date": TODAY.isoformat(), "progress_percent": 40, "labour_count": 25})
    assert (await client.get(f"{B}/wbs/{b['id']}")).json()["progress_percent"] == 40
    no_task = await client.post(f"{B}/site-progress", json={
        "project_id": p["id"], "report_date": TODAY.isoformat(), "progress_percent": 10})
    assert no_task.status_code == 422

    s = await _get(client, f"/projects/{p['id']}/schedule")
    # weighted: (50*1 + 40*3) / 4 = 42.5
    assert s["progress_percent"] == 42.5

    await _post(client, f"/wbs/{a['id']}/progress", {"percent": 100}, status=200)
    done = (await client.get(f"{B}/wbs/{a['id']}")).json()
    assert done["status"] == "completed" and done["actual_end"] == TODAY.isoformat()


@pytest.mark.asyncio
async def test_milestone_achievement_triggers_customer_billing(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], [
        ("Booking", 10, "on_booking", 0, None), ("Plinth", 40, "milestone", 0, "Plinth"),
        ("Possession", 50, "on_possession", 0, None)])
    b = await _book(client, project)
    await _sign_agreement(client, b["id"])
    task = await _task(client, project["id"], "Plinth works", 10)
    ms = await _post(client, "/milestones", {
        "project_id": project["id"], "wbs_task_id": task["id"], "name": "Plinth", "due_date": TODAY.isoformat()})
    assert ms["status"] == "pending"
    res = await _post(client, f"/milestones/{ms['id']}/achieve", {}, status=200)
    assert res["billing"]["demands_created"] == 1 and "demand" in res["message"]
    got = (await client.get(f"{B}/milestones/{ms['id']}")).json()
    assert got["status"] == "achieved" and got["billing_triggered"] is True
    assert (await client.get(f"{B}/wbs/{task['id']}")).json()["progress_percent"] == 100
    assert (await client.post(f"{B}/milestones/{ms['id']}/achieve", json={})).status_code == 409


# ── construction ────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_work_order_quality_safety_and_inspection_workflows(client, test_vendor_user):
    p = await _project(client)
    wo = await _post(client, "/work-orders", {"project_id": p["id"], "title": "Block work Tower A"})
    assert wo["wo_no"].startswith("WO-") and wo["status"] == "draft"
    assert (await client.post(f"{B}/work-orders/{wo['id']}/start", json={})).status_code == 409
    await _post(client, f"/work-orders/{wo['id']}/issue", status=200)
    await _post(client, f"/work-orders/{wo['id']}/start", status=200)
    await _post(client, f"/work-orders/{wo['id']}/complete", {}, status=200)
    assert (await client.get(f"{B}/work-orders/{wo['id']}")).json()["status"] == "completed"

    # quality: a failed check needs a rectification date, then rectify -> close
    bad = await client.post(f"{B}/quality-checks", json={"project_id": p["id"], "checklist_name": "Slab", "inspected_on": TODAY.isoformat(), "result": "fail"})
    assert bad.status_code == 422
    q = await _post(client, "/quality-checks", {
        "project_id": p["id"], "checklist_name": "Slab", "inspected_on": TODAY.isoformat(), "result": "fail",
        "rectification_due": (TODAY + timedelta(days=7)).isoformat()})
    assert q["status"] == "open"
    assert (await client.post(f"{B}/quality-checks/{q['id']}/close", json={})).status_code == 409
    await _post(client, f"/quality-checks/{q['id']}/rectify", status=200)
    await _post(client, f"/quality-checks/{q['id']}/close", status=200)
    passed = await _post(client, "/quality-checks", {"project_id": p["id"], "checklist_name": "Rebar", "inspected_on": TODAY.isoformat(), "result": "pass"})
    assert passed["status"] == "closed"

    # safety: a major incident cannot be closed without root cause and corrective action; it raises an alert
    inc = await _post(client, "/safety-incidents", {
        "project_id": p["id"], "incident_date": TODAY.isoformat(), "severity": "major", "description": "Scaffold collapse", "injured_count": 1})
    assert any("safety" in a["title"].lower() for a in await _alerts(client))
    assert (await client.post(f"{B}/safety-incidents/{inc['id']}/close", json={})).status_code == 409
    await client.patch(f"{B}/safety-incidents/{inc['id']}", json={"root_cause": "Loose coupler", "corrective_action": "Re-certify scaffolds"})
    await _post(client, f"/safety-incidents/{inc['id']}/close", status=200)

    insp = await _post(client, "/inspections", {"project_id": p["id"], "title": "Fire NOC", "inspection_type": "fire", "scheduled_on": TODAY.isoformat()})
    assert (await client.post(f"{B}/inspections/{insp['id']}/complete", json={"outcome": "failed"})).status_code == 422
    await _post(client, f"/inspections/{insp['id']}/complete", {"outcome": "passed", "certificate_ref": "FIRE-77"}, status=200)
    done = (await client.get(f"{B}/inspections/{insp['id']}")).json()
    assert done["status"] == "completed" and done["certificate_ref"] == "FIRE-77"


@pytest.mark.asyncio
async def test_boq_amount_and_budget_validation(client, test_vendor_user):
    p = await _project(client)
    item = await _post(client, "/boq-items", {"project_id": p["id"], "description": "RCC M25", "unit": "cum", "quantity": 120, "rate": 6500})
    assert item["amount"] == 780_000
    patched = await client.patch(f"{B}/boq-items/{item['id']}", json={"rate": 7000})
    assert patched.json()["amount"] == 840_000
    neg = await client.post(f"{B}/project-budgets", json={"project_id": p["id"], "cost_head": "materials", "budget_amount": -1})
    assert neg.status_code == 422


# ── procurement → inventory → costing ───────────────────────────────────────────────────────

async def _masters(client, project_id):
    s1 = await _post(client, "/suppliers", {"name": "Sharma Traders", "payment_terms_days": 15})
    s2 = await _post(client, "/suppliers", {"name": "Bharat Steel"})
    cement = await _post(client, "/materials", {"name": "Cement OPC 53", "category": "cement", "unit": "bag", "reorder_level": 50})
    steel = await _post(client, "/materials", {"name": "TMT 12mm", "category": "steel", "unit": "kg"})
    store = await _post(client, "/site-stores", {"name": "Main Store", "project_id": project_id})
    return s1, s2, cement, steel, store


async def _approved_po(client, p, s1, s2, cement, steel, store):
    pr = await _post(client, "/purchase-requisitions", {"project_id": p["id"], "store_id": store["id"]})
    assert pr["pr_no"].startswith("PR-") and pr["status"] == "draft"
    l1 = await _post(client, "/pr-lines", {"pr_id": pr["id"], "material_id": cement["id"], "quantity": 100})
    l2 = await _post(client, "/pr-lines", {"pr_id": pr["id"], "material_id": steel["id"], "quantity": 10})
    # a requisition with no lines cannot be submitted
    empty = await _post(client, "/purchase-requisitions", {"project_id": p["id"]})
    assert (await client.post(f"{B}/purchase-requisitions/{empty['id']}/submit", json={})).status_code == 409
    await _post(client, f"/purchase-requisitions/{pr['id']}/submit", status=200)
    late = await client.post(f"{B}/pr-lines", json={"pr_id": pr["id"], "material_id": cement["id"], "quantity": 1})
    assert late.status_code == 409
    # an RFQ needs an approved requisition
    assert (await client.post(f"{B}/rfqs", json={"pr_id": pr["id"]})).status_code == 409
    await _post(client, f"/purchase-requisitions/{pr['id']}/approve", status=200)

    rfq = await _post(client, "/rfqs", {"pr_id": pr["id"]})
    assert rfq["rfq_no"].startswith("RFQ-") and rfq["project_id"] == p["id"]
    for sup, c_rate, s_rate in ((s1, 400, 60000), (s2, 380, 62000)):
        await _post(client, "/rfq-quotes", {"rfq_id": rfq["id"], "supplier_id": sup["id"], "pr_line_id": l1["id"], "rate": c_rate, "lead_days": 3})
        await _post(client, "/rfq-quotes", {"rfq_id": rfq["id"], "supplier_id": sup["id"], "pr_line_id": l2["id"], "rate": s_rate, "lead_days": 5})
    dup = await client.post(f"{B}/rfq-quotes", json={"rfq_id": rfq["id"], "supplier_id": s1["id"], "pr_line_id": l1["id"], "rate": 1})
    assert dup.status_code in (409, 422)
    return pr, rfq, l1, l2


@pytest.mark.asyncio
async def test_requisition_rfq_comparison_award_and_po_approval(client, test_vendor_user):
    p = await _project(client)
    s1, s2, cement, steel, store = await _masters(client, p["id"])
    pr, rfq, l1, l2 = await _approved_po(client, p, s1, s2, cement, steel, store)

    comp = await _get(client, f"/rfqs/{rfq['id']}/comparison")
    totals = {s["supplier"]: s["total_with_gst"] for s in comp["suppliers"]}
    assert totals["Sharma Traders"] == 755_200 and totals["Bharat Steel"] == round((100 * 380 + 10 * 62000) * 1.18, 2)
    # Bharat Steel: 100*380 + 10*62000 = 658,000 + 18% = 776,440 > 755,200, so Sharma is the cheapest complete quote
    assert comp["recommended_supplier_id"] == s1["id"]
    cement_quotes = next(r for r in comp["lines"] if r["material"] == "Cement OPC 53")["quotes"]
    assert next(q for q in cement_quotes if q["lowest"])["supplier_id"] == s2["id"]  # per-line lowest differs from the overall pick

    await _post(client, "/approval-rules", {"entity_type": "purchase_order", "name": "Big POs", "field": "amount", "min_value": 500_000})
    award = await _post(client, f"/rfqs/{rfq['id']}/award", {"supplier_id": s1["id"]}, status=200)
    assert award["total_amount"] == 755_200
    po = (await client.get(f"{B}/purchase-orders/{award['po_id']}")).json()
    assert po["status"] == "draft" and po["subtotal"] == 640_000 and po["gst_amount"] == 115_200 and po["rfq_id"] == rfq["id"]
    assert (await client.get(f"{B}/rfqs/{rfq['id']}")).json()["status"] == "awarded"
    assert (await client.get(f"{B}/purchase-requisitions/{pr['id']}")).json()["status"] == "ordered"
    # awarded RFQ is closed to further changes
    assert (await client.post(f"{B}/rfqs/{rfq['id']}/award", json={"supplier_id": s2["id"]})).status_code == 409

    # draft PO lines are editable; totals follow
    lines = (await _get(client, "/po-lines", po_id=po["id"]))["items"]
    cement_line = next(x for x in lines if x["material_id"] == cement["id"])
    await client.patch(f"{B}/po-lines/{cement_line['id']}", json={"rate": 410})
    assert (await client.get(f"{B}/purchase-orders/{po['id']}")).json()["subtotal"] == 100 * 410 + 600_000
    await client.patch(f"{B}/po-lines/{cement_line['id']}", json={"rate": 400})

    sub = await _post(client, f"/purchase-orders/{po['id']}/submit", status=200)
    assert sub["status"] == "pending_approval"
    assert (await client.patch(f"{B}/purchase-orders/{po['id']}", json={"terms": "x"})).status_code == 409
    assert (await client.patch(f"{B}/po-lines/{cement_line['id']}", json={"rate": 1})).status_code == 409
    req = next(r for r in (await _get(client, "/approval-requests"))["items"] if r["entity_type"] == "purchase_order")
    await _post(client, f"/approval-requests/{req['id']}/approve", {}, status=200)
    assert (await client.get(f"{B}/purchase-orders/{po['id']}")).json()["status"] == "approved"


@pytest.mark.asyncio
async def test_grn_stock_weighted_average_issue_transfer_wastage_and_costing(client, test_vendor_user):
    p = await _project(client)
    s1, s2, cement, steel, store = await _masters(client, p["id"])
    pr, rfq, l1, l2 = await _approved_po(client, p, s1, s2, cement, steel, store)
    await _post(client, "/project-budgets", {"project_id": p["id"], "cost_head": "materials", "budget_amount": 650_000})
    award = await _post(client, f"/rfqs/{rfq['id']}/award", {"supplier_id": s1["id"]}, status=200)
    po_id = award["po_id"]
    await _post(client, f"/purchase-orders/{po_id}/submit", status=200)  # no rule -> approved straight away
    assert (await client.get(f"{B}/purchase-orders/{po_id}")).json()["status"] == "approved"
    lines = {x["material_id"]: x for x in (await _get(client, "/po-lines", po_id=po_id))["items"]}

    costing = await _get(client, f"/projects/{p['id']}/costing")
    mat = next(r for r in costing["rows"] if r["cost_head"] == "materials")
    assert mat["committed"] == 640_000 and mat["actual"] == 0 and mat["budget"] == 650_000 and not mat["over_budget"]

    # GRN 1: 60 bags + all steel; accepting more than ordered + 5% is refused on posting
    grn = await _post(client, "/grns", {"po_id": po_id, "store_id": store["id"], "received_on": TODAY.isoformat(), "challan_no": "CH-1"})
    assert grn["grn_no"].startswith("GRN-") and grn["supplier_id"] == s1["id"] and grn["project_id"] == p["id"]
    over = await _post(client, "/grn-lines", {"grn_id": grn["id"], "po_line_id": lines[cement["id"]]["id"], "received_quantity": 106, "accepted_quantity": 106})
    assert (await client.post(f"{B}/grns/{grn['id']}/post", json={})).status_code == 409
    await client.patch(f"{B}/grn-lines/{over['id']}", json={"received_quantity": 62, "accepted_quantity": 60})
    got = (await client.get(f"{B}/grn-lines/{over['id']}")).json()
    assert got["rejected_quantity"] == 2 and got["amount"] == 24_000 and got["rate"] == 400
    await _post(client, "/grn-lines", {"grn_id": grn["id"], "po_line_id": lines[steel["id"]]["id"], "received_quantity": 10, "accepted_quantity": 10})
    bad = await client.post(f"{B}/grn-lines", json={"grn_id": grn["id"], "po_line_id": lines[steel["id"]]["id"], "received_quantity": 5, "accepted_quantity": 9})
    assert bad.status_code == 422
    await _post(client, f"/grns/{grn['id']}/post", status=200)
    g1 = (await client.get(f"{B}/grns/{grn['id']}")).json()
    assert g1["status"] == "posted" and g1["total_value"] == 624_000 and g1["gst_amount"] == 112_320 and g1["payable_amount"] == 736_320
    assert (await client.get(f"{B}/purchase-orders/{po_id}")).json()["status"] == "partially_received"
    assert (await client.post(f"{B}/grns/{grn['id']}/cancel", json={})).status_code == 409  # posted GRNs are immutable
    assert (await client.post(f"{B}/grn-lines", json={"grn_id": grn["id"], "po_line_id": lines[cement["id"]]["id"], "received_quantity": 1, "accepted_quantity": 1})).status_code == 409

    # GRN 2: the remaining 40 bags at a higher negotiated rate -> weighted average (60*400 + 40*450) / 100 = 420
    grn2 = await _post(client, "/grns", {"po_id": po_id, "store_id": store["id"], "received_on": TODAY.isoformat()})
    await _post(client, "/grn-lines", {"grn_id": grn2["id"], "po_line_id": lines[cement["id"]]["id"], "received_quantity": 40, "accepted_quantity": 40, "rate": 450})
    await _post(client, f"/grns/{grn2['id']}/post", status=200)
    assert (await client.get(f"{B}/purchase-orders/{po_id}")).json()["status"] == "received"
    assert (await client.post(f"{B}/grns", json={"po_id": po_id, "store_id": store["id"], "received_on": TODAY.isoformat()})).status_code == 409

    bal = await _get(client, "/inventory/stock-balance", project_id=p["id"])
    c_row = next(r for r in bal["rows"] if r["material"] == "Cement OPC 53")
    assert c_row["quantity"] == 100 and c_row["avg_rate"] == 420 and c_row["value"] == 42_000
    assert bal["low_stock_count"] == 0

    # costing: materials actual = posted GRN value ex-GST; over budget now
    costing = await _get(client, f"/projects/{p['id']}/costing")
    mat = next(r for r in costing["rows"] if r["cost_head"] == "materials")
    assert mat["actual"] == 642_000 and mat["committed"] == 0 and mat["variance"] == 8_000 and not mat["over_budget"]
    assert costing["totals"]["actual"] == 642_000

    # issue 30 bags at the moving average; issuing more than is on hand fails at posting
    iss = await _post(client, "/material-issues", {"project_id": p["id"], "store_id": store["id"], "issued_on": TODAY.isoformat(), "issued_to": "Ravi Constructions"})
    assert iss["issue_no"].startswith("MI-")
    await _post(client, "/issue-lines", {"issue_id": iss["id"], "material_id": cement["id"], "quantity": 30})
    await _post(client, f"/material-issues/{iss['id']}/post", status=200)
    iss_got = (await client.get(f"{B}/material-issues/{iss['id']}")).json()
    assert iss_got["status"] == "posted" and iss_got["total_value"] == 12_600
    big = await _post(client, "/material-issues", {"project_id": p["id"], "store_id": store["id"], "issued_on": TODAY.isoformat()})
    await _post(client, "/issue-lines", {"issue_id": big["id"], "material_id": cement["id"], "quantity": 500})
    r = await client.post(f"{B}/material-issues/{big['id']}/post", json={})
    assert r.status_code == 409 and "Insufficient" in r.text
    await _post(client, f"/material-issues/{big['id']}/cancel", status=200)

    # transfer 20 bags to a second store: valued at the source average
    store2 = await _post(client, "/site-stores", {"name": "Tower B Store", "project_id": p["id"]})
    tr = await _post(client, "/stock-transfers", {"from_store_id": store["id"], "to_store_id": store2["id"], "transfer_date": TODAY.isoformat()})
    await _post(client, "/transfer-lines", {"transfer_id": tr["id"], "material_id": cement["id"], "quantity": 20})
    await _post(client, f"/stock-transfers/{tr['id']}/post", status=200)
    same = await client.post(f"{B}/stock-transfers", json={"from_store_id": store["id"], "to_store_id": store["id"], "transfer_date": TODAY.isoformat()})
    assert same.status_code == 422
    bal = await _get(client, "/inventory/stock-balance", project_id=p["id"])
    by_store = {r["store"]: r for r in bal["rows"] if r["material"] == "Cement OPC 53"}
    assert by_store["Main Store"]["quantity"] == 50 and by_store["Tower B Store"]["quantity"] == 20
    assert by_store["Tower B Store"]["avg_rate"] == 420
    assert by_store["Main Store"]["low_stock"] is True  # 50 <= reorder level 50
    assert any("Low stock" in a["title"] for a in await _alerts(client))

    # wastage writes stock off and can be reversed
    w = await _post(client, "/wastage", {"store_id": store["id"], "material_id": cement["id"], "quantity": 5, "wastage_date": TODAY.isoformat(), "reason": "breakage"})
    assert w["value"] == 2_100 and w["status"] == "posted"
    too_much = await client.post(f"{B}/wastage", json={"store_id": store["id"], "material_id": cement["id"], "quantity": 999, "wastage_date": TODAY.isoformat(), "reason": "breakage"})
    assert too_much.status_code == 409
    await _post(client, f"/wastage/{w['id']}/reverse", status=200)
    assert (await client.post(f"{B}/wastage/{w['id']}/reverse", json={})).status_code == 409
    bal = await _get(client, "/inventory/stock-balance", store_id=store["id"])
    assert next(r for r in bal["rows"] if r["material"] == "Cement OPC 53")["quantity"] == 50

    # the ledger records every movement with a running balance
    led = (await _get(client, "/stock-ledger", store_id=store["id"], material_id=cement["id"], size=50))["items"]
    assert {x["txn_type"] for x in led} >= {"grn", "issue", "transfer_out", "wastage", "adjustment"}
    assert (await client.post(f"{B}/stock-ledger", json={})).status_code in (403, 404, 405, 422)

    # supplier payables, then payment
    pay = await _get(client, "/payables/summary")
    assert pay["by_kind"]["supplier"] == 736_320 + 21_240
    paid = await _post(client, f"/grns/{grn['id']}/pay", {"mode": "neft", "reference": "UTR1"}, status=200)
    assert "paid" in paid["message"]
    assert (await client.post(f"{B}/grns/{grn['id']}/pay", json={})).status_code == 409
    assert (await _get(client, "/payables/summary"))["by_kind"]["supplier"] == 21_240


async def _alerts(client):
    data = await _get(client, "/alerts")
    return data["items"] if isinstance(data, dict) else data


# ── contractors ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_subcontract_ra_bills_retention_tds_advance_and_release(client, test_vendor_user):
    p = await _project(client)
    ind = await _post(client, "/contractors", {"name": "Ravi Mason", "contractor_type": "individual"})
    firm = await _post(client, "/contractors", {"name": "Delta Builders", "contractor_type": "firm", "pan": "ABCDE1234F"})
    assert ind["tds_percent"] == 1 and firm["tds_percent"] == 2 and firm["code"].startswith("CT-")

    sc = await _post(client, "/subcontracts", {
        "project_id": p["id"], "contractor_id": firm["id"], "title": "Structure", "contract_value": 1_000_000,
        "retention_percent": 5, "gst_percent": 18, "advance_amount": 100_000})
    assert sc["status"] == "draft" and sc["tds_percent"] == 2 and sc["sc_no"].startswith("SC-")
    early = await client.post(f"{B}/work-certificates", json={"subcontract_id": sc["id"], "bill_date": TODAY.isoformat(), "cumulative_work_done": 1000})
    assert early.status_code == 409  # contract not active yet
    await _post(client, f"/subcontracts/{sc['id']}/activate", status=200)
    locked = await client.patch(f"{B}/subcontracts/{sc['id']}", json={"contract_value": 5})
    assert locked.status_code == 409

    b1 = await _post(client, "/work-certificates", {
        "subcontract_id": sc["id"], "bill_date": TODAY.isoformat(), "cumulative_work_done": 400_000, "advance_recovery": 40_000})
    assert (b1["gross_amount"], b1["retention_amount"], b1["gst_amount"], b1["tds_amount"], b1["net_payable"]) == (
        400_000, 20_000, 72_000, 8_000, 404_000)
    assert b1["bill_seq"] == 1 and b1["status"] == "draft"
    # one open bill at a time
    assert (await client.post(f"{B}/work-certificates", json={"subcontract_id": sc["id"], "bill_date": TODAY.isoformat(), "cumulative_work_done": 500_000})).status_code == 409
    # deductions are validated
    assert (await client.patch(f"{B}/work-certificates/{b1['id']}", json={"advance_recovery": 200_000})).status_code == 422
    sub = await _post(client, f"/work-certificates/{b1['id']}/submit", status=200)
    assert sub["status"] == "approved"
    after = (await client.get(f"{B}/subcontracts/{sc['id']}")).json()
    assert after["billed_amount"] == 400_000 and after["advance_recovered"] == 40_000
    ret = await _get(client, f"/subcontracts/{sc['id']}/retention")
    assert ret["held"] == 20_000 and ret["balance"] == 20_000

    # cumulative must increase and stay within the contract (variations raise the ceiling)
    assert (await client.post(f"{B}/work-certificates", json={"subcontract_id": sc["id"], "bill_date": TODAY.isoformat(), "cumulative_work_done": 300_000})).status_code == 422
    assert (await client.post(f"{B}/work-certificates", json={"subcontract_id": sc["id"], "bill_date": TODAY.isoformat(), "cumulative_work_done": 1_100_000})).status_code == 409
    await client.patch(f"{B}/subcontracts/{sc['id']}", json={"variation_amount": 50_000})
    assert (await client.patch(f"{B}/subcontracts/{sc['id']}", json={"variation_amount": -700_000})).status_code == 409

    # the final bill goes through the approval engine
    await _post(client, "/approval-rules", {"entity_type": "work_certificate", "name": "Big bills", "field": "amount", "min_value": 500_000})
    b2 = await _post(client, "/work-certificates", {
        "subcontract_id": sc["id"], "bill_date": TODAY.isoformat(), "cumulative_work_done": 1_000_000, "advance_recovery": 60_000, "is_final": True})
    assert (b2["gross_amount"], b2["retention_amount"], b2["net_payable"], b2["bill_seq"]) == (600_000, 30_000, 606_000, 2)
    assert (await _post(client, f"/work-certificates/{b2['id']}/submit", status=200))["status"] == "pending_approval"
    assert (await client.post(f"{B}/subcontracts/{sc['id']}/complete", json={})).status_code == 409  # open bill
    early = await client.post(f"{B}/subcontracts/{sc['id']}/release-retention", json={"amount": 1000})
    assert early.status_code == 409  # only after completion
    req = next(r for r in (await _get(client, "/approval-requests"))["items"] if r["entity_type"] == "work_certificate")
    await _post(client, f"/approval-requests/{req['id']}/approve", {}, status=200)
    assert (await client.get(f"{B}/work-certificates/{b2['id']}")).json()["status"] == "approved"
    assert (await client.get(f"{B}/subcontracts/{sc['id']}")).json()["status"] == "completed"  # final bill completes it
    assert (await _get(client, "/work-certificates", is_final="true"))["total"] == 1

    pay = await _get(client, "/payables/summary")
    assert pay["by_kind"]["contractor"] == 404_000 + 606_000 and pay["retention_held"] == 50_000
    await _post(client, f"/work-certificates/{b1['id']}/pay", {"mode": "neft", "reference": "UTR9"}, status=200)
    assert (await client.post(f"{B}/work-certificates/{b1['id']}/pay", json={})).status_code == 409
    assert (await _get(client, "/payables/summary"))["by_kind"]["contractor"] == 606_000

    over = await client.post(f"{B}/subcontracts/{sc['id']}/release-retention", json={"amount": 60_000})
    assert over.status_code == 409
    await _post(client, f"/subcontracts/{sc['id']}/release-retention", {"amount": 50_000, "remarks": "DLP over"}, status=200)
    assert (await _get(client, f"/subcontracts/{sc['id']}/retention"))["balance"] == 0
    assert (await client.post(f"{B}/subcontracts/{sc['id']}/release-retention", json={"amount": 1})).status_code == 409
    ledger = (await _get(client, "/retention-ledger", subcontract_id=sc["id"]))["items"]
    assert sorted(e["kind"] for e in ledger) == ["held", "held", "released"]

    # costing picks up the contract cost
    await _post(client, "/project-budgets", {"project_id": p["id"], "cost_head": "construction", "budget_amount": 900_000})
    costing = await _get(client, f"/projects/{p['id']}/costing")
    row = next(r for r in costing["rows"] if r["cost_head"] == "construction")
    assert row["actual"] == 1_000_000 and row["over_budget"]


@pytest.mark.asyncio
async def test_terminated_contract_and_cancelled_bill(client, test_vendor_user):
    p = await _project(client)
    ct = await _post(client, "/contractors", {"name": "Quick Works", "contractor_type": "company"})
    sc = await _post(client, "/subcontracts", {"project_id": p["id"], "contractor_id": ct["id"], "title": "Finishing", "contract_value": 100_000})
    assert (await client.delete(f"{B}/subcontracts/{sc['id']}")).status_code in (200, 204)
    sc = await _post(client, "/subcontracts", {"project_id": p["id"], "contractor_id": ct["id"], "title": "Finishing", "contract_value": 100_000})
    await _post(client, f"/subcontracts/{sc['id']}/activate", status=200)
    assert (await client.delete(f"{B}/subcontracts/{sc['id']}")).status_code == 409
    bill = await _post(client, "/work-certificates", {"subcontract_id": sc["id"], "bill_date": TODAY.isoformat(), "cumulative_work_done": 10_000})
    assert (await client.post(f"{B}/subcontracts/{sc['id']}/terminate", json={"reason": "poor quality"})).status_code == 409
    await _post(client, f"/work-certificates/{bill['id']}/cancel", {"reason": "raised in error"}, status=200)
    await _post(client, f"/subcontracts/{sc['id']}/terminate", {"reason": "poor quality"}, status=200)
    assert (await client.get(f"{B}/subcontracts/{sc['id']}")).json()["status"] == "terminated"
    again = await client.post(f"{B}/work-certificates", json={"subcontract_id": sc["id"], "bill_date": TODAY.isoformat(), "cumulative_work_done": 20_000})
    assert again.status_code == 409
