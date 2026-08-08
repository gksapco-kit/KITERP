"""Generate Godha Group Integrated ERP Architecture PDF (KIT ERP branded).

Larger typography with deep-dive callouts for:
  - Customer payment follow-ups
  - PR / PO approval process
  - Finance modules
  - Costing
  - Project construction management
"""

from __future__ import annotations

import os
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ── KIT ERP brand palette ─────────────────────────────────────────────────────
PRIMARY = colors.HexColor("#64C3A0")
PRIMARY_DARK = colors.HexColor("#3FA884")
PRIMARY_MUTED = colors.HexColor("#E8F7F1")
SECONDARY = colors.HexColor("#6F5AE8")
SECONDARY_MUTED = colors.HexColor("#EDE9FE")
ACCENT = colors.HexColor("#FF8A3D")
ACCENT_MUTED = colors.HexColor("#FFF1E8")
BG = colors.HexColor("#F8FAFC")
CARD = colors.HexColor("#FFFFFF")
BORDER = colors.HexColor("#E5E7EB")
TEXT = colors.HexColor("#1F2937")
TEXT_MUTED = colors.HexColor("#6B7280")
FINANCE_BLUE = colors.HexColor("#1D4ED8")
FINANCE_MUTED = colors.HexColor("#DBEAFE")
SLATE = colors.HexColor("#0F172A")
HIGHLIGHT = colors.HexColor("#FEF3C7")  # amber wash for priority
HIGHLIGHT_BORDER = colors.HexColor("#F59E0B")

PAGE = landscape(A3)
PAGE_W, PAGE_H = PAGE


