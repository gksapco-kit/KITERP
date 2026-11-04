"""Real estate - Phase 11: data protection (secrets encrypted at rest, personal identifiers masked by permission)."""
import json
import uuid

import pytest
from sqlalchemy import text

from app.models.realestate.base import ENC_PREFIX
from app.services.realestate import scheduler
from tests.conftest import TestSession, engine
from tests.test_realestate_phase1 import B, _customer, _post
from tests.test_realestate_phase5 import _registered_booking

API = "/api/v1/vendors/me/realestate"
PAN = "ABCDE1234F"
SECRETS = {"key_id": "rzp_live_ABC123", "key_secret": "s3cr3t-value", "webhook_url": "https://x.test/hook"}


async def _raw_config(db_session, integration_id) -> dict:
    # SQLite stores UUIDs as 32-char hex (no dashes); PostgreSQL renders them dashed - match either form.
    uid = uuid.UUID(str(integration_id))
    row = (await db_session.execute(
        text("SELECT CAST(config AS TEXT) FROM re_integration WHERE CAST(id AS TEXT) IN (:d, :h)"),
        {"d": str(uid), "h": uid.hex})).scalar_one()
    return json.loads(row)


class _As:
    """Act as another role for the duration of a block (permissions come from the role defaults)."""

    def __init__(self, vendor, user, role):
        self.vendor, self.user, self.role = vendor, user, role

    def __enter__(self):
        from app.api.deps import get_current_vendor_user
        from app.main import app
        from app.models.vendor_user import VendorUser

        app.dependency_overrides[get_current_vendor_user] = lambda: VendorUser(
            id=uuid.uuid4(), vendor_id=self.vendor.id, user_id=self.user.id, role=self.role, permissions=[], is_active=True)

    def __exit__(self, *exc):
        from app.api.deps import get_current_vendor_user
        from app.main import app

        app.dependency_overrides.pop(get_current_vendor_user, None)


# -- encryption at rest -------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_integration_secrets_are_encrypted_in_the_database(client, test_vendor_user, db_session):
    integ = await _post(client, "/integrations", {"provider": "payment_gateway", "name": "Razorpay", "config": SECRETS})

    raw = await _raw_config(db_session, integ["id"])
    assert raw["key_secret"].startswith(ENC_PREFIX) and raw["key_id"].startswith(ENC_PREFIX)
    assert "s3cr3t-value" not in json.dumps(raw) and "rzp_live_ABC123" not in json.dumps(raw)
    assert raw["webhook_url"] == "https://x.test/hook"  # only secrets are encrypted

    # the application still sees the real values (the connection test needs both keys), the API only the mask
    from app.models.realestate.admin import ReIntegration

    obj = await db_session.get(ReIntegration, uuid.UUID(integ["id"]), populate_existing=True)
    assert obj.config["key_secret"] == "s3cr3t-value"
    t = await _post(client, f"/integrations/{integ['id']}/test", status=200)
    assert t["status"] == "ok"

    # rotating one secret re-encrypts it and keeps the other
    r = await client.patch(f"{API}/integrations/{integ['id']}", json={"config": {"key_id": "********", "key_secret": "new-secret"}})
    assert r.status_code == 200, r.text
    raw = await _raw_config(db_session, integ["id"])
    assert "new-secret" not in json.dumps(raw) and raw["key_secret"].startswith(ENC_PREFIX)
    obj = await db_session.get(ReIntegration, uuid.UUID(integ["id"]), populate_existing=True)
    assert obj.config == {"key_id": "rzp_live_ABC123", "key_secret": "new-secret"}


