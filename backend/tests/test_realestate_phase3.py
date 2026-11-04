"""Real estate — Phase 3: land bank, acquisition, JDA, title checks and statutory approvals."""
from datetime import date, timedelta

import pytest

from tests.test_realestate_phase1 import B, _customer, _post, _setup_inventory


async def _parcel(client, name="Survey 42", **extra):
    return await _post(client, "/land-parcels", {"name": name, "area": 2, "area_unit": "acre", "land_use": "residential", **extra})


async def _owners(client, parcel_id, shares=(60, 40)):
    out = []
    for i, s in enumerate(shares):
        out.append(await _post(client, "/landowners", {"parcel_id": parcel_id, "name": f"Owner {i + 1}", "share_percent": s, "is_primary": i == 0}))
    return out


async def _acq(client, parcel_id, **extra):
    return await _post(client, "/acquisitions", {
        "parcel_id": parcel_id, "agreed_price": 10_000_000, "stamp_duty": 500_000, "registration_fee": 100_000, **extra})


@pytest.mark.asyncio
async def test_parcel_area_conversion_and_numbering(client, test_vendor_user):
    p = await _parcel(client)
    assert p["code"].startswith("LP-") and p["status"] == "identified"
    assert p["area_sqft"] == 87_120
    patched = await client.patch(f"{B}/land-parcels/{p['id']}", json={"area": 1000, "area_unit": "sqm"})
    assert patched.json()["area_sqft"] == pytest.approx(10_763.9, abs=0.1)
    forced = await client.patch(f"{B}/land-parcels/{p['id']}", json={"status": "acquired"})
    assert forced.json()["status"] == "identified"  # status is workflow-managed


@pytest.mark.asyncio
async def test_landowner_shares_cannot_exceed_100(client, test_vendor_user):
    p = await _parcel(client)
    o1, _ = await _owners(client, p["id"], (60, 30))
    over = await client.post(f"{B}/landowners", json={"parcel_id": p["id"], "name": "X", "share_percent": 20})
    assert over.status_code == 409
    zero = await client.post(f"{B}/landowners", json={"parcel_id": p["id"], "name": "Z", "share_percent": 0})
    assert zero.status_code == 422
    # only one primary owner
    o3 = await _post(client, "/landowners", {"parcel_id": p["id"], "name": "Third", "share_percent": 10, "is_primary": True})
    owners = (await client.get(f"{B}/landowners", params={"parcel_id": p["id"]})).json()["items"]
    assert [o["id"] for o in owners if o["is_primary"]] == [o3["id"]]
    shrink = await client.patch(f"{B}/landowners/{o1['id']}", json={"share_percent": 80})
    assert shrink.status_code == 409


