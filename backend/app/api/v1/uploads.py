# app/api/v1/uploads.py
"""
File upload endpoints for product and service images.
Uses FileService (S3 when configured, else backend/uploads/).
"""
import uuid
from contextvars import ContextVar
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status, Body
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.api.deps import (
    get_current_active_user,
    get_current_vendor_id,
    preferred_vendor_id_from_request,
    resolve_dashboard_vendor,
)
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
    fetch_image_bytes_from_url,
    _extension_from_content_type,
    _extension_from_bytes,
    ALLOWED_IMAGE_TYPES,
)

_upload_preferred_vendor_id: ContextVar[UUID | None] = ContextVar(
    "upload_preferred_vendor_id",
    default=None,
)


async def _bind_upload_vendor_context(request: Request) -> None:
    """Read X-Vendor-Id on the request (middleware ContextVar is not reliable here)."""
    _upload_preferred_vendor_id.set(preferred_vendor_id_from_request(request))


router = APIRouter(dependencies=[Depends(_bind_upload_vendor_context)])


async def _get_vendor_id(user: User, db: AsyncSession) -> UUID:
    """Same tenant resolution as product create/get (X-Vendor-Id + platform staff)."""
    vendor = await resolve_dashboard_vendor(
        db,
        user,
        preferred_vendor_id=_upload_preferred_vendor_id.get(),
    )
    return vendor.id


