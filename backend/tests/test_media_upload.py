"""Unit tests for catalog media type detection and local FileService writes."""
from types import SimpleNamespace

import pytest

from app.api.v1.uploads import _as_media_list
from app.services.media_upload import detect_media_type


def _file(name: str, content_type: str):
    return SimpleNamespace(filename=name, content_type=content_type)


def test_detect_media_type_jpeg_with_octet_stream():
    """Windows often sends image/jpeg files as application/octet-stream."""
    assert detect_media_type(_file("sweet.jpg", "application/octet-stream")) == "image"
    assert detect_media_type(_file("sweet.jpeg", "application/octet-stream")) == "image"
    assert detect_media_type(_file("sweet.png", "application/octet-stream")) == "image"


def test_as_media_list_normalizes_corrupt_jsonb():
    assert _as_media_list(None) == []
    assert _as_media_list("[]") == []
    assert _as_media_list({"url": "x"}) == []
    assert _as_media_list([{"url": "/a.jpg"}, "skip", 3]) == [{"url": "/a.jpg"}]


def test_detect_media_type_explicit_image_video_3d():
    assert detect_media_type(_file("photo.webp", "image/webp")) == "image"
    assert detect_media_type(_file("clip.mp4", "video/mp4")) == "video"
    assert detect_media_type(_file("model.glb", "application/octet-stream")) == "model3d"
    assert detect_media_type(_file("model.gltf", "model/gltf+json")) == "model3d"


def test_file_service_safe_local_path(tmp_path, monkeypatch):
    from app.services import file_service as fs_mod

    monkeypatch.setattr(fs_mod, "_LOCAL_UPLOAD_ROOT", tmp_path)
    service = fs_mod.FileService()
    dest = tmp_path / "websites" / "a.mp4"
    dest.parent.mkdir(parents=True)
    dest.write_bytes(b"x")
    assert service.safe_local_path("websites/a.mp4") == dest.resolve()
    assert service.safe_local_path("../etc/passwd") is None
    assert service.safe_local_path("websites/../../etc/passwd") is None


@pytest.mark.asyncio
async def test_file_service_local_upload_bytes(tmp_path, monkeypatch):
    from app.services import file_service as fs_mod

    monkeypatch.setattr(fs_mod, "_LOCAL_UPLOAD_ROOT", tmp_path)
    service = fs_mod.FileService()
    service._use_s3 = False
    url = await service.upload_bytes(b"\xff\xd8\xff\xdbtest", "products", ".jpg", "image/jpeg")
    assert url.startswith("/uploads/products/")
    assert url.endswith(".jpg")
    written = next(tmp_path.joinpath("products").glob("*.jpg"))
    assert written.read_bytes().startswith(b"\xff\xd8")
