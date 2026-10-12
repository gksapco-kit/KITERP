"""Server-side invoice / quotation PDF (ReportLab).

Used for the "Download PDF" endpoint and anything that needs a PDF without a browser.

What it follows from the vendor's saved template settings (``invoice_settings`` /
``quotation_settings`` / ``pos_receipt_settings``): brand colour, logo, signature, signatory name,
QR code, bank details, default notes / terms, every ``show_*`` toggle, tax / discount / total
labels, watermark, margins, orientation, font scale, and the order + visibility of the layout
sections.

What it does NOT reproduce: the ~30 distinct HTML template *designs* (classic, modern, ...),
custom ``template_pages_html`` pages, product thumbnails, or thermal paper sizes. The server PDF
always uses one clean A4 layout carrying the same data and branding. The browser export in the
vendor app remains the pixel-exact one.

This module is pure: it does no I/O. Settings and image bytes are passed in (see
``app.services.invoice_pdf`` for the code that loads them), which also keeps it easy to test.
"""
from __future__ import annotations

import io
import logging
import math
import re
import threading
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from xml.sax.saxutils import escape as _xml_escape

log = logging.getLogger(__name__)

# ─── Defaults (mirror vendor-web/src/lib/invoiceTemplates.ts) ────────────────

DEFAULT_COLOR = "#1a56db"
LAYOUT_SECTION_IDS = ["header", "meta", "items", "totals", "gst", "footer", "legal"]

DEFAULT_INVOICE_SETTINGS: Dict[str, Any] = {
    "color": DEFAULT_COLOR,
    "show_logo": True, "show_phone": True, "show_description": True, "show_hsn": True,
    "show_bank_details": True, "show_signature": True, "show_tax_breakdown": True,
    "show_notes": True, "show_terms": False, "show_gstin": True, "show_shipping_address": False,
    "show_place_of_supply": True, "show_item_numbers": False, "show_discount": False,
    "discount_display": "both", "discount_label": "Discount",
    "show_taxable_amount": False, "show_round_off": True, "show_amount_in_words": False,
    "show_tax_inclusive_note": False,
    "tax_label": "Tax", "cgst_label": "CGST", "sgst_label": "SGST", "igst_label": "IGST",
    "show_vendor_address": True, "show_customer_address": True,
    "watermark": "", "watermark_position": "diagonal", "watermark_size": "md",
    "pdf_margin": 5, "pdf_orientation": "portrait", "font_size_scale": "md",
    "show_qr_code": False, "qr_code_label": "Scan to Pay", "qr_code_position": "footer",
    "show_url": False,
    "show_customer_email": True, "show_financial_year": True, "show_due_date": True,
    "show_booking_number": True, "show_copy_label": True,
    "show_amount_paid": True, "show_balance_due": True,
    "show_legal_note": True, "show_payment_terms": True,
}

DEFAULT_QUOTATION_SETTINGS: Dict[str, Any] = {
    **DEFAULT_INVOICE_SETTINGS,
    "show_amount_paid": False,
    "show_balance_due": False,
    "show_terms": True,
    "show_payment_terms": False,
    "default_terms": "This quotation is valid until the date shown above. "
                     "Prices are subject to change after expiry.",
}


def is_pos_invoice(invoice) -> bool:
    """Same rule the vendor app uses to decide a document is a POS receipt."""
    notes = str(_attr(invoice, "notes") or "")
    number = str(_attr(invoice, "invoice_number") or "")
    return "POS Transaction" in notes or bool(re.match(r"^POS-", number, re.IGNORECASE))


def resolve_pdf_settings(
    stored: Optional[dict],
    pos: Optional[dict] = None,
    *,
    is_quotation: bool = False,
) -> Dict[str, Any]:
    """Defaults, then the vendor's saved settings, then (for POS receipts) the POS overrides."""
    merged = dict(DEFAULT_QUOTATION_SETTINGS if is_quotation else DEFAULT_INVOICE_SETTINGS)
    for layer in (stored, pos):
        if isinstance(layer, dict):
            merged.update({k: v for k, v in layer.items() if v is not None})
    return merged