@pytest.mark.asyncio
async def test_legacy_plaintext_secrets_are_encrypted_by_the_daily_job(client, test_vendor_user, db_session):
    integ = await _post(client, "/integrations", {"provider": "sms", "name": "Gupshup", "config": {"api_key": "legacy-key", "sender": "KITERP"}})
    legacy = json.dumps({"api_key": "legacy-key", "sender": "KITERP"})
    if engine.dialect.name == "postgresql":
        await db_session.execute(text("UPDATE re_integration SET config = CAST(:c AS JSONB)"), {"c": legacy})
    else:
        await db_session.execute(text("UPDATE re_integration SET config = :c"), {"c": legacy})
    await db_session.commit()
    assert (await _raw_config(db_session, integ["id"]))["api_key"] == "legacy-key"

    rep = (await scheduler.run_daily(TestSession))[str(test_vendor_user.vendor_id)]
    assert rep["secrets_encrypted"] == 1
    raw = await _raw_config(db_session, integ["id"])
    assert raw["api_key"].startswith(ENC_PREFIX) and raw["sender"] == "KITERP"

    again = (await scheduler.run_daily(TestSession))[str(test_vendor_user.vendor_id)]
    assert again["secrets_encrypted"] == 0


# -- personal identifiers -----------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pan_and_kyc_details_are_masked_without_the_pii_permission(client, test_vendor, test_user, test_vendor_user):
    cust = await _customer(client)
    assert cust["pan"] == PAN  # owner sees everything
    doc = await _post(client, "/kyc-documents", {
        "customer_id": cust["id"], "doc_type": "pan", "doc_number": PAN, "file_url": "https://files.test/kyc/pan.pdf"})
    assert doc["file_url"] == "https://files.test/kyc/pan.pdf"

    with _As(test_vendor, test_user, "re_sales_executive"):
        r = await client.get(f"{API}/customers/{cust['id']}")
        assert r.status_code == 200 and r.json()["pan"] == "******234F"
        listed = (await client.get(f"{API}/customers")).json()["items"]
        assert all(PAN not in str(i) for i in listed)
        kyc = (await client.get(f"{API}/kyc-documents/{doc['id']}")).json()
        assert kyc["doc_number"] == "******234F" and kyc["file_url"] == "(restricted)"

        # an edit form echoing the masked values back must not damage the stored data
        r = await client.patch(f"{API}/customers/{cust['id']}", json={"pan": "******234F", "city": "Pune"})
        assert r.status_code == 200 and r.json()["city"] == "Pune"
        r = await client.patch(f"{API}/kyc-documents/{doc['id']}", json={"doc_number": "******234F", "file_url": "(restricted)"})
        assert r.status_code == 200

    with _As(test_vendor, test_user, "re_accounts"):  # accounts hold the pii permission
        assert (await client.get(f"{API}/customers/{cust['id']}")).json()["pan"] == PAN

    again = (await client.get(f"{API}/customers/{cust['id']}")).json()
    assert again["pan"] == PAN and again["city"] == "Pune"
    kyc = (await client.get(f"{API}/kyc-documents/{doc['id']}")).json()
    assert kyc["doc_number"] == PAN and kyc["file_url"] == "https://files.test/kyc/pan.pdf"


@pytest.mark.asyncio
async def test_booking_summary_masks_customer_and_applicant_identifiers(client, test_vendor, test_user, test_vendor_user):
    _, b = await _registered_booking(client)
    full = (await client.get(f"{API}/bookings/{b['id']}/summary")).json()
    assert full["customer"]["pan"] == PAN
    assert any(a.get("pan") == PAN for a in full["applicants"])

    with _As(test_vendor, test_user, "re_sales_executive"):
        masked = (await client.get(f"{API}/bookings/{b['id']}/summary")).json()
    assert masked["customer"]["pan"] == "******234F"
    assert all(a.get("pan") in (None, "", "******234F") for a in masked["applicants"])
    assert PAN not in json.dumps(masked)


def test_pii_permission_is_granted_only_where_needed():
    from app.models.vendor_role import ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS

    assert "realestate.pii" in ALL_PERMISSIONS
    for role in ("owner", "admin", "manager", "re_crm_manager", "re_accounts", "re_legal"):
        assert "realestate.pii" in DEFAULT_ROLE_PERMISSIONS[role], role
    for role in ("re_sales_executive", "re_site_engineer"):
        assert "realestate.pii" not in DEFAULT_ROLE_PERMISSIONS[role], role
