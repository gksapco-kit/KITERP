"""Payment processor integrations stored in crm_integration."""
from __future__ import annotations

import os
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.encryption import decrypt_json
from app.models.crm import CrmIntegration
from app.models.vendor import Vendor

PAYMENT_PROVIDERS = frozenset({"razorpay", "stripe", "square", "paypal", "payu"})

WEBHOOK_PATHS: dict[str, str] = {
    "razorpay": "/store/checkout/payments/razorpay/webhook",
    "stripe": "/store/checkout/payments/stripe/webhook",
    "square": "/store/checkout/payments/square/webhook",
    "paypal": "/store/checkout/payments/paypal/webhook",
    "payu": "/store/checkout/payments/payu/webhook",
}

PUBLIC_KEY_FIELDS: dict[str, str] = {
    "razorpay": "key_id",
    "stripe": "publishable_key",
    "square": "application_id",
    "paypal": "client_id",
    "payu": "merchant_key",
}


def get_api_base_url() -> str:
    base = (
        os.environ.get("PUBLIC_API_BASE_URL")
        or os.environ.get("API_PUBLIC_URL")
        or ""
    ).strip().rstrip("/")
    if base:
        return base
    prefix = (settings.API_V1_PREFIX or "/api/v1").rstrip("/")
    return f"http://localhost:8000{prefix}"


def get_payment_webhook_url(provider: str) -> str | None:
    provider = (provider or "").strip().lower()
    path = WEBHOOK_PATHS.get(provider)
    if not path:
        return None
    return f"{get_api_base_url()}{path}"


def is_payment_provider(provider: str) -> bool:
    return (provider or "").strip().lower() in PAYMENT_PROVIDERS


async def load_payment_credentials(
    db: AsyncSession,
    vendor_id: UUID,
    provider: str,
) -> dict[str, Any] | None:
    provider = (provider or "").strip().lower()
    if provider not in PAYMENT_PROVIDERS:
        return None

    result = await db.execute(
        select(CrmIntegration).where(
            CrmIntegration.vendor_id == vendor_id,
            CrmIntegration.provider == provider,
            CrmIntegration.status == "connected",
        )
    )
    integ = result.scalar_one_or_none()
    if not integ:
        return None

    creds = decrypt_json(integ.encrypted_credentials) or {}
    merged = dict(integ.settings or {})
    merged.update(creds)
    return merged


async def get_connected_payment_providers(
    db: AsyncSession,
    vendor_id: UUID,
) -> list[str]:
    result = await db.execute(
        select(CrmIntegration.provider).where(
            CrmIntegration.vendor_id == vendor_id,
            CrmIntegration.provider.in_(PAYMENT_PROVIDERS),
            CrmIntegration.status == "connected",
        )
    )
    return [str(row[0]) for row in result.all()]


def _public_key_for_provider(provider: str, creds: dict[str, Any]) -> str | None:
    field = PUBLIC_KEY_FIELDS.get(provider)
    if not field:
        return None
    value = creds.get(field)
    return str(value).strip() if value else None


async def build_checkout_payment_info(
    db: AsyncSession,
    vendor: Vendor,
) -> dict[str, Any]:
    """Public payment config for storefront checkout preview."""
    connected = await get_connected_payment_providers(db, vendor.id)
    providers: list[dict[str, Any]] = []

    for provider in connected:
        creds = await load_payment_credentials(db, vendor.id, provider)
        if not creds:
            continue
        public_key = _public_key_for_provider(provider, creds)
        providers.append({
            "provider": provider,
            "label": provider.replace("_", " ").title(),
            "public_key": public_key,
            "webhook_url": get_payment_webhook_url(provider),
        })

    methods: list[str] = []
    checkout_cfg = ((vendor.theme_config or {}).get("checkout") or {})
    theme_methods = checkout_cfg.get("payment_methods")
    if isinstance(theme_methods, list) and theme_methods:
        methods = [str(m) for m in theme_methods]
    else:
        if "cod" not in methods:
            methods.append("cod")
        methods.extend(p for p in connected if p not in methods)

    razorpay_key = None
    razorpay_creds = await load_payment_credentials(db, vendor.id, "razorpay")
    if razorpay_creds:
        razorpay_key = _public_key_for_provider("razorpay", razorpay_creds)
    if not razorpay_key:
        from app.services.checkout_service import get_razorpay_key_id
        razorpay_key = get_razorpay_key_id(vendor, settings.RAZORPAY_KEY_ID) or None

    return {
        "payment_methods": methods,
        "connected_payments": providers,
        "razorpay_key_id": razorpay_key,
        "razorpay_enabled": bool(razorpay_key or settings.DEBUG),
    }


async def sync_vendor_checkout_payments(db: AsyncSession, vendor_id: UUID) -> None:
    """Keep vendor.theme_config.checkout.payment_methods aligned with CRM integrations."""
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = result.scalar_one_or_none()
    if not vendor:
        return

    connected = await get_connected_payment_providers(db, vendor_id)
    theme_config = dict(vendor.theme_config or {})
    checkout = dict(theme_config.get("checkout") or {})

    methods: list[str] = ["cod"]
    for provider in ("razorpay", "stripe", "square", "paypal", "payu"):
        if provider in connected:
            methods.append(provider)

    checkout["payment_methods"] = methods

    razorpay_creds = await load_payment_credentials(db, vendor_id, "razorpay")
    if razorpay_creds:
        key_id = _public_key_for_provider("razorpay", razorpay_creds)
        if key_id:
            checkout["razorpay_key_id"] = key_id
    elif "razorpay_key_id" in checkout and "razorpay" not in connected:
        checkout.pop("razorpay_key_id", None)

    theme_config["checkout"] = checkout
    vendor.theme_config = theme_config
    await db.commit()
