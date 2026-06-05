from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wishlist import Wishlist
from app.repositories.base import BaseRepository


class WishlistRepository(BaseRepository[Wishlist]):
    def __init__(self, db: AsyncSession):
        super().__init__(Wishlist, db)

    async def get_by_customer(self, vendor_id: UUID, customer_id: UUID) -> Optional[Wishlist]:
        result = await self.db.execute(
            select(Wishlist).where(
                Wishlist.vendor_id == vendor_id,
                Wishlist.customer_id == customer_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, vendor_id: UUID, customer_id: UUID) -> Wishlist:
        wl = await self.get_by_customer(vendor_id, customer_id)
        if not wl:
            wl = Wishlist(vendor_id=vendor_id, customer_id=customer_id, items=[])
            self.db.add(wl)
            await self.db.commit()
            await self.db.refresh(wl)
        return wl
