# app/core/__init__.py
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
    get_password_hash,
    decode_token,
)
# Legacy colon-format Permission enum kept for import compatibility only.
# All active RBAC uses vendor_role.ALL_PERMISSIONS (dot-format) via deps.require_permission.
from app.core.permissions import Permission, has_permission  # noqa: F401
from app.core.exceptions import (
    AppException,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
)
from app.core.events import event_emitter

__all__ = [
    "create_access_token",
    "create_refresh_token",
    "verify_password",
    "get_password_hash",
    "decode_token",
    "Permission",
    "has_permission",
    "AppException",
    "NotFoundException",
    "BadRequestException",
    "UnauthorizedException",
    "ForbiddenException",
    "event_emitter",
]
