# app/api/v1/vendor_products.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from slugify import slugify
from pathlib import Path
import math
import uuid as uuid_mod
import aiofiles
import json

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from sqlalchemy import delete, select, or_
from sqlalchemy.orm import selectinload

from app.models.vendor_product import Product, ProductImage, ProductVariant, ProductPriceRule
from app.schemas.vendor_product import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse,
    PriceRuleCreate, PriceRuleUpdate, PriceRuleResponse,
)
from app.services.vendor_service import VendorService
from app.repositories.product_repo import ProductRepository

from datetime import date as date_type, datetime

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_3D_EXTENSIONS = {".glb", ".gltf"}
ALLOWED_MEDIA_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES | {"model/gltf-binary", "model/gltf+json", "application/octet-stream"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_VIDEO_SIZE = 50 * 1024 * 1024
MAX_3D_SIZE = 30 * 1024 * 1024


DATE_FIELDS = {"expiration_date", "manufacture_date", "best_before_date"}
DATETIME_FIELDS = {"discount_start_date", "discount_end_date"}


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
        "description": p.description,
        "short_description": p.short_description,
        "brand": p.brand,
        "product_type": p.product_type or "physical",
        "category": p.category,
        "subcategory": p.subcategory,
        "tags": p.tags or [],
        # Unit of Measure
        "uom": p.uom or "piece",
        # Pricing
        "price": _num(p.price) or 0,
        "compare_at_price": _num(p.compare_at_price),
        "cost_price": _num(p.cost_price),
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
        "stock_status": p.stock_status or "in_stock",
        "allow_backorders": p.allow_backorders or False,
        # Lifecycle
        "expiration_date": str(p.expiration_date) if p.expiration_date else None,
        "manufacture_date": str(p.manufacture_date) if p.manufacture_date else None,
        "best_before_date": str(p.best_before_date) if p.best_before_date else None,
        "warranty_period_days": p.warranty_period_days,
        "warranty_type": p.warranty_type,
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
                "stock_status": v.stock_status or "in_stock",
                "reorder_point": v.reorder_point,
                "reorder_quantity": v.reorder_quantity,
                "allow_backorders": v.allow_backorders or False,
                "track_inventory": v.track_inventory if v.track_inventory is not None else True,
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
    }

def _build_variant(product_id, vc) -> ProductVariant:
    """Construct a ProductVariant from a dict or Pydantic schema."""
    g = vc.get if isinstance(vc, dict) else lambda k, d=None: getattr(vc, k, d)
    return ProductVariant(
        product_id=product_id,
        name=g("name"),
        sku=g("sku"),
        barcode=g("barcode"),
        uom=g("uom") or "piece",
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
        quantity=g("quantity") or 0,
        low_stock_threshold=g("low_stock_threshold") or 5,
        stock_status=g("stock_status") or "in_stock",
        reorder_point=g("reorder_point"),
        reorder_quantity=g("reorder_quantity"),
        allow_backorders=g("allow_backorders") or False,
        track_inventory=g("track_inventory") if g("track_inventory") is not None else True,
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


router = APIRouter()


async def get_current_vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """Get current user's vendor ID."""
    service = VendorService(db)
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    return vendor.id


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
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List all products for current vendor."""
    repo = ProductRepository(db)
    skip = (page - 1) * size
    
    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status=status,
        category=category,
        search=search,
    )
    
    return JSONResponse(content={
        "items": [_product_to_dict(p) for p in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


def _detect_media_type_vp(file: UploadFile) -> str:
    ct = file.content_type or ""
    ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if file.filename and "." in file.filename else ""
    if ct in ALLOWED_VIDEO_TYPES:
        return "video"
    if ct in {"model/gltf-binary", "model/gltf+json", "application/octet-stream"} or ext in ALLOWED_3D_EXTENSIONS:
        return "model3d"
    return "image"


async def _save_product_image(file: UploadFile) -> tuple[str, str]:
    """Save media file to disk and return (url, media_type)."""
    ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if file.filename and "." in file.filename else ""
    is_3d = ext in ALLOWED_3D_EXTENSIONS
    if not is_3d and file.content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(400, f"File type {file.content_type} not allowed")
    contents = await file.read()
    media = _detect_media_type_vp(file)
    max_size = MAX_VIDEO_SIZE if media == "video" else MAX_3D_SIZE if media == "model3d" else MAX_IMAGE_SIZE
    if len(contents) > max_size:
        raise HTTPException(400, f"File too large. Max {max_size // (1024*1024)} MB for {media}.")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"{uuid_mod.uuid4().hex}.{ext}"
    folder = UPLOAD_DIR / "products"
    folder.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(str(folder / filename), "wb") as f:
        await f.write(contents)
    return f"/uploads/products/{filename}", media


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: str = Form(...),
    images: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a product with images in a single request."""
    try:
        raw = json.loads(product_data)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in product_data")

    data = ProductCreate(**raw)
    repo = ProductRepository(db)

    slug = data.slug or slugify(data.name, lowercase=True)
    if await repo.slug_exists(vendor_id, slug):
        slug = f"{slug}-{str(uuid_mod.uuid4())[:8]}"

    fields = data.model_dump(exclude={"slug", "variants"})
    fields["slug"] = slug
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

    first_image_set = False
    for i, img_file in enumerate(images):
        if not img_file.filename:
            continue
        url, media = await _save_product_image(img_file)
        is_primary = not first_image_set and media == "image"
        if is_primary:
            first_image_set = True
        db.add(ProductImage(
            product_id=product.id,
            url=url,
            alt_text=data.name,
            position=i,
            is_primary=is_primary,
            media_type=media,
        ))

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
    _coerce_date_fields(update_data)

    # Build change diff for audit history
    # Fields that are internal/noisy and should never appear in user-visible history
    skip_diff = {
        "variants", "updated_by", "version_number", "change_history",
        "quote_form_config", "media", "images", "created_by", "created_at", "updated_at",
        "slug",
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

    await db.commit()
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)
    return JSONResponse(content=_product_to_dict(product))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a product."""
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    await db.delete(product)
    await db.commit()


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
