#!/usr/bin/env python3
"""Revert accidental 'business front' splits inside code identifiers."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {"node_modules", ".git", "__pycache__", "dist", "exports", ".cursor"}

REPLACEMENTS = [
    ("shouldUseLocalBusiness FrontUrls", "shouldUseLocalStorefrontUrls"),
    ("getCustomerBusiness FrontBaseUrl", "getCustomerStorefrontBaseUrl"),
    ("BUSINESS FRONT_OPEN_IN_BROWSER_BTN_CLASS", "STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS"),
    ("business frontApi", "storefrontApi"),
    ("business frontKeys", "storefrontKeys"),
    ("business frontUrl", "businessFrontUrl"),
    ("business frontBase", "businessFrontBase"),
    ("business frontPublicBaseDomain", "storefrontPublicBaseDomain"),
    ("Business FrontCatalogTemplateId", "StorefrontCatalogTemplateId"),
    ("BUSINESS FRONT_CATALOG_TEMPLATE_IDS", "STOREFRONT_CATALOG_TEMPLATE_IDS"),
    ("BUSINESS FRONT_PAGES", "STOREFRONT_PAGES"),
    ("BUSINESS FRONT_VENDOR_SIGNUP_DRAFT_KEY", "STOREFRONT_VENDOR_SIGNUP_DRAFT_KEY"),
    ("previewBusiness FrontCssVars", "previewStorefrontCssVars"),
    ("isBusiness Front", "isStorefront"),
    ("vendor_live_on_business front", "vendor_live_on_storefront"),
    ("list_business front_directory", "list_storefront_directory"),
    ("list_business front_vendors", "list_storefront_vendors"),
    ('/sites/{site_id}/business front/orders', "/sites/{site_id}/storefront/orders"),
    ("/public/sites/${siteId}/business front/orders", "/public/sites/${siteId}/storefront/orders"),
    (".replace(/^business front_/", ".replace(/^storefront_/"),
    ("['business front',", "['storefront',"),
    ('["business front",', '["storefront",'),
    ("queryKey: ['business front'", "queryKey: ['storefront'"),
    ("invalidateQueries({ queryKey: ['business front'", "invalidateQueries({ queryKey: ['storefront'"),
    ("setQueryData(['business front'", "setQueryData(['storefront'"),
]


SCAN = [
    ROOT / "vendor-web" / "src",
    ROOT / "storefront-web" / "src",
    ROOT / "frontend" / "src",
    ROOT / "backend" / "app",
    ROOT / "backend" / "tests",
]


def main() -> None:
    changed = []
    paths = []
    for base in SCAN:
        if base.exists():
            paths.extend(base.rglob("*"))
    for path in paths:
        if not path.is_file() or any(p in path.parts for p in SKIP):
            continue
        if path.suffix.lower() not in {".tsx", ".ts", ".py", ".css", ".md", ".json", ".html"}:
            continue
        if path.name == "fix-business-front-identifier-corruption.py":
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        original = text
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8", newline="\n")
            changed.append(str(path.relative_to(ROOT)))
    print(f"Fixed {len(changed)} files")
    for p in sorted(changed):
        print(p)


if __name__ == "__main__":
    main()
