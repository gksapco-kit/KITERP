"""Real estate - Phase 12: compliance worked examples.

Each test states the rule, works the numbers by hand in the comments and asserts the system gives exactly that.
These are the cases a chartered accountant should review before go-live; see docs/REALESTATE_PILOT_RUNBOOK.md
for the open questions that need a professional's sign-off.
"""
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy import update

from app.services.realestate import pricing, tax
from tests.test_realestate_phase1 import B, _post, _setup_inventory
from tests.test_realestate_phase2 import STD_PLAN, _book, _finance, _plan, _sign_agreement

D = Decimal


def _unit(**kw):
    base = dict(base_rate=5000, floor_rise_rate=0, super_area=1000, built_up_area=0, carpet_area=0,
                plc_amount=0, parking_amount=0, club_amount=0, other_charges=0)
    base.update(kw)
    return SimpleNamespace(**base)


def _project(gst=5, stamp=6, reg=1):
    return SimpleNamespace(gst_rate=gst, stamp_duty_pct=stamp, registration_fee_pct=reg)


# -- GST ----------------------------------------------------------------------------------------

def test_gst_on_residential_under_construction_5_percent():
    # 1,000 sq ft x 5,000 = 50,00,000 basic + 1,00,000 PLC + 2,00,000 parking = 53,00,000; less 1,00,000 discount.
    cs = pricing.cost_sheet(_unit(plc_amount=100_000, parking_amount=200_000), _project(gst=5), discount=100_000)
    assert cs["agreement_value"] == D("5200000.00")
    assert cs["gst_amount"] == D("260000.00")  # 5% of 52,00,000 (no ITC regime)
    assert cs["stamp_duty"] == D("312000.00") and cs["registration_fee"] == D("52000.00")
    assert cs["total_cost"] == D("5200000.00") + D("260000.00") + D("312000.00") + D("52000.00")


def test_gst_on_affordable_housing_1_percent_and_commercial_18_percent():
    assert pricing.cost_sheet(_unit(base_rate=3000), _project(gst=1))["gst_amount"] == D("30000.00")  # 1% of 30,00,000
    assert pricing.cost_sheet(_unit(base_rate=3000), _project(gst=18))["gst_amount"] == D("540000.00")  # 18% of 30,00,000
    assert pricing.cost_sheet(_unit(base_rate=3000), _project(gst=0))["gst_amount"] == D("0.00")


def test_discount_can_never_exceed_the_price_and_rounding_is_to_paise():
    cs = pricing.cost_sheet(_unit(base_rate=1000), _project(gst=5), discount=9_999_999)
    assert cs["discount"] == D("1000000.00") and cs["agreement_value"] == D("0.00") and cs["gst_amount"] == D("0.00")
    odd = pricing.cost_sheet(_unit(base_rate=D("3333.33"), super_area=D("777.77")), _project(gst=5))
    assert odd["agreement_value"] == (D("3333.33") * D("777.77")).quantize(D("0.01"))
    assert odd["gst_amount"] == (odd["agreement_value"] * 5 / 100).quantize(D("0.01"))


# -- TDS 194-IA ---------------------------------------------------------------------------------

def test_tds_194ia_threshold_and_rate():
    assert pricing.tds_194ia(4_999_999, 1_000_000) == D("0.00")  # below 50 lakh: no TDS at all
    assert pricing.tds_194ia(5_000_000, 1_000_000) == D("10000.00")  # exactly 50 lakh: 1% of the payment
    assert pricing.tds_194ia(8_000_000, D("333333.33")) == D("3333.33")
    assert pricing.tds_194ia(8_000_000, 0) == D("0.00")


def test_tds_194ia_uses_the_higher_of_price_and_stamp_duty_value():
    # sold at 45 lakh but the circle-rate value is 55 lakh -> the threshold is crossed
    assert pricing.tds_194ia(4_500_000, 1_000_000) == D("0.00")
    assert pricing.tds_194ia(4_500_000, 1_000_000, stamp_duty_value=5_500_000) == D("10000.00")
    assert pricing.tds_194ia(6_000_000, 1_000_000, stamp_duty_value=5_500_000) == D("10000.00")


def test_form_26qb_due_date_is_30_days_after_month_end():
    assert tax.tds_deposit_due(date(2026, 1, 15)) == date(2026, 3, 2)  # 31 Jan + 30 days
    assert tax.tds_deposit_due(date(2026, 1, 31)) == date(2026, 3, 2)
    assert tax.tds_deposit_due(date(2025, 12, 20)) == date(2026, 1, 30)
    assert tax.tds_deposit_due(date(2024, 2, 10)) == date(2024, 3, 30)  # leap year: 29 Feb + 30 days
    assert tax.tds_deposit_due(date(2026, 4, 1)) == date(2026, 5, 30)


# -- RERA ---------------------------------------------------------------------------------------

def test_rera_reserve_is_70_percent():
    assert tax.RERA_RESERVE_PERCENT == D(70)


