"""Unit pricing, cost sheet, GST / TDS 194-IA helpers (India-first)."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from .common import D, money_q

TDS_194IA_THRESHOLD = Decimal("5000000")  # 50 lakh consideration
TDS_194IA_RATE = Decimal("1")  # percent


def saleable_area(unit: Any) -> Decimal:
    """Area on which rate is charged: super built-up, else built-up, else carpet."""
    for attr in ("super_area", "built_up_area", "carpet_area"):
        val = D(getattr(unit, attr, 0))
        if val > 0:
            return val
    return Decimal(0)


def unit_price_components(unit: Any) -> dict[str, Decimal]:
    area = saleable_area(unit)
    return {
        "basic": money_q(D(unit.base_rate) * area),
        "floor_rise": money_q(D(unit.floor_rise_rate) * area),
        "plc": money_q(D(unit.plc_amount)),
        "parking": money_q(D(unit.parking_amount)),
        "club": money_q(D(unit.club_amount)),
        "other": money_q(D(unit.other_charges)),
    }


def unit_total_price(unit: Any) -> Decimal:
    return money_q(sum(unit_price_components(unit).values(), Decimal(0)))


def cost_sheet(
    unit: Any,
    project: Any,
    *,
    discount: Decimal | float | int = 0,
    gst_rate: Optional[Decimal | float] = None,
) -> dict[str, Any]:
    """Itemised cost sheet: agreement value, GST, stamp duty, registration and grand total."""
    comp = unit_price_components(unit)
    gross = sum(comp.values(), Decimal(0))
    disc = min(D(discount), gross)
    agreement = money_q(gross - disc)
    rate = D(gst_rate if gst_rate is not None else getattr(project, "gst_rate", 0))
    gst = money_q(agreement * rate / 100)
    stamp = money_q(agreement * D(getattr(project, "stamp_duty_pct", 0)) / 100)
    reg = money_q(agreement * D(getattr(project, "registration_fee_pct", 0)) / 100)
    lines = [
        {"label": "Basic price", "amount": comp["basic"]},
        {"label": "Floor rise", "amount": comp["floor_rise"]},
        {"label": "Preferred location charges", "amount": comp["plc"]},
        {"label": "Car parking", "amount": comp["parking"]},
        {"label": "Club / amenities", "amount": comp["club"]},
        {"label": "Other charges", "amount": comp["other"]},
        {"label": "Discount", "amount": -disc},
    ]
    return {
        "components": {k: float(v) for k, v in comp.items()},
        "discount": disc,
        "agreement_value": agreement,
        "gst_rate": rate,
        "gst_amount": gst,
        "stamp_duty": stamp,
        "registration_fee": reg,
        "total_cost": money_q(agreement + gst + stamp + reg),
        "lines": [{"label": ln["label"], "amount": float(ln["amount"])} for ln in lines if ln["amount"] != 0],
    }


def tds_194ia(agreement_value: Decimal | float, payment: Decimal | float, stamp_duty_value: Decimal | float | None = None) -> Decimal:
    """TDS u/s 194-IA: 1% on every payment when total consideration is >= 50 lakh.

    When the stamp-duty (circle-rate) value of the property is known and is higher than the agreed price, the Act
    tests the threshold against that higher value (s.50C / 43CA), so pass it when available.
    """
    consideration = max(D(agreement_value), D(stamp_duty_value or 0))
    if consideration < TDS_194IA_THRESHOLD:
        return Decimal("0.00")
    return money_q(D(payment) * TDS_194IA_RATE / 100)
