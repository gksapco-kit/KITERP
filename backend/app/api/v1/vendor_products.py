# app/api/v1/vendor_products.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError, BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from slugify import slugify
import math
import uuid as uuid_mod
import json

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.models.user import User
from sqlalchemy import delete, select, or_
from sqlalchemy.orm import selectinload

from app.models.vendor_product import Product, ProductImage, ProductVariant, ProductPriceRule, ProductModifierGroup, ProductModifierOption
from app.schemas.vendor_product import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse,
    PriceRuleCreate, PriceRuleUpdate, PriceRuleResponse,
)
from app.services.vendor_service import VendorService
from app.repositories.product_repo import ProductRepository
from app.services.media_upload import save_media_file, detect_media_type
from app.services.catalog_store_scope import sync_product_stores
from app.services.material_code import generate_product_material_code

from datetime import date as date_type, datetime

DATE_FIELDS = {"expiration_date", "manufacture_date", "best_before_date"}
DATETIME_FIELDS = {"discount_start_date", "discount_end_date"}


def _effective_stock_status(
    *,
    quantity: int | None,
    stock_status: str | None,
    track_inventory: bool | None = True,
    allow_backorders: bool | None = False,
    low_stock_threshold: int | None = 5,
) -> str:
    """Derive display/API stock status from qty when inventory is tracked.

    Prevents stale stock_status='in_stock' while quantity is 0.
    """
    stored = (stock_status or "in_stock").strip() or "in_stock"
    if stored == "discontinued":
        return "discontinued"
    qty = int(quantity or 0)
    track = True if track_inventory is None else bool(track_inventory)
    backorders = bool(allow_backorders)
    if backorders:
        return "backorder" if qty <= 0 else ("in_stock" if stored == "out_of_stock" else stored)
    if track:
        if qty <= 0:
            return "out_of_stock"
        if stored == "out_of_stock":
            thresh = 5 if low_stock_threshold is None else int(low_stock_threshold)
            return "low_stock" if qty <= thresh else "in_stock"
        thresh = low_stock_threshold
        if stored in ("in_stock", "low_stock") and thresh is not None and qty <= int(thresh):
            return "low_stock"
        if stored == "low_stock" and (thresh is None or qty > int(thresh)):
            return "in_stock"
        return stored
    return stored


def _parse_date(v):
    if v is None or isinstance(v, date_type):
        return v
    return date_type.fromisoformat(str(v))


def _parse_datetime(v):
    if v is None or isinstance(v, datetime):
        return v
    s = str(v)
    if "T" not in s and len(s) == 10:
        s += "T00:00:00"
    return datetime.fromisoformat(s)


def _coerce_date_fields(fields: dict) -> dict:
    """Convert date/datetime string values to proper Python objects."""
    for k in DATE_FIELDS:
        if k in fields and fields[k] is not None:
            fields[k] = _parse_date(fields[k])
    for k in DATETIME_FIELDS:
        if k in fields and fields[k] is not None:
            fields[k] = _parse_datetime(fields[k])
    return fields


def _num(v):
    """Convert Decimal/numeric to float safely."""
    return float(v) if v is not None else None


def _dt(v):
    """Convert datetime to ISO string."""
    return v.isoformat() if v else None


