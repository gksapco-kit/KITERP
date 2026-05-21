#!/usr/bin/env python3
"""Replace user-facing 'storefront' copy with 'business front'; keep code paths/identifiers."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {
    "node_modules",
    ".git",
    "__pycache__",
    "dist",
    "build",
    ".cursor",
    "exports",
    ".tmp-storefront-ui",
}
EXTS = {
    ".tsx",
    ".ts",
    ".md",
    ".html",
    ".css",
    ".py",
    ".json",
    ".yml",
    ".yaml",
    ".ps1",
    ".sh",
    ".mjs",
    ".txt",
    ".example",
}

KEEP_PATTERNS = [
    r"storefront-web",
    r"@kiterp/storefront",
    r"@/storefront/",
    r"/storefront-builder",
    r"/storefront-display",
    r"/system/storefront-display",
    r"storefront-builder",
    r"storefront-display",
    r"storefront-ui",
    r"storefront_fashion",
    r"storefront_electronics",
    r"storefront_grocery",
    r"storefront_restaurant",
    r"storefront_services",
    r"VITE_STOREFRONT",
    r"getStorefront",
    r"useStorefront",
    r"StorefrontProvider",
    r"StorefrontContext",
    r"StorefrontShell",
    r"StorefrontConfig",
    r"StorefrontDataAdapter",
    r"StorefrontMarquee",
    r"StorefrontTemplate",
    r"StorefrontPage",
    r"StorefrontCart",
    r"StorefrontCheckout",
    r"StorefrontConfirmation",
    r"StorefrontLayout",
    r"StorefrontHome",
    r"StorefrontProducts",
    r"StorefrontProduct",
    r"StorefrontServices",
    r"StorefrontService",
    r"StorefrontAbout",
    r"StorefrontContact",
    r"StorefrontOrder",
    r"StorefrontVendor",
    r"StorefrontBuilder",
    r"StorefrontDisplay",
    r"StorefrontLive",
    r"StorefrontRoute",
    r"CatalogStorefront",
    r"buildStorefront",
    r"storefrontPreviewUrl",
    r"storefrontPreview",
    r"storefrontHref",
    r"storefront\.api",
    r"sb-storefront",
    r"storefrontOptions",
    r"VendorStorefrontLinksCard",
    r"updateStorefrontBuilder",
    r"getStorefrontBuilder",
    r"isStorefrontTemplate",
    r"storefrontOverlay",
    r"storefront_login",
    r'id="storefront',
    r"'storefront_",
    r"pages/storefront/",
    r"SystemStorefrontDisplay",
    r"StorefrontBuilderPage",
]

SCAN_ROOTS = [
    ROOT / "vendor-web" / "src",
    ROOT / "storefront-web" / "src",
    ROOT / "frontend" / "src",
    ROOT / "backend" / "app",
    ROOT / "backend" / "tests",
    ROOT / "docs",
    ROOT,
]

SKIP_FILES = {
    "rebrand-storefront-to-business-front.py",
}


def transform_word(word: str) -> str:
    mapping = {
        "STOREFRONT": "BUSINESS FRONT",
        "Storefronts": "Business Fronts",
        "storefronts": "business fronts",
        "Storefront": "Business Front",
        "storefront": "business front",
    }
    return mapping.get(word, word)


def transform_segment(seg: str) -> str:
    return re.sub(
        r"STOREFRONT|Storefronts|storefronts|Storefront|storefront",
        lambda m: transform_word(m.group(0)),
        seg,
    )


def protect_identifiers(text: str) -> tuple[str, list[str]]:
    placeholders: list[str] = []

    def mask(m: re.Match[str]) -> str:
        placeholders.append(m.group(0))
        return f"__KEEP_{len(placeholders) - 1}__"

    for pat in KEEP_PATTERNS:
        text = re.sub(pat, mask, text, flags=re.I)
    return text, placeholders


def unmask(text: str, placeholders: list[str]) -> str:
    for i, val in enumerate(placeholders):
        text = text.replace(f"__KEEP_{i}__", val)
    return text


def process_content(content: str) -> str:
    masked, placeholders = protect_identifiers(content)

    def qrepl(m: re.Match[str]) -> str:
        q, body = m.group(1), m.group(2)
        if "__KEEP_" in body:
            return m.group(0)
        return q + transform_segment(body) + q

    result = re.sub(
        r'("|\')([^"\']*(?:storefront|Storefront)[^"\']*)("|\')',
        qrepl,
        masked,
        flags=re.I,
    )
    result = re.sub(
        r">([^<{}]*(?:storefront|Storefront)[^<{}]*)<",
        lambda m: ">" + transform_segment(m.group(1)) + "<",
        result,
    )
    result = re.sub(
        r"(//[^\n]*(?:storefront|Storefront)[^\n]*)",
        lambda m: transform_segment(m.group(1)),
        result,
        flags=re.I,
    )
    return unmask(result, placeholders)


def iter_files():
    for base in SCAN_ROOTS:
        if not base.exists():
            continue
        if base == ROOT:
            for name in ("README.md", "DEPLOY_FREE.md", "package.json", ".env.example", "vendor-web/index.html", "storefront-web/index.html"):
                p = base / name
                if p.is_file():
                    yield p
            continue
        for path in base.rglob("*"):
            yield path


def main() -> None:
    changed: list[str] = []
    for path in iter_files():
        if not path.is_file():
            continue
        if path.name in SKIP_FILES:
            continue
        if any(p in path.parts for p in SKIP_PARTS):
            continue
        if path.suffix.lower() not in EXTS and path.name not in ("README", "README.md"):
            continue
        if path.name in ("package-lock.json", "database.sql"):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if "storefront" not in text.lower():
            continue
        new = process_content(text)
        if new != text:
            path.write_text(new, encoding="utf-8", newline="\n")
            changed.append(str(path.relative_to(ROOT)))

    print(f"Updated {len(changed)} files")
    for p in sorted(changed):
        print(p)


if __name__ == "__main__":
    main()
