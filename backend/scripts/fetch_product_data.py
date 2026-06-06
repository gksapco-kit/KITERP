"""
Fetch real-world product data (barcode/EAN, name, brand, images) from the
free Open Food Facts database.

Open Food Facts is a free, open product database covering FMCG / grocery goods
worldwide. It provides:
  - barcode (EAN / UPC / GTIN)
  - product name, brand, quantity, categories
  - product images (front/ingredients/nutrition)

It does NOT provide HSN codes. HSN is an Indian GST tax classification and must
be sourced from the official CBIC / GST portal. For reference, plain coconut oil
is commonly classified under HSN 1513 -- always verify before using for tax/compliance.

Usage:
    cd backend
    # Search by brand and/or text
    python scripts/fetch_product_data.py --brand parachute --query "coconut oil"

    # Look up a single barcode
    python scripts/fetch_product_data.py --barcode 8901088000345

    # Also download the front images into ./product_images/
    python scripts/fetch_product_data.py --brand parachute --download

No API key required. Be polite: Open Food Facts asks for a descriptive User-Agent.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import httpx

BASE_URL = "https://world.openfoodfacts.org"
USER_AGENT = "Asureit-ProductFetcher/1.0 (internal tooling)"
FIELDS = "code,product_name,brands,quantity,categories,countries,image_front_url,image_url"


def _client() -> httpx.Client:
    return httpx.Client(
        base_url=BASE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30.0,
    )


def _get_with_retry(client: httpx.Client, url: str, params: dict, retries: int = 4) -> httpx.Response:
    """The OFF search endpoint frequently returns transient 5xx; back off and retry."""
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            resp = client.get(url, params=params)
            if resp.status_code in (502, 503, 504, 429):
                raise httpx.HTTPStatusError("transient", request=resp.request, response=resp)
            resp.raise_for_status()
            return resp
        except httpx.HTTPError as exc:
            last_exc = exc
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  retry {attempt + 1}/{retries - 1} after {wait}s ({exc})", file=sys.stderr)
                time.sleep(wait)
    raise last_exc  # type: ignore[misc]


def search(brand: str | None, query: str | None, page_size: int) -> list[dict]:
    params: dict[str, str | int] = {"fields": FIELDS, "page_size": page_size}
    if brand:
        params["brands_tags"] = brand
    if query:
        params["search_terms"] = query
    with _client() as client:
        resp = _get_with_retry(client, "/api/v2/search", params)
        return resp.json().get("products", [])


def lookup_barcode(barcode: str) -> dict | None:
    with _client() as client:
        resp = client.get(f"/api/v2/product/{barcode}", params={"fields": FIELDS})
        resp.raise_for_status()
        data = resp.json()
        return data.get("product") if data.get("status") == 1 else None


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "product").lower()).strip("-") or "product"


def download_images(products: list[dict], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with _client() as client:
        for p in products:
            url = p.get("image_front_url") or p.get("image_url")
            if not url:
                continue
            name = f"{p.get('code', 'unknown')}-{_slug(p.get('product_name', ''))}.jpg"
            dest = out_dir / name
            try:
                img = client.get(url)
                img.raise_for_status()
                dest.write_bytes(img.content)
                print(f"  saved {dest}")
            except httpx.HTTPError as exc:
                print(f"  failed {url}: {exc}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch product data from Open Food Facts.")
    ap.add_argument("--brand", help="Brand tag, e.g. 'parachute'")
    ap.add_argument("--query", help="Free-text search terms, e.g. 'coconut oil'")
    ap.add_argument("--barcode", help="Look up a single barcode (EAN/UPC)")
    ap.add_argument("--page-size", type=int, default=15, help="Max results (search mode)")
    ap.add_argument("--download", action="store_true", help="Download front images")
    ap.add_argument(
        "--out", default="product_images", help="Image output dir (with --download)"
    )
    args = ap.parse_args()

    if args.barcode:
        product = lookup_barcode(args.barcode)
        products = [product] if product else []
    elif args.brand or args.query:
        products = search(args.brand, args.query, args.page_size)
    else:
        ap.error("provide --barcode, or --brand/--query")
        return 2

    if not products:
        print("No products found.")
        return 1

    print(json.dumps(products, indent=2, ensure_ascii=False))
    print(f"\n{len(products)} product(s) found.")

    if args.download:
        print(f"Downloading images into {args.out}/ ...")
        download_images(products, Path(args.out))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
