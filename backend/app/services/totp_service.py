"""TOTP two-factor authentication helpers."""
from __future__ import annotations

import base64
import secrets

try:
    import pyotp
except ImportError:
    pyotp = None  # type: ignore


def generate_totp_secret() -> str:
    if pyotp is None:
        raise RuntimeError("pyotp is not installed")
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str, issuer: str = "KIT ERP") -> str:
    if pyotp is None:
        raise RuntimeError("pyotp is not installed")
    return pyotp.TOTP(secret).provisioning_uri(name=email or "user", issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    if pyotp is None or not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(str(code).strip(), valid_window=1)
