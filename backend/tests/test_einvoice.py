"""GST e-invoice helpers: setting off keeps current invoice behaviour."""
from types import SimpleNamespace

from app.services.einvoice_service import (
    auto_generate_einvoice,
    build_irp_payload,
    eligibility_error,
    flatten_einvoice,
    generate_einvoice,
)


def test_auto_generate_defaults_off():
    assert auto_generate_einvoice(None) is False
    assert auto_generate_einvoice({}) is False
    assert auto_generate_einvoice({"auto_generate_einvoice": False}) is False
    assert auto_generate_einvoice({"auto_generate_einvoice": True}) is True


def test_eligibility_requires_b2b_tax_invoice():
    inv = SimpleNamespace(
        invoice_type="invoice",
        status="sent",
        document_type="tax_invoice",
        is_gst=True,
        vendor_gstin="29AABCU9603R1ZM",
        customer_gstin="29AABCU9603R1ZM",
        einvoice=None,
    )
    assert eligibility_error(inv) is None

    inv.invoice_type = "estimate"
    assert eligibility_error(inv)

    inv.invoice_type = "invoice"
    inv.customer_gstin = ""
    assert "Buyer GSTIN" in eligibility_error(inv)


def test_build_irp_payload_uses_invoice_fields():
    inv = SimpleNamespace(
        invoice_number="INV/25-26/0001",
        invoice_date=None,
        created_at=None,
        vendor_gstin="29AABCU9603R1ZM",
        vendor_name="Acme",
        vendor_address={"street": "MG Road", "city": "Bengaluru", "state": "Karnataka", "postal_code": "560001"},
        customer_gstin="27AABCU9603R1Z1",
        customer_name="Buyer Co",
        billing_address={"street": "FC Road", "city": "Pune", "state": "Maharashtra", "postal_code": "411001"},
        shipping_address=None,
        place_of_supply="27",
        is_inter_state=True,
        items=[{
            "name": "Widget",
            "hsn_sac": "8471",
            "qty": 2,
            "rate": 100,
            "taxable_value": 200,
            "tax_rate": 18,
            "igst_amt": 36,
            "cgst_amt": 0,
            "sgst_amt": 0,
            "total": 236,
        }],
        taxable_amount=200,
        cgst_amount=0,
        sgst_amount=0,
        igst_amount=36,
        discount_amount=0,
        round_off=0,
        total=236,
    )
    payload = build_irp_payload(inv)
    assert payload["DocDtls"]["Typ"] == "INV"
    assert payload["SellerDtls"]["Gstin"] == "29AABCU9603R1ZM"
    assert payload["SellerDtls"]["Stcd"] == "29"
    assert payload["BuyerDtls"]["Pos"] == "27"
    assert payload["ItemList"][0]["HsnCd"] == "8471"
    assert payload["ValDtls"]["TotInvVal"] == 236


def test_flatten_einvoice_defaults_to_none():
    inv = SimpleNamespace(einvoice=None)
    assert flatten_einvoice(inv)["einvoice_status"] == "none"
    inv.einvoice = {"status": "generated", "irn": "abc"}
    assert flatten_einvoice(inv)["einvoice_irn"] == "abc"


async def test_generate_skips_when_setting_off():
    invoice = SimpleNamespace(einvoice=None, vendor_id="x")
    vendor = SimpleNamespace(settings={}, gstin="29AABCU9603R1ZM")
    result = await generate_einvoice(invoice, vendor, force=False)
    assert result == {}
    assert invoice.einvoice is None


async def test_generate_records_failure_without_credentials():
    invoice = SimpleNamespace(
        invoice_type="invoice",
        status="sent",
        document_type="tax_invoice",
        is_gst=True,
        vendor_gstin="29AABCU9603R1ZM",
        customer_gstin="29AABCU9603R1ZM",
        einvoice=None,
        vendor_id="x",
    )
    vendor = SimpleNamespace(settings={"auto_generate_einvoice": True}, gstin="29AABCU9603R1ZM")
    result = await generate_einvoice(invoice, vendor, force=True)
    assert result["status"] == "failed"
    assert "credentials" in result["error"]
