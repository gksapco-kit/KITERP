"""
Server-side invoice / quotation PDF.

- The PDF follows the vendor's saved template settings (toggles, labels, branding, layout order).
- Quotations and invoices use their own template; POS receipts layer the POS overrides on top.
- Images are only ever read from our own storage (never fetched, never path-traversed).
- User-supplied text can't break the document or fall back to the bare plain-text PDF.
"""

import io
import uuid

import pytest
from httpx import AsyncClient
from PIL import Image
from pypdf import PdfReader

import app.services.document_assets as assets_mod
import app.services.invoice_pdf as invoice_pdf_mod
import app.utils.pdf_generator as pdfgen
from app.api.deps import get_current_vendor_user
from app.main import app
from app.models.invoice import Invoice
from app.models.vendor_user import VendorUser
from app.services.document_assets import (
    company_logo_key, document_asset_key, is_document_asset, load_document_image,
)
from app.services.file_service import FileService
from app.utils.pdf_generator import (
    amount_in_words, fmt_money, generate_invoice_pdf, is_pos_invoice, resolve_pdf_settings,
)


def _png(color=(10, 80, 200, 255), size=(40, 20)) -> bytes:
    out = io.BytesIO()
    Image.new("RGBA", size, color).save(out, "PNG")
    return out.getvalue()


def _text(pdf: bytes) -> str:
    assert pdf.startswith(b"%PDF")
    return "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages)


def _flat(pdf: bytes) -> str:
    """Text with all whitespace collapsed -- table cells wrap, so compare without line breaks."""
    return " ".join(_text(pdf).split())


@pytest.fixture(autouse=True)
def _no_plain_fallback(monkeypatch):
    """The styled renderer must succeed; silently degrading to the plain PDF would hide bugs."""
    def boom(*_a, **_k):
        raise AssertionError("fell back to the plain PDF")
    monkeypatch.setattr(pdfgen, "_generate_plain_pdf", boom)


def _invoice(**over) -> dict:
    inv = {
        "invoice_number": "INV-2026-0042", "invoice_type": "invoice", "document_type": "tax_invoice",
        "vendor_name": "Acme Traders", "vendor_gstin": "29ABCDE1234F1Z5",
        "vendor_address": {"street": "12 MG Road", "city": "Bengaluru", "state": "Karnataka", "postal_code": "560001"},
        "customer_name": "Ravi Kumar", "customer_email": "ravi@example.com", "customer_phone": "+91 98765 43210",
        "customer_gstin": "27AAAAA0000A1Z5",
        "billing_address": {"street": "5 Park Street", "city": "Mumbai"},
        "shipping_address": {"street": "Warehouse 9", "city": "Pune"},
        "created_at": "2026-10-12T10:00:00", "due_date": "2026-10-27", "financial_year": "2026-27",
        "booking_number": "BK-77", "order_number": "ORD-9", "place_of_supply": "Maharashtra", "payment_terms": "Net 15",
        "items": [{"name": "Widget", "description": "Blue", "hsn_sac": "8479", "qty": 1.5, "rate": 1000.0,
                   "discount": 50, "cgst_amt": 85.5, "sgst_amt": 85.5, "igst_amt": 0, "total": 1621.0}],
        "subtotal": 1500.0, "discount_amount": 25, "taxable_amount": 1425, "cgst_amount": 128.25, "sgst_amount": 128.25,
        "igst_amount": 0, "total_tax": 256.5, "round_off": 0.4, "total": 1681.9, "amount_paid": 500, "balance_due": 1181.9,
        "notes": "Thank you!", "terms_and_conditions": "No returns.", "is_gst": True,
    }
    inv.update(over)
    return inv


def _pdf(inv=None, stored=None, *, quotation=False, pos=None, images=None, vendor=None) -> bytes:
    return generate_invoice_pdf(
        inv or _invoice(), resolve_pdf_settings(stored, pos, is_quotation=quotation), images or {}, vendor or {},
    )