@pytest.mark.asyncio
async def test_acquisition_lifecycle_with_title_and_payment_gates(client, test_vendor_user):
    p = await _parcel(client)
    owners = await _owners(client, p["id"], (60, 30))  # only 90% so far
    acq = await _acq(client, p["id"])
    assert acq["acquisition_no"].startswith("AQ-") and acq["total_cost"] == 10_600_000 and acq["status"] == "draft"
    dup = await client.post(f"{B}/acquisitions", json={"parcel_id": p["id"], "agreed_price": 1})
    assert dup.status_code == 409

    # signing needs the owners to add up to 100%
    r = await client.post(f"{B}/acquisitions/{acq['id']}/sign", json={})
    assert r.status_code == 409 and "100%" in r.text
    await _post(client, "/landowners", {"parcel_id": p["id"], "name": "Owner 3", "share_percent": 10})
    await _post(client, f"/acquisitions/{acq['id']}/negotiate", status=200)
    await _post(client, f"/acquisitions/{acq['id']}/sign", {}, status=200)
    assert (await client.get(f"{B}/land-parcels/{p['id']}")).json()["status"] == "title_check"
    locked = await client.patch(f"{B}/acquisitions/{acq['id']}", json={"agreed_price": 1})
    assert locked.status_code == 409

    # payments
    other_parcel = await _parcel(client, "Other")
    foreign_owner = await _post(client, "/landowners", {"parcel_id": other_parcel["id"], "name": "Foreign", "share_percent": 100})
    bad = await client.post(f"{B}/acquisition-payments", json={
        "acquisition_id": acq["id"], "landowner_id": foreign_owner["id"], "payment_date": date.today().isoformat(), "amount": 100})
    assert bad.status_code == 422
    pay1 = await _post(client, "/acquisition-payments", {
        "acquisition_id": acq["id"], "landowner_id": owners[0]["id"], "payment_date": date.today().isoformat(),
        "purpose": "token", "amount": 1_000_000, "tds_amount": 10_000})
    assert pay1["net_paid"] == 990_000 and pay1["status"] == "paid"
    assert (await client.get(f"{B}/acquisitions/{acq['id']}")).json()["paid_amount"] == 1_000_000
    over = await client.post(f"{B}/acquisition-payments", json={
        "acquisition_id": acq["id"], "payment_date": date.today().isoformat(), "amount": 10_000_000})
    assert over.status_code == 409

    # cannot register: no title search, price not fully paid
    r = await client.post(f"{B}/acquisitions/{acq['id']}/register", json={"registration_no": "R/1"})
    assert r.status_code == 409 and "Title is not clear" in r.text
    ts = await _post(client, "/title-checks", {"parcel_id": p["id"], "check_type": "title_search", "status": "issues_found",
                                              "findings": "Mortgage with co-op bank"})
    clearance = (await client.get(f"{B}/acquisitions/{acq['id']}/clearance")).json()
    assert clearance["clear"] is False and any("issues found" in x for x in clearance["reasons"])
    await client.patch(f"{B}/title-checks/{ts['id']}", json={"status": "clear", "findings": "Mortgage released"})
    r = await client.post(f"{B}/acquisitions/{acq['id']}/register", json={"registration_no": "R/1"})
    assert r.status_code == 409 and "Pay the agreed price" in r.text

    await _post(client, "/acquisition-payments", {
        "acquisition_id": acq["id"], "payment_date": date.today().isoformat(), "purpose": "balance", "amount": 9_000_000}, status=201)
    cancel = await client.post(f"{B}/acquisitions/{acq['id']}/cancel", json={"reason": "x"})
    assert cancel.status_code == 409  # payments exist
    await _post(client, f"/acquisitions/{acq['id']}/register", {
        "registration_no": "R/2026/9", "stamp_duty": 520_000, "registration_fee": 100_000}, status=200)
    got = (await client.get(f"{B}/acquisitions/{acq['id']}")).json()
    assert got["status"] == "registered" and got["total_cost"] == 10_620_000

    project, *_ = await _setup_inventory(client)
    await client.post(f"{B}/acquisitions/{acq['id']}/complete", json={})
    done = (await client.get(f"{B}/acquisitions/{acq['id']}")).json()
    assert done["status"] == "completed"
    parcel = (await client.get(f"{B}/land-parcels/{p['id']}")).json()
    assert parcel["status"] == "acquired"
    # completed acquisition: payments can no longer be cancelled
    r = await client.post(f"{B}/acquisition-payments/{pay1['id']}/cancel", json={"reason": "x"})
    assert r.status_code == 409
    assert project["id"]


@pytest.mark.asyncio
async def test_payment_cancel_updates_totals_and_blocks_draft_payments(client, test_vendor_user):
    p = await _parcel(client)
    acq = await _acq(client, p["id"])
    early = await client.post(f"{B}/acquisition-payments", json={
        "acquisition_id": acq["id"], "payment_date": date.today().isoformat(), "amount": 1000})
    assert early.status_code == 409  # still a draft
    await _post(client, f"/acquisitions/{acq['id']}/negotiate", status=200)
    pay = await _post(client, "/acquisition-payments", {
        "acquisition_id": acq["id"], "payment_date": date.today().isoformat(), "purpose": "token", "amount": 500_000})
    assert (await client.get(f"{B}/acquisitions/{acq['id']}")).json()["paid_amount"] == 500_000
    await _post(client, f"/acquisition-payments/{pay['id']}/cancel", {"reason": "cheque returned"}, status=200)
    assert (await client.get(f"{B}/acquisitions/{acq['id']}")).json()["paid_amount"] == 0
    again = await client.post(f"{B}/acquisition-payments/{pay['id']}/cancel", json={"reason": "x"})
    assert again.status_code == 409
    # now it can be cancelled and the parcel returns to the pool
    await _post(client, f"/acquisitions/{acq['id']}/cancel", {"reason": "price not agreed"}, status=200)
    assert (await client.get(f"{B}/land-parcels/{p['id']}")).json()["status"] == "identified"


@pytest.mark.asyncio
async def test_tds_194ia_on_land_purchase(client, test_vendor_user):
    p = await _parcel(client)
    acq = await _acq(client, p["id"])
    tds = (await client.get(f"{B}/acquisitions/{acq['id']}/tds-suggestion", params={"amount": 1_000_000})).json()
    assert tds["applicable"] is True and tds["tds_amount"] == 10_000 and tds["net_payable"] == 990_000
    ag = await _parcel(client, "Farm", land_use="agricultural")
    acq2 = await _acq(client, ag["id"])
    tds2 = (await client.get(f"{B}/acquisitions/{acq2['id']}/tds-suggestion", params={"amount": 1_000_000})).json()
    assert tds2["applicable"] is False and tds2["tds_amount"] == 0


