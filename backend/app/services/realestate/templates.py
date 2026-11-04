"""Configurable print & letter templates for the Real Estate vertical.

Architecture
------------
* Jinja2 SandboxedEnvironment renders every template so vendor-authored HTML
  cannot reach Python internals.  autoescape=True is intentional: merge values
  are HTML-escaped by default.  Vendors who need raw HTML in a value must wrap
  it in Jinja2's ``{{ value | safe }}`` (only in their own body, never in
  system-generated values).
* ``render_template`` tries the vendor-saved override (``re_template`` table)
  first, then falls back to the built-in ``DEFAULT_TEMPLATES``.
* ``wrap_print`` wraps the rendered body in a complete HTML document with
  ``@page`` CSS, a letterhead header and footer and optional watermark.
* ``MERGE_FIELDS`` maps every template type to the list of variables it
  accepts, so the frontend can display a clickable field-picker.
"""
from __future__ import annotations

import html as _html
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from jinja2.sandbox import SandboxedEnvironment
from jinja2 import ChainableUndefined
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate.admin import ReTemplate

# ---------------------------------------------------------------------------
# Jinja2 environment
# ---------------------------------------------------------------------------

def _money(v: Any) -> str:
    try:
        return f"{float(v):,.2f}"
    except (TypeError, ValueError):
        return str(v or "")


