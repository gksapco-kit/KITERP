from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wishlist import Wishlist
from app.repositories.wishlist_repo import WishlistRepository
from app.schemas.wishlist import WishlistItemAdd


class WishlistService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = WishlistRepository(db)

    async def get_wishlist(self, vendor_id: UUID, customer_id: UUID) -> Wishlist:
        return await self.repo.get_or_create(vendor_id, customer_id)

    async def add_item(self, vendor_id: UUID, customer_id: UUID, item: WishlistItemAdd) -> Wishlist:
        wl = await self.repo.get_or_create(vendor_id, customer_id)
        items = list(wl.items or [])
        key = (item.product_id, item.variant_id)
        now = datetime.now(timezone.utc).isoformat()
        for i, existing in enumerate(items):
            if (existing.get("product_id"), existing.get("variant_id")) == key:
                items[i] = {**item.model_dump(), "saved_at": now}
                wl.items = items
                await self.db.commit()
                await self.db.refresh(wl)
                return wl
        items.append({**item.model_dump(), "saved_at": now})
        wl.items = items
        await self.db.commit()
        await self.db.refresh(wl)
        return wl

    async def remove_item(self, vendor_id: UUID, customer_id: UUID, product_id: str) -> Wishlist:
        wl = await self.repo.get_or_create(vendor_id, customer_id)
        items = [i for i in (wl.items or []) if i.get("product_id") != product_id]
        wl.items = items
        await self.db.commit()
        await self.db.refresh(wl)
        return wl

    async def toggle_item(self, vendor_id: UUID, customer_id: UUID, item: WishlistItemAdd) -> Wishlist:
        wl = await self.repo.get_or_create(vendor_id, customer_id)
        items = list(wl.items or [])
        if any(i.get("product_id") == item.product_id for i in items):
            items = [i for i in items if i.get("product_id") != item.product_id]
            wl.items = items
            await self.db.commit()
            await self.db.refresh(wl)
            return wl
        return await self.add_item(vendor_id, customer_id, item)

    async def sync_items(self, vendor_id: UUID, customer_id: UUID, items: list[dict]) -> Wishlist:
        wl = await self.repo.get_or_create(vendor_id, customer_id)
        merged: dict[tuple, dict] = {}
        for raw in items:
            pid = raw.get("product_id") or raw.get("id")
            if not pid:
                continue
            vid = raw.get("variant_id")
            merged[(str(pid), vid)] = {
                "product_id": str(pid),
                "variant_id": vid,
                "name": raw.get("name", ""),
                "price": float(raw.get("price", 0)),
                "image_url": raw.get("image_url") or raw.get("image"),
                "slug": raw.get("slug"),
                "saved_at": raw.get("saved_at") or datetime.now(timezone.utc).isoformat(),
            }
        for existing in (wl.items or []):
            key = (existing.get("product_id"), existing.get("variant_id"))
            if key not in merged:
                merged[key] = existing
        wl.items = list(merged.values())
        await self.db.commit()
        await self.db.refresh(wl)
        return wl

    async def clear(self, vendor_id: UUID, customer_id: UUID) -> Wishlist:
        wl = await self.repo.get_or_create(vendor_id, customer_id)
        wl.items = []
        await self.db.commit()
        await self.db.refresh(wl)
        return wl
