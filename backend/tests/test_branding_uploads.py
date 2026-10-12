"""
Company logo / banner uploads.

They change what the whole store shows (storefront, invoices, emails), so they need
``settings.edit`` -- held only by the owner role -- instead of just being logged in.
The logo must be a real image within the normal size cap.
"""

import io
import uuid

import pytest
from httpx import AsyncClient
from PIL import Image

import app.services.media_upload as media_mod
from app.api.deps import get_current_vendor_user
from app.main import app
from app.models.vendor_user import VendorUser

LOGO_URL = "/api/v1/uploads/vendor/logo"
BANNER_URL = "/api/v1/uploads/vendor/banner"
BRANDING_URL = "/api/v1/uploads/vendor/branding-asset"


def _png(size=(32, 32)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, (20, 90, 200)).save(out, "PNG")
    return out.getvalue()


class _Storage:
    def __init__(self):
        self.uploads, self.deleted = [], []

    async def upload_bytes(self, body, folder, ext, content_type="application/octet-stream"):
        url = f"/uploads/{folder}/{uuid.uuid4().hex}{ext}"
        self.uploads.append({"url": url, "folder": folder, "size": len(body)})
        return url

    async def delete_file(self, url):
        self.deleted.append(url)
        return True


@pytest.fixture
def storage(monkeypatch):
    fs = _Storage()
    monkeypatch.setattr(media_mod, "get_file_service", lambda: fs)
    return fs


@pytest.fixture
def as_role(test_vendor, test_user):
    def _set(role: str):
        app.dependency_overrides[get_current_vendor_user] = lambda: VendorUser(
            id=uuid.uuid4(), vendor_id=test_vendor.id, user_id=test_user.id,
            role=role, permissions=[], is_active=True,
        )
    yield _set
    app.dependency_overrides.pop(get_current_vendor_user, None)


async def _post(client, url, name="logo.png", data=None, ctype="image/png"):
    return await client.post(url, files={"file": (name, _png() if data is None else data, ctype)})


@pytest.mark.asyncio
async def test_owner_can_replace_the_logo_and_the_old_file_is_removed(
    client: AsyncClient, as_role, storage, db_session, test_vendor,
):
    as_role("owner")
    test_vendor.logo_url = "/uploads/vendor-logos/old.png"
    await db_session.commit()
    resp = await _post(client, LOGO_URL)
    assert resp.status_code == 200
    new_url = resp.json()["logo_url"]
    assert new_url.startswith("/uploads/vendor-logos/")
    await db_session.refresh(test_vendor)
    assert test_vendor.logo_url == new_url
    assert storage.deleted == ["/uploads/vendor-logos/old.png"]


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["manager", "sales", "cashier", "accountant", "purchaser", "hr_manager"])
@pytest.mark.parametrize("url", [LOGO_URL, BANNER_URL])
async def test_only_the_owner_can_change_company_branding(
    client: AsyncClient, as_role, storage, db_session, test_vendor, role, url,
):
    as_role(role)
    test_vendor.logo_url = "/uploads/vendor-logos/keep.png"
    test_vendor.banner_url = "/uploads/vendor-banners/keep.png"
    await db_session.commit()
    resp = await _post(client, url)
    assert resp.status_code == 403
    assert storage.uploads == [] and storage.deleted == []        # nothing stored, nothing removed
    await db_session.refresh(test_vendor)
    assert test_vendor.logo_url == "/uploads/vendor-logos/keep.png"
    assert test_vendor.banner_url == "/uploads/vendor-banners/keep.png"


@pytest.mark.asyncio
async def test_owner_can_replace_the_banner(client: AsyncClient, as_role, storage, db_session, test_vendor):
    as_role("owner")
    resp = await _post(client, BANNER_URL, name="banner.png")
    assert resp.status_code == 200
    await db_session.refresh(test_vendor)
    assert test_vendor.banner_url == resp.json()["banner_url"]


@pytest.mark.asyncio
async def test_branding_asset_stays_open_to_other_roles(client: AsyncClient, as_role, storage):
    """Quotation extra-fields and CRM screens (sales etc.) use this; it changes no vendor state."""
    as_role("sales")
    assert (await _post(client, BRANDING_URL)).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("name,ctype", [
    ("clip.mp4", "video/mp4"), ("model.glb", "model/gltf-binary"), ("clip.webm", "video/webm"),
])
async def test_logo_must_be_an_image(client: AsyncClient, as_role, storage, name, ctype):
    as_role("owner")
    resp = await _post(client, LOGO_URL, name=name, data=b"\x00" * 1024, ctype=ctype)
    assert resp.status_code == 400
    assert storage.uploads == []


@pytest.mark.asyncio
async def test_logo_rejects_fake_images_and_oversized_files(client: AsyncClient, as_role, storage, db_session, test_vendor):
    as_role("owner")
    test_vendor.logo_url = "/uploads/vendor-logos/keep.png"
    await db_session.commit()
    fake = await _post(client, LOGO_URL, name="logo.png", data=b"<html>not an image</html>")
    assert fake.status_code == 400
    too_big = await _post(client, LOGO_URL, name="logo.png", data=b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024 + 1))
    assert too_big.status_code == 400 and "too large" in too_big.json()["detail"].lower()
    assert storage.uploads == [] and storage.deleted == []        # a rejected upload must not delete the current logo
    await db_session.refresh(test_vendor)
    assert test_vendor.logo_url == "/uploads/vendor-logos/keep.png"