def _inr_words(n: Any) -> str:  # noqa: C901
    """Convert a number to Indian-English words (up to crores)."""
    try:
        n = int(round(float(n)))
    except (TypeError, ValueError):
        return ""
    if n == 0:
        return "Zero"
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def _below_1000(x: int) -> str:
        if x == 0:
            return ""
        if x < 20:
            return ones[x]
        if x < 100:
            return tens[x // 10] + (" " + ones[x % 10] if x % 10 else "")
        return ones[x // 100] + " Hundred" + (" " + _below_1000(x % 100) if x % 100 else "")

    parts: list[str] = []
    crore, n = divmod(n, 10_000_000)
    if crore:
        parts.append(_below_1000(crore) + " Crore")
    lakh, n = divmod(n, 100_000)
    if lakh:
        parts.append(_below_1000(lakh) + " Lakh")
    thousand, n = divmod(n, 1000)
    if thousand:
        parts.append(_below_1000(thousand) + " Thousand")
    if n:
        parts.append(_below_1000(n))
    return " ".join(parts)


def _fmt_date(d: Any, fmt: str = "%d %b %Y") -> str:
    if d is None:
        return ""
    if hasattr(d, "strftime"):
        return d.strftime(fmt)
    return str(d)


_env = SandboxedEnvironment(autoescape=True, undefined=ChainableUndefined)
_env.filters["money"] = _money
_env.filters["inr_words"] = _inr_words
_env.filters["fmt_date"] = _fmt_date


def render_string(body: str, values: dict[str, Any]) -> str:
    """Render *body* as a Jinja2 template against *values*."""
    try:
        return _env.from_string(body).render(**values)
    except Exception:
        # On syntax errors in vendor templates fall back to the raw string so
        # admins can still see / edit the template in the UI.
        return body


# ---------------------------------------------------------------------------
# Default built-in templates
# ---------------------------------------------------------------------------

_STYLE = "font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111"
_TABLE_STYLE = "width:100%;border-collapse:collapse;margin-bottom:12px"
_TH_STYLE = "background:#f3f4f6;padding:6px 10px;text-align:left;border:1px solid #ddd;font-size:12px"
_TD_STYLE = "padding:6px 10px;border:1px solid #ddd;font-size:13px"
_TDR_STYLE = "padding:6px 10px;border:1px solid #ddd;font-size:13px;text-align:right"
_TDB_STYLE = "padding:6px 10px;border:1px solid #ddd;font-size:13px;text-align:right;font-weight:bold"

DEFAULT_TEMPLATES: dict[str, dict[str, str]] = {
    # ── Letters & agreements ────────────────────────────────────────────────
    "allotment_letter": {
        "subject": "Allotment of Unit {{ unit_number }} — {{ project_name }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<p>Date: {{ date }}<br/>Ref: {{ allotment_no }}</p>"
            "<p>To,<br/><b>{{ customer_name }}</b><br/>{{ customer_address }}</p>"
            "<p><b>Sub: Allotment of Unit No. {{ unit_number }}, {{ tower_name }} in {{ project_name }}</b></p>"
            "<p>Dear {{ customer_name }},</p>"
            "<p>We are pleased to allot you unit no. <b>{{ unit_number }}</b> (floor {{ floor_number }}, "
            "super area {{ super_area }} sq.ft.) in <b>{{ project_name }}</b> (RERA {{ rera_number }}) against "
            "your booking {{ booking_no }} dated {{ booking_date }}.</p>"
            "<p>Agreement value: <b>₹{{ agreement_value | money }}</b> (plus GST ₹{{ gst_amount | money }}). "
            "Amount received to date: ₹{{ paid_amount | money }}. Please sign and return the enclosed copy "
            "within 15 days and execute the Agreement for Sale as scheduled.</p>"
            "<p>Yours sincerely,<br/>{{ developer_entity }}</p></div>"
        ),
    },
    "demand_letter": {
        "subject": "Payment demand {{ demand_no }} — Unit {{ unit_number }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<p>Date: {{ date }}<br/>Demand No: {{ demand_no }}</p>"
            "<p>To,<br/><b>{{ customer_name }}</b></p>"
            "<p><b>Sub: Demand for \"{{ stage_name }}\" — Unit {{ unit_number }}, {{ project_name }}</b></p>"
            "<p>Dear {{ customer_name }},</p>"
            "<p>As per the agreed payment plan, the stage <b>{{ stage_name }}</b> has been reached. "
            "Kindly pay the following on or before <b>{{ due_date }}</b>:</p>"
            f"<table style='{_TABLE_STYLE}'>"
            f"<tr><td style='{_TD_STYLE}'>Instalment amount</td><td style='{_TDR_STYLE}'>₹{{ amount | money }}</td></tr>"
            f"<tr><td style='{_TD_STYLE}'>GST</td><td style='{_TDR_STYLE}'>₹{{ gst_amount | money }}</td></tr>"
            f"<tr><td style='{_TD_STYLE}'>Interest / late fee</td><td style='{_TDR_STYLE}'>₹{{ interest | money }}</td></tr>"
            f"<tr><td style='{_TDB_STYLE}'>Total payable</td><td style='{_TDB_STYLE}'>₹{{ total | money }}</td></tr></table>"
            "<p>Delayed payment attracts interest at {{ interest_rate }}% p.a. as per RERA.</p>"
            "<p>Regards,<br/>{{ developer_entity }}</p></div>"
        ),
    },
    "payment_receipt": {
        "subject": "Receipt {{ receipt_no }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h3>Payment receipt</h3><p>Receipt No: <b>{{ receipt_no }}</b> &nbsp; Date: {{ date }}</p>"
            "<p>Received with thanks from <b>{{ customer_name }}</b> a sum of <b>₹{{ amount | money }}</b> "
            "({{ amount | inr_words }} Rupees only) by "
            "{{ mode }} ({{ reference_no }}) towards Unit {{ unit_number }}, {{ project_name }} "
            "(Booking {{ booking_no }}).</p><p>For {{ developer_entity }}</p></div>"
        ),
    },
    "agreement_for_sale": {
        "subject": "Agreement for Sale — Unit {{ unit_number }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h2 style='text-align:center'>AGREEMENT FOR SALE</h2>"
            "<p>This Agreement is made at {{ city }} on {{ date }} between <b>{{ developer_entity }}</b> "
            "(the \"Promoter\") and <b>{{ customer_name }}</b> (the \"Allottee\").</p>"
            "<p>1. The Promoter agrees to sell and the Allottee agrees to purchase Unit No. "
            "<b>{{ unit_number }}</b> admeasuring {{ carpet_area }} sq.ft. carpet area ({{ super_area }} sq.ft. "
            "super built-up) in <b>{{ project_name }}</b>, RERA Reg. No. {{ rera_number }}.</p>"
            "<p>2. Total consideration: <b>₹{{ agreement_value | money }}</b> exclusive of GST, stamp duty and "
            "registration charges, payable as per the Payment Schedule annexed hereto.</p>"
            "<p>3. Possession shall be delivered on or before {{ possession_date }}, subject to force majeure. "
            "Delay attracts interest as prescribed under RERA.</p>"
            "<p>4. The Allottee shall have a defect liability period of five years from possession.</p>"
            "<p>Witnesses: 1. ______________ &nbsp; 2. ______________</p></div>"
        ),
    },
    "sale_deed": {
        "subject": "Sale Deed — Unit {{ unit_number }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h2 style='text-align:center'>SALE DEED</h2>"
            "<p>This Sale Deed is executed on {{ date }} by <b>{{ developer_entity }}</b> (Vendor) in favour "
            "of <b>{{ customer_name }}</b> (Purchaser) for Unit {{ unit_number }} in {{ project_name }} "
            "for a total consideration of <b>₹{{ agreement_value | money }}</b>, receipt of which the Vendor hereby "
            "acknowledges.</p><p>Stamp duty paid: ₹{{ stamp_duty | money }} &nbsp; "
            "Registration fee: ₹{{ registration_fee | money }}</p></div>"
        ),
    },
    "possession_letter": {
        "subject": "Possession of Unit {{ unit_number }} — {{ project_name }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<p>Date: {{ date }}</p><p>To,<br/><b>{{ customer_name }}</b></p>"
            "<p><b>Sub: Possession of Unit {{ unit_number }}, {{ project_name }}</b></p>"
            "<p>Dear {{ customer_name }},</p><p>We are pleased to hand over possession of Unit "
            "<b>{{ unit_number }}</b> on {{ possession_date }} after receipt of all dues and completion of "
            "the handover checklist. The defect liability period of five years commences from today.</p>"
            "<p>Regards,<br/>{{ developer_entity }}</p></div>"
        ),
    },
    "cancellation_letter": {
        "subject": "Cancellation of booking {{ booking_no }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<p>Date: {{ date }}</p><p>To,<br/><b>{{ customer_name }}</b></p>"
            "<p>Your booking {{ booking_no }} for Unit {{ unit_number }} stands cancelled. "
            "Amount paid: ₹{{ total_paid | money }}; deductions: ₹{{ deductions | money }}; "
            "refundable: <b>₹{{ refundable_amount | money }}</b>.</p>"
            "<p>Regards,<br/>{{ developer_entity }}</p></div>"
        ),
    },
    "lease_agreement": {
        "subject": "Lease Agreement {{ lease_no }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h2 style='text-align:center'>LEASE AGREEMENT</h2>"
            "<p>This Lease is made on {{ date }} between <b>{{ developer_entity }}</b> (Lessor) and "
            "<b>{{ customer_name }}</b> (Lessee) for premises {{ unit_number }}, {{ project_name }}.</p>"
            "<p>Term: {{ start_date }} to {{ end_date }}; lock-in {{ lock_in_months }} months. "
            "Monthly rent ₹{{ monthly_rent | money }} (escalation {{ escalation }}). "
            "Security deposit ₹{{ security_deposit | money }}.</p></div>"
        ),
    },
    "refund_letter": {
        "subject": "Refund — Booking {{ booking_no }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<p>Date: {{ date }}</p><p>To,<br/><b>{{ customer_name }}</b></p>"
            "<p>Please find enclosed a refund of <b>₹{{ refundable_amount | money }}</b> "
            "({{ refundable_amount | inr_words }} Rupees) via {{ mode }} ({{ reference_no }}) "
            "in settlement of your booking {{ booking_no }}.</p>"
            "<p>Regards,<br/>{{ developer_entity }}</p></div>"
        ),
    },
    "welcome_letter": {
        "subject": "Welcome — Unit {{ unit_number }}, {{ project_name }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<p>Date: {{ date }}</p>"
            "<p>Dear {{ customer_name }},</p>"
            "<p>We warmly welcome you as a homeowner at <b>{{ project_name }}</b>. "
            "Your unit <b>{{ unit_number }}</b> is now registered in your name. "
            "Please contact our care team at {{ care_email }} / {{ care_phone }} for any assistance.</p>"
            "<p>Warm regards,<br/>{{ developer_entity }}</p></div>"
        ),
    },
    "noc": {
        "subject": "No Objection Certificate — {{ customer_name }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h3 style='text-align:center'>NO OBJECTION CERTIFICATE</h3>"
            "<p>This is to certify that <b>{{ customer_name }}</b> is the registered allottee/owner of "
            "Unit <b>{{ unit_number }}</b>, {{ project_name }}, and as of {{ date }} there are "
            "no outstanding dues or encumbrances against the said unit.</p>"
            "<p>For {{ developer_entity }}</p></div>"
        ),
    },
    # ── Printable financial documents ───────────────────────────────────────
    "cost_sheet": {
        "subject": "Cost sheet — Unit {{ unit_number }}, {{ project_name }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h3>Cost sheet — Unit {{ unit_number }}</h3>"
            "<p>Project: <b>{{ project_name }}</b> &nbsp;|&nbsp; Date: {{ date }}</p>"
            f"<table style='{_TABLE_STYLE}'>"
            f"<tr><th style='{_TH_STYLE}'>Description</th><th style='{_TH_STYLE}' align='right'>Amount (₹)</th></tr>"
            "{%- for l in lines %}"
            f"<tr><td style='{_TD_STYLE}'>{{{{ l.label }}}}</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ l.amount | money }}}}</td></tr>"
            "{% endfor %}"
            f"<tr><td style='{_TDB_STYLE}'>Agreement value</td>"
            f"<td style='{_TDB_STYLE}'>{{{{ agreement_value | money }}}}</td></tr>"
            f"<tr><td style='{_TD_STYLE}'>GST @ {{{{ gst_rate }}}}%</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ gst_amount | money }}}}</td></tr>"
            f"<tr><td style='{_TD_STYLE}'>Stamp duty</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ stamp_duty | money }}}}</td></tr>"
            f"<tr><td style='{_TD_STYLE}'>Registration fee</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ registration_fee | money }}}}</td></tr>"
            f"<tr><td style='{_TDB_STYLE}'>Total cost</td>"
            f"<td style='{_TDB_STYLE}'>{{{{ total_cost | money }}}}</td></tr>"
            "</table>"
            "{% if terms %}<p style='font-size:12px;color:#555'>{{ terms }}</p>{% endif %}"
            "</div>"
        ),
    },
    "quotation": {
        "subject": "Quotation {{ quote_no }} — Unit {{ unit_number }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h3>Quotation — {{ quote_no }}</h3>"
            "<p>Date: {{ date }} &nbsp;|&nbsp; Valid until: {{ valid_until }}</p>"
            "<p>To,<br/><b>{{ customer_name }}</b></p>"
            "<p>Project: <b>{{ project_name }}</b> &nbsp; Unit: <b>{{ unit_number }}</b></p>"
            f"<table style='{_TABLE_STYLE}'>"
            f"<tr><th style='{_TH_STYLE}'>Description</th><th style='{_TH_STYLE}' align='right'>Amount (₹)</th></tr>"
            "{%- for l in lines %}"
            f"<tr><td style='{_TD_STYLE}'>{{{{ l.label }}}}</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ l.amount | money }}}}</td></tr>"
            "{% endfor %}"
            f"<tr><td style='{_TDB_STYLE}'>Agreement value</td>"
            f"<td style='{_TDB_STYLE}'>{{{{ agreement_value | money }}}}</td></tr>"
            f"<tr><td style='{_TD_STYLE}'>GST @ {{{{ gst_rate }}}}%</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ gst_amount | money }}}}</td></tr>"
            f"<tr><td style='{_TDB_STYLE}'>Total cost</td>"
            f"<td style='{_TDB_STYLE}'>{{{{ total_cost | money }}}}</td></tr>"
            "</table>"
            "{% if terms %}<p style='font-size:12px;color:#555'>{{ terms }}</p>{% endif %}"
            "</div>"
        ),
    },
    "statement_of_account": {
        "subject": "Statement of account — Unit {{ unit_number }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h3>Statement of account</h3>"
            "<p>Unit: <b>{{ unit_number }}</b> &nbsp;|&nbsp; Booking: {{ booking_no }} &nbsp;|&nbsp; Date: {{ date }}</p>"
            "<p>Customer: <b>{{ customer_name }}</b></p>"
            f"<table style='{_TABLE_STYLE}'>"
            f"<tr><th style='{_TH_STYLE}'>Date</th><th style='{_TH_STYLE}'>Description</th>"
            f"<th style='{_TH_STYLE}' align='right'>Demand (₹)</th>"
            f"<th style='{_TH_STYLE}' align='right'>Paid (₹)</th>"
            f"<th style='{_TH_STYLE}' align='right'>Balance (₹)</th></tr>"
            "{%- for row in ledger_rows %}"
            f"<tr><td style='{_TD_STYLE}'>{{{{ row.date }}}}</td>"
            f"<td style='{_TD_STYLE}'>{{{{ row.description }}}}</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ row.demand | money }}}}</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ row.paid | money }}}}</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ row.balance | money }}}}</td></tr>"
            "{% endfor %}"
            f"<tr><td style='{_TDB_STYLE}' colspan='2'>Total</td>"
            f"<td style='{_TDB_STYLE}'>{{{{ total_demand | money }}}}</td>"
            f"<td style='{_TDB_STYLE}'>{{{{ total_paid | money }}}}</td>"
            f"<td style='{_TDB_STYLE}'>{{{{ balance_due | money }}}}</td></tr>"
            "</table></div>"
        ),
    },
    "payment_schedule": {
        "subject": "Payment schedule — Unit {{ unit_number }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<h3>Payment schedule — Unit {{ unit_number }}</h3>"
            "<p>Plan: <b>{{ plan_name }}</b> &nbsp;|&nbsp; Booking: {{ booking_no }}</p>"
            f"<table style='{_TABLE_STYLE}'>"
            f"<tr><th style='{_TH_STYLE}'>#</th><th style='{_TH_STYLE}'>Stage</th>"
            f"<th style='{_TH_STYLE}'>Due date</th><th style='{_TH_STYLE}' align='right'>Amount (₹)</th>"
            f"<th style='{_TH_STYLE}' align='right'>GST (₹)</th>"
            f"<th style='{_TH_STYLE}'>Status</th></tr>"
            "{%- for ins in instalments %}"
            f"<tr><td style='{_TD_STYLE}'>{{{{ loop.index }}}}</td>"
            f"<td style='{_TD_STYLE}'>{{{{ ins.stage_name }}}}</td>"
            f"<td style='{_TD_STYLE}'>{{{{ ins.due_date }}}}</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ ins.amount | money }}}}</td>"
            f"<td style='{_TDR_STYLE}'>{{{{ ins.gst | money }}}}</td>"
            f"<td style='{_TD_STYLE}'>{{{{ ins.status }}}}</td></tr>"
            "{% endfor %}"
            "</table></div>"
        ),
    },
    "demand_note": {
        "subject": "Demand note {{ demand_no }} — Unit {{ unit_number }}",
        "body": (
            f"<div style='{_STYLE}'>"
            "<p>Date: {{ date }}<br/>Demand No: <b>{{ demand_no }}</b></p>"
            "<p>To,<br/><b>{{ customer_name }}</b><br/>{{ customer_address }}</p>"
            "<p><b>Sub: Demand note for {{ stage_name }} — Unit {{ unit_number }}, {{ project_name }}</b></p>"
            "<p>Kindly pay <b>₹{{ total | money }}</b> ({{ total | inr_words }} Rupees) by <b>{{ due_date }}</b>.</p>"
            "<p>For {{ developer_entity }}</p></div>"
        ),
    },
}