def _try_register_fonts() -> tuple[str, str]:
    candidates = [
        (r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\segoeuib.ttf"),
        (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
    ]
    for regular, bold in candidates:
        if os.path.exists(regular) and os.path.exists(bold):
            try:
                pdfmetrics.registerFont(TTFont("KitSans", regular))
                pdfmetrics.registerFont(TTFont("KitSans-Bold", bold))
                return "KitSans", "KitSans-Bold"
            except Exception:
                continue
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = _try_register_fonts()


class RoundedCard(Flowable):
    """Clean process card — header, bullets, KIT badge."""

    def __init__(
        self,
        title: str,
        lines: list[str],
        width: float,
        height: float,
        header_color=PRIMARY,
        kit_module: str | None = None,
        badge_color=SECONDARY,
        priority: bool = False,  # kept for API compat; no UI tag
    ):
        super().__init__()
        self.title = title
        self.lines = lines
        self.width = width
        self.height = height
        self.header_color = header_color
        self.kit_module = kit_module
        self.badge_color = badge_color

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        c = self.canv
        r = 12
        # Soft shadow
        c.setFillColor(colors.Color(0.06, 0.09, 0.16, alpha=0.08))
        c.roundRect(2.5, -2.5, self.width, self.height, r, fill=1, stroke=0)

        # Card
        c.setFillColor(CARD)
        c.setStrokeColor(BORDER)
        c.setLineWidth(1)
        c.roundRect(0, 0, self.width, self.height, r, fill=1, stroke=1)

        # Top accent strip (full-bleed header)
        header_h = 36
        c.setFillColor(self.header_color)
        c.roundRect(0, self.height - header_h, self.width, header_h, r, fill=1, stroke=0)
        c.rect(0, self.height - header_h, self.width, header_h - r, fill=1, stroke=0)

        # Subtle bottom edge under header
        c.setFillColor(colors.Color(0, 0, 0, alpha=0.08))
        c.rect(0, self.height - header_h - 1.5, self.width, 1.5, fill=1, stroke=0)

        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 10.5)
        title = self.title
        max_w = self.width - 20
        while c.stringWidth(title, FONT_BOLD, 10.5) > max_w and len(title) > 4:
            title = title[:-1]
        c.drawString(12, self.height - 23, title)

        # Body
        c.setFillColor(TEXT)
        c.setFont(FONT, 10)
        y = self.height - header_h - 20
        for line in self.lines:
            if y < 30:
                break
            # mint bullet
            c.setFillColor(PRIMARY)
            c.circle(16, y + 3, 2.4, fill=1, stroke=0)
            c.setFillColor(TEXT)
            c.drawString(24, y, line.lstrip("• ").strip())
            y -= 17

        if self.kit_module:
            badge = f"KIT  ·  {self.kit_module}"
            c.setFont(FONT_BOLD, 8)
            tw = min(c.stringWidth(badge, FONT_BOLD, 8) + 16, self.width - 20)
            bx, by = 10, 10
            # Soft pill
            c.setFillColor(colors.Color(0.06, 0.09, 0.16, alpha=0.04))
            c.roundRect(bx + 1, by - 1, tw, 18, 9, fill=1, stroke=0)
            c.setFillColor(self.badge_color)
            c.roundRect(bx, by, tw, 18, 9, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.drawString(bx + 8, by + 5.5, badge[:58])


class DetailPanel(Flowable):
    """Large highlight panel for deep-dive process topics."""

    def __init__(
        self,
        number: str,
        title: str,
        kit_module: str,
        steps: list[str],
        outcomes: list[str],
        width: float,
        height: float,
        accent=SECONDARY,
    ):
        super().__init__()
        self.number = number
        self.title = title
        self.kit_module = kit_module
        self.steps = steps
        self.outcomes = outcomes
        self.width = width
        self.height = height
        self.accent = accent

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        c = self.canv
        r = 12
        c.setFillColor(colors.Color(0.06, 0.09, 0.16, alpha=0.06))
        c.roundRect(3, -3, self.width, self.height, r, fill=1, stroke=0)

        c.setFillColor(CARD)
        c.setStrokeColor(self.accent)
        c.setLineWidth(2.2)
        c.roundRect(0, 0, self.width, self.height, r, fill=1, stroke=1)

        # Left accent bar
        c.setFillColor(self.accent)
        c.roundRect(0, 0, 8, self.height, r, fill=1, stroke=0)
        c.rect(4, 0, 4, self.height, fill=1, stroke=0)

        # Number chip
        c.setFillColor(self.accent)
        c.roundRect(20, self.height - 42, 36, 28, 6, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(FONT_BOLD, 14)
        c.drawCentredString(38, self.height - 33, self.number)

        c.setFillColor(SLATE)
        c.setFont(FONT_BOLD, 14)
        c.drawString(66, self.height - 28, self.title)

        c.setFillColor(self.accent)
        c.setFont(FONT_BOLD, 9.5)
        c.drawString(66, self.height - 44, f"KIT MODULE  ·  {self.kit_module}")

        # Divider
        c.setStrokeColor(BORDER)
        c.setLineWidth(1)
        c.line(20, self.height - 56, self.width - 16, self.height - 56)

        # Two columns: Process / Outcomes
        col1_x = 22
        col2_x = self.width * 0.52
        c.setFillColor(SLATE)
        c.setFont(FONT_BOLD, 11)
        c.drawString(col1_x, self.height - 76, "Process flow")
        c.drawString(col2_x, self.height - 76, "Business outcome")

        c.setFont(FONT, 10.5)
        c.setFillColor(TEXT)
        y = self.height - 96
        for step in self.steps:
            c.setFillColor(self.accent)
            c.circle(col1_x + 4, y + 3, 3.2, fill=1, stroke=0)
            c.setFillColor(TEXT)
            # wrap long lines simply
            text = step
            max_w = col2_x - col1_x - 24
            if c.stringWidth(text, FONT, 10.5) > max_w:
                # split at ~48 chars
                cut = 48
                while cut < len(text) and text[cut] != " ":
                    cut += 1
                if cut >= len(text):
                    cut = 48
                c.drawString(col1_x + 14, y, text[:cut].strip())
                y -= 15
                c.drawString(col1_x + 14, y, text[cut:].strip())
            else:
                c.drawString(col1_x + 14, y, text)
            y -= 18

        y = self.height - 96
        for out in self.outcomes:
            c.setFillColor(PRIMARY)
            c.roundRect(col2_x, y - 1, 8, 8, 2, fill=1, stroke=0)
            c.setFillColor(TEXT)
            c.drawString(col2_x + 14, y, out)
            y -= 18


class Pill(Flowable):
    def __init__(self, text: str, width: float, fill=PRIMARY_MUTED, text_color=PRIMARY_DARK, height=24):
        super().__init__()
        self.text = text
        self.width = width
        self.height = height
        self.fill = fill
        self.text_color = text_color

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(self.fill)
        c.roundRect(0, 0, self.width, self.height, self.height / 2, fill=1, stroke=0)
        c.setFillColor(self.text_color)
        c.setFont(FONT_BOLD, 9.5)
        c.drawCentredString(self.width / 2, self.height / 2 - 3.5, self.text)


def _styles():
    base = getSampleStyleSheet()

    def S(name, **kw):
        kw.setdefault("fontName", FONT)
        return ParagraphStyle(name, parent=base["Normal"], **kw)

    return {
        "hero": S(
            "hero",
            fontName=FONT_BOLD,
            fontSize=26,
            textColor=SLATE,
            leading=30,
            alignment=TA_LEFT,
        ),
        "hero_sub": S(
            "hero_sub",
            fontSize=12.5,
            textColor=TEXT_MUTED,
            leading=17,
            alignment=TA_LEFT,
        ),
        "section": S(
            "section",
            fontName=FONT_BOLD,
            fontSize=15,
            textColor=SLATE,
            leading=18,
            spaceBefore=2,
            spaceAfter=8,
        ),
        "body": S("body", fontSize=11, textColor=TEXT, leading=15),
        "body_lg": S("body_lg", fontSize=12, textColor=TEXT, leading=16),
        "muted": S("muted", fontSize=10, textColor=TEXT_MUTED, leading=13),
        "cell_title": S(
            "cell_title",
            fontName=FONT_BOLD,
            fontSize=11,
            textColor=colors.white,
            leading=14,
            alignment=TA_CENTER,
        ),
        "kit_badge": S(
            "kit_badge",
            fontName=FONT_BOLD,
            fontSize=11,
            textColor=SECONDARY,
            leading=14,
            alignment=TA_LEFT,
        ),
        "map_stage": S(
            "map_stage",
            fontName=FONT_BOLD,
            fontSize=11,
            textColor=SLATE,
            leading=14,
        ),
        "map_mod": S(
            "map_mod",
            fontName=FONT_BOLD,
            fontSize=11,
            textColor=PRIMARY_DARK,
            leading=14,
        ),
        "map_desc": S(
            "map_desc",
            fontSize=10.5,
            textColor=TEXT,
            leading=14,
        ),
    }


def _draw_page_chrome(c: canvas.Canvas, doc):
    c.saveState()
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    c.setFillColor(SLATE)
    c.rect(0, PAGE_H - 34, PAGE_W, 34, fill=1, stroke=0)
    c.setFillColor(PRIMARY)
    c.rect(0, PAGE_H - 34, 8, 34, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 12)
    c.drawString(20, PAGE_H - 22, "KIT ERP")
    c.setFont(FONT, 11)
    c.setFillColor(colors.Color(1, 1, 1, alpha=0.8))
    c.drawString(72, PAGE_H - 22, "  ·  Godha Group  ·  Integrated Enterprise Architecture")

    c.setFillColor(PRIMARY)
    c.setFont(FONT_BOLD, 11)
    c.drawRightString(PAGE_W - 20, PAGE_H - 22, f"Page {doc.page}")

    c.setFillColor(PRIMARY)
    c.rect(0, PAGE_H - 38, PAGE_W, 4, fill=1, stroke=0)

    c.setFillColor(BORDER)
    c.rect(0, 0, PAGE_W, 26, fill=1, stroke=0)
    c.setFillColor(TEXT_MUTED)
    c.setFont(FONT, 9)
    c.drawCentredString(
        PAGE_W / 2,
        10,
        "Godha Group · Integrated ERP Architecture  ·  Confidential  ·  Powered by KIT ERP",
    )
    c.setFillColor(PRIMARY)
    c.rect(0, 26, PAGE_W, 3, fill=1, stroke=0)
    c.restoreState()


def _card_row(cards: list[dict], col_w: float) -> Table:
    cells = [
        RoundedCard(
            title=card["title"],
            lines=card["lines"],
            width=col_w,
            height=card.get("height", 168),
            header_color=card.get("color", PRIMARY),
            kit_module=card.get("kit"),
            badge_color=card.get("badge", SECONDARY),
            priority=card.get("priority", False),
        )
        for card in cards
    ]
    t = Table([cells], colWidths=[col_w] * len(cards))
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return t


def build_story(styles):
    story = []
    margin_x = 14 * mm
    usable = PAGE_W - 2 * margin_x

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 1 — Architecture overview
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 2))
    hero = Table(
        [
            [
                Paragraph("GODHA GROUP — INTEGRATED ERP", styles["hero"]),
                Pill("Powered by KIT ERP", 140, PRIMARY, colors.white, 26),
            ]
        ],
        colWidths=[usable - 150, 140],
    )
    hero.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(hero)
    story.append(
        Paragraph(
            "Master Data &#8594; Construction Projects &#8594; Procurement Approvals &#8594; "
            "Finance &amp; Costing &#8594; Customer Payment Follow-ups &#8594; MIS",
            styles["hero_sub"],
        )
    )
    story.append(Spacer(1, 4))

    # Key capabilities banner
    banner = Table(
        [
            [
                Paragraph(
                    "<font color='#0F172A'><b>KEY CAPABILITIES</b></font> &nbsp;&nbsp; "
                    "Customer Payment Follow-ups &nbsp;·&nbsp; "
                    "PR &amp; PO Approvals &nbsp;·&nbsp; "
                    "Finance &nbsp;·&nbsp; "
                    "Costing &nbsp;·&nbsp; "
                    "Project Construction Management",
                    styles["body"],
                )
            ]
        ],
        colWidths=[usable],
    )
    banner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_MUTED),
                ("BOX", (0, 0), (-1, -1), 1.5, PRIMARY),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 11),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
            ]
        )
    )
    story.append(banner)
    story.append(Spacer(1, 8))

    # Master data
    story.append(Paragraph("01  ·  GROUP MASTER DATA &amp; CONTROLS", styles["section"]))
    master = Table(
        [
            [
                Paragraph(
                    "<b>Company · BU · Project · Customer · Vendor · Item · Employee · Assets</b>",
                    styles["body_lg"],
                ),
                Paragraph(
                    "<font color='#6F5AE8'><b>KIT · Master Data + HR + System Config</b></font>",
                    styles["kit_badge"],
                ),
            ]
        ],
        colWidths=[usable * 0.62, usable * 0.38],
    )
    master.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_MUTED),
                ("BOX", (0, 0), (-1, -1), 1.5, PRIMARY),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(master)
    story.append(Spacer(1, 8))

    # Five critical control towers
    story.append(Paragraph("02  ·  FIVE CRITICAL CONTROL TOWERS", styles["section"]))
    col5 = (usable - 28) / 5
    story.append(
        _card_row(
            [
                {
                    "title": "PAYMENT FOLLOW-UPS",
                    "lines": [
                        "• Overdue AR reminders",
                        "• Promise-to-pay tracking",
                        "• Credit control alerts",
                        "• Collection cadence",
                    ],
                    "color": SECONDARY,
                    "kit": "CRM Payment Follow-ups",
                    "height": 175,
                },
                {
                    "title": "PR & PO APPROVALS",
                    "lines": [
                        "• PR raise → approve",
                        "• RFQ / vendor quote",
                        "• PO multi-level approve",
                        "• Goods receipt link",
                    ],
                    "color": ACCENT,
                    "kit": "Procurement Approvals",
                    "badge": ACCENT,
                    "height": 175,
                },
                {
                    "title": "FINANCE MODULES",
                    "lines": [
                        "• AP · AR · GL · GST",
                        "• Bank · Cash · Assets",
                        "• Budgets · Period close",
                        "• Group P&L / BS",
                    ],
                    "color": FINANCE_BLUE,
                    "kit": "Finance Management",
                    "badge": FINANCE_BLUE,
                    "height": 175,
                },
                {
                    "title": "COSTING",
                    "lines": [
                        "• Project cost plan",
                        "• Cost / profit centers",
                        "• Budget vs actual",
                        "• WIP · variance",
                    ],
                    "color": PRIMARY_DARK,
                    "kit": "Controlling (CO)",
                    "badge": PRIMARY_DARK,
                    "height": 175,
                },
                {
                    "title": "PROJECT CONSTRUCTION",
                    "lines": [
                        "• Project · BOQ · WBS",
                        "• Site execution",
                        "• Material · labour",
                        "• Milestone / RA billing",
                    ],
                    "color": SLATE,
                    "kit": "Sales Projects + CO",
                    "badge": SLATE,
                    "height": 175,
                },
            ],
            col5,
        )
    )
    story.append(Spacer(1, 10))

    # Supporting lanes — includes Rental
    story.append(Paragraph("03  ·  SUPPORTING PROCESS LANES", styles["section"]))
    col5s = (usable - 28) / 5
    story.append(
        _card_row(
            [
                {
                    "title": "CRM & SALES",
                    "lines": [
                        "• Leads · Opportunities",
                        "• Quotations · Contracts",
                        "• Invoices · RA bills",
                    ],
                    "color": SECONDARY,
                    "kit": "CRM + Sales",
                    "height": 130,
                },
                {
                    "title": "INVENTORY / STORES",
                    "lines": [
                        "• Receipt · Issue · Transfer",
                        "• Site stock · Consumption",
                        "• Plants · Storage locations",
                    ],
                    "color": ACCENT,
                    "kit": "Inventory Management",
                    "badge": ACCENT,
                    "height": 130,
                },
                {
                    "title": "RENTAL MANAGEMENT",
                    "lines": [
                        "• Assets · Availability",
                        "• Hire bookings · Returns",
                        "• Settlements · Reports",
                    ],
                    "color": colors.HexColor("#0D9488"),
                    "kit": "Rental Management",
                    "badge": colors.HexColor("#0D9488"),
                    "height": 130,
                },
                {
                    "title": "DESIGN · REAL ESTATE",
                    "lines": [
                        "• Drawings · Approvals",
                        "• Plot inventory · Booking",
                        "• Design fee billing",
                    ],
                    "color": SLATE,
                    "kit": "Projects + Properties",
                    "badge": SLATE,
                    "height": 130,
                },
                {
                    "title": "MIS & DASHBOARDS",
                    "lines": [
                        "• Project profitability",
                        "• Cash & receivables",
                        "• BU / Group performance",
                    ],
                    "color": PRIMARY_DARK,
                    "kit": "My Kit + Finance Reports",
                    "badge": PRIMARY_DARK,
                    "height": 130,
                },
            ],
            col5s,
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "Pages 2–3 detail the five control towers with step-by-step KIT ERP process flows.",
            styles["muted"],
        )
    )

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 2 — Payment follow-ups + PR/PO approvals (deep dive)
    # ══════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Paragraph("DEEP DIVE — COLLECTIONS &amp; PROCUREMENT CONTROL", styles["hero"]))
    story.append(
        Paragraph(
            "Customer payment follow-ups and gated PR / PO approvals — the two cash &amp; spend control towers.",
            styles["hero_sub"],
        )
    )
    story.append(Spacer(1, 10))

    panel_w = usable
    panel_h = 290

    story.append(
        DetailPanel(
            number="01",
            title="Customer Payment Follow-ups",
            kit_module="CRM Management  →  Payment Follow-ups  +  Finance AR",
            steps=[
                "Invoice / RA bill posted to customer AR",
                "Ageing buckets trigger follow-up tasks",
                "Collector records promise-to-pay & next action",
                "Escalation to credit control if overdue",
                "Receipt clears open item in Finance AR",
            ],
            outcomes=[
                "Faster collections & lower DSO",
                "Clear owner for every overdue invoice",
                "Audit trail of customer commitments",
                "Credit hold when exposure is high",
                "Live cash-forecast from promises",
            ],
            width=panel_w,
            height=panel_h,
            accent=SECONDARY,
        )
    )
    story.append(Spacer(1, 14))

    story.append(
        DetailPanel(
            number="02",
            title="PR & PO Approval Process",
            kit_module="Procurement Management  →  Requisitions  →  Purchase Orders",
            steps=[
                "Site / project raises Purchase Requisition (PR)",
                "Budget & cost-center check against project plan",
                "Multi-level PR approval (site → PM → commercial)",
                "RFQ / vendor quotation → convert to PO",
                "PO value-based approval → release → GRN",
            ],
            outcomes=[
                "No spend without approved PR",
                "Budget leakage blocked at source",
                "Delegated authority by amount",
                "Full PR→PO→GRN→AP audit chain",
                "Vendor invoice 3-way match ready",
            ],
            width=panel_w,
            height=panel_h,
            accent=ACCENT,
        )
    )

    # Mini process strip
    story.append(Spacer(1, 12))
    strip = Table(
        [
            [
                Paragraph(
                    "<b>Approval chain (typical)</b> &nbsp;&nbsp; "
                    "PR Draft &#8594; PR Approve &#8594; RFQ &#8594; PO Draft &#8594; "
                    "PO Approve (L1 / L2) &#8594; PO Release &#8594; Goods Receipt &#8594; AP Invoice",
                    styles["body_lg"],
                )
            ]
        ],
        colWidths=[usable],
    )
    strip.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ACCENT_MUTED),
                ("BOX", (0, 0), (-1, -1), 1.5, ACCENT),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(strip)

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 3 — Finance + Costing + Project Construction
    # ══════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Paragraph("DEEP DIVE — FINANCE, COSTING &amp; CONSTRUCTION", styles["hero"]))
    story.append(
        Paragraph(
            "How KIT ERP Finance, Controlling, and Project Construction run Godha’s build–bill–profit loop.",
            styles["hero_sub"],
        )
    )
    story.append(Spacer(1, 8))

    # Three equal detail cards as tables with large text
    third = (usable - 16) / 3

    def _deep_card(title, kit, accent, bullets, kit_items):
        head = Paragraph(f"<b>{title}</b>", styles["cell_title"])
        body = Paragraph(
            "<br/>".join(f"• {b}" for b in bullets)
            + "<br/><br/><font color='#6F5AE8'><b>KIT covers</b></font><br/>"
            + "<br/>".join(f"– {k}" for k in kit_items),
            styles["body"],
        )
        kit_line = Paragraph(f"<b>{kit}</b>", styles["kit_badge"])
        t = Table([[head], [kit_line], [body]], colWidths=[third])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), accent),
                    ("BACKGROUND", (0, 1), (0, 1), HIGHLIGHT),
                    ("BACKGROUND", (0, 2), (0, 2), CARD),
                    ("BOX", (0, 0), (-1, -1), 2.2, accent),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (0, 0), 10),
                    ("BOTTOMPADDING", (0, 0), (0, 0), 10),
                    ("TOPPADDING", (0, 1), (0, 1), 8),
                    ("BOTTOMPADDING", (0, 1), (0, 1), 8),
                    ("TOPPADDING", (0, 2), (0, 2), 10),
                    ("BOTTOMPADDING", (0, 2), (0, 2), 12),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        return t

    trio = Table(
        [
            [
                _deep_card(
                    "03  FINANCE MODULES",
                    "KIT · Finance Management",
                    FINANCE_BLUE,
                    [
                        "Chart of Accounts & journals",
                        "AR (customer) & AP (vendor)",
                        "Bank, cash, GST / tax returns",
                        "Fixed assets & depreciation",
                        "Budgets, forecasts, period close",
                        "P&L, Balance Sheet, Cash Flow",
                        "Multi-GAAP / parallel ledgers",
                    ],
                    [
                        "Finance Advanced mode",
                        "AR open-item clearing",
                        "AP from vendor invoices",
                        "Approvals & audit log",
                    ],
                ),
                _deep_card(
                    "04  COSTING",
                    "KIT · Controlling Management",
                    PRIMARY_DARK,
                    [
                        "Project / job cost planning",
                        "Cost & profit centers",
                        "Budget vs actual by WBS",
                        "Material + labour booking",
                        "WIP & variance analysis",
                        "Overhead allocation",
                        "Period-end controlling close",
                    ],
                    [
                        "Internal / project orders",
                        "Activity confirmations",
                        "Cost allocations",
                        "Profitability views",
                    ],
                ),
                _deep_card(
                    "05  PROJECT CONSTRUCTION",
                    "KIT · Sales Projects + CO + Inventory",
                    SLATE,
                    [
                        "Project creation & milestones",
                        "BOQ / budget baseline",
                        "WBS-style cost plan",
                        "Site material issue & transfer",
                        "Labour / contractor tracking",
                        "Progress / RA billing",
                        "Retention, advances, collections",
                    ],
                    [
                        "Sales → Projects",
                        "Inventory site stock",
                        "Procurement for site PR/PO",
                        "Finance AR on RA bills",
                    ],
                ),
            ]
        ],
        colWidths=[third] * 3,
    )
    trio.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(trio)

    story.append(Spacer(1, 12))
    # End-to-end construction money loop
    loop = Table(
        [
            [
                Paragraph(
                    "<b>Construction money loop</b><br/>"
                    "Project Setup &#8594; Cost Plan &#8594; Approved PR/PO &#8594; Site Execution &amp; Issues &#8594; "
                    "Cost Booking (CO) &#8594; RA / Milestone Invoice &#8594; <b>Payment Follow-up</b> &#8594; "
                    "Cash Application (AR) &#8594; Project Profitability MIS",
                    styles["body_lg"],
                )
            ]
        ],
        colWidths=[usable],
    )
    loop.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_MUTED),
                ("BOX", (0, 0), (-1, -1), 2, PRIMARY_DARK),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(loop)

    story.append(Spacer(1, 10))
    # Compact enablement
    story.append(Paragraph("RECOMMENDED KIT APPS FOR THESE KEY AREAS", styles["section"]))
    enable = [
        (
            "MUST ENABLE",
            PRIMARY,
            "CRM · Procurement · Sales/Projects · Inventory · Finance · Controlling · "
            "Master Data · My Kit · Rental · Website · Commission",
        ),
        (
            "CONFIGURE FIRST",
            SECONDARY,
            "PR/PO approval matrix · Payment follow-up SLAs · Project cost structures · "
            "AR ageing rules · Rental assets · Broker commission plans",
        ),
    ]
    col_w = (usable - 12) / 2
    en_cells = []
    for title, color, text in enable:
        inner = Table(
            [
                [Paragraph(f"<b>{title}</b>", styles["cell_title"])],
                [Paragraph(text, styles["body"])],
            ],
            colWidths=[col_w],
        )
        inner.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), color),
                    ("BACKGROUND", (0, 1), (0, 1), CARD),
                    ("BOX", (0, 0), (-1, -1), 1.2, BORDER),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        en_cells.append(inner)
    en_row = Table([en_cells], colWidths=[col_w] * 2)
    en_row.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(en_row)

    return story