async def _get_managed_product(
    user: User,
    db: AsyncSession,
    product_id: UUID,
    vendor_id: UUID | None = None,
) -> Product:
    """Load a product the current dashboard vendor (or platform staff) may edit."""
    resolved_vendor_id = vendor_id or await _get_vendor_id(user, db)
    repo = ProductRepository(db)
    product = await repo.get_by_vendor_and_id(resolved_vendor_id, product_id)
    if product:
        return product

    from app.utils.platform_staff import has_platform_staff_access
    from app.utils.platform_vendor_access import ensure_vendor_visible_to_platform_staff

    product = await repo.get_by_id(product_id)
    if not product or product.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Product not found")
    if not has_platform_staff_access(user):
        raise HTTPException(status_code=404, detail="Product not found")

    vendor = await VendorService(db).get_by_id(product.vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Product not found")
    await ensure_vendor_visible_to_platform_staff(user, vendor, db)
    return product


async def _save_file(file: UploadFile, subfolder: str) -> str:
    return await save_media_file(file, subfolder)


@router.post("/proxy-image")
async def proxy_image_from_url(
    body: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
):
    """Fetch a remote image server-side and return the bytes for catalog uploads."""
    url = (body.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    image_bytes, content_type = await fetch_image_bytes_from_url(url)
    ext = _extension_from_content_type(content_type) or _extension_from_bytes(image_bytes) or ".jpg"
    filename = f"remote{ext}"
    return Response(
        content=image_bytes,
        media_type=content_type if content_type.startswith("image/") else "image/jpeg",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


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


@router.post("/crm/template-media")
async def upload_crm_template_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload image or video for a marketing email template."""
    vendor_id = await _get_vendor_id(current_user, db)
    media_type = detect_media_type(file)
    if media_type not in ("image", "video"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allowed: images (JPEG, PNG, WebP, GIF) or videos (MP4, WebM, MOV).",
        )
    url = await _save_file(file, f"crm/{vendor_id}/templates")
    return JSONResponse(content={
        "url": url,
        "type": media_type,
        "name": file.filename or "media",
    })


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


@router.post("/vendor/gallery-image")
async def upload_vendor_gallery_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image to the vendor gallery (Images → My Uploads)."""
    from sqlalchemy.orm.attributes import flag_modified

    if detect_media_type(file) != "image":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allowed: JPEG, PNG, WebP, GIF, or SVG images.",
        )

    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor_id = vendor.id
    url = await _save_file(file, f"vendor-gallery/{vendor_id}")
    fname = (file.filename or "upload.jpg").strip()

    cfg = dict(vendor.theme_config or {})
    uploads: list = list(cfg.get("gallery_uploads", []))
    entry = {"url": url, "filename": fname, "label": fname}
    uploads.append(entry)
    cfg["gallery_uploads"] = uploads
    vendor.theme_config = cfg
    flag_modified(vendor, "theme_config")
    await db.commit()

    return JSONResponse(content={"url": url, "filename": fname, "gallery_uploads": uploads})


def _normalize_gallery_url(url: str) -> str:
    return (url or "").strip()


def _gallery_trash_list(cfg: dict) -> list:
    raw = cfg.get("gallery_trash")
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if isinstance(item, dict) and isinstance(item.get("url"), str) and item["url"].strip():
            out.append(item)
        elif isinstance(item, str) and item.strip():
            out.append({"url": item.strip(), "label": "Upload"})
    return out


@router.post("/vendor/gallery-image/trash")
async def trash_vendor_gallery_images(
    body: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete gallery images into theme_config['gallery_trash'] (recycle bin)."""
    from datetime import datetime, timezone
    from sqlalchemy.orm.attributes import flag_modified

    urls_raw = body.get("items") or body.get("urls") or []
    if not isinstance(urls_raw, list) or not urls_raw:
        raise HTTPException(status_code=400, detail="items is required")

    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    cfg = dict(vendor.theme_config or {})
    uploads: list = list(cfg.get("gallery_uploads", []))
    trash = _gallery_trash_list(cfg)
    trash_urls = {(_normalize_gallery_url(t.get("url", ""))).lower() for t in trash}
    now = datetime.now(timezone.utc).isoformat()

    moved = 0
    for entry in urls_raw:
        if isinstance(entry, str):
            url = _normalize_gallery_url(entry)
            label = None
            filename = None
        elif isinstance(entry, dict):
            url = _normalize_gallery_url(str(entry.get("url") or ""))
            label = entry.get("label") if isinstance(entry.get("label"), str) else None
            filename = entry.get("filename") if isinstance(entry.get("filename"), str) else None
        else:
            continue
        if not url:
            continue
        key = url.lower()
        if key in trash_urls:
            continue

        was_gallery_upload = False
        kept_uploads = []
        for u in uploads:
            if isinstance(u, dict) and _normalize_gallery_url(str(u.get("url") or "")).lower() == key:
                was_gallery_upload = True
                if not label:
                    label = u.get("label") if isinstance(u.get("label"), str) else None
                if not filename:
                    filename = u.get("filename") if isinstance(u.get("filename"), str) else None
                continue
            kept_uploads.append(u)
        uploads = kept_uploads

        trash.append({
            "url": url,
            "label": (label or filename or "Upload").strip() or "Upload",
            "filename": (filename or "").strip() or None,
            "deleted_at": now,
            "was_gallery_upload": was_gallery_upload,
        })
        trash_urls.add(key)
        moved += 1

    cfg["gallery_uploads"] = uploads
    cfg["gallery_trash"] = trash
    vendor.theme_config = cfg
    flag_modified(vendor, "theme_config")
    await db.commit()
    return JSONResponse(content={
        "moved": moved,
        "gallery_uploads": uploads,
        "gallery_trash": trash,
    })


@router.post("/vendor/gallery-image/restore")
async def restore_vendor_gallery_images(
    body: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore soft-deleted gallery images from the recycle bin."""
    from sqlalchemy.orm.attributes import flag_modified

    urls_raw = body.get("urls") or []
    if not isinstance(urls_raw, list) or not urls_raw:
        raise HTTPException(status_code=400, detail="urls is required")

    wanted = {_normalize_gallery_url(str(u)).lower() for u in urls_raw if u}
    wanted.discard("")
    if not wanted:
        raise HTTPException(status_code=400, detail="urls is required")

    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    cfg = dict(vendor.theme_config or {})
    uploads: list = list(cfg.get("gallery_uploads", []))
    upload_urls = {
        _normalize_gallery_url(str(u.get("url") or "")).lower()
        for u in uploads
        if isinstance(u, dict)
    }
    trash = _gallery_trash_list(cfg)
    kept_trash = []
    restored = 0

    for item in trash:
        url = _normalize_gallery_url(str(item.get("url") or ""))
        key = url.lower()
        if key not in wanted:
            kept_trash.append(item)
            continue
        restored += 1
        # Re-add to gallery_uploads when it originated there, or always so it stays visible in My Uploads.
        if key and key not in upload_urls:
            uploads.append({
                "url": url,
                "filename": item.get("filename") or item.get("label") or "upload",
                "label": item.get("label") or item.get("filename") or "Gallery upload",
            })
            upload_urls.add(key)

    cfg["gallery_uploads"] = uploads
    cfg["gallery_trash"] = kept_trash
    vendor.theme_config = cfg
    flag_modified(vendor, "theme_config")
    await db.commit()
    return JSONResponse(content={
        "restored": restored,
        "gallery_uploads": uploads,
        "gallery_trash": kept_trash,
    })


@router.delete("/vendor/gallery-image/trash")
async def permanently_delete_vendor_gallery_images(
    body: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently remove images from the recycle bin (and delete gallery files when safe)."""
    from sqlalchemy.orm.attributes import flag_modified

    urls_raw = body.get("urls") or []
    if not isinstance(urls_raw, list) or not urls_raw:
        raise HTTPException(status_code=400, detail="urls is required")

    wanted = {_normalize_gallery_url(str(u)).lower() for u in urls_raw if u}
    wanted.discard("")
    if not wanted:
        raise HTTPException(status_code=400, detail="urls is required")

    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    cfg = dict(vendor.theme_config or {})
    trash = _gallery_trash_list(cfg)
    kept_trash = []
    purged: list = list(cfg.get("gallery_purged") or [])
    purged_set = {_normalize_gallery_url(str(u)).lower() for u in purged if isinstance(u, str)}
    deleted = 0

    for item in trash:
        url = _normalize_gallery_url(str(item.get("url") or ""))
        key = url.lower()
        if key not in wanted:
            kept_trash.append(item)
            continue
        deleted += 1
        # Only unlink files that live in the dedicated gallery folder.
        if "/vendor-gallery/" in url.replace("\\", "/"):
            await delete_stored_file(url)
        elif key and key not in purged_set:
            # Keep non-gallery URLs hidden from My Uploads after permanent delete.
            purged.append(url)
            purged_set.add(key)

    cfg["gallery_trash"] = kept_trash
    cfg["gallery_purged"] = purged
    vendor.theme_config = cfg
    flag_modified(vendor, "theme_config")
    await db.commit()
    return JSONResponse(content={
        "deleted": deleted,
        "gallery_trash": kept_trash,
        "gallery_purged": purged,
    })


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


@router.post("/vendor/category-image")
async def upload_vendor_category_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a category image. Returns a URL to store in ``image_url`` on the category."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-category-images/{vendor_id}")
    return JSONResponse(content={"image_url": url, "url": url})


@router.post("/vendor/property-image")
async def upload_vendor_property_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a property listing image. Returns a URL to store in ``image_url`` on the property."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-property-images/{vendor_id}")
    return JSONResponse(content={"image_url": url, "url": url})


@router.post("/vendor/course-image")
async def upload_vendor_course_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a course cover image. Returns a URL to store in ``image_url`` on the course."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-course-images/{vendor_id}")
    return JSONResponse(content={"image_url": url, "url": url})


@router.post("/vendor/vehicle-image")
async def upload_vendor_vehicle_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a vehicle photo. Returns a URL to store in ``image_url`` on the vehicle."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-vehicle-images/{vendor_id}")
    return JSONResponse(content={"image_url": url, "url": url})


@router.post("/vendor/event-image")
async def upload_vendor_event_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an event banner photo. Returns a URL to store in ``image_url`` on the event."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-event-images/{vendor_id}")
    return JSONResponse(content={"image_url": url, "url": url})


@router.post("/vendor/recurring-plan-image")
async def upload_vendor_recurring_plan_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a recurring-plan banner photo. Returns a URL to store in ``image_url`` on the plan."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-recurring-plan-images/{vendor_id}")
    return JSONResponse(content={"image_url": url, "url": url})


@router.post("/vendor/testimonial-avatar")
async def upload_vendor_testimonial_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a testimonial customer avatar. Returns a URL to store in ``avatar_url`` on the testimonial."""
    vendor_id = await _get_vendor_id(current_user, db)
    url = await _save_file(file, f"vendor-testimonial-avatars/{vendor_id}")
    return JSONResponse(content={"image_url": url, "url": url})


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
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image for a product."""
    product = await _get_managed_product(current_user, db, product_id, vendor_id)

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
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a product image."""
    product = await _get_managed_product(current_user, db, product_id, vendor_id)

    target = next(
        (img for img in (product.images or []) if str(img.id) == str(image_id)),
        None,
    )
    if not target:
        result = await db.execute(
            select(ProductImage).where(
                ProductImage.id == image_id,
                ProductImage.product_id == product.id,
            )
        )
        target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        await delete_stored_file(target.url)
    except Exception:
        pass

    was_primary = bool(target.is_primary)
    await db.delete(target)
    await db.commit()

    if was_primary:
        try:
            product = await _get_managed_product(current_user, db, product_id, vendor_id)
            remaining = sorted(product.images or [], key=lambda img: img.position or 0)
            if remaining:
                remaining[0].is_primary = True
                await db.commit()
        except Exception:
            pass

    return JSONResponse(content={"detail": "Image deleted"})


@router.put("/products/{product_id}/images/{image_id}/primary")
async def set_primary_product_image(
    product_id: UUID,
    image_id: UUID,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Set an image as the primary product image."""
    product = await _get_managed_product(current_user, db, product_id, vendor_id)

    found = False
    for img in (product.images or []):
        if str(img.id) == str(image_id):
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
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Reorder product images by id list (display order)."""
    product = await _get_managed_product(current_user, db, product_id, vendor_id)

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
    from sqlalchemy.orm.attributes import flag_modified
    variant.media = current_media
    flag_modified(variant, "media")
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

    from sqlalchemy.orm.attributes import flag_modified
    variant.media = current_media
    flag_modified(variant, "media")
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
    from sqlalchemy.orm.attributes import flag_modified
    variant.media = current_media
    flag_modified(variant, "media")
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

    from sqlalchemy.orm.attributes import flag_modified
    variant.media = reordered
    flag_modified(variant, "media")
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

    # Keep listing/builder thumbnails in sync — not only when this is the first upload.
    if media_type == "image" and (is_primary or not (svc.image_url or "").strip()):
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


# ── Rental Asset Media ──────────────────────────────────────────────────────

@router.post("/rentals/{asset_id}/media")
async def upload_rental_asset_media(
    asset_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload media (image / video / 3D model) for a rental asset."""
    from app.models.rental import RentalAsset
    from sqlalchemy.orm.attributes import flag_modified

    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(RentalAsset).where(RentalAsset.id == asset_id, RentalAsset.vendor_id == vendor_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Rental asset not found")

    media_type = detect_media_type(file)
    url = await _save_file(file, "rental-assets")

    current_media = list(asset.media or [])
    is_primary = len(current_media) == 0 and media_type == "image"
    media_item = {
        "id": uuid.uuid4().hex,
        "url": url,
        "media_type": media_type,
        "is_primary": is_primary,
        "alt_text": asset.name,
        "position": len(current_media),
    }
    current_media.append(media_item)
    asset.media = current_media

    if media_type == "image" and (is_primary or not (asset.image_url or "").strip()):
        asset.image_url = url

    flag_modified(asset, "media")
    await db.commit()

    return JSONResponse(content={"media": current_media, "item": media_item})


@router.delete("/rentals/{asset_id}/media/{media_id}")
async def delete_rental_asset_media(
    asset_id: UUID,
    media_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a media item from a rental asset."""
    from app.models.rental import RentalAsset
    from sqlalchemy.orm.attributes import flag_modified

    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(RentalAsset).where(RentalAsset.id == asset_id, RentalAsset.vendor_id == vendor_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Rental asset not found")

    current_media = list(asset.media or [])
    target = next((m for m in current_media if m.get("id") == media_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Media item not found")

    await delete_stored_file(target.get("url", ""))
    current_media = [m for m in current_media if m.get("id") != media_id]

    # Reassign primary if the deleted item was primary
    if target.get("is_primary") and current_media:
        images = [m for m in current_media if m.get("media_type") == "image"]
        if images:
            images[0]["is_primary"] = True
            asset.image_url = images[0]["url"]
        else:
            asset.image_url = None
    elif not current_media:
        asset.image_url = None

    for pos, item in enumerate(current_media):
        item["position"] = pos

    asset.media = current_media
    flag_modified(asset, "media")
    await db.commit()

    return JSONResponse(content={"media": current_media})


@router.put("/rentals/{asset_id}/media/{media_id}/primary")
async def set_primary_rental_asset_media(
    asset_id: UUID,
    media_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a media item as the primary rental asset image."""
    from app.models.rental import RentalAsset
    from sqlalchemy.orm.attributes import flag_modified

    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(RentalAsset).where(RentalAsset.id == asset_id, RentalAsset.vendor_id == vendor_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Rental asset not found")

    current_media = list(asset.media or [])
    target = next((m for m in current_media if m.get("id") == media_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Media item not found")
    if target.get("media_type") != "image":
        raise HTTPException(status_code=400, detail="Only images can be set as primary")

    for item in current_media:
        item["is_primary"] = item.get("id") == media_id
    asset.image_url = target["url"]

    asset.media = current_media
    flag_modified(asset, "media")
    await db.commit()

    return JSONResponse(content={"media": current_media})


@router.put("/rentals/{asset_id}/media/reorder")
async def reorder_rental_asset_media(
    asset_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder rental asset media by id list (display order)."""
    from app.models.rental import RentalAsset
    from sqlalchemy.orm.attributes import flag_modified

    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(RentalAsset).where(RentalAsset.id == asset_id, RentalAsset.vendor_id == vendor_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Rental asset not found")

    media_ids = body.get("media_ids") or []
    if not media_ids:
        raise HTTPException(status_code=400, detail="media_ids required")

    current_media = list(asset.media or [])
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

    asset.media = reordered
    flag_modified(asset, "media")
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
