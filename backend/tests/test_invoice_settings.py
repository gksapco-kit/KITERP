"""
Invoice / quotation / POS-receipt settings: RBAC, validation and sanitisation.

- Reading settings needs ``invoices.view``; changing them needs ``invoices.manage``.
- Saved settings are untrusted vendor HTML/text and must be sanitised.
- POS receipt overrides are stored per vendor on the server (not per browser).
"""

import uuid

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.api.deps import get_current_vendor_user
from app.main import app
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.utils.document_settings import sanitize_document_settings

BASE = "/api/v1/vendors/me/invoices/settings"
ENDPOINTS = {
    "invoice": BASE,
    "quotation": f"{BASE}/quotation",
    "pos": f"{BASE}/pos",
}


def _as_role(vendor_id, user_id, role: str) -> VendorUser:
    return VendorUser(
        id=uuid.uuid4(), vendor_id=vendor_id, user_id=user_id,
        role=role, permissions=[], is_active=True,
    )


@pytest.fixture
def as_role(test_vendor: Vendor, test_user):
    def _set(role: str):
        app.dependency_overrides[get_current_vendor_user] = lambda: _as_role(
            test_vendor.id, test_user.id, role
        )
    yield _set
    app.dependency_overrides.pop(get_current_vendor_user, None)


# ── sanitiser (pure) ─────────────────────────────────────────────────────────

def test_sanitiser_strips_scripts_handlers_and_unsafe_urls():
    out = sanitize_document_settings({
        "template_pages_html": (
            '<div class="page" onclick="x()"><script>alert(1)</script>'
            '<a href="javascript:alert(1)">bad</a><a href="https://ok.example">ok</a>'
            '<style>.page{color:#111}</style></div>'
        ),
        "qr_code_label": "Scan <img src=x onerror=alert(1)> & pay",
        "color": "red;}</style><script>alert(1)</script>",
        "website_url": "javascript:alert(1)",
        "signature_url": "data:image/svg+xml;base64,PHN2Zz4=",
        "qr_code_url": "data:image/png;base64,iVBORw0KGgo=",
        "logo_url": "/uploads/logo.png",
        "show_logo": True,
    })
    html = out["template_pages_html"]
    assert "<script" not in html and "onclick" not in html and "javascript:" not in html
    assert 'href="https://ok.example"' in html
    assert ".page{color:#111}" in html            # legitimate <style> kept
    assert "<" not in out["qr_code_label"] and "& pay" in out["qr_code_label"]
    assert out["color"] == ""
    assert out["website_url"] == ""
    assert out["signature_url"] == ""              # SVG data URL rejected
    assert out["qr_code_url"].startswith("data:image/png;base64,")
    assert out["logo_url"] == "/uploads/logo.png"
    assert out["show_logo"] is True


def test_sanitiser_keeps_valid_colour_and_text():
    out = sanitize_document_settings({"color": "#1a56db", "default_terms": "Net 30\nA & B < C"})
    assert out["color"] == "#1a56db"
    assert out["default_terms"] == "Net 30\nA & B < C"


@pytest.mark.parametrize("bad", [[1], "x", {"a": "x" * 20_001}])
def test_sanitiser_rejects_bad_payloads(bad):
    with pytest.raises(HTTPException) as e:
        sanitize_document_settings(bad)
    assert e.value.status_code == 422


def test_sanitiser_lenient_mode_never_raises():
    assert sanitize_document_settings("junk", strict=False) == {}
    assert len(sanitize_document_settings({"a": "x" * 30_000}, strict=False)["a"]) == 20_000