BANK = {"bank_name": "Test Bank", "account_number": "9988776655", "ifsc_code": "TEST0001234",
        "account_holder_name": "Acme Traders", "upi_id": "acme@testbank"}


# ── Formatting helpers ───────────────────────────────────────────────────────

def test_money_uses_rupee_sign_and_indian_grouping():
    assert fmt_money(1234567.5) == "\u20b912,34,567.50"
    assert fmt_money(0) == "\u20b90.00"
    assert fmt_money(999) == "\u20b9999.00"
    assert fmt_money(-1500) == "-\u20b91,500.00"
    assert fmt_money("garbage") == "\u20b90.00"
    assert fmt_money(float("nan")) == "\u20b90.00"


def test_amount_in_words_indian_system():
    assert amount_in_words(0) == "Indian Rupees Zero Only"
    assert amount_in_words(118410.40) == "Indian Rupees One Lakh Eighteen Thousand Four Hundred Ten and Forty Paise Only"
    assert amount_in_words(25_00_000) == "Indian Rupees Twenty Five Lakh Only"
    assert amount_in_words(1_00_00_000) == "Indian Rupees One Crore Only"
    assert amount_in_words(10**13) == ""  # absurd values are dropped rather than mangled


def test_resolve_settings_layers_defaults_then_saved_then_pos():
    inv = resolve_pdf_settings({"color": "#111111"}, None)
    assert inv["color"] == "#111111" and inv["show_balance_due"] is True and inv["show_terms"] is False
    quote = resolve_pdf_settings({}, None, is_quotation=True)
    assert quote["show_balance_due"] is False and quote["show_terms"] is True and "quotation is valid" in quote["default_terms"]
    pos = resolve_pdf_settings({"color": "#111111", "watermark": "A"}, {"watermark": "POS"})
    assert pos["watermark"] == "POS" and pos["color"] == "#111111"
    assert resolve_pdf_settings({"color": None})["color"] == pdfgen.DEFAULT_COLOR  # null never overrides a default


def test_is_pos_invoice():
    assert is_pos_invoice({"invoice_number": "POS-0001"})
    assert is_pos_invoice({"invoice_number": "pos-9"})
    assert is_pos_invoice({"invoice_number": "INV-1", "notes": "POS Transaction #5"})
    assert not is_pos_invoice({"invoice_number": "INV-POS-1", "notes": "regular"})


# ── Content follows the settings ─────────────────────────────────────────────

def test_default_invoice_has_rupee_amounts_title_and_totals():
    text = _flat(_pdf())
    assert "TAX INVOICE" in text and "INV-2026-0042" in text
    assert "\u20b91,681.90" in text                       # total, with the rupee sign
    assert "Acme Traders" in text and "29ABCDE1234F1Z5" in text
    assert "Ravi Kumar" in text
    assert "Balance due" in text and "Amount paid" in text
    assert "Computer generated invoice. No signature required. This is a valid tax invoice." in text


def test_fractional_quantity_is_not_truncated():
    assert " 1.5 " in f" {_flat(_pdf())} "


@pytest.mark.parametrize("flag,marker", [
    ("show_bank_details", "BANK DETAILS"),
    ("show_notes", "Thank you!"),
    ("show_gstin", "29ABCDE1234F1Z5"),
    ("show_place_of_supply", "Maharashtra"),
    ("show_payment_terms", "Net 15"),
    ("show_customer_email", "ravi@example.com"),
    ("show_financial_year", "2026-27"),
    ("show_due_date", "27 Oct 2026"),
    ("show_booking_number", "BK-77"),
    ("show_amount_paid", "Amount paid"),
    ("show_balance_due", "Balance due"),
    ("show_round_off", "Round off"),
    ("show_legal_note", "Computer generated"),
    ("show_copy_label", "ORIGINAL FOR RECIPIENT"),
    ("show_vendor_address", "12 MG Road"),
    ("show_customer_address", "5 Park Street"),
    ("show_description", "Blue"),
    ("show_hsn", "8479"),
])
def test_default_on_toggles_hide_their_content(flag, marker):
    assert marker in _flat(_pdf(stored=BANK))
    assert marker not in _flat(_pdf(stored={**BANK, flag: False}))


