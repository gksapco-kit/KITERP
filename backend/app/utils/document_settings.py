"""Validation + sanitisation for vendor-authored document (invoice / quotation) settings.

These settings are free-form JSON saved by the vendor and later interpolated into
HTML that is rendered in print / PDF windows.  Everything saved here must therefore
be treated as untrusted:

* ``template_pages_html``  -> sanitised HTML (scripts, event handlers, unsafe URLs removed)
* URL-like fields          -> restricted to safe schemes
* ``color``                -> restricted to a CSS colour token
* every other string       -> reduced to plain text (no markup)
* the whole payload        -> size / depth limited
"""

from __future__ import annotations

import html
import json
import re
from typing import Any

import nh3
from fastapi import HTTPException

MAX_SETTINGS_BYTES = 4 * 1024 * 1024  # whole JSON document
MAX_PAGES_HTML_CHARS = 1_000_000       # template_pages_html
MAX_TEXT_CHARS = 20_000                # any other free-text string
MAX_IMAGE_REF_CHARS = 3_000_000        # logo / signature / QR (may be base64 data URLs)
MAX_DEPTH = 8
MAX_LIST_ITEMS = 200

HTML_KEYS = {"template_pages_html"}
IMAGE_KEYS = {"logo_url", "signature_url", "qr_code_url"}
LINK_KEYS = {"website_url"}
COLOR_KEYS = {"color"}

_COLOR_RE = re.compile(r"^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,30}|(rgb|rgba|hsl|hsla)\([0-9\s.,%/-]{3,40}\))$")
_SAFE_DATA_IMAGE_RE = re.compile(r"^data:image/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$")
_SCHEME_RE = re.compile(r"^\s*([a-zA-Z][a-zA-Z0-9+.-]*):")

# ── HTML allow-list (for template_pages_html) ────────────────────────────────
_ALLOWED_TAGS = {
    "div", "span", "p", "br", "hr", "b", "strong", "i", "em", "u", "s", "small", "sub", "sup",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
    "img", "a", "style", "section", "header", "footer", "article", "figure", "figcaption",
    "label", "font", "center",
}
_GENERIC_ATTRS = {
    "class", "id", "style", "title", "align", "valign", "dir", "lang",
    "data-offer-page", "data-offer-custom", "data-doc-editable", "data-doc-page-sheet",
    "data-section", "data-field", "data-kiterp-preview-fit", "data-doc-editable-styles",
}
_ALLOWED_ATTRS = {
    "*": _GENERIC_ATTRS,
    "a": {"href", "target", "name"},
    "img": {"src", "alt", "width", "height"},
    "td": {"colspan", "rowspan", "width", "height", "bgcolor"},
    "th": {"colspan", "rowspan", "width", "height", "bgcolor"},
    "table": {"width", "border", "cellpadding", "cellspacing", "bgcolor"},
    "col": {"span", "width"},
    "colgroup": {"span", "width"},
    "font": {"color", "size", "face"},
}
_URL_SCHEMES = {"http", "https", "mailto", "tel", "data"}

_CSS_DANGEROUS_RE = re.compile(r"(expression\s*\(|javascript\s*:|vbscript\s*:|@import|behavior\s*:|-moz-binding)", re.I)


def _fail(msg: str) -> None:
    raise HTTPException(status_code=422, detail=msg)


def sanitize_template_html(value: str) -> str:
    """Strip scripts / event handlers / unsafe URLs from stored template HTML."""
    cleaned = nh3.clean(
        value,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRS,
        url_schemes=_URL_SCHEMES,
        clean_content_tags={"script"},  # keep <style> content, drop <script> entirely
        strip_comments=True,
        link_rel="noopener noreferrer",
    )
    # CSS cannot execute script in modern browsers, but block the legacy vectors anyway.
    return _CSS_DANGEROUS_RE.sub("", cleaned)


def _plain_text(value: str) -> str:
    """Remove any markup from a string, keeping its literal text."""
    return html.unescape(nh3.clean(value, tags=set(), attributes={}))


def _safe_link(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    m = _SCHEME_RE.match(value)
    if m and m.group(1).lower() not in {"http", "https"}:
        return ""
    return _plain_text(value)


def _safe_image_ref(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if value.startswith("data:"):
        return value if _SAFE_DATA_IMAGE_RE.match(value) else ""
    m = _SCHEME_RE.match(value)
    if m and m.group(1).lower() not in {"http", "https"}:
        return ""
    return _plain_text(value)


def _clean_value(key: str, value: Any, depth: int, strict: bool) -> Any:
    if depth > MAX_DEPTH:
        if strict:
            _fail("Settings are nested too deeply")
        return None

    if isinstance(value, str):
        if key in HTML_KEYS:
            if len(value) > MAX_PAGES_HTML_CHARS and strict:
                _fail(f"'{key}' is too large")
            return sanitize_template_html(value)
        if key in IMAGE_KEYS:
            if len(value) > MAX_IMAGE_REF_CHARS and strict:
                _fail(f"'{key}' is too large")
            return _safe_image_ref(value)
        if key in LINK_KEYS:
            return _safe_link(value[:2048])
        if key in COLOR_KEYS:
            v = value.strip()
            return v if _COLOR_RE.match(v) else ""
        if len(value) > MAX_TEXT_CHARS:
            if strict:
                _fail(f"'{key}' is too long (max {MAX_TEXT_CHARS} characters)")
            value = value[:MAX_TEXT_CHARS]
        return _plain_text(value)

    if isinstance(value, dict):
        return {str(k)[:100]: _clean_value(str(k), v, depth + 1, strict) for k, v in value.items()}

    if isinstance(value, list):
        if len(value) > MAX_LIST_ITEMS:
            if strict:
                _fail("Too many list items in settings")
            value = value[:MAX_LIST_ITEMS]
        return [_clean_value(key, v, depth + 1, strict) for v in value]

    if isinstance(value, (bool, int, float)) or value is None:
        return value

    return None


def sanitize_document_settings(data: Any, *, strict: bool = True) -> dict:
    """Validate and sanitise an invoice/quotation settings payload.

    ``strict=True`` (writes) raises HTTP 422 on malformed or oversized input.
    ``strict=False`` (reads of legacy data) cleans best-effort and never raises.
    """
    if not isinstance(data, dict):
        if strict:
            _fail("Settings must be a JSON object")
        return {}
    if strict:
        try:
            size = len(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        except (TypeError, ValueError):
            _fail("Settings are not valid JSON")
        if size > MAX_SETTINGS_BYTES:
            _fail(f"Settings are too large (max {MAX_SETTINGS_BYTES // (1024 * 1024)} MB)")
    return _clean_value("", data, 0, strict)
