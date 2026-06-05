from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.vendor_product import Product, ProductVariant
from app.models.vendor_service import Service
from app.schemas.customer_subscription import SubscriptionCreate


INTERVAL_DAYS = {
    "daily": 1,
    "weekly": 7,
    "biweekly": 14,
    "monthly": 30,
    "quarterly": 91,
    "biannual": 182,
    "yearly": 365,
}


class CustomerSubscriptionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _to_dict(self, sub: CustomerSubscription, customer_name: str | None = None) -> dict:
        return {
            "id": str(sub.id),
            "vendor_id": str(sub.vendor_id),
            "customer_id": str(sub.customer_id),
            "item_type": sub.item_type,
            "product_id": str(sub.product_id) if sub.product_id else None,
            "variant_id": str(sub.variant_id) if sub.variant_id else None,
            "service_id": str(sub.service_id) if sub.service_id else None,
            "item_name": sub.item_name,
            "interval": sub.interval,
            "price_per_cycle": sub.price_per_cycle,
            "qty": sub.qty,
            "currency": sub.currency,
            "status": sub.status,
            "schedule_config": sub.schedule_config or {},
            "trial_ends_at": sub.trial_ends_at,
            "current_period_start": sub.current_period_start,
            "current_period_end": sub.current_period_end,
            "next_billing_at": sub.next_billing_at,
            "cancelled_at": sub.cancelled_at,
            "created_at": sub.created_at,
            "customer_name": customer_name,
        }

    async def create(self, vendor_id: UUID, customer: Customer, data: SubscriptionCreate) -> dict:
        await self._validate_item(vendor_id, data)
        now = datetime.now(timezone.utc)
        cfg = data.schedule_config or {}
        start_raw = cfg.get("startDate") or cfg.get("start_date")
        try:
            period_start = datetime.fromisoformat(start_raw.replace("Z", "+00:00")) if start_raw else now
            if period_start.tzinfo is None:
                period_start = period_start.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            period_start = now

        trial_days = 0
        if data.item_type == "product" and data.product_id:
            result = await self.db.execute(
                select(Product).where(Product.id == UUID(data.product_id), Product.vendor_id == vendor_id)
            )
            product = result.scalar_one_or_none()
            if product and data.variant_id:
                vr = await self.db.execute(
                    select(ProductVariant).where(ProductVariant.id == UUID(data.variant_id))
                )
                variant = vr.scalar_one_or_none()
                trial_days = (variant.subscription_trial_days if variant else None) or product.subscription_trial_days or 0
            elif product:
                trial_days = product.subscription_trial_days or 0
        elif data.item_type == "service" and data.service_id:
            result = await self.db.execute(
                select(Service).where(Service.id == UUID(data.service_id), Service.vendor_id == vendor_id)
            )
            svc = result.scalar_one_or_none()
            trial_days = (svc.subscription_trial_days if svc else None) or 0

        trial_ends = period_start + timedelta(days=trial_days) if trial_days else None
        days = INTERVAL_DAYS.get(data.interval, 30)
        period_end = period_start + timedelta(days=days)
        next_bill = trial_ends or period_end
        status = "trialing" if trial_days else "active"

        sub = CustomerSubscription(
            vendor_id=vendor_id,
            customer_id=customer.id,
            item_type=data.item_type,
            product_id=UUID(data.product_id) if data.product_id else None,
            variant_id=UUID(data.variant_id) if data.variant_id else None,
            service_id=UUID(data.service_id) if data.service_id else None,
            item_name=data.item_name,
            interval=data.interval,
            price_per_cycle=data.price_per_cycle,
            qty=data.qty,
            status=status,
            schedule_config=cfg,
            trial_ends_at=trial_ends,
            current_period_start=period_start,
            current_period_end=period_end,
            next_billing_at=next_bill,
        )
        self.db.add(sub)
        await self.db.commit()
        await self.db.refresh(sub)
        return self._to_dict(sub, customer.full_name)

    async def list_for_customer(self, vendor_id: UUID, customer_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(CustomerSubscription)
            .where(
                CustomerSubscription.vendor_id == vendor_id,
                CustomerSubscription.customer_id == customer_id,
            )
            .order_by(CustomerSubscription.created_at.desc())
        )
        return [self._to_dict(s) for s in result.scalars().all()]

    async def list_for_vendor(self, vendor_id: UUID, status: str | None = None) -> list[dict]:
        q = select(CustomerSubscription, Customer.full_name).join(
            Customer, Customer.id == CustomerSubscription.customer_id
        ).where(CustomerSubscription.vendor_id == vendor_id)
        if status:
            q = q.where(CustomerSubscription.status == status)
        q = q.order_by(CustomerSubscription.created_at.desc())
        result = await self.db.execute(q)
        return [self._to_dict(sub, name) for sub, name in result.all()]

    async def update_status(
        self,
        vendor_id: UUID,
        subscription_id: UUID,
        new_status: str,
        *,
        customer_id: UUID | None = None,
    ) -> dict:
        sub = await self._get_sub(subscription_id, vendor_id)
        if customer_id is not None and sub.customer_id != customer_id:
            raise HTTPException(404, "Subscription not found")
        if new_status not in ("active", "paused", "cancelled"):
            raise HTTPException(400, "Invalid status")
        if sub.status == "cancelled":
            raise HTTPException(400, "Subscription is already cancelled")

        sub.status = new_status
        if new_status == "cancelled":
            sub.cancelled_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(sub)
        return self._to_dict(sub)

    async def _get_sub(self, subscription_id: UUID, vendor_id: UUID) -> CustomerSubscription:
        result = await self.db.execute(
            select(CustomerSubscription).where(
                CustomerSubscription.id == subscription_id,
                CustomerSubscription.vendor_id == vendor_id,
            )
        )
        sub = result.scalar_one_or_none()
        if not sub:
            raise HTTPException(404, "Subscription not found")
        return sub

    async def _validate_item(self, vendor_id: UUID, data: SubscriptionCreate) -> None:
        if data.item_type == "product":
            if not data.product_id:
                raise HTTPException(400, "product_id is required")
            result = await self.db.execute(
                select(Product).where(Product.id == UUID(data.product_id), Product.vendor_id == vendor_id)
            )
            if not result.scalar_one_or_none():
                raise HTTPException(404, "Product not found")
        elif data.item_type == "service":
            if not data.service_id:
                raise HTTPException(400, "service_id is required")
            result = await self.db.execute(
                select(Service).where(Service.id == UUID(data.service_id), Service.vendor_id == vendor_id)
            )
            if not result.scalar_one_or_none():
                raise HTTPException(404, "Service not found")
        else:
            raise HTTPException(400, "item_type must be product or service")
