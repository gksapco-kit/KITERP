# app/services/file_service.py
"""File upload and deletion — AWS S3 when configured, local disk otherwise."""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import aiofiles
from fastapi import UploadFile

from app.config import settings

logger = logging.getLogger(__name__)

_LOCAL_UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"


class FileService:
    """Upload and manage files on S3 (production) or local ``uploads/`` (dev)."""

    def __init__(self):
        self.bucket = (settings.AWS_S3_BUCKET or "").strip()
        self.region = (settings.AWS_REGION or "ap-south-1").strip()
        self.cloudfront_url = (settings.AWS_CLOUDFRONT_URL or "").strip().rstrip("/")
        self._use_s3 = bool(
            (settings.AWS_ACCESS_KEY_ID or "").strip()
            and (settings.AWS_SECRET_ACCESS_KEY or "").strip()
            and self.bucket
        )

    def _build_key(self, folder: str, filename: str) -> str:
        folder = folder.strip("/")
        return f"{folder}/{filename}" if folder else filename

    def _public_url(self, key: str) -> str:
        key = key.lstrip("/")
        if self._use_s3:
            if self.cloudfront_url:
                return f"{self.cloudfront_url}/{key}"
            return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{key}"
        return f"/uploads/{key}"

    def url_to_key(self, file_url: str) -> Optional[str]:
        """Resolve a stored URL back to an object key (S3 key or local uploads path)."""
        if not file_url:
            return None
        url = file_url.strip()
        if url.startswith("/uploads/"):
            return url[len("/uploads/") :]
        parsed = urlparse(url)
        path = parsed.path.lstrip("/")
        if not path:
            return None
        if self.cloudfront_url and url.startswith(self.cloudfront_url):
            return path
        if self.bucket and f"{self.bucket}.s3." in parsed.netloc:
            return path
        if parsed.netloc.endswith("amazonaws.com") and self.bucket in parsed.netloc:
            return path
        # Bare key passed directly
        if "://" not in url and ".." not in url:
            return url.lstrip("/")
        return path if path else None

    async def upload_file(
        self,
        file: UploadFile,
        folder: str = "",
        *,
        content: Optional[bytes] = None,
    ) -> str:
        """Upload a file and return its public URL."""
        ext = os.path.splitext(file.filename)[1] if file.filename else ""
        return await self.upload_bytes(
            content if content is not None else await file.read(),
            folder,
            ext,
            file.content_type or "application/octet-stream",
        )

    async def upload_bytes(
        self,
        body: bytes,
        folder: str,
        ext: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload raw bytes and return the public URL."""
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        key = self._build_key(folder, unique_filename)
        if self._use_s3:
            await self._s3_put(key, body, content_type)
        else:
            await self._local_put(key, body)
        return self._public_url(key)

    async def read_bytes(self, file_url: str) -> Optional[bytes]:
        """Load file contents from S3 or local uploads. Returns None if missing."""
        key = self.url_to_key(file_url)
        if not key:
            return None
        try:
            if self._use_s3:
                return await self._s3_get(key)
            path = _LOCAL_UPLOAD_ROOT / key
            if not path.is_file():
                return None
            async with aiofiles.open(path, "rb") as f:
                return await f.read()
        except Exception:
            logger.exception("Failed to read file %s", key)
            return None

    async def delete_file(self, file_url: str) -> bool:
        """Delete a file from storage. Returns True if deleted or already absent."""
        key = self.url_to_key(file_url)
        if not key:
            logger.warning("Could not resolve storage key from URL: %s", file_url)
            return False
        try:
            if self._use_s3:
                return await self._s3_delete(key)
            return self._local_delete(key)
        except Exception:
            logger.exception("Failed to delete file %s", key)
            return False

    def get_signed_url(self, file_path: str, expires_in: int = 3600) -> str:
        """Return a pre-signed URL (S3) or the public/local URL."""
        key = self.url_to_key(file_path) or file_path.lstrip("/")
        if not self._use_s3:
            return self._public_url(key)
        try:
            import boto3
            from botocore.config import Config

            client = boto3.client(
                "s3",
                region_name=self.region,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
            )
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        except Exception:
            logger.exception("Failed to generate presigned URL for %s", key)
            return self._public_url(key)

    async def _s3_get(self, key: str) -> Optional[bytes]:
        import aioboto3

        session = aioboto3.Session()
        async with session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        ) as s3:
            try:
                resp = await s3.get_object(Bucket=self.bucket, Key=key)
                return await resp["Body"].read()
            except Exception:
                logger.exception("S3 get failed: s3://%s/%s", self.bucket, key)
                return None

    async def _s3_put(self, key: str, body: bytes, content_type: str) -> None:
        import aioboto3

        session = aioboto3.Session()
        async with session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        ) as s3:
            await s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
            )
        logger.info("S3 upload: s3://%s/%s (%d bytes)", self.bucket, key, len(body))

    async def _s3_delete(self, key: str) -> bool:
        import aioboto3

        session = aioboto3.Session()
        async with session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        ) as s3:
            await s3.delete_object(Bucket=self.bucket, Key=key)
        logger.info("S3 delete: s3://%s/%s", self.bucket, key)
        return True

    async def _local_put(self, key: str, body: bytes) -> None:
        dest = _LOCAL_UPLOAD_ROOT / key
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(dest, "wb") as f:
                await f.write(body)
        except PermissionError as exc:
            logger.error(
                "Local upload failed (permission denied): %s. "
                "Ensure /app/uploads is writable by the app user, or configure "
                "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET for S3 uploads.",
                dest,
            )
            raise PermissionError(
                f"Upload directory not writable: {dest.parent}. "
                "Contact your administrator or configure S3 storage."
            ) from exc
        logger.debug("Local upload: %s (%d bytes)", dest, len(body))

    def _local_delete(self, key: str) -> bool:
        dest = _LOCAL_UPLOAD_ROOT / key
        if dest.exists():
            dest.unlink()
            logger.debug("Local delete: %s", dest)
            return True
        return False
