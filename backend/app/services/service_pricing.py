"""Resolve storefront display price for services.

Services often keep a zero top-level price and store the real amount on a plan.
Listing and live-feed cards must use that plan amount so they show currency
instead of “Get a Quote”.
"""
from __future__ import annotations

from typing import Any


def _num(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def effective_service_display_price(service: Any) -> float | None:
    """Service-level amount, else first active plan with price > 0."""
    price_type = getattr(service, "price_type", None) or "fixed"
    if price_type == "not_applicable":
        return None
    if price_type == "free":
        return 0.0

    price = _num(getattr(service, "price", None))
    if price is not None and price > 0:
        return price
    price_min = _num(getattr(service, "price_min", None))
    if price_min is not None and price_min > 0:
        return price_min

    plans = list(getattr(service, "plans", None) or [])
    active = [p for p in plans if getattr(p, "is_active", True) is not False]
    pool = sorted(active or plans, key=lambda p: getattr(p, "sort_order", 0) or 0)
    for plan in pool:
        plan_type = getattr(plan, "plan_price_type", None)
        if plan_type == "not_applicable":
            continue
        if plan_type == "free":
            return 0.0
        amount = _num(getattr(plan, "price", None))
        if amount is not None and amount > 0:
            return amount
        plan_min = _num(getattr(plan, "price_min", None))
        if plan_min is not None and plan_min > 0:
            return plan_min
    return None


def live_service_price_fields(service: Any) -> dict[str, Any]:
    currency = getattr(service, "currency", None) or "INR"
    price_type = getattr(service, "price_type", None) or "fixed"
    if price_type == "free":
        return {"price": 0, "price_formatted": "Free"}
    if price_type == "not_applicable":
        return {"price": None, "price_formatted": None}
    amount = effective_service_display_price(service)
    if amount is not None and amount > 0:
        return {"price": amount, "price_formatted": f"{currency} {amount:,.0f}"}
    return {"price": None, "price_formatted": "Get a Quote"}
