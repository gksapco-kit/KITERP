# app/services/cart_service.py
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.cart import Cart
from app.schemas.cart import CartItemAdd, CartItemUpdate
from app.repositories.cart_repo import CartRepository


class CartService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CartRepository(db)

    async def get_cart(self, vendor_id: UUID, customer_id: UUID) -> Cart:
        return await self.repo.get_or_create(vendor_id, customer_id)

    async def add_item(
        self, vendor_id: UUID, customer_id: UUID, item: CartItemAdd
    ) -> Cart:
        cart = await self.repo.get_or_create(vendor_id, customer_id)
        items = list(cart.items or [])

        # Check if item already exists (same product_id + variant_id)
        for i, existing in enumerate(items):
            if (
                existing.get("product_id") == item.product_id
                and existing.get("variant_id") == item.variant_id
            ):
                items[i]["qty"] += item.qty
                items[i]["price"] = item.price  # Update price
                cart.items = items
                await self.db.commit()
                await self.db.refresh(cart)
                return cart

        # Add new item
        items.append(item.model_dump())
        cart.items = items
        await self.db.commit()
        await self.db.refresh(cart)
        return cart

    async def update_item(
        self, vendor_id: UUID, customer_id: UUID, item_index: int, data: CartItemUpdate
    ) -> Cart:
        cart = await self.repo.get_or_create(vendor_id, customer_id)
        items = list(cart.items or [])

        if item_index < 0 or item_index >= len(items):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart item not found",
            )

        items[item_index]["qty"] = data.qty
        cart.items = items
        await self.db.commit()
        await self.db.refresh(cart)
        return cart

    async def remove_item(
        self, vendor_id: UUID, customer_id: UUID, item_index: int
    ) -> Cart:
        cart = await self.repo.get_or_create(vendor_id, customer_id)
        items = list(cart.items or [])

        if item_index < 0 or item_index >= len(items):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart item not found",
            )

        items.pop(item_index)
        cart.items = items
        await self.db.commit()
        await self.db.refresh(cart)
        return cart

    async def clear_cart(self, vendor_id: UUID, customer_id: UUID) -> Cart:
        cart = await self.repo.get_or_create(vendor_id, customer_id)
        return await self.repo.clear_cart(cart)
