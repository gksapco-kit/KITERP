# app/repositories/cart_repo.py
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.repositories.base import BaseRepository
from app.models.cart import Cart


class CartRepository(BaseRepository[Cart]):
    def __init__(self, db: AsyncSession):
        super().__init__(Cart, db)

    async def get_by_customer(
        self, vendor_id: UUID, customer_id: UUID
    ) -> Optional[Cart]:
        result = await self.db.execute(
            select(Cart).where(
                Cart.vendor_id == vendor_id,
                Cart.customer_id == customer_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create(
        self, vendor_id: UUID, customer_id: UUID
    ) -> Cart:
        cart = await self.get_by_customer(vendor_id, customer_id)
        if not cart:
            cart = Cart(
                vendor_id=vendor_id,
                customer_id=customer_id,
                items=[],
            )
            self.db.add(cart)
            await self.db.commit()
            await self.db.refresh(cart)
        return cart

    async def clear_cart(self, cart: Cart) -> Cart:
        from sqlalchemy.orm.attributes import flag_modified

        cart.items = []
        flag_modified(cart, "items")
        cart.coupon_code = None
        cart.discount_amount = 0
        await self.db.commit()
        await self.db.refresh(cart)
        return cart
