# app/api/v1/catalog.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
import math

from app.database import get_db
from app.middleware.tenant import get_current_vendor_id as get_tenant_vendor_id
from app.schemas.vendor import VendorResponse
from app.schemas.vendor_product import ProductResponse, ProductListResponse
from app.schemas.vendor_service import ServiceResponse, ServiceListResponse
from app.services.vendor_service import VendorService
from app.repositories.vendor_repo import VendorRepository
from app.repositories.product_repo import ProductRepository
from app.repositories.service_repo import ServiceRepository
from app.api.v1.vendor_products import _product_to_dict
from app.api.v1.vendor_services import _service_to_dict
from app.repositories.review_repo import ReviewRepository
from app.utils.geo import haversine_km
from app.utils.vendor_storefront import vendor_live_on_storefront
from app.services.storefront_theme_config import normalize_theme_config, theme_config_needs_migration

router = APIRouter()


async def get_vendor_id_from_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """Get vendor ID from tenant context, X-Vendor-Slug header, or X-Vendor-Id header."""
    # 1. Tenant middleware (subdomain)
    vendor_id = get_tenant_vendor_id(request)
    if vendor_id:
        return UUID(vendor_id)

    # 2. X-Vendor-Id header
    header_id = request.headers.get("x-vendor-id")
    if header_id:
        return UUID(header_id)

    # 3. X-Vendor-Slug header (SaaS path-based resolution)
    vendor_slug = request.headers.get("x-vendor-slug")
    if vendor_slug:
        repo = VendorRepository(db)
        vendor = await repo.find_by_slug(vendor_slug)
        if vendor and vendor_live_on_storefront(vendor.status):
            return vendor.id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor '{vendor_slug}' not found or not available on the business front.",
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Vendor not found. Use subdomain, X-Vendor-Id, or X-Vendor-Slug header.",
    )