# ---------------------------------------------------------------------------
# Merge-field registry  (shown in the frontend field-picker)
# ---------------------------------------------------------------------------

_F = dict  # shorthand

MERGE_FIELDS: dict[str, list[dict[str, str]]] = {
    "_common": [
        _F(key="date", label="Today's date", sample="24 Oct 2026"),
        _F(key="developer_entity", label="Developer / company name", sample="ABC Developers Pvt Ltd"),
        _F(key="project_name", label="Project name", sample="Skyline Residency"),
        _F(key="unit_number", label="Unit number", sample="A-1204"),
        _F(key="tower_name", label="Tower name", sample="Tower A"),
        _F(key="floor_number", label="Floor number", sample="12"),
        _F(key="super_area", label="Super built-up area (sq.ft.)", sample="1250"),
        _F(key="carpet_area", label="Carpet area (sq.ft.)", sample="980"),
        _F(key="rera_number", label="RERA registration number", sample="MH/01/23/12345"),
        _F(key="customer_name", label="Customer name", sample="Asha Verma"),
        _F(key="customer_address", label="Customer address", sample="42, MG Road, Pune 411001"),
        _F(key="booking_no", label="Booking number", sample="BK-26-00001"),
        _F(key="booking_date", label="Booking date", sample="01 Jan 2026"),
        _F(key="agreement_value", label="Agreement value (₹)", sample="9500000"),
        _F(key="gst_rate", label="GST rate (%)", sample="5"),
        _F(key="gst_amount", label="GST amount (₹)", sample="475000"),
        _F(key="stamp_duty", label="Stamp duty (₹)", sample="570000"),
        _F(key="registration_fee", label="Registration fee (₹)", sample="95000"),
        _F(key="total_cost", label="Total cost (₹)", sample="10640000"),
        _F(key="paid_amount", label="Amount paid to date (₹)", sample="950000"),
        _F(key="balance_due", label="Balance due (₹)", sample="9690000"),
        _F(key="city", label="City", sample="Pune"),
    ],
    "allotment_letter": [
        _F(key="allotment_no", label="Allotment number", sample="AL-26-00001"),
        _F(key="possession_date", label="Committed possession date", sample="31 Mar 2028"),
    ],
    "demand_letter": [
        _F(key="demand_no", label="Demand number", sample="DM-26-00001"),
        _F(key="stage_name", label="Payment stage", sample="Plinth"),
        _F(key="due_date", label="Payment due date", sample="30 Nov 2026"),
        _F(key="amount", label="Instalment amount (₹)", sample="950000"),
        _F(key="interest", label="Interest / late fee (₹)", sample="0"),
        _F(key="interest_rate", label="Interest rate (% p.a.)", sample="10.5"),
        _F(key="total", label="Total payable (₹)", sample="1425000"),
    ],
    "demand_note": [
        _F(key="demand_no", label="Demand number", sample="DM-26-00001"),
        _F(key="stage_name", label="Payment stage", sample="Plinth"),
        _F(key="due_date", label="Payment due date", sample="30 Nov 2026"),
        _F(key="total", label="Total payable (₹)", sample="1425000"),
    ],
    "payment_receipt": [
        _F(key="receipt_no", label="Receipt number", sample="RC-26-00001"),
        _F(key="amount", label="Amount received (₹)", sample="950000"),
        _F(key="mode", label="Payment mode", sample="NEFT"),
        _F(key="reference_no", label="Transaction / cheque reference", sample="TXN123456"),
    ],
    "agreement_for_sale": [
        _F(key="possession_date", label="Committed possession date", sample="31 Mar 2028"),
    ],
    "sale_deed": [],
    "possession_letter": [
        _F(key="possession_date", label="Actual possession date", sample="15 Oct 2026"),
    ],
    "cancellation_letter": [
        _F(key="total_paid", label="Total amount paid (₹)", sample="1900000"),
        _F(key="deductions", label="Deductions (₹)", sample="190000"),
        _F(key="refundable_amount", label="Refundable amount (₹)", sample="1710000"),
    ],
    "refund_letter": [
        _F(key="refundable_amount", label="Refundable amount (₹)", sample="1710000"),
        _F(key="mode", label="Refund mode", sample="RTGS"),
        _F(key="reference_no", label="Transaction reference", sample="RTG987654"),
    ],
    "lease_agreement": [
        _F(key="lease_no", label="Lease number", sample="LS-26-00001"),
        _F(key="start_date", label="Lease start date", sample="01 Nov 2026"),
        _F(key="end_date", label="Lease end date", sample="31 Oct 2027"),
        _F(key="lock_in_months", label="Lock-in period (months)", sample="6"),
        _F(key="monthly_rent", label="Monthly rent (₹)", sample="45000"),
        _F(key="escalation", label="Annual escalation (%)", sample="5%"),
        _F(key="security_deposit", label="Security deposit (₹)", sample="135000"),
    ],
    "welcome_letter": [
        _F(key="care_email", label="Care team email", sample="care@skyline.in"),
        _F(key="care_phone", label="Care team phone", sample="+91-20-1234-5678"),
    ],
    "noc": [],
    "cost_sheet": [
        _F(key="lines", label="Cost sheet line items (list)", sample="[{label, amount}]"),
        _F(key="terms", label="Terms & conditions note", sample="Prices are exclusive of GST."),
    ],
    "quotation": [
        _F(key="quote_no", label="Quotation number", sample="QT-26-00001"),
        _F(key="valid_until", label="Validity date", sample="30 Nov 2026"),
        _F(key="lines", label="Cost sheet line items (list)", sample="[{label, amount}]"),
        _F(key="terms", label="Terms & conditions", sample="Subject to availability."),
    ],
    "statement_of_account": [
        _F(key="ledger_rows", label="Ledger rows (list)", sample="[{date, description, demand, paid, balance}]"),
        _F(key="total_demand", label="Total demanded (₹)", sample="9500000"),
        _F(key="total_paid", label="Total paid (₹)", sample="4750000"),
        _F(key="balance_due", label="Balance due (₹)", sample="4750000"),
    ],
    "payment_schedule": [
        _F(key="plan_name", label="Payment plan name", sample="Construction-linked"),
        _F(key="instalments", label="Instalment rows (list)", sample="[{stage_name, due_date, amount, gst, status}]"),
    ],
}


