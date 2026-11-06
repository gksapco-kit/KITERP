"""Print-ready payslip HTML layouts (InfocomX-style stationery)."""

from __future__ import annotations

from datetime import date, datetime
from html import escape
from typing import Any, Mapping

from app.services.infocomx_branding import resolve_infocomx_logo_url
from app.utils.pdf_generator import amount_in_words

DEFAULT_LAYOUT = "infocomx"

EARNINGS_ROWS: list[tuple[str, tuple[str, ...]]] = [
    ("Basic", ("basic",)),
    ("HRA", ("hra", "house_rent_allowance")),
    ("Dearness Allowance", ("da", "dearness_allowance")),
    ("Medical Allowance", ("medical", "medical_allowance")),
    ("Children Hostel Allowance/Shift", ("children_hostel_allowance", "children_hostel", "hostel_allowance")),
    ("Allowance", ("allowance", "conveyance")),
    ("Stand By Allowance", ("stand_by_allowance", "standby_allowance", "stand_by")),
    ("Special Allowance", ("special_allowance",)),
]

DEDUCTION_ROWS: list[tuple[str, tuple[str, ...]]] = [
    ("Provident Fund", ("provident_fund", "pf", "pf_employee")),
    ("ESI", ("esi_employee", "esi")),
    ("Professional Tax", ("professional_tax", "pt")),
    ("Income Tax", ("income_tax", "tds")),
]


def _norm_key(key: str) -> str:
    return key.lower().replace(" ", "_").replace("/", "_").replace("-", "_")


def _normalized_amounts(data: Mapping[str, Any] | None) -> dict[str, float]:
    out: dict[str, float] = {}
    for raw_key, raw_val in (data or {}).items():
        try:
            out[_norm_key(str(raw_key))] = float(raw_val or 0)
        except (TypeError, ValueError):
            continue
    return out


def _pick_amount(data: Mapping[str, Any] | None, aliases: tuple[str, ...]) -> float:
    amounts = _normalized_amounts(data)
    for alias in aliases:
        if alias in amounts:
            return amounts[alias]
    for key, val in amounts.items():
        for alias in aliases:
            if alias in key or key in alias:
                return val
    return 0.0


def _fmt_money(value: float) -> str:
    return f"{value:,.2f}"


def _fmt_dmy(value: date | datetime | None) -> str:
    if not value:
        return ""
    if isinstance(value, datetime):
        value = value.date()
    return value.strftime("%d-%m-%Y")


def _gender_short(value: str | None) -> str:
    if not value:
        return ""
    v = value.strip().lower()
    if v in ("m", "male"):
        return "M"
    if v in ("f", "female"):
        return "F"
    return value.strip()[:1].upper()


def _net_pay_words(net: float) -> str:
    text = amount_in_words(net)
    if text.startswith("Indian Rupees "):
        return text.replace("Indian Rupees ", "Rupees ", 1)
    return text or "Rupees Zero Only"


def _cell(label: str, value: str) -> str:
    return (
        f'<td style="border:1px solid #000;padding:4px 6px;font-size:11px;vertical-align:top;">'
        f'<span style="font-weight:600;">{escape(label)}</span> {escape(value)}</td>'
    )


def _amount_row(label: str, amount: float) -> str:
    return (
        f"<tr>"
        f'<td style="border:1px solid #000;padding:4px 6px;font-size:11px;">{escape(label)}</td>'
        f'<td style="border:1px solid #000;padding:4px 6px;font-size:11px;text-align:right;">{_fmt_money(amount)}</td>'
        f"</tr>"
    )


def render_infocomx_payslip(
    *,
    company_name: str,
    company_address: str,
    logo_url: str | None,
    infocomx_stationery: bool = True,
    pay_period_label: str,
    emp_code: str,
    emp_name: str,
    department: str,
    cost_center: str,
    pf_no: str,
    location: str,
    designation: str,
    esi_no: str,
    date_of_birth: str,
    bank_account: str,
    pan_no: str,
    date_of_joining: str,
    gender: str,
    eps_no: str,
    uan: str,
    regime_type: str,
    earnings: Mapping[str, Any] | None,
    deductions: Mapping[str, Any] | None,
    gross_amount: float,
    total_deductions: float,
    net_amount: float,
) -> str:
    earn_body = "".join(_amount_row(label, _pick_amount(earnings, keys)) for label, keys in EARNINGS_ROWS)
    ded_body = "".join(_amount_row(label, _pick_amount(deductions, keys)) for label, keys in DEDUCTION_ROWS)

    if infocomx_stationery:
        resolved_logo = resolve_infocomx_logo_url(logo_url)
        logo_block = (
            f'<img src="{escape(resolved_logo)}" alt="InfocomX" class="infocomx-brand-logo" '
            f'data-infocomx-logo="true" style="height:48px;width:auto;max-width:220px;object-fit:contain;'
            f'display:block;border:0;background:transparent;" />'
            if resolved_logo
            else (
                '<div style="font-size:26px;font-weight:800;color:#1e3a5f;letter-spacing:-0.5px;">'
                'INFO<span style="color:#111;">COMX</span></div>'
            )
        )
        default_company = "Infocomx Technologies Private Limited"
        default_address = "Hyderabad, Telangana, India - 500090"
    else:
        raw = (logo_url or "").strip()
        if raw:
            logo_block = (
                f'<img src="{escape(raw)}" alt="" style="height:48px;width:auto;max-width:220px;'
                f'object-fit:contain;display:block;border:0;background:transparent;" />'
            )
        else:
            cn = (company_name or "Company").strip() or "Company"
            logo_block = (
                f'<div style="font-size:15px;font-weight:700;color:#1e3a5f;">{escape(cn)}</div>'
            )
        default_company = ""
        default_address = ""

    company = escape(company_name or default_company)
    address = escape(company_address or default_address)
    period = escape(pay_period_label)
    gender_label = _gender_short(gender)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Pay Slip — {period}</title>
