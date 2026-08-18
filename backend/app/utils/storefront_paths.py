"""Public customer site URLs: /{slug} (legacy /store/{slug} redirects on the SPA)."""
from __future__ import annotations

RESERVED_VENDOR_SLUGS = frozenset({
    "store",
    "stores",
    "admin",
    "vendor",
    "vendors",
    "api",
    "uploads",
    "health",
    "assets",
    "static",
    "cdn",
    "www",
    "app",
    "mail",
    "docs",
    "partners",
    "careers",
    "contact",
    "lead",
    "create-business",
    "local",
    "template-browser",
    "preview",
    "sitemap",
    "robots",
    "favicon",
    "sitemap.xml",
    "robots.txt",
    "favicon.ico",
    "well-known",
    "dashboard",
    "login",
    "register",
    "account",
    "products",
    "services",
    "cart",
    "checkout",
    "blog",
    "policies",
    "hr",
    "employee",
    "rentals",
    "order",
    "orders",
    "help",
    "about",
    "pricing",
    "terms",
    "privacy",
    "support",
    "status",
    "home",
    "index",
})


def is_reserved_vendor_slug(slug: str | None) -> bool:
    value = (slug or "").strip().lower()
    return (not value) or value in RESERVED_VENDOR_SLUGS


def storefront_public_path(slug: str, suffix: str = "") -> str:
    """Path-only public URL, e.g. /rainbow-nursery or /rainbow-nursery/hr/login."""
    s = (slug or "").strip()
    extra = suffix.strip()
    if extra and not extra.startswith("/"):
        extra = f"/{extra}"
    if extra == "/":
        extra = ""
    return f"/{s}{extra}" if s else extra or "/"