@pytest.mark.parametrize("flag,marker", [
    ("show_terms", "No returns."),
    ("show_taxable_amount", "Taxable amount"),
    ("show_amount_in_words", "Amount in words"),
    ("show_shipping_address", "Warehouse 9"),
    ("show_tax_inclusive_note", "inclusive of applicable taxes"),
    ("show_discount", "Discount"),
    ("show_item_numbers", "# Item"),
])
def test_default_off_toggles_show_their_content_when_enabled(flag, marker):
    assert marker not in _flat(_pdf(stored={"discount_display": "column"}))
    assert marker in _flat(_pdf(stored={flag: True, "discount_display": "column"}))


def test_tax_labels_and_breakdown_toggle():
    labels = {"cgst_label": "Central GST", "sgst_label": "State GST", "igst_label": "Integrated GST"}
    text = _flat(_pdf(stored=labels))
    assert "Central GST" in text and "State GST" in text and "Integrated GST" not in text  # IGST amount is 0
    combined = _flat(_pdf(stored={**labels, "show_tax_breakdown": False, "tax_label": "GST total"}))
    assert "GST total" in combined and "Central GST" not in combined


def test_discount_display_modes():
    only_column = _flat(_pdf(stored={"show_discount": True, "discount_display": "column", "discount_label": "Rebate"}))
    assert "Rebate" not in only_column                       # summary row hidden
    summary = _flat(_pdf(stored={"discount_display": "summary", "discount_label": "Rebate"}))
    assert "Rebate" in summary and "-\u20b925.00" in summary


def test_bank_details_signature_and_footer_text():
    text = _flat(_pdf(stored={**BANK, "signatory_name": "R. Sharma", "default_terms": "Default terms",
                              "show_terms": True}))
    for expected in ("Test Bank", "9988776655", "TEST0001234", "acme@testbank", "R. Sharma",
                     "Authorised signatory", "No returns."):
        assert expected in text
    # default notes / terms are only used when the document has none of its own
    fallback = _flat(_pdf(_invoice(notes="", terms_and_conditions=""),
                          {"default_notes": "House notes", "default_terms": "House terms", "show_terms": True}))
    assert "House notes" in fallback and "House terms" in fallback


def test_watermark_and_website():
    text = _flat(_pdf(stored={"watermark": "DUPLICATE", "show_url": True, "website_url": "https://acme.example"}))
    assert "DUPLICATE" in text and "https://acme.example" in text
    off = _flat(_pdf(stored={"website_url": "https://acme.example"}))                   # show_url defaults off
    assert "acme.example" not in off and "DUPLICATE" not in off


def test_quotation_title_labels_and_defaults():
    text = _flat(_pdf(_invoice(invoice_type="estimate", invoice_number="QT-0007", terms_and_conditions=""),
                      quotation=True))
    assert "QUOTATION" in text and "TAX INVOICE" not in text
    assert "Valid until" in text
    assert "Computer generated quotation." in text
    assert "ORIGINAL FOR RECIPIENT" not in text
    assert "Balance due" not in text and "Amount paid" not in text                      # quotation defaults
    assert "quotation is valid until" in text                                           # default terms shown


def test_non_gst_and_bill_of_supply_do_not_claim_to_be_tax_invoices():
    plain = _flat(_pdf(_invoice(is_gst=False)))
    assert "INVOICE" in plain and "TAX INVOICE" not in plain and "valid tax invoice" not in plain
    bos = _flat(_pdf(_invoice(document_type="bill_of_supply")))
    assert "BILL OF SUPPLY" in bos and "valid tax invoice" not in bos
    assert "CREDIT NOTE" in _flat(_pdf(_invoice(invoice_type="credit_note")))


