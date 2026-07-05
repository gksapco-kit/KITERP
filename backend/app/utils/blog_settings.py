"""Vendor blog visibility settings (storefront on/off)."""
from __future__ import annotations

from typing import Any, Mapping


def is_blog_enabled(settings: Mapping[str, Any] | None) -> bool:
    """Return True when blog is enabled on the business front (default: enabled)."""
    if not settings:
        return True
    features = settings.get("features")
    if isinstance(features, Mapping) and "blog" in features:
        return bool(features["blog"])
    return True


def set_blog_enabled(settings: dict[str, Any] | None, enabled: bool) -> dict[str, Any]:
    """Return updated settings dict with features.blog set."""
    out = dict(settings or {})
    features = dict(out.get("features") or {})
    features["blog"] = enabled
    out["features"] = features
    return out
