"""Variant media upload — JSONB list + vendor-owned variant."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor import Vendor
from app.models.vendor_product import Product, ProductVariant
from app.services import file_service as fs_mod
from app.services import media_upload as mu

TINY_JPEG = b"\xff\xd8\xff\xdb" + b"\x00" * 64


@pytest.fixture
def local_uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(fs_mod, "_LOCAL_UPLOAD_ROOT", tmp_path)
    service = fs_mod.FileService()
    service._use_s3 = False
    monkeypatch.setattr(mu, "_file_service", service)
    return tmp_path


async def _add_variant(db: AsyncSession, product: Product, **kwargs) -> ProductVariant:
    variant = ProductVariant(
        id=uuid.uuid4(),
        product_id=product.id,
        name=kwargs.pop("name", "500 g"),
        price=kwargs.pop("price", 225),
        **kwargs,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


@pytest.mark.asyncio
async def test_upload_variant_media_jpeg(
    client: AsyncClient,
    test_vendor: Vendor,
    test_product: Product,
    db_session: AsyncSession,
    local_uploads,
):
    variant = await _add_variant(db_session, test_product)

    resp = await client.post(
        f"/api/v1/uploads/variants/{variant.id}/media",
        files={"file": ("sweet.jpg", TINY_JPEG, "image/jpeg")},
        headers={"X-Vendor-Id": str(test_vendor.id)},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["media"]) == 1
    assert body["added"]["media_type"] == "image"
    assert body["added"]["is_primary"] is True
    assert body["added"]["url"].startswith("/uploads/variants/")
    assert body["added"]["alt_text"] == "500 g"


@pytest.mark.asyncio
async def test_upload_variant_media_recovers_when_media_is_not_a_list(
    client: AsyncClient,
    test_vendor: Vendor,
    test_product: Product,
    db_session: AsyncSession,
    local_uploads,
):
    """Corrupt / non-list JSONB must not 500."""
    variant = await _add_variant(db_session, test_product, media={"url": "bad"})

    resp = await client.post(
        f"/api/v1/uploads/variants/{variant.id}/media",
        files={"file": ("sweet.jpg", TINY_JPEG, "image/jpeg")},
        headers={"X-Vendor-Id": str(test_vendor.id)},
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["media"]) == 1


@pytest.mark.asyncio
async def test_upload_variant_media_unknown_variant_404(
    client: AsyncClient,
    test_vendor: Vendor,
    local_uploads,
):
    resp = await client.post(
        f"/api/v1/uploads/variants/{uuid.uuid4()}/media",
        files={"file": ("sweet.jpg", TINY_JPEG, "image/jpeg")},
        headers={"X-Vendor-Id": str(test_vendor.id)},
    )
    assert resp.status_code == 404