def test_layout_sections_control_order_and_visibility():
    layout = [{"id": "items", "visible": True}, {"id": "header", "visible": True},
              {"id": "totals", "visible": False}]
    text = _text(_pdf(stored={"layout_sections": layout}))
    assert text.index("Widget") < text.index("TAX INVOICE")       # items rendered before the header
    assert "Subtotal" not in text                                  # hidden section skipped
    assert "BILL TO" in text and "Computer generated" in text      # sections not mentioned stay visible


def test_garbage_settings_do_not_break_rendering():
    junk = {"color": "red;}</style><script>", "font_size_scale": {"x": 1}, "pdf_margin": "wide",
            "pdf_orientation": 5, "layout_sections": "nope", "watermark": "x" * 500, "watermark_opacity": "?",
            "show_logo": "yes", "discount_display": ["a"], "tax_label": None}
    assert "TAX INVOICE" in _flat(_pdf(stored=junk))
    assert "TAX INVOICE" in _flat(_pdf(stored={"color": "#ABC"}))
    assert _pdf(stored={"pdf_orientation": "landscape", "font_size_scale": "lg", "pdf_margin": 999})


def test_hostile_text_is_printed_literally_not_interpreted():
    inv = _invoice(
        vendor_name="Acme <Traders> & Sons", customer_name="Ravi <b>Kumar</b> & <unclosed",
        notes="line1\nline2 <i>x</i> </para>",
        items=[{"name": "Widget <script>alert(1)</script>", "qty": 1, "rate": 10, "total": 10}],
    )
    text = _flat(_pdf(inv))
    assert "Acme <Traders> & Sons" in text
    assert "Ravi <b>Kumar</b> & <unclosed" in text
    assert "<script>alert(1)</script>" in text and "<i>x</i> </para>" in text


def test_bad_empty_and_odd_data_still_render():
    odd = _invoice(items=[], vendor_address="1 Main St", billing_address=None, shipping_address="Dock 4",
                   extra_fields=[{"label": "PO", "type": "text", "value": "7"}, "junk", {"type": "image"}],
                   total=None, subtotal="abc")
    assert "TAX INVOICE" in _flat(_pdf(odd, {"show_shipping_address": True}))
    assert "INV-1" in _flat(_pdf({"invoice_number": "INV-1", "items": ["x", None, {"name": "ok"}]}))


def test_images_render_and_bad_images_are_ignored():
    good = {"logo": _png(), "signature": _png(), "qr": _png()}
    with_images = _pdf(stored={"show_qr_code": True, "qr_code_label": "Scan to pay"}, images=good)
    assert "Scan to pay" in _flat(with_images)
    assert len(with_images) > len(_pdf(stored={"show_qr_code": True}))                    # images embedded
    junk = {"logo": b"not an image", "signature": b"", "qr": b"\x89PNG\r\n\x1a\n-truncated"}
    assert "TAX INVOICE" in _flat(_pdf(stored={"show_qr_code": True}, images=junk))
    # decompression-bomb guard: refuse absurd pixel counts instead of allocating them
    assert pdfgen._prepare_image(_png(size=(6000, 6000))) is None
    assert pdfgen._prepare_image(_png(size=(50, 50))) is not None


def test_bundled_font_has_the_rupee_glyph():
    assert pdfgen._fonts()[2] is True


# ── Image reading: only our own storage, only exact asset names ──────────────

HEX = "0123456789abcdef0123456789abcdef"


class _Storage:
    """Stands in for FileService: records which keys were read."""

    def __init__(self, files=None):
        self.files = files or {}
        self.reads = []

    async def read_bytes(self, key):
        self.reads.append(key)
        return self.files.get(key)

    def remote_public_url(self, key):
        return None


