# app/repositories/storage_location_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.repositories.base import BaseRepository
from app.models.storage_location import StorageLocation


class StorageLocationRepository(BaseRepository[StorageLocation]):
    def __init__(self, db: AsyncSession):
        super().__init__(StorageLocation, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, location_id: UUID
    ) -> Optional[StorageLocation]:
        result = await self.db.execute(
            select(StorageLocation).where(
                StorageLocation.vendor_id == vendor_id,
                StorageLocation.id == location_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_store_and_code(
        self, vendor_id: UUID, store_id: UUID, code: str
    ) -> Optional[StorageLocation]:
        result = await self.db.execute(
            select(StorageLocation).where(
                StorageLocation.vendor_id == vendor_id,
                StorageLocation.store_id == store_id,
                StorageLocation.code == code,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_store(
        self,
        vendor_id: UUID,
        store_id: UUID,
        is_active: Optional[bool] = None,
        parent_id: Optional[str] = None,
        root_only: bool = False,
    ) -> List[StorageLocation]:
        query = select(StorageLocation).where(
            StorageLocation.vendor_id == vendor_id,
            StorageLocation.store_id == store_id,
        )
        if is_active is not None:
            query = query.where(StorageLocation.is_active == is_active)
        if root_only:
            query = query.where(StorageLocation.parent_id.is_(None))
        elif parent_id is not None:
            query = query.where(StorageLocation.parent_id == UUID(parent_id))
        query = query.order_by(StorageLocation.sort_order, StorageLocation.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_all_flat(
        self,
        vendor_id: UUID,
        store_id: Optional[UUID] = None,
        is_active: Optional[bool] = None,
        plant_id: Optional[UUID] = None,
    ) -> List[StorageLocation]:
        query = select(StorageLocation).where(StorageLocation.vendor_id == vendor_id)
        if store_id is not None:
            query = query.where(StorageLocation.store_id == store_id)
        if is_active is not None:
            query = query.where(StorageLocation.is_active == is_active)
        if plant_id is not None:
            query = query.where(StorageLocation.plant_id == plant_id)
        query = query.order_by(StorageLocation.sort_order, StorageLocation.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_tree(
        self,
        vendor_id: UUID,
        store_id: Optional[UUID] = None,
        is_active: Optional[bool] = None,
        plant_id: Optional[UUID] = None,
    ) -> List[dict]:
        all_locs = await self.list_all_flat(
            vendor_id, store_id, is_active=is_active, plant_id=plant_id,
        )
        by_id = {str(loc.id): loc for loc in all_locs}
        roots = []
        children_map: dict[str, list] = {}

        for loc in all_locs:
            pid = str(loc.parent_id) if loc.parent_id else None
            if pid and pid in by_id:
                children_map.setdefault(pid, []).append(loc)
            elif not pid:
                roots.append(loc)

        def build(node: StorageLocation) -> dict:
            nid = str(node.id)
            kids = children_map.get(nid, [])
            return {"_model": node, "children": [build(k) for k in kids]}

        return [build(r) for r in roots]