@router.get("/nearby-vendors")
async def nearby_vendors(
    user_lat: float = Query(..., ge=-90, le=90, description="User latitude"),
    user_lon: float = Query(..., ge=-180, le=180, description="User longitude"),
    radius_km: Optional[float] = Query(None, ge=1, le=500, description="Override radius (uses vendor's own if omitted)"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    offering_type: Optional[str] = Query(None, description="products, services, or both"),
    db: AsyncSession = Depends(get_db),
):
    """
    Find vendors whose service area covers the user's location.

    Each vendor has a configurable ``service_radius_km``.
    Pass ``radius_km`` to override and search within a fixed radius instead.
    """
    repo = VendorRepository(db)
    skip = (page - 1) * size

    rows, total = await repo.find_nearby(
        user_lat=user_lat,
        user_lon=user_lon,
        radius_km=radius_km,
        skip=skip,
        limit=size,
        search=search,
        offering_type=offering_type,
    )

    items = []
    for row in rows:
        v = row["vendor"]
        items.append({
            "id": str(v.id),
            "business_name": v.business_name,
            "display_name": v.display_name,
            "slug": v.slug,
            "subdomain": v.subdomain,
            "offering_type": v.offering_type or "both",
            "industry": v.industry,
            "description": v.description,
            "logo_url": v.logo_url,
            "city": v.city,
            "state": v.state,
            "latitude": float(v.latitude) if v.latitude else None,
            "longitude": float(v.longitude) if v.longitude else None,
            "service_radius_km": v.service_radius_km,
            "distance_km": row["distance_km"],
            "status": v.status,
        })

    return JSONResponse(content={
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
        "user_location": {"latitude": user_lat, "longitude": user_lon},
    })


@router.get("/vendors")
async def list_storefront_vendors(
    q: Optional[str] = Query(None, max_length=120, description="Filter by slug or business name"),
    limit: int = Query(60, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Public directory of vendors that can be opened on the path-based business front
    (``/store/{slug}``). Used by the marketing landing page for suggestions.
    """
    repo = VendorRepository(db)
    items, total = await repo.list_storefront_directory(search=q, skip=0, limit=limit)
    return JSONResponse(content={
        "items": [
            {
                "slug": v.slug,
                "display_name": v.display_name or v.business_name,
                "business_name": v.business_name,
            }
            for v in items
        ],
        "total": total,
    })


@router.get("/vendor/{vendor_slug}/distance")
async def get_vendor_distance(
    vendor_slug: str,
    user_lat: float = Query(..., ge=-90, le=90),
    user_lon: float = Query(..., ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    """
    Check if a specific vendor's service area covers the user's location.
    Returns distance and whether the user is within the vendor's radius.
    """
    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)

    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    if not vendor.latitude or not vendor.longitude:
        return JSONResponse(content={
            "vendor_slug": vendor_slug,
            "distance_km": None,
            "within_radius": True,
            "service_radius_km": vendor.service_radius_km,
            "message": "Vendor has not set a location",
        })

    distance = haversine_km(
        float(vendor.latitude), float(vendor.longitude),
        user_lat, user_lon,
    )
    within = distance <= vendor.service_radius_km

    return JSONResponse(content={
        "vendor_slug": vendor_slug,
        "distance_km": round(distance, 2),
        "within_radius": within,
        "service_radius_km": vendor.service_radius_km,
        "vendor_location": {
            "latitude": float(vendor.latitude),
            "longitude": float(vendor.longitude),
        },
    })


@router.get("/vendor/{vendor_slug}")
async def get_vendor_by_slug(
    vendor_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: Look up a vendor by slug.
    Used by the business front SaaS app to resolve vendor from URL path.
    """
    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)

    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    raw_theme = vendor.theme_config or {}
    if theme_config_needs_migration(raw_theme):
        normalized_theme = normalize_theme_config(raw_theme)
        vendor.theme_config = normalized_theme
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(vendor, "theme_config")
        await db.commit()
        await db.refresh(vendor)
        theme_payload = normalized_theme
    else:
        theme_payload = normalize_theme_config(raw_theme)

    return {
        "id": str(vendor.id),
        "business_name": vendor.business_name,
        "display_name": vendor.display_name,
        "slug": vendor.slug,
        "description": vendor.description,
        "logo_url": vendor.logo_url,
        "banner_url": vendor.banner_url,
        "theme_config": theme_payload,
        "primary_email": vendor.primary_email,
        "primary_phone": vendor.primary_phone,
        "support_email": vendor.support_email,
        "support_phone": vendor.support_phone,
        "settings": vendor.settings or {},
        "street_address": vendor.street_address,
        "city": vendor.city,
        "state": vendor.state,
        "postal_code": vendor.postal_code,
        "country": vendor.country,
        "latitude": float(vendor.latitude) if vendor.latitude else None,
        "longitude": float(vendor.longitude) if vendor.longitude else None,
        "service_radius_km": vendor.service_radius_km,
        "social_links": vendor.social_links or {},
        "business_hours": vendor.business_hours or {},
        "gstin": vendor.gstin,
        "is_gst_registered": vendor.is_gst_registered,
        "default_tax_rate": float(vendor.default_tax_rate) if vendor.default_tax_rate else None,
    }


@router.get("/stores")
async def list_public_stores(
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Return active store locations for the vendor's business front."""
    from sqlalchemy import select
    from app.models.store import Store

    result = await db.execute(
        select(Store)
        .where(Store.vendor_id == vendor_id, Store.is_active == True, Store.is_open == True)
        .order_by(Store.is_default.desc(), Store.name)
    )
    stores = result.scalars().all()

    def _to_dict(s: Store) -> dict:
        return {
            "id": str(s.id),
            "name": s.name,
            "code": s.code,
            "description": s.description,
            "phone": s.phone,
            "email": s.email,
            "address": s.address or {},
            "is_default": s.is_default,
            "is_open": s.is_open if s.is_open is not None else True,
            "settings": s.settings or {},
        }

    return {"stores": [_to_dict(s) for s in stores], "total": len(stores)}


@router.get("/info", response_model=VendorResponse)
async def get_vendor_info(
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get public vendor information."""
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)
    
    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    return vendor


def _store_cat_dict(c):
    return {
        "id": str(c.id),
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "name": c.name,
        "slug": c.slug,
        "description": c.description,
        "applies_to": c.applies_to,
        "children": [],
    }


def _store_tree_node(node):
    c = node["_model"]
    d = _store_cat_dict(c)
    d["children"] = [_store_tree_node(ch) for ch in node.get("children", [])]
    return d


@router.get("/categories")
async def list_categories(
    applies_to: Optional[str] = Query(None, description="Filter: product, service, or both"),
    tree: bool = Query(False, description="Return as nested tree"),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List active categories for the vendor business front."""
    from app.repositories.vendor_category_repo import VendorCategoryRepository
    repo = VendorCategoryRepository(db)

    if tree:
        tree_data = await repo.get_tree(vendor_id, applies_to=applies_to, is_active=True)
        return JSONResponse(content={
            "categories": [_store_tree_node(n) for n in tree_data],
        })

    items = await repo.list_by_vendor(vendor_id, applies_to=applies_to, is_active=True)
    return JSONResponse(content={
        "categories": [_store_cat_dict(c) for c in items],
    })


@router.get("/products")
async def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    branch: Optional[str] = Query(None, description="Business unit code or id"),
    store_id: Optional[str] = Query(None, description="Business unit id"),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List active products for vendor business front."""
    from app.services.catalog_store_scope import resolve_store_id
    repo = ProductRepository(db)
    skip = (page - 1) * size
    sid = await resolve_store_id(db, vendor_id, store_id=store_id, branch=branch)
    
    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status="active",
        category=category,
        search=search,
        visible_only=True,
        store_id=sid,
    )

    # Apply price range filter if provided
    if min_price is not None:
        items = [p for p in items if float(p.price or 0) >= min_price]
    if max_price is not None:
        items = [p for p in items if float(p.price or 0) <= max_price]

    # Recalculate total if price filters applied
    if min_price is not None or max_price is not None:
        all_items, _ = await repo.list_by_vendor(
            vendor_id=vendor_id,
            skip=0,
            limit=10000,
            status="active",
            category=category,
            search=search,
            visible_only=True,
            store_id=sid,
        )
        if min_price is not None:
            all_items = [p for p in all_items if float(p.price or 0) >= min_price]
        if max_price is not None:
            all_items = [p for p in all_items if float(p.price or 0) <= max_price]
        total = len(all_items)

    review_repo = ReviewRepository(db)
    product_dicts = []
    for p in items:
        d = _product_to_dict(p)
        stats = await review_repo.get_avg_rating("product", product_id=p.id)
        d["avg_rating"] = stats["avg_rating"]
        d["review_count"] = stats["review_count"]
        product_dicts.append(d)

    return JSONResponse(content={
        "items": product_dicts,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/products/{slug}")
async def get_product(
    slug: str,
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific product by slug."""
    repo = ProductRepository(db)
    product = await repo.find_by_slug(vendor_id, slug)

    if not product or product.status != "active" or not product.is_visible:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    product.view_count = (product.view_count or 0) + 1
    await db.commit()
    await db.refresh(product)

    review_repo = ReviewRepository(db)
    d = _product_to_dict(product)
    stats = await review_repo.get_avg_rating("product", product_id=product.id)
    d["avg_rating"] = stats["avg_rating"]
    d["review_count"] = stats["review_count"]
    distribution = await review_repo.get_rating_distribution("product", product_id=product.id)
    d["rating_distribution"] = distribution

    # Attach cross-sell and upsell product cards
    merch = await _get_product_merchandising(product.id, vendor_id, db, source_product=product)
    d["cross_sell_products"] = merch["cross_sell"]
    d["upsell_products"] = merch["upsell"]

    return JSONResponse(content=d)


async def _product_to_card(p, review_repo: ReviewRepository) -> dict:
    stats = await review_repo.get_avg_rating("product", product_id=p.id)
    return {
        "id": str(p.id),
        "name": p.name,
        "slug": p.slug,
        "price": float(p.price or 0),
        "compare_at_price": float(p.compare_at_price) if p.compare_at_price else None,
        "currency": p.currency or "INR",
        "images": [{"id": str(img.id), "url": img.url, "alt_text": img.alt_text, "is_primary": img.is_primary, "media_type": img.media_type or "image"} for img in (p.images or [])],
        "avg_rating": stats["avg_rating"],
        "review_count": stats["review_count"],
        "stock_status": p.stock_status or "in_stock",
        "brand": p.brand,
        "category": p.category,
    }


async def _get_product_merchandising(
    product_id: UUID, vendor_id: UUID, db: AsyncSession,
    source_product=None,
) -> dict:
    """
    Resolve cross-sell and upsell products.
    1. Use manual UpsellMapping rows if they exist.
    2. Otherwise auto-recommend:
       - cross_sell: same-category products
       - upsell: best-selling / featured / highest-rated products
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.merchandising import UpsellMapping
    from app.models.vendor_product import Product

    review_repo = ReviewRepository(db)

    # ── Try manual mappings first ──
    stmt = (
        select(UpsellMapping)
        .where(
            UpsellMapping.vendor_id == vendor_id,
            UpsellMapping.source_product_id == product_id,
            UpsellMapping.is_active == True,
            UpsellMapping.trigger_stage == "PDP",
            UpsellMapping.target_type == "product",
            UpsellMapping.target_product_id.isnot(None),
        )
        .order_by(UpsellMapping.priority.desc())
    )
    result = await db.execute(stmt)
    mappings = result.scalars().all()

    if mappings:
        target_ids = [m.target_product_id for m in mappings]
        prod_stmt = (
            select(Product)
            .options(selectinload(Product.images))
            .where(Product.id.in_(target_ids), Product.status == "active", Product.is_visible == True)
        )
        prod_result = await db.execute(prod_stmt)
        products_by_id = {p.id: p for p in prod_result.scalars().all()}

        cross_sell, upsell = [], []
        for m in mappings:
            p = products_by_id.get(m.target_product_id)
            if not p:
                continue
            card = await _product_to_card(p, review_repo)
            if m.relation_type == "cross_sell":
                cross_sell.append(card)
            else:
                upsell.append(card)
        return {"cross_sell": cross_sell, "upsell": upsell}

    # ── Auto-recommend when no manual mappings exist ──
    MAX_ITEMS = 6

    # Cross-sell: products in the same category (excluding current product)
    cross_sell = []
    category = source_product.category if source_product else None
    if category:
        cat_stmt = (
            select(Product)
            .options(selectinload(Product.images))
            .where(
                Product.vendor_id == vendor_id,
                Product.id != product_id,
                Product.status == "active",
                Product.is_visible == True,
                Product.category == category,
            )
            .order_by(Product.is_featured.desc(), Product.created_at.desc())
            .limit(MAX_ITEMS)
        )
        cat_result = await db.execute(cat_stmt)
        for p in cat_result.scalars().all():
            cross_sell.append(await _product_to_card(p, review_repo))

    # Upsell: best-selling / featured / highest-rated across the store
    # Prefer featured products, then those with more reviews (proxy for popularity)
    seen_ids = {product_id} | {UUID(c["id"]) for c in cross_sell}
    upsell_stmt = (
        select(Product)
        .options(selectinload(Product.images))
        .where(
            Product.vendor_id == vendor_id,
            Product.id.notin_(seen_ids),
            Product.status == "active",
            Product.is_visible == True,
        )
        .order_by(
            Product.is_best_seller.desc(),
            Product.is_featured.desc(),
            Product.is_new_arrival.desc(),
            Product.created_at.desc(),
        )
        .limit(MAX_ITEMS)
    )
    upsell_result = await db.execute(upsell_stmt)
    upsell = []
    for p in upsell_result.scalars().all():
        upsell.append(await _product_to_card(p, review_repo))

    return {"cross_sell": cross_sell, "upsell": upsell}


@router.get("/services")
async def list_services(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    branch: Optional[str] = Query(None, description="Business unit code or id"),
    store_id: Optional[str] = Query(None, description="Business unit id"),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List active services for vendor business front."""
    from app.services.catalog_store_scope import resolve_store_id
    repo = ServiceRepository(db)
    skip = (page - 1) * size
    sid = await resolve_store_id(db, vendor_id, store_id=store_id, branch=branch)

    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status="active",
        category=category,
        search=search,
        visible_only=True,
        store_id=sid,
    )

    # Apply price range filter if provided
    if min_price is not None:
        items = [s for s in items if float(s.price or s.price_min or 0) >= min_price]
    if max_price is not None:
        items = [s for s in items if float(s.price or s.price_max or 0) <= max_price]

    # Recalculate total if price filters applied
    if min_price is not None or max_price is not None:
        all_items, _ = await repo.list_by_vendor(
            vendor_id=vendor_id,
            skip=0,
            limit=10000,
            status="active",
            category=category,
            search=search,
            visible_only=True,
            store_id=sid,
        )
        if min_price is not None:
            all_items = [s for s in all_items if float(s.price or s.price_min or 0) >= min_price]
        if max_price is not None:
            all_items = [s for s in all_items if float(s.price or s.price_max or 0) <= max_price]
        total = len(all_items)

    review_repo = ReviewRepository(db)
    service_dicts = []
    for s in items:
        d = _service_to_dict(s)
        stats = await review_repo.get_avg_rating("service", service_id=s.id)
        d["avg_rating"] = stats["avg_rating"]
        d["review_count"] = stats["review_count"]
        service_dicts.append(d)

    return JSONResponse(content={
        "items": service_dicts,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/services/{slug}")
async def get_service(
    slug: str,
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific service by slug."""
    repo = ServiceRepository(db)
    svc = await repo.find_by_slug(vendor_id, slug)

    if not svc or svc.status != "active" or not svc.is_visible:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    review_repo = ReviewRepository(db)
    d = _service_to_dict(svc)
    stats = await review_repo.get_avg_rating("service", service_id=svc.id)
    d["avg_rating"] = stats["avg_rating"]
    d["review_count"] = stats["review_count"]
    distribution = await review_repo.get_rating_distribution("service", service_id=svc.id)
    d["rating_distribution"] = distribution

    return JSONResponse(content=d)
