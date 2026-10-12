"""Images that belong to a document template (signature / QR code / logo).

Shared by every template editor (invoice, quotation, POS receipt, purchase order, HR offer).

* Files are stored in their own folders -- never in ``vendor-logos``, which holds the company
  logo shown across the whole app, so uploading a template logo can't replace it.
* The image type and extension are decided from the file's real bytes, never from the client
  filename / content type (a PNG named ``x.html`` must not be stored as ``.html``).
* SVG is intentionally not accepted: it can carry <script> and is served same-origin.
"""

from __future__ import annotations

import base64
import binascii
import re
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile

from app.services.media_upload import get_file_service

DOCUMENT_ASSET_FOLDERS = {
    "signature": "vendor-signatures",
    "qr": "vendor-qr-codes",
    "logo": "vendor-document-logos",
}
MAX_DOCUMENT_ASSET_BYTES = 2 * 1024 * 1024


def sniff_image(body: bytes) -> Optional[Tuple[str, str]]:
    """Return ``(extension, content_type)`` from the file's real bytes, or None."""
    if body.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png", "image/png"
    if body.startswith(b"\xff\xd8\xff"):
        return ".jpg", "image/jpeg"
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return ".webp", "image/webp"
    return None


_ASSET_TAIL = re.compile(
    r"(?:%s)/[0-9a-f]{32}\.(?:png|jpe?g|webp)" % "|".join(re.escape(f) for f in DOCUMENT_ASSET_FOLDERS.values()),
    re.IGNORECASE,
)
# The company logo (``vendor.logo_url``) lives in its own folder with client-chosen extensions.
_COMPANY_LOGO_TAIL = re.compile(r"vendor-logos/[A-Za-z0-9_-]+\.[A-Za-z0-9]{2,5}")
_MAX_URL_LEN = 2048


def _own_storage_prefixes() -> list:
    """URL prefixes under which *this* deployment's uploaded files are served."""
    prefixes = ["/uploads/"]
    remote = getattr(get_file_service(), "remote_public_url", None)
    base = remote("x") if callable(remote) else None
    if base and base.endswith("/x"):
        prefixes.append(base[:-1])  # keep the trailing slash
    return prefixes


def _storage_tail(url) -> Optional[str]:
    """The ``<folder>/<file>`` part of a URL that points into our own storage, else None."""
    if not isinstance(url, str) or not url or len(url) > _MAX_URL_LEN:
        return None
    for prefix in _own_storage_prefixes():
        if url.startswith(prefix):
            return url[len(prefix):]
    return None


def document_asset_key(url) -> Optional[str]:
    """Storage key of a template image that *we* stored, else None.

    Deliberately strict -- the URL must be our own storage base followed by exactly
    ``<template-folder>/<32-hex-name>.<png|jpg|jpeg|webp>``. Settings are user-editable JSON, so
    anything looser would let a crafted value (``..`` segments, another host, another folder) make
    the server read or delete files it never created for this purpose.
    """
    tail = _storage_tail(url)
    return tail if tail and _ASSET_TAIL.fullmatch(tail) else None


def company_logo_key(url) -> Optional[str]:
    """Storage key of the company logo (``vendor.logo_url``), else None."""
    tail = _storage_tail(url)
    return tail if tail and _COMPANY_LOGO_TAIL.fullmatch(tail) else None


def is_document_asset(url) -> bool:
    """True if ``url`` is a file we stored in one of the template-image folders."""
    return document_asset_key(url) is not None


_DATA_URL = re.compile(r"data:image/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)", re.IGNORECASE)


async def load_document_image(url, *, allow_company_logo: bool = False) -> Optional[bytes]:
    """Raw bytes of a template image, or None if it is missing / not something we may read.

    Reads only files in our own storage (see :func:`document_asset_key`) and legacy inline
    ``data:`` images. It never fetches a URL over the network, so a settings value can't make the
    server request an arbitrary address.
    """
    if not isinstance(url, str) or not url:
        return None
    if url.startswith("data:"):
        match = _DATA_URL.fullmatch(url)
        if not match or len(url) > MAX_DOCUMENT_ASSET_BYTES * 2:
            return None
        try:
            body = base64.b64decode(match.group(1), validate=False)
        except (binascii.Error, ValueError):
            return None
    else:
        key = document_asset_key(url) or (company_logo_key(url) if allow_company_logo else None)
        if not key:
            return None
        body = await get_file_service().read_bytes(key)
    if not body or len(body) > MAX_DOCUMENT_ASSET_BYTES or not sniff_image(body):
        return None
    return body


async def store_document_asset(kind: str, file: UploadFile) -> str:
    """Validate and store a template image; return its public URL."""
    folder = DOCUMENT_ASSET_FOLDERS.get(kind)
    if not folder:
        raise HTTPException(422, f"kind must be one of: {', '.join(sorted(DOCUMENT_ASSET_FOLDERS))}")

    body = await file.read(MAX_DOCUMENT_ASSET_BYTES + 1)
    if len(body) > MAX_DOCUMENT_ASSET_BYTES:
        raise HTTPException(400, f"File too large. Max {MAX_DOCUMENT_ASSET_BYTES // (1024 * 1024)} MB.")
    sniffed = sniff_image(body)
    if not sniffed:
        raise HTTPException(400, "Unsupported image. Use a PNG, JPG or WebP file.")
    ext, content_type = sniffed
    return await get_file_service().upload_bytes(body, folder, ext, content_type)
