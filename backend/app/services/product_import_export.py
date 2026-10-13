"""Create products from a spreadsheet and export the same sheet with images."""
from __future__ import annotations

import ipaddress
import re
import socket
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urljoin, urlparse
from uuid import UUID

import httpx
from fastapi import HTTPException
from slugify import slugify
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.vendor_product import Product, ProductImage, ProductVariant
from app.repositories.product_repo import ProductRepository
from app.services.catalog_store_scope import sync_product_stores
from app.services.media_upload import get_file_service
from app.services.material_code import generate_product_material_code
from app.services.product_sheet import (
    build_export_zip,
    is_example_name,
    read_upload,
    sniff_image,
    split_image_paths,
    template_rows,
)

MAX_IMPORT_ROWS = 500
MAX_EXPORT_PRODUCTS = 2000
MAX_IMAGES = 5
_DOWNLOAD_TIMEOUT = 15.0

PRODUCT_TYPES = {
    "physical": "physical",
    "finished": "physical",
    "finished goods": "physical",
    "finished goods (sellable)": "physical",
    "digital": "digital",
    "digital (sellable)": "digital",
    "subscription": "subscription",
    "subscription (sellable)": "subscription",
    "bundle": "bundle",
    "bundle (sellable)": "bundle",
    "semi_finished": "semi_finished",
    "semi finished": "semi_finished",
    "semi finished goods": "semi_finished",
    "raw_material": "raw_material",
    "raw material": "raw_material",
}

