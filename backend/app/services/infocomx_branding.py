"""Bundled InfocomX logo for HR documents (payslip, offer letter PDF)."""

from __future__ import annotations

import base64
from functools import lru_cache
from pathlib import Path

LOGO_FILE = Path(__file__).resolve().parents[1] / "template_assets" / "branding" / "infocomx-logo.png"

INFOCOMX_COMPANY_NAME = "Infocomx Technologies Private Limited"
INFOCOMX_COMPANY_ADDRESS = "Hyderabad, Telangana, India - 500090"


@lru_cache(maxsize=1)
def infocomx_logo_data_url() -> str:
    """PNG with transparent background (bundled under template_assets/branding)."""
    if not LOGO_FILE.is_file():
        return ""
    encoded = base64.standard_b64encode(LOGO_FILE.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def refresh_infocomx_logo_cache() -> None:
    """Call after replacing template_assets/branding/infocomx-logo.png."""
    infocomx_logo_data_url.cache_clear()


INFOCOMX_LOGO_PATH = "/branding/infocomx-logo.png"


def resolve_infocomx_logo_url(vendor_logo: str | None) -> str | None:
    """Template/vendor logo wins; otherwise embedded InfocomX PNG."""
    url = (vendor_logo or "").strip()
    if url and url != INFOCOMX_LOGO_PATH:
        return url
    data = infocomx_logo_data_url()
    return data or url or None


def embed_infocomx_logo_in_html(html: str) -> str:
    """Replace static InfocomX logo paths with an embedded PNG for print/PDF."""
    data = infocomx_logo_data_url()
    if not data or not html:
        return html
    out = html
    for path in (INFOCOMX_LOGO_PATH, "branding/infocomx-logo.png"):
        out = out.replace(f'src="{path}"', f'src="{data}"')
        out = out.replace(f"src='{path}'", f"src='{data}'")
    return out