# ---------------------------------------------------------------------------
# Print-settings wrapper
# ---------------------------------------------------------------------------

_PAGE_CSS = """\
@page {{
  size: {page_size} {orientation};
  margin: {margin_mm}mm;
}}
@media print {{
  body {{ -webkit-print-color-adjust: exact; }}
}}
"""

_WATERMARK_CSS = """\
.watermark {{
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%,-50%) rotate(-40deg);
  font-size: 80px; opacity: 0.08; color: #000;
  white-space: nowrap; pointer-events: none; z-index: 9999;
}}
"""


def wrap_print(
    body_html: str,
    settings: dict[str, Any],
    ctx_values: dict[str, Any],
) -> str:
    """Wrap *body_html* in a complete print-ready HTML document.

    *settings* is the ``print_settings`` JSONB dict from ``ReTemplate``
    (or ``{}`` to use built-in defaults).  *ctx_values* are passed to the
    header/footer sub-templates so they can reference merge fields.
    """
    page_size = settings.get("page_size", "A4")
    orientation = settings.get("orientation", "portrait")
    margin_mm = int(settings.get("margin_mm", 15))
    font_family = settings.get("font_family", "Arial, Helvetica, sans-serif")
    font_size_px = int(settings.get("font_size_px", 13))
    custom_css = settings.get("custom_css", "")
    watermark = settings.get("watermark", "")
    logo_url = settings.get("logo_url", "")
    header_html = settings.get(
        "header_html",
        "{% if logo_url %}<img src='{{ logo_url }}' style='height:50px'/>{% endif %}"
        "<span style='float:right;font-size:12px'>{{ developer_entity }}</span>",
    )
    footer_html = settings.get(
        "footer_html",
        "<hr style='margin:0'/>"
        "<p style='font-size:11px;color:#555;text-align:center'>"
        "{{ project_name }} &nbsp;|&nbsp; {{ rera_number }}"
        "</p>",
    )
    show_signature = settings.get("show_signature", False)
    signatory_name = settings.get("signatory_name", "")
    signature_url = settings.get("signature_url", "")

    vals = {**ctx_values, "logo_url": logo_url}
    rendered_header = render_string(header_html, vals)
    rendered_footer = render_string(footer_html, vals)

    page_css = _PAGE_CSS.format(
        page_size=_html.escape(page_size),
        orientation=_html.escape(orientation),
        margin_mm=margin_mm,
    )
    wm_css = _WATERMARK_CSS if watermark else ""
    sig_html = ""
    if show_signature:
        sig_html = (
            "<div style='margin-top:48px'>"
            + (f"<img src='{_html.escape(signature_url)}' style='height:60px'/><br/>" if signature_url else "")
            + f"<span style='font-size:13px'>{_html.escape(signatory_name)}</span>"
            "</div>"
        )
    wm_html = (
        f"<div class='watermark'>{_html.escape(watermark)}</div>" if watermark else ""
    )

    return (
        "<!doctype html><html><head>"
        "<meta charset='utf-8'/>"
        f"<style>"
        f"body{{font-family:{font_family};font-size:{font_size_px}px;color:#111;margin:0}}"
        f"table{{border-collapse:collapse;width:100%}}"
        f"{page_css}"
        f"{wm_css}"
        f"{custom_css}"
        f"</style></head><body>"
        f"{wm_html}"
        f"<header style='margin-bottom:16px'>{rendered_header}</header>"
        f"<main>{body_html}{sig_html}</main>"
        f"<footer style='margin-top:32px'>{rendered_footer}</footer>"
        "</body></html>"
    )


