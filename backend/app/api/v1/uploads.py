# app/api/v1/uploads.py
"""
File upload endpoints for product and service images.
Uses FileService (S3 when configured, else backend/uploads/).
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vendor_product import Product, ProductImage, ProductVariant
from app.models.vendor_service import Service
from app.services.vendor_service import VendorService
from app.repositories.product_repo import ProductRepository
from app.repositories.service_repo import ServiceRepository
from app.services.media_upload import (
    save_media_file,
    save_hr_document,
    save_crm_document,
    delete_stored_file,
    detect_media_type,
    ALLOWED_IMAGE_TYPES,
)

router = APIRouter()


async def _get_vendor_id(user: User, db: AsyncSession) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor.id


async def _save_file(file: UploadFile, subfolder: str) -> str:
    return await save_media_file(file, subfolder)


# ── Vendor Logo & Banner ──────────────────────────────────────────

@router.post("/vendor/logo")
async def upload_vendor_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace the vendor logo."""
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    url = await _save_file(file, "vendor-logos")

    if vendor.logo_url:
        await delete_stored_file(vendor.logo_url)

    vendor.logo_url = url
    await db.commit()
    return JSONResponse(content={"logo_url": url})


@router.post("/vendor/banner")
async def upload_vendor_banner(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace the vendor banner."""
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    url = await _save_file(file, "vendor-banners")

    if vendor.banner_url:
        await delete_stored_file(vendor.banner_url)

    vendor.banner_url = url
    await db.commit()
    return JSONResponse(content={"banner_url": url})


@router.post("/crm/document")
async def upload_crm_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a CRM attachment (contact/account documents) and return its URL + metadata."""
    vendor_id = await _get_vendor_id(current_user, db)
    return JSONResponse(content=await save_crm_document(file, vendor_id))


@router.post("/vendor/branding-asset")
async def upload_vendor_branding_asset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a branding image and return its URL without changing vendor logo/banner."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-branding/{vendor_id}")
    return JSONResponse(content={"url": url})


@router.post("/vendor/extra-banner")
async def upload_vendor_extra_banner(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an additional banner and append it to theme_config['extra_banners']."""
    from sqlalchemy.orm.attributes import flag_modified
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    url = await _save_file(file, "vendor-banners")

    cfg = dict(vendor.theme_config or {})
    extras: list = list(cfg.get("extra_banners", []))
    extras.append(url)
    cfg["extra_banners"] = extras
    vendor.theme_config = cfg
    flag_modified(vendor, "theme_config")
    await db.commit()
    return JSONResponse(content={"banner_url": url, "extra_banners": extras})


@router.delete("/vendor/extra-banner")
async def remove_vendor_extra_banner(
    url: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a single extra banner URL from theme_config['extra_banners']."""
    from sqlalchemy.orm.attributes import flag_modified
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    cfg = dict(vendor.theme_config or {})
    extras: list = [u for u in cfg.get("extra_banners", []) if u != url]
    cfg["extra_banners"] = extras
    vendor.theme_config = cfg
    flag_modified(vendor, "theme_config")

    await delete_stored_file(url)

    await db.commit()
    return JSONResponse(content={"extra_banners": extras})


@router.post("/vendor/blog-cover")
async def upload_vendor_blog_cover(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a cover image for a vendor blog post. Returns a URL to store in ``cover_url``."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-blog-covers/{vendor_id}")
    return JSONResponse(content={"cover_url": url, "url": url})


@router.post("/user/avatar")
async def upload_user_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload (or replace) the current user's profile avatar.

    Returns the saved URL. The frontend then calls PATCH /auth/me with
    { avatar_url } to persist it on the user record.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be an image (JPEG, PNG, WebP, or GIF).",
        )

    url = await _save_file(file, f"users/{current_user.id}/avatar")

    if current_user.avatar_url:
        await delete_stored_file(current_user.avatar_url)

    return JSONResponse(content={"url": url, "avatar_url": url})


@router.post("/vendor/logo-anonymous")
async def upload_logo_anonymous(
    file: UploadFile = File(...),
):
    """Upload a logo during onboarding (before vendor is created). Returns URL to use later."""
    url = await _save_file(file, "vendor-logos")
    return JSONResponse(content={"logo_url": url})


@router.post("/vendor/banner-anonymous")
async def upload_banner_anonymous(
    file: UploadFile = File(...),
):
    """Upload a banner during onboarding (before vendor is created). Returns URL to use later."""
    url = await _save_file(file, "vendor-banners")
    return JSONResponse(content={"banner_url": url})


# ── Product Images ─────────────────────────────────────────────────

