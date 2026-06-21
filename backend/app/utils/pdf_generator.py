"""Styled invoice PDF generator using ReportLab.

Produces a clean, professionally styled A4 PDF that mirrors the
frontend invoice templates.  Falls back to a plain-text PDF if
ReportLab is not installed.
"""

import io
import logging
from datetime import datetime

log = logging.getLogger(__name__)


# ─── Public entry point ───────────────────────────────────────────────────────

def generate_invoice_pdf(invoice) -> bytes:
    """Return PDF bytes for *invoice* (SQLAlchemy model or dict-like object)."""
    try:
        return _generate_styled_pdf(invoice)
    except Exception as exc:  # noqa: BLE001
        log.warning("Styled PDF generation failed (%s); falling back to plain PDF", exc)
        return _generate_plain_pdf(invoice)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _attr(obj, key, default=""):
    """Get attribute or dict key from an invoice model / dict."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default) or default


def _fmt_currency(value) -> str:
    try:
        n = float(value or 0)
        return f"\u20b9{n:,.2f}"
    except (TypeError, ValueError):
        return "\u20b90.00"


def _fmt_date(value) -> str:
    if not value:
        return ""
    if isinstance(value, (datetime,)):
        return value.strftime("%d %b %Y")
    try:
        return datetime.fromisoformat(str(value)).strftime("%d %b %Y")
    except Exception:  # noqa: BLE001
        return str(value)


# ─── Styled ReportLab PDF ─────────────────────────────────────────────────────

def _generate_styled_pdf(invoice) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )

    W = A4[0] - 30 * mm  # usable width

    styles = getSampleStyleSheet()
    normal   = styles["Normal"]
    normal.fontSize = 9

    def S(name, **kw):
        base = kw.pop("parent", "Normal")
        return ParagraphStyle(name, parent=styles[base], **kw)

    heading  = S("heading",  fontSize=18, fontName="Helvetica-Bold", textColor=colors.HexColor("#1a56db"))
    subhead  = S("subhead",  fontSize=10, fontName="Helvetica-Bold")
    small    = S("small",    fontSize=8,  textColor=colors.HexColor("#6b7280"))
    monoSm   = S("monoSm",  fontSize=9,  fontName="Courier")
    bold9    = S("bold9",    fontSize=9,  fontName="Helvetica-Bold")
    right9   = S("right9",  fontSize=9,  alignment=2)
    rightB9  = S("rightB9", fontSize=9,  fontName="Helvetica-Bold", alignment=2)

    BRAND   = colors.HexColor("#1a56db")
    LIGHT   = colors.HexColor("#f8fafc")
    BORDER  = colors.HexColor("#e5e7eb")
    GRAY    = colors.HexColor("#6b7280")
    RED     = colors.HexColor("#dc2626")
    GREEN   = colors.HexColor("#059669")

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    inv_no   = _attr(invoice, "invoice_number", "N/A")
    vendor   = _attr(invoice, "vendor_name")
    gstin    = _attr(invoice, "vendor_gstin")
    v_addr   = _attr(invoice, "vendor_address") or {}
    addr_str = ", ".join(filter(None, [
        v_addr.get("street") if isinstance(v_addr, dict) else "",
        v_addr.get("city") if isinstance(v_addr, dict) else "",
        v_addr.get("state") if isinstance(v_addr, dict) else "",
        v_addr.get("postal_code") if isinstance(v_addr, dict) else "",
    ]))

    inv_type  = (_attr(invoice, "invoice_type") or "invoice").upper().replace("_", " ")
    created   = _fmt_date(_attr(invoice, "created_at"))
    due       = _fmt_date(_attr(invoice, "due_date"))
    fy        = _attr(invoice, "financial_year")
    bk_no     = _attr(invoice, "booking_number")
    order_no  = _attr(invoice, "order_number") or _attr(invoice, "order_id")

    header_data = [
        [
            Paragraph(f"<b>{vendor}</b>", subhead),
            Paragraph(f"<b>{inv_type}</b>", ParagraphStyle("ht", fontSize=16, fontName="Helvetica-Bold", textColor=BRAND, alignment=2)),
        ],
        [
            Paragraph(f"GSTIN: {gstin}" if gstin else "", small),
            Paragraph(f"<b>{inv_no}</b>", monoSm),
        ],
        [
            Paragraph(addr_str, small),
            Paragraph(f"Date: {created}", small),
        ],
    ]
    if due:
        header_data.append(["", Paragraph(f"Due: {due}", small)])
    if fy:
        header_data.append(["", Paragraph(f"F.Y.: {fy}", small)])
    if bk_no:
        header_data.append(["", Paragraph(f"Booking Ref: {bk_no}", small)])
    if order_no:
        header_data.append(["", Paragraph(f"Order Ref: {order_no}", small)])

    header_tbl = Table(header_data, colWidths=[W * 0.55, W * 0.45])
    header_tbl.setStyle(TableStyle([
        ("ALIGN",       (1, 0), (1, -1), "RIGHT"),
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING",    (0, 0), (-1, -1), 2),
        ("LINEBELOW",   (0, -1), (-1, -1), 0.8, BRAND),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 6 * mm))

    # ── Bill To ───────────────────────────────────────────────────────────────
    cust_name  = _attr(invoice, "customer_name")
    cust_email = _attr(invoice, "customer_email")
    cust_phone = _attr(invoice, "customer_phone")
    cust_gstin = _attr(invoice, "customer_gstin")

    bill_items = [Paragraph("BILL TO", S("bt", fontSize=8, textColor=GRAY, fontName="Helvetica-Bold"))]
    if cust_name:
        bill_items.append(Paragraph(f"<b>{cust_name}</b>", subhead))
    if cust_phone:
        bill_items.append(Paragraph(cust_phone, small))
    if cust_email:
        bill_items.append(Paragraph(cust_email, small))
    if cust_gstin:
        bill_items.append(Paragraph(f"GSTIN: {cust_gstin}", small))

    bill_tbl = Table([[col] for col in bill_items], colWidths=[W * 0.5])
    bill_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX",        (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    story.append(bill_tbl)
    story.append(Spacer(1, 5 * mm))

    # ── Items Table ───────────────────────────────────────────────────────────
    raw_items = _attr(invoice, "items") or []
    if not isinstance(raw_items, list):
        raw_items = []

    col_header = ["#", "Item", "Qty", "Rate", "Tax", "Amount"]
    col_w = [W * 0.05, W * 0.38, W * 0.08, W * 0.15, W * 0.12, W * 0.16]

    item_rows = [
        [Paragraph(f"<b>{h}</b>", S(f"ch{i}", fontSize=9, fontName="Helvetica-Bold",
                                     textColor=colors.white,
                                     alignment=(2 if i >= 2 else 0)))
         for i, h in enumerate(col_header)]
    ]

    for idx, it in enumerate(raw_items, 1):
        if isinstance(it, dict):
            name  = it.get("name") or it.get("description") or "Item"
            qty   = float(it.get("qty") or it.get("quantity") or 0)
            rate  = float(it.get("rate") or it.get("price") or 0)
            tax   = float(it.get("cgst_amt", 0)) + float(it.get("sgst_amt", 0)) + float(it.get("igst_amt", 0))
            total = float(it.get("total") or qty * rate)
        else:
            name, qty, rate, tax, total = "Item", 0, 0, 0, 0

        row = [
            Paragraph(str(idx), S(f"r{idx}0", fontSize=9)),
            Paragraph(name, S(f"r{idx}1", fontSize=9)),
            Paragraph(str(int(qty)), S(f"r{idx}2", fontSize=9, alignment=2)),
            Paragraph(_fmt_currency(rate), S(f"r{idx}3", fontSize=9, alignment=2)),
            Paragraph(_fmt_currency(tax) if tax else "-", S(f"r{idx}4", fontSize=9, alignment=2)),
            Paragraph(_fmt_currency(total), S(f"r{idx}5", fontSize=9, fontName="Helvetica-Bold", alignment=2)),
        ]
        item_rows.append(row)

    items_tbl = Table(item_rows, colWidths=col_w, repeatRows=1)
    ts = TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("ALIGN",         (2, 0), (-1, -1), "RIGHT"),
        ("GRID",          (0, 0), (-1, -1), 0.3, BORDER),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, LIGHT]),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
    ])
    items_tbl.setStyle(ts)
    story.append(items_tbl)
    story.append(Spacer(1, 4 * mm))

    # ── Totals ────────────────────────────────────────────────────────────────
    sub   = float(_attr(invoice, "subtotal") or 0)
    disc  = float(_attr(invoice, "discount_amount") or 0)
    cgst  = float(_attr(invoice, "cgst_amount") or 0)
    sgst  = float(_attr(invoice, "sgst_amount") or 0)
    igst  = float(_attr(invoice, "igst_amount") or 0)
    ttax  = float(_attr(invoice, "total_tax") or 0)
    rnd   = float(_attr(invoice, "round_off") or 0)
    total = float(_attr(invoice, "total") or 0)
    paid  = float(_attr(invoice, "amount_paid") or 0)
    bal   = float(_attr(invoice, "balance_due") or 0)

    def tot_row(label, value, bold=False, color=None):
        lp = ParagraphStyle("tl", fontSize=9, textColor=color or colors.black,
                             fontName="Helvetica-Bold" if bold else "Helvetica")
        rp = ParagraphStyle("tr", fontSize=9, textColor=color or colors.black,
                             fontName="Helvetica-Bold" if bold else "Helvetica", alignment=2)
        return [Paragraph(label, lp), Paragraph(value, rp)]

    tot_rows = [tot_row("Subtotal", _fmt_currency(sub))]
    if disc > 0:
        tot_rows.append(tot_row("Discount", f"-{_fmt_currency(disc)}", color=RED))
    if cgst > 0:
        tot_rows.append(tot_row("CGST", _fmt_currency(cgst)))
    if sgst > 0:
        tot_rows.append(tot_row("SGST", _fmt_currency(sgst)))
    if igst > 0:
        tot_rows.append(tot_row("IGST", _fmt_currency(igst)))
    if ttax > 0 and not (cgst or sgst or igst):
        tot_rows.append(tot_row("Tax", _fmt_currency(ttax)))
    if abs(rnd) > 0.001:
        tot_rows.append(tot_row("Round Off", _fmt_currency(rnd)))
    tot_rows.append(tot_row("Total", _fmt_currency(total), bold=True))
    if paid > 0:
        tot_rows.append(tot_row("Amount Paid", _fmt_currency(paid), color=GREEN))
    if bal > 0:
        tot_rows.append(tot_row("Balance Due", _fmt_currency(bal), bold=True, color=RED))

    tot_col = W * 0.28
    tot_tbl = Table(tot_rows, colWidths=[tot_col * 0.55, tot_col * 0.45])
    tot_tbl.setStyle(TableStyle([
        ("ALIGN",         (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE",     (0, -1 - (1 if bal > 0 else 0) - (1 if paid > 0 else 0)),
                          (-1, -1 - (1 if bal > 0 else 0) - (1 if paid > 0 else 0)), 1, colors.black),
    ]))

    wrapper = Table([[Spacer(1, 1), tot_tbl]], colWidths=[W - tot_col, tot_col])
    wrapper.setStyle(TableStyle([("ALIGN", (1, 0), (1, 0), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(wrapper)
    story.append(Spacer(1, 4 * mm))

    # ── Notes ─────────────────────────────────────────────────────────────────
    notes = _attr(invoice, "notes")
    if notes:
        story.append(HRFlowable(width=W, thickness=0.5, color=BORDER))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("<b>Notes</b>", bold9))
        story.append(Paragraph(str(notes), small))
        story.append(Spacer(1, 2 * mm))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width=W, thickness=0.5, color=BORDER))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "Computer generated invoice. No signature required. This is a valid tax invoice.",
        S("footer", fontSize=8, textColor=GRAY, alignment=1),
    ))

    doc.build(story)
    return buf.getvalue()


# ─── Plain-text fallback ──────────────────────────────────────────────────────

def _generate_plain_pdf(invoice) -> bytes:
    """Minimal valid PDF produced with zero dependencies."""
    inv_no = _attr(invoice, "invoice_number", "N/A")
    total  = _attr(invoice, "total", 0)
    status = _attr(invoice, "status", "draft")
    bk_no  = _attr(invoice, "booking_number")
    ord_no = _attr(invoice, "order_number") or _attr(invoice, "order_id")

    lines = [f"INVOICE: {inv_no}", f"Status: {status}", f"Total: Rs. {float(total or 0):.2f}", ""]
    if bk_no:
        lines.insert(2, f"Booking: {bk_no}")
    if ord_no:
        lines.insert(2, f"Order: {ord_no}")

    for it in (_attr(invoice, "items") or []):
        if isinstance(it, dict):
            lines.append(f"  {it.get('name','Item')} x{it.get('qty',1)} @ Rs.{it.get('rate',0)}")

    def _esc(t: str) -> bytes:
        return t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").encode("latin-1", "replace")

    stream = (b"BT\n/F1 10 Tf\n36 800 Td\n13 TL\n"
              + b"".join(b"(" + _esc(l) + b") '\n" for l in lines)
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
    pdf += b"xref\n" + f"0 {len(offs)+1}\n".encode() + b"0000000000 65535 f \n"
    for o in offs:
        pdf += f"{o:010d} 00000 n \n".encode()
    pdf += b"trailer\n" + f"<</Size {len(offs)+1}/Root 1 0 R>>\n".encode()
    pdf += b"startxref\n" + f"{xref}\n".encode() + b"%%EOF\n"
    return bytes(pdf)