# ---------------------------------------------------------------------------
# Public render API
# ---------------------------------------------------------------------------

SAMPLE_VALUES: dict[str, Any] = {
    "customer_name": "Asha Verma",
    "customer_address": "42, MG Road, Pune 411001",
    "unit_number": "A-1204",
    "tower_name": "Tower A",
    "project_name": "Skyline Residency",
    "floor_number": "12",
    "super_area": "1250",
    "carpet_area": "980",
    "city": "Pune",
    "rera_number": "MH/01/23/12345",
    "developer_entity": "ABC Developers Pvt Ltd",
    "date": "24 Oct 2026",
    "booking_no": "BK-26-00001",
    "booking_date": "01 Jan 2026",
    "allotment_no": "AL-26-00001",
    "agreement_value": 9_500_000,
    "gst_rate": 5,
    "gst_amount": 475_000,
    "stamp_duty": 570_000,
    "registration_fee": 95_000,
    "total_cost": 10_640_000,
    "paid_amount": 950_000,
    "balance_due": 4_750_000,
    "possession_date": "31 Mar 2028",
    "demand_no": "DM-26-00001",
    "stage_name": "Plinth",
    "due_date": "30 Nov 2026",
    "amount": 950_000,
    "interest": 0,
    "interest_rate": 10.5,
    "total": 1_425_000,
    "receipt_no": "RC-26-00001",
    "mode": "NEFT",
    "reference_no": "TXN123456",
    "total_paid": 4_750_000,
    "total_demand": 9_500_000,
    "deductions": 190_000,
    "refundable_amount": 1_710_000,
    "lease_no": "LS-26-00001",
    "start_date": "01 Nov 2026",
    "end_date": "31 Oct 2027",
    "lock_in_months": 6,
    "monthly_rent": 45_000,
    "escalation": "5%",
    "security_deposit": 135_000,
    "care_email": "care@skyline.in",
    "care_phone": "+91-20-1234-5678",
    "quote_no": "QT-26-00001",
    "valid_until": "30 Nov 2026",
    "plan_name": "Construction-linked",
    "terms": "All prices are subject to applicable taxes.",
    # Lists used by financial templates
    "lines": [
        {"label": "Basic price", "amount": 8_500_000},
        {"label": "Preferred location charges", "amount": 250_000},
        {"label": "Car parking", "amount": 500_000},
        {"label": "Club / amenities", "amount": 250_000},
    ],
    "ledger_rows": [
        {"date": "01 Jan 2026", "description": "Token (on booking)", "demand": 950_000, "paid": 950_000, "balance": 0},
        {"date": "15 Mar 2026", "description": "Plinth", "demand": 1_900_000, "paid": 0, "balance": 1_900_000},
    ],
    "instalments": [
        {"stage_name": "On booking", "due_date": "01 Jan 2026", "amount": 950_000, "gst": 47_500, "status": "paid"},
        {"stage_name": "Plinth", "due_date": "30 Nov 2026", "amount": 1_900_000, "gst": 95_000, "status": "pending"},
        {"stage_name": "Slab 1", "due_date": "28 Feb 2027", "amount": 1_900_000, "gst": 95_000, "status": "pending"},
    ],
}


