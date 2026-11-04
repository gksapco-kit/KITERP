"""Real estate - Phase 13: customer email / SMS (queued in the same transaction, delivered by a background job)."""
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import update

from app.services.realestate import messaging, scheduler
from tests.conftest import TestSession
from tests.test_realestate_phase1 import B, _customer, _post, _setup_inventory
from tests.test_realestate_phase2 import STD_PLAN, _plan
from tests.test_realestate_phase8 import _get

API = "/api/v1/vendors/me/realestate"


class Outbox:
    """Fake providers that record what would have been sent."""

    def __init__(self, ok=True):
        self.ok, self.emails, self.sms = ok, [], []


@pytest.fixture
def providers(monkeypatch):
    box = Outbox()

    async def fake_email(db, vendor_id, to, subject, html, text=None):
        box.emails.append({"to": to, "subject": subject, "html": html})
        return SimpleNamespace(ok=box.ok, error=None if box.ok else "mailbox unavailable")

    class FakeSms:
        is_configured = True

        async def send_sms(self, to, body):
            box.sms.append({"to": to, "body": body})
            return SimpleNamespace(sent=box.ok, twilio_message=None if box.ok else "carrier rejected")

    monkeypatch.setattr("app.services.email_service.send_email_detailed_for_vendor", fake_email)
    monkeypatch.setattr("app.services.sms_service.SmsService", FakeSms)
    return box


async def _book_with_contact(client, project):
    units = (await client.get(f"{B}/units", params={"project_id": project["id"], "size": 100})).json()["items"]
    unit = sorted(units, key=lambda u: u["unit_number"])[0]
    cust = await _customer(client, "Meera Iyer", "9000000042")
    r = await client.patch(f"{API}/customers/{cust['id']}", json={"email": "meera@example.test"})
    assert r.status_code == 200, r.text
    return cust, await _post(client, "/bookings", {"unit_id": unit["id"], "customer_id": cust["id"]})


async def _comms(client, **filters):
    return (await _get(client, "/communications", **filters))["items"]


@pytest.mark.asyncio
async def test_nothing_is_queued_until_notifications_are_switched_on(client, test_vendor_user, providers):
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    await _book_with_contact(client, project)
    assert await _comms(client, event="demand_issued") == []
    assert providers.emails == [] and providers.sms == []


@pytest.mark.asyncio
async def test_demand_and_receipt_messages_are_queued_then_delivered(client, test_vendor_user, providers, db_session):
    await _post(client, "/automation-settings", {"key": "notifications", "value": {"email": True, "sms": True}})
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    cust, b = await _book_with_contact(client, project)

    queued = await _comms(client, event="demand_issued")
    assert sorted(m["channel"] for m in queued) == ["email", "sms"] and {m["status"] for m in queued} == {"queued"}
    assert providers.emails == [] and providers.sms == []  # nothing is sent inside the request
    assert {m["recipient"] for m in queued} == {"meera@example.test", "9000000042"}
    assert all("5,25,000" not in (m.get("body") or "") and "525,000.00" in (m.get("body") or "") for m in queued)
    assert all("ABCDE1234F" not in str(m) for m in queued)  # no PAN / portal token in message text

    await _post(client, "/receipts", {"booking_id": b["id"], "amount": 525_000, "mode": "neft", "reference_no": "UTR"})
    assert len(await _comms(client, event="receipt_cleared")) == 2

    out = await _post(client, "/communications/dispatch", status=200)
    assert out["sent"] == 4 and out["failed"] == 0
    assert len(providers.emails) == 2 and len(providers.sms) == 2
    assert providers.emails[0]["to"] == "meera@example.test"
    assert {m["status"] for m in await _comms(client)} == {"sent"}

    again = await _post(client, "/communications/dispatch", status=200)
    assert again["picked"] == 0  # delivered messages are never sent twice


@pytest.mark.asyncio
async def test_failed_delivery_is_retried_then_reported_and_can_be_requeued(client, test_vendor_user, providers):
    await _post(client, "/automation-settings", {"key": "notifications", "value": {"email": True}})
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    await _book_with_contact(client, project)
    providers.ok = False

    for attempt in range(1, messaging.MAX_ATTEMPTS + 1):
        out = await _post(client, "/communications/dispatch", status=200)
        assert out["picked"] == 1
    msg = (await _comms(client, event="demand_issued"))[0]
    assert msg["status"] == "failed" and msg["attempts"] == messaging.MAX_ATTEMPTS and "mailbox unavailable" in msg["error"]
    assert (await _post(client, "/communications/dispatch", status=200))["picked"] == 0  # gave up, stays visible

    providers.ok = True
    await _post(client, f"/communications/{msg['id']}/requeue", status=200)
    assert (await _post(client, "/communications/dispatch", status=200))["sent"] == 1
    assert (await _comms(client, event="demand_issued"))[0]["status"] == "sent"


@pytest.mark.asyncio
async def test_a_customer_without_contact_details_is_skipped_quietly(client, test_vendor_user, providers):
    await _post(client, "/automation-settings", {"key": "notifications", "value": {"email": True, "sms": True}})
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    units = (await client.get(f"{B}/units", params={"project_id": project["id"], "size": 100})).json()["items"]
    cust = await _post(client, "/customers", {"full_name": "No Contact"})
    b = await _post(client, "/bookings", {"unit_id": units[0]["id"], "customer_id": cust["id"]})
    assert b["id"] and await _comms(client, event="demand_issued") == []


@pytest.mark.asyncio
async def test_overdue_reminders_are_opt_in_and_not_repeated_within_the_interval(client, test_vendor_user, providers, db_session):
    from app.models.realestate.receivables import ReDemand

    await _post(client, "/automation-settings", {"key": "notifications", "value": {"email": True}})
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    await _book_with_contact(client, project)
    await db_session.execute(update(ReDemand).values(due_date=date.today() - timedelta(days=10)))
    await db_session.commit()
    vid = str(test_vendor_user.vendor_id)

    rep = (await scheduler.run_daily(TestSession))[vid]
    assert rep["reminders"] == 0  # overdue_reminders not enabled

    row = (await _get(client, "/automation-settings", key="notifications"))["items"][0]
    r = await client.patch(f"{API}/automation-settings/{row['id']}", json={"value": {"email": True, "overdue_reminders": True}})
    assert r.status_code == 200, r.text

    rep = (await scheduler.run_daily(TestSession))[vid]
    assert rep["reminders"] == 1 and rep["outbox"]["sent"] >= 1
    reminders = await _comms(client, event="overdue_reminder")
    assert len(reminders) == 1 and "overdue" in reminders[0]["subject"].lower()

    rep = (await scheduler.run_daily(TestSession))[vid]
    assert rep["reminders"] == 0  # one per demand per reminder interval
    assert len(await _comms(client, event="overdue_reminder")) == 1


def test_outbox_job_is_scheduled_every_minute():
    from app.worker import celery_app

    if celery_app is None:
        pytest.skip("Celery not available")
    entry = celery_app.conf.beat_schedule["realestate-outbox"]
    assert entry["task"] == "realestate.outbox" and entry["schedule"] <= 60