<style>
  @page {{ margin: 12mm; }}
  body {{ font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 16px; color: #111; background: #fff; }}
  .sheet {{ border: 1px solid #000; max-width: 820px; margin: 0 auto; padding: 14px 16px 18px; box-sizing: border-box; }}
  table {{ border-collapse: collapse; width: 100%; }}
  img.infocomx-brand-logo,img[data-infocomx-logo="true"],.sheet img{{
    height:48px!important;width:auto!important;max-width:220px!important;
    object-fit:contain!important;display:block!important;border:0!important;
    background:transparent!important;
  }}
  @media print {{
    body {{ padding: 0; }}
    .sheet {{ border: 1px solid #000; max-width: none; }}
  }}
</style>
</head>
<body>
<div class="sheet">
  <table style="margin-bottom:10px;border:none;">
    <tr>
      <td style="border:none;width:38%;vertical-align:middle;">{logo_block}</td>
      <td style="border:none;text-align:center;vertical-align:middle;">
        <div style="font-size:13px;font-weight:700;">{company}</div>
        <div style="font-size:11px;margin-top:4px;">{address}</div>
        <div style="font-size:12px;font-weight:700;margin-top:10px;letter-spacing:.02em;">
          PAY SLIP FOR THE MONTH OF {period.upper()}
        </div>
      </td>
      <td style="border:none;width:38%;"></td>
    </tr>
  </table>

  <table style="margin-bottom:8px;">
    <tr>
      {_cell("Emp Code", emp_code)}
      {_cell("Emp Name", emp_name)}
      <td style="border:1px solid #000;padding:4px 6px;"></td>
    </tr>
    <tr>
      {_cell("Department", department)}
      {_cell("Cost Center", cost_center)}
      {_cell("PF No.", pf_no)}
    </tr>
    <tr>
      {_cell("Location", location)}
      {_cell("Designation", designation)}
      {_cell("ESI No.", esi_no)}
    </tr>
    <tr>
      {_cell("Date of Birth", date_of_birth)}
      {_cell("Bank A/c No", bank_account)}
      {_cell("Pan No.", pan_no)}
    </tr>
    <tr>
      {_cell("Date of Joining", date_of_joining)}
      {_cell("Gender", gender_label)}
      {_cell("EPS No.", eps_no)}
    </tr>
    <tr>
      {_cell("UAN", uan)}
      <td style="border:1px solid #000;padding:4px 6px;" colspan="2"></td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:4px 6px;font-size:11px;font-weight:600;" colspan="3">Regime Type {escape(regime_type)}</td>
    </tr>
  </table>

  <table>
    <tr>
      <td style="border:1px solid #000;padding:0;vertical-align:top;width:50%;">
        <table style="width:100%;border:none;">
          <tr>
            <th style="border:1px solid #000;padding:5px 6px;font-size:11px;text-align:left;background:#f3f4f6;">Earnings</th>
            <th style="border:1px solid #000;padding:5px 6px;font-size:11px;text-align:right;background:#f3f4f6;">Amount</th>
          </tr>
          {earn_body}
          <tr>
            <td style="border:1px solid #000;padding:5px 6px;font-size:11px;font-weight:700;">Total Earnings</td>
            <td style="border:1px solid #000;padding:5px 6px;font-size:11px;font-weight:700;text-align:right;">{_fmt_money(gross_amount)}</td>
          </tr>
        </table>
      </td>
      <td style="border:1px solid #000;padding:0;vertical-align:top;width:50%;">
        <table style="width:100%;border:none;">
          <tr>
            <th style="border:1px solid #000;padding:5px 6px;font-size:11px;text-align:left;background:#f3f4f6;">Deductions</th>
            <th style="border:1px solid #000;padding:5px 6px;font-size:11px;text-align:right;background:#f3f4f6;">Amount</th>
          </tr>
          {ded_body}
          <tr>
            <td style="border:1px solid #000;padding:5px 6px;font-size:11px;font-weight:700;">Total Deductions</td>
            <td style="border:1px solid #000;padding:5px 6px;font-size:11px;font-weight:700;text-align:right;">{_fmt_money(total_deductions)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="margin-top:14px;font-size:12px;">
    <div><strong>Net Pay:</strong> Rs. {_fmt_money(net_amount)}</div>
    <div style="margin-top:6px;"><strong>In Words:</strong> {_net_pay_words(net_amount)}</div>
  </div>

  <p style="margin-top:18px;text-align:center;font-size:11px;color:#374151;">
    This is electronically generated document no signature required.
  </p>
</div>
</body>
</html>"""


def render_payslip_html(layout: str, ctx: dict[str, Any]) -> str:
    """Render payslip HTML. ``infocomx`` uses InfocomX stationery when ``infocomx_stationery`` is True."""
    if layout != "infocomx":
        ctx = {**ctx, "infocomx_stationery": False}
    return render_infocomx_payslip(**ctx)
