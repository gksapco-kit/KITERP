"""Resolve service thumbnail URLs from image_url, media, and gallery."""

from __future__ import annotations

from typing import Any

_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp")


def _is_image_media(item: dict[str, Any]) -> bool:
    media_type = (item.get("media_type") or "image").lower()
    if media_type == "image":
        return True
    if media_type in ("video", "model3d", "model", "audio"):
        return False
    url = _media_url(item) or ""
    return _url_looks_like_image(url)


def _url_looks_like_image(url: str) -> bool:
    path = url.split("?", 1)[0].lower()
    return any(path.endswith(ext) for ext in _IMAGE_EXTENSIONS)


def _media_url(item: dict[str, Any]) -> str | None:
    url = (item.get("url") or item.get("src") or item.get("file_url") or "").strip()
    return url or None


def resolve_service_thumbnail_url(service: Any) -> str | None:
    """Match vendor Services list: prefer media thumbnail, then image_url, then gallery."""
    media = getattr(service, "media", None) or []
    if isinstance(media, list):
        media_items = [m for m in media if isinstance(m, dict) and _media_url(m)]
        primary_image = next(
            (m for m in media_items if m.get("is_primary") and _is_image_media(m)),
            None,
        )
        if primary_image:
            return _media_url(primary_image)

        first_image = next((m for m in media_items if _is_image_media(m)), None)
        if first_image:
            return _media_url(first_image)

        # Same fallback as vendor list: primary / first media when it is an image file.
        primary = next((m for m in media_items if m.get("is_primary")), None) or (
            media_items[0] if media_items else None
        )
        if primary:
            url = _media_url(primary)
            if url and _url_looks_like_image(url):
                return url

    direct = (getattr(service, "image_url", None) or "").strip()
    if direct:
        return direct

    gallery = getattr(service, "gallery", None) or []
    if isinstance(gallery, list):
        for item in gallery:
            if isinstance(item, str) and item.strip():
                return item.strip()
            if isinstance(item, dict):
                url = _media_url(item)
                if url:
                    return url

    return None