# ─── Small helpers ───────────────────────────────────────────────────────────

_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def _attr(obj, key, default=""):
    """Get an attribute or dict key from an invoice model / dict."""
    if isinstance(obj, dict):
        value = obj.get(key, default)
        return default if value is None else value
    return getattr(obj, key, default) or default


def _num(value) -> float:
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    return n if math.isfinite(n) else 0.0


def _flag(settings: dict, key: str, default: bool = True) -> bool:
    value = settings.get(key, default)
    return value if isinstance(value, bool) else default


def _esc(value) -> str:
    """Make arbitrary user text safe for a ReportLab Paragraph (it parses XML-like markup)."""
    text = _CTRL_RE.sub("", str(value if value is not None else ""))
    return _xml_escape(text).replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br/>")


def _clip(value, limit: int) -> str:
    text = str(value or "")
    return text if len(text) <= limit else text[: limit - 1] + "\u2026"


def _group_indian(digits: str) -> str:
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    parts: List[str] = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return ",".join(parts + [tail])


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
         "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _under_100(n: int) -> str:
    return _ONES[n] if n < 20 else (_TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else ""))


def _int_words(n: int) -> str:
    """Indian numbering: crore / lakh / thousand."""
    if n == 0:
        return "Zero"
    parts: List[str] = []
    for div, name in ((10_000_000, "Crore"), (100_000, "Lakh"), (1_000, "Thousand"), (100, "Hundred")):
        if n >= div:
            quotient, n = divmod(n, div)
            parts.append(f"{_int_words(quotient)} {name}")
    if n:
        parts.append(_under_100(n))
    return " ".join(parts)


def amount_in_words(value) -> str:
    amount = round(abs(_num(value)), 2)
    rupees = int(amount)
    paise = int(round((amount - rupees) * 100))
    if rupees >= 10**12:
        return ""
    text = f"Indian Rupees {_int_words(rupees)}"
    if paise:
        text += f" and {_under_100(paise)} Paise"
    return text + " Only"


def _fmt_date(value) -> str:
    if not value:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%d %b %Y")
    try:
        return datetime.fromisoformat(str(value)).strftime("%d %b %Y")
    except ValueError:
        return str(value)


def _fmt_qty(value) -> str:
    n = _num(value)
    if n == int(n):
        return str(int(n))
    return f"{n:.3f}".rstrip("0").rstrip(".")


def _fmt_addr(addr) -> str:
    if isinstance(addr, str):
        return addr.strip()
    if not isinstance(addr, dict):
        return ""

    def pick(*keys):
        for key in keys:
            if addr.get(key):
                return str(addr[key]).strip()
        return ""

    parts = [
        pick("street", "line1", "address_line1", "address"),
        pick("line2", "address_line2", "area"),
        pick("city"), pick("state"), pick("postal_code", "pincode", "pin", "zip"),
    ]
    seen: List[str] = []
    for p in parts:
        if p and p not in seen:
            seen.append(p)
    return ", ".join(seen)


# ─── Fonts (bundled so the rupee sign renders on a server with no system fonts) ──

_FONT_DIR = Path(__file__).resolve().parents[1] / "assets" / "fonts"
_FONT_LOCK = threading.Lock()
_FONTS: Optional[Tuple[str, str, bool]] = None  # (regular, bold, has_rupee_glyph)


def _fonts() -> Tuple[str, str, bool]:
    global _FONTS
    if _FONTS is not None:
        return _FONTS
    with _FONT_LOCK:
        if _FONTS is not None:
            return _FONTS
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", str(_FONT_DIR / "DejaVuSans.ttf")))
            pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", str(_FONT_DIR / "DejaVuSans-Bold.ttf")))
            pdfmetrics.registerFontFamily(
                "DejaVuSans", normal="DejaVuSans", bold="DejaVuSans-Bold",
                italic="DejaVuSans", boldItalic="DejaVuSans-Bold",
            )
            _FONTS = ("DejaVuSans", "DejaVuSans-Bold", True)
        except Exception:  # noqa: BLE001
            log.exception("Bundled PDF font could not be loaded; using Helvetica (amounts print as 'Rs.')")
            _FONTS = ("Helvetica", "Helvetica-Bold", False)
    return _FONTS


