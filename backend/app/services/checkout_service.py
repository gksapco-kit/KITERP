"""Server-side checkout totals: shipping methods, GST, coupons."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.services.coupon_service import CouponService

DEFAULT_SHIPPING_METHODS: list[dict[str, Any]] = [
    {
        "id": "free",
        "label": "Free Delivery",
        "description": "3–7 business days",
        "amount": 0,
        "estimated_days_min": 3,
        "estimated_days_max": 7,
    },
    {
        "id": "express",
        "label": "Express Delivery",
        "description": "1–2 business days",
        "amount": 99,
        "estimated_days_min": 1,
        "estimated_days_max": 2,
    },
]


def _checkout_config(vendor: Vendor) -> dict:
    return (vendor.theme_config or {}).get("checkout") or {}


def get_express_delivery_config(vendor: Vendor) -> dict[str, Any]:
    raw = _checkout_config(vendor).get("express_delivery")
    if not isinstance(raw, dict):
        return {"enabled": False, "amount": 99}
    return {
        "enabled": bool(raw.get("enabled")),
        "amount": float(raw.get("amount") if raw.get("amount") is not None else 99),
        "label": str(raw.get("label") or "Express Delivery").strip() or "Express Delivery",
        "description": str(raw.get("description") or "1–2 business days").strip() or "1–2 business days",
        "estimated_days_min": int(raw.get("estimated_days_min") or 1),
        "estimated_days_max": int(raw.get("estimated_days_max") or 2),
    }


def get_shipping_methods(vendor: Vendor) -> list[dict[str, Any]]:
    express_cfg = get_express_delivery_config(vendor)
    custom = _checkout_config(vendor).get("shipping_methods")

    if isinstance(custom, list) and custom:
        methods = [dict(m) for m in custom]
    else:
        methods = [dict(DEFAULT_SHIPPING_METHODS[0])]

    if express_cfg.get("enabled"):
        express_method = {
            "id": "express",
            "label": express_cfg["label"],
            "description": express_cfg["description"],
            "amount": express_cfg["amount"],
            "estimated_days_min": express_cfg["estimated_days_min"],
            "estimated_days_max": express_cfg["estimated_days_max"],
        }
        methods = [m for m in methods if m.get("id") != "express"]
        methods.append(express_method)
    else:
        methods = [m for m in methods if m.get("id") != "express"]

    return methods


def get_payment_methods(vendor: Vendor) -> list[str]:
    methods = _checkout_config(vendor).get("payment_methods")
    if isinstance(methods, list) and methods:
        return [str(m) for m in methods]
    return ["cod", "razorpay"]


def get_manual_upi_config(vendor: Vendor) -> dict[str, Any]:
    """Vendor-uploaded UPI QR for manual checkout payments."""
    raw = _checkout_config(vendor).get("manual_upi")
    if not isinstance(raw, dict):
        return {}
    upi_id = str(raw.get("upi_id") or "").strip()
    qr_code_url = str(raw.get("qr_code_url") or "").strip()
    enabled = bool(raw.get("enabled")) and bool(upi_id or qr_code_url)
    return {
        "enabled": enabled,
        "upi_id": upi_id or None,
        "qr_code_url": qr_code_url or None,
        "label": str(raw.get("label") or "UPI").strip() or "UPI",
    }


def build_manual_upi_public_info(vendor: Vendor) -> dict[str, Any] | None:
    cfg = get_manual_upi_config(vendor)
    if not cfg.get("enabled"):
        return None
    return {
        "enabled": True,
        "upi_id": cfg.get("upi_id"),
        "qr_code_url": cfg.get("qr_code_url"),
        "label": cfg.get("label"),
        "business_name": vendor.display_name or vendor.business_name,
        "logo_url": vendor.logo_url,
    }


def get_razorpay_key_id(vendor: Vendor, platform_key: str) -> str:
    """Per-vendor key overrides platform default."""
    vendor_key = _checkout_config(vendor).get("razorpay_key_id")
    if vendor_key:
        return str(vendor_key)
    return platform_key


def shipping_amount_for_method(vendor: Vendor, method_id: str) -> float:
    for m in get_shipping_methods(vendor):
        if m.get("id") == method_id:
            return float(m.get("amount") or 0)
    return 0.0


def get_free_delivery_threshold(vendor: Vendor) -> float | None:
    """Minimum cart subtotal for zero delivery fee (vendor.settings.delivery_conditions)."""
    settings = vendor.settings if isinstance(vendor.settings, dict) else {}
    conditions = settings.get("delivery_conditions")
    if not isinstance(conditions, dict):
        return None
    if conditions.get("enabled") is False:
        return None
    raw = conditions.get("free_delivery_threshold")
    if raw is None:
        raw = conditions.get("min_order_amount")
    if raw is None:
        return None
    try:
        threshold = float(raw)
    except (TypeError, ValueError):
        return None
    return threshold if threshold > 0 else None


def get_minimum_delivery_charge(vendor: Vendor) -> float | None:
    settings = vendor.settings if isinstance(vendor.settings, dict) else {}
    conditions = settings.get("delivery_conditions")
    if not isinstance(conditions, dict) or conditions.get("enabled") is False:
        return None
    raw = conditions.get("minimum_delivery_charge")
    if raw is None:
        raw = conditions.get("min_delivery_charge")
    if raw is None:
        return None
    try:
        charge = float(raw)
    except (TypeError, ValueError):
        return None
    return charge if charge >= 0 else None


def should_calculate_gst(vendor: Vendor) -> bool:
    settings = vendor.settings if isinstance(vendor.settings, dict) else {}
    conditions = settings.get("delivery_conditions")
    if isinstance(conditions, dict) and "calculate_gst" in conditions:
        return bool(conditions.get("calculate_gst"))
    return bool(vendor.is_gst_registered)


def is_sign_in_mandatory(vendor: Vendor) -> bool:
    """When true, guest checkout is disabled for this storefront."""
    settings = vendor.settings if isinstance(vendor.settings, dict) else {}
    conditions = settings.get("delivery_conditions")
    if not isinstance(conditions, dict):
        return False
    return conditions.get("sign_in_mandatory") is True


def resolve_shipping_amount(
    vendor: Vendor,
    subtotal: float,
    shipping_method_id: str,
) -> tuple[float, bool]:
    method_amount = shipping_amount_for_method(vendor, shipping_method_id)

    # Paid methods (e.g. express) always bill their configured rate.
    if method_amount > 0:
        return method_amount, False

    threshold = get_free_delivery_threshold(vendor)
    if threshold is not None and subtotal >= threshold:
        return 0.0, True

    min_charge = get_minimum_delivery_charge(vendor)
    if min_charge is not None:
        return min_charge, False

    return method_amount, False

def _is_inter_state(vendor_state: str | None, shipping_state: str | None) -> bool:
    if not vendor_state or not shipping_state:
        return False
    return vendor_state.strip().lower() != shipping_state.strip().lower()


async def _product_tax_rates(db: AsyncSession, items: list[dict]) -> dict[str, float]:
    ids: list[UUID] = []
    for item in items:
        pid = item.get("product_id")
        if pid:
            try:
                ids.append(UUID(str(pid)))
            except ValueError:
                pass
    if not ids:
        return {}
    result = await db.execute(select(Product).where(Product.id.in_(ids)))
    products = result.scalars().all()
    rates: dict[str, float] = {}
    for p in products:
        rate = p.tax_rate or p.gst_rate
        rates[str(p.id)] = float(rate or 0)
    return rates


def _compute_line_taxes(
    items: list[dict],
    tax_rates: dict[str, float],
    vendor: Vendor,
    is_inter_state: bool,
) -> tuple[float, float, float, float, list[dict]]:
    """Returns subtotal, cgst, sgst, igst, tax_lines."""
    default_rate = float(vendor.default_tax_rate or 0) if vendor.is_gst_registered else 0.0
    calculate_tax = should_calculate_gst(vendor)
    subtotal = Decimal("0")
    cgst = sgst = igst = Decimal("0")
    tax_lines: list[dict] = []

    for item in items:
        qty = int(item.get("qty") or 0)
        price = Decimal(str(item.get("price") or 0))
        line_sub = price * qty
        subtotal += line_sub

        if not calculate_tax:
            continue

        pid = str(item.get("product_id") or "")
        rate = tax_rates.get(pid, default_rate) if vendor.is_gst_registered else 0.0
        rate_dec = Decimal(str(rate))
        taxable = line_sub

        if rate_dec <= 0:
            continue

        if is_inter_state:
            igst_amt = (taxable * rate_dec / Decimal("100")).quantize(Decimal("0.01"))
            igst += igst_amt
            tax_lines.append({
                "label": f"IGST ({rate}%) — {item.get('name', 'Item')}",
                "amount": float(igst_amt),
                "type": "igst",
                "rate": rate,
            })
        else:
            half = rate_dec / Decimal("2")
            cgst_amt = (taxable * half / Decimal("100")).quantize(Decimal("0.01"))
            sgst_amt = (taxable * half / Decimal("100")).quantize(Decimal("0.01"))
            cgst += cgst_amt
            sgst += sgst_amt
            tax_lines.append({
                "label": f"GST ({rate}%) — {item.get('name', 'Item')}",
                "amount": float(cgst_amt + sgst_amt),
                "type": "cgst_sgst",
                "rate": rate,
            })

    return (
        float(subtotal.quantize(Decimal("0.01"))),
        float(cgst.quantize(Decimal("0.01"))),
        float(sgst.quantize(Decimal("0.01"))),
        float(igst.quantize(Decimal("0.01"))),
        tax_lines,
    )


class CheckoutService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def preview(
        self,
        vendor: Vendor,
        items: list[dict],
        shipping_method_id: str = "free",
        coupon_code: str | None = None,
        customer_id: UUID | None = None,
        shipping_state: str | None = None,
    ) -> dict[str, Any]:
        if not items:
            return {
                "subtotal": 0,
                "discount_amount": 0,
                "shipping_amount": 0,
                "free_delivery_applied": False,
                "free_delivery_threshold": get_free_delivery_threshold(vendor),
                "minimum_delivery_charge": get_minimum_delivery_charge(vendor),
                "calculate_gst": should_calculate_gst(vendor),
                "tax_amount": 0,
                "cgst_amount": 0,
                "sgst_amount": 0,
                "igst_amount": 0,
                "total": 0,
                "currency": "INR",
                "shipping_methods": get_shipping_methods(vendor),
                "payment_methods": get_payment_methods(vendor),
                "tax_lines": [],
                "is_inter_state": False,
            }

        tax_rates = await _product_tax_rates(self.db, items)
        inter = _is_inter_state(vendor.state, shipping_state)
        subtotal, cgst, sgst, igst, tax_lines = _compute_line_taxes(
            items, tax_rates, vendor, inter,
        )
        tax_amount = round(cgst + sgst + igst, 2)

        discount_amount = 0.0
        coupon_valid = False
        coupon_message = None
        if coupon_code:
            coupon_svc = CouponService(self.db)
            result = await coupon_svc.validate_coupon(
                vendor.id, coupon_code, subtotal, customer_id=customer_id,
            )
            coupon_valid = result.get("valid", False)
            discount_amount = float(result.get("discount_amount") or 0)
            coupon_message = result.get("message")

        shipping_amount, free_delivery_applied = resolve_shipping_amount(
            vendor, subtotal, shipping_method_id,
        )
        total = round(subtotal + tax_amount + shipping_amount - discount_amount, 2)
        free_delivery_threshold = get_free_delivery_threshold(vendor)

        return {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "shipping_amount": shipping_amount,
            "free_delivery_applied": free_delivery_applied,
            "free_delivery_threshold": free_delivery_threshold,
            "minimum_delivery_charge": get_minimum_delivery_charge(vendor),
            "calculate_gst": should_calculate_gst(vendor),
            "tax_amount": tax_amount,
            "cgst_amount": cgst,
            "sgst_amount": sgst,
            "igst_amount": igst,
            "total": max(total, 0),
            "currency": "INR",
            "shipping_methods": get_shipping_methods(vendor),
            "payment_methods": get_payment_methods(vendor),
            "tax_lines": tax_lines,
            "is_inter_state": inter,
            "coupon_valid": coupon_valid,
            "coupon_message": coupon_message,
        }
