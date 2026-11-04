"""Real estate — Phase 5: handover & possession, snags, warranty, customer care tickets/SLA, feedback and the customer portal."""
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from tests.test_realestate_phase1 import B, _post, _setup_inventory
from tests.test_realestate_phase2 import _book, _plan, _sign_agreement

PUB = "/api/v1/public/realestate"
TODAY = date.today()
PLAN = [("Booking", 10, "on_booking", 0, None), ("On agreement", 85, "on_agreement", 0, None), ("Possession", 5, "on_possession", 0, None)]


async def _get(client, path, status=200, **params):
    r = await client.get(f"{B}{path}", params=params)
    assert r.status_code == status, f"{path}: {r.status_code} {r.text}"
    return r.json()


async def _registered_booking(client, project=None, unit_idx=0):
    if project is None:
        project, *_ = await _setup_inventory(client)
        await _plan(client, project["id"], PLAN)
    b = await _book(client, project, unit_idx=unit_idx)
    ag = await _sign_agreement(client, b["id"])
    await _post(client, f"/agreements/{ag['agreement_id']}/register", {"registration_no": f"REG-{unit_idx}"}, status=200)
    return project, b


async def _pay(client, booking_id, amount):
    return await _post(client, "/receipts", {"booking_id": booking_id, "amount": amount, "mode": "neft", "reference_no": "UTR"})


async def _oc(client, project_id):
    return await _post(client, "/statutory-approvals", {
        "project_id": project_id, "approval_type": "occupancy_certificate", "status": "approved",
        "valid_until": (TODAY + timedelta(days=3650)).isoformat()})


async def _handed_over(client, unit_idx=0, project=None):
    project, b = await _registered_booking(client, project, unit_idx)
    await _oc(client, project["id"]) if unit_idx == 0 else None
    ho = await _post(client, f"/bookings/{b['id']}/schedule-handover", {}, status=201)
    await _post(client, f"/handovers/{ho['id']}/inspect", {}, status=200)
    await _post(client, f"/handovers/{ho['id']}/offer", {}, status=200)
    await _pay(client, b["id"], 5_250_000)
    await _post(client, f"/handovers/{ho['id']}/complete", {"received_by_name": "Asha Verma", "keys_count": 3}, status=200)
    return project, b, ho