# ── RBAC ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["invoice", "quotation", "pos"])
@pytest.mark.parametrize("role", ["cashier", "sales"])
async def test_view_only_roles_can_read_but_not_write(client: AsyncClient, as_role, kind, role):
    as_role(role)
    url = ENDPOINTS[kind]
    assert (await client.get(url)).status_code == 200
    resp = await client.put(url, json={"color": "#111111"})
    assert resp.status_code == 403
    assert "invoices.manage" in resp.json()["detail"]


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["invoice", "quotation", "pos"])
@pytest.mark.parametrize("role", ["owner", "manager", "accountant"])
async def test_manage_roles_can_write(client: AsyncClient, as_role, kind, role):
    as_role(role)
    url = ENDPOINTS[kind]
    resp = await client.put(url, json={"color": "#0694a2", "show_logo": False})
    assert resp.status_code == 200
    assert resp.json()["color"] == "#0694a2"
    got = (await client.get(url)).json()
    assert got == {"color": "#0694a2", "show_logo": False}


# ── Validation + persistence ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_put_sanitises_before_saving(client: AsyncClient, as_role):
    as_role("owner")
    resp = await client.put(ENDPOINTS["invoice"], json={
        "template_pages_html": '<p onmouseover="x()">Hi</p><script>alert(1)</script>',
        "qr_code_label": "<b>Pay</b>",
    })
    assert resp.status_code == 200
    saved = (await client.get(ENDPOINTS["invoice"])).json()
    assert "<script" not in saved["template_pages_html"]
    assert "onmouseover" not in saved["template_pages_html"]
    assert saved["qr_code_label"] == "Pay"


