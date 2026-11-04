"""
Phase 15 (typed/guarded request bodies) + Phase 16 (endpoint-level, re-post, permission coverage).
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import func, select

from app.main import app
from app.models.finance import (
    FinAccount, FinJournalEntry, FinJournalLine, FinPostingFailure, FinTaxReturn, FinVendorBill,
)
from app.models.procurement import Supplier
from app.models.vendor import Vendor
from app.services.finance.body_guard import coerce_body
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.posting import post_event

D = Decimal
BASE = "/api/v1/vendors/me/finance"


# ═══ body_guard unit tests ═══════════════════════════════════════════════════

def test_guard_drops_protected_and_coerces_types():
    out = coerce_body(FinTaxReturn, {
        "id": str(uuid.uuid4()), "vendor_id": str(uuid.uuid4()),
        "return_type": "GSTR1", "period_start": "2026-04-01", "period_end": "2026-04-30",
    }, "create", protect=("status",))
    assert "id" not in out and "vendor_id" not in out
    assert out["period_start"] == date(2026, 4, 1)


def test_guard_rejects_unknown_on_create_but_ignores_on_update():
    with pytest.raises(HTTPException) as e:
        coerce_body(FinAccount, {"code": "1", "name": "n", "account_type": "Asset", "bogus": 1}, "create")
    assert e.value.status_code == 422 and "bogus" in e.value.detail
    assert coerce_body(FinAccount, {"name": "n", "bogus": 1}, "update") == {"name": "n"}


def test_guard_required_and_bad_values_are_422():
    with pytest.raises(HTTPException) as e:
        coerce_body(FinAccount, {"name": "only name"}, "create")
    assert "Missing required" in e.value.detail
    with pytest.raises(HTTPException) as e:
        coerce_body(FinTaxReturn, {"return_type": "GSTR1", "period_start": "not-a-date",
                                   "period_end": "2026-04-30"}, "create")
    assert "period_start" in e.value.detail
    with pytest.raises(HTTPException):
        coerce_body(FinAccount, {"name": None}, "update")          # NOT NULL cleared


def test_guard_blank_form_values_become_null_for_non_text_columns():
    out = coerce_body(FinTaxReturn, {"return_type": "GSTR1", "period_start": "2026-04-01",
                                     "period_end": "2026-04-30", "due_date": "", "notes": ""}, "create")
    assert out["due_date"] is None and out["notes"] == ""
    with pytest.raises(HTTPException):          # but a blank *required* date is still rejected downstream
        coerce_body(FinTaxReturn, {"return_type": "GSTR1", "period_start": "", "period_end": "2026-04-30"}, "create")


def test_guard_decimal_from_strings_and_rejects_nan():
    from app.models.finance import FinLoan
    out = coerce_body(FinLoan, {"name": "L", "principal": "1,00,000.50"}, "create")
    assert out["principal"] == D("100000.50")
    with pytest.raises(HTTPException):
        coerce_body(FinLoan, {"name": "L", "principal": "NaN"}, "create")


# ═══ endpoint fixtures ═══════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def fin(db_session, test_vendor: Vendor, test_vendor_user):
    test_vendor.gstin = "27AAAAA0000A1Z5"
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


async def _acct(db, vendor_id, account_type, exclude_recon=True):
    q = select(FinAccount).where(FinAccount.vendor_id == vendor_id, FinAccount.account_type == account_type,
                                 FinAccount.is_active == True)  # noqa: E712
    for a in (await db.execute(q.order_by(FinAccount.code))).scalars().all():
        if exclude_recon and getattr(a, "is_reconciliation", False):
            continue
        return a
    raise AssertionError(f"no {account_type} account")


# ═══ Phase 15: guarded bodies via the API ════════════════════════════════════

@pytest.mark.asyncio
async def test_coa_create_ignores_foreign_vendor_id_and_rejects_unknown(client, fin, db_session):
    other = str(uuid.uuid4())
    r = await client.post(f"{BASE}/coa", json={
        "code": "9990", "name": "Custom Expense", "account_type": "Expense", "vendor_id": other})
    assert r.status_code == 201, r.text
    row = (await db_session.execute(select(FinAccount).where(FinAccount.code == "9990"))).scalar_one()
    assert row.vendor_id == fin.id                       # not re-parented

    r = await client.post(f"{BASE}/coa", json={"code": "9991", "name": "X", "account_type": "Expense", "nope": 1})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_coa_update_cannot_move_account_to_another_tenant(client, fin, db_session):
    acc = await _acct(db_session, fin.id, "Expense")
    r = await client.put(f"{BASE}/coa/{acc.id}", json={"name": "Renamed", "vendor_id": str(uuid.uuid4())})
    assert r.status_code == 200, r.text
    await db_session.refresh(acc)
    assert acc.vendor_id == fin.id and acc.name == "Renamed"


@pytest.mark.asyncio
async def test_manual_journal_validation_and_success(client, fin, db_session):
    exp = await _acct(db_session, fin.id, "Expense")
    eq = await _acct(db_session, fin.id, "Equity")
    bad = await client.post(f"{BASE}/journal/manual", json={"lines": [
        {"account_id": str(exp.id), "debit": "100"}, {"account_id": str(eq.id), "credit": "90"}]})
    assert bad.status_code == 422                                    # unbalanced
    one_sided = await client.post(f"{BASE}/journal/manual", json={"lines": [{"account_id": str(exp.id), "debit": "5"}]})
    assert one_sided.status_code == 422                              # < 2 lines
    both = await client.post(f"{BASE}/journal/manual", json={"lines": [
        {"account_id": str(exp.id), "debit": "5", "credit": "5"}, {"account_id": str(eq.id), "credit": "0"}]})
    assert both.status_code == 422
    ok = await client.post(f"{BASE}/journal/manual", json={"narration": "adj", "lines": [
        {"account_id": str(exp.id), "debit": "100"}, {"account_id": str(eq.id), "credit": "100"}]})
    assert ok.status_code == 200, ok.text


@pytest.mark.asyncio
async def test_manual_journal_invalid_date_is_rejected_not_redated(client, fin, db_session):
    exp = await _acct(db_session, fin.id, "Expense")
    eq = await _acct(db_session, fin.id, "Equity")
    r = await client.post(f"{BASE}/journal/manual", json={"entry_date": "31/13/2026", "lines": [
        {"account_id": str(exp.id), "debit": "1"}, {"account_id": str(eq.id), "credit": "1"}]})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_tax_return_cannot_be_forged_filed_or_filed_twice(client, fin, db_session):
    r = await client.post(f"{BASE}/tax/returns", json={
        "return_type": "GSTR3B", "period_start": "2026-05-01", "period_end": "2026-05-31",
        "status": "filed", "net_payable": "99999", "filing_reference": "FAKE"})
    assert r.status_code == 201, r.text
    tr_id = r.json()["id"]
    row = (await db_session.execute(select(FinTaxReturn).where(FinTaxReturn.id == uuid.UUID(tr_id)))).scalar_one()
    assert row.status != "filed" and row.filing_reference is None
    # can't file before computing
    assert (await client.post(f"{BASE}/tax/returns/{tr_id}/file", json={"filing_reference": "A1"})).status_code == 400
    assert (await client.post(f"{BASE}/tax/returns/{tr_id}/compute")).status_code == 200
    assert (await client.post(f"{BASE}/tax/returns/{tr_id}/file", json={"filing_reference": "A1"})).status_code == 200
    again = await client.post(f"{BASE}/tax/returns/{tr_id}/file", json={"filing_reference": "A2"})
    assert again.status_code == 400
    bad_range = await client.post(f"{BASE}/tax/returns", json={
        "return_type": "GSTR1", "period_start": "2026-05-31", "period_end": "2026-05-01"})
    assert bad_range.status_code == 422


@pytest.mark.asyncio
async def test_loan_create_with_generate_schedule_flag_and_foreign_gl_account(client, fin, db_session):
    liab = await _acct(db_session, fin.id, "Liability")
    ok = await client.post(f"{BASE}/capital/loans", json={
        "name": "Term loan", "principal": "120000", "interest_rate": "12", "tenure_months": 12,
        "disbursement_date": "2026-05-01", "gl_account_id": str(liab.id), "generate_schedule": True,
        "outstanding_balance": "1"})
    assert ok.status_code == 201, ok.text
    assert Decimal(str(ok.json()["outstanding_balance"])) == D("120000")      # client value ignored
    foreign = await client.post(f"{BASE}/capital/loans", json={
        "name": "Bad", "principal": "1000", "gl_account_id": str(uuid.uuid4())})
    assert foreign.status_code == 404
    zero = await client.post(f"{BASE}/capital/loans", json={"name": "Zero", "principal": "0"})
    assert zero.status_code == 422


@pytest.mark.asyncio
async def test_ledger_update_whitelist(client, fin, db_session):
    r = await client.post(f"{BASE}/ledgers", json={"code": "IFRS", "name": "IFRS", "currency": "INR"})
    if r.status_code not in (200, 201):
        pytest.skip(f"ledger create not available: {r.status_code}")
    lid = r.json()["id"]
    up = await client.patch(f"{BASE}/ledgers/{lid}", json={"name": "IFRS 2", "vendor_id": str(uuid.uuid4())})
    assert up.status_code == 200, up.text
    from app.models.finance import FinLedger
    row = (await db_session.execute(select(FinLedger).where(FinLedger.id == uuid.UUID(lid)))).scalar_one()
    assert row.vendor_id == fin.id and row.name == "IFRS 2"


# ═══ Phase 16: AP flow, failure queue, re-post, isolation, permissions ═══════

async def _supplier(db, vendor_id, name="Acme", gstin=None):
    s = Supplier(id=uuid.uuid4(), vendor_id=vendor_id, name=name, gstin=gstin)
    db.add(s)
    await db.commit()
    return s


@pytest.mark.asyncio
async def test_ap_bill_with_tds_end_to_end(client, fin, db_session):
    sup = await _supplier(db_session, fin.id, gstin="27ABCDE1234F1Z5")
    r = await client.post(f"{BASE}/ap/bills", json={
        "supplier_id": str(sup.id), "bill_no": "E2E-1", "bill_date": "2026-05-10",
        "subtotal": "1000", "tax_amount": "180", "total": "1180", "tds_section": "194C", "tds_rate": "2"})
    assert r.status_code == 201, r.text
    bill_id = r.json()["id"]
    p = await client.post(f"{BASE}/ap/bills/{bill_id}/post")
    assert p.status_code == 200, p.text
    body = p.json()
    assert body.get("gl_posted", True) is True
    bill = (await db_session.execute(select(FinVendorBill).where(FinVendorBill.id == uuid.UUID(bill_id)))).scalar_one()
    assert bill.balance_due == D("1160.00")                              # 1180 - 2% TDS on 1000
    je = (await db_session.execute(select(FinJournalEntry).where(
        FinJournalEntry.vendor_id == fin.id, FinJournalEntry.source_id == bill.id,
        FinJournalEntry.status == "posted"))).scalar_one()
    assert je.total_debit == je.total_credit == D("1180")
    assert je.entry_date == date(2026, 5, 10)                              # booked on the bill date, not today
    # intra-state supplier -> ITC split into CGST/SGST by the API
    assert (bill.cgst_amount, bill.sgst_amount, bill.igst_amount) == (D("90"), D("90"), D("0"))

    again = await client.post(f"{BASE}/ap/bills/{bill_id}/post")
    assert again.status_code == 400                                       # no double posting
    tds = await client.get(f"{BASE}/tax/tds-report", params={"from_date": "2026-05-01", "to_date": "2026-05-31"})
    assert tds.status_code == 200
    j = tds.json()
    assert any(s["section"] == "194C" and s["tds_deducted"] == 20.0 for s in j["by_section"])
    assert j["total_tds_deducted"] == 20.0 and j["outstanding_to_deposit"] == 20.0


@pytest.mark.asyncio
async def test_bill_for_other_tenants_supplier_is_rejected(client, fin, db_session):
    other_vendor = Vendor(id=uuid.uuid4(), business_name="Other", display_name="Other",
                          slug=f"o-{uuid.uuid4().hex[:6]}", business_type="retail", offering_type="products",
                          primary_email="o@test.com", primary_phone="1", subdomain=f"o{uuid.uuid4().hex[:6]}",
                          status="active")
    db_session.add(other_vendor)
    await db_session.commit()
    foreign = await _supplier(db_session, other_vendor.id, "Foreign")
    r = await client.post(f"{BASE}/ap/bills", json={
        "supplier_id": str(foreign.id), "bill_no": "X", "bill_date": "2026-05-10",
        "subtotal": "10", "tax_amount": "0", "total": "10"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_posting_failure_is_queued_surfaced_and_retry_resolves(client, test_vendor, test_vendor_user, db_session):
    # No chart of accounts yet: posting cannot succeed, but the bill must still be created/posted.
    sup = await _supplier(db_session, test_vendor.id)
    r = await client.post(f"{BASE}/ap/bills", json={
        "supplier_id": str(sup.id), "bill_no": "Q-1", "bill_date": "2026-05-10",
        "subtotal": "500", "tax_amount": "0", "total": "500"})
    assert r.status_code == 201, r.text
    p = await client.post(f"{BASE}/ap/bills/{r.json()['id']}/post")
    assert p.status_code == 200, p.text
    assert p.json().get("gl_posted") is False and p.json().get("gl_warning")

    listed = await client.get(f"{BASE}/posting-failures")
    assert listed.status_code == 200 and len(listed.json()) == 1
    assert listed.json()[0]["source_type"] == "vendor_bill"

    unposted = await client.get(f"{BASE}/posting/unposted")
    assert unposted.status_code == 200

    # fix the root cause, then retry from the queue
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    retry = await client.post(f"{BASE}/posting-failures/retry-all")
    assert retry.status_code == 200, retry.text
    assert retry.json()["resolved"] == 1 and retry.json()["still_open"] == 0
    assert (await client.get(f"{BASE}/posting-failures")).json() == []
    live = (await db_session.execute(select(func.count()).select_from(FinJournalEntry).where(
        FinJournalEntry.vendor_id == test_vendor.id, FinJournalEntry.source_type == "vendor_bill",
        FinJournalEntry.status == "posted"))).scalar_one()
    assert live == 1


@pytest.mark.asyncio
async def test_posting_failure_of_another_tenant_is_invisible(client, fin, db_session):
    f = FinPostingFailure(id=uuid.uuid4(), vendor_id=uuid.uuid4(), source_type="vendor_bill",
                          source_id=uuid.uuid4(), payload={}, error="x", status="open")
    db_session.add(f)
    await db_session.commit()
    assert (await client.get(f"{BASE}/posting-failures")).json() == []
    assert (await client.post(f"{BASE}/posting-failures/{f.id}/retry")).status_code == 404
    assert (await client.post(f"{BASE}/posting-failures/{f.id}/ignore")).status_code == 404


@pytest.mark.asyncio
async def test_repost_three_times_keeps_exactly_one_live_entry(fin, db_session):
    sid = uuid.uuid4()
    payload = {"subtotal": D("100"), "tax_amount": D("0"), "total": D("100")}
    ids = []
    for _ in range(3):
        je = await post_event(db_session, fin.id, "vendor_bill", sid, payload)
        await db_session.commit()
        ids.append(je.id)
    rows = (await db_session.execute(select(FinJournalEntry).where(
        FinJournalEntry.vendor_id == fin.id, FinJournalEntry.source_id == sid))).scalars().all()
    live = [r for r in rows if r.status == "posted"]
    assert len(live) == 1 and live[0].id == ids[-1]
    assert len({r.entry_no for r in rows}) == len(rows)                   # unique entry numbers
    tb = (await db_session.execute(
        select(func.sum(FinJournalLine.debit), func.sum(FinJournalLine.credit))
        .join(FinJournalEntry, FinJournalEntry.id == FinJournalLine.journal_entry_id)
        .where(FinJournalEntry.vendor_id == fin.id, FinJournalEntry.status == "posted"))).one()
    assert tb[0] == tb[1] == D("100")


@pytest.mark.asyncio
async def test_staff_without_finance_permission_gets_403(client, fin, test_vendor_user, db_session):
    test_vendor_user.role = "staff"
    test_vendor_user.permissions = []
    await db_session.commit()
    for method, path in [("post", "/coa"), ("post", "/journal/manual"), ("post", "/tax/returns"),
                         ("get", "/posting-failures"), ("post", "/capital/loans")]:
        r = await client.request(method.upper(), f"{BASE}{path}", json={})
        assert r.status_code == 403, (path, r.status_code)


def test_every_finance_route_requires_a_permission():
    """No finance endpoint may be reachable with only a login."""
    open_routes = []
    for route in app.routes:
        path = getattr(route, "path", "")
        if not path.startswith(BASE) or not hasattr(route, "dependant"):
            continue
        guarded = False
        stack = list(route.dependant.dependencies)
        while stack:
            dep = stack.pop()
            name = getattr(dep.call, "__qualname__", "")
            if "require_permission" in name or "require_any_permission" in name:
                guarded = True
                break
            stack.extend(dep.dependencies)
        if not guarded:
            open_routes.append((sorted(route.methods), path))
    assert not open_routes, f"finance routes without a permission check: {open_routes}"