async def render_template(
    db: AsyncSession,
    vendor_id: UUID,
    template_type: str,
    values: dict[str, Any],
    *,
    wrap: bool = True,
) -> dict[str, Optional[str]]:
    """Render the vendor override for *template_type* (or the built-in default).

    Returns ``{"subject": str, "html": str}``.  When *wrap* is True the HTML
    is a complete print-ready document (with ``@page`` CSS and letterhead);
    when False it is the raw body fragment (used internally for storage).
    """
    override = (
        await db.execute(
            select(ReTemplate)
            .where(
                ReTemplate.vendor_id == vendor_id,
                ReTemplate.template_type == template_type,
                ReTemplate.is_active.is_(True),
            )
            .order_by(ReTemplate.is_default.desc(), ReTemplate.updated_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if override is not None:
        subject_tpl = override.subject or ""
        body_tpl = override.body or ""
        ps: dict[str, Any] = override.print_settings or {}
    else:
        default = DEFAULT_TEMPLATES.get(template_type, {"subject": template_type, "body": ""})
        subject_tpl = default["subject"]
        body_tpl = default["body"]
        ps = {}

    subject = render_string(subject_tpl, values)
    body = render_string(body_tpl, values)
    html = wrap_print(body, ps, values) if wrap else body
    return {"subject": subject, "html": html}