@pytest.mark.asyncio
@pytest.mark.parametrize("body", ["[1,2]", '"text"', "not json"])
async def test_put_rejects_non_object_bodies(client: AsyncClient, as_role, body):
    as_role("owner")
    resp = await client.put(
        ENDPOINTS["invoice"], content=body, headers={"Content-Type": "application/json"}
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invoice_quotation_and_pos_settings_are_independent(client: AsyncClient, as_role):
    as_role("owner")
    await client.put(ENDPOINTS["invoice"], json={"template": "classic"})
    await client.put(ENDPOINTS["quotation"], json={"template": "modern"})
    await client.put(ENDPOINTS["pos"], json={"template": "compact", "paper_size": "3inch"})
    assert (await client.get(ENDPOINTS["invoice"])).json() == {"template": "classic"}
    assert (await client.get(ENDPOINTS["quotation"])).json() == {"template": "modern"}
    assert (await client.get(ENDPOINTS["pos"])).json() == {"template": "compact", "paper_size": "3inch"}


@pytest.mark.asyncio
async def test_pos_settings_are_shared_by_every_terminal(client: AsyncClient, as_role):
    """A manager saves once; a cashier on another terminal reads the same template."""
    as_role("manager")
    await client.put(ENDPOINTS["pos"], json={"template": "compact", "show_logo": False})
    as_role("cashier")
    assert (await client.get(ENDPOINTS["pos"])).json() == {"template": "compact", "show_logo": False}


@pytest.mark.asyncio
async def test_pos_reset_with_empty_object(client: AsyncClient, as_role):
    as_role("owner")
    await client.put(ENDPOINTS["pos"], json={"template": "compact"})
    assert (await client.put(ENDPOINTS["pos"], json={})).status_code == 200
    assert (await client.get(ENDPOINTS["pos"])).json() == {}


# ── Template image uploads (signature / QR / logo) ──────────────────────────

ASSET_URL = "/api/v1/uploads/vendor/document-asset"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
WEBP = b"RIFF\x24\x00\x00\x00WEBP" + b"\x00" * 24


class _FakeFileService:
    def __init__(self):
        self.uploads = []

    async def upload_bytes(self, body, folder, ext, content_type="application/octet-stream"):
        url = f"/uploads/{folder}/{uuid.uuid4().hex}{ext}"           # same shape as the real service
        self.uploads.append({"url": url, "folder": folder, "ext": ext, "content_type": content_type})
        return url


@pytest.fixture
def fake_storage(monkeypatch):
    """Replace real file storage so tests never touch disk/S3; record uploads and deletions."""
    import app.api.v1.vendor_invoices as invoices_mod
    import app.services.document_assets as assets_mod

    fs = _FakeFileService()
    deleted = []

    async def _delete(url):
        deleted.append(url)
        return True

    monkeypatch.setattr(assets_mod, "get_file_service", lambda: fs)
    monkeypatch.setattr(invoices_mod, "delete_stored_file", _delete)
    fs.deleted = deleted
    return fs


async def _upload(client, kind="signature", name="s.png", data=PNG, ctype="image/png"):
    return await client.post(ASSET_URL, data={"kind": kind}, files={"file": (name, data, ctype)})


@pytest.mark.asyncio
@pytest.mark.parametrize("kind,folder", [
    ("signature", "vendor-signatures"), ("qr", "vendor-qr-codes"), ("logo", "vendor-document-logos"),
])
async def test_asset_upload_returns_url_in_template_folder(client, as_role, fake_storage, kind, folder):
    as_role("owner")
    resp = await _upload(client, kind=kind)
    assert resp.status_code == 200
    assert resp.json()["url"].startswith(f"/uploads/{folder}/")
    # Template logos must never land in the company-logo folder.
    assert fake_storage.uploads[-1]["folder"] != "vendor-logos"


@pytest.mark.asyncio
async def test_asset_upload_does_not_change_saved_settings(client, as_role, fake_storage):
    """Upload only stores a file; the setting changes when the user presses Save."""
    as_role("owner")
    await client.put(ENDPOINTS["invoice"], json={"color": "#111111"})
    await _upload(client, "signature")
    await _upload(client, "logo")
    assert (await client.get(ENDPOINTS["invoice"])).json() == {"color": "#111111"}


@pytest.mark.asyncio
@pytest.mark.parametrize("data,ext,ctype", [(PNG, ".png", "image/png"), (JPEG, ".jpg", "image/jpeg"), (WEBP, ".webp", "image/webp")])
async def test_asset_extension_and_type_come_from_the_bytes(client, as_role, fake_storage, data, ext, ctype):
    as_role("owner")
    # Client lies about both the filename and the content type.
    resp = await _upload(client, name="evil.html", data=data, ctype="text/html")
    assert resp.status_code == 200
    assert fake_storage.uploads[-1]["ext"] == ext
    assert fake_storage.uploads[-1]["content_type"] == ctype


@pytest.mark.asyncio
@pytest.mark.parametrize("data", [
    b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
    b"<html><script>alert(1)</script></html>",
    b"GIF89a" + b"\x00" * 16,
    b"not an image",
])
async def test_asset_rejects_non_png_jpeg_webp(client, as_role, fake_storage, data):
    as_role("owner")
    resp = await _upload(client, data=data, ctype="image/png")  # claims PNG, bytes disagree
    assert resp.status_code == 400
    assert fake_storage.uploads == []


@pytest.mark.asyncio
async def test_asset_rejects_oversize_and_bad_kind(client, as_role, fake_storage):
    as_role("owner")
    big = PNG + b"\x00" * (2 * 1024 * 1024)
    assert (await _upload(client, data=big)).status_code == 400
    assert (await _upload(client, kind="company-logo")).status_code == 422
    assert fake_storage.uploads == []


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["cashier", "sales"])
async def test_asset_upload_denied_for_view_only_roles(client, as_role, fake_storage, role):
    as_role(role)
    assert (await _upload(client)).status_code == 403
    assert fake_storage.uploads == []


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [
    "accountant",   # invoices.manage
    "purchaser",    # procurement.manage (PO templates)
    "hr_manager",   # hr.offers (HR offer templates) -- has no invoices.* permission at all
    "owner",
])
async def test_asset_upload_allowed_for_template_editors(client, as_role, fake_storage, role):
    as_role(role)
    assert (await _upload(client)).status_code == 200


@pytest.mark.asyncio
async def test_asset_upload_never_touches_company_logo(client, as_role, fake_storage, db_session, test_vendor):
    as_role("hr_manager")
    test_vendor.logo_url = "/uploads/vendor-logos/company.png"
    await db_session.commit()
    resp = await _upload(client, kind="logo")
    assert resp.status_code == 200
    await db_session.refresh(test_vendor)
    assert test_vendor.logo_url == "/uploads/vendor-logos/company.png"
    assert fake_storage.deleted == []


