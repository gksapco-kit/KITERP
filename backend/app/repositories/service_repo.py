# app/repositories/service_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.models.vendor_service import Service, ServiceAvailability, ServicePlan
from app.services.catalog_store_scope import service_available_at_store
from app.repositories.base import BaseRepository


class ServiceRepository(BaseRepository[Service]):
    """Repository for service operations."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Service, db)
    
    async def get_by_id(self, id: UUID) -> Optional[Service]:
        """Get service by ID with relationships."""
        result = await self.db.execute(
            select(Service)
            .options(selectinload(Service.availability), selectinload(Service.plans), selectinload(Service.store_assignments))
            .where(Service.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_vendor_and_id(
        self,
        vendor_id: UUID,
        service_id: UUID
    ) -> Optional[Service]:
        """Get service by vendor ID and service ID."""
        result = await self.db.execute(
            select(Service)
            .options(selectinload(Service.availability), selectinload(Service.plans), selectinload(Service.store_assignments))
            .where(
                and_(
                    Service.vendor_id == vendor_id,
                    Service.id == service_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def find_by_slug(
        self,
        vendor_id: UUID,
        slug: str
    ) -> Optional[Service]:
        """Find service by vendor ID and slug."""
        result = await self.db.execute(
            select(Service)
            .options(selectinload(Service.availability), selectinload(Service.plans), selectinload(Service.store_assignments))
            .where(
                and_(
                    Service.vendor_id == vendor_id,
                    Service.slug == slug
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def slug_exists(
        self,
        vendor_id: UUID,
        slug: str,
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """Check if slug exists for vendor."""
        query = select(func.count()).select_from(Service).where(
            and_(
                Service.vendor_id == vendor_id,
                Service.slug == slug
            )
        )
        if exclude_id:
            query = query.where(Service.id != exclude_id)
        
        result = await self.db.execute(query)
        return result.scalar_one() > 0

    async def name_exists(
        self,
        vendor_id: UUID,
        name: str,
        exclude_id: Optional[UUID] = None,
    ) -> bool:
        """Check if a service name already exists for this vendor (case-insensitive)."""
        normalized = (name or "").strip().lower()
        if not normalized:
            return False
        query = select(func.count()).select_from(Service).where(
            and_(
                Service.vendor_id == vendor_id,
                func.lower(Service.name) == normalized,
            )
        )
        if exclude_id:
            query = query.where(Service.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one() > 0
    
    async def list_by_vendor(
        self,
        vendor_id: UUID,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        visible_only: bool = False,
        is_visible: Optional[bool] = None,
        service_type: Optional[str] = None,
        service_mode: Optional[str] = None,
        store_id: Optional[UUID] = None,
    ) -> tuple[List[Service], int]:
        """List services for a vendor with filters."""
        query = select(Service).where(Service.vendor_id == vendor_id)
        count_query = select(func.count()).select_from(Service).where(
            Service.vendor_id == vendor_id
        )

        if store_id:
            store_filter = service_available_at_store(store_id)
            query = query.where(store_filter)
            count_query = count_query.where(store_filter)

        if is_visible is True or visible_only:
            vis_filter = or_(Service.is_visible.is_(None), Service.is_visible == True)
            query = query.where(vis_filter)
            count_query = count_query.where(vis_filter)
        elif is_visible is False:
            query = query.where(Service.is_visible == False)
            count_query = count_query.where(Service.is_visible == False)

        if service_type:
            query = query.where(Service.service_type == service_type)
            count_query = count_query.where(Service.service_type == service_type)

        if service_mode:
            query = query.where(Service.service_mode == service_mode)
            count_query = count_query.where(Service.service_mode == service_mode)
        
        if status:
            query = query.where(Service.status == status)
            count_query = count_query.where(Service.status == status)
        
        if category:
            # Parent = Service.category; child leaf may be Service.subcategory
            # (or a path segment like "Child / Grandchild"). Match both.
            cat = category.strip()
            category_filter = or_(
                Service.category == cat,
                Service.subcategory == cat,
                Service.subcategory.ilike(f"% / {cat}"),
                Service.subcategory.ilike(f"{cat} / %"),
                Service.subcategory.ilike(f"% / {cat} / %"),
            )
            query = query.where(category_filter)
            count_query = count_query.where(category_filter)
        
        if search:
            search_filter = or_(
                Service.name.ilike(f"%{search}%"),
                Service.description.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        
        # Get total count
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()
        
        # Get items with relationships
        query = (
            query
            .options(selectinload(Service.availability), selectinload(Service.plans), selectinload(Service.store_assignments))
            .order_by(Service.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        
        return items, total