def fmt_money(value) -> str:
    n = _num(value)
    whole, frac = f"{abs(n):.2f}".split(".")
    symbol = "\u20b9" if _fonts()[2] else "Rs. "
    return f"{'-' if n < 0 else ''}{symbol}{_group_indian(whole)}.{frac}"


# ─── Images ──────────────────────────────────────────────────────────────────

_MAX_IMAGE_PIXELS = 25_000_000


def _prepare_image(raw: Optional[bytes], max_px: int = 700) -> Optional[Tuple[bytes, float]]:
    """Decode with Pillow, bound the size, return ``(png_bytes, aspect_ratio)`` or None."""
    if not raw:
        return None
    try:
        from PIL import Image

        with Image.open(io.BytesIO(raw)) as im:
            if im.width * im.height > _MAX_IMAGE_PIXELS or im.width < 1 or im.height < 1:
                return None
            im = im.convert("RGBA")
            im.thumbnail((max_px, max_px))
            out = io.BytesIO()
            im.save(out, format="PNG")
            return out.getvalue(), im.width / im.height
    except Exception:  # noqa: BLE001
        log.warning("Skipping an image that could not be decoded for the PDF", exc_info=True)
        return None


# ─── Public entry point ──────────────────────────────────────────────────────

def generate_invoice_pdf(
    invoice,
    settings: Optional[dict] = None,
    images: Optional[Dict[str, bytes]] = None,
    vendor: Optional[dict] = None,
) -> bytes:
    """Return PDF bytes for *invoice* (SQLAlchemy model or dict-like object).

    ``settings``  resolved template settings (see :func:`resolve_pdf_settings`).
    ``images``    raw image bytes keyed ``logo`` / ``signature`` / ``qr`` (all optional).
    ``vendor``    ``{"business_name", "phone"}`` fallbacks for the header (all optional).
    """
    try:
        return _generate_styled_pdf(invoice, settings or {}, images or {}, vendor or {})
    except Exception:  # noqa: BLE001
        log.exception("Styled PDF generation failed; falling back to the plain PDF")
        return _generate_plain_pdf(invoice)


# ─── Styled ReportLab PDF ────────────────────────────────────────────────────