def _product_to_dict(p) -> dict:
    """Serialize a Product model to JSON-compatible dict."""
    return {
        "id": str(p.id),
        "vendor_id": str(p.vendor_id),
        # Basic
        "name": p.name,
        "slug": p.slug,
        "material_code": p.material_code,
        "description": p.description,
        "short_description": p.short_description,
        "brand": p.brand,
        "product_type": p.product_type or "physical",
        "category": p.category,
        "subcategory": p.subcategory,
        "tags": p.tags or [],
        # Unit of Measure
        "uom": p.uom or "piece",
        "uom_quantity": _num(p.uom_quantity),
        # Pricing
        "price": _num(p.price) or 0,
        "compare_at_price": _num(p.compare_at_price),
        "cost_price": _num(p.cost_price),
        "valuation_method": getattr(p, "valuation_method", None) or "moving_average",
        "currency": p.currency or "INR",
        "discount_percentage": _num(p.discount_percentage),
        "discount_amount": _num(p.discount_amount),
        "discount_start_date": _dt(p.discount_start_date),
        "discount_end_date": _dt(p.discount_end_date),
        "offer_label": p.offer_label,
        "is_on_sale": p.is_on_sale or False,
        # Tax
        "is_taxable": p.is_taxable if p.is_taxable is not None else True,
        "tax_rate": _num(p.tax_rate),
        "hsn_code": p.hsn_code,
        "gst_rate": _num(p.gst_rate),
        # Inventory
        "sku": p.sku,
        "barcode": p.barcode,
        "track_inventory": p.track_inventory if p.track_inventory is not None else True,
        "quantity": p.quantity or 0,
        "low_stock_threshold": p.low_stock_threshold or 5,
        "reorder_point": p.reorder_point,
        "reorder_quantity": p.reorder_quantity,
        "stock_status": _effective_stock_status(
            quantity=p.quantity,
            stock_status=p.stock_status,
            track_inventory=p.track_inventory,
            allow_backorders=p.allow_backorders,
            low_stock_threshold=p.low_stock_threshold,
        ),
        "allow_backorders": p.allow_backorders or False,
        # Lifecycle
        "expiration_date": str(p.expiration_date) if p.expiration_date else None,
        "manufacture_date": str(p.manufacture_date) if p.manufacture_date else None,
        "best_before_date": str(p.best_before_date) if p.best_before_date else None,
        "warranty_period_days": p.warranty_period_days,
        "warranty_type": p.warranty_type,
        # Pharma / batch control
        "pharma_managed": bool(getattr(p, "pharma_managed", False)),
        "batch_managed": bool(getattr(p, "batch_managed", False)),
        "serial_managed": bool(getattr(p, "serial_managed", False)),
        "shelf_life_days": getattr(p, "shelf_life_days", None),
        "retest_days": getattr(p, "retest_days", None),
        "qc_required_on_receipt": bool(getattr(p, "qc_required_on_receipt", False)),
        "qc_required_on_production": bool(getattr(p, "qc_required_on_production", False)),
        "gtin": getattr(p, "gtin", None),
        "ndc": getattr(p, "ndc", None),
        "requires_cold_chain": bool(getattr(p, "requires_cold_chain", False)),
        "storage_condition": getattr(p, "storage_condition", None),
        # Return
        "return_policy": p.return_policy,
        "return_days": p.return_days,
        "is_returnable": p.is_returnable if p.is_returnable is not None else True,
        "return_conditions": p.return_conditions,
        "refund_policy": p.refund_policy,
        # Shipping
        "weight_kg": _num(p.weight_kg),
        "length_cm": _num(p.length_cm),
        "width_cm": _num(p.width_cm),
        "height_cm": _num(p.height_cm),
        "shipping_class": p.shipping_class,
        "requires_shipping": p.requires_shipping if p.requires_shipping is not None else True,
        "shipping_cost": _num(p.shipping_cost),
        "free_shipping_threshold": _num(p.free_shipping_threshold),
        # Visibility
        "status": p.status or "draft",
        "is_featured": p.is_featured or False,
        "is_visible": p.is_visible if p.is_visible is not None else True,
        "is_new_arrival": p.is_new_arrival or False,
        "is_best_seller": p.is_best_seller or False,
        "allow_quote_request": p.allow_quote_request or False,
        "quote_form_config": p.quote_form_config or [],
        "store_scope": p.store_scope or "all",
        "store_ids": [str(a.store_id) for a in (getattr(p, "store_assignments", None) or [])],
        # SEO
        "meta_title": p.meta_title,
        "meta_description": p.meta_description,
        "meta_keywords": p.meta_keywords or [],
        "og_image_url": p.og_image_url,
        "canonical_url": p.canonical_url,
        # Advanced
        "attributes": p.attributes or {},
        "specifications": p.specifications or {},
        "custom_fields": p.custom_fields or {},
        "related_product_ids": p.related_product_ids or [],
        "upsell_product_ids": p.upsell_product_ids or [],
        "cross_sell_product_ids": p.cross_sell_product_ids or [],
        "addons": p.addons or [],
        # Digital
        "is_digital": p.is_digital or False,
        "download_url": p.download_url,
        "download_limit": p.download_limit,
        "download_expiry_days": p.download_expiry_days,
        # Subscription
        "is_subscription": p.is_subscription or False,
        "subscription_interval": p.subscription_interval,
        "subscription_price": _num(p.subscription_price),
        "subscription_trial_days": p.subscription_trial_days,
        "subscription_setup_fee": _num(p.subscription_setup_fee),
        "subscription_billing_cycles": p.subscription_billing_cycles,
        # Audit
        "created_by": str(p.created_by) if p.created_by else None,
        "updated_by": str(p.updated_by) if p.updated_by else None,
        "version_number": p.version_number or 1,
        "change_history": p.change_history or [],
        "view_count": p.view_count or 0,
        "purchase_count": p.purchase_count or 0,
        # Relations
        "variants": [
            {
                "id": str(v.id), "name": v.name, "sku": v.sku, "barcode": v.barcode,
                "uom": v.uom or "piece",
                "uom_quantity": _num(v.uom_quantity),
                "price_type": v.price_type or "per_unit",
                "price": _num(v.price) or 0,
                "compare_at_price": _num(v.compare_at_price),
                "cost_price": _num(v.cost_price),
                "currency": v.currency or "INR",
                "discount_percentage": _num(v.discount_percentage),
                "discount_amount": _num(v.discount_amount),
                "offer_label": v.offer_label,
                "is_on_sale": v.is_on_sale or False,
                "is_taxable": v.is_taxable if v.is_taxable is not None else True,
                "tax_rate": _num(v.tax_rate),
                "hsn_code": v.hsn_code,
                "gst_rate": _num(v.gst_rate),
                "quantity": v.quantity or 0,
                "low_stock_threshold": v.low_stock_threshold or 5,
                "stock_status": _effective_stock_status(
                    quantity=v.quantity,
                    stock_status=v.stock_status,
                    track_inventory=v.track_inventory,
                    allow_backorders=v.allow_backorders,
                    low_stock_threshold=v.low_stock_threshold,
                ),
                "reorder_point": v.reorder_point,
                "reorder_quantity": v.reorder_quantity,
                "allow_backorders": v.allow_backorders or False,
                "track_inventory": v.track_inventory if v.track_inventory is not None else True,
                "max_quantity_per_order": v.max_quantity_per_order,
                "min_quantity_per_order": v.min_quantity_per_order,
                "weight_kg": _num(v.weight_kg),
                "expiration_date": str(v.expiration_date) if v.expiration_date else None,
                "manufacture_date": str(v.manufacture_date) if v.manufacture_date else None,
                "best_before_date": str(v.best_before_date) if v.best_before_date else None,
                "warranty_period_days": v.warranty_period_days,
                "warranty_type": v.warranty_type,
                "is_returnable": v.is_returnable if v.is_returnable is not None else True,
                "return_days": v.return_days,
                "refund_policy": v.refund_policy,
                "return_policy": v.return_policy,
                "return_conditions": v.return_conditions,
                "color": v.color,
                "attributes": v.attributes or {},
                "media": v.media or [],
                # Subscription (variant-level)
                "subscription_interval": v.subscription_interval,
                "subscription_trial_days": v.subscription_trial_days,
                "subscription_setup_fee": _num(v.subscription_setup_fee),
                "subscription_billing_cycles": v.subscription_billing_cycles,
                "subscription_schedule_modes": v.subscription_schedule_modes or ["dates", "cycles", "pick_dates", "weekly", "recurring"],
                "is_active": v.is_active if v.is_active is not None else True,
                "created_at": _dt(v.created_at),
            }
            for v in (p.variants or [])
        ],
        "images": [
            {
                "id": str(img.id), "url": img.url,
                "alt_text": img.alt_text, "position": img.position or 0,
                "is_primary": img.is_primary or False,
                "media_type": img.media_type or "image",
            }
            for img in (p.images or [])
        ],
        "created_at": _dt(p.created_at),
        "updated_at": _dt(p.updated_at),
        "published_at": _dt(p.published_at),
        "deleted_at": _dt(getattr(p, "deleted_at", None)),
    }

