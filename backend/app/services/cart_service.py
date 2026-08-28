# app/services/cart_service.py
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from fastapi import HTTPException, status

from app.models.cart import Cart
from app.schemas.cart import CartItemAdd, CartItemUpdate
from app.repositories.cart_repo import CartRepository


def _clone_cart_items(items: list | None) -> list:
    return [dict(x) for x in (items or [])]


def _persist_cart_items(cart: Cart, items: list) -> None:
    """JSONB columns need a fresh list + flag_modified or qty changes may not commit."""
    cart.items = _clone_cart_items(items)
    flag_modified(cart, "items")


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
        items = _clone_cart_items(cart.items)

        is_service = bool(item.service_id and not item.product_id) or item.item_type == "service"
        if is_service:
            # One booking/subscription at a time — replace leftover service lines.
            items = [
                existing
                for existing in items
                if not (
                    existing.get("item_type") == "service"
                    or (existing.get("service_id") and not existing.get("product_id"))
                )
            ]
            dumped = item.model_dump(exclude_none=True)
            dumped["qty"] = 1
            dumped["item_type"] = dumped.get("item_type") or "service"
            items.append(dumped)
            _persist_cart_items(cart, items)
            await self.db.commit()
            await self.db.refresh(cart)
            return cart

        # Match existing product+variant line
        for i, existing in enumerate(items):
            same_product = (
                item.product_id
                and existing.get("product_id") == item.product_id
                and existing.get("variant_id") == item.variant_id
            )
            if same_product:
                items[i]["qty"] += item.qty
                items[i]["price"] = item.price
                if item.item_type:
                    items[i]["item_type"] = item.item_type
                _persist_cart_items(cart, items)
                await self.db.commit()
                await self.db.refresh(cart)
                return cart

        # Add new item
        items.append(item.model_dump(exclude_none=True))
        _persist_cart_items(cart, items)
        await self.db.commit()
        await self.db.refresh(cart)
        return cart

    async def update_item(
        self, vendor_id: UUID, customer_id: UUID, item_index: int, data: CartItemUpdate
    ) -> Cart:
        cart = await self.repo.get_or_create(vendor_id, customer_id)
        items = _clone_cart_items(cart.items)

        if item_index < 0 or item_index >= len(items):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart item not found",
            )

        items[item_index]["qty"] = data.qty
        _persist_cart_items(cart, items)
        await self.db.commit()
        await self.db.refresh(cart)
        return cart

    async def remove_item(
        self, vendor_id: UUID, customer_id: UUID, item_index: int
    ) -> Cart:
        cart = await self.repo.get_or_create(vendor_id, customer_id)
        items = _clone_cart_items(cart.items)

        if item_index < 0 or item_index >= len(items):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart item not found",
            )

        items.pop(item_index)
        _persist_cart_items(cart, items)
        await self.db.commit()
        await self.db.refresh(cart)
        return cart

    async def clear_cart(self, vendor_id: UUID, customer_id: UUID) -> Cart:
        cart = await self.repo.get_or_create(vendor_id, customer_id)
        return await self.repo.clear_cart(cart)