def _generate_styled_pdf(invoice, s: dict, images: Dict[str, bytes], vendor: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    font, font_bold, _ = _fonts()
    scale = {"sm": 0.9, "lg": 1.12}.get(str(s.get("font_size_scale")), 1.0)

    # Brand colour: only plain hex values are used (the settings allow CSS names / rgb() too).
    raw_color = str(s.get("color") or DEFAULT_COLOR).strip()
    BRAND = colors.HexColor(raw_color if _HEX_RE.match(raw_color) else DEFAULT_COLOR)
    luminance = 0.299 * BRAND.red + 0.587 * BRAND.green + 0.114 * BRAND.blue
    ON_BRAND = colors.black if luminance > 0.62 else colors.white
    LIGHT = colors.HexColor("#f8fafc")
    BORDER = colors.HexColor("#e5e7eb")
    GRAY = colors.HexColor("#6b7280")
    RED = colors.HexColor("#dc2626")
    GREEN = colors.HexColor("#059669")

    # Page geometry
    pagesize = landscape(A4) if s.get("pdf_orientation") == "landscape" else A4
    extra = min(max(_num(s.get("pdf_margin", 5)), 0), 30)
    side, vert = (8 + extra) * mm, (7 + extra) * mm
    # SimpleDocTemplate's frame pads 6pt on each side; size tables to the *inner* width so they
    # line up with paragraphs instead of poking out of the margin.
    W = pagesize[0] - 2 * side - 12

    is_quote = str(_attr(invoice, "invoice_type")).lower() == "estimate"
    inv_no = str(_attr(invoice, "invoice_number", "N/A"))
    business = str(_attr(invoice, "vendor_name") or vendor.get("business_name") or "")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=pagesize, leftMargin=side, rightMargin=side, topMargin=vert, bottomMargin=vert,
        title=_clip(f"{'Quotation' if is_quote else 'Invoice'} {inv_no}", 120),
        author=_clip(business, 120),
    )

    _cache: Dict[tuple, ParagraphStyle] = {}

    def P(text: str, size: float = 9, *, bold: bool = False, color=None, align: int = 0) -> Paragraph:
        """Paragraph from already-escaped markup."""
        key = (size, bold, str(color), align)
        style = _cache.get(key)
        if style is None:
            fs = size * scale
            style = _cache[key] = ParagraphStyle(
                f"s{len(_cache)}", fontName=font_bold if bold else font, fontSize=fs, leading=fs * 1.3,
                textColor=color or colors.black, alignment=align,
            )
        return Paragraph(text, style)

    def image(key: str, max_w: float, max_h: float):
        prepared = _prepare_image(images.get(key))
        if not prepared:
            return None
        png, aspect = prepared
        w, h = max_w, max_w / aspect
        if h > max_h:
            w, h = max_h * aspect, max_h
        return Image(io.BytesIO(png), width=w, height=h)

    # ── Data ──────────────────────────────────────────────────────────────────
    doc_type = str(_attr(invoice, "document_type") or "tax_invoice")
    raw_gst = invoice.get("is_gst") if isinstance(invoice, dict) else getattr(invoice, "is_gst", None)
    is_gst = True if raw_gst is None else bool(raw_gst)  # _attr() would turn False into the default
    kind = str(_attr(invoice, "invoice_type") or "invoice").lower()
    if is_quote:
        title = "QUOTATION"
    elif kind == "credit_note":
        title = "CREDIT NOTE"
    elif kind == "receipt":
        title = "RECEIPT"
    elif doc_type == "bill_of_supply":
        title = "BILL OF SUPPLY"
    elif is_gst:
        title = "TAX INVOICE"
    else:
        title = "INVOICE"

    gstin = _attr(invoice, "vendor_gstin")
    pan = _attr(invoice, "vendor_pan")
    website = str(s.get("website_url") or "").strip() if _flag(s, "show_url", False) else ""
    items = _attr(invoice, "items") or []
    items = [it for it in items if isinstance(it, dict)] if isinstance(items, list) else []

    disc = _num(_attr(invoice, "discount_amount"))
    cgst, sgst, igst = (_num(_attr(invoice, k)) for k in ("cgst_amount", "sgst_amount", "igst_amount"))
    total_tax = _num(_attr(invoice, "total_tax")) or (cgst + sgst + igst)
    total = _num(_attr(invoice, "total"))
    paid, balance = _num(_attr(invoice, "amount_paid")), _num(_attr(invoice, "balance_due"))
    rnd = _num(_attr(invoice, "round_off"))

    def qr_block(max_size: float):
        if not _flag(s, "show_qr_code", False):
            return []
        img = image("qr", max_size, max_size)
        if img is None:
            return []
        out = [img]
        label = str(s.get("qr_code_label") or "").strip()
        if label:
            out.append(P(_esc(_clip(label, 80)), 7.5, color=GRAY, align=1))
        return out

    # ── Sections ──────────────────────────────────────────────────────────────
    def header():
        left: list = []
        if _flag(s, "show_logo"):
            logo = image("logo", 38 * mm, 18 * mm)
            if logo is not None:
                logo.hAlign = "LEFT"
                left.append(logo)
                left.append(Spacer(1, 1.5 * mm))
        left.append(P(f"<b>{_esc(business)}</b>", 12, bold=True))
        if _flag(s, "show_vendor_address"):
            addr = _fmt_addr(_attr(invoice, "vendor_address", {}))
            if addr:
                left.append(P(_esc(addr), 8, color=GRAY))
        if _flag(s, "show_gstin") and gstin:
            left.append(P(f"GSTIN: {_esc(gstin)}", 8, color=GRAY))
        if pan:
            left.append(P(f"PAN: {_esc(pan)}", 8, color=GRAY))
        if _flag(s, "show_phone") and vendor.get("phone"):
            left.append(P(f"Phone: {_esc(vendor['phone'])}", 8, color=GRAY))
        if website:
            left.append(P(_esc(_clip(website, 120)), 8, color=GRAY))

        right: list = [P(f"<b>{title}</b>", 16, bold=True, color=BRAND, align=2),
                       P(f"<b>{_esc(inv_no)}</b>", 10, bold=True, align=2)]
        if _flag(s, "show_copy_label") and not is_quote:
            right.append(P("ORIGINAL FOR RECIPIENT", 7, color=GRAY, align=2))
        if s.get("qr_code_position") == "header":
            for f in qr_block(22 * mm):
                right.append(f)

        tbl = Table([[left, right]], colWidths=[W * 0.58, W * 0.42])
        tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, 0), 1, BRAND),
        ]))
        return [tbl, Spacer(1, 4 * mm)]

    def meta():
        left: list = []
        if _flag(s, "show_customer_address"):
            bill = [P("BILL TO", 7.5, bold=True, color=GRAY)]
            if _attr(invoice, "customer_name"):
                bill.append(P(f"<b>{_esc(_attr(invoice, 'customer_name'))}</b>", 10, bold=True))
            addr = _fmt_addr(_attr(invoice, "billing_address", {}))
            if addr:
                bill.append(P(_esc(addr), 8, color=GRAY))
            if _attr(invoice, "customer_phone"):
                bill.append(P(_esc(_attr(invoice, "customer_phone")), 8, color=GRAY))
            if _flag(s, "show_customer_email") and _attr(invoice, "customer_email"):
                bill.append(P(_esc(_attr(invoice, "customer_email")), 8, color=GRAY))
            if _flag(s, "show_gstin") and _attr(invoice, "customer_gstin"):
                bill.append(P(f"GSTIN: {_esc(_attr(invoice, 'customer_gstin'))}", 8, color=GRAY))
            left.extend(bill)
        ship = _fmt_addr(_attr(invoice, "shipping_address", {})) if _flag(s, "show_shipping_address", False) else ""
        if ship:
            left.append(Spacer(1, 2 * mm))
            left.append(P("SHIP TO", 7.5, bold=True, color=GRAY))
            left.append(P(_esc(ship), 8, color=GRAY))

        rows: List[list] = []

        def row(label: str, value) -> None:
            if value:
                rows.append([P(_esc(label), 8, color=GRAY), P(f"<b>{_esc(value)}</b>", 8.5, bold=True, align=2)])

        row("Date", _fmt_date(_attr(invoice, "created_at")))
        if _flag(s, "show_due_date"):
            row("Valid until" if is_quote else "Due date", _fmt_date(_attr(invoice, "due_date")))
        if _flag(s, "show_financial_year"):
            row("F.Y.", _attr(invoice, "financial_year"))
        if _flag(s, "show_booking_number"):
            row("Booking ref", _attr(invoice, "booking_number"))
        row("Order ref", _attr(invoice, "order_number"))
        for extra_field in _attr(invoice, "extra_fields", []) or []:
            if not isinstance(extra_field, dict) or extra_field.get("type") == "image":
                continue
            value = extra_field.get("value") or ", ".join(map(str, extra_field.get("values") or []))
            row(_clip(extra_field.get("label"), 60), _clip(value, 200))

        right: Any = ""
        if rows:
            right = Table(rows, colWidths=[W * 0.2, W * 0.28])
            right.setStyle(TableStyle([
                ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]))
        if not left and not rows:
            return []
        tbl = Table([[left or "", right]], colWidths=[W * 0.5, W * 0.5])
        tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (0, 0), (0, 0), LIGHT), ("BOX", (0, 0), (0, 0), 0.5, BORDER),
        ]))
        return [tbl, Spacer(1, 4 * mm)]

    def items_table():
        def item_tax(it) -> float:
            return sum(_num(it.get(k)) for k in ("cgst_amt", "sgst_amt", "igst_amt"))

        has_tax = any(item_tax(it) > 0 for it in items)
        has_hsn = _flag(s, "show_hsn") and any(it.get("hsn_sac") for it in items)
        show_disc = _flag(s, "show_discount", False) and s.get("discount_display", "both") in ("column", "both")

        cols: List[Tuple[str, str, float, int]] = []  # key, header, weight, align
        if _flag(s, "show_item_numbers", False):
            cols.append(("no", "#", 0.05, 0))
        cols.append(("name", "Item", 0.30, 0))
        if has_hsn:
            cols.append(("hsn", "HSN/SAC", 0.12, 0))
        cols += [("qty", "Qty", 0.07, 2), ("rate", "Rate", 0.14, 2)]
        if show_disc:
            cols.append(("disc", "Discount", 0.12, 2))
        if has_tax:
            cols.append(("tax", "Tax", 0.14, 2))
        cols.append(("amount", "Amount", 0.16, 2))
        weight = sum(c[2] for c in cols)
        widths = [W * c[2] / weight for c in cols]

        head = [P(f"<b>{h}</b>", 8.5, bold=True, color=ON_BRAND, align=a) for _, h, _, a in cols]
        rows = [head]
        for idx, it in enumerate(items, 1):
            qty = _num(it.get("qty", it.get("quantity")))
            rate = _num(it.get("rate", it.get("price")))
            name = _clip(it.get("name") or it.get("description") or "Item", 300)
            cell_name: list = [P(_esc(name), 8.5)]
            if _flag(s, "show_description") and it.get("description") and it.get("name"):
                cell_name.append(P(_esc(_clip(it["description"], 300)), 7.5, color=GRAY))
            values = {
                "no": P(str(idx), 8.5),
                "name": cell_name,
                "hsn": P(_esc(it.get("hsn_sac") or ""), 8.5),
                "qty": P(_fmt_qty(qty), 8.5, align=2),
                "rate": P(fmt_money(rate), 8.5, align=2),
                "disc": P(fmt_money(it.get("discount")) if _num(it.get("discount")) else "-", 8.5, align=2),
                "tax": P(fmt_money(item_tax(it)) if item_tax(it) else "-", 8.5, align=2),
                "amount": P(fmt_money(it.get("total", qty * rate)), 8.5, bold=True, align=2),
            }
            rows.append([values[k] for k, _, _, _ in cols])

        tbl = Table(rows, colWidths=widths, repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        return [tbl, Spacer(1, 3 * mm)]

    def totals():
        rows: List[list] = []
        total_row = [0]

        def add(label: str, value: str, *, bold=False, color=None) -> None:
            rows.append([P(_esc(label), 9, bold=bold, color=color), P(value, 9, bold=bold, color=color, align=2)])

        add("Subtotal", fmt_money(_attr(invoice, "subtotal")))
        if disc > 0 and s.get("discount_display", "both") in ("summary", "both"):
            add(str(s.get("discount_label") or "Discount"), f"-{fmt_money(disc)}", color=RED)
        if _flag(s, "show_taxable_amount", False):
            add("Taxable amount", fmt_money(_attr(invoice, "taxable_amount")))
        if _flag(s, "show_tax_breakdown") and (cgst or sgst or igst):
            for label_key, default, amount in (("cgst_label", "CGST", cgst), ("sgst_label", "SGST", sgst),
                                               ("igst_label", "IGST", igst)):
                if amount > 0:
                    add(str(s.get(label_key) or default), fmt_money(amount))
        elif total_tax > 0:
            add(str(s.get("tax_label") or "Tax"), fmt_money(total_tax))
        if _flag(s, "show_round_off") and abs(rnd) > 0.001:
            add("Round off", fmt_money(rnd))
        total_row[0] = len(rows)
        add("Total", fmt_money(total), bold=True)
        if _flag(s, "show_amount_paid") and paid > 0:
            add("Amount paid", fmt_money(paid), color=GREEN)
        if _flag(s, "show_balance_due") and balance > 0:
            add("Balance due", fmt_money(balance), bold=True, color=RED)

        col = W * 0.40
        tbl = Table(rows, colWidths=[col * 0.5, col * 0.5])
        tbl.setStyle(TableStyle([
            ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LINEABOVE", (0, total_row[0]), (-1, total_row[0]), 1, colors.black),
        ]))
        wrap = Table([["", tbl]], colWidths=[W - col, col])
        wrap.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        out: list = [wrap]
        if _flag(s, "show_amount_in_words", False):
            words = amount_in_words(total)
            if words:
                out += [Spacer(1, 2 * mm), P(f"<b>Amount in words:</b> {_esc(words)}", 8.5)]
        if _flag(s, "show_tax_inclusive_note", False):
            out += [Spacer(1, 1 * mm), P("All prices are inclusive of applicable taxes.", 7.5, color=GRAY)]
        out.append(Spacer(1, 3 * mm))
        return out

    def gst_info():
        lines: List[str] = []
        pos_text = _attr(invoice, "place_of_supply")
        if _flag(s, "show_place_of_supply") and pos_text:
            lines.append(f"<b>Place of supply:</b> {_esc(pos_text)}")
        if _flag(s, "show_payment_terms"):
            terms = _attr(invoice, "payment_terms") or s.get("default_payment_terms")
            if terms:
                lines.append(f"<b>Payment terms:</b> {_esc(_clip(terms, 200))}")
        if not lines:
            return []
        return [P("<br/>".join(lines), 8.5), Spacer(1, 3 * mm)]

    def footer():
        out: list = []

        left: list = []
        bank = [
            ("Account name", s.get("account_holder_name")), ("Bank", s.get("bank_name")),
            ("Account no.", s.get("account_number")), ("IFSC", s.get("ifsc_code")), ("UPI", s.get("upi_id")),
        ]
        bank = [(label, str(v).strip()) for label, v in bank if v and str(v).strip()]
        if _flag(s, "show_bank_details") and bank:
            left.append(P("BANK DETAILS", 7.5, bold=True, color=GRAY))
            left.extend(P(f"{_esc(label)}: <b>{_esc(_clip(v, 120))}</b>", 8.5) for label, v in bank)

        right: list = []
        if s.get("qr_code_position") != "header":
            right.extend(qr_block(24 * mm))
        if _flag(s, "show_signature"):
            sig = image("signature", 42 * mm, 16 * mm)
            if right:
                right.append(Spacer(1, 3 * mm))
            right.append(sig if sig is not None else Spacer(1, 14 * mm))
            right.append(HRFlowable(width=45 * mm, thickness=0.5, color=GRAY, hAlign="RIGHT"))
            who = str(s.get("signatory_name") or "").strip()
            if who:
                right.append(P(f"<b>{_esc(_clip(who, 80))}</b>", 8.5, bold=True, align=2))
            right.append(P("Authorised signatory", 7.5, color=GRAY, align=2))
            if sig is not None:
                sig.hAlign = "RIGHT"

        if left or right:
            tbl = Table([[left or "", right or ""]], colWidths=[W * 0.55, W * 0.45])
            tbl.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]))
            out += [tbl, Spacer(1, 3 * mm)]

        def text_block(heading: str, text) -> None:
            text = str(text or "").strip()
            if text:
                out.extend([P(f"<b>{heading}</b>", 8.5, bold=True),
                            P(_esc(_clip(text, 5000)), 8, color=GRAY), Spacer(1, 2 * mm)])

        if _flag(s, "show_notes"):
            text_block("Notes", _attr(invoice, "notes") or s.get("default_notes"))
        if _flag(s, "show_terms"):
            text_block("Terms & conditions", _attr(invoice, "terms_and_conditions") or s.get("default_terms"))
        return out

    def legal():
        if not _flag(s, "show_legal_note"):
            return []
        if is_quote:
            text = "Computer generated quotation."
        elif doc_type == "tax_invoice" and is_gst:
            text = "Computer generated invoice. No signature required. This is a valid tax invoice."
        else:
            text = "Computer generated invoice."
        return [HRFlowable(width=W, thickness=0.5, color=BORDER), Spacer(1, 2 * mm),
                P(text, 7.5, color=GRAY, align=1)]

    builders = {"header": header, "meta": meta, "items": items_table, "totals": totals,
                "gst": gst_info, "footer": footer, "legal": legal}

    # Order + visibility from the saved layout; sections missing from it stay visible, at the end.
    order: List[str] = []
    mentioned: set = set()
    saved = s.get("layout_sections")
    for sec in saved if isinstance(saved, list) else []:
        sid = sec.get("id") if isinstance(sec, dict) else None
        if sid in builders and sid not in mentioned:
            mentioned.add(sid)
            if sec.get("visible", True) is not False:
                order.append(sid)
    order += [sid for sid in LAYOUT_SECTION_IDS if sid not in mentioned]

    story: list = []
    for sid in order:
        story.extend(builders[sid]())

    # ── Watermark ─────────────────────────────────────────────────────────────
    stamp = _clip(str(s.get("watermark") or "").strip(), 40)

    def on_page(canvas, document):
        if not stamp:
            return
        position = s.get("watermark_position", "diagonal")
        sizes = {"sm": (40, 14), "md": (64, 22), "lg": (96, 32)}[
            s.get("watermark_size") if s.get("watermark_size") in ("sm", "md", "lg") else "md"
        ]
        default_alpha = 0.07 if position == "diagonal" else 0.15
        alpha = min(max(_num(s.get("watermark_opacity", default_alpha)), 0.0), 1.0)
        pw, ph = document.pagesize
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#111827"))
        canvas.setFillAlpha(alpha)
        if position == "diagonal":
            canvas.setFont(font_bold, sizes[0])
            canvas.translate(pw / 2, ph / 2)
            canvas.rotate(45)
            canvas.drawCentredString(0, 0, stamp)
        else:
            canvas.setFont(font_bold, sizes[1])
            y = ph - vert + 2 * mm if position == "top" else vert - 6 * mm
            canvas.drawCentredString(pw / 2, y, stamp)
        canvas.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()


