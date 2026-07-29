# app/repositories/product_group_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.repositories.base import BaseRepository
from app.models.product_group import ProductGroup, ProductGroupItem, MAX_HIERARCHY_DEPTH


class ProductGroupRepository(BaseRepository[ProductGroup]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductGroup, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, group_id: UUID, with_items: bool = False,
    ) -> Optional[ProductGroup]:
        query = select(ProductGroup).where(
            ProductGroup.vendor_id == vendor_id,
            ProductGroup.id == group_id,
        )
        if with_items:
            query = query.options(
                selectinload(ProductGroup.items).selectinload(ProductGroupItem.product),
                selectinload(ProductGroup.items).selectinload(ProductGroupItem.service),
            )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_vendor_and_slug(self, vendor_id: UUID, slug: str) -> Optional[ProductGroup]:
        result = await self.db.execute(
            select(ProductGroup).where(
                ProductGroup.vendor_id == vendor_id,
                ProductGroup.slug == slug,
            )
        )
        return result.scalar_one_or_none()

    async def list_all_flat(
        self,
        vendor_id: UUID,
        group_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        parent_id: Optional[str] = None,
        root_only: bool = False,
    ) -> List[ProductGroup]:
        query = select(ProductGroup).where(ProductGroup.vendor_id == vendor_id)
        if group_type:
            query = query.where(ProductGroup.group_types.contains([group_type]))
        if is_active is not None:
            query = query.where(ProductGroup.is_active == is_active)
        if search:
            query = query.where(
                or_(ProductGroup.name.ilike(f"%{search}%"), ProductGroup.code.ilike(f"%{search}%"))
            )
        if root_only:
            query = query.where(ProductGroup.parent_id.is_(None))
        elif parent_id is not None:
            query = query.where(ProductGroup.parent_id == UUID(parent_id))
        query = query.order_by(ProductGroup.sort_order, ProductGroup.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        group_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[ProductGroup]:
        """Alias kept for compatibility. Returns all groups flat."""
        return await self.list_all_flat(vendor_id, group_type=group_type, is_active=is_active, search=search)

    async def get_tree(
        self,
        vendor_id: UUID,
        group_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[dict]:
        """Fetch all groups and assemble into a nested tree in Python."""
        all_groups = await self.list_all_flat(vendor_id, group_type=group_type, is_active=is_active, search=search)
        return _build_tree(all_groups)

    async def get_descendants(self, vendor_id: UUID, group_id: UUID) -> List[ProductGroup]:
        """All descendants of a group — uses materialized path prefix for efficiency."""
        group = await self.get_by_vendor_and_id(vendor_id, group_id)
        if not group:
            return []
        prefix = f"{group.path}/" if group.path else f"{group.slug}/"
        result = await self.db.execute(
            select(ProductGroup).where(
                ProductGroup.vendor_id == vendor_id,
                ProductGroup.path.like(f"{prefix}%"),
            )
        )
        return list(result.scalars().all())

    async def get_ancestors(self, vendor_id: UUID, group_id: UUID) -> List[ProductGroup]:
        """Walk up the parent chain and return [root, ..., direct_parent]."""
        ancestors: List[ProductGroup] = []
        current = await self.get_by_vendor_and_id(vendor_id, group_id)
        if not current or not current.parent_id:
            return ancestors
        pid = current.parent_id
        while pid:
            anc = await self.get_by_vendor_and_id(vendor_id, pid)
            if not anc:
                break
            ancestors.insert(0, anc)
            pid = anc.parent_id
        return ancestors

    async def has_children(self, group_id: UUID) -> bool:
        result = await self.db.execute(
            select(func.count(ProductGroup.id)).where(ProductGroup.parent_id == group_id)
        )
        return (result.scalar_one() or 0) > 0

    async def item_counts(self, group_ids: List[UUID]) -> dict:
        if not group_ids:
            return {}
        result = await self.db.execute(
            select(ProductGroupItem.group_id, func.count(ProductGroupItem.id))
            .where(ProductGroupItem.group_id.in_(group_ids))
            .group_by(ProductGroupItem.group_id)
        )
        return {row[0]: row[1] for row in result.all()}

    async def get_item(self, group_id: UUID, item_id: UUID) -> Optional[ProductGroupItem]:
        result = await self.db.execute(
            select(ProductGroupItem).where(
                ProductGroupItem.group_id == group_id,
                ProductGroupItem.id == item_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_existing_member_keys(self, group_id: UUID) -> set:
        result = await self.db.execute(
            select(ProductGroupItem.item_type, ProductGroupItem.product_id, ProductGroupItem.service_id)
            .where(ProductGroupItem.group_id == group_id)
        )
        keys = set()
        for item_type, product_id, service_id in result.all():
            keys.add((item_type, product_id or service_id))
        return keys

    async def is_ancestor_of(self, vendor_id: UUID, maybe_ancestor_id: UUID, target_id: UUID) -> bool:
        """Return True if maybe_ancestor_id is a strict ancestor of target_id.
        Used for cycle prevention: reject reparenting X under its own descendant."""
        descendants = await self.get_descendants(vendor_id, maybe_ancestor_id)
        return any(d.id == target_id for d in descendants)

    async def recompute_path_recursive(self, vendor_id: UUID, group_id: UUID, new_path: str, new_level: int) -> None:
        """After a reparent, update path/level for this node and all its descendants."""
        result = await self.db.execute(
            select(ProductGroup).where(
                ProductGroup.vendor_id == vendor_id,
                ProductGroup.id == group_id,
            )
        )
        group = result.scalar_one_or_none()
        if not group:
            return
        group.path = new_path
        group.level = new_level
        # Recurse into children
        children_result = await self.db.execute(
            select(ProductGroup).where(ProductGroup.parent_id == group_id)
        )
        for child in children_result.scalars().all():
            child_path = f"{new_path}/{child.slug}" if new_path else child.slug
            await self.recompute_path_recursive(vendor_id, child.id, child_path, new_level + 1)


def _build_tree(all_groups: List[ProductGroup]) -> List[dict]:
    """Assemble a flat list of ProductGroup ORM objects into a nested dict tree."""
    by_id = {str(g.id): g for g in all_groups}
    roots: List[ProductGroup] = []
    children_map: dict[str, list] = {}

    for g in all_groups:
        pid = str(g.parent_id) if g.parent_id else None
        if pid and pid in by_id:
            children_map.setdefault(pid, []).append(g)
        elif not pid:
            roots.append(g)

    def build(group: ProductGroup) -> dict:
        gid = str(group.id)
        kids = children_map.get(gid, [])
        return {"_model": group, "children": [build(k) for k in kids]}

    return [build(r) for r in roots]