def _build_variant(product_id, vc) -> ProductVariant:
    """Construct a ProductVariant from a dict or Pydantic schema."""
    g = vc.get if isinstance(vc, dict) else lambda k, d=None: getattr(vc, k, d)
    qty = g("quantity") or 0
    track = g("track_inventory") if g("track_inventory") is not None else True
    backorders = g("allow_backorders") or False
    low_thresh = g("low_stock_threshold") or 5
    return ProductVariant(
        product_id=product_id,
        name=g("name"),
        sku=g("sku"),
        barcode=g("barcode"),
        uom=g("uom") or "piece",
        uom_quantity=g("uom_quantity"),
        price_type=g("price_type") or "per_unit",
        price=g("price"),
        compare_at_price=g("compare_at_price"),
        cost_price=g("cost_price"),
        currency=g("currency") or "INR",
        discount_percentage=g("discount_percentage"),
        discount_amount=g("discount_amount"),
        offer_label=g("offer_label"),
        is_on_sale=g("is_on_sale") if g("is_on_sale") is not None else False,
        is_taxable=g("is_taxable") if g("is_taxable") is not None else True,
        tax_rate=g("tax_rate"),
        hsn_code=g("hsn_code"),
        gst_rate=g("gst_rate"),
        quantity=qty,
        low_stock_threshold=low_thresh,
        stock_status=_effective_stock_status(
            quantity=qty,
            stock_status=g("stock_status") or "in_stock",
            track_inventory=track,
            allow_backorders=backorders,
            low_stock_threshold=low_thresh,
        ),
        reorder_point=g("reorder_point"),
        reorder_quantity=g("reorder_quantity"),
        allow_backorders=backorders,
        track_inventory=track,
        max_quantity_per_order=g("max_quantity_per_order"),
        min_quantity_per_order=g("min_quantity_per_order"),
        weight_kg=g("weight_kg"),
        expiration_date=_parse_date(g("expiration_date")) if g("expiration_date") else None,
        manufacture_date=_parse_date(g("manufacture_date")) if g("manufacture_date") else None,
        best_before_date=_parse_date(g("best_before_date")) if g("best_before_date") else None,
        warranty_period_days=g("warranty_period_days"),
        warranty_type=g("warranty_type"),
        is_returnable=g("is_returnable") if g("is_returnable") is not None else True,
        return_days=g("return_days"),
        refund_policy=g("refund_policy"),
        return_policy=g("return_policy"),
        return_conditions=g("return_conditions"),
        color=g("color"),
        attributes=g("attributes") or {},
        subscription_interval=g("subscription_interval"),
        subscription_trial_days=g("subscription_trial_days"),
        subscription_setup_fee=g("subscription_setup_fee"),
        subscription_billing_cycles=g("subscription_billing_cycles"),
        subscription_schedule_modes=g("subscription_schedule_modes"),
        is_active=g("is_active") if g("is_active") is not None else True,
    )


