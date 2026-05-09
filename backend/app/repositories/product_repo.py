# app/repositories/product_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.models.vendor_product import Product, ProductVariant, ProductImage
from app.repositories.base import BaseRepository


class ProductRepository(BaseRepository[Product]):
    """Repository for product operations."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Product, db)
    
    async def get_by_id(self, id: UUID) -> Optional[Product]:
        """Get product by ID with relationships."""
        result = await self.db.execute(
            select(Product)
            .options(
                selectinload(Product.variants),
                selectinload(Product.images),
            )
            .where(Product.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_vendor_and_id(
        self,
        vendor_id: UUID,
        product_id: UUID
    ) -> Optional[Product]:
        """Get product by vendor ID and product ID."""
        result = await self.db.execute(
            select(Product)
            .options(
                selectinload(Product.variants),
                selectinload(Product.images),
            )
            .where(
                and_(
                    Product.vendor_id == vendor_id,
                    Product.id == product_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def find_by_slug(
        self,
        vendor_id: UUID,
        slug: str
    ) -> Optional[Product]:
        """Find product by vendor ID and slug."""
        result = await self.db.execute(
            select(Product)
            .options(
                selectinload(Product.variants),
                selectinload(Product.images),
            )
            .where(
                and_(
                    Product.vendor_id == vendor_id,
                    Product.slug == slug
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
        query = select(func.count()).select_from(Product).where(
            and_(
                Product.vendor_id == vendor_id,
                Product.slug == slug
            )
        )
        if exclude_id:
            query = query.where(Product.id != exclude_id)
        
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
    ) -> tuple[List[Product], int]:
        """List products for a vendor with filters."""
        query = select(Product).where(Product.vendor_id == vendor_id)
        count_query = select(func.count()).select_from(Product).where(
            Product.vendor_id == vendor_id
        )

        if visible_only:
            # Treat NULL as visible (column added later; legacy rows have no value set)
            vis_filter = or_(Product.is_visible.is_(None), Product.is_visible == True)
            query = query.where(vis_filter)
            count_query = count_query.where(vis_filter)

        if status:
            query = query.where(Product.status == status)
            count_query = count_query.where(Product.status == status)
        
        if category:
            query = query.where(Product.category == category)
            count_query = count_query.where(Product.category == category)
        
        if search:
            search_filter = or_(
                Product.name.ilike(f"%{search}%"),
                Product.description.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
                Product.barcode.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        
        # Get total count
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()
        
        # Get items with relationships
        query = (
            query
            .options(selectinload(Product.variants), selectinload(Product.images))
            .order_by(Product.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        
        return items, total
