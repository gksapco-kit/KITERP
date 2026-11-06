"""
InfocomX-specific HR assets (offer letter layout, payslip stationery) are only for
designated vendor accounts — not every tenant on the platform.

Allowed vendor slugs default to the platform HR tenant (`kiterp-platform`) and
`infocomx`. Override with env `INFOCOMX_VENDOR_SLUGS` (comma-separated), e.g.
`INFOCOMX_VENDOR_SLUGS=infocomx,kiterp-platform,acme-infocomx`
"""

from __future__ import annotations

import os


INFOCOMX_OFFER_LAYOUT = "infocomx_letter"


def _allowed_infocomx_vendor_slugs() -> set[str]:
    raw = (os.getenv("INFOCOMX_VENDOR_SLUGS") or "kiterp-platform,infocomx").strip()
    return {s.strip().lower() for s in raw.split(",") if s.strip()}


def vendor_may_use_infocomx_hr_assets(slug: str | None) -> bool:
    s = (slug or "").strip().lower()
    return bool(s) and s in _allowed_infocomx_vendor_slugs()


def body_html_contains_infocomx_stationery(body_html: str | None) -> bool:
    if not body_html:
        return False
    h = body_html
    return (
        'data-infocomx-letter="true"' in h
        or "data-infocomx-letter='true'" in h
        or "infocomx-logo" in h.lower()
        or "data-infocomx-logo" in h.lower()
    )


def offer_template_is_infocomx_stationery(tpl) -> bool:
    """True if this row is the InfocomX letter layout or InfocomX-branded HTML."""
    layout = (getattr(tpl, "layout", None) or "").strip()
    body = getattr(tpl, "body_html", None) or ""
    return layout == INFOCOMX_OFFER_LAYOUT or body_html_contains_infocomx_stationery(body)


def offer_templates_visible_for_vendor(templates: list, vendor_slug: str | None) -> list:
    """Drop InfocomX-only templates for vendors outside the allow-list (same rule as list API)."""
    if vendor_may_use_infocomx_hr_assets(vendor_slug):
        return list(templates)
    return [t for t in templates if not offer_template_is_infocomx_stationery(t)]
