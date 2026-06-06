"""
CRM lead-conversion + tenant-isolation tests.

Lead conversion is the CRM money-path: one lead becomes an account + contact
(+ optional deal), is marked converted, and can't be converted twice. Also
verifies a vendor can't read another vendor's CRM records.

Runs on the in-memory SQLite harness from conftest.
"""

import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.crm import (
    CrmAccount,
    CrmContact,
    CrmDeal,
    CrmLead,
    CrmPipeline,
    CrmStage,
)
from app.models.vendor import Vendor
from app.services.crm.services import AccountService, LeadService


@pytest_asyncio.fixture
async def a_lead(db_session, test_vendor: Vendor) -> CrmLead:
    lead = CrmLead(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        first_name="Jane",
        last_name="Prospect",
        company="Acme Corp",
        email="jane@acme.test",
        source="web",
        status="new",
    )
    db_session.add(lead)
    await db_session.commit()
    await db_session.refresh(lead)
    return lead


def _convert_payload(**over):
    base = dict(
        account_id=None, contact_id=None, create_deal=False,
        pipeline_id=None, stage_id=None, deal_title=None, deal_amount=None,
    )
    base.update(over)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_convert_creates_account_and_contact(db_session, test_vendor, a_lead):
    svc = LeadService(db_session)
    result = await svc.convert(test_vendor.id, a_lead.id, _convert_payload())

    assert result["account"] is not None
    assert result["account"].name == "Acme Corp"
    assert result["contact"] is not None
    assert result["contact"].first_name == "Jane"
    assert result["deal"] is None

    lead = await db_session.get(CrmLead, a_lead.id)
    assert lead.status == "converted"
    assert lead.converted_at is not None
    assert lead.converted_account_id == result["account"].id
    assert lead.converted_contact_id == result["contact"].id

    # Persisted, scoped to the vendor.
    accounts = (await db_session.execute(
        select(CrmAccount).where(CrmAccount.vendor_id == test_vendor.id)
    )).scalars().all()
    assert len(accounts) == 1


@pytest.mark.asyncio
async def test_convert_twice_is_rejected(db_session, test_vendor, a_lead):
    svc = LeadService(db_session)
    await svc.convert(test_vendor.id, a_lead.id, _convert_payload())
    with pytest.raises(Exception) as exc:
        await svc.convert(test_vendor.id, a_lead.id, _convert_payload())
    assert "already converted" in str(getattr(exc.value, "detail", exc.value)).lower()


@pytest.mark.asyncio
async def test_convert_with_deal(db_session, test_vendor, a_lead):
    pipeline = CrmPipeline(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Sales", is_default=True)
    db_session.add(pipeline)
    await db_session.flush()
    stage = CrmStage(
        id=uuid.uuid4(), pipeline_id=pipeline.id, vendor_id=test_vendor.id,
        name="Prospect", probability=10,
    )
    db_session.add(stage)
    await db_session.commit()

    svc = LeadService(db_session)
    result = await svc.convert(
        test_vendor.id, a_lead.id,
        _convert_payload(create_deal=True, pipeline_id=pipeline.id, stage_id=stage.id,
                         deal_title="Acme Deal", deal_amount=Decimal("50000")),
    )
    assert result["deal"] is not None
    assert result["deal"].title == "Acme Deal"
    assert result["deal"].stage_id == stage.id

    lead = await db_session.get(CrmLead, a_lead.id)
    assert lead.converted_deal_id == result["deal"].id


# ── Tenant isolation ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_lead_not_visible_to_other_vendor(db_session, test_vendor, a_lead):
    other_vendor_id = uuid.uuid4()
    svc = LeadService(db_session)
    with pytest.raises(Exception) as exc:
        await svc.get(other_vendor_id, a_lead.id)
    assert "not found" in str(getattr(exc.value, "detail", exc.value)).lower()


@pytest.mark.asyncio
async def test_account_not_visible_to_other_vendor(db_session, test_vendor):
    account = CrmAccount(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Private Co")
    db_session.add(account)
    await db_session.commit()

    svc = AccountService(db_session)
    own = await svc.get(test_vendor.id, account.id)
    assert own.id == account.id

    with pytest.raises(Exception) as exc:
        await svc.get(uuid.uuid4(), account.id)
    assert "not found" in str(getattr(exc.value, "detail", exc.value)).lower()