@router.post("/products/{product_id}/images")
async def upload_product_image(
    product_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image for a product."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    media = detect_media_type(file)
    url = await _save_file(file, "products")

    existing_count = len(product.images) if product.images else 0

    image = ProductImage(
        product_id=product.id,
        url=url,
        alt_text=product.name,
        position=existing_count,
        is_primary=existing_count == 0 and media == "image",
        media_type=media,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)

    return JSONResponse(content={
        "id": str(image.id),
        "url": image.url,
        "alt_text": image.alt_text,
        "position": image.position,
        "is_primary": image.is_primary,
        "media_type": image.media_type or "image",
    })


@router.delete("/products/{product_id}/images/{image_id}")
async def delete_product_image(
    product_id: UUID,
    image_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a product image."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    target = None
    for img in (product.images or []):
        if img.id == image_id:
            target = img
            break

    if not target:
        raise HTTPException(status_code=404, detail="Image not found")

    await delete_stored_file(target.url)

    was_primary = target.is_primary
    await db.delete(target)
    await db.commit()

    # If deleted image was primary, make the first remaining image primary
    if was_primary:
        product = await repo.get_by_vendor_and_id(vendor_id, product_id)
        if product.images:
            product.images[0].is_primary = True
            await db.commit()

    return JSONResponse(content={"detail": "Image deleted"})


@router.put("/products/{product_id}/images/{image_id}/primary")
async def set_primary_product_image(
    product_id: UUID,
    image_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Set an image as the primary product image."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    found = False
    for img in (product.images or []):
        if img.id == image_id:
            img.is_primary = True
            found = True
        else:
            img.is_primary = False

    if not found:
        raise HTTPException(status_code=404, detail="Image not found")

    await db.commit()
    return JSONResponse(content={"detail": "Primary image updated"})


@router.put("/products/{product_id}/images/reorder")
async def reorder_product_images(
    product_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder product images by id list (display order)."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    image_ids = body.get("image_ids") or []
    if not image_ids:
        raise HTTPException(status_code=400, detail="image_ids required")

    id_to_img = {str(img.id): img for img in (product.images or [])}
    for pos, img_id in enumerate(image_ids):
        img = id_to_img.get(str(img_id))
        if img:
            img.position = pos

    await db.commit()
    return JSONResponse(content={"detail": "Images reordered"})


# ── Variant Media ──────────────────────────────────────────────────

@router.post("/variants/{variant_id}/media")
async def upload_variant_media(
    variant_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a media file (image/video/3D) for a specific variant."""
    vendor_id = await _get_vendor_id(current_user, db)

    result = await db.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    # Ensure the variant belongs to this vendor's product
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, variant.product_id)
    if not product:
        raise HTTPException(status_code=403, detail="Access denied")

    media = detect_media_type(file)
    url = await _save_file(file, f"variants/{variant_id}")

    current_media = list(variant.media or [])
    is_primary = len(current_media) == 0 and media == "image"
    current_media.append({
        "url": url,
        "media_type": media,
        "is_primary": is_primary,
        "alt_text": variant.name,
        "position": len(current_media),
    })
    variant.media = current_media
    await db.commit()

    return JSONResponse(content={"media": current_media, "added": current_media[-1]})


@router.delete("/variants/{variant_id}/media")
async def delete_variant_media(
    variant_id: UUID,
    url: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a media item from a variant."""
    vendor_id = await _get_vendor_id(current_user, db)

    result = await db.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, variant.product_id)
    if not product:
        raise HTTPException(status_code=403, detail="Access denied")

    current_media = [m for m in (variant.media or []) if m.get("url") != url]

    # Set primary to first image if needed
    if current_media and not any(m.get("is_primary") for m in current_media):
        for m in current_media:
            if m.get("media_type", "image") == "image":
                m["is_primary"] = True
                break

    variant.media = current_media
    await db.commit()

    await delete_stored_file(url)

    return JSONResponse(content={"media": current_media})


@router.put("/variants/{variant_id}/media/primary")
async def set_primary_variant_media(
    variant_id: UUID,
    url: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a media item as primary for a variant."""
    vendor_id = await _get_vendor_id(current_user, db)

    result = await db.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, variant.product_id)
    if not product:
        raise HTTPException(status_code=403, detail="Access denied")

    current_media = list(variant.media or [])
    for m in current_media:
        m["is_primary"] = m.get("url") == url and m.get("media_type", "image") == "image"
    variant.media = current_media
    await db.commit()

    return JSONResponse(content={"media": current_media})


@router.put("/variants/{variant_id}/media/reorder")
async def reorder_variant_media(
    variant_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder variant media by url list (display order)."""
    vendor_id = await _get_vendor_id(current_user, db)

    result = await db.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(vendor_id, variant.product_id)
    if not product:
        raise HTTPException(status_code=403, detail="Access denied")

    media_urls = body.get("media_urls") or []
    if not media_urls:
        raise HTTPException(status_code=400, detail="media_urls required")

    url_to_item = {m.get("url"): m for m in (variant.media or [])}
    reordered = []
    seen = set()
    for pos, url in enumerate(media_urls):
        item = url_to_item.get(str(url))
        if item:
            item = dict(item)
            item["position"] = pos
            reordered.append(item)
            seen.add(str(url))

    for item in variant.media or []:
        url = item.get("url")
        if url and str(url) not in seen:
            copy = dict(item)
            copy["position"] = len(reordered)
            reordered.append(copy)

    variant.media = reordered
    await db.commit()
    return JSONResponse(content={"media": reordered})


# ── Service Media ──────────────────────────────────────────────────

@router.post("/services/{service_id}/media")
async def upload_service_media(
    service_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload media (image / video / 3D model) for a service."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = ServiceRepository(db)
    svc = await repo.get_by_vendor_and_id(vendor_id, service_id)

    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    media_type = detect_media_type(file)
    url = await _save_file(file, "services")

    current_media = list(svc.media or [])
    is_primary = len(current_media) == 0 and media_type == "image"
    media_item = {
        "id": uuid.uuid4().hex,
        "url": url,
        "media_type": media_type,
        "is_primary": is_primary,
        "alt_text": svc.name,
        "position": len(current_media),
    }
    current_media.append(media_item)
    svc.media = current_media

    if is_primary:
        svc.image_url = url

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(svc, "media")
    await db.commit()

    return JSONResponse(content={"media": current_media, "item": media_item})


@router.delete("/services/{service_id}/media/{media_id}")
async def delete_service_media(
    service_id: UUID,
    media_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a media item from a service."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = ServiceRepository(db)
    svc = await repo.get_by_vendor_and_id(vendor_id, service_id)

    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    current_media = list(svc.media or [])
    target = None
    for item in current_media:
        if item.get("id") == media_id:
            target = item
            break

    if not target:
        raise HTTPException(status_code=404, detail="Media item not found")

    await delete_stored_file(target.get("url"))

    was_primary = target.get("is_primary", False)
    current_media.remove(target)

    for i, item in enumerate(current_media):
        item["position"] = i

    if was_primary and current_media:
        images = [m for m in current_media if m.get("media_type") == "image"]
        if images:
            images[0]["is_primary"] = True
            svc.image_url = images[0]["url"]
        else:
            svc.image_url = None

    svc.media = current_media
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(svc, "media")
    await db.commit()

    return JSONResponse(content={"media": current_media})


@router.put("/services/{service_id}/media/{media_id}/primary")
async def set_primary_service_media(
    service_id: UUID,
    media_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a media item as the primary service image."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = ServiceRepository(db)
    svc = await repo.get_by_vendor_and_id(vendor_id, service_id)

    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    current_media = list(svc.media or [])
    found = False
    for item in current_media:
        if item.get("id") == media_id:
            if item.get("media_type") != "image":
                raise HTTPException(status_code=400, detail="Only images can be set as primary")
            item["is_primary"] = True
            svc.image_url = item["url"]
            found = True
        else:
            item["is_primary"] = False

    if not found:
        raise HTTPException(status_code=404, detail="Media item not found")

    svc.media = current_media
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(svc, "media")
    await db.commit()

    return JSONResponse(content={"media": current_media})


@router.put("/services/{service_id}/media/reorder")
async def reorder_service_media(
    service_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder service media by id list (display order)."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = ServiceRepository(db)
    svc = await repo.get_by_vendor_and_id(vendor_id, service_id)

    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    media_ids = body.get("media_ids") or []
    if not media_ids:
        raise HTTPException(status_code=400, detail="media_ids required")

    current_media = list(svc.media or [])
    id_to_item = {item.get("id"): item for item in current_media if item.get("id")}
    reordered = []
    for pos, mid in enumerate(media_ids):
        item = id_to_item.get(mid)
        if item:
            item["position"] = pos
            reordered.append(item)
    for item in current_media:
        if item.get("id") not in media_ids:
            item["position"] = len(reordered)
            reordered.append(item)

    svc.media = reordered
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(svc, "media")
    await db.commit()

    return JSONResponse(content={"media": reordered})


# -- HR Document Upload --


@router.post("/hr/{emp_id}/documents")
async def upload_hr_document_endpoint(
    emp_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return JSONResponse(content=await save_hr_document(file, emp_id))


# -- Expense receipt upload (no application size cap) --

from app.services.expense_receipt_upload import save_expense_receipt


@router.post("/hr/expenses/receipt")
async def upload_expense_receipt(
    file: UploadFile = File(...),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a receipt or supporting document for an expense claim."""
    vendor_id = await _get_vendor_id(user, db)
    result = await save_expense_receipt(file, vendor_id)
    return JSONResponse(content=result)