# ── handover ────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_handover_gates_snags_dues_and_completion(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], PLAN)
    b = await _book(client, project)
    # not registered yet -> cannot schedule
    early = await client.post(f"{B}/bookings/{b['id']}/schedule-handover", json={})
    assert early.status_code == 409
    ag = await _sign_agreement(client, b["id"])
    assert (await client.post(f"{B}/bookings/{b['id']}/schedule-handover", json={})).status_code == 409  # signed, not registered
    await _post(client, f"/agreements/{ag['agreement_id']}/register", {"registration_no": "REG-1"}, status=200)

    ho = await _post(client, f"/bookings/{b['id']}/schedule-handover", {}, status=201)
    assert ho["handover_no"].startswith("HO-")
    assert (await client.post(f"{B}/bookings/{b['id']}/schedule-handover", json={})).status_code == 409  # one live handover
    row = await _get(client, f"/handovers/{ho['id']}")
    assert row["status"] == "scheduled" and len(row["checklist"]) >= 8 and row["unit_id"] == b["unit_id"]

    ready = await _get(client, f"/handovers/{ho['id']}/readiness")
    by = {c["key"]: c for c in ready["checks"]}
    assert not by["oc"]["ok"] and not by["dues"]["ok"] and not ready["can_offer"]

    # inspection must precede the offer; then the OC gate applies
    assert (await client.post(f"{B}/handovers/{ho['id']}/offer", json={})).status_code == 409
    await _post(client, f"/handovers/{ho['id']}/inspect", {}, status=200)
    no_oc = await client.post(f"{B}/handovers/{ho['id']}/offer", json={})
    assert no_oc.status_code == 409 and "occupancy" in no_oc.text.lower()
    no_reason = await client.post(f"{B}/handovers/{ho['id']}/offer", json={"waive_oc": "yes"})
    assert no_reason.status_code == 422
    await _oc(client, project["id"])

    # a critical snag blocks the offer until it is rectified and verified
    snag = await _post(client, "/snags", {"handover_id": ho["id"], "category": "plumbing", "location": "Master bath",
                                          "description": "Concealed pipe leak", "severity": "critical"})
    assert snag["status"] == "open" and snag["unit_id"] == b["unit_id"]
    assert snag["due_date"] == (TODAY + timedelta(days=7)).isoformat()
    blocked = await client.post(f"{B}/handovers/{ho['id']}/offer", json={})
    assert blocked.status_code == 409 and "critical" in blocked.text
    assert (await client.post(f"{B}/snags/{snag['id']}/verify", json={})).status_code == 409  # not rectified yet
    assert (await client.post(f"{B}/snags/{snag['id']}/rectify", json={})).status_code == 422
    await _post(client, f"/snags/{snag['id']}/assign", {"assigned_to": "Plumbing crew"}, status=200)
    await _post(client, f"/snags/{snag['id']}/rectify", {"resolution": "Pipe replaced and pressure tested"}, status=200)
    # a rectified-but-unverified snag still counts as open for the gate
    assert (await client.post(f"{B}/handovers/{ho['id']}/offer", json={})).status_code == 409
    await _post(client, f"/snags/{snag['id']}/verify", status=200)
    minor = await _post(client, "/snags", {"handover_id": ho["id"], "category": "painting", "description": "Touch-up near door"})
    assert minor["severity"] == "minor"  # minor snags do not block

    offer = await _post(client, f"/handovers/{ho['id']}/offer", {}, status=200)
    assert offer["demands_created"] == 1  # the on-possession instalment is demanded now
    fin = (await client.get(f"{B}/bookings/{b['id']}/finance")).json()
    poss = next(d for d in fin["demands"] if d["stage_name"] == "Possession")
    assert poss["total_amount"] == 262_500

    # dues outstanding -> cannot complete
    dues = await client.post(f"{B}/handovers/{ho['id']}/complete", json={"received_by_name": "Asha"})
    assert dues.status_code == 409 and "outstanding" in dues.text
    assert (await client.post(f"{B}/handovers/{ho['id']}/complete", json={"received_by_name": "Asha", "waive_dues": "yes"})).status_code == 422
    await _pay(client, b["id"], 5_250_000)
    assert (await _get(client, f"/handovers/{ho['id']}/readiness"))["outstanding"] == 0
    done = await _post(client, f"/handovers/{ho['id']}/complete", {
        "received_by_name": "Asha Verma", "keys_count": 3, "electricity_meter_reading": "00123"}, status=200)
    assert [w["coverage"] for w in done["warranties"]] == ["structural", "general"]

    assert (await _get(client, f"/bookings/{b['id']}"))["status"] == "handed_over"
    assert (await _get(client, f"/units/{b['unit_id']}"))["status"] == "handed_over"
    ho_row = await _get(client, f"/handovers/{ho['id']}")
    assert ho_row["status"] == "handed_over" and ho_row["handed_over_on"] == TODAY.isoformat() and ho_row["customer_acknowledged"]
    assert (await client.patch(f"{B}/handovers/{ho['id']}", json={"remarks": "x"})).status_code == 409
    assert (await client.post(f"{B}/handovers/{ho['id']}/cancel", json={"reason": "x"})).status_code == 409

    warranties = (await _get(client, "/warranties", booking_id=b["id"]))["items"]
    structural = next(w for w in warranties if w["coverage"] == "structural")
    assert structural["statutory"] and structural["months"] == 60 and structural["ends_on"][:4] == str(TODAY.year + 5)
    assert (await client.patch(f"{B}/warranties/{structural['id']}", json={"months": 6})).status_code == 409
    assert (await client.post(f"{B}/warranties/{structural['id']}/void", json={"reason": "x"})).status_code == 409


