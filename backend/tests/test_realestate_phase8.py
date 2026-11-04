"""Real estate â€” Phase 8: release blockers (secrets, portal hardening, ledger-posting visibility, delete guards)."""
import pytest

from app.api.v1.realestate import ratelimit
from tests.test_realestate_phase1 import B, _post, _setup_inventory
from tests.test_realestate_phase4 import _approved_po, _masters, _project
from tests.test_realestate_phase5 import PUB, _registered_booking

MASK = "********"


async def _get(client, path, **params):
    """GET with query filters (a ``status`` filter must not be mistaken for the expected HTTP status)."""
    r = await client.get(f"{B}{path}", params=params)
    assert r.status_code == 200, f"{path}: {r.status_code} {r.text}"
    return r.json()


# â”€â”€ integration secrets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.asyncio
async def test_integration_secrets_are_masked_and_kept_out_of_the_audit_log(client, test_vendor_user):
    integ = await _post(client, "/integrations", {
        "provider": "payment_gateway", "name": "Razorpay", "is_enabled": True,
        "config": {"key_id": "rzp_live_ABC123", "key_secret": "s3cr3t-value", "webhook_url": "https://x.test/hook"}})
    assert integ["config"]["key_secret"] == MASK and integ["config"]["key_id"] == MASK
    assert integ["config"]["webhook_url"] == "https://x.test/hook"  # non-secret settings stay readable

    got = await _get(client, f"/integrations/{integ['id']}")
    listed = (await _get(client, "/integrations"))["items"][0]
    assert got["config"]["key_secret"] == MASK and listed["config"]["key_secret"] == MASK

    # echoing the masked form back (what the edit form does) must not overwrite the stored secret
    r = await client.patch(f"/api/v1/vendors/me/realestate/integrations/{integ['id']}",
                           json={"config": {"key_id": MASK, "key_secret": MASK, "webhook_url": "https://y.test/hook"}})
    assert r.status_code == 200, r.text
    t = await _post(client, f"/integrations/{integ['id']}/test", status=200)
    assert t["status"] == "ok"  # both required keys are still present, i.e. the real values were kept

    # rotating a secret works, and neither the old nor the new value ever reaches the audit trail
    r = await client.patch(f"/api/v1/vendors/me/realestate/integrations/{integ['id']}",
                           json={"config": {"key_id": MASK, "key_secret": "rotated-value"}})
    assert r.status_code == 200, r.text
    logs = (await _get(client, "/audit-logs", entity_type="integrations"))["items"]
    dump = str(logs)
    assert logs and "s3cr3t-value" not in dump and "rotated-value" not in dump and "rzp_live_ABC123" not in dump


@pytest.mark.asyncio
async def test_integrations_need_admin_to_read(client, test_vendor, test_user):
    import uuid

    from app.api.deps import get_current_vendor_user
    from app.main import app
    from app.models.vendor_user import VendorUser

    app.dependency_overrides[get_current_vendor_user] = lambda: VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id, role="re_sales_executive", permissions=[], is_active=True)
    try:
        assert (await client.get(f"{B}/integrations")).status_code == 403
        assert (await client.get(f"{B}/gl-failures")).status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_vendor_user, None)


# â”€â”€ customer portal hardening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.asyncio
async def test_portal_token_only_in_header_with_safe_headers_and_csp(client, test_vendor_user):
    ratelimit.reset_memory()
    _, b = await _registered_booking(client)
    link = await _post(client, f"/customers/{b['customer_id']}/portal-link", {"days": 7}, status=200)
    token = link["token"]

    # a token in the URL is no longer accepted anywhere
    assert (await client.get(f"{PUB}/portal/me", params={"token": token})).status_code == 401

    me = await client.get(f"{PUB}/portal/me", headers={"X-Portal-Token": token})
    assert me.status_code == 200
    assert me.headers["referrer-policy"] == "no-referrer" and me.headers["cache-control"] == "no-store"
    assert me.headers["x-content-type-options"] == "nosniff"

    demand = me.json()["bookings"][0]["demands"][0]
    letter = await client.get(f"{PUB}/portal/demands/{demand['id']}/letter", headers={"X-Portal-Token": token})
    assert letter.status_code == 200
    csp = letter.headers["content-security-policy"]
    assert "default-src 'none'" in csp and "script-src" not in csp and "sandbox" in csp
    assert letter.headers["referrer-policy"] == "no-referrer"


