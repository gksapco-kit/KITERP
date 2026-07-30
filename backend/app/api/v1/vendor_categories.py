# app/api/v1/vendor_categories.py
import re
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.models.user import User
from app.models.vendor_category import VendorCategory
from app.models.vendor_product import Product
from app.models.vendor_service import Service
from app.schemas.vendor_category import CategoryCreate, CategoryUpdate
from app.repositories.vendor_category_repo import VendorCategoryRepository
from app.services.vendor_service import VendorService
from app.services.media_upload import delete_stored_file

router = APIRouter(dependencies=[Depends(require_permission("products.view"))])


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


def _category_to_dict(c: VendorCategory) -> dict:
    return {
        "id": str(c.id),
        "vendor_id": str(c.vendor_id),
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "name": c.name,
        "slug": c.slug,
        "description": c.description,
        "image_url": c.image_url,
        "applies_to": c.applies_to,
        "is_active": c.is_active,
        "is_visible": c.is_visible if c.is_visible is not None else True,
        "sort_order": c.sort_order or 0,
        "custom_fields": c.custom_fields or [],
        "children": [],
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _tree_node_to_dict(node: dict) -> dict:
    """Convert a tree node (from repo.get_tree) to a JSON-safe dict."""
    c = node["_model"]
    d = _category_to_dict(c)
    d["children"] = [_tree_node_to_dict(ch) for ch in node.get("children", [])]
    return d


@router.get("")
async def list_categories(
    applies_to: Optional[str] = Query(None, description="Filter: product, service, or both"),
    is_active: Optional[bool] = Query(None),
    parent_id: Optional[str] = Query(None, description="Filter by parent_id"),
    tree: bool = Query(False, description="Return as tree (root categories with nested children)"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorCategoryRepository(db)

    if tree:
        tree_data = await repo.get_tree(vendor_id, applies_to=applies_to, is_active=is_active)
        return JSONResponse(content={
            "categories": [_tree_node_to_dict(n) for n in tree_data],
        })

    items = await repo.list_by_vendor(
        vendor_id, applies_to=applies_to, is_active=is_active, parent_id=parent_id,
    )
    return JSONResponse(content={
        "categories": [_category_to_dict(c) for c in items],
    })


@router.get("/flat")
async def list_categories_flat(
    applies_to: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Return all categories as a flat list (useful for dropdowns)."""
    repo = VendorCategoryRepository(db)
    items = await repo.list_all_flat(vendor_id, applies_to=applies_to, is_active=is_active)
    return JSONResponse(content={
        "categories": [_category_to_dict(c) for c in items],
    })


@router.get("/{category_id}")
async def get_category(
    category_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorCategoryRepository(db)
    category = await repo.get_by_vendor_and_id(vendor_id, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    d = _category_to_dict(category)
    children = await repo.list_by_vendor(vendor_id, parent_id=str(category_id))
    d["children"] = [_category_to_dict(ch) for ch in children]
    return JSONResponse(content=d)


@router.get("/{category_id}/catalogues")
async def get_category_catalogues(
    category_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get products and services under a category (its catalogue)."""
    repo = VendorCategoryRepository(db)
    category = await repo.get_by_vendor_and_id(vendor_id, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Collect this category + all its children slugs for matching
    slugs = [category.slug, category.name]
    children = await repo.list_by_vendor(vendor_id, parent_id=str(category_id))
    for ch in children:
        slugs.extend([ch.slug, ch.name])

    products_list = []
    services_list = []

    if category.applies_to in ("product", "both"):
        result = await db.execute(
            select(Product).where(
                Product.vendor_id == vendor_id,
                Product.category.in_(slugs),
            ).limit(100)
        )
        products_list = [
            {"id": str(p.id), "name": p.name, "slug": p.slug, "category": p.category,
             "subcategory": p.subcategory, "price": float(p.price or 0),
             "image_url": (p.images or [{}])[0].get("url") if p.images else None,
             "status": p.status}
            for p in result.scalars().all()
        ]

    if category.applies_to in ("service", "both"):
        result = await db.execute(
            select(Service).where(
                Service.vendor_id == vendor_id,
                Service.category.in_(slugs),
            ).limit(100)
        )
        services_list = [
            {"id": str(s.id), "name": s.name, "slug": s.slug, "category": s.category,
             "subcategory": s.subcategory, "price": float(s.price or 0),
             "image_url": (s.images or [{}])[0].get("url") if s.images else None,
             "status": s.status}
            for s in result.scalars().all()
        ]

    return JSONResponse(content={
        "category": _category_to_dict(category),
        "products": products_list,
        "services": services_list,
        "product_count": len(products_list),
        "service_count": len(services_list),
    })


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorCategoryRepository(db)
    slug = _slugify(data.name)

    existing = await repo.get_by_vendor_and_slug(vendor_id, slug)
    if existing:
        raise HTTPException(status_code=400, detail="A category with this name already exists")

    if data.parent_id:
        parent = await repo.get_by_vendor_and_id(vendor_id, UUID(data.parent_id))
        if not parent:
            raise HTTPException(status_code=400, detail="Parent category not found")

    category = VendorCategory(
        vendor_id=vendor_id,
        parent_id=UUID(data.parent_id) if data.parent_id else None,
        name=data.name,
        slug=slug,
        description=data.description,
        image_url=data.image_url,
        applies_to=data.applies_to.value,
        sort_order=data.sort_order,
        is_visible=data.is_visible,
        custom_fields=[f.model_dump() for f in data.custom_fields] if data.custom_fields else [],
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return JSONResponse(content=_category_to_dict(category), status_code=201)


@router.put("/{category_id}")
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorCategoryRepository(db)
    category = await repo.get_by_vendor_and_id(vendor_id, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if data.name is not None:
        new_slug = _slugify(data.name)
        dup = await repo.get_by_vendor_and_slug(vendor_id, new_slug)
        if dup and dup.id != category.id:
            raise HTTPException(status_code=400, detail="A category with this name already exists")
        category.name = data.name
        category.slug = new_slug

    if data.description is not None:
        category.description = data.description
    if "image_url" in data.model_fields_set:
        if category.image_url and data.image_url != category.image_url:
            await delete_stored_file(category.image_url)
        category.image_url = data.image_url or None
    if data.applies_to is not None:
        category.applies_to = data.applies_to.value
    if data.is_active is not None:
        category.is_active = data.is_active
    if data.is_visible is not None:
        category.is_visible = data.is_visible
    if "parent_id" in data.model_fields_set:
        if data.parent_id == str(category_id):
            raise HTTPException(status_code=400, detail="Category cannot be its own parent")
        category.parent_id = UUID(data.parent_id) if data.parent_id else None
    if data.sort_order is not None:
        category.sort_order = data.sort_order
    if data.custom_fields is not None:
        category.custom_fields = [f.model_dump() for f in data.custom_fields]

    await db.commit()
    await db.refresh(category)
    return JSONResponse(content=_category_to_dict(category))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorCategoryRepository(db)
    category = await repo.get_by_vendor_and_id(vendor_id, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(category)
    await db.commit()
