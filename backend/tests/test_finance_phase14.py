"""
Phase 14 — Indian statutory correctness (GST + TDS).

Pure rule tests (no DB) plus GSTR-1 / GSTR-3B computed from real invoices and bills.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy import delete, select

from app.models.finance import FinAccount, FinJournalLine, FinVendorBill
from app.models.invoice import Invoice
from app.models.procurement import Supplier
from app.models.vendor import Vendor
from app.repositories.finance.finance_repo import FinTaxRepo
from app.schemas.finance.vendor_bill import VendorBillCreate
from app.services.finance import gst
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.posting import post_event

D = Decimal


# ═══ pure rules ══════════════════════════════════════════════════════════════

@pytest.mark.parametrize("value,gstin,expected", [
    ("Maharashtra", None, "27"),
    ("maharashtra ", None, "27"),
    ("27-Maharashtra", None, "27"),
    ("27", None, "27"),
    ("7", None, "07"),
    ("MH", None, "27"),
    ("Tamil Nadu", None, "33"),
    ("Orissa", None, "21"),
    ("J&K", None, "01"),
    ("Daman and Diu", None, "26"),
    ("", "29ABCDE1234F1Z5", "29"),
    ("Atlantis", None, None),
    (None, None, None),
])
def test_normalize_state_code(value, gstin, expected):
    assert gst.normalize_state_code(value, gstin) == expected


def test_b2cl_threshold_changes_on_1_aug_2024():
    assert gst.b2cl_threshold(date(2024, 7, 31)) == D("250000")
    assert gst.b2cl_threshold(date(2024, 8, 1)) == D("100000")


def test_rate_lines_groups_by_rate_and_reads_dict_items():
    items = [
        {"hsn_sac": "1001", "qty": 2, "taxable_value": 100, "cgst_amt": 9, "sgst_amt": 9, "tax_rate": 18},
        {"hsn_sac": "1002", "qty": 1, "taxable_value": 50, "cgst_amt": 4.5, "sgst_amt": 4.5, "tax_rate": 18},
        {"hsn_sac": "2001", "qty": 1, "taxable_value": 200, "cgst_amt": 5, "sgst_amt": 5, "tax_rate": 5},
    ]
    rl = {r["rate"]: r for r in gst.rate_lines(items)}
    assert set(rl) == {D("18"), D("5")}
    assert rl[D("18")]["taxable"] == D("150") and rl[D("18")]["cgst"] == D("13.5")


def test_setoff_igst_credit_used_first_against_igst_then_cgst_then_sgst():
    r = gst.gst_setoff({"igst": 100, "cgst": 50, "sgst": 50}, {"igst": 180, "cgst": 0, "sgst": 0})
    assert r["payable"] == {"igst": D("0.00"), "cgst": D("0.00"), "sgst": D("20.00")}
    assert r["itc_carry_forward"]["igst"] == D("0.00")


def test_setoff_cgst_credit_cannot_pay_sgst():
    r = gst.gst_setoff({"igst": 0, "cgst": 10, "sgst": 100}, {"igst": 0, "cgst": 60, "sgst": 0})
    assert r["payable"]["sgst"] == D("100.00")          # untouched
    assert r["payable"]["cgst"] == D("0.00")
    assert r["itc_carry_forward"]["cgst"] == D("50.00")  # excess carried forward, not lost


def test_setoff_cgst_and_sgst_credit_can_pay_igst():
    r = gst.gst_setoff({"igst": 100, "cgst": 0, "sgst": 0}, {"igst": 0, "cgst": 40, "sgst": 70})
    assert r["payable"]["igst"] == D("0.00")
    assert r["itc_carry_forward"]["sgst"] == D("10.00")


def test_infer_itc_split_by_state():
    inter = gst.infer_itc_split(D("18"), "29ABCDE1234F1Z5", "27ABCDE1234F1Z5")
    assert inter == {"igst": D("18"), "cgst": D("0"), "sgst": D("0")}
    intra = gst.infer_itc_split(D("18"), "27ABCDE1234F1Z5", "27ZZZZZ9999Z1Z1")
    assert intra["cgst"] + intra["sgst"] == D("18") and intra["igst"] == D("0")
    odd = gst.infer_itc_split(D("0.05"), "27AAAAA0000A1Z5", "27AAAAA0000A1Z5")
    assert odd["cgst"] + odd["sgst"] == D("0.05")      # paise never lost


# ═══ schema: bill TDS / GST validation ═══════════════════════════════════════

def _bill(**kw):
    base = dict(supplier_id=uuid.uuid4(), bill_no="B1", bill_date=date(2026, 5, 1),
                subtotal=D("1000"), tax_amount=D("180"), total=D("1180"))
    base.update(kw)
    return VendorBillCreate(**base)


def test_bill_total_must_equal_subtotal_plus_tax():
    with pytest.raises(ValidationError):
        _bill(total=D("1000"))


def test_bill_tds_amount_computed_from_rate():
    b = _bill(tds_section="194c", tds_rate=D("2"))
    assert b.tds_section == "194C" and b.tds_amount == D("20.00")


def test_bill_tds_rejects_unknown_section_and_missing_section():
    with pytest.raises(ValidationError):
        _bill(tds_section="999Z", tds_rate=D("2"))
    with pytest.raises(ValidationError):
        _bill(tds_amount=D("10"))


def test_bill_gst_split_must_match_tax_and_not_mix_igst():
    with pytest.raises(ValidationError):
        _bill(cgst_amount=D("50"), sgst_amount=D("50"))
    with pytest.raises(ValidationError):
        _bill(cgst_amount=D("90"), igst_amount=D("90"))
    ok = _bill(cgst_amount=D("90"), sgst_amount=D("90"))
    assert ok.cgst_amount == D("90")


def test_gstr1_json_shape_matches_gstn_schema():
    data = {
        "b2b": [{"customer_gstin": "29ABCDE1234F1Z5", "invoice_number": "INV-1", "invoice_date": "2026-05-03",
                 "total": 118, "pos_code": "29",
                 "rate_lines": [{"rate": 18, "taxable": 100, "cgst": 0, "sgst": 0, "igst": 18, "cess": 0}]}],
        "b2cs": [{"sply_ty": "INTRA", "pos_code": "27", "rate": 18, "taxable": 100, "cgst": 9, "sgst": 9,
                  "igst": 0, "cess": 0}],
        "b2b_cdns": [{"customer_gstin": "29ABCDE1234F1Z5", "invoice_number": "CN-1", "invoice_date": "2026-05-09",
                      "total": 59, "pos_code": "29",
                      "rate_lines": [{"rate": 18, "taxable": 50, "cgst": 0, "sgst": 0, "igst": 9, "cess": 0}]}],
        "hsn_summary": [{"hsn_sac": "1001", "uqc": "NOS", "rate": 18, "desc": "x", "quantity": 2,
                         "taxable_value": 100, "cgst": 0, "sgst": 0, "igst": 18, "cess": 0, "total_value": 118}],
    }
    out = gst.build_gstr1_json("27AAAAA0000A1Z5", date(2026, 5, 1), data)
    assert out["gstin"] == "27AAAAA0000A1Z5" and out["fp"] == "052026"
    inv = out["b2b"][0]["inv"][0]
    assert out["b2b"][0]["ctin"] == "29ABCDE1234F1Z5"
    assert inv["idt"] == "03-05-2026" and inv["pos"] == "29" and inv["rchrg"] == "N"
    assert inv["itms"][0]["itm_det"] == {"rt": 18.0, "txval": 100.0, "iamt": 18.0, "camt": 0.0,
                                         "samt": 0.0, "csamt": 0.0}
    assert out["b2cs"][0]["sply_ty"] == "INTRA" and out["b2cs"][0]["typ"] == "OE"
    assert out["cdnr"][0]["nt"][0]["ntty"] == "C" and out["cdnr"][0]["nt"][0]["nt_dt"] == "09-05-2026"
    assert out["hsn"]["data"][0]["hsn_sc"] == "1001" and out["hsn"]["data"][0]["rt"] == 18.0
    assert "cdnur" not in out and "b2cl" not in out      # empty sections are omitted


# ═══ GSTR-1 / 3B from real documents ═════════════════════════════════════════

@pytest_asyncio.fixture
async def gst_vendor(db_session, test_vendor: Vendor) -> Vendor:
    test_vendor.gstin = "27AAAAA0000A1Z5"
    test_vendor.state = "Maharashtra"
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


_seq = iter(range(1, 1000))


def _inv(vendor_id, number, *, kind="invoice", taxable, cgst=0, sgst=0, igst=0, gstin=None,
         pos="Maharashtra", inter=False, items=None, d=date(2026, 5, 10)):
    total = taxable + cgst + sgst + igst
    return Invoice(
        id=uuid.uuid4(), vendor_id=vendor_id, invoice_number=number, invoice_type=kind,
        status="sent", invoice_date=d, taxable_amount=taxable, subtotal=taxable,
        cgst_amount=cgst, sgst_amount=sgst, igst_amount=igst, total=total,
        customer_gstin=gstin, place_of_supply=pos, is_inter_state=inter,
        items=items if items is not None else [], amount_paid=0, balance_due=total,
        financial_year="2026-27", sequence_number=next(_seq),
    )


@pytest.mark.asyncio
async def test_gstr1_classification_hsn_and_credit_note_netting(db_session, gst_vendor):
    v = gst_vendor.id
    line = lambda hsn, tx, rate, half=True: {  # noqa: E731
        "hsn_sac": hsn, "name": f"item {hsn}", "qty": 1, "taxable_value": tx, "tax_rate": rate,
        "cgst_amt": tx * rate / 200 if half else 0, "sgst_amt": tx * rate / 200 if half else 0,
        "igst_amt": 0 if half else tx * rate / 100,
    }
    db_session.add_all([
        # B2B intra-state
        _inv(v, "B2B-1", taxable=1000, cgst=90, sgst=90, gstin="27BBBBB1111B1Z5",
             items=[line("1001", 1000, 18)]),
        # B2CS small intra-state
        _inv(v, "B2CS-1", taxable=500, cgst=45, sgst=45, items=[line("1001", 500, 18)]),
        # B2CL: inter-state B2C above threshold (Aug 2024+ threshold is 1 lakh)
        _inv(v, "B2CL-1", taxable=200000, igst=36000, pos="Karnataka", inter=True,
             items=[line("2002", 200000, 18, half=False)]),
        # inter-state B2C *below* threshold -> B2CS INTER
        _inv(v, "B2CS-2", taxable=1000, igst=180, pos="Karnataka", inter=True,
             items=[line("1001", 1000, 18, half=False)]),
        # credit note against a registered buyer
        _inv(v, "CN-B2B", kind="credit_note", taxable=100, cgst=9, sgst=9, gstin="27BBBBB1111B1Z5",
             items=[line("1001", 100, 18)]),
        # small B2C credit note -> nets into B2CS
        _inv(v, "CN-B2C", kind="credit_note", taxable=100, cgst=9, sgst=9, items=[line("1001", 100, 18)]),
        # out of period
        _inv(v, "OLD-1", taxable=999, cgst=90, sgst=90, d=date(2026, 3, 1), items=[line("1001", 999, 18)]),
    ])
    await db_session.commit()

    g1 = await FinTaxRepo(db_session).compute_gstr1(v, date(2026, 5, 1), date(2026, 5, 31))

    assert [r["invoice_number"] for r in g1["b2b"]] == ["B2B-1"]
    assert [r["invoice_number"] for r in g1["b2cl"]] == ["B2CL-1"]
    assert g1["b2cl"][0]["pos_code"] == "29" and g1["b2cl"][0]["is_inter_state"] is True
    assert [r["invoice_number"] for r in g1["b2b_cdns"]] == ["CN-B2B"]
    assert g1["total_invoices"] == 4 and g1["total_credit_notes"] == 2

    b2cs = {(r["sply_ty"], r["pos_code"], r["rate"]): r for r in g1["b2cs"]}
    intra = b2cs[("INTRA", "27", 18.0)]
    assert intra["taxable"] == 400.0 and intra["cgst"] == 36.0     # 500 invoice - 100 credit note
    assert b2cs[("INTER", "29", 18.0)]["igst"] == 180.0

    hsn = {(h["hsn_sac"], h["rate"]): h for h in g1["hsn_summary"]}
    assert "UNDEF" not in {k[0] for k in hsn}
    assert hsn[("1001", 18.0)]["taxable_value"] == 1000 + 500 + 1000 - 100 - 100
    assert hsn[("2002", 18.0)]["igst"] == 36000.0

    # net = invoices - credit notes
    assert g1["total_taxable"] == 1000 + 500 + 200000 + 1000
    assert g1["cn_taxable"] == 200.0
    assert g1["net_taxable"] == g1["total_taxable"] - 200
    assert g1["net_cgst"] == (90 + 45) - (9 + 9)


@pytest.mark.asyncio
async def test_gstr3b_nets_credit_notes_and_sets_off_itc_correctly(db_session, gst_vendor):
    v = gst_vendor.id
    db_session.add_all([
        _inv(v, "S-1", taxable=10000, cgst=900, sgst=900, items=[]),
        _inv(v, "CN-1", kind="credit_note", taxable=1000, cgst=90, sgst=90, items=[]),
    ])
    inter_sup = Supplier(id=uuid.uuid4(), vendor_id=v, name="Karnataka Supplier", gstin="29ABCDE1234F1Z5")
    intra_sup = Supplier(id=uuid.uuid4(), vendor_id=v, name="Local Supplier", gstin="27ABCDE1234F1Z5")
    no_gstin = Supplier(id=uuid.uuid4(), vendor_id=v, name="Unregistered")
    db_session.add_all([inter_sup, intra_sup, no_gstin])
    await db_session.flush()
    je_id = None
    # a posted JE id is required for ITC eligibility
    je = await post_event(db_session, v, "expense", uuid.uuid4(), {"amount": D("1")})
    je_id = je.id

    def bill(sup, no, tax, **split):
        return FinVendorBill(
            id=uuid.uuid4(), vendor_id=v, supplier_id=sup.id, bill_no=no, bill_date=date(2026, 5, 12),
            subtotal=D("1000"), tax_amount=D(tax), total=D("1000") + D(tax), balance_due=D("1000"),
            status="open", journal_entry_id=je_id, **split)

    db_session.add_all([
        bill(inter_sup, "IGST-BILL", "180"),                     # inferred -> IGST 180
        bill(intra_sup, "CGST-BILL", "100"),                     # inferred -> 50/50
        bill(intra_sup, "EXPLICIT", "36", cgst_amount=D("18"), sgst_amount=D("18")),
        bill(no_gstin, "NO-GSTIN", "500"),                       # no ITC: unregistered supplier
    ])
    await db_session.commit()

    r = await FinTaxRepo(db_session).compute_gstr3b(v, date(2026, 5, 1), date(2026, 5, 31))

    # outward net of the credit note
    assert r["outward_cgst"] == 810.0 and r["outward_sgst"] == 810.0 and r["outward_igst"] == 0.0
    # ITC: IGST 180, CGST 50+18, SGST 50+18; unregistered bill excluded
    assert (r["itc_igst"], r["itc_cgst"], r["itc_sgst"]) == (180.0, 68.0, 68.0)
    assert r["itc_bills"] == 3
    # set-off: IGST credit pays CGST then SGST; own CGST/SGST credits pay their own head
    # CGST: 810 - 180(IGST) - 68 = 562 ; SGST: 810 - 68 = 742
    assert r["net_cgst_payable"] == 562.0
    assert r["net_sgst_payable"] == 742.0
    assert r["net_igst_payable"] == 0.0
    assert r["total_net_payable"] == 1304.0


# ═══ TDS on bills ════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_vendor_bill_with_tds_posts_net_ap_and_tds_payable(db_session, gst_vendor):
    je = await post_event(db_session, gst_vendor.id, "vendor_bill", uuid.uuid4(), {
        "subtotal": D("1000"), "tax_amount": D("180"), "total": D("1180"),
        "tds_amount": D("20"), "tds_section": "194C", "supplier_id": None,
    })
    await db_session.commit()
    lines = (await db_session.execute(select(FinJournalLine, FinAccount).join(
        FinAccount, FinAccount.id == FinJournalLine.account_id).where(
        FinJournalLine.journal_entry_id == je.id))).all()
    by_name = {a.name: (ln.debit, ln.credit) for ln, a in lines}
    assert by_name["Accounts Payable"][1] == D("1160")      # supplier owed total - TDS
    assert by_name["TDS Payable"][1] == D("20")
    assert je.total_debit == je.total_credit == D("1180")


@pytest.mark.asyncio
async def test_vendor_bill_tds_without_tds_account_fails_loudly(db_session, gst_vendor):
    await db_session.execute(delete(FinAccount).where(
        FinAccount.vendor_id == gst_vendor.id, FinAccount.name == "TDS Payable"))
    await db_session.commit()
    with pytest.raises(ValueError, match="TDS Payable"):
        await post_event(db_session, gst_vendor.id, "vendor_bill", uuid.uuid4(), {
            "subtotal": D("1000"), "tax_amount": D("0"), "total": D("1000"), "tds_amount": D("10"),
        })


@pytest.mark.asyncio
async def test_post_bill_balance_due_is_net_of_tds(db_session, gst_vendor):
    from app.repositories.finance.finance_repo import FinAPRepo
    sup = Supplier(id=uuid.uuid4(), vendor_id=gst_vendor.id, name="S")
    db_session.add(sup)
    await db_session.flush()
    bill = FinVendorBill(
        id=uuid.uuid4(), vendor_id=gst_vendor.id, supplier_id=sup.id, bill_no="T-1",
        bill_date=date(2026, 5, 2), subtotal=D("1000"), tax_amount=D("0"), total=D("1000"),
        tds_section="194J", tds_amount=D("100"), status="draft")
    db_session.add(bill)
    await db_session.flush()
    bill = await FinAPRepo(db_session).post_bill(bill)
    assert bill.balance_due == D("900")