@pytest.mark.asyncio
async def test_portal_writes_are_rate_limited(client, test_vendor_user):
    ratelimit.reset_memory()
    _, b = await _registered_booking(client)
    link = await _post(client, f"/customers/{b['customer_id']}/portal-link", {"days": 7}, status=200)
    h = {"X-Portal-Token": link["token"]}
    t = await client.post(f"{PUB}/portal/tickets", headers=h, json={"subject": "Leaking tap", "category": "request"})
    assert t.status_code == 201, t.text
    codes = []
    for i in range(ratelimit.WRITE_LIMIT + 2):
        r = await client.post(f"{PUB}/portal/tickets/{t.json()['id']}/comments", headers=h, json={"body": f"ping {i}"})
        codes.append(r.status_code)
    assert codes[0] == 201 and 429 in codes
    assert codes.count(201) <= ratelimit.WRITE_LIMIT  # the ticket creation used one slot of the window
    blocked = await client.post(f"{PUB}/portal/tickets/{t.json()['id']}/comments", headers=h, json={"body": "again"})
    assert blocked.status_code == 429 and "retry-after" in blocked.headers
    # reads have their own, larger budget: still allowed
    assert (await client.get(f"{PUB}/portal/me", headers=h)).status_code == 200
    ratelimit.reset_memory()


# â”€â”€ general-ledger posting visibility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.asyncio
async def test_unposted_documents_are_logged_and_can_be_retried(client, test_vendor_user, monkeypatch):
    ratelimit.reset_memory()
    # no finance accounts are configured in tests, so issuing the first demand cannot reach the ledger
    _, b = await _registered_booking(client)
    failures = (await _get(client, "/gl-failures", status="open"))["items"]
    assert failures, "a document that could not be posted must be recorded"
    f = failures[0]
    assert f["status"] == "open" and f["attempts"] >= 1 and (f["error"] or "").strip()

    # retrying while the ledger is still not configured keeps it open and counts the attempt
    again = await _post(client, f"/gl-failures/{f['id']}/retry", status=200)
    assert again["status"] == "open"
    assert (await _get(client, f"/gl-failures/{f['id']}"))["attempts"] == f["attempts"] + 1

    # the reconciliation report tells Finance about it
    rec = await _get(client, "/tax/reconciliation")
    assert rec["gl_posting"]["open_failures"] >= 1
    assert any("not posted" in i["title"].lower() for i in rec["issues"])

    # once Finance is set up the retry posts the journal, links the document and closes the issue
    class _JE:
        id = __import__("uuid").uuid4()

    async def fake_post_event(db, vendor_id, source_type, source_id, payload):
        assert payload["total"] is not None and not isinstance(payload["total"], float)  # revived to Decimal
        return _JE()

    monkeypatch.setattr("app.services.finance.posting.post_event", fake_post_event)
    done = await _post(client, "/gl-failures/retry-all", status=200)
    assert done["resolved"] >= 1
    assert (await _get(client, f"/gl-failures/{f['id']}"))["status"] == "resolved"
    assert (await _get(client, "/gl-failures", status="open"))["total"] == done["still_open"]
    demand = (await _get(client, "/demands", booking_id=b["id"]))["items"][0]
    assert demand["gl_entry_id"] == str(_JE.id)
    # nothing left to retry for a resolved item
    assert (await client.post(f"{B}/gl-failures/{f['id']}/retry")).status_code == 409


# â”€â”€ delete guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.asyncio
async def test_supplier_quotes_cannot_be_deleted_after_the_rfq_is_awarded(client, test_vendor_user):
    p = await _project(client)
    s1, s2, cement, steel, store = await _masters(client, p["id"])
    pr, rfq, l1, l2 = await _approved_po(client, p, s1, s2, cement, steel, store)
    quotes = (await _get(client, "/rfq-quotes", rfq_id=rfq["id"]))["items"]
    assert quotes
    await _post(client, f"/rfqs/{rfq['id']}/award", {"supplier_id": s1["id"]}, status=200)
    r = await client.delete(f"{B}/rfq-quotes/{quotes[0]['id']}")
    assert r.status_code == 409 and "can no longer be removed" in r.text
