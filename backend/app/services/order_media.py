"""Save image/video files for order cancellation and return/exchange evidence."""
import uuid
import aiofiles
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile, status

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"

ORDER_MEDIA_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ORDER_MEDIA_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 25 * 1024 * 1024


async def save_order_media_file(
    file: UploadFile,
    vendor_id: UUID,
    order_id: UUID,
) -> dict:
    """
    Persist a single file under uploads/order-media/{vendor_id}/{order_id}/.
    Returns {"url": "/uploads/...", "kind": "image"|"video"}.
    """
    ct = file.content_type or ""
    if ct in ORDER_MEDIA_IMAGE_TYPES:
        kind = "image"
        max_bytes = MAX_IMAGE_BYTES
    elif ct in ORDER_MEDIA_VIDEO_TYPES:
        kind = "video"
        max_bytes = MAX_VIDEO_BYTES
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allowed: JPEG, PNG, WebP, GIF, MP4, WebM, QuickTime.",
        )

    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max {max_bytes // (1024 * 1024)} MB for {kind}s.",
        )

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else (
        "jpg" if kind == "image" else "mp4"
    )
    filename = f"{uuid.uuid4().hex}.{ext}"
    sub = f"order-media/{vendor_id}/{order_id}"
    folder = UPLOAD_DIR / sub
    folder.mkdir(parents=True, exist_ok=True)
    filepath = folder / filename
    async with aiofiles.open(str(filepath), "wb") as f:
        await f.write(contents)

    url = f"/uploads/{sub}/{filename}"
    return {"url": url, "kind": kind}