@pytest.mark.asyncio
async def test_oc_and_dues_waivers_and_cancellation(client, test_vendor_user):
    project, b = await _registered_booking(client)
    ho = await _post(client, f"/bookings/{b['id']}/schedule-handover", {}, status=201)
    await _post(client, f"/handovers/{ho['id']}/inspect", {}, status=200)
    # admin may waive the OC with a reason; the waiver is recorded
    await _post(client, f"/handovers/{ho['id']}/offer", {"waive_oc": "yes", "reason": "OC applied, awaiting stamp"}, status=200)
    row = await _get(client, f"/handovers/{ho['id']}")
    assert row["status"] == "ready" and row["oc_waived"] is True and "OC" in row["waiver_reason"]
    await _post(client, f"/handovers/{ho['id']}/complete", {"received_by_name": "Asha", "waive_dues": "yes", "reason": "Final instalment by home-loan"}, status=200)
    row = await _get(client, f"/handovers/{ho['id']}")
    assert row["dues_waived"] is True and row["status"] == "handed_over"

    # a cancelled handover frees the booking for a new schedule
    project2, b2 = await _registered_booking(client, project, unit_idx=1)
    h2 = await _post(client, f"/bookings/{b2['id']}/schedule-handover", {}, status=201)
    await _post(client, f"/handovers/{h2['id']}/cancel", {"reason": "customer abroad"}, status=200)
    h3 = await _post(client, f"/bookings/{b2['id']}/schedule-handover", {}, status=201)
    assert h3["id"] != h2["id"]


# ── warranty & tickets ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_structural_claim_ticket_sla_and_lifecycle(client, test_vendor_user, db_session):
    from app.models.realestate.postsales import ReTicket, ReWarranty

    _, b, _ = await _handed_over(client)
    ws = {w["coverage"]: w for w in (await _get(client, "/warranties", booking_id=b["id"]))["items"]}

    claim = await _post(client, f"/warranties/{ws['structural']['id']}/claim", {"subject": "Cracks in beam", "priority": "low"}, status=201)
    t = await _get(client, f"/tickets/{claim['id']}")
    assert t["category"] == "structural_defect" and t["priority"] == "high"  # raised to at least high
    assert t["sla_hours"] == 720 and t["warranty_id"] == ws["structural"]["id"] and t["customer_id"] == b["customer_id"]

    # a defect on the general warranty uses the priority SLA
    gen = await _post(client, f"/warranties/{ws['general']['id']}/claim", {"subject": "Loose tile", "priority": "urgent"}, status=201)
    g = await _get(client, f"/tickets/{gen['id']}")
    assert g["category"] == "defect" and g["sla_hours"] == 4

    # an expired warranty cannot be claimed
    await db_session.execute(update(ReWarranty).where(ReWarranty.coverage == "general").values(ends_on=TODAY - timedelta(days=1)))
    await db_session.commit()
    assert (await client.post(f"{B}/warranties/{ws['general']['id']}/claim", json={"subject": "Late"})).status_code == 409
    await _get(client, "/care/summary")  # lazily marks lapsed warranties
    assert (await _get(client, f"/warranties/{ws['general']['id']}"))["status"] == "expired"

    # lifecycle: assign -> note -> resolve -> close -> reopen
    tid = g["id"]
    await _post(client, f"/tickets/{tid}/assign", {"assignee": "Care team"}, status=200)
    assert (await _get(client, f"/tickets/{tid}"))["first_response_at"] is not None
    await _post(client, "/ticket-comments", {"ticket_id": tid, "body": "Visiting tomorrow", "is_internal": False})
    assert (await client.post(f"{B}/tickets/{tid}/resolve", json={})).status_code == 422
    # make it overdue so the breach is recorded and alerted
    await db_session.execute(update(ReTicket).where(ReTicket.id == __import__("uuid").UUID(tid)).values(due_at=datetime.now(timezone.utc) - timedelta(hours=2)))
    await db_session.commit()
    alerts = (await _get(client, "/alerts"))["items"]
    assert any("breached its SLA" in a["title"] for a in alerts)
    res = await _post(client, f"/tickets/{tid}/resolve", {"resolution": "Tile re-fixed"}, status=200)
    assert "SLA breached" in res["message"]
    assert (await _get(client, f"/tickets/{tid}"))["sla_breached"] is True
    await _post(client, f"/tickets/{tid}/close", status=200)
    assert (await client.post(f"{B}/ticket-comments", json={"ticket_id": tid, "body": "late"})).status_code == 409
    await _post(client, f"/tickets/{tid}/reopen", {"reason": "Tile loose again"}, status=200)
    re = await _get(client, f"/tickets/{tid}")
    assert re["status"] == "open" and re["reopen_count"] == 1 and re["sla_breached"] is False

    # a manual structural ticket needs a booking with an active structural warranty
    no_booking = await client.post(f"{B}/tickets", json={"customer_id": b["customer_id"], "category": "structural_defect", "subject": "x"})
    assert no_booking.status_code == 422
    other = await client.post(f"{B}/tickets", json={"customer_id": b["customer_id"], "booking_id": b["id"], "category": "defect", "subject": "Paint peeling", "priority": "medium"})
    assert other.status_code == 201 and other.json()["sla_hours"] == 72


