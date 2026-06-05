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


def get_shipping_methods(vendor: Vendor) -> list[dict[str, Any]]:
    custom = _checkout_config(vendor).get("shipping_methods")
    if isinstance(custom, list) and custom:
        return custom
    return DEFAULT_SHIPPING_METHODS


def get_payment_methods(vendor: Vendor) -> list[str]:
    methods = _checkout_config(vendor).get("payment_methods")
    if isinstance(methods, list) and methods:
        return [str(m) for m in methods]
    return ["cod", "razorpay"]


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
    subtotal = Decimal("0")
    cgst = sgst = igst = Decimal("0")
    tax_lines: list[dict] = []

    for item in items:
        qty = int(item.get("qty") or 0)
        price = Decimal(str(item.get("price") or 0))
        line_sub = price * qty
        subtotal += line_sub

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

        shipping_amount = shipping_amount_for_method(vendor, shipping_method_id)
        total = round(subtotal + tax_amount + shipping_amount - discount_amount, 2)

        return {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "shipping_amount": shipping_amount,
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
