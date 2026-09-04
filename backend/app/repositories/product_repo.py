# app/repositories/product_repo.py
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, exists, cast, String
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import ColumnElement

from app.models.vendor_product import Product, ProductVariant, ProductImage
from app.models.review import Review
from app.services.catalog_store_scope import product_available_at_store
from app.repositories.base import BaseRepository

_DEL_SUFFIX_RE = re.compile(r"__del_[0-9a-f]{8}$", re.I)


def _trash_unique_value(value: Optional[str], product_id: UUID) -> Optional[str]:
    """Free unique slug/material_code while product is in trash."""
    if not value:
        return value
    base = _DEL_SUFFIX_RE.sub("", value)[:240]
    short = str(product_id).replace("-", "")[:8]
    return f"{base}__del_{short}"


def _restore_unique_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    return _DEL_SUFFIX_RE.sub("", value) or value


def _product_sort_clauses(sort: Optional[str], *, deleted_only: bool = False) -> tuple[ColumnElement, ...]:
    if deleted_only:
        return (Product.deleted_at.desc(),)
    key = (sort or "").strip().lower()
    if key == "price_low":
        return (Product.price.asc().nulls_last(), Product.created_at.desc())
    if key == "price_high":
        return (Product.price.desc().nulls_last(), Product.created_at.desc())
    if key == "newest":
        return (Product.created_at.desc(),)
    if key == "oldest":
        return (Product.created_at.asc(),)
    if key == "name":
        return (func.lower(Product.name).asc(),)
    if key == "name_desc":
        return (func.lower(Product.name).desc(),)
    if key == "rating":
        avg_rating = (
            select(func.coalesce(func.avg(Review.rating), 0.0))
            .where(
                Review.product_id == Product.id,
                Review.review_type == "product",
                Review.is_visible.is_(True),
            )
            .correlate(Product)
            .scalar_subquery()
        )
        return (avg_rating.desc(), Product.created_at.desc())
    if key == "rating_asc":
        avg_rating_asc = (
            select(func.coalesce(func.avg(Review.rating), 0.0))
            .where(
                Review.product_id == Product.id,
                Review.review_type == "product",
                Review.is_visible.is_(True),
            )
            .correlate(Product)
            .scalar_subquery()
        )
        return (avg_rating_asc.asc(), Product.created_at.desc())
    if key in ("default", "featured"):
        return (Product.is_featured.desc(), Product.created_at.desc())
    return (Product.created_at.desc(),)


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
                selectinload(Product.store_assignments),
            )
            .where(Product.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_vendor_and_id(
        self,
        vendor_id: UUID,
        product_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[Product]:
        """Get product by vendor ID and product ID."""
        conds = [
            Product.vendor_id == vendor_id,
            Product.id == product_id,
        ]
        if not include_deleted:
            conds.append(Product.deleted_at.is_(None))
        result = await self.db.execute(
            select(Product)
            .options(
                selectinload(Product.variants),
                selectinload(Product.images),
                selectinload(Product.store_assignments),
            )
            .where(and_(*conds))
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
                selectinload(Product.store_assignments),
            )
            .where(
                and_(
                    Product.vendor_id == vendor_id,
                    Product.slug == slug,
                    Product.deleted_at.is_(None),
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
                Product.slug == slug,
                Product.deleted_at.is_(None),
            )
        )
        if exclude_id:
            query = query.where(Product.id != exclude_id)
        
        result = await self.db.execute(query)
        return result.scalar_one() > 0

    async def name_exists(
        self,
        vendor_id: UUID,
        name: str,
        exclude_id: Optional[UUID] = None,
    ) -> bool:
        """Check if a product name already exists for this vendor (case-insensitive)."""
        normalized = (name or "").strip().lower()
        if not normalized:
            return False
        query = select(func.count()).select_from(Product).where(
            and_(
                Product.vendor_id == vendor_id,
                func.lower(Product.name) == normalized,
                Product.deleted_at.is_(None),
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
        is_visible: Optional[bool] = None,
        product_type: Optional[str] = None,
        stock: Optional[str] = None,
        store_id: Optional[UUID] = None,
        pharma_managed: Optional[bool] = None,
        deleted_only: bool = False,
        sort: Optional[str] = None,
    ) -> tuple[List[Product], int]:
        """List products for a vendor with filters."""
        query = select(Product).where(Product.vendor_id == vendor_id)
        count_query = select(func.count()).select_from(Product).where(
            Product.vendor_id == vendor_id
        )

        if deleted_only:
            query = query.where(Product.deleted_at.is_not(None))
            count_query = count_query.where(Product.deleted_at.is_not(None))
        else:
            query = query.where(Product.deleted_at.is_(None))
            count_query = count_query.where(Product.deleted_at.is_(None))

        if store_id:
            store_filter = product_available_at_store(store_id)
            query = query.where(store_filter)
            count_query = count_query.where(store_filter)

        if is_visible is True or visible_only:
            vis_filter = or_(Product.is_visible.is_(None), Product.is_visible == True)
            query = query.where(vis_filter)
            count_query = count_query.where(vis_filter)
        elif is_visible is False:
            query = query.where(Product.is_visible == False)
            count_query = count_query.where(Product.is_visible == False)

        if product_type:
            query = query.where(Product.product_type == product_type)
            count_query = count_query.where(Product.product_type == product_type)

        if stock == "out_of_stock":
            stock_filter = or_(
                Product.stock_status.in_(["out_of_stock", "discontinued"]),
                Product.quantity <= 0,
            )
            query = query.where(stock_filter)
            count_query = count_query.where(stock_filter)
        elif stock == "low_stock":
            low_threshold = func.coalesce(Product.low_stock_threshold, 5)
            stock_filter = and_(Product.quantity > 0, Product.quantity <= low_threshold)
            query = query.where(stock_filter)
            count_query = count_query.where(stock_filter)
        elif stock == "in_stock":
            low_threshold = func.coalesce(Product.low_stock_threshold, 5)
            stock_filter = and_(
                Product.quantity > low_threshold,
                or_(Product.stock_status.is_(None), Product.stock_status == "in_stock"),
            )
            query = query.where(stock_filter)
            count_query = count_query.where(stock_filter)

        if status:
            query = query.where(Product.status == status)
            count_query = count_query.where(Product.status == status)
        
        if category:
            # Parent = Product.category; child leaf may be Product.subcategory
            # (or a path segment like "Child / Grandchild"). Match both.
            cat = category.strip()
            category_filter = or_(
                Product.category == cat,
                Product.subcategory == cat,
                Product.subcategory.ilike(f"% / {cat}"),
                Product.subcategory.ilike(f"{cat} / %"),
                Product.subcategory.ilike(f"% / {cat} / %"),
            )
            query = query.where(category_filter)
            count_query = count_query.where(category_filter)
        
        if search:
            term = search.strip()
            like = f"%{term}%"
            variant_text_match = exists(
                select(ProductVariant.id).where(
                    ProductVariant.product_id == Product.id,
                    or_(
                        ProductVariant.name.ilike(like),
                        ProductVariant.sku.ilike(like),
                        ProductVariant.barcode.ilike(like),
                        ProductVariant.color.ilike(like),
                    ),
                )
            )
            search_clauses = [
                Product.name.ilike(like),
                Product.description.ilike(like),
                Product.short_description.ilike(like),
                Product.sku.ilike(like),
                Product.barcode.ilike(like),
                Product.brand.ilike(like),
                Product.category.ilike(like),
                Product.subcategory.ilike(like),
                Product.material_code.ilike(like),
                cast(Product.tags, String).ilike(like),
                variant_text_match,
            ]
            price_term = term.replace(",", "").replace("₹", "").replace("$", "").strip()
            try:
                price_val = float(price_term)
            except ValueError:
                price_val = None
            if price_val is not None:
                search_clauses.append(Product.price == price_val)
                search_clauses.append(
                    exists(
                        select(ProductVariant.id).where(
                            ProductVariant.product_id == Product.id,
                            ProductVariant.price == price_val,
                        )
                    )
                )
            search_filter = or_(*search_clauses)
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        if pharma_managed is not None:
            query = query.where(Product.pharma_managed == pharma_managed)
            count_query = count_query.where(Product.pharma_managed == pharma_managed)

        # Get total count
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()
        
        # Get items with relationships
        order_cols = _product_sort_clauses(sort, deleted_only=deleted_only)
        query = (
            query
            .options(
                selectinload(Product.variants),
                selectinload(Product.images),
                selectinload(Product.store_assignments),
            )
            .order_by(*order_cols)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        
        return items, total

    async def soft_delete(self, product: Product) -> None:
        """Move product to trash (soft delete)."""
        product.deleted_at = datetime.now(timezone.utc)
        product.slug = _trash_unique_value(product.slug, product.id) or product.slug
        if product.material_code:
            product.material_code = _trash_unique_value(product.material_code, product.id)
        await self.db.flush()

    async def restore(self, product: Product) -> Product:
        """Restore a soft-deleted product; resolve slug/material_code conflicts."""
        restored_slug = _restore_unique_value(product.slug) or product.slug
        if await self.slug_exists(product.vendor_id, restored_slug, exclude_id=product.id):
            restored_slug = f"{restored_slug}-restored"
        product.slug = restored_slug
        if product.material_code:
            product.material_code = _restore_unique_value(product.material_code)
        product.deleted_at = None
        await self.db.flush()
        return product

    async def hard_delete(self, product: Product) -> None:
        """Permanently remove a product."""
        await self.db.delete(product)
        await self.db.flush()