@pytest.fixture
def storage(monkeypatch):
    fs = _Storage({
        f"vendor-signatures/{HEX}.png": _png(),
        f"vendor-qr-codes/{HEX}.png": _png(),
        f"vendor-document-logos/{HEX}.png": _png(),
        "vendor-logos/company.png": _png(),
    })
    monkeypatch.setattr(assets_mod, "get_file_service", lambda: fs)
    return fs


@pytest.mark.parametrize("url", [
    f"/uploads/vendor-signatures/{HEX}.png",
    f"/uploads/vendor-qr-codes/{HEX}.webp",
    f"/uploads/vendor-document-logos/{HEX}.jpg",
    f"/uploads/vendor-document-logos/{HEX}.JPEG",
])
def test_document_asset_urls_that_are_accepted(storage, url):
    assert is_document_asset(url) and document_asset_key(url) == url[len("/uploads/"):]


@pytest.mark.parametrize("url", [
    None, "", 5, [], {},
    f"/uploads/vendor-signatures/../../app/main.py",
    f"/uploads/vendor-signatures/{HEX}.png/../../../etc/passwd",
    f"/uploads/vendor-signatures/..%2f..%2fetc/{HEX}.png",
    f"https://evil.example/uploads/vendor-signatures/{HEX}.png",             # foreign host
    f"//evil.example/uploads/vendor-signatures/{HEX}.png",
    f"/uploads/vendor-logos/{HEX}.png",                                       # not a template folder
    f"/uploads/other/{HEX}.png",
    f"/uploads/vendor-signatures/{HEX}.svg", f"/uploads/vendor-signatures/{HEX}.html",
    "/uploads/vendor-signatures/abc.png",                                     # not one of our generated names
    f"/uploads/vendor-signatures/{HEX}.png\n", f"/uploads/vendor-signatures/{HEX}.png?x=1",
    f"/uploads/vendor-signatures\\{HEX}.png",
    "/uploads/vendor-signatures/" + "a" * 3000 + ".png",
    f"vendor-signatures/{HEX}.png",                                           # bare keys are not URLs we issue
])
def test_document_asset_urls_that_are_rejected(storage, url):
    assert not is_document_asset(url) and document_asset_key(url) is None


def test_remote_storage_base_is_accepted_but_a_lookalike_host_is_not(monkeypatch):
    class Remote(_Storage):
        def remote_public_url(self, key):
            return f"https://cdn.example.com/{key}"

    monkeypatch.setattr(assets_mod, "get_file_service", lambda: Remote())
    assert is_document_asset(f"https://cdn.example.com/vendor-signatures/{HEX}.png")
    assert not is_document_asset(f"https://cdn.example.com.evil.example/vendor-signatures/{HEX}.png")
    assert not is_document_asset(f"http://cdn.example.com/vendor-signatures/{HEX}.png")


def test_company_logo_key_is_strict(storage):
    assert company_logo_key("/uploads/vendor-logos/company.png") == "vendor-logos/company.png"
    for bad in ("/uploads/vendor-logos/../x.png", "/uploads/vendor-logos/a/b.png", "/uploads/vendor-signatures/x.png",
                "https://evil.example/vendor-logos/x.png", "/uploads/vendor-logos/x", None):
        assert company_logo_key(bad) is None


@pytest.mark.asyncio
async def test_load_document_image_reads_only_allowed_sources(storage):
    assert await load_document_image(f"/uploads/vendor-signatures/{HEX}.png")
    assert await load_document_image("/uploads/vendor-logos/company.png") is None                # needs allow_company_logo
    assert await load_document_image("/uploads/vendor-logos/company.png", allow_company_logo=True)
    storage.reads.clear()
    for bad in ("https://evil.example/x.png", "http://169.254.169.254/latest/meta-data",
                "/uploads/vendor-signatures/../../app/main.py", "file:///etc/passwd", "javascript:alert(1)"):
        assert await load_document_image(bad, allow_company_logo=True) is None
    assert storage.reads == []                                                                   # nothing was even attempted


