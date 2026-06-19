"""Validated media uploads via FileService (S3 or local uploads/)."""
from __future__ import annotations

import uuid
from typing import Optional, Set
from uuid import UUID

from fastapi import HTTPException, UploadFile, status

from app.services.file_service import FileService

_file_service: Optional[FileService] = None

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_3D_TYPES = {"model/gltf-binary", "model/gltf+json", "application/octet-stream"}
ALLOWED_3D_EXTENSIONS = {".glb", ".gltf"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
ALLOWED_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES | ALLOWED_3D_TYPES

MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_VIDEO_SIZE = 50 * 1024 * 1024
MAX_3D_SIZE = 30 * 1024 * 1024

ORDER_MEDIA_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ORDER_MEDIA_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_ORDER_IMAGE_BYTES = 5 * 1024 * 1024
MAX_ORDER_VIDEO_BYTES = 25 * 1024 * 1024


def get_file_service() -> FileService:
    global _file_service
    if _file_service is None:
        _file_service = FileService()
    return _file_service


def detect_media_type(file: UploadFile) -> str:
    ct = file.content_type or ""
    ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if file.filename and "." in file.filename else ""
    if ct in ALLOWED_VIDEO_TYPES or ext in ALLOWED_VIDEO_EXTENSIONS:
        return "video"
    if ct in ALLOWED_3D_TYPES or ext in ALLOWED_3D_EXTENSIONS:
        return "model3d"
    return "image"


def _sanitize_upload_filename(filename: str) -> str:
    name = filename.strip().replace("\\", "/").split("/")[-1]
    if "?" in name:
        name = name.split("?", 1)[0]
    return name


def _file_extension(file: UploadFile) -> str:
    if not file.filename:
        return ""
    name = _sanitize_upload_filename(file.filename)
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def _extension_from_content_type(content_type: str) -> str:
    ct = (content_type or "").split(";")[0].strip().lower()
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/svg+xml": ".svg",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
    }.get(ct, "")


def _extension_from_bytes(body: bytes) -> str:
    if len(body) < 4:
        return ""
    if body[:2] == b"\xff\xd8":
        return ".jpg"
    if body[:4] == b"\x89PNG":
        return ".png"
    if body[:3] == b"GIF":
        return ".gif"
    if body[:4] == b"RIFF" and len(body) >= 12 and body[8:12] == b"WEBP":
        return ".webp"
    return ""


def _normalize_extension(ext: str, content_type: str, body: bytes, media: str) -> str:
    ext = (ext or "").strip().lower()
    if "?" in ext:
        ext = ext.split("?", 1)[0]
    allowed = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS | ALLOWED_3D_EXTENSIONS
    if ext in allowed:
        return ext
    inferred = _extension_from_content_type(content_type) or _extension_from_bytes(body)
    if inferred in allowed:
        return inferred
    if media == "video":
        return ".mp4"
    if media == "model3d":
        return ".glb"
    return ".jpg"


def _upload_type_allowed(file: UploadFile) -> bool:
    ct = file.content_type or ""
    if ct in ALLOWED_TYPES:
        return True
    ext = _file_extension(file)
    if ext in ALLOWED_IMAGE_EXTENSIONS:
        return True
    if ext in ALLOWED_VIDEO_EXTENSIONS:
        return True
    if ext in ALLOWED_3D_EXTENSIONS:
        return True
    return False


def _looks_like_image(body: bytes) -> bool:
    if len(body) < 4:
        return False
    if body[:2] == b"\xff\xd8":
        return True
    if body[:4] == b"\x89PNG":
        return True
    if body[:3] == b"GIF":
        return True
    if body[:4] == b"RIFF" and len(body) >= 12 and body[8:12] == b"WEBP":
        return True
    stripped = body.lstrip()
    return not stripped.startswith((b"<", b"{", b"["))


async def delete_stored_file(file_url: Optional[str]) -> bool:
    if not file_url:
        return False
    return await get_file_service().delete_file(file_url)


async def save_media_file(file: UploadFile, subfolder: str) -> str:
    """Validate type/size and upload catalog/vendor media."""
    ext = _file_extension(file)
    if not _upload_type_allowed(file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type or 'unknown'} not allowed. Supported: images, videos (MP4/WebM), 3D models (GLB/GLTF).",
        )

    contents = await file.read()
    media = detect_media_type(file)
    max_size = MAX_VIDEO_SIZE if media == "video" else MAX_3D_SIZE if media == "model3d" else MAX_IMAGE_SIZE
    if len(contents) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max {max_size // (1024 * 1024)} MB for {media}.",
        )

    if media == "image" and not _looks_like_image(contents):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid image.",
        )

    ext = _normalize_extension(ext, file.content_type or "", contents, media)
    return await get_file_service().upload_bytes(
        contents,
        subfolder,
        ext,
        file.content_type or "application/octet-stream",
    )


