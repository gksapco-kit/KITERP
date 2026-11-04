"""Real estate - Phase 14: pilot readiness (the module reports its own plumbing problems)."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.realestate.admin import ReGlFailure
from app.models.realestate.core import ReCommunication
from tests.test_realestate_phase1 import B


async def _alert_titles(client):
    r = await client.get(f"{B}/alerts")
    assert r.status_code == 200, r.text
    return [a["title"] for a in r.json()["items"]]


@pytest.mark.asyncio
async def test_health_alerts_stay_quiet_when_everything_is_fine(client, test_vendor_user):
    titles = await _alert_titles(client)
    assert not any("not posted to the ledger" in t or "customer message" in t for t in titles)


@pytest.mark.asyncio
async def test_unposted_documents_and_stuck_or_failed_messages_raise_alerts(client, test_vendor_user, db_session):
    vid = test_vendor_user.vendor_id
    db_session.add(ReGlFailure(
        id=uuid.uuid4(), vendor_id=vid, source_type="receipt", source_id=uuid.uuid4(), reference="RCT-1", amount=100,
        error="No open accounting period", payload={}, attempts=1, status="open"))
    db_session.add(ReCommunication(
        id=uuid.uuid4(), vendor_id=vid, channel="email", direction="outbound", subject="Demand", body="x", status="failed",
        event="demand_issued", recipient="a@b.test", attempts=3, error="mailbox unavailable"))
    old = ReCommunication(
        id=uuid.uuid4(), vendor_id=vid, channel="sms", direction="outbound", subject="Receipt", body="x", status="queued",
        event="receipt_cleared", recipient="9000000001", attempts=0, created_at=datetime.now(timezone.utc) - timedelta(hours=2))
    db_session.add(old)
    await db_session.commit()

    r = await client.get(f"{B}/alerts")
    items = r.json()["items"]
    gl = next(a for a in items if "not posted to the ledger" in a["title"])
    assert gl["severity"] == "critical" and gl["title"].startswith("1 document")
    assert any("could not be delivered" in a["title"] and a["severity"] == "warning" for a in items)
    assert any("waiting for over 30 minutes" in a["title"] for a in items)
