"""P&L and Balance Sheet report accuracy.

Posts balanced journal entries straight into the ledger and checks that the reports
classify and total them correctly (field shape consumed by ProfitLoss.tsx / BalanceSheet.tsx).
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.deps import get_current_active_user, get_current_vendor_user
from app.database import get_db
from app.main import app
from app.models.finance import FinAccount, FinJournalEntry, FinJournalLine
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year

BASE = "/api/v1/vendors/me/finance"
TODAY = date.today()


@pytest_asyncio.fixture
async def fin_client(db_session, test_user: User, test_vendor_user: VendorUser):
    async def _db():
        yield db_session

    async def _user():
        return test_user

    async def _vu():
        return test_vendor_user

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_active_user] = _user
    app.dependency_overrides[get_current_vendor_user] = _vu
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def fin_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


async def _acc(db, vendor_id, code) -> FinAccount:
    return (await db.execute(
        select(FinAccount).where(FinAccount.vendor_id == vendor_id, FinAccount.code == code)
    )).scalar_one()


async def _post(db, vendor_id, lines: list[tuple[FinAccount, str, str]], n: int):
    """lines: (account, debit, credit). Creates a posted, balanced entry dated today."""
    dr = sum(Decimal(d) for _, d, _ in lines)
    cr = sum(Decimal(c) for _, _, c in lines)
    assert dr == cr
    je = FinJournalEntry(
        id=uuid.uuid4(), vendor_id=vendor_id, entry_no=f"T-{n}", entry_date=TODAY,
        status="posted", total_debit=dr, total_credit=cr,
    )
    db.add(je)
    await db.flush()
    for i, (acc, d, c) in enumerate(lines):
        db.add(FinJournalLine(
            id=uuid.uuid4(), journal_entry_id=je.id, vendor_id=vendor_id, account_id=acc.id,
            debit=Decimal(d), credit=Decimal(c), sequence=i,
        ))
    await db.flush()


@pytest.mark.asyncio
async def test_profit_loss_groups_and_totals(fin_client, db_session, fin_vendor: Vendor):
    v = fin_vendor.id
    bank, sales = await _acc(db_session, v, "1120"), await _acc(db_session, v, "4110")
    other_inc, cogs = await _acc(db_session, v, "4210"), await _acc(db_session, v, "5110")
    rent, tax = await _acc(db_session, v, "5220"), await _acc(db_session, v, "5310")

    await _post(db_session, v, [(bank, "1000", "0"), (sales, "0", "1000")], 1)       # sale 1000
    await _post(db_session, v, [(bank, "50", "0"), (other_inc, "0", "50")], 2)        # interest 50
    await _post(db_session, v, [(cogs, "400", "0"), (bank, "0", "400")], 3)           # COGS 400
    await _post(db_session, v, [(rent, "100", "0"), (bank, "0", "100")], 4)           # rent 100
    await _post(db_session, v, [(tax, "30", "0"), (bank, "0", "30")], 5)              # tax 30
    await db_session.commit()

    resp = await fin_client.get(
        f"{BASE}/reports/profit-loss",
        params={"from_date": TODAY.replace(month=1, day=1).isoformat(), "to_date": TODAY.isoformat()},
    )
    assert resp.status_code == 200
    b = resp.json()

    assert b["total_revenue"] == 1000
    assert b["total_cogs"] == 400
    assert b["gross_profit"] == 600            # revenue - COGS (other income excluded)
    assert b["total_opex"] == 100
    assert b["operating_profit"] == 500
    assert b["total_other_income"] == 50
    assert b["total_tax"] == 30
    assert b["profit_before_tax"] == 550
    assert b["net_profit"] == 520              # 1050 income - 530 expenses
    assert b["net_profit"] == b["profit_before_tax"] - b["total_tax"]
    assert [l["name"] for l in b["revenue_lines"]] == ["Product Sales"]
    assert [l["name"] for l in b["cogs_lines"]] == ["Purchases / COGS"]


@pytest.mark.asyncio
async def test_balance_sheet_balances_and_classifies_plural_subtypes(
    fin_client, db_session, fin_vendor: Vendor,
):
    v = fin_vendor.id
    bank, capital = await _acc(db_session, v, "1120"), await _acc(db_session, v, "3100")
    sales = await _acc(db_session, v, "4110")

    # User-created accounts using the subtype names the COA form offers (plural).
    cur_asset = FinAccount(id=uuid.uuid4(), vendor_id=v, code="1199", name="Petty Float",
                           account_type="Asset", account_subtype="Current Assets")
    cur_liab = FinAccount(id=uuid.uuid4(), vendor_id=v, code="2199", name="Accrued Misc",
                          account_type="Liability", account_subtype="Current Liabilities")
    db_session.add_all([cur_asset, cur_liab])
    await db_session.flush()

    await _post(db_session, v, [(bank, "5000", "0"), (capital, "0", "5000")], 1)
    await _post(db_session, v, [(cur_asset, "200", "0"), (cur_liab, "0", "200")], 2)
    await _post(db_session, v, [(bank, "300", "0"), (sales, "0", "300")], 3)
    await db_session.commit()

    resp = await fin_client.get(f"{BASE}/reports/balance-sheet", params={"as_of": TODAY.isoformat()})
    assert resp.status_code == 200
    b = resp.json()

    assert "Petty Float" in [l["name"] for l in b["current_assets"]]
    assert "Accrued Misc" in [l["name"] for l in b["current_liabilities"]]
    assert b["non_current_liabilities"] == []
    assert b["total_assets"] == 5500
    assert b["retained_earnings"] == 300
    assert b["total_equity"] == 5300           # capital 5000 + cumulative profit 300
    assert b["total_liabilities"] == 200
    assert b["check"] == 0                     # Assets = Liabilities + Equity


@pytest.mark.asyncio
async def test_coa_rejects_unknown_type_and_normalises_case(fin_client, fin_vendor: Vendor):
    ok = await fin_client.post(f"{BASE}/coa", json={
        "code": "4999", "name": "Lowercase Income", "account_type": "income",
    })
    assert ok.status_code == 201
    assert ok.json()["account_type"] == "Income"

    bad = await fin_client.post(f"{BASE}/coa", json={
        "code": "9999", "name": "Weird", "account_type": "revenue",
    })
    assert bad.status_code == 422
