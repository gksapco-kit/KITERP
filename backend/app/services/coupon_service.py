from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, and_
from uuid import UUID
from datetime import datetime
import math

from app.models.coupon import Coupon, CouponUsage


class CouponService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_coupon(self, vendor_id: UUID, data: dict) -> Coupon:
        existing = await self.db.execute(
            select(Coupon).where(
                and_(Coupon.vendor_id == vendor_id, Coupon.code == data["code"].upper())
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Coupon code '{data['code']}' already exists")

        coupon = Coupon(
            vendor_id=vendor_id,
            code=data["code"].upper(),
            title=data.get("title"),
            description=data.get("description"),
            discount_type=data["discount_type"],
            discount_value=data["discount_value"],
            max_discount=data.get("max_discount"),
            min_order_amount=data.get("min_order_amount", 0),
            usage_limit=data.get("usage_limit"),
            usage_per_customer=data.get("usage_per_customer", 1),
            applicable_to=data.get("applicable_to", "all"),
            applicable_ids=data.get("applicable_ids", []),
            starts_at=data.get("starts_at"),
            expires_at=data.get("expires_at"),
            is_active=data.get("is_active", True),
            is_public=data.get("is_public", True),
        )
        self.db.add(coupon)
        await self.db.commit()
        await self.db.refresh(coupon)
        return coupon

    async def update_coupon(self, coupon_id: UUID, vendor_id: UUID, data: dict) -> Coupon:
        result = await self.db.execute(
            select(Coupon).where(and_(Coupon.id == coupon_id, Coupon.vendor_id == vendor_id))
        )
        coupon = result.scalar_one_or_none()
        if not coupon:
            raise ValueError("Coupon not found")

        for key, value in data.items():
            if value is not None and hasattr(coupon, key) and key not in ("id", "vendor_id", "code"):
                setattr(coupon, key, value)

        await self.db.commit()
        await self.db.refresh(coupon)
        return coupon

    async def delete_coupon(self, coupon_id: UUID, vendor_id: UUID):
        result = await self.db.execute(
            select(Coupon).where(and_(Coupon.id == coupon_id, Coupon.vendor_id == vendor_id))
        )
        coupon = result.scalar_one_or_none()
        if not coupon:
            raise ValueError("Coupon not found")
        await self.db.delete(coupon)
        await self.db.commit()

    async def list_coupons(self, vendor_id: UUID, is_active: bool = None, page: int = 1, size: int = 20):
        conditions = [Coupon.vendor_id == vendor_id]
        if is_active is not None:
            conditions.append(Coupon.is_active == is_active)

        count_q = select(sqlfunc.count(Coupon.id)).where(and_(*conditions))
        total = (await self.db.execute(count_q)).scalar_one()

        q = (
            select(Coupon)
            .where(and_(*conditions))
            .order_by(Coupon.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(q)
        items = result.scalars().all()
        return items, total

    async def validate_coupon(self, vendor_id: UUID, code: str, order_total: float, customer_id: UUID = None) -> dict:
        result = await self.db.execute(
            select(Coupon).where(
                and_(Coupon.vendor_id == vendor_id, Coupon.code == code.upper(), Coupon.is_active == True)
            )
        )
        coupon = result.scalar_one_or_none()
        if not coupon:
            return {"valid": False, "discount_amount": 0, "message": "Invalid coupon code"}

        now = datetime.utcnow()
        if coupon.starts_at and now < coupon.starts_at:
            return {"valid": False, "discount_amount": 0, "message": "Coupon not yet active"}
        if coupon.expires_at and now > coupon.expires_at:
            return {"valid": False, "discount_amount": 0, "message": "Coupon has expired"}
        if coupon.usage_limit and coupon.times_used >= coupon.usage_limit:
            return {"valid": False, "discount_amount": 0, "message": "Coupon usage limit reached"}
        if order_total < float(coupon.min_order_amount or 0):
            return {"valid": False, "discount_amount": 0, "message": f"Minimum order amount is ₹{coupon.min_order_amount}"}

        if customer_id and coupon.usage_per_customer:
            usage_count = await self.db.execute(
                select(sqlfunc.count(CouponUsage.id)).where(
                    and_(CouponUsage.coupon_id == coupon.id, CouponUsage.customer_id == customer_id)
                )
            )
            if usage_count.scalar_one() >= coupon.usage_per_customer:
                return {"valid": False, "discount_amount": 0, "message": "You have already used this coupon"}

        if coupon.discount_type == "percentage":
            discount = round(order_total * float(coupon.discount_value) / 100, 2)
            if coupon.max_discount:
                discount = min(discount, float(coupon.max_discount))
        else:
            discount = float(coupon.discount_value)

        discount = min(discount, order_total)

        return {"valid": True, "discount_amount": discount, "message": "Coupon applied!", "coupon": coupon}

    async def record_usage(self, coupon_id: UUID, customer_id: UUID, order_id: UUID, discount: float):
        usage = CouponUsage(
            coupon_id=coupon_id,
            customer_id=customer_id,
            order_id=order_id,
            discount_applied=discount,
        )
        self.db.add(usage)

        result = await self.db.execute(select(Coupon).where(Coupon.id == coupon_id))
        coupon = result.scalar_one_or_none()
        if coupon:
            coupon.times_used = (coupon.times_used or 0) + 1

        await self.db.commit()

    async def get_public_coupons(self, vendor_id: UUID):
        now = datetime.utcnow()
        q = select(Coupon).where(
            and_(
                Coupon.vendor_id == vendor_id,
                Coupon.is_active == True,
                Coupon.is_public == True,
            )
        ).order_by(Coupon.created_at.desc())
        result = await self.db.execute(q)
        coupons = result.scalars().all()
        active = []
        for c in coupons:
            if c.starts_at and now < c.starts_at:
                continue
            if c.expires_at and now > c.expires_at:
                continue
            if c.usage_limit and c.times_used >= c.usage_limit:
                continue
            active.append(c)
        return active
