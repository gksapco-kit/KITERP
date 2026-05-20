"""Persist expense receipt / supporting media — no application-level size cap."""
import uuid
import aiofiles
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"

BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".scr", ".vbs", ".jar", ".com", ".html", ".htm",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic", ".heif", ".tif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"}


async def save_expense_receipt(file: UploadFile, vendor_id: UUID) -> dict:
    """Save one receipt file under uploads/hr/expenses/{vendor_id}/."""
    ext = Path(file.filename or "file").suffix.lower()
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} is not allowed for security reasons.")

    contents = await file.read()

    dest_dir = UPLOAD_DIR / "hr" / "expenses" / str(vendor_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    safe_ext = ext if ext else ".bin"
    filename = f"{uuid.uuid4().hex}{safe_ext}"
    dest_path = dest_dir / filename

    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(contents)

    file_url = f"/uploads/hr/expenses/{vendor_id}/{filename}"
    ct = (file.content_type or "").lower()
    is_image = ct.startswith("image/") or ext in IMAGE_EXTENSIONS
    is_video = ct.startswith("video/") or ext in VIDEO_EXTENSIONS

    return {
        "url": file_url,
        "name": file.filename or filename,
        "content_type": file.content_type,
        "is_image": is_image,
        "is_video": is_video,
        "size": len(contents),
    }