@pytest.mark.asyncio
async def test_feedback_validation_and_care_summary(client, test_vendor_user):
    _, b, ho = await _handed_over(client)
    cust = b["customer_id"]
    assert (await client.post(f"{B}/feedback", json={"customer_id": cust, "rating": 6})).status_code == 422
    assert (await client.post(f"{B}/feedback", json={"customer_id": cust, "rating": 4, "nps": 11})).status_code == 422
    t = await _post(client, "/tickets", {"customer_id": cust, "booking_id": b["id"], "category": "request", "subject": "NOC letter"})
    assert (await client.post(f"{B}/feedback", json={"ticket_id": t["id"], "rating": 5})).status_code == 409  # not resolved yet
    await _post(client, f"/tickets/{t['id']}/resolve", {"resolution": "Issued"}, status=200)
    f1 = await _post(client, "/feedback", {"ticket_id": t["id"], "rating": 5, "nps": 10, "comments": "Quick"})
    assert f1["kind"] == "ticket" and f1["customer_id"] == cust
    await _post(client, "/feedback", {"handover_id": ho["id"], "rating": 3, "nps": 6})
    s = await _get(client, "/care/summary")
    assert s["feedback"]["count"] == 2 and s["feedback"]["avg_rating"] == 4 and s["feedback"]["nps"] == 0  # one promoter, one detractor
    assert s["tickets"]["total"] == 1 and s["tickets"]["sla_met_percent"] == 100
    assert s["warranties"]["active"] == 2 and s["handovers"]["handed_over"] == 1