@pytest.mark.asyncio
async def test_load_document_image_data_urls_and_content_checks(storage, monkeypatch):
    import base64
    ok = "data:image/png;base64," + base64.b64encode(_png()).decode()
    assert await load_document_image(ok)
    assert await load_document_image("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=") is None
    assert await load_document_image("data:text/html;base64,PGgxPg==") is None
    assert await load_document_image("data:image/png;base64,!!!not-base64!!!") is None
    not_an_image = "data:image/png;base64," + base64.b64encode(b"<html>hello</html>").decode()
    assert await load_document_image(not_an_image) is None                                       # bytes are sniffed
    storage.files[f"vendor-signatures/{HEX}.png"] = b"<svg onload=alert(1)>"                     # wrong content in storage
    assert await load_document_image(f"/uploads/vendor-signatures/{HEX}.png") is None
    storage.files[f"vendor-signatures/{HEX}.png"] = b"\x89PNG\r\n\x1a\n" + b"0" * (assets_mod.MAX_DOCUMENT_ASSET_BYTES + 1)
    assert await load_document_image(f"/uploads/vendor-signatures/{HEX}.png") is None            # too big
    assert await load_document_image(f"/uploads/vendor-signatures/{HEX}.png") is None


# ── FileService can't be walked out of uploads/ ──────────────────────────────

@pytest.mark.asyncio
async def test_file_service_refuses_traversal_for_read_and_delete(tmp_path, monkeypatch):
    import app.services.file_service as fs_mod

    root = tmp_path / "uploads"
    (root / "vendor-signatures").mkdir(parents=True)
    victim = tmp_path / "secret.txt"
    victim.write_text("keep me")
    inside = root / "vendor-signatures" / f"{HEX}.png"
    inside.write_bytes(_png())
    monkeypatch.setattr(fs_mod, "_LOCAL_UPLOAD_ROOT", root)
    svc = FileService()
    monkeypatch.setattr(svc, "_use_s3", False)

    for evil in ("../secret.txt", "vendor-signatures/../../secret.txt", "..\\secret.txt", "/../secret.txt"):
        assert await svc.read_bytes(evil) is None
        assert svc._local_delete(evil) is False
    assert await svc.read_bytes("https://x.example/a/../../secret.txt") is None
    assert await svc.delete_file("https://x.example/vendor-signatures/../../secret.txt") is False
    assert victim.read_text() == "keep me"

    assert await svc.read_bytes(f"vendor-signatures/{HEX}.png") == _png()
    assert await svc.delete_file(f"/uploads/vendor-signatures/{HEX}.png") is True
    assert not inside.exists()
    assert svc._local_delete(f"vendor-signatures/{HEX}.png") is False                            # already gone


# ── The real endpoint ────────────────────────────────────────────────────────

def _route(inv_id) -> str:
    return f"/api/v1/vendors/me/invoices/{inv_id}/pdf"


@pytest.fixture
def as_owner(test_vendor, test_user):
    app.dependency_overrides[get_current_vendor_user] = lambda: VendorUser(
        id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id, role="owner", permissions=[], is_active=True,
    )
    yield
    app.dependency_overrides.pop(get_current_vendor_user, None)


async def _make_invoice(db, vendor, **over) -> Invoice:
    values = dict(
        vendor_id=vendor.id, invoice_number="INV-2026-0001", invoice_type="invoice", document_type="tax_invoice",
        vendor_name="Route Traders", customer_name="Route Customer", is_gst=True,
        items=[{"name": "Gadget", "qty": 2, "rate": 500, "cgst_amt": 90, "sgst_amt": 90, "total": 1180}],
        subtotal=1000, taxable_amount=1000, cgst_amount=90, sgst_amount=90, total_tax=180, total=1180,
        amount_paid=0, balance_due=1180, status="sent",
    )
    values.update(over)
    inv = Invoice(**values)
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def _set_vendor_settings(db, vendor, settings, **cols):
    vendor.settings = settings
    for key, value in cols.items():
        setattr(vendor, key, value)
    await db.commit()


