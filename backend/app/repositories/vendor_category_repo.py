# app/repositories/vendor_category_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.repositories.base import BaseRepository
from app.models.vendor_category import VendorCategory


class VendorCategoryRepository(BaseRepository[VendorCategory]):
    def __init__(self, db: AsyncSession):
        super().__init__(VendorCategory, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, category_id: UUID
    ) -> Optional[VendorCategory]:
        result = await self.db.execute(
            select(VendorCategory).where(
                VendorCategory.vendor_id == vendor_id,
                VendorCategory.id == category_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_vendor_and_slug(
        self, vendor_id: UUID, slug: str
    ) -> Optional[VendorCategory]:
        result = await self.db.execute(
            select(VendorCategory).where(
                VendorCategory.vendor_id == vendor_id,
                VendorCategory.slug == slug,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        applies_to: Optional[str] = None,
        is_active: Optional[bool] = None,
        parent_id: Optional[str] = None,
        root_only: bool = False,
    ) -> List[VendorCategory]:
        query = select(VendorCategory).where(VendorCategory.vendor_id == vendor_id)

        if applies_to:
            query = query.where(
                or_(
                    VendorCategory.applies_to == applies_to,
                    VendorCategory.applies_to == "both",
                )
            )

        if is_active is not None:
            query = query.where(VendorCategory.is_active == is_active)

        if root_only:
            query = query.where(VendorCategory.parent_id.is_(None))
        elif parent_id is not None:
            query = query.where(VendorCategory.parent_id == UUID(parent_id))

        query = query.order_by(VendorCategory.sort_order, VendorCategory.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_all_flat(
        self,
        vendor_id: UUID,
        applies_to: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[VendorCategory]:
        """Return all categories as a flat list."""
        query = select(VendorCategory).where(VendorCategory.vendor_id == vendor_id)
        if applies_to:
            query = query.where(
                or_(
                    VendorCategory.applies_to == applies_to,
                    VendorCategory.applies_to == "both",
                )
            )
        if is_active is not None:
            query = query.where(VendorCategory.is_active == is_active)
        query = query.order_by(VendorCategory.sort_order, VendorCategory.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_tree(
        self,
        vendor_id: UUID,
        applies_to: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[dict]:
        """Fetch all categories and assemble them into a tree in Python."""
        all_cats = await self.list_all_flat(vendor_id, applies_to=applies_to, is_active=is_active)

        by_id = {}
        for c in all_cats:
            by_id[str(c.id)] = c

        roots = []
        children_map: dict[str, list] = {}

        for c in all_cats:
            pid = str(c.parent_id) if c.parent_id else None
            if pid and pid in by_id:
                children_map.setdefault(pid, []).append(c)
            elif not pid:
                roots.append(c)

        def build(cat: VendorCategory) -> dict:
            cid = str(cat.id)
            kids = children_map.get(cid, [])
            return {
                "_model": cat,
                "children": [build(k) for k in kids],
            }

        return [build(r) for r in roots]
