"""QR / barcode labels for assets (reportlab only — no extra dependency).

The QR encodes ``KITAM:<asset_tag>`` so a phone scan opens the asset, and a Code 128 barcode of the plain tag is
printed beneath it for handheld barcode scanners. Both resolve through ``assets.lookup_asset``.
"""
from __future__ import annotations

import io
from typing import Sequence

from reportlab.graphics import renderPDF, renderSVG
from reportlab.graphics.barcode import code128
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.models.asset_mgmt import AmAsset
from app.services.asset_mgmt.assets import QR_PREFIX

# name -> (label width mm, label height mm)
LABEL_SIZES = {"small": (50, 25), "medium": (70, 35), "large": (100, 50)}


def qr_payload(asset: AmAsset) -> str:
    return f"{QR_PREFIX}{asset.asset_tag}"


def _qr_drawing(data: str, size_pt: float) -> Drawing:
    widget = QrCodeWidget(data, barLevel="M")
    x0, y0, x1, y1 = widget.getBounds()
    w, h = x1 - x0, y1 - y0
    d = Drawing(size_pt, size_pt, transform=[size_pt / w, 0, 0, size_pt / h, 0, 0])
    d.add(widget)
    return d


def qr_svg(asset: AmAsset, size_px: int = 256) -> str:
    return renderSVG.drawToString(_qr_drawing(qr_payload(asset), size_px))


def _fit_text(c: canvas.Canvas, text: str, font: str, size: float, max_w: float) -> str:
    if c.stringWidth(text, font, size) <= max_w:
        return text
    while text and c.stringWidth(text + "…", font, size) > max_w:
        text = text[:-1]
    return text + "…"


def labels_pdf(assets: Sequence[AmAsset], *, size: str = "medium", company: str | None = None) -> bytes:
    """A4 sheet(s) of labels laid out in a grid; one label per asset."""
    if size not in LABEL_SIZES:
        size = "medium"
    lw, lh = (v * mm for v in LABEL_SIZES[size])
    page_w, page_h = A4
    margin = 8 * mm
    gap = 2 * mm
    cols = max(1, int((page_w - 2 * margin + gap) // (lw + gap)))
    rows = max(1, int((page_h - 2 * margin + gap) // (lh + gap)))

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle("Asset labels")
    pad = 2.5 * mm
    qr_size = min(lh - 2 * pad, lw * 0.42)

    for i, a in enumerate(assets):
        slot = i % (cols * rows)
        if i and slot == 0:
            c.showPage()
        col, row = slot % cols, slot // cols
        x = margin + col * (lw + gap)
        y = page_h - margin - (row + 1) * lh - row * gap

        c.setLineWidth(0.4)
        c.setStrokeGray(0.55)
        c.roundRect(x, y, lw, lh, 1.5 * mm)

        renderPDF.draw(_qr_drawing(qr_payload(a), qr_size), c, x + pad, y + lh - pad - qr_size)

        tx = x + pad + qr_size + 2.5 * mm
        max_w = x + lw - pad - tx
        ty = y + lh - pad - 3 * mm
        if company:
            c.setFont("Helvetica", 6)
            c.setFillGray(0.4)
            c.drawString(tx, ty, _fit_text(c, company, "Helvetica", 6, max_w))
            ty -= 4 * mm
        c.setFillGray(0)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(tx, ty, _fit_text(c, a.asset_tag, "Helvetica-Bold", 10, max_w))
        ty -= 4 * mm
        c.setFont("Helvetica", 7)
        name = a.name or ""
        # wrap the name over at most two lines
        words, line, lines = name.split(), "", []
        for w in words:
            trial = f"{line} {w}".strip()
            if c.stringWidth(trial, "Helvetica", 7) <= max_w:
                line = trial
            else:
                lines.append(line)
                line = w
        lines.append(line)
        for ln in lines[:2]:
            c.drawString(tx, ty, _fit_text(c, ln, "Helvetica", 7, max_w))
            ty -= 3 * mm
        if a.serial_number:
            c.setFont("Helvetica", 6)
            c.setFillGray(0.35)
            c.drawString(tx, ty, _fit_text(c, f"S/N {a.serial_number}", "Helvetica", 6, max_w))
            c.setFillGray(0)

        bar_h = min(9 * mm, lh * 0.22)
        bc = code128.Code128(a.asset_tag, barHeight=bar_h, barWidth=0.32 * mm if lw < 80 * mm else 0.42 * mm, quiet=False)
        if bc.width > lw - 2 * pad:   # shrink to fit narrow labels
            bc = code128.Code128(a.asset_tag, barHeight=bar_h, barWidth=0.22 * mm, quiet=False)
        bc.drawOn(c, x + (lw - bc.width) / 2, y + pad)
    c.save()
    return buf.getvalue()