def generate_pdf(output_paths: list[Path]) -> list[Path]:
    styles = _styles()
    primary_out = output_paths[0]
    primary_out.parent.mkdir(parents=True, exist_ok=True)

    doc = BaseDocTemplate(
        str(primary_out),
        pagesize=PAGE,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=44,
        bottomMargin=36,
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        PAGE_W - doc.leftMargin - doc.rightMargin,
        PAGE_H - doc.topMargin - doc.bottomMargin,
        id="normal",
    )
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=_draw_page_chrome)])
    doc.build(build_story(styles))

    written = [primary_out]
    data = primary_out.read_bytes()
    for path in output_paths[1:]:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            written.append(path)
        except Exception as exc:  # noqa: BLE001
            print(f"Warning: could not write {path}: {exc}")
    return written


if __name__ == "__main__":
    repo_docs = Path(__file__).resolve().parent
    onedrive_dir = Path(r"c:\Users\mslav\OneDrive\Documents\KIT ERP\Users\Godha Group")
    outputs = [
        repo_docs / "Godha_Group_Integrated_ERP_Architecture.pdf",
        onedrive_dir / "Godha_Group_Integrated_ERP_Architecture_KIT.pdf",
        onedrive_dir / "Godha_Group_Integrated_ERP_Architecture.pdf",
    ]
    written = generate_pdf(outputs)
    for p in written:
        print(f"Wrote: {p}")