# ── Replaced images are cleaned up, shared ones are not ─────────────────────

SIG = f"/uploads/vendor-signatures/{'a' * 32}.png"
SIG_NEW = f"/uploads/vendor-signatures/{'b' * 32}.png"


@pytest.mark.asyncio
async def test_replaced_signature_file_is_deleted_on_save(client, as_role, fake_storage):
    as_role("owner")
    await client.put(ENDPOINTS["invoice"], json={"signature_url": SIG})
    assert fake_storage.deleted == []
    await client.put(ENDPOINTS["invoice"], json={"signature_url": SIG_NEW})
    assert fake_storage.deleted == [SIG]


@pytest.mark.asyncio
async def test_removing_signature_deletes_file(client, as_role, fake_storage):
    as_role("owner")
    await client.put(ENDPOINTS["invoice"], json={"signature_url": SIG})
    await client.put(ENDPOINTS["invoice"], json={"signature_url": ""})
    assert fake_storage.deleted == [SIG]


@pytest.mark.asyncio
async def test_file_still_used_by_other_settings_is_kept(client, as_role, fake_storage):
    """POS settings often copy the invoice signature; dropping it from one must not break the other."""
    as_role("owner")
    await client.put(ENDPOINTS["invoice"], json={"signature_url": SIG})
    await client.put(ENDPOINTS["pos"], json={"signature_url": SIG})
    await client.put(ENDPOINTS["invoice"], json={"signature_url": ""})
    assert fake_storage.deleted == []                       # POS still points at it
    await client.put(ENDPOINTS["pos"], json={})
    assert fake_storage.deleted == [SIG]                    # now nothing references it


@pytest.mark.asyncio
async def test_company_logo_and_foreign_files_are_never_deleted(client, as_role, fake_storage, db_session, test_vendor):
    as_role("owner")
    company_logo = "/uploads/vendor-logos/company.png"
    test_vendor.logo_url = company_logo
    await db_session.commit()
    # Even if a template points at the company logo, removing it from the template must not delete it.
    await client.put(ENDPOINTS["invoice"], json={"logo_url": company_logo, "qr_code_url": "/uploads/other/x.png"})
    await client.put(ENDPOINTS["invoice"], json={})
    assert fake_storage.deleted == []


@pytest.mark.asyncio
@pytest.mark.parametrize("crafted", [
    f"/uploads/vendor-signatures/../../app/main.py",                    # path traversal
    f"https://other-host.example/vendor-signatures/{'c' * 32}.png",      # not our storage
    f"/uploads/vendor-signatures/{'c' * 32}.png/../../../etc/passwd",
    "/uploads/vendor-signatures/not-one-of-ours.png",
])
async def test_crafted_urls_in_settings_never_cause_a_delete(client, as_role, fake_storage, crafted):
    """Settings are user-editable JSON: dropping a crafted URL must not make the server delete anything."""
    as_role("owner")
    await client.put(ENDPOINTS["invoice"], json={"signature_url": crafted})
    await client.put(ENDPOINTS["invoice"], json={})
    assert fake_storage.deleted == []


@pytest.mark.asyncio
async def test_legacy_inline_images_are_not_treated_as_files(client, as_role, fake_storage):
    as_role("owner")
    inline = "data:image/png;base64,iVBORw0KGgo="
    await client.put(ENDPOINTS["invoice"], json={"signature_url": inline})
    await client.put(ENDPOINTS["invoice"], json={})
    assert fake_storage.deleted == []


@pytest.mark.asyncio
async def test_old_signature_endpoints_are_gone(client, as_role):
    as_role("owner")
    for path in (f"{BASE}/signature", f"{BASE}/quotation-signature"):
        resp = await client.post(path, files={"file": ("s.png", PNG, "image/png")})
        assert resp.status_code in (404, 405, 422)


@pytest.mark.asyncio
async def test_pdf_route_rejects_malformed_invoice_id(client: AsyncClient, as_role):
    as_role("owner")
    resp = await client.get("/api/v1/vendors/me/invoices/not-a-uuid/pdf")
    assert resp.status_code == 422