_VISIBLE = {"visible", "true", "yes", "1", "visible on storefront"}
_HIDDEN = {"hidden", "false", "no", "0", "hidden from storefront"}
_STATUSES = {"draft", "active", "archived"}
_CONTENT_TYPES = {".jpg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}


@dataclass
class ImportRowResult:
    row: int
    name: str
    result: str
    status: str | None = None
    message: str = ""


@dataclass
class ImportSummary:
    created: int = 0
    skipped: int = 0
    failed: int = 0
    ignored_examples: int = 0
    rows: list[ImportRowResult] = field(default_factory=list)

    def add(self, item: ImportRowResult) -> None:
        self.rows.append(item)
        if item.result == "created":
            self.created += 1
        elif item.result == "skipped":
            self.skipped += 1
        else:
            self.failed += 1

    def as_dict(self) -> dict:
        return {
            "created": self.created,
            "skipped": self.skipped,
            "failed": self.failed,
            "ignored_examples": self.ignored_examples,
            "rows": [
                {
                    "row": row.row,
                    "name": row.name,
                    "result": row.result,
                    "status": row.status,
                    "message": row.message,
                }
                for row in self.rows
            ],
        }


def resolve_import_status(raw: str, *, image_saved: bool, image_failed: bool) -> tuple[str, str | None]:
    """Filled status wins. A blank status is active only when an image was stored."""
    typed = (raw or "").strip().lower()
    if typed:
        if typed not in _STATUSES:
            raise ValueError("Status must be draft, active, or archived.")
        if typed == "active" and image_failed and not image_saved:
            return "draft", "Saved as draft because the image could not be loaded."
        return typed, None
    if image_saved:
        return "active", None
    return "draft", None


def resolve_visibility(raw: str) -> bool:
    value = (raw or "").strip().lower()
    if not value or value in _HIDDEN:
        return False
    if value in _VISIBLE:
        return True
    raise ValueError("Visibility must be visible or hidden.")


def resolve_product_type(raw: str) -> str:
    value = (raw or "").strip().lower()
    if not value:
        return "physical"
    mapped = PRODUCT_TYPES.get(value)
    if not mapped:
        raise ValueError("Product type is not recognized.")
    return mapped


async def export_product_zip(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    mode: str,
    product_ids: list[UUID] | None = None,
) -> tuple[bytes, str]:
    if mode == "template":
        return build_export_zip(template_rows(), {}), "product-import-template.zip"
    if mode not in {"selected", "all"}:
        raise ValueError("Export mode must be template, selected, or all.")

    query = (
        select(Product)
        .where(Product.vendor_id == vendor_id, Product.deleted_at.is_(None))
        .options(selectinload(Product.images), selectinload(Product.variants))
        .order_by(Product.name.asc())
        .limit(MAX_EXPORT_PRODUCTS)
    )
    if mode == "selected":
        ids = list(product_ids or [])
        if not ids:
            raise ValueError("Select at least one product to export.")
        query = query.where(Product.id.in_(ids[:MAX_EXPORT_PRODUCTS]))
    result = await db.execute(query)
    products = list(result.scalars().unique().all())

    rows: list[dict[str, str]] = []
    images: dict[str, bytes] = {}
    used_names: set[str] = set()
    files = get_file_service()
    for product in products:
        paths = await _export_images(files, product, images, used_names)
        variants = list(product.variants or [])
        variants.sort(key=lambda variant: (
            variant.created_at.timestamp() if variant.created_at else 0,
            (variant.name or "").lower(),
        ))
        if not variants:
            rows.append(_export_row(product, None, paths))
            continue
        for index, variant in enumerate(variants):
            rows.append(_export_row(product, variant, paths if index == 0 else []))
    filename = "products-selected.zip" if mode == "selected" else "products-export.zip"
    return build_export_zip(rows, images), filename


def _export_row(product: Product, variant: ProductVariant | None, image_paths: list[str]) -> dict[str, str]:
    """One sheet row. Variant price, stock, and SKU replace the product totals."""
    if variant is not None:
        price = variant.price if variant.price is not None else 0
        quantity = int(variant.quantity or 0)
        sku = variant.sku or ""
        barcode = variant.barcode or ""
        variant_name = (variant.name or "").strip()
    else:
        price = product.price if product.price is not None else 0
        quantity = int(product.quantity or 0)
        sku = product.sku or ""
        barcode = product.barcode or ""
        variant_name = ""
    return {
        "name": product.name or "",
        "variant": variant_name,
        "sku": sku,
        "material_code": product.material_code or "",
        "barcode": barcode,
        "brand": product.brand or "",
        "category": product.category or "",
        "product_type": product.product_type or "physical",
        "price": _format_number(price),
        "quantity": str(quantity),
        "status": product.status or "draft",
        "visibility": "visible" if product.is_visible else "hidden",
        "image_path": "|".join(image_paths),
    }


def _format_number(value) -> str:
    return f"{float(value):.2f}".rstrip("0").rstrip(".")


async def import_product_sheet(
    db: AsyncSession,
    vendor_id: UUID,
    user: User,
    filename: str,
    data: bytes,
) -> ImportSummary:
    rows, images = read_upload(filename, data)
    if len(rows) > MAX_IMPORT_ROWS:
        raise ValueError(f"Import up to {MAX_IMPORT_ROWS} products at a time.")

    summary = ImportSummary()
    existing = await _load_existing_keys(db, vendor_id)
    seen_sku: set[str] = set()
    seen_code: set[str] = set()
    seen_name: set[str] = set()

    for group in _group_product_rows(rows, summary):
        row_number = int(group[0].get("_row") or 0)
        name = (group[0].get("name") or "").strip()
        try:
            outcome = await _import_one(
                db, vendor_id, user, group, images, existing, seen_sku, seen_code, seen_name,
            )
        except HTTPException:
            raise
        except Exception as exc:
            outcome = ImportRowResult(row_number, name, "failed", message=_clean_error(exc))
        outcome.row = row_number
        summary.add(outcome)
    await db.commit()
    return summary


def _group_product_rows(rows: list[dict], summary: ImportSummary) -> list[list[dict]]:
    """Rows that share a product name are one product with several variants."""
    groups: dict[str, list[dict]] = {}
    order: list[str] = []
    for row in rows:
        name = (row.get("name") or "").strip()
        if is_example_name(name):
            summary.ignored_examples += 1
            continue
        key = name.lower() if name else f"__blank_{row.get('_row')}"
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(row)
    return [groups[key] for key in order]


def _variant_from_row(row: dict, index: int, total: int) -> dict:
    label = (row.get("variant") or "").strip()[:255]
    if not label:
        label = "Default" if total == 1 else f"Variant {index + 1}"
    return {
        "name": label,
        "sku": (row.get("sku") or "").strip()[:100],
        "barcode": (row.get("barcode") or "").strip()[:100],
        "price": _parse_price(row.get("price") or ""),
        "quantity": _parse_quantity(row.get("quantity") or ""),
    }


def _filled(rows: list[dict], key: str) -> str:
    for row in rows:
        value = (row.get(key) or "").strip()
        if value:
            return value
    return ""


async def _import_one(
    db: AsyncSession,
    vendor_id: UUID,
    user: User,
    rows: list[dict],
    images: dict[str, bytes],
    existing: dict[str, set[str]],
    seen_sku: set[str],
    seen_code: set[str],
    seen_name: set[str],
) -> ImportRowResult:
    row = rows[0]
    name = (row.get("name") or "").strip()
    if len(name) < 2:
        raise ValueError("Name is required and must be at least 2 characters.")
    if len(name) > 255:
        raise ValueError("Name must be 255 characters or less.")

    material_code = _filled(rows, "material_code")[:40]
    name_key = name.lower()
    code_key = material_code.lower()
    variant_rows = [_variant_from_row(item, index, len(rows)) for index, item in enumerate(rows)]
    sku_keys = [item["sku"].lower() for item in variant_rows if item["sku"]]

    if any(key in existing["sku"] or key in seen_sku for key in sku_keys):
        return ImportRowResult(0, name, "skipped", message="Already exists (same SKU).")
    if len(sku_keys) != len(set(sku_keys)):
        raise ValueError("Two variants in this product use the same SKU.")
    if code_key and (code_key in existing["material_code"] or code_key in seen_code):
        return ImportRowResult(0, name, "skipped", message="Already exists (same material code).")
    if name_key in existing["name"] or name_key in seen_name:
        return ImportRowResult(0, name, "skipped", message="Already exists (same name).")

    typed_status = _filled(rows, "status").lower()
    if typed_status and typed_status not in _STATUSES:
        raise ValueError("Status must be draft, active, or archived.")
    if code_key and code_key in existing["material_code_any"] and code_key not in existing["material_code"]:
        raise ValueError("Material code is already used, including by a deleted product.")

    product_type = resolve_product_type(_filled(rows, "product_type"))
    visibility = resolve_visibility(_filled(rows, "visibility"))
    price = variant_rows[0]["price"]
    quantity = sum(item["quantity"] for item in variant_rows)
    brand = _filled(rows, "brand")[:255] or None
    category = _filled(rows, "category")[:100] or None
    barcode = variant_rows[0]["barcode"] or None
    sku = variant_rows[0]["sku"] if len(variant_rows) == 1 else ""
    paths: list[str] = []
    for item in rows:
        for path in split_image_paths(item.get("image_path") or ""):
            if path not in paths:
                paths.append(path)
    paths = paths[:MAX_IMAGES]

    saved_images, image_notes = await _store_images(paths, images)
    status, status_note = resolve_import_status(
        typed_status,
        image_saved=bool(saved_images),
        image_failed=bool(paths) and not saved_images,
    )
    notes = [note for note in [status_note, *image_notes] if note]
    variant_count = len(variant_rows)
    message = f"Created as {status} with {variant_count} variant{'' if variant_count == 1 else 's'}."
    if notes:
        message = f"{message} {' '.join(notes)}"

    repo = ProductRepository(db)
    slug = slugify(name, lowercase=True) or "product"
    if await repo.slug_exists(vendor_id, slug):
        from uuid import uuid4
        slug = f"{slug}-{str(uuid4())[:8]}"
    if not material_code:
        material_code = await generate_product_material_code(db, vendor_id)

    actor = user.full_name or user.email or ""
    product = Product(
        vendor_id=vendor_id,
        name=name,
        slug=slug,
        material_code=material_code,
        brand=brand,
        product_type=product_type,
        category=category,
        sku=sku or None,
        barcode=barcode,
        price=price,
        quantity=quantity,
        stock_status=_stock_status(quantity),
        status=status,
        is_visible=visibility,
        currency="INR",
        valuation_method="moving_average",
        store_scope="all",
        tags=[],
        attributes={},
        specifications={},
        custom_fields={},
        related_product_ids=[],
        upsell_product_ids=[],
        cross_sell_product_ids=[],
        addons=[],
        meta_keywords=[],
        quote_form_config=[],
        created_by=user.id,
        updated_by=user.id,
        change_history=[{
            "version": 1,
            "changed_by": str(user.id),
            "changed_by_name": actor,
            "changed_at": datetime.utcnow().isoformat() + "Z",
            "changes": {"_action": {"old": None, "new": "Product imported"}},
        }],
    )
    try:
        async with db.begin_nested():
            db.add(product)
            await db.flush()
            for item in variant_rows:
                db.add(ProductVariant(
                    product_id=product.id,
                    name=item["name"],
                    sku=item["sku"] or None,
                    barcode=item["barcode"] or None,
                    price=item["price"],
                    quantity=item["quantity"],
                    stock_status=_stock_status(item["quantity"]),
                    currency="INR",
                    attributes={},
                    media=[],
                    subscription_schedule_modes=["dates", "cycles", "pick_dates", "weekly", "recurring"],
                    is_active=True,
                ))
            for index, (url, _ext) in enumerate(saved_images):
                db.add(ProductImage(
                    product_id=product.id,
                    url=url,
                    alt_text=name[:255],
                    position=index,
                    is_primary=index == 0,
                    media_type="image",
                ))
            await sync_product_stores(db, vendor_id, product.id, "all", [])
            await db.flush()
    except IntegrityError as exc:
        raise ValueError("Could not create this product because a unique value is already used.") from exc

    for key in sku_keys:
        existing["sku"].add(key)
        seen_sku.add(key)
    if material_code:
        existing["material_code"].add(material_code.lower())
        existing["material_code_any"].add(material_code.lower())
        seen_code.add(material_code.lower())
    existing["name"].add(name_key)
    seen_name.add(name_key)

    return ImportRowResult(0, name, "created", status=status, message=message)


async def _load_existing_keys(db: AsyncSession, vendor_id: UUID) -> dict[str, set[str]]:
    products = await db.execute(
        select(Product.name, Product.sku, Product.material_code, Product.deleted_at).where(
            Product.vendor_id == vendor_id,
        )
    )
    keys = {"sku": set(), "material_code": set(), "material_code_any": set(), "name": set()}
    for name, sku, material_code, deleted_at in products.all():
        if material_code:
            keys["material_code_any"].add(material_code.strip().lower())
        if deleted_at is not None:
            continue
        if name:
            keys["name"].add(name.strip().lower())
        if sku:
            keys["sku"].add(sku.strip().lower())
        if material_code:
            keys["material_code"].add(material_code.strip().lower())

    variants = await db.execute(
        select(ProductVariant.sku)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(
            Product.vendor_id == vendor_id,
            Product.deleted_at.is_(None),
            ProductVariant.sku.is_not(None),
            func.length(func.trim(ProductVariant.sku)) > 0,
        )
    )
    for (sku,) in variants.all():
        if sku:
            keys["sku"].add(sku.strip().lower())
    return keys


async def _export_images(files, product: Product, images: dict[str, bytes], used: set[str]) -> list[str]:
    paths: list[str] = []
    ordered = sorted(product.images or [], key=lambda img: (img.position or 0, not bool(img.is_primary)))
    picture_index = 0
    for image in ordered:
        if (image.media_type or "image") != "image":
            continue
        if picture_index >= MAX_IMAGES:
            break
        body = await files.read_bytes(image.url or "")
        ext = sniff_image(body or b"")
        if body and ext:
            stem = _file_stem(product.sku, product.name, str(product.id))
            filename = f"{stem}-{picture_index + 1}{ext}"
            while filename.lower() in used:
                filename = f"{stem}-{picture_index + 1}-{len(used)}{ext}"
            used.add(filename.lower())
            rel = f"images/{filename}"
            images[rel] = body
            paths.append(rel)
            picture_index += 1
        elif (image.url or "").lower().startswith(("http://", "https://")):
            paths.append(image.url)
    return paths


async def _store_images(paths: list[str], zip_images: dict[str, bytes]) -> tuple[list[tuple[str, str]], list[str]]:
    saved: list[tuple[str, str]] = []
    notes: list[str] = []
    files = get_file_service()
    for path in paths:
        try:
            body, ext = await _load_image_bytes(path, zip_images)
        except ValueError as exc:
            notes.append(f"{path}: {exc}")
            continue
        url = await files.upload_bytes(body, "products", ext, _CONTENT_TYPES.get(ext, "image/jpeg"))
        saved.append((url, ext))
    if notes and saved:
        notes.insert(0, "Some images could not be loaded.")
    elif notes and not saved and paths:
        notes.insert(0, "No images were loaded.")
    return saved, notes


async def _load_image_bytes(path: str, zip_images: dict[str, bytes]) -> tuple[bytes, str]:
    if path.lower().startswith(("http://", "https://")):
        body = await _download_image(path)
    else:
        body = _zip_image(path, zip_images)
        if body is None:
            raise ValueError("Image file was not found in the zip.")
    ext = sniff_image(body)
    if not ext:
        raise ValueError("File must be a JPEG, PNG, WebP, or GIF under 5 MB.")
    return body, ext


def _zip_image(path: str, zip_images: dict[str, bytes]) -> bytes | None:
    key = path.replace("\\", "/").lstrip("./").lower()
    if key in zip_images:
        return zip_images[key]
    basename = key.split("/")[-1]
    matches = [body for name, body in zip_images.items() if name.split("/")[-1] == basename]
    if len(matches) == 1:
        return matches[0]
    return None


async def _download_image(url: str) -> bytes:
    current = url.strip()
    async with httpx.AsyncClient(timeout=_DOWNLOAD_TIMEOUT, follow_redirects=False) as client:
        for _ in range(4):
            parsed = urlparse(current)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname:
                raise ValueError("Image link must start with http:// or https://.")
            if not _host_is_public(parsed.hostname):
                raise ValueError("Image link is not allowed.")
            try:
                response = await client.get(current)
            except httpx.HTTPError as exc:
                raise ValueError("Image link could not be opened.") from exc
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("location")
                if not location:
                    raise ValueError("Image link could not be opened.")
                current = urljoin(current, location)
                continue
            if response.status_code >= 400:
                raise ValueError("Image link could not be opened.")
            return response.content
    raise ValueError("Image link could not be opened.")


def _host_is_public(host: str) -> bool:
    name = host.strip().lower().rstrip(".")
    if not name or name in {"localhost", "metadata.google.internal"}:
        return False
    try:
        addresses = [ipaddress.ip_address(name)]
    except ValueError:
        try:
            infos = socket.getaddrinfo(name, None)
        except socket.gaierror:
            return False
        addresses = []
        for info in infos:
            try:
                addresses.append(ipaddress.ip_address(info[4][0]))
            except ValueError:
                return False
    return bool(addresses) and all(ip.is_global for ip in addresses)


def _parse_price(value: str) -> float:
    cleaned = re.sub(r"[^\d.\-]", "", (value or "").replace(",", ""))
    if cleaned in {"", "-", ".", "-."}:
        return 0.0
    try:
        price = float(cleaned)
    except ValueError as exc:
        raise ValueError("Price must be a number.") from exc
    if price < 0:
        raise ValueError("Price must be 0 or more.")
    return price


def _parse_quantity(value: str) -> int:
    cleaned = (value or "").strip().replace(",", "")
    if not cleaned:
        return 0
    try:
        quantity = float(cleaned)
    except ValueError as exc:
        raise ValueError("Stock must be a whole number.") from exc
    if quantity < 0 or not quantity.is_integer():
        raise ValueError("Stock must be a whole number, 0 or more.")
    return int(quantity)


def _stock_status(quantity: int) -> str:
    if quantity <= 0:
        return "out_of_stock"
    if quantity <= 5:
        return "low_stock"
    return "in_stock"


def _file_stem(sku: str | None, name: str | None, product_id: str) -> str:
    raw = (sku or name or product_id or "product").strip()
    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", raw).strip("-")[:40]
    return stem or "product"


def _clean_error(exc: Exception) -> str:
    if isinstance(exc, ValueError):
        return str(exc)
    return "Could not create this product."