@pytest.mark.asyncio
async def test_endpoint_returns_a_pdf_using_saved_invoice_settings(client: AsyncClient, as_owner, db_session, test_vendor):
    await _set_vendor_settings(db_session, test_vendor, {
        "invoice_settings": {"signatory_name": "Invoice Signer", **BANK, "watermark": "PAID COPY"},
        "quotation_settings": {"signatory_name": "Quote Signer"},
    })
    inv = await _make_invoice(db_session, test_vendor)
    resp = await client.get(_route(inv.id))
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert 'filename="INV-2026-0001.pdf"' in resp.headers["content-disposition"]
    text = _flat(resp.content)
    assert "Invoice Signer" in text and "Quote Signer" not in text
    assert "Test Bank" in text and "PAID COPY" in text and "\u20b91,180.00" in text


@pytest.mark.asyncio
async def test_endpoint_quotation_uses_quotation_settings(client: AsyncClient, as_owner, db_session, test_vendor):
    await _set_vendor_settings(db_session, test_vendor, {
        "invoice_settings": {"signatory_name": "Invoice Signer"},
        "quotation_settings": {"signatory_name": "Quote Signer"},
    })
    inv = await _make_invoice(db_session, test_vendor, invoice_type="estimate", invoice_number="QT-0001")
    text = _flat((await client.get(_route(inv.id))).content)
    assert "QUOTATION" in text and "Quote Signer" in text and "Invoice Signer" not in text


@pytest.mark.asyncio
async def test_endpoint_pos_receipt_layers_pos_overrides(client: AsyncClient, as_owner, db_session, test_vendor):
    await _set_vendor_settings(db_session, test_vendor, {
        "invoice_settings": {"signatory_name": "Shop Signer", "watermark": "INVOICE"},
        "pos_receipt_settings": {"watermark": "POS RECEIPT"},
    })
    pos = await _make_invoice(db_session, test_vendor, invoice_number="POS-0001")
    normal = await _make_invoice(db_session, test_vendor, invoice_number="INV-0002")
    pos_text = _flat((await client.get(_route(pos.id))).content)
    normal_text = _flat((await client.get(_route(normal.id))).content)
    assert "POS RECEIPT" in pos_text and "Shop Signer" in pos_text
    assert "POS RECEIPT" not in normal_text and "INVOICE" in normal_text


@pytest.mark.asyncio
async def test_endpoint_works_for_a_vendor_with_no_saved_settings_and_cleans_the_filename(
    client: AsyncClient, as_owner, db_session, test_vendor,
):
    await _set_vendor_settings(db_session, test_vendor, None)
    inv = await _make_invoice(db_session, test_vendor, invoice_number='A/B "x";\r\nSet-Cookie: 1')
    resp = await client.get(_route(inv.id))
    assert resp.status_code == 200 and "TAX INVOICE" in _flat(resp.content)
    disposition = resp.headers["content-disposition"]
    assert "\n" not in disposition and "\r" not in disposition and "/" not in disposition.split("filename=")[1]


@pytest.mark.asyncio
async def test_endpoint_404_for_unknown_invoice(client: AsyncClient, as_owner):
    assert (await client.get(_route(uuid.uuid4()))).status_code == 404


@pytest.fixture
def captured_images(monkeypatch):
    """Record the image bytes the endpoint hands to the renderer."""
    seen = {}
    real = invoice_pdf_mod.generate_invoice_pdf

    def spy(invoice, settings, images, vendor):
        seen.update(images=dict(images), settings=settings, vendor=vendor)
        return real(invoice, settings, images, vendor)

    monkeypatch.setattr(invoice_pdf_mod, "generate_invoice_pdf", spy)
    return seen


