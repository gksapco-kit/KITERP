"""Platform SaaS plan billing via Razorpay (vendor pays KIT ERP for their subscription)."""
from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.vendor import Vendor
from app.models.vendor_plan import VendorPlan
from app.models.vendor_saas_payment import VendorSaasPayment

log = logging.getLogger(__name__)

RAZORPAY_API = "https://api.razorpay.com/v1"
GRACE_DAYS = 7
BILLING_PERIOD_DAYS = 30

# Public self-service tiers shown on landing + vendor Billing & Plans.
PUBLIC_SAAS_PLAN_SLUGS: tuple[str, ...] = ("starter", "growth", "professional")


def _platform_razorpay_keys() -> tuple[str, str]:
    key_id = (settings.RAZORPAY_KEY_ID or "").strip()
    key_secret = (settings.RAZORPAY_KEY_SECRET or "").strip()
    if key_id and key_secret and key_id != "rzp_test_dev":
        return key_id, key_secret
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET so checkout can collect card details.",
    )


def plan_to_dict(plan: VendorPlan) -> dict[str, Any]:
    return {
        "id": str(plan.id),
        "name": plan.name,
        "slug": plan.slug,
        "description": plan.description,
        "price_monthly": float(plan.price_monthly),
        "price_yearly": float(plan.price_yearly) if plan.price_yearly else None,
        "currency": plan.currency or "INR",
        "max_products": plan.max_products,
        "max_services": plan.max_services,
        "max_team_members": plan.max_team_members,
        "max_storage_mb": plan.max_storage_mb,
        "max_apps": plan.max_apps if plan.max_apps is not None else -1,
        "features": plan.features or {},
        "is_featured": bool(plan.is_featured),
    }


def resolve_billing_state(vendor: Vendor) -> dict[str, Any]:
    """Derive subscription access state from plan_expires_at + billing_status."""
    now = datetime.now(timezone.utc)
    expires = vendor.plan_expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    status_raw = (vendor.billing_status or "none").strip().lower() or "none"
    if not vendor.plan_id:
        return {
            "billing_status": "none",
            "plan_expires_at": None,
            "is_expired": False,
            "in_grace": False,
            "can_install_apps": True,
            "access_mode": "unassigned",
        }

    if not expires:
        # Legacy vendors with a plan but no expiry — treat as active.
        return {
            "billing_status": status_raw if status_raw != "none" else "active",
            "plan_expires_at": None,
            "is_expired": False,
            "in_grace": False,
            "can_install_apps": True,
            "access_mode": "active",
        }

    if expires >= now:
        return {
            "billing_status": "active",
            "plan_expires_at": expires.isoformat(),
            "is_expired": False,
            "in_grace": False,
            "can_install_apps": True,
            "access_mode": "active",
        }

    grace_until = expires + timedelta(days=GRACE_DAYS)
    if grace_until >= now:
        return {
            "billing_status": "past_due",
            "plan_expires_at": expires.isoformat(),
            "is_expired": False,
            "in_grace": True,
            "can_install_apps": True,
            "access_mode": "grace",
            "grace_until": grace_until.isoformat(),
        }

    return {
        "billing_status": "expired",
        "plan_expires_at": expires.isoformat(),
        "is_expired": True,
        "in_grace": False,
        "can_install_apps": False,
        "access_mode": "expired",
    }


def effective_max_apps(plan: VendorPlan | None, billing: dict[str, Any]) -> int:
    """
    How many optional sidebar apps may be installed.
    -1 = unlimited. 0 = cannot install more (expired / locked).
    """
    if not plan:
        return -1  # no plan assigned yet — keep backward-compatible open access
    if billing.get("access_mode") == "expired":
        return 0
    raw = plan.max_apps
    if raw is None:
        return -1
    return int(raw)


PINNED_SIDEBAR_SECTIONS = frozenset({"my-kit"})


def trim_sidebar_section_ids(ids: list[str], max_apps: int) -> list[str]:
    """My Kit always visible; cap optional sidebar modules to max_apps (-1 = unlimited)."""
    if max_apps < 0:
        out: list[str] = []
        seen: set[str] = set()
        for sid in ids:
            s = str(sid).strip()
            if not s or s in seen:
                continue
            seen.add(s)
            out.append(s)
        if "my-kit" not in seen:
            return ["my-kit", *out]
        return out

    pinned: list[str] = []
    optional: list[str] = []
    seen: set[str] = set()
    for sid in ids:
        s = str(sid).strip()
        if not s or s in seen:
            continue
        seen.add(s)
        if s in PINNED_SIDEBAR_SECTIONS:
            pinned.append(s)
        else:
            optional.append(s)
    if "my-kit" not in pinned:
        pinned.insert(0, "my-kit")
    return pinned + optional[:max_apps]


class VendorBillingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_plan(self, plan_id: UUID) -> VendorPlan:
        result = await self.db.execute(
            select(VendorPlan).where(VendorPlan.id == plan_id, VendorPlan.is_active == True)  # noqa: E712
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found or inactive")
        return plan

    async def create_checkout(self, vendor: Vendor, plan: VendorPlan, user_email: str | None, user_name: str | None) -> dict[str, Any]:
        amount = Decimal(str(plan.price_monthly or 0))
        amount_paise = int(amount * 100)
        if amount_paise <= 0:
            # Free plan — activate immediately without Razorpay.
            await self.activate_plan(vendor, plan, payment_id=None, order_id=None)
            return {
                "free": True,
                "plan": plan_to_dict(plan),
                "message": f"Plan '{plan.name}' activated (free).",
            }

        key_id, key_secret = _platform_razorpay_keys()
        receipt = f"plan_{str(vendor.id)[:8]}_{str(plan.id)[:8]}"
        payload = {
            "amount": amount_paise,
            "currency": (plan.currency or "INR").upper(),
            "receipt": receipt[:40],
            "notes": {
                "purpose": "vendor_saas_plan",
                "vendor_id": str(vendor.id),
                "plan_id": str(plan.id),
                "plan_slug": plan.slug or "",
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{RAZORPAY_API}/orders",
                json=payload,
                auth=(key_id, key_secret),
            )
        if resp.status_code >= 400:
            log.error("Razorpay SaaS order create failed: %s", resp.text)
            raise HTTPException(502, "Could not start plan payment. Please try again.")

        data = resp.json()
        order_id = data["id"]
        vendor.billing_razorpay_order_id = order_id
        await self.db.commit()

        return {
            "free": False,
            "dev_mode": False,
            "key_id": key_id,
            "razorpay_order_id": order_id,
            "amount": amount_paise,
            "currency": data.get("currency", "INR"),
            "plan_id": str(plan.id),
            "plan": plan_to_dict(plan),
            "prefill": {
                "name": user_name or vendor.display_name or vendor.business_name or "",
                "email": user_email or vendor.primary_email or "",
                "contact": vendor.primary_phone or "",
            },
        }

    def verify_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> bool:
        _, key_secret = _platform_razorpay_keys()
        body = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(
            key_secret.encode(),
            body.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, razorpay_signature)

    async def confirm_payment(
        self,
        vendor: Vendor,
        plan: VendorPlan,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> dict[str, Any]:
        if not self.verify_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
            raise HTTPException(400, "Invalid payment signature")

        if vendor.billing_razorpay_order_id and vendor.billing_razorpay_order_id != razorpay_order_id:
            raise HTTPException(400, "Payment order does not match the pending checkout")

        await self.activate_plan(
            vendor,
            plan,
            payment_id=razorpay_payment_id,
            order_id=razorpay_order_id,
        )
        billing = resolve_billing_state(vendor)
        return {
            "message": f"Payment successful — '{plan.name}' is now active.",
            "plan": plan_to_dict(plan),
            **billing,
            "max_apps": effective_max_apps(plan, billing),
        }

    async def activate_plan(
        self,
        vendor: Vendor,
        plan: VendorPlan,
        *,
        payment_id: str | None,
        order_id: str | None,
    ) -> None:
        now = datetime.now(timezone.utc)
        period_end = now + timedelta(days=BILLING_PERIOD_DAYS)
        vendor.plan_id = plan.id
        vendor.plan_expires_at = period_end
        vendor.billing_status = "active"
        if order_id:
            vendor.billing_razorpay_order_id = order_id
        if payment_id:
            vendor.billing_last_payment_id = payment_id
            existing = await self.db.execute(
                select(VendorSaasPayment).where(VendorSaasPayment.razorpay_payment_id == payment_id)
            )
            if existing.scalar_one_or_none() is None:
                self.db.add(
                    VendorSaasPayment(
                        vendor_id=vendor.id,
                        plan_id=plan.id,
                        plan_name=plan.name,
                        amount=Decimal(str(plan.price_monthly or 0)),
                        currency=(plan.currency or "INR").upper(),
                        razorpay_order_id=order_id,
                        razorpay_payment_id=payment_id,
                        status="paid",
                        period_start=now,
                        period_end=period_end,
                    )
                )
        # Clear landing signup pending marker
        settings_map = dict(vendor.settings or {})
        settings_map.pop("pending_plan_slug", None)
        vendor.settings = settings_map
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(vendor, "settings")
        await self.db.commit()
        await self.db.refresh(vendor)

    async def get_plan_by_slug(self, slug: str) -> VendorPlan:
        result = await self.db.execute(
            select(VendorPlan).where(
                VendorPlan.slug == slug.strip().lower(),
                VendorPlan.is_active == True,  # noqa: E712
            )
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found or inactive")
        return plan

    async def renew_same_plan(self, vendor: Vendor, user_email: str | None, user_name: str | None) -> dict[str, Any]:
        if not vendor.plan_id:
            raise HTTPException(400, "No plan to renew — choose a plan first")
        plan = await self.get_plan(vendor.plan_id)
        return await self.create_checkout(vendor, plan, user_email, user_name)

    async def list_payments(self, vendor: Vendor, limit: int = 30) -> list[dict[str, Any]]:
        result = await self.db.execute(
            select(VendorSaasPayment)
            .where(VendorSaasPayment.vendor_id == vendor.id)
            .order_by(VendorSaasPayment.created_at.desc())
            .limit(limit)
        )
        rows = result.scalars().all()
        return [
            {
                "id": str(row.id),
                "plan_id": str(row.plan_id) if row.plan_id else None,
                "plan_name": row.plan_name,
                "amount": float(row.amount),
                "currency": row.currency,
                "razorpay_order_id": row.razorpay_order_id,
                "razorpay_payment_id": row.razorpay_payment_id,
                "status": row.status,
                "period_start": row.period_start.isoformat() if row.period_start else None,
                "period_end": row.period_end.isoformat() if row.period_end else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]

    async def admin_overview(self) -> dict[str, Any]:
        """All vendor subscriptions, payment history, and revenue totals for the admin portal."""
        now = datetime.now(timezone.utc)
        vendor_rows = (
            await self.db.execute(select(Vendor).order_by(Vendor.display_name.asc()))
        ).scalars().all()
        plan_rows = (await self.db.execute(select(VendorPlan))).scalars().all()
        payment_rows = (
            await self.db.execute(
                select(VendorSaasPayment).order_by(VendorSaasPayment.created_at.desc()).limit(300)
            )
        ).scalars().all()

        plans_by_id = {plan.id: plan for plan in plan_rows}
        vendors_by_id = {vendor.id: vendor for vendor in vendor_rows}
        latest_by_vendor: dict[Any, VendorSaasPayment] = {}
        for payment in payment_rows:
            if payment.vendor_id not in latest_by_vendor:
                latest_by_vendor[payment.vendor_id] = payment

        paid = [row for row in payment_rows if (row.status or "").lower() == "paid"]
        by_plan: dict[str, dict[str, Any]] = {}

        subscriptions: list[dict[str, Any]] = []
        active_count = 0
        expired_count = 0
        grace_count = 0
        unassigned_count = 0

        for vendor in vendor_rows:
            plan = plans_by_id.get(vendor.plan_id) if vendor.plan_id else None
            billing = resolve_billing_state(vendor)
            mode = billing.get("access_mode")
            if mode == "active":
                active_count += 1
            elif mode == "expired":
                expired_count += 1
            elif mode == "grace":
                grace_count += 1
            else:
                unassigned_count += 1

            if not plan and vendor.id not in latest_by_vendor:
                continue

            latest = latest_by_vendor.get(vendor.id)
            expires = billing.get("plan_expires_at")
            days_left = None
            if expires:
                end = datetime.fromisoformat(expires)
                days_left = (end - now).days

            slug = plan.slug if plan else None
            if slug:
                bucket = by_plan.setdefault(
                    slug,
                    {"slug": slug, "name": plan.name if plan else slug, "vendors": 0, "collected": 0.0},
                )
                bucket["vendors"] += 1

            subscriptions.append(
                {
                    "vendor_id": str(vendor.id),
                    "business_name": vendor.business_name,
                    "display_name": vendor.display_name,
                    "email": vendor.primary_email,
                    "plan_name": plan.name if plan else (latest.plan_name if latest else None),
                    "plan_slug": slug,
                    "price_monthly": float(plan.price_monthly) if plan else None,
                    "currency": (plan.currency if plan else None) or (latest.currency if latest else "INR"),
                    "max_apps": plan.max_apps if plan and plan.max_apps is not None else None,
                    "billing_status": billing.get("billing_status"),
                    "access_mode": mode,
                    "plan_expires_at": expires,
                    "in_grace": bool(billing.get("in_grace")),
                    "grace_until": billing.get("grace_until"),
                    "days_left": days_left,
                    "last_payment_at": latest.created_at.isoformat() if latest and latest.created_at else None,
                    "last_payment_amount": float(latest.amount) if latest else None,
                    "period_start": latest.period_start.isoformat() if latest and latest.period_start else None,
                    "period_end": latest.period_end.isoformat() if latest and latest.period_end else expires,
                    "razorpay_payment_id": latest.razorpay_payment_id if latest else vendor.billing_last_payment_id,
                }
            )

        for payment in paid:
            plan = plans_by_id.get(payment.plan_id) if payment.plan_id else None
            slug = plan.slug if plan else (payment.plan_name or "other").lower()
            bucket = by_plan.setdefault(
                slug,
                {"slug": slug, "name": plan.name if plan else payment.plan_name, "vendors": 0, "collected": 0.0},
            )
            bucket["collected"] = round(bucket["collected"] + float(payment.amount or 0), 2)

        seen_payment_ids = {
            row.razorpay_payment_id for row in payment_rows if row.razorpay_payment_id
        }
        payments = []
        for row in payment_rows:
            vendor = vendors_by_id.get(row.vendor_id)
            payments.append(
                {
                    "id": str(row.id),
                    "vendor_id": str(row.vendor_id),
                    "vendor_name": (
                        vendor.display_name or vendor.business_name if vendor else "Unknown vendor"
                    ),
                    "vendor_email": vendor.primary_email if vendor else None,
                    "business_name": vendor.business_name if vendor else None,
                    "plan_name": row.plan_name,
                    "amount": float(row.amount),
                    "currency": row.currency or "INR",
                    "status": row.status,
                    "razorpay_order_id": row.razorpay_order_id,
                    "razorpay_payment_id": row.razorpay_payment_id,
                    "period_start": row.period_start.isoformat() if row.period_start else None,
                    "period_end": row.period_end.isoformat() if row.period_end else None,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
            )

        # Payments completed before history rows existed still sit on the vendor record.
        for vendor in vendor_rows:
            payment_id = (vendor.billing_last_payment_id or "").strip()
            if not payment_id or payment_id in seen_payment_ids:
                continue
            plan = plans_by_id.get(vendor.plan_id) if vendor.plan_id else None
            payments.append(
                {
                    "id": f"vendor-{vendor.id}",
                    "vendor_id": str(vendor.id),
                    "vendor_name": vendor.display_name or vendor.business_name,
                    "vendor_email": vendor.primary_email,
                    "business_name": vendor.business_name,
                    "plan_name": plan.name if plan else None,
                    "amount": float(plan.price_monthly) if plan else None,
                    "currency": (plan.currency if plan else None) or "INR",
                    "status": "paid",
                    "razorpay_order_id": vendor.billing_razorpay_order_id,
                    "razorpay_payment_id": payment_id,
                    "period_start": None,
                    "period_end": vendor.plan_expires_at.isoformat() if vendor.plan_expires_at else None,
                    "created_at": None,
                }
            )

        paid_amounts = [
            float(item.get("amount") or 0)
            for item in payments
            if (item.get("status") or "").lower() == "paid"
        ]
        return {
            "totals": {
                "collected": round(sum(paid_amounts), 2),
                "currency": "INR",
                "payment_count": len(paid_amounts),
                "active_subscriptions": active_count,
                "in_grace": grace_count,
                "expired": expired_count,
                "unassigned": unassigned_count,
                "by_plan": list(by_plan.values()),
            },
            "subscriptions": subscriptions,
            "payments": payments,
        }
