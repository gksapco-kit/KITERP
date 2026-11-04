"""Real estate — Phase 0/1: admin foundation, property, sales, booking, customers."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.api.deps import get_current_vendor_user
from app.main import app
from app.models.vendor_user import VendorUser

B = "/api/v1/vendors/me/realestate"


async def _post(client: AsyncClient, path: str, body: dict | None = None, status: int = 201):
    r = await client.post(f"{B}{path}", json=body or {})
    assert r.status_code == status, f"{path}: {r.status_code} {r.text}"
    return r.json()


async def _setup_inventory(client: AsyncClient, units_per_floor: int = 2):
    project = await _post(client, "/projects", {
        "name": "Skyline Residency", "city": "Pune", "rera_number": "P52100000001", "gst_rate": 5,
        "stamp_duty_pct": 5, "registration_fee_pct": 1,
    })
    tower = await _post(client, "/towers", {"project_id": project["id"], "name": "Tower A"})
    utype = await _post(client, "/unit-types", {
        "project_id": project["id"], "name": "2BHK", "bedrooms": 2, "carpet_area": 800, "super_area": 1000, "base_rate": 5000,
    })
    gen = await _post(client, f"/towers/{tower['id']}/generate-units", {
        "unit_type_id": utype["id"], "floors_from": 1, "floors_to": 3, "units_per_floor": units_per_floor,
    }, status=200)
    return project, tower, utype, gen


async def _customer(client: AsyncClient, name="Asha Verma", phone="9000000001"):
    return await _post(client, "/customers", {"full_name": name, "phone": phone, "pan": "ABCDE1234F"})


@pytest.mark.asyncio
async def test_meta_lists_modules_and_resources(client, test_vendor_user):
    r = await client.get(f"{B}/meta")
    assert r.status_code == 200
    data = r.json()
    assert len(data["modules"]) == 24
    assert "units" in data["resources"]
    unit_fields = {f["name"]: f for f in data["resources"]["units"]["fields"]}
    assert unit_fields["status"]["choices"][0] == "available"
    assert unit_fields["project_id"]["ref"] == "projects"
    assert unit_fields["tower_id"]["type"] == "ref"


@pytest.mark.asyncio
async def test_project_auto_code_and_unit_generation(client, test_vendor_user):
    project, tower, _, gen = await _setup_inventory(client)
    assert project["code"].startswith("PRJ-")
    assert gen["created"] == 6
    # idempotent: second call skips existing numbers
    again = await _post(client, f"/towers/{tower['id']}/generate-units", {
        "floors_from": 1, "floors_to": 3, "units_per_floor": 2}, status=200)
    assert again["created"] == 0 and again["skipped"] == 6
    units = (await client.get(f"{B}/units", params={"project_id": project["id"], "size": 100})).json()
    assert units["total"] == 6
    first = units["items"][-1] if units["items"][0]["unit_number"] > units["items"][-1]["unit_number"] else units["items"][0]
    # 1000 sqft * 5000 base rate
    assert first["total_price"] == 5_000_000
    assert first["_refs"]["project_id"] == "Skyline Residency"


@pytest.mark.asyncio
async def test_price_list_apply_updates_units(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    pl = await _post(client, "/price-lists", {
        "project_id": project["id"], "name": "Launch", "base_rate": 6000, "floor_rise_per_floor": 10,
        "floor_rise_from_floor": 1, "parking_amount": 200000,
    })
    res = await _post(client, f"/price-lists/{pl['id']}/apply", status=200)
    assert res["updated"] == 6
    units = (await client.get(f"{B}/units", params={"project_id": project["id"], "floor_number": 3})).json()["items"]
    u = units[0]
    # 1000*(6000 + 3*10) + 200000 parking
    assert u["total_price"] == 1000 * (6000 + 30) + 200000


@pytest.mark.asyncio
async def test_unit_status_cannot_be_set_manually(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    r = await client.patch(f"{B}/units/{unit['id']}", json={"status": "booked"})
    assert r.status_code == 409
    r = await client.patch(f"{B}/units/{unit['id']}", json={"status": "hold"})
    assert r.status_code == 200 and r.json()["status"] == "hold"


@pytest.mark.asyncio
async def test_invalid_choice_and_cross_tenant_reference_rejected(client, test_vendor_user):
    r = await client.post(f"{B}/leads", json={"full_name": "X", "stage": "bogus"})
    assert r.status_code == 422
    # reference to a project that does not exist for this vendor
    r = await client.post(f"{B}/towers", json={"project_id": str(uuid.uuid4()), "name": "Ghost"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_lead_pipeline_conversion_and_followups(client, test_vendor_user):
    lead = await _post(client, "/leads", {"full_name": "Ravi", "phone": "9111111111", "budget_max": 7000000})
    assert lead["lead_no"].startswith("LD-") and lead["stage"] == "new"
    # follow-up updates lead.next_followup_at
    due = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    fu = await _post(client, "/followups", {"lead_id": lead["id"], "due_at": due, "followup_type": "call"})
    got = (await client.get(f"{B}/leads/{lead['id']}")).json()
    assert got["next_followup_at"] is not None
    await _post(client, f"/followups/{fu['id']}/complete", {"outcome": "interested"}, status=200)
    got = (await client.get(f"{B}/leads/{lead['id']}")).json()
    assert got["next_followup_at"] is None
    # stage moves
    await _post(client, f"/leads/{lead['id']}/stage", {"stage": "qualified"}, status=200)
    bad = await client.post(f"{B}/leads/{lead['id']}/stage", json={"stage": "booked"})
    assert bad.status_code == 409
    pipe = (await client.get(f"{B}/leads/pipeline")).json()
    qualified = next(s for s in pipe["stages"] if s["stage"] == "qualified")
    assert qualified["count"] == 1 and qualified["items"][0]["full_name"] == "Ravi"
    conv = await _post(client, f"/leads/{lead['id']}/convert", status=200)
    assert conv["customer_id"]
    lost = await client.post(f"{B}/leads/{lead['id']}/lost", json={"reason": "bought elsewhere"})
    assert lost.status_code == 200


@pytest.mark.asyncio
async def test_enquiry_to_lead_and_site_visit(client, test_vendor_user):
    enq = await _post(client, "/enquiries", {"full_name": "Meera", "phone": "9222222222", "channel": "website"})
    res = await _post(client, f"/enquiries/{enq['id']}/convert", status=200)
    again = await client.post(f"{B}/enquiries/{enq['id']}/convert")
    assert again.status_code == 409
    visit = await _post(client, "/site-visits", {
        "lead_id": res["lead_id"], "scheduled_at": datetime.now(timezone.utc).isoformat()})
    lead = (await client.get(f"{B}/leads/{res['lead_id']}")).json()
    assert lead["stage"] == "site_visit_scheduled"
    await _post(client, f"/site-visits/{visit['id']}/complete", {"interest_level": "hot", "rating": 5}, status=200)
    lead = (await client.get(f"{B}/leads/{res['lead_id']}")).json()
    assert lead["stage"] == "site_visited"


@pytest.mark.asyncio
async def test_quotation_cost_sheet(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    q = await _post(client, "/quotations", {"unit_id": unit["id"], "discount_amount": 100000})
    assert q["quote_no"].startswith("QT-")
    assert q["agreement_value"] == 4_900_000
    assert q["gst_amount"] == 245_000  # 5%
    assert q["stamp_duty"] == 245_000 and q["registration_fee"] == 49_000
    assert q["total_cost"] == 4_900_000 + 245_000 + 245_000 + 49_000
    # draft only editable; after send it is locked
    await _post(client, f"/quotations/{q['id']}/send", status=200)
    r = await client.patch(f"{B}/quotations/{q['id']}", json={"terms": "x"})
    assert r.status_code == 409
    sheet = (await client.get(f"{B}/quotations/{q['id']}/sheet")).json()
    assert "Agreement value" in sheet["html"]


@pytest.mark.asyncio
async def test_block_expiry_and_release(client, test_vendor_user, db_session):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    block = await _post(client, f"/units/{unit['id']}/block", {"hours": 2, "reason": "walk-in"}, status=200)
    assert (await client.get(f"{B}/units/{unit['id']}")).json()["status"] == "blocked"
    again = await client.post(f"{B}/units/{unit['id']}/block", json={"hours": 2})
    assert again.status_code == 409
    # force expiry
    from sqlalchemy import update
    from app.models.realestate.core import ReUnitBlock
    await db_session.execute(update(ReUnitBlock).values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
    await db_session.commit()
    grid = (await client.get(f"{B}/units/availability", params={"project_id": project["id"]})).json()
    assert grid["summary"].get("blocked") is None and grid["summary"]["available"] == 6
    blocks = (await client.get(f"{B}/unit-blocks")).json()["items"]
    assert blocks[0]["status"] == "expired"
    # manual release
    b2 = await _post(client, f"/units/{unit['id']}/block", {"hours": 1}, status=200)
    await _post(client, f"/unit-blocks/{b2['id']}/release", status=200)
    assert (await client.get(f"{B}/units/{unit['id']}")).json()["status"] == "available"


@pytest.mark.asyncio
async def test_booking_allotment_cancellation_refund_flow(client, test_vendor_user, db_session):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    cust = await _customer(client)
    booking = await _post(client, "/bookings", {
        "unit_id": unit["id"], "customer_id": cust["id"], "discount_amount": 50000, "token_amount": 100000,
    })
    assert booking["status"] == "confirmed" and booking["booking_no"].startswith("BK-")
    assert booking["agreement_value"] == 4_950_000
    assert (await client.get(f"{B}/units/{unit['id']}")).json()["status"] == "booked"
    # cannot double-book
    cust2 = await _customer(client, "Other", "9333333333")
    dup = await client.post(f"{B}/bookings", json={"unit_id": unit["id"], "customer_id": cust2["id"]})
    assert dup.status_code == 409
    # primary applicant auto-created
    apps = (await client.get(f"{B}/booking-applicants", params={"booking_id": booking["id"]})).json()
    assert apps["total"] == 1 and apps["items"][0]["is_primary"] is True
    # allotment
    allot = await _post(client, f"/bookings/{booking['id']}/allot", status=200)
    assert "Skyline Residency" in allot["html"] and "Asha Verma" in allot["html"]
    again = await client.post(f"{B}/bookings/{booking['id']}/allot")
    assert again.status_code == 409
    # simulate payments received then cancel
    from sqlalchemy import update
    from app.models.realestate.core import ReBooking
    await db_session.execute(update(ReBooking).where(ReBooking.id == uuid.UUID(booking["id"])).values(paid_amount=600000))
    await db_session.commit()
    c = await _post(client, f"/bookings/{booking['id']}/cancel-request",
                    {"reason": "loan rejected", "forfeiture_percent": 10}, status=200)
    # forfeiture = min(600000, 10% of 4,950,000 = 495,000) -> refundable 105,000
    assert c["refundable_amount"] == 105_000
    dup_c = await client.post(f"{B}/bookings/{booking['id']}/cancel-request", json={"reason": "again"})
    assert dup_c.status_code == 409
    canc = (await client.get(f"{B}/cancellations")).json()["items"][0]
    await _post(client, f"/cancellations/{canc['id']}/approve", status=200)
    assert (await client.get(f"{B}/units/{unit['id']}")).json()["status"] == "available"
    assert (await client.get(f"{B}/bookings/{booking['id']}")).json()["status"] == "cancelled"
    refund = (await client.get(f"{B}/refunds")).json()["items"][0]
    assert refund["amount"] == 105_000 and refund["status"] == "pending"
    await _post(client, f"/refunds/{refund['id']}/pay", {"mode": "neft", "reference_no": "UTR123"}, status=200)
    canc = (await client.get(f"{B}/cancellations/{canc['id']}")).json()
    assert canc["status"] == "completed"


@pytest.mark.asyncio
async def test_discount_requires_approval_then_confirms(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    cust = await _customer(client)
    await _post(client, "/approval-rules", {
        "entity_type": "booking", "name": "Discount > 5%", "field": "discount_percent", "min_value": 5,
    })
    booking = await _post(client, "/bookings", {
        "unit_id": unit["id"], "customer_id": cust["id"], "discount_amount": 500000})  # 10%
    assert booking["status"] == "pending_approval" and booking["approval_required"] is True
    assert (await client.get(f"{B}/units/{unit['id']}")).json()["status"] == "blocked"
    reqs = (await client.get(f"{B}/approval-requests", params={"status": "pending"})).json()["items"]
    assert len(reqs) == 1
    # requester is owner with realestate.admin, so self-approval is permitted
    await _post(client, f"/approval-requests/{reqs[0]['id']}/approve", {"comments": "ok"}, status=200)
    assert (await client.get(f"{B}/bookings/{booking['id']}")).json()["status"] == "confirmed"
    assert (await client.get(f"{B}/units/{unit['id']}")).json()["status"] == "booked"
    alerts = (await client.get(f"{B}/alerts")).json()
    assert alerts["total"] >= 0


@pytest.mark.asyncio
async def test_rejected_approval_releases_unit(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    cust = await _customer(client)
    await _post(client, "/approval-rules", {"entity_type": "booking", "name": "d", "field": "discount_percent", "min_value": 1})
    booking = await _post(client, "/bookings", {"unit_id": unit["id"], "customer_id": cust["id"], "discount_amount": 200000})
    req = (await client.get(f"{B}/approval-requests")).json()["items"][0]
    no_reason = await client.post(f"{B}/approval-requests/{req['id']}/reject", json={})
    assert no_reason.status_code == 422
    await _post(client, f"/approval-requests/{req['id']}/reject", {"comments": "too high"}, status=200)
    assert (await client.get(f"{B}/bookings/{booking['id']}")).json()["status"] == "cancelled"
    assert (await client.get(f"{B}/units/{unit['id']}")).json()["status"] == "available"


@pytest.mark.asyncio
async def test_kyc_verification_updates_customer(client, test_vendor_user):
    cust = await _customer(client)
    pan = await _post(client, "/kyc-documents", {"customer_id": cust["id"], "doc_type": "pan", "doc_number": "ABCDE1234F"})
    aad = await _post(client, "/kyc-documents", {"customer_id": cust["id"], "doc_type": "aadhaar", "doc_number": "1234"})
    r = await _post(client, f"/kyc-documents/{pan['id']}/verify", status=200)
    assert r["customer_kyc_status"] == "submitted"
    r = await _post(client, f"/kyc-documents/{aad['id']}/verify", status=200)
    assert r["customer_kyc_status"] == "verified"
    assert (await client.get(f"{B}/customers/{cust['id']}")).json()["kyc_status"] == "verified"
    # kyc_status cannot be set through the generic API
    patched = await client.patch(f"{B}/customers/{cust['id']}", json={"kyc_status": "pending"})
    assert patched.json()["kyc_status"] == "verified"


@pytest.mark.asyncio
async def test_agreement_draft_sign_register(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    cust = await _customer(client)
    booking = await _post(client, "/bookings", {"unit_id": unit["id"], "customer_id": cust["id"]})
    early = await client.post(f"{B}/bookings/{booking['id']}/agreement", json={})
    assert early.status_code == 409
    await _post(client, f"/bookings/{booking['id']}/allot", status=200)
    ag = await _post(client, f"/bookings/{booking['id']}/agreement", {"agreement_type": "agreement_for_sale"}, status=200)
    assert "AGREEMENT FOR SALE" in ag["html"]
    await _post(client, f"/agreements/{ag['agreement_id']}/sign", {}, status=200)
    assert (await client.get(f"{B}/bookings/{booking['id']}")).json()["status"] == "agreement_signed"
    reg = await _post(client, f"/agreements/{ag['agreement_id']}/register", {"registration_no": "REG/2026/77"}, status=200)
    assert "REG/2026/77" in reg["message"]
    assert (await client.get(f"{B}/bookings/{booking['id']}")).json()["status"] == "registered"


@pytest.mark.asyncio
async def test_publish_unit_creates_website_listing(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    unit = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"][0]
    res = await _post(client, f"/units/{unit['id']}/publish", status=200)
    assert res["listing_id"]
    listing = await client.get(f"/api/v1/vendors/me/properties/{res['listing_id']}")
    assert listing.status_code == 200 and listing.json()["status"] == "for-sale"
    again = await _post(client, f"/units/{unit['id']}/publish", status=200)
    assert again["listing_id"] == res["listing_id"]


@pytest.mark.asyncio
async def test_audit_log_records_changes(client, test_vendor_user):
    cust = await _customer(client)
    await client.patch(f"{B}/customers/{cust['id']}", json={"city": "Mumbai"})
    logs = (await client.get(f"{B}/audit-logs", params={"entity_type": "customers"})).json()
    actions = {l["action"] for l in logs["items"]}
    assert {"create", "update"} <= actions
    update = next(l for l in logs["items"] if l["action"] == "update")
    assert update["changes"]["city"]["to"] == "Mumbai"
    # audit log is read-only
    r = await client.post(f"{B}/audit-logs", json={})
    assert r.status_code in (404, 405)


@pytest.mark.asyncio
@pytest.mark.parametrize("role,expected", [
    ("staff", 403), ("cashier", 403), ("re_sales_executive", 201), ("re_legal", 403),
])
async def test_rbac_on_lead_creation(client, test_vendor, test_user, role, expected):
    app.dependency_overrides[get_current_vendor_user] = lambda: VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id, role=role, permissions=[], is_active=True)
    try:
        r = await client.post(f"{B}/leads", json={"full_name": "RBAC"})
        assert r.status_code == expected, r.text
        listing = await client.get(f"{B}/leads")
        assert listing.status_code == (403 if role in ("staff", "cashier") else 200)
    finally:
        app.dependency_overrides.pop(get_current_vendor_user, None)


@pytest.mark.asyncio
async def test_numbering_sequences_are_unique_and_configurable(client, test_vendor_user):
    a = await _post(client, "/leads", {"full_name": "A"})
    b = await _post(client, "/leads", {"full_name": "B"})
    assert a["lead_no"] != b["lead_no"]
    ranges = (await client.get(f"{B}/number-ranges", params={"doc_type": "lead"})).json()["items"]
    assert ranges[0]["next_number"] == 3
    await client.patch(f"{B}/number-ranges/{ranges[0]['id']}", json={"prefix": "ENQ", "include_year": False, "padding": 3})
    c = await _post(client, "/leads", {"full_name": "C"})
    assert c["lead_no"] == "ENQ-003"
