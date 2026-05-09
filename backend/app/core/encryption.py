"""
Field-level encryption helper for CRM PII (provider credentials, contact PII, etc).

Uses Fernet symmetric encryption keyed by CRM_ENCRYPTION_KEY env var. If the env
var is missing we derive a deterministic (but warned-about) key from JWT_SECRET_KEY
so dev environments work out of the box. Production should always set
CRM_ENCRYPTION_KEY explicitly.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

_fernet = None


def _get_key() -> bytes:
    explicit = os.getenv("CRM_ENCRYPTION_KEY", "").strip()
    if explicit:
        if len(explicit) == 44:  # already a valid Fernet base64 key
            return explicit.encode()
        # Allow any string by hashing it into a 32-byte key
        digest = hashlib.sha256(explicit.encode()).digest()
        return base64.urlsafe_b64encode(digest)

    # Fallback: derive from JWT secret. Logged once so operators notice.
    from app.config import settings
    seed = (settings.JWT_SECRET_KEY or "kiterp-dev-key").encode()
    digest = hashlib.sha256(seed + b"::crm-encryption").digest()
    logger.warning(
        "CRM_ENCRYPTION_KEY not set; using derived key for development. "
        "Set CRM_ENCRYPTION_KEY in production environments."
    )
    return base64.urlsafe_b64encode(digest)


def _get_fernet():
    global _fernet
    if _fernet is None:
        try:
            from cryptography.fernet import Fernet
        except ImportError as e:
            raise RuntimeError(
                "cryptography package is required for CRM encryption helpers"
            ) from e
        _fernet = Fernet(_get_key())
    return _fernet


def encrypt_str(plain: Optional[str]) -> Optional[str]:
    if plain is None or plain == "":
        return None
    f = _get_fernet()
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_str(ciphertext: Optional[str]) -> Optional[str]:
    if not ciphertext:
        return None
    try:
        f = _get_fernet()
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.error("Failed to decrypt CRM field: %s", e)
        return None


def encrypt_json(data: Optional[dict[str, Any]]) -> Optional[str]:
    if data is None:
        return None
    return encrypt_str(json.dumps(data, separators=(",", ":")))


def decrypt_json(ciphertext: Optional[str]) -> Optional[dict[str, Any]]:
    s = decrypt_str(ciphertext)
    if not s:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return None


def mask(value: Optional[str], visible: int = 4) -> str:
    """Return a masked version of an email/phone/credential for UI display."""
    if not value:
        return ""
    if len(value) <= visible:
        return "*" * len(value)
    return ("*" * (len(value) - visible)) + value[-visible:]