router = APIRouter(dependencies=[Depends(require_permission("products.view"))])


@router.get("/barcode-lookup")
async def barcode_lookup(
    code: str = Query(..., description="Barcode or SKU to look up"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Look up a product or variant by barcode / SKU. Returns the matched product
    and, if the match was at variant level, the matched variant details."""
    # Strip whitespace and non-printable/control characters from scanner output
    import re as _re
    code = _re.sub(r'[\x00-\x1f\x7f]', '', code).strip()

    # 1. Try variant-level barcode / SKU first (more specific than product-level)
    vstmt = (
        select(ProductVariant)
        .join(Product, Product.id == ProductVariant.product_id)
        .options(selectinload(ProductVariant.product).options(selectinload(Product.variants), selectinload(Product.images)))
        .where(
            Product.vendor_id == vendor_id,
            Product.deleted_at.is_(None),
            ProductVariant.is_active == True,
            or_(ProductVariant.barcode == code, ProductVariant.sku == code),
        )
    )
    vresult = await db.execute(vstmt)
    variant = vresult.scalar_one_or_none()
    if variant:
        return {
            "match_level": "variant",
            "product": _product_to_dict(variant.product),
            "variant": {
                "id": str(variant.id),
                "name": variant.name,
                "sku": variant.sku,
                "barcode": variant.barcode,
                "price": float(variant.price) if variant.price is not None else None,
                "compare_at_price": float(variant.compare_at_price) if variant.compare_at_price is not None else None,
                "cost_price": float(variant.cost_price) if variant.cost_price is not None else None,
                "quantity": variant.quantity or 0,
                "attributes": variant.attributes or {},
                "color": variant.color,
                "is_active": variant.is_active,
                "is_on_sale": variant.is_on_sale or False,
                "uom": variant.uom,
                "hsn_code": variant.hsn_code,
                "tax_rate": float(variant.tax_rate) if variant.tax_rate is not None else None,
            },
        }

    # 2. Fall back to product-level barcode / SKU
    stmt = (
        select(Product)
        .options(selectinload(Product.variants), selectinload(Product.images))
        .where(
            Product.vendor_id == vendor_id,
            Product.deleted_at.is_(None),
            or_(Product.barcode == code, Product.sku == code),
        )
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if product:
        return {"match_level": "product", "product": _product_to_dict(product), "variant": None}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No product or variant found for barcode/SKU: {code}")


@router.get("")
async def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_visible: Optional[bool] = Query(None, description="Filter by storefront visibility"),
    product_type: Optional[str] = Query(None),
    stock: Optional[str] = Query(None, description="in_stock | low_stock | out_of_stock"),
    store_id: Optional[str] = Query(None, description="Filter by business unit availability"),
    pharma_managed: Optional[bool] = Query(None, description="Filter by pharma enrollment status"),
    deleted_only: bool = Query(False, description="When true, list soft-deleted products only"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List all products for current vendor."""
    repo = ProductRepository(db)
    skip = (page - 1) * size
    sid = None
    if store_id:
        try:
            sid = UUID(store_id)
        except ValueError:
            raise HTTPException(400, "Invalid store_id")
    
    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status=status,
        category=category,
        search=search,
        is_visible=is_visible,
        product_type=product_type,
        stock=stock,
        store_id=sid,
        pharma_managed=pharma_managed,
        deleted_only=deleted_only,
    )
    
    return JSONResponse(content={
        "items": [_product_to_dict(p) for p in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


async def _save_product_image(file: UploadFile) -> tuple[str, str]:
    """Save media via FileService and return (url, media_type)."""
    media = detect_media_type(file)
    url = await save_media_file(file, "products")
    return url, media


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: str = Form(...),
    images: List[UploadFile] = File(default=[]),
    primary_image_index: int = Form(default=0),
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a product with images in a single request."""
    try:
        raw = json.loads(product_data)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in product_data")

    try:
        data = ProductCreate(**raw)
    except ValidationError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, jsonable_encoder(e.errors()))
    repo = ProductRepository(db)

    if await repo.name_exists(vendor_id, data.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A product with this name already exists",
        )

    slug = data.slug or slugify(data.name, lowercase=True)
    if await repo.slug_exists(vendor_id, slug):
        slug = f"{slug}-{str(uuid_mod.uuid4())[:8]}"

    fields = data.model_dump(exclude={"slug", "variants", "store_ids"})
    store_scope = fields.pop("store_scope", "all") or "all"
    store_ids = data.store_ids or []
    fields["store_scope"] = store_scope
    fields["slug"] = slug
    material_code = (data.material_code or "").strip()
    if not material_code:
        material_code = await generate_product_material_code(db, vendor_id)
    fields["material_code"] = material_code
    fields["vendor_id"] = vendor_id
    fields["created_by"] = current_user.id
    fields["updated_by"] = current_user.id
    if not fields.get("status"):
        fields["status"] = "draft"

    _coerce_date_fields(fields)

    fields["change_history"] = [{
        "version": 1,
        "changed_by": str(current_user.id),
        "changed_by_name": current_user.full_name or current_user.email,
        "changed_at": datetime.utcnow().isoformat() + "Z",
        "changes": {"_action": {"old": None, "new": "Product created"}},
    }]
    product = Product(**fields)
    db.add(product)
    await db.flush()

    for vc in data.variants or []:
        db.add(_build_variant(product.id, vc))
    if data.variants:
        await db.flush()

    media_items: list[tuple[str, str]] = []
    for img_file in images:
        if not img_file.filename:
            continue
        url, media = await _save_product_image(img_file)
        media_items.append((url, media))

    primary_idx = primary_image_index
    if primary_idx < 0 or primary_idx >= len(media_items) or media_items[primary_idx][1] != "image":
        primary_idx = next((i for i, (_, m) in enumerate(media_items) if m == "image"), -1)

    for i, (url, media) in enumerate(media_items):
        is_primary = i == primary_idx and media == "image"
        db.add(ProductImage(
            product_id=product.id,
            url=url,
            alt_text=data.name,
            position=i,
            is_primary=is_primary,
            media_type=media,
        ))

    await sync_product_stores(db, vendor_id, product.id, store_scope, store_ids)
    await db.commit()

    product = await repo.get_by_vendor_and_id(vendor_id, product.id)
    return JSONResponse(content=_product_to_dict(product), status_code=201)


@router.get("/{product_id}")
async def get_product(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific product."""
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return JSONResponse(content=_product_to_dict(product))


@router.put("/{product_id}")
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a product."""
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    update_data = data.model_dump(exclude_unset=True)
    variants_replaced = "variants" in update_data
    variants_payload = update_data.pop("variants", None)
    store_ids_payload = update_data.pop("store_ids", None)
    _coerce_date_fields(update_data)

    if "name" in update_data and await repo.name_exists(
        vendor_id, str(update_data["name"]), exclude_id=product_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A product with this name already exists",
        )

    # Material code is auto-assigned and must never be blanked. Trim it when
    # provided, drop empty values, and backfill legacy products that lack one.
    if "material_code" in update_data:
        mc = (update_data.get("material_code") or "").strip()
        if mc:
            update_data["material_code"] = mc
        else:
            update_data.pop("material_code")
    if not product.material_code and "material_code" not in update_data:
        update_data["material_code"] = await generate_product_material_code(db, vendor_id)

    # Keep stock_status aligned with on-hand qty when inventory is tracked
    if any(
        k in update_data
        for k in ("quantity", "track_inventory", "allow_backorders", "low_stock_threshold", "stock_status")
    ):
        update_data["stock_status"] = _effective_stock_status(
            quantity=update_data.get("quantity", product.quantity),
            stock_status=update_data.get("stock_status", product.stock_status),
            track_inventory=update_data.get("track_inventory", product.track_inventory),
            allow_backorders=update_data.get("allow_backorders", product.allow_backorders),
            low_stock_threshold=update_data.get("low_stock_threshold", product.low_stock_threshold),
        )

    # Build change diff for audit history
    # Fields that are internal/noisy and should never appear in user-visible history
    skip_diff = {
        "variants", "updated_by", "version_number", "change_history",
        "quote_form_config", "media", "images", "created_by", "created_at", "updated_at",
        "slug", "store_ids",
    }

    def _norm(val):
        """Normalize a value for human-readable diffing."""
        if val is None:
            return None
        s = str(val)
        # Strip enum class prefix e.g. "ProductStatus.ACTIVE" -> "active"
        if "." in s and s.split(".")[0][0].isupper():
            s = s.split(".", 1)[1].lower()
        # Normalize numeric: int if whole, else float
        try:
            f = float(s)
            return str(int(f)) if f == int(f) else str(round(f, 6))
        except (ValueError, TypeError, OverflowError):
            pass
        return s

    changes = {}
    for field, new_value in update_data.items():
        if field in skip_diff:
            continue
        old_value = getattr(product, field, None)
        old_norm = _norm(old_value)
        new_norm = _norm(new_value)
        if old_norm != new_norm:
            changes[field] = {"old": old_norm, "new": new_norm}

    if variants_replaced:
        old_count = len(product.variants or [])
        new_count = len(variants_payload or [])
        if old_count != new_count:
            changes["variants"] = {"old": f"{old_count} variant(s)", "new": f"{new_count} variant(s)"}
        else:
            changes["variants"] = {"old": f"{old_count} variant(s)", "new": f"{new_count} variant(s) (updated)"}

    if changes:
        history_entry = {
            "version": (product.version_number or 1) + 1,
            "changed_by": str(current_user.id),
            "changed_by_name": current_user.full_name or current_user.email,
            "changed_at": datetime.utcnow().isoformat() + "Z",
            "changes": changes,
        }
        existing_history = list(product.change_history or [])
        existing_history.append(history_entry)
        product.change_history = existing_history

    for field, value in update_data.items():
        setattr(product, field, value)

    product.updated_by = current_user.id
    if changes:
        product.version_number = (product.version_number or 1) + 1

    if variants_replaced:
        # Upsert variants: update existing ones (preserving media), create new, delete removed
        incoming_ids = set()
        for vc in variants_payload or []:
            g = vc.get if isinstance(vc, dict) else lambda k, d=None: getattr(vc, k, d)
            vid = g("id")
            if vid:
                incoming_ids.add(str(vid))

        # Delete variants that were removed from the form
        existing_result = await db.execute(
            select(ProductVariant).where(ProductVariant.product_id == product.id)
        )
        existing_variants = {str(v.id): v for v in existing_result.scalars().all()}
        for eid, ev in existing_variants.items():
            if eid not in incoming_ids:
                await db.delete(ev)

        # Update existing or create new
        for vc in variants_payload or []:
            g = vc.get if isinstance(vc, dict) else lambda k, d=None: getattr(vc, k, d)
            vid = g("id")
            if vid and str(vid) in existing_variants:
                # Update in place — preserves media, id, timestamps
                ev = existing_variants[str(vid)]
                new_v = _build_variant(product.id, vc)
                _SKIP = {"id", "product_id", "media", "created_at", "updated_at"}
                for col in ProductVariant.__table__.columns:
                    if col.name in _SKIP:
                        continue
                    setattr(ev, col.name, getattr(new_v, col.name))
            else:
                db.add(_build_variant(product.id, vc))

    if store_ids_payload is not None or "store_scope" in update_data:
        scope = product.store_scope or "all"
        ids = store_ids_payload if store_ids_payload is not None else [
            str(a.store_id) for a in (getattr(product, "store_assignments", None) or [])
        ]
        await sync_product_stores(db, vendor_id, product.id, scope, ids)

    await db.commit()
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)
    return JSONResponse(content=_product_to_dict(product))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    permanent: bool = Query(False, description="Permanently delete instead of moving to trash"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a product (trash), or permanently delete when permanent=true."""
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(
        vendor_id, product_id, include_deleted=permanent,
    )
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    if permanent:
        if not product.deleted_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only trashed products can be permanently deleted",
            )
        await repo.hard_delete(product)
    else:
        if product.deleted_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product is already in trash",
            )
        await repo.soft_delete(product)

    await db.commit()


@router.post("/{product_id}/restore")
async def restore_product(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Restore a soft-deleted product from trash."""
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(
        vendor_id, product_id, include_deleted=True,
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not product.deleted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product is not in trash")

    await repo.restore(product)
    await db.commit()
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)
    return JSONResponse(content=_product_to_dict(product))


# ── Price Rule helpers ──────────────────────────────────────────

def _rule_to_dict(r: ProductPriceRule) -> dict:
    return {
        "id": str(r.id),
        "product_id": str(r.product_id),
        "variant_id": str(r.variant_id) if r.variant_id else None,
        "rule_type": r.rule_type,
        "name": r.name,
        "customer_id": str(r.customer_id) if r.customer_id else None,
        "customer_group": r.customer_group,
        "state": r.state,
        "city": r.city,
        "pincode": r.pincode,
        "region": r.region,
        "country": r.country,
        "start_date": r.start_date.isoformat() if r.start_date else None,
        "end_date": r.end_date.isoformat() if r.end_date else None,
        "min_quantity": r.min_quantity,
        "max_quantity": r.max_quantity,
        "channel": r.channel,
        "price": float(r.price) if r.price is not None else None,
        "discount_percentage": float(r.discount_percentage) if r.discount_percentage is not None else None,
        "discount_amount": float(r.discount_amount) if r.discount_amount is not None else None,
        "priority": r.priority,
        "is_active": r.is_active,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


# ── Price Rule CRUD ─────────────────────────────────────────────

@router.get("/{product_id}/price-rules")
async def list_price_rules(
    product_id: UUID,
    rule_type: Optional[str] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    stmt = select(ProductPriceRule).where(
        ProductPriceRule.product_id == product_id,
        ProductPriceRule.vendor_id == vendor_id,
    ).order_by(ProductPriceRule.rule_type, ProductPriceRule.priority.desc())
    if rule_type:
        stmt = stmt.where(ProductPriceRule.rule_type == rule_type)
    rows = (await db.execute(stmt)).scalars().all()
    return JSONResponse(content=[_rule_to_dict(r) for r in rows])


@router.post("/{product_id}/price-rules", status_code=201)
async def create_price_rule(
    product_id: UUID,
    payload: PriceRuleCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    rule = ProductPriceRule(
        vendor_id=vendor_id,
        product_id=product_id,
        **{k: v for k, v in payload.model_dump().items() if v is not None},
    )
    if payload.start_date:
        rule.start_date = datetime.fromisoformat(payload.start_date)
    if payload.end_date:
        rule.end_date = datetime.fromisoformat(payload.end_date)
    if payload.variant_id:
        rule.variant_id = payload.variant_id
    if payload.customer_id:
        rule.customer_id = payload.customer_id

    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return JSONResponse(content=_rule_to_dict(rule))


@router.put("/{product_id}/price-rules/{rule_id}")
async def update_price_rule(
    product_id: UUID,
    rule_id: UUID,
    payload: PriceRuleUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ProductPriceRule).where(
        ProductPriceRule.id == rule_id,
        ProductPriceRule.product_id == product_id,
        ProductPriceRule.vendor_id == vendor_id,
    )
    rule = (await db.execute(stmt)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Price rule not found")

    data = payload.model_dump(exclude_unset=True)
    for key, val in data.items():
        if key == "start_date" and val:
            setattr(rule, key, datetime.fromisoformat(val))
        elif key == "end_date" and val:
            setattr(rule, key, datetime.fromisoformat(val))
        else:
            setattr(rule, key, val)

    await db.commit()
    await db.refresh(rule)
    return JSONResponse(content=_rule_to_dict(rule))


@router.delete("/{product_id}/price-rules/{rule_id}", status_code=204)
async def delete_price_rule(
    product_id: UUID,
    rule_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ProductPriceRule).where(
        ProductPriceRule.id == rule_id,
        ProductPriceRule.product_id == product_id,
        ProductPriceRule.vendor_id == vendor_id,
    )
    rule = (await db.execute(stmt)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Price rule not found")
    await db.delete(rule)
    await db.commit()


class PriceResolveRequest(BaseModel):
    variant_id: Optional[str] = None
    quantity: int = 1
    price: float = 0
    customer_id: Optional[str] = None
    customer_group: Optional[str] = None
    channel: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_pincode: Optional[str] = None


@router.post("/{product_id}/resolve-price")
async def resolve_product_price(
    product_id: UUID,
    payload: PriceResolveRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Preview the effective price for a product under a given sale context
    (party/customer group, quantity, channel, location, schedule) — lets the
    vendor verify their pricing rules actually apply before going live."""
    from app.services.price_resolver import (
        build_context_for_customer, load_rules, resolve_price,
    )

    ctx = await build_context_for_customer(
        db, vendor_id,
        UUID(payload.customer_id) if payload.customer_id else None,
        quantity=payload.quantity,
        channel=payload.channel,
        shipping_state=payload.shipping_state,
        shipping_city=payload.shipping_city,
        shipping_pincode=payload.shipping_pincode,
    )
    if payload.customer_group and not ctx.customer_group:
        ctx.customer_group = payload.customer_group

    grouped = await load_rules(db, vendor_id, [product_id])
    resolution = resolve_price(
        grouped.get(product_id, []),
        variant_id=UUID(payload.variant_id) if payload.variant_id else None,
        base_price=payload.price,
        ctx=ctx,
    )
    return JSONResponse(content={
        "price": resolution.price,
        "base_price": resolution.base_price,
        "matched": resolution.matched,
        "rule_id": resolution.rule_id,
        "rule_type": resolution.rule_type,
        "rule_name": resolution.rule_name,
    })


# ── Modifier Groups & Options ─────────────────────────────────────

def _modifier_group_dict(g: ProductModifierGroup, options=None) -> dict:
    return {
        "id": str(g.id),
        "product_id": str(g.product_id),
        "name": g.name,
        "selection_type": g.selection_type,
        "is_required": g.is_required,
        "min_select": g.min_select,
        "max_select": g.max_select,
        "sort_order": g.sort_order,
        "is_active": g.is_active,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "options": [_modifier_option_dict(o) for o in (options or [])],
    }


def _modifier_option_dict(o: ProductModifierOption) -> dict:
    return {
        "id": str(o.id),
        "group_id": str(o.group_id),
        "name": o.name,
        "price_delta": float(o.price_delta or 0),
        "is_default": o.is_default,
        "is_active": o.is_active,
        "sort_order": o.sort_order,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


@router.get("/{product_id}/modifiers")
async def list_modifiers(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    groups_r = await db.execute(
        select(ProductModifierGroup)
        .where(ProductModifierGroup.product_id == product_id, ProductModifierGroup.vendor_id == vendor_id)
        .order_by(ProductModifierGroup.sort_order, ProductModifierGroup.name)
    )
    groups = list(groups_r.scalars().all())
    result = []
    for g in groups:
        opts_r = await db.execute(
            select(ProductModifierOption)
            .where(ProductModifierOption.group_id == g.id)
            .order_by(ProductModifierOption.sort_order, ProductModifierOption.name)
        )
        opts = list(opts_r.scalars().all())
        result.append(_modifier_group_dict(g, opts))
    return JSONResponse(content={"items": result})


from pydantic import BaseModel as _BM, Field as _F
from typing import Optional as _Opt

class _ModifierGroupCreate(_BM):
    name: str = _F(min_length=1, max_length=120)
    selection_type: str = "single"
    is_required: bool = False
    min_select: int = 0
    max_select: int = 1
    sort_order: int = 0
    is_active: bool = True

class _ModifierGroupUpdate(_BM):
    name: _Opt[str] = _F(None, min_length=1, max_length=120)
    selection_type: _Opt[str] = None
    is_required: _Opt[bool] = None
    min_select: _Opt[int] = None
    max_select: _Opt[int] = None
    sort_order: _Opt[int] = None
    is_active: _Opt[bool] = None

class _ModifierOptionCreate(_BM):
    name: str = _F(min_length=1, max_length=120)
    price_delta: float = 0.0
    is_default: bool = False
    is_active: bool = True
    sort_order: int = 0

class _ModifierOptionUpdate(_BM):
    name: _Opt[str] = _F(None, min_length=1, max_length=120)
    price_delta: _Opt[float] = None
    is_default: _Opt[bool] = None
    is_active: _Opt[bool] = None
    sort_order: _Opt[int] = None


@router.post("/{product_id}/modifiers", status_code=201)
async def create_modifier_group(
    product_id: UUID,
    data: _ModifierGroupCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, product_id)
    if not product or product.vendor_id != vendor_id:
        raise HTTPException(404, "Product not found")
    g = ProductModifierGroup(
        vendor_id=vendor_id, product_id=product_id,
        name=data.name.strip(), selection_type=data.selection_type,
        is_required=data.is_required, min_select=data.min_select,
        max_select=data.max_select, sort_order=data.sort_order, is_active=data.is_active,
    )
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return JSONResponse(content=_modifier_group_dict(g, []), status_code=201)


@router.patch("/{product_id}/modifiers/{group_id}")
async def update_modifier_group(
    product_id: UUID, group_id: UUID,
    data: _ModifierGroupUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    g = await db.get(ProductModifierGroup, group_id)
    if not g or g.vendor_id != vendor_id or g.product_id != product_id:
        raise HTTPException(404, "Modifier group not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(g, field, val)
    await db.commit()
    await db.refresh(g)
    opts_r = await db.execute(select(ProductModifierOption).where(ProductModifierOption.group_id == g.id).order_by(ProductModifierOption.sort_order))
    return JSONResponse(content=_modifier_group_dict(g, list(opts_r.scalars().all())))


@router.delete("/{product_id}/modifiers/{group_id}", status_code=204)
async def delete_modifier_group(
    product_id: UUID, group_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    g = await db.get(ProductModifierGroup, group_id)
    if not g or g.vendor_id != vendor_id or g.product_id != product_id:
        raise HTTPException(404, "Modifier group not found")
    await db.delete(g)
    await db.commit()


@router.post("/{product_id}/modifiers/{group_id}/options", status_code=201)
async def create_modifier_option(
    product_id: UUID, group_id: UUID,
    data: _ModifierOptionCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    g = await db.get(ProductModifierGroup, group_id)
    if not g or g.vendor_id != vendor_id or g.product_id != product_id:
        raise HTTPException(404, "Modifier group not found")
    o = ProductModifierOption(
        vendor_id=vendor_id, group_id=group_id,
        name=data.name.strip(), price_delta=data.price_delta,
        is_default=data.is_default, is_active=data.is_active, sort_order=data.sort_order,
    )
    db.add(o)
    await db.commit()
    await db.refresh(o)
    return JSONResponse(content=_modifier_option_dict(o), status_code=201)


@router.patch("/{product_id}/modifiers/{group_id}/options/{option_id}")
async def update_modifier_option(
    product_id: UUID, group_id: UUID, option_id: UUID,
    data: _ModifierOptionUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    o = await db.get(ProductModifierOption, option_id)
    if not o or o.vendor_id != vendor_id or o.group_id != group_id:
        raise HTTPException(404, "Option not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(o, field, val)
    await db.commit()
    await db.refresh(o)
    return JSONResponse(content=_modifier_option_dict(o))


@router.delete("/{product_id}/modifiers/{group_id}/options/{option_id}", status_code=204)
async def delete_modifier_option(
    product_id: UUID, group_id: UUID, option_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    o = await db.get(ProductModifierOption, option_id)
    if not o or o.vendor_id != vendor_id or o.group_id != group_id:
        raise HTTPException(404, "Option not found")
    await db.delete(o)
    await db.commit()