async def save_image_file(
    file: UploadFile,
    subfolder: str,
    *,
    allowed_types: Optional[Set[str]] = None,
    max_bytes: int = MAX_IMAGE_SIZE,
) -> str:
    allowed = allowed_types or ALLOWED_IMAGE_TYPES
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="File type not allowed")
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File too large. Max {max_bytes // (1024 * 1024)} MB.")
    return await get_file_service().upload_file(file, subfolder, content=contents)


async def save_order_media_file(file: UploadFile, vendor_id: UUID, order_id: UUID) -> dict:
    ct = file.content_type or ""
    if ct in ORDER_MEDIA_IMAGE_TYPES:
        kind = "image"
        max_bytes = MAX_ORDER_IMAGE_BYTES
    elif ct in ORDER_MEDIA_VIDEO_TYPES:
        kind = "video"
        max_bytes = MAX_ORDER_VIDEO_BYTES
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allowed: JPEG, PNG, WebP, GIF, MP4, WebM, QuickTime.",
        )

    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max {max_bytes // (1024 * 1024)} MB for {kind}s.",
        )

    url = await get_file_service().upload_file(
        file,
        f"order-media/{vendor_id}/{order_id}",
        content=contents,
    )
    return {"url": url, "kind": kind}


ALLOWED_DOC_TYPES_HR = ALLOWED_IMAGE_TYPES | {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_DOC_SIZE_HR = 10 * 1024 * 1024


async def save_hr_document(file: UploadFile, emp_id: str) -> dict:
    if file.content_type not in ALLOWED_DOC_TYPES_HR:
        raise HTTPException(status_code=400, detail="Only images, PDFs and Word documents are allowed.")
    contents = await file.read()
    if len(contents) > MAX_DOC_SIZE_HR:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB).")
    url = await get_file_service().upload_file(file, f"hr/{emp_id}", content=contents)
    return {
        "file_url": url,
        "original_name": file.filename,
        "content_type": file.content_type,
        "is_image": file.content_type in ALLOWED_IMAGE_TYPES,
        "size": len(contents),
    }


ALLOWED_DOC_TYPES_CRM = ALLOWED_IMAGE_TYPES | {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
}
MAX_DOC_SIZE_CRM = 15 * 1024 * 1024


async def save_crm_document(file: UploadFile, vendor_id: UUID) -> dict:
    """Persist a CRM attachment (image / PDF / Word / Excel / CSV / text)."""
    ct = file.content_type or ""
    if ct not in ALLOWED_DOC_TYPES_CRM:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allowed: images, PDF, Word, Excel, CSV or text files.",
        )
    contents = await file.read()
    if len(contents) > MAX_DOC_SIZE_CRM:
        raise HTTPException(status_code=413, detail="File too large (max 15 MB).")
    url = await get_file_service().upload_file(file, f"crm/{vendor_id}", content=contents)
    return {
        "url": url,
        "filename": file.filename or "document",
        "content_type": ct,
        "size": len(contents),
        "is_image": ct in ALLOWED_IMAGE_TYPES,
    }


async def save_expense_receipt(file: UploadFile, vendor_id: UUID) -> dict:
    """Persist HR expense receipt — images/PDF, no hard size cap beyond reasonable limit."""
    allowed = ALLOWED_IMAGE_TYPES | {"application/pdf"}
    ct = file.content_type or ""
    if ct not in allowed:
        raise HTTPException(status_code=400, detail="Allowed: JPEG, PNG, WebP, GIF, PDF")
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 20 MB.")
    url = await get_file_service().upload_file(
        file,
        f"hr/expenses/{vendor_id}",
        content=contents,
    )
    return {"url": url, "filename": file.filename or "receipt"}


async def fetch_image_bytes_from_url(url: str) -> tuple[bytes, str]:
    """Download a remote image server-side (avoids browser CORS limits)."""
    from urllib.parse import urlparse

    import httpx

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only http(s) image URLs are supported.",
        )

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(
                url.strip(),
                headers={"User-Agent": "KIT-ERP/1.0", "Accept": "image/*,*/*"},
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not fetch image URL: {exc}",
            ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not fetch image (HTTP {response.status_code}).",
        )

    body = response.content
    if len(body) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image too large. Max {MAX_IMAGE_SIZE // (1024 * 1024)} MB.",
        )
    if not _looks_like_image(body):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL did not return a valid image.",
        )

    content_type = (response.headers.get("content-type") or "image/jpeg").split(";")[0].strip()
    return body, content_type