# ─── Plain-text fallback ─────────────────────────────────────────────────────

def _generate_plain_pdf(invoice) -> bytes:
    """Minimal valid PDF produced with zero dependencies."""
    inv_no = _attr(invoice, "invoice_number", "N/A")
    total = _attr(invoice, "total", 0)
    status = _attr(invoice, "status", "draft")
    bk_no = _attr(invoice, "booking_number")
    ord_no = _attr(invoice, "order_number") or _attr(invoice, "order_id")

    lines = [f"INVOICE: {inv_no}", f"Status: {status}", f"Total: Rs. {_num(total):.2f}", ""]
    if bk_no:
        lines.insert(2, f"Booking: {bk_no}")
    if ord_no:
        lines.insert(2, f"Order: {ord_no}")

    for it in (_attr(invoice, "items") or []):
        if isinstance(it, dict):
            lines.append(f"  {it.get('name', 'Item')} x{it.get('qty', 1)} @ Rs.{it.get('rate', 0)}")

    def _pdf_esc(t: str) -> bytes:
        return t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").encode("latin-1", "replace")

    stream = (b"BT\n/F1 10 Tf\n36 800 Td\n13 TL\n"
              + b"".join(b"(" + _pdf_esc(line) + b") '\n" for line in lines)
              + b"ET\n")
    sl = len(stream)

    pdf = bytearray(b"%PDF-1.4\n")
    offs = []

    offs.append(len(pdf)); pdf += b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    offs.append(len(pdf)); pdf += b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    offs.append(len(pdf)); pdf += (
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]"
        b"/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>" + b">>" * 3 + b"endobj\n"
    )
    offs.append(len(pdf)); pdf += f"4 0 obj<</Length {sl}>>stream\n".encode(); pdf += stream; pdf += b"endstream\nendobj\n"
    offs.append(len(pdf)); pdf += b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Courier>>endobj\n"

    xref = len(pdf)
    pdf += b"xref\n" + f"0 {len(offs) + 1}\n".encode() + b"0000000000 65535 f \n"
    for o in offs:
        pdf += f"{o:010d} 00000 n \n".encode()
    pdf += b"trailer\n" + f"<</Size {len(offs) + 1}/Root 1 0 R>>\n".encode()
    pdf += b"startxref\n" + f"{xref}\n".encode() + b"%%EOF\n"
    return bytes(pdf)
