"""
Journal entry lifecycle: create → (approval) → edit → simulate → post → reverse.

Covers the sync between the JE status and its approval request, which used to
leave approved entries stuck in `pending_approval` forever.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select, func

from app.models.finance import (
    FinAccount, FinApprovalPolicy, FinJournalEntry, FinJournalLine, FinPeriod,
)
from app.models.vendor import Vendor
from app.repositories.finance.finance_repo import FinControlsRepo
from app.schemas.finance.journal import JournalEntryCreate, JournalEntryUpdate, JournalLineIn
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.posting import (
    JournalValidationError,
    apply_approval_decision_to_journal,
    create_journal_draft,
    post_entry_with_approval_check,
    reconcile_approval_state,
    reverse_journal_entry,
    simulate_journal,
    submit_journal_for_approval,
    update_journal_draft,
    withdraw_journal_approval,
)


@pytest_asyncio.fixture
async def vendor(db_session) -> Vendor:
    v = Vendor(
        id=uuid.uuid4(), business_name="JE Co", display_name="JE Co",
        slug=f"t-{uuid.uuid4().hex[:8]}", business_type="retail", offering_type="products",
        primary_email=f"{uuid.uuid4().hex[:6]}@test.com", primary_phone="9876543210",
        subdomain=f"t-{uuid.uuid4().hex[:8]}", status="active",
    )
    db_session.add(v)
    await db_session.flush()
    await seed_default_coa(db_session, v.id)
    await seed_default_fiscal_year(db_session, v.id)
    await db_session.commit()
    return v


async def _acc(db, vendor_id, code):
    return (await db.execute(
        select(FinAccount).where(FinAccount.vendor_id == vendor_id, FinAccount.code == code)
    )).scalar_one()


async def _payload(db, vendor_id, amount="100", **over) -> JournalEntryCreate:
    cash = await _acc(db, vendor_id, "1110")
    sales = await _acc(db, vendor_id, "4100")
    data = dict(
        entry_date=date.today(),
        narration="test",
        lines=[
            JournalLineIn(account_id=cash.id, debit=Decimal(amount)),
            JournalLineIn(account_id=sales.id, credit=Decimal(amount)),
        ],
    )
    data.update(over)
    return JournalEntryCreate(**data)


async def _policy(db, vendor_id, threshold=None, levels=1):
    db.add(FinApprovalPolicy(
        id=uuid.uuid4(), vendor_id=vendor_id, entity_type="journal_entry",
        threshold_amount=threshold, is_active=True, levels=levels,
    ))
    await db.flush()


async def _approve(db, je, approver_id=None, status="approved"):
    req = (await FinControlsRepo(db).list_requests(je.vendor_id))
    req = next(r for r in req if r.id == je.approval_request_id)
    req = await FinControlsRepo(db).action_step(req, 1, approver_id or uuid.uuid4(), status, None)
    await apply_approval_decision_to_journal(db, req, approver_id)
    return req


@pytest.mark.asyncio
async def test_no_policy_draft_posts_directly(db_session, vendor):
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    assert je.status == "draft" and not je.requires_approval
    await post_entry_with_approval_check(db_session, je, None)
    assert je.status == "posted"


@pytest.mark.asyncio
async def test_approved_entry_can_be_posted(db_session, vendor):
    """Regression: approving used to leave the JE in pending_approval, which post rejected."""
    await _policy(db_session, vendor.id)
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    assert je.status == "pending_approval" and je.requires_approval

    with pytest.raises(ValueError, match="awaiting approval"):
        await post_entry_with_approval_check(db_session, je, None)

    await _approve(db_session, je)
    assert je.status == "approved"
    await post_entry_with_approval_check(db_session, je, None)
    assert je.status == "posted"


@pytest.mark.asyncio
async def test_rejected_then_edit_resubmits(db_session, vendor):
    await _policy(db_session, vendor.id)
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    await _approve(db_session, je, status="rejected")
    assert je.status == "rejected"
    with pytest.raises(ValueError):
        await post_entry_with_approval_check(db_session, je, None)

    await update_journal_draft(db_session, je, JournalEntryUpdate(narration="fixed"))
    assert je.status == "pending_approval"        # new approval request raised
    assert je.narration == "fixed"


@pytest.mark.asyncio
async def test_edit_above_threshold_retriggers_approval(db_session, vendor):
    """Regression: editing a small draft above the threshold used to bypass approval."""
    await _policy(db_session, vendor.id, threshold=Decimal("1000"))
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id, "100"))
    assert je.status == "draft"

    big = await _payload(db_session, vendor.id, "5000")
    await update_journal_draft(db_session, je, JournalEntryUpdate(lines=big.lines))
    assert je.status == "pending_approval" and je.requires_approval
    assert je.total_debit == Decimal("5000")


@pytest.mark.asyncio
async def test_edit_approved_entry_drops_approval(db_session, vendor):
    await _policy(db_session, vendor.id)
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    await _approve(db_session, je)
    old_req = je.approval_request_id
    await update_journal_draft(db_session, je, JournalEntryUpdate(narration="changed after approval"))
    assert je.status == "pending_approval"
    assert je.approval_request_id != old_req


@pytest.mark.asyncio
async def test_pending_entry_cannot_be_edited_but_can_be_withdrawn(db_session, vendor):
    await _policy(db_session, vendor.id)
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    with pytest.raises(ValueError, match="Withdraw"):
        await update_journal_draft(db_session, je, JournalEntryUpdate(narration="x"))
    await withdraw_journal_approval(db_session, je, None)
    assert je.status == "draft" and not je.requires_approval and je.approval_request_id is None


@pytest.mark.asyncio
async def test_draft_over_policy_cannot_skip_approval(db_session, vendor):
    """A draft saved before a policy existed must be submitted, not posted around it."""
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    await _policy(db_session, vendor.id)
    with pytest.raises(ValueError, match="requires approval"):
        await post_entry_with_approval_check(db_session, je, None)
    assert await submit_journal_for_approval(db_session, je, None) is True
    assert je.status == "pending_approval"


@pytest.mark.asyncio
async def test_legacy_pending_entry_with_approved_request_is_healed(db_session, vendor):
    await _policy(db_session, vendor.id)
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    # simulate pre-sync behaviour: request approved, JE untouched
    req = next(r for r in await FinControlsRepo(db_session).list_requests(vendor.id)
               if r.id == je.approval_request_id)
    await FinControlsRepo(db_session).action_step(req, 1, uuid.uuid4(), "approved", None)
    assert je.status == "pending_approval"
    assert await reconcile_approval_state(db_session, [je]) is True
    assert je.status == "approved"


@pytest.mark.asyncio
async def test_simulate_matches_create_but_persists_nothing(db_session, vendor):
    before = (await db_session.execute(
        select(func.count()).select_from(FinJournalEntry).where(FinJournalEntry.vendor_id == vendor.id)
    )).scalar()
    await _policy(db_session, vendor.id, threshold=Decimal("50"))
    res = await simulate_journal(db_session, vendor.id, await _payload(db_session, vendor.id, "100"))
    assert res["ok"] is True
    assert res["approval"]["required"] is True
    assert res["entry"]["status_after_save"] == "pending_approval"
    assert len(res["lines"]) == 2 and res["lines"][0]["account_code"] == "1110"
    assert res["can_post_after_save"] is False

    after = (await db_session.execute(
        select(func.count()).select_from(FinJournalEntry).where(FinJournalEntry.vendor_id == vendor.id)
    )).scalar()
    assert after == before


@pytest.mark.asyncio
async def test_simulate_reports_line_errors(db_session, vendor):
    cash = await _acc(db_session, vendor.id, "1110")
    cash.is_active = False
    await db_session.flush()
    res = await simulate_journal(db_session, vendor.id, await _payload(db_session, vendor.id))
    assert res["ok"] is False
    err = [i for i in res["issues"] if i["severity"] == "error"]
    assert err and err[0]["line"] == 0 and "inactive" in err[0]["message"]


@pytest.mark.asyncio
async def test_two_level_policy_needs_two_distinct_approvers(db_session, vendor):
    await _policy(db_session, vendor.id, levels=2)
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    repo = FinControlsRepo(db_session)
    req = next(r for r in await repo.list_requests(vendor.id) if r.id == je.approval_request_id)
    a1, a2 = uuid.uuid4(), uuid.uuid4()

    await repo.action_step(req, 1, a1, "approved", None)
    await apply_approval_decision_to_journal(db_session, req, a1)
    assert req.status == "pending" and je.status == "pending_approval"

    with pytest.raises(ValueError, match="different approver"):
        await repo.action_step(req, 1, a1, "approved", None)

    await repo.action_step(req, 1, a2, "approved", None)
    await apply_approval_decision_to_journal(db_session, req, a2)
    assert req.status == "approved" and je.status == "approved"
    await post_entry_with_approval_check(db_session, je, None)
    assert je.status == "posted"


@pytest.mark.asyncio
async def test_two_level_rejection_at_first_level_is_final(db_session, vendor):
    await _policy(db_session, vendor.id, levels=2)
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    await _approve(db_session, je, status="rejected")
    assert je.status == "rejected"


@pytest.mark.asyncio
async def test_party_must_exist_and_have_type(db_session, vendor):
    payload = await _payload(db_session, vendor.id)
    payload.lines[0] = payload.lines[0].model_copy(update={"party_type": "customer", "party_id": uuid.uuid4()})
    with pytest.raises(JournalValidationError) as ei:
        await create_journal_draft(db_session, vendor.id, payload)
    assert any(i["line"] == 0 and i["field"] == "party_id" for i in ei.value.issues)

    payload = await _payload(db_session, vendor.id)
    payload.lines[1] = payload.lines[1].model_copy(update={"party_type": None, "party_id": uuid.uuid4()})
    with pytest.raises(JournalValidationError) as ei:
        await create_journal_draft(db_session, vendor.id, payload)
    assert any(i["line"] == 1 and i["field"] == "party_type" for i in ei.value.issues)


@pytest.mark.asyncio
async def test_create_rejects_foreign_tenant_dimension(db_session, vendor):
    payload = await _payload(db_session, vendor.id)
    payload.lines[0] = payload.lines[0].model_copy(update={"cost_center_id": uuid.uuid4()})
    with pytest.raises(JournalValidationError) as ei:
        await create_journal_draft(db_session, vendor.id, payload)
    assert any(i["line"] == 0 and i["field"] == "cost_center_id" for i in ei.value.issues)


@pytest.mark.asyncio
async def test_post_blocked_in_closed_period(db_session, vendor):
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    for p in (await db_session.execute(
        select(FinPeriod).where(FinPeriod.vendor_id == vendor.id))).scalars().all():
        p.status = "closed"
    await db_session.flush()
    with pytest.raises(ValueError, match="period"):
        await post_entry_with_approval_check(db_session, je, None)


@pytest.mark.asyncio
async def test_reverse_creates_linked_mirror_and_blocks_second_reversal(db_session, vendor):
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id, "250"))
    await post_entry_with_approval_check(db_session, je, None)
    rev = await reverse_journal_entry(db_session, je, reason="mistake")
    assert rev.status == "posted" and rev.reverses_id == je.id and je.reversed_by_id == rev.id
    lines = (await db_session.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == rev.id)
    )).scalars().all()
    assert sum(l.debit for l in lines) == sum(l.credit for l in lines) == Decimal("250")
    cash_line = next(l for l in lines if l.credit == Decimal("250"))
    assert cash_line.account_id == (await _acc(db_session, vendor.id, "1110")).id   # mirrored

    with pytest.raises(ValueError, match="already been reversed"):
        await reverse_journal_entry(db_session, je)
    with pytest.raises(ValueError, match="cannot itself be reversed"):
        await reverse_journal_entry(db_session, rev)


@pytest.mark.asyncio
async def test_reverse_requires_posted(db_session, vendor):
    je = await create_journal_draft(db_session, vendor.id, await _payload(db_session, vendor.id))
    with pytest.raises(ValueError, match="Only posted"):
        await reverse_journal_entry(db_session, je)


# ── HTTP layer ───────────────────────────────────────────────────────────────

BASE = "/api/v1/vendors/me/finance"


@pytest_asyncio.fixture
async def api_ctx(db_session, test_vendor, test_vendor_user):
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    cash = await _acc(db_session, test_vendor.id, "1110")
    sales = await _acc(db_session, test_vendor.id, "4100")
    return {
        "cash": str(cash.id), "sales": str(sales.id),
        "body": lambda amount="100": {
            "entry_date": date.today().isoformat(),
            "narration": "api test",
            "lines": [
                {"account_id": str(cash.id), "debit": amount},
                {"account_id": str(sales.id), "credit": amount},
            ],
        },
    }


@pytest.mark.asyncio
async def test_api_simulate_then_create_post_reverse(client, api_ctx):
    body = api_ctx["body"]("300")

    sim = (await client.post(f"{BASE}/journal-entries/simulate", json=body)).json()
    assert sim["ok"] is True and len(sim["lines"]) == 2
    assert (await client.get(f"{BASE}/journal-entries")).json()["total"] == 0   # nothing persisted

    created = await client.post(f"{BASE}/journal-entries", json=body)
    assert created.status_code == 201
    je = created.json()
    assert je["status"] == "draft"
    assert "post" in je["allowed_actions"] and "reverse" not in je["allowed_actions"]
    assert je["lines"][0]["account_code"] == "1110"       # account display fields present for edit mode

    # list total follows the same filters as the list
    assert (await client.get(f"{BASE}/journal-entries", params={"q": je["entry_no"]})).json()["total"] == 1
    assert (await client.get(f"{BASE}/journal-entries", params={"q": "no-such-entry"})).json()["total"] == 0

    chk = (await client.get(f"{BASE}/journal-entries/{je['id']}/post-check")).json()
    assert chk["can_post"] is True

    assert (await client.post(f"{BASE}/journal-entries/{je['id']}/post")).status_code == 200
    posted = (await client.get(f"{BASE}/journal-entries/{je['id']}")).json()
    assert posted["status"] == "posted" and "reverse" in posted["allowed_actions"]

    rev = await client.post(f"{BASE}/journal-entries/{je['id']}/reverse", json={"reason": "typo"})
    assert rev.status_code == 200, rev.text
    after = (await client.get(f"{BASE}/journal-entries/{je['id']}")).json()
    assert after["reversed_by_entry_no"] == rev.json()["reversal_entry_no"]
    assert "reverse" not in after["allowed_actions"]
    assert (await client.post(f"{BASE}/journal-entries/{je['id']}/reverse", json={})).status_code == 400
    # voiding an already-reversed entry would double-count the reversal
    assert (await client.post(f"{BASE}/journal-entries/{je['id']}/void", json={"reason": "x"})).status_code == 400

    tl = (await client.get(f"{BASE}/journal-entries/{je['id']}/timeline")).json()
    assert [a["action"] for a in tl["audit"]][:1] == ["created"]
    assert {"posted", "reversed"} <= {a["action"] for a in tl["audit"]}


@pytest.mark.asyncio
async def test_api_validation_errors_are_structured_per_line(client, db_session, test_vendor, api_ctx):
    cash = await _acc(db_session, test_vendor.id, "1110")
    cash.is_active = False
    await db_session.commit()

    resp = await client.post(f"{BASE}/journal-entries", json=api_ctx["body"]())
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert isinstance(detail, list) and detail[0]["line"] == 0 and "inactive" in detail[0]["msg"]

    sim = (await client.post(f"{BASE}/journal-entries/simulate", json=api_ctx["body"]())).json()
    assert sim["ok"] is False and sim["issues"][0]["line"] == 0


@pytest.mark.asyncio
async def test_api_approval_policy_gates_post_and_withdraw(client, db_session, test_vendor, api_ctx):
    await _policy(db_session, test_vendor.id)
    await db_session.commit()

    je = (await client.post(f"{BASE}/journal-entries", json=api_ctx["body"]())).json()
    assert je["status"] == "pending_approval"
    # the requester can withdraw but may not decide their own request
    assert "withdraw" in je["allowed_actions"]
    assert "approve" not in je["allowed_actions"] and "reject" not in je["allowed_actions"]
    assert (await client.post(f"{BASE}/journal-entries/{je['id']}/post")).status_code == 400
    assert (await client.put(f"{BASE}/journal-entries/{je['id']}", json={"narration": "x"})).status_code == 400

    wd = await client.post(f"{BASE}/journal-entries/{je['id']}/withdraw")
    assert wd.status_code == 200 and wd.json()["status"] == "draft"
    # editing a withdrawn draft re-raises approval against the policy
    up = await client.put(f"{BASE}/journal-entries/{je['id']}", json={"narration": "edited"})
    assert up.status_code == 200 and up.json()["status"] == "pending_approval"


@pytest.mark.asyncio
async def test_api_two_level_inbox_progress_and_can_act(client, db_session, test_vendor, test_vendor_user, api_ctx):
    """Entry raised by someone else, 2-level policy: the inbox shows progress and blocks a repeat approver."""
    await _policy(db_session, test_vendor.id, levels=2)
    payload = await _payload(db_session, test_vendor.id)
    je = await create_journal_draft(db_session, test_vendor.id, payload)   # raised by "system" (not the caller)
    await db_session.commit()
    assert je.status == "pending_approval"

    inbox = (await client.get(f"{BASE}/controls/approvals", params={"status": "pending"})).json()
    row = next(r for r in inbox if r["id"] == str(je.approval_request_id))
    assert row["levels_required"] == 2 and row["levels_approved"] == 0
    assert row["can_act"] is True and row["entity_label"] == je.entry_no

    listed = (await client.get(f"{BASE}/journal-entries", params={"q": je.entry_no})).json()["items"][0]
    assert {"approve", "reject"} <= set(listed["allowed_actions"])
    assert listed["approval_progress"] == {"levels_required": 2, "levels_approved": 0}

    # first level
    ok = await client.post(f"{BASE}/controls/approvals/{je.approval_request_id}/approve", json={})
    assert ok.status_code == 200 and ok.json()["status"] == "pending"

    row = next(r for r in (await client.get(f"{BASE}/controls/approvals")).json() if r["id"] == str(je.approval_request_id))
    assert row["levels_approved"] == 1 and row["can_act"] is False
    assert "earlier level" in row["cannot_act_reason"]
    assert row["steps"][0]["status"] == "approved"

    # same user cannot sign the second level, and the UI no longer offers the buttons
    again = await client.post(f"{BASE}/controls/approvals/{je.approval_request_id}/approve", json={})
    assert again.status_code == 400 and "different approver" in again.json()["detail"]
    detail = (await client.get(f"{BASE}/journal-entries/{je.id}")).json()
    assert detail["status"] == "pending_approval"
    assert "approve" not in detail["allowed_actions"] and "reject" not in detail["allowed_actions"]
    assert detail["approval_progress"]["levels_approved"] == 1

    tl = (await client.get(f"{BASE}/journal-entries/{je.id}/timeline")).json()["approval"]
    assert tl["levels_required"] == 2 and tl["levels_approved"] == 1 and tl["can_act"] is False