@pytest.mark.asyncio
async def test_jda_entitlement_allocation_and_completion(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)  # 6 units of 1,000 sq.ft
    p = await _parcel(client)
    owner, = await _owners(client, p["id"], (100,))
    bad = await client.post(f"{B}/jdas", json={"parcel_id": p["id"], "model": "area_share", "landowner_share_percent": 0})
    assert bad.status_code == 422
    jda = await _post(client, "/jdas", {
        "parcel_id": p["id"], "project_id": project["id"], "landowner_id": owner["id"], "model": "area_share",
        "landowner_share_percent": 50})
    assert jda["jda_no"].startswith("JDA-") and jda["status"] == "draft"
    too_much = await client.post(f"{B}/jdas", json={"parcel_id": p["id"], "model": "area_share", "landowner_share_percent": 60})
    assert too_much.status_code == 409
    early = await client.post(f"{B}/jdas/{jda['id']}/allocate-units", json={"unit_numbers": "101"})
    assert early.status_code == 409
    await _post(client, f"/jdas/{jda['id']}/activate", {}, status=200)
    assert (await client.get(f"{B}/land-parcels/{p['id']}")).json()["status"] == "under_jda"

    units = sorted((await client.get(f"{B}/units", params={"project_id": project["id"], "size": 50})).json()["items"],
                   key=lambda u: u["unit_number"])
    first_two = ",".join(u["unit_number"] for u in units[:2])
    res = await _post(client, f"/jdas/{jda['id']}/allocate-units", {"unit_numbers": first_two}, status=200)
    assert len(res["allocated"]) == 2
    report = (await client.get(f"{B}/jdas/{jda['id']}/share-report")).json()
    assert report["entitlement_area_sqft"] == 3000 and report["allocated_area_sqft"] == 2000
    assert report["shortfall_sqft"] == 1000 and report["balanced"] is False
    short = await client.post(f"{B}/jdas/{jda['id']}/complete", json={})
    assert short.status_code == 409

    # landowner units cannot be sold
    cust = await _customer(client)
    sold = await client.post(f"{B}/bookings", json={"unit_id": units[0]["id"], "customer_id": cust["id"]})
    assert sold.status_code == 409
    unit = (await client.get(f"{B}/units/{units[0]['id']}")).json()
    assert unit["status"] == "landowner_share" and unit["is_landowner_share"] is True

    # allocate a third unit; one already-allocated unit is skipped on repeat
    third = units[2]["unit_number"]
    res = await _post(client, f"/jdas/{jda['id']}/allocate-units", {"unit_numbers": f"{units[0]['unit_number']}, {third}"}, status=200)
    assert res["allocated"] == [third] and len(res["skipped"]) == 1
    missing = await client.post(f"{B}/jdas/{jda['id']}/allocate-units", json={"unit_numbers": "ZZZ"})
    assert missing.status_code == 404

    # release and re-allocate to balance
    await _post(client, f"/jdas/{jda['id']}/release-units", {"unit_numbers": third}, status=200)
    assert (await client.get(f"{B}/units/{units[2]['id']}")).json()["status"] == "available"
    await _post(client, f"/jdas/{jda['id']}/allocate-units", {"unit_numbers": third}, status=200)
    report = (await client.get(f"{B}/jdas/{jda['id']}/share-report")).json()
    assert report["allocated_area_sqft"] == 3000 and report["balanced"] is True
    await _post(client, f"/jdas/{jda['id']}/complete", status=200)
    assert (await client.get(f"{B}/jdas/{jda['id']}")).json()["status"] == "completed"