# ── customer portal ─────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_customer_portal_link_scope_tickets_and_revocation(client, test_vendor_user):
    project, b = await _registered_booking(client)
    _, b2 = await _registered_booking(client, project, unit_idx=1)

    # the generic API cannot flip portal access; only the link flow does
    cust = await _get(client, f"/customers/{b['customer_id']}")
    assert cust["portal_enabled"] is False
    assert (await client.patch(f"{B}/customers/{b['customer_id']}", json={"portal_enabled": True})).json()["portal_enabled"] is False

    link = await _post(client, f"/customers/{b['customer_id']}/portal-link", {"days": 7}, status=200)
    token = link["token"]
    assert link["path"].endswith(token) and "html" in link
    assert (await _get(client, f"/customers/{b['customer_id']}"))["portal_enabled"] is True

    me = await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": token})
    assert me.status_code == 200, me.text
    data = me.json()
    assert [x["id"] for x in data["bookings"]] == [b["id"]]  # only this customer's booking, never the other buyer's
    bk = data["bookings"][0]
    assert bk["agreement_value"] == 5_000_000 and bk["status"] == "registered" and bk["outstanding"] == 5_250_000
    assert bk["next_due"] is not None and len(bk["schedule"]) == 3 and bk["handover"] is None
    assert (await client.get(f"{PUB}/portal/me", params={"token": token})).status_code == 401  # header only, never the URL

    # bad / foreign tokens are refused
    assert (await client.get(f"{PUB}/portal/me")).status_code == 401
    assert (await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": token[:-3] + "abc"})).status_code == 401
    assert (await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": "garbage"})).status_code == 401

    # raising a request from the portal; another customer's booking is invisible
    foreign = await client.post(f"{PUB}/portal/tickets", headers={"X-Portal-Token": token},
                                json={"booking_id": b2["id"], "subject": "Hello there", "category": "request"})
    assert foreign.status_code == 404
    r = await client.post(f"{PUB}/portal/tickets", headers={"X-Portal-Token": token},
                          json={"booking_id": b["id"], "subject": "Need a copy of my agreement", "category": "documentation"})
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    staff = await _get(client, f"/tickets/{tid}")
    assert staff["channel"] == "portal" and staff["priority"] == "medium" and staff["customer_id"] == b["customer_id"]
    # staff reply and an internal note: the customer sees only the reply
    await _post(client, "/ticket-comments", {"ticket_id": tid, "body": "Sending it today", "is_internal": False})
    await _post(client, "/ticket-comments", {"ticket_id": tid, "body": "check with legal first", "is_internal": True})
    mine = (await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": token})).json()["tickets"][0]
    assert [c["body"] for c in mine["comments"]] == ["Sending it today"]
    sent = await client.post(f"{PUB}/portal/tickets/{tid}/comments", headers={"X-Portal-Token": token}, json={"body": "Thanks"})
    assert sent.status_code == 201

    # a second customer cannot touch this ticket
    link2 = await _post(client, f"/customers/{b2['customer_id']}/portal-link", {}, status=200)
    other = await client.post(f"{PUB}/portal/tickets/{tid}/comments", headers={"X-Portal-Token": link2["token"]}, json={"body": "hi"})
    assert other.status_code == 404

    # feedback only after resolution; a reply to a resolved ticket reopens it
    early = await client.post(f"{PUB}/portal/feedback", headers={"X-Portal-Token": token}, json={"rating": 5, "ticket_id": tid})
    assert early.status_code == 409
    await _post(client, f"/tickets/{tid}/resolve", {"resolution": "Copy emailed"}, status=200)
    ok = await client.post(f"{PUB}/portal/feedback", headers={"X-Portal-Token": token}, json={"rating": 5, "nps": 9, "ticket_id": tid})
    assert ok.status_code == 201
    assert (await _get(client, "/feedback"))["items"][0]["submitted_via"] == "portal"
    reopen = await client.post(f"{PUB}/portal/tickets/{tid}/comments", headers={"X-Portal-Token": token}, json={"body": "Not received"})
    assert reopen.status_code == 201
    assert (await _get(client, f"/tickets/{tid}"))["status"] == "open"

    # the demand letter is downloadable by its own customer only
    demand = (await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": token})).json()["bookings"][0]["demands"][0]
    assert (await client.get(f"{PUB}/portal/demands/{demand['id']}/letter", headers={"X-Portal-Token": token})).status_code == 200
    assert (await client.get(f"{PUB}/portal/demands/{demand['id']}/letter", headers={"X-Portal-Token": link2["token"]})).status_code == 404

    # regenerating invalidates the old link; revoking kills the current one
    new = await _post(client, f"/customers/{b['customer_id']}/portal-link", {}, status=200)
    assert (await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": token})).status_code == 401
    assert (await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": new["token"]})).status_code == 200
    await _post(client, f"/customers/{b['customer_id']}/portal-revoke", status=200)
    assert (await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": new["token"]})).status_code == 401
    assert (await _get(client, f"/customers/{b['customer_id']}"))["portal_enabled"] is False
