"""Shared handling when OTP delivery fails — dev_hint before provider 503 errors."""
from __future__ import annotations

import logging
import re

from fastapi import HTTPException

from app.config import settings
from app.services.phone_otp_service import OtpDispatch, OtpSendResult, generate_otp_code

logger = logging.getLogger(__name__)


def _mask_destination(destination: str, channel: str) -> str:
    if channel == "email":
        return re.sub(r"(^.).+(@.+$)", r"\1***\2", destination or "")
    d = destination or ""
    return d[-4:].rjust(len(d), "*") if len(d) > 4 else "****"


def otp_send_extra_fields(
    result: OtpSendResult,
    *,
    code: str,
    log_tag: str,
    destination: str,
    channel: str,
    configured: bool,
    not_configured_detail: str,
    send_error_fallback: str,
) -> dict:
    """Return ``dev_hint`` in DEBUG when send failed; otherwise raise 503."""
    if result.sent:
        return {}
    if settings.DEBUG:
        logger.info(
            "[%s] channel=%s dest=%s code=%s",
            log_tag,
            channel,
            _mask_destination(destination, channel),
            code,
        )
        return {"dev_hint": code}
    if configured:
        detail = result.user_message(fallback=send_error_fallback)
        raise HTTPException(status_code=503, detail=detail)
    raise HTTPException(status_code=503, detail=not_configured_detail)


def resolve_failed_otp_code(
    dispatch: OtpDispatch,
    *,
    configured: bool,
    send_error_fallback: str,
    not_configured_detail: str,
) -> str:
    """
    When outbound OTP failed, return a code for DEBUG persistence or raise 503.
    Used by endpoints that store the code on a model before responding.
    """
    if dispatch.result.sent:
        raise ValueError("resolve_failed_otp_code called when send succeeded")
    code = dispatch.stored_code or generate_otp_code()
    if settings.DEBUG:
        return code
    if configured:
        detail = dispatch.result.user_message(fallback=send_error_fallback)
        raise HTTPException(status_code=503, detail=detail)
    raise HTTPException(status_code=503, detail=not_configured_detail)