@pytest.mark.asyncio
async def test_jda_termination_returns_units(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    p = await _parcel(client)
    jda = await _post(client, "/jdas", {"parcel_id": p["id"], "project_id": project["id"], "model": "area_share", "landowner_share_percent": 30})
    await _post(client, f"/jdas/{jda['id']}/activate", {}, status=200)
    units = (await client.get(f"{B}/units", params={"project_id": project["id"]})).json()["items"]
    await _post(client, f"/jdas/{jda['id']}/allocate-units", {"unit_numbers": units[0]["unit_number"]}, status=200)
    await _post(client, f"/jdas/{jda['id']}/terminate", {"reason": "owner dispute"}, status=200)
    assert (await client.get(f"{B}/units/{units[0]['id']}")).json()["status"] == "available"
    assert (await client.get(f"{B}/jdas/{jda['id']}")).json()["status"] == "terminated"


@pytest.mark.asyncio
async def test_statutory_approvals_expiry_alerts_and_readiness(client, test_vendor_user):
    project, *_ = await _setup_inventory(client)
    today = date.today()
    no_target = await client.post(f"{B}/statutory-approvals", json={"approval_type": "fire_noc"})
    assert no_target.status_code == 422

    rera = await _post(client, "/statutory-approvals", {
        "project_id": project["id"], "approval_type": "rera_registration", "authority": "MahaRERA", "status": "approved",
        "approved_on": (today - timedelta(days=300)).isoformat(), "valid_until": (today + timedelta(days=20)).isoformat()})
    plan = await _post(client, "/statutory-approvals", {
        "project_id": project["id"], "approval_type": "building_plan", "status": "approved",
        "approved_on": (today - timedelta(days=400)).isoformat(), "valid_until": (today - timedelta(days=1)).isoformat()})
    inverted = await client.post(f"{B}/statutory-approvals", json={
        "project_id": project["id"], "approval_type": "fire_noc", "status": "approved",
        "approved_on": today.isoformat(), "valid_until": (today - timedelta(days=5)).isoformat()})
    assert inverted.status_code == 422
    defaulted = await _post(client, "/statutory-approvals", {
        "project_id": project["id"], "approval_type": "water_noc", "status": "approved",
        "valid_until": (today + timedelta(days=500)).isoformat()})
    assert defaulted["approved_on"] == today.isoformat()

    alerts = (await client.get(f"{B}/alerts")).json()["items"]
    titles = [a["title"] for a in alerts]
    assert "Renewal due: Rera Registration" in titles and "Expired: Building Plan" in titles

    tracker = (await client.get(f"{B}/statutory-approvals/tracker")).json()
    row = tracker["projects"][0]
    assert row["approvals"]["rera_registration"] == "renewal_due" and row["approvals"]["building_plan"] == "expired"
    assert row["launch_ready"] is False and "commencement_certificate" in row["missing_for_launch"]

    # renewals must move validity forward
    bad = await client.post(f"{B}/statutory-approvals/{plan['id']}/renew", json={"valid_until": (today - timedelta(days=30)).isoformat()})
    assert bad.status_code == 422
    await _post(client, f"/statutory-approvals/{plan['id']}/renew", {"valid_until": (today + timedelta(days=365)).isoformat()}, status=200)
    await _post(client, f"/statutory-approvals/{rera['id']}/renew", {"valid_until": (today + timedelta(days=700)).isoformat()}, status=200)
    cc = await _post(client, "/statutory-approvals", {"project_id": project["id"], "approval_type": "commencement_certificate", "status": "applied"})
    await _post(client, f"/statutory-approvals/{cc['id']}/approve", {"valid_until": (today + timedelta(days=900)).isoformat()}, status=200)
    tracker = (await client.get(f"{B}/statutory-approvals/tracker", params={"project_id": project["id"]})).json()
    assert tracker["projects"][0]["launch_ready"] is True
    again = await client.post(f"{B}/statutory-approvals/{cc['id']}/approve", json={})
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_land_summary_and_parcel_reject_reopen(client, test_vendor_user):
    p1 = await _parcel(client, "A")
    await _parcel(client, "B")
    acq = await _acq(client, p1["id"])
    await _post(client, f"/acquisitions/{acq['id']}/negotiate", status=200)
    await _post(client, "/acquisition-payments", {
        "acquisition_id": acq["id"], "payment_date": date.today().isoformat(), "amount": 2_000_000})
    s = (await client.get(f"{B}/land/summary")).json()
    assert s["parcels"] == 2 and s["total_area_sqft"] == 174_240
    assert s["by_status"]["under_negotiation"]["count"] == 1
    assert s["acquisitions"]["total_cost"] == 10_600_000 and s["acquisitions"]["paid"] == 2_000_000
    assert s["acquisitions"]["outstanding"] == 8_600_000
    p2 = (await client.get(f"{B}/land-parcels", params={"search": "B"})).json()["items"][0]
    await _post(client, f"/land-parcels/{p2['id']}/reject", {"reason": "flood zone"}, status=200)
    assert (await client.get(f"{B}/land-parcels/{p2['id']}")).json()["status"] == "rejected"
    await _post(client, f"/land-parcels/{p2['id']}/reopen", status=200)
    assert (await client.get(f"{B}/land-parcels/{p2['id']}")).json()["status"] == "identified"


@pytest.mark.asyncio
async def test_land_and_legal_modules_in_meta(client, test_vendor_user):
    meta = (await client.get(f"{B}/meta")).json()
    land = next(m for m in meta["modules"] if m["id"] == "land")
    assert {"land-parcels", "acquisitions", "jdas", "landowners"} <= {t.get("resource") for t in land["tabs"]}
    assert "land_summary" in {t.get("view") for t in land["tabs"]}
    legal = next(m for m in meta["modules"] if m["id"] == "legal")
    assert "statutory-approvals" in {t.get("resource") for t in legal["tabs"]}