@pytest.mark.asyncio
async def test_rera_withdrawal_is_limited_by_certified_completion(client, test_vendor_user):
    # Collected 5,25,000; 70% (3,67,500) must sit in the designated account. Deposit exactly that.
    # With 40% of the work certified, at most 40% of the deposit (1,47,000) may be withdrawn in total.
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)
    await _post(client, "/receipts", {"booking_id": b["id"], "amount": 525_000, "mode": "neft"})
    acct = (await client.get(f"{B}/tax/rera-account", params={"project_id": project["id"]})).json()["projects"][0]
    assert acct["required_reserve"] == 367_500 and acct["shortfall"] == 367_500 and acct["compliant"] is False

    await _post(client, "/rera-entries", {"project_id": project["id"], "kind": "deposit", "amount": 367_500,
                                          "entry_date": date.today().isoformat()})
    acct = (await client.get(f"{B}/tax/rera-account", params={"project_id": project["id"]})).json()["projects"][0]
    assert acct["shortfall"] == 0 and acct["compliant"] is True

    def wd(amount, ref):
        return {"project_id": project["id"], "kind": "withdrawal", "amount": amount, "entry_date": date.today().isoformat(),
                "certified_completion_percent": 40, "certified_by": "Arch. Rao", "certificate_ref": ref}

    ok = await _post(client, "/rera-entries", wd(147_000, "F3/1"))
    await _post(client, f"/rera-entries/{ok['id']}/approve", {}, status=200)
    one_more = await _post(client, "/rera-entries", wd(1, "F3/2"))
    assert (await client.post(f"{B}/rera-entries/{one_more['id']}/approve", json={})).status_code == 409


# -- delayed-payment interest -------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delayed_payment_interest_is_simple_interest_on_the_overdue_amount(client, test_vendor_user, db_session):
    from app.models.realestate.receivables import ReDemand

    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)
    await db_session.execute(update(ReDemand).values(due_date=date.today() - timedelta(days=73)))
    await db_session.commit()
    rep = (await client.get(f"{B}/collections/overdue")).json()
    # 5,25,000 x 10.5% x 73/365 = 11,025.00
    assert rep["items"][0]["interest"] == pytest.approx(11_025.00, abs=0.01)

    # part payment reduces the principal that interest runs on: 25,000 paid -> 5,00,000 x 10.5% x 73/365 = 10,500
    await _post(client, "/receipts", {"booking_id": b["id"], "amount": 25_000, "mode": "neft"})
    rep = (await client.get(f"{B}/collections/overdue")).json()
    assert rep["items"][0]["interest"] == pytest.approx(10_500.00, abs=0.01)


# -- sample project, start to finish ------------------------------------------------------------

@pytest.mark.asyncio
async def test_sample_project_acceptance_run(client, test_vendor_user):
    """Book -> pay with TDS -> agreement -> second instalment -> GST / TDS / RERA / reconciliation all tell one story."""
    project, *_ = await _setup_inventory(client)
    await _plan(client, project["id"], STD_PLAN)
    b = await _book(client, project)
    assert b["agreement_value"] == 5_000_000

    fin = await _finance(client, b["id"])
    assert fin["payable_total"] == 5_250_000 and fin["demands"][0]["total_amount"] == 525_000

    # buyer pays instalment 1 net of 1% TDS (5,000 on 5,00,000 of the base amount)
    rec = await _post(client, "/receipts", {"booking_id": b["id"], "amount": 520_000, "tds_amount": 5_000,
                                            "mode": "neft", "reference_no": "UTR-1"})
    assert rec["gross_amount"] == 525_000 and rec["status"] == "cleared"

    # signing the agreement releases instalment 2 (90% + GST = 47,25,000); pay it in full
    await _sign_agreement(client, b["id"])
    fin = await _finance(client, b["id"])
    d2 = next(d for d in fin["demands"] if d["stage_name"] == "On agreement")
    assert d2["total_amount"] == 4_725_000
    await _post(client, "/receipts", {"booking_id": b["id"], "amount": 4_725_000, "mode": "rtgs", "reference_no": "UTR-2"})

    fin = await _finance(client, b["id"])
    assert fin["paid"] == 5_250_000 and fin["balance"] == 0 and fin["overdue"] == 0

    gst = (await client.get(f"{B}/tax/gst-summary")).json()
    assert gst["invoiced"]["gst"] == 250_000  # 5% of 50,00,000, split across the two demands
    assert gst["received"]["gross"] == 5_250_000

    tds = (await client.get(f"{B}/tds-entries")).json()
    assert tds["total"] == 1 and tds["items"][0]["tds_amount"] == 5_000

    acct = (await client.get(f"{B}/tax/rera-account", params={"project_id": project["id"]})).json()["projects"][0]
    assert acct["collected"] == 5_250_000 and acct["required_reserve"] == 3_675_000 and acct["compliant"] is False

    rec_report = (await client.get(f"{B}/tax/reconciliation")).json()
    titles = " | ".join(i["title"] for i in rec_report["issues"])
    assert "RERA reserve" in titles  # nothing deposited into the designated account yet
    assert "TDS" in titles or rec_report["tds"]["entries"] == 1  # 26QB not yet deposited