@pytest.mark.asyncio
async def test_endpoint_loads_only_the_images_the_settings_turn_on(
    client: AsyncClient, as_owner, db_session, test_vendor, storage, captured_images,
):
    await _set_vendor_settings(db_session, test_vendor, {"invoice_settings": {
        "logo_url": f"/uploads/vendor-document-logos/{HEX}.png",
        "signature_url": f"/uploads/vendor-signatures/{HEX}.png",
        "qr_code_url": f"/uploads/vendor-qr-codes/{HEX}.png", "show_qr_code": False,
    }})
    inv = await _make_invoice(db_session, test_vendor)
    assert (await client.get(_route(inv.id))).status_code == 200
    assert set(captured_images["images"]) == {"logo", "signature"}                  # QR is off -> never read
    assert f"vendor-qr-codes/{HEX}.png" not in storage.reads

    storage.reads.clear()
    await _set_vendor_settings(db_session, test_vendor, {"invoice_settings": {
        **test_vendor.settings["invoice_settings"], "show_logo": False, "show_signature": False, "show_qr_code": True}})
    assert (await client.get(_route(inv.id))).status_code == 200
    assert set(captured_images["images"]) == {"qr"}
    assert storage.reads == [f"vendor-qr-codes/{HEX}.png"]


@pytest.mark.asyncio
async def test_endpoint_company_logo_fallback_rules(
    client: AsyncClient, as_owner, db_session, test_vendor, storage, captured_images,
):
    inv = await _make_invoice(db_session, test_vendor)
    # logo_url unset -> falls back to the company logo
    await _set_vendor_settings(db_session, test_vendor, {"invoice_settings": {}}, logo_url="/uploads/vendor-logos/company.png")
    await client.get(_route(inv.id))
    assert "logo" in captured_images["images"]
    # logo_url "" -> the vendor chose "no logo"; the company logo must not sneak back in
    await _set_vendor_settings(db_session, test_vendor, {"invoice_settings": {"logo_url": ""}})
    await client.get(_route(inv.id))
    assert "logo" not in captured_images["images"]
    # a hostile company-logo value is never read
    storage.reads.clear()
    await _set_vendor_settings(db_session, test_vendor, {"invoice_settings": {}}, logo_url="/uploads/vendor-logos/../../etc/passwd")
    assert (await client.get(_route(inv.id))).status_code == 200
    assert "logo" not in captured_images["images"] and storage.reads == []


@pytest.mark.asyncio
async def test_endpoint_never_reads_crafted_image_urls_from_settings(
    client: AsyncClient, as_owner, db_session, test_vendor, storage, captured_images,
):
    await _set_vendor_settings(db_session, test_vendor, {"invoice_settings": {
        "logo_url": "https://evil.example/x.png",
        "signature_url": "/uploads/vendor-signatures/../../../app/main.py",
        "qr_code_url": "http://169.254.169.254/latest/meta-data", "show_qr_code": True,
    }})
    inv = await _make_invoice(db_session, test_vendor)
    resp = await client.get(_route(inv.id))
    assert resp.status_code == 200 and "TAX INVOICE" in _flat(resp.content)
    assert captured_images["images"] == {} and storage.reads == []


@pytest.mark.asyncio
async def test_endpoint_survives_missing_files_and_corrupt_settings(
    client: AsyncClient, as_owner, db_session, test_vendor, storage,
):
    await _set_vendor_settings(db_session, test_vendor, {"invoice_settings": {
        "logo_url": f"/uploads/vendor-document-logos/{'f' * 32}.png",                   # valid name, file is gone
        "signature_url": f"/uploads/vendor-signatures/{HEX}.png",
    }})
    inv = await _make_invoice(db_session, test_vendor)
    storage.files[f"vendor-signatures/{HEX}.png"] = b"corrupt"
    assert (await client.get(_route(inv.id))).status_code == 200
    await _set_vendor_settings(db_session, test_vendor, {"invoice_settings": "not a dict", "quotation_settings": [1]})
    assert (await client.get(_route(inv.id))).status_code == 200
