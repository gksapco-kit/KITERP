# app/core/events.py
from typing import Callable, Dict, List, Any
from uuid import UUID
import asyncio
import logging

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.vendor import Vendor

logger = logging.getLogger(__name__)


class EventEmitter:
    """Simple event emitter for application events."""

    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}

    def on(self, event: str, handler: Callable):
        """Register an event handler."""
        if event not in self._handlers:
            self._handlers[event] = []
        self._handlers[event].append(handler)

    def off(self, event: str, handler: Callable):
        """Remove an event handler."""
        if event in self._handlers:
            self._handlers[event].remove(handler)

    async def emit(self, event: str, data: Any = None):
        """Emit an event asynchronously."""
        if event not in self._handlers:
            return

        for handler in self._handlers[event]:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(data)
                else:
                    handler(data)
            except Exception as e:
                logger.error(f"Error in event handler for '{event}': {e}")


# Global event emitter instance
event_emitter = EventEmitter()


async def _load_vendor(vendor_id: str) -> Vendor | None:
    try:
        vid = UUID(vendor_id)
    except ValueError:
        logger.warning("Invalid vendor_id in event payload: %s", vendor_id)
        return None
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Vendor).where(Vendor.id == vid))
        return result.scalar_one_or_none()


# Register default event handlers
async def on_vendor_registered(data: dict):
    """Handle vendor registration event."""
    vendor_id = data.get("vendor_id")
    logger.info("Vendor registered: %s", vendor_id)
    vendor = await _load_vendor(vendor_id)
    if not vendor or not vendor.primary_email:
        return
    # Auto-approved vendors get the approval email immediately after; avoid duplicate welcome.
    if vendor.status == "approved":
        return
    try:
        from app.services.vendor_lifecycle_emails import send_vendor_welcome_email
        await send_vendor_welcome_email(vendor)
    except Exception:
        logger.exception("Failed to send welcome email for vendor %s", vendor_id)


async def on_vendor_approved(data: dict):
    """Handle vendor approval event."""
    vendor_id = data.get("vendor_id")
    logger.info("Vendor approved: %s", vendor_id)
    vendor = await _load_vendor(vendor_id)
    if not vendor or not vendor.primary_email:
        return
    try:
        from app.services.vendor_lifecycle_emails import send_vendor_approved_email
        await send_vendor_approved_email(vendor)
    except Exception:
        logger.exception("Failed to send approval email for vendor %s", vendor_id)


async def on_vendor_rejected(data: dict):
    """Handle vendor rejection event."""
    vendor_id = data.get("vendor_id")
    reason = data.get("reason")
    logger.info("Vendor rejected: %s", vendor_id)
    vendor = await _load_vendor(vendor_id)
    if not vendor or not vendor.primary_email:
        return
    try:
        from app.services.vendor_lifecycle_emails import send_vendor_rejected_email
        await send_vendor_rejected_email(vendor, reason=reason)
    except Exception:
        logger.exception("Failed to send rejection email for vendor %s", vendor_id)


async def on_vendor_submitted_for_review(data: dict):
    """Handle vendor submission for review."""
    vendor_id = data.get("vendor_id")
    logger.info("Vendor submitted for review: %s", vendor_id)
    try:
        vid = UUID(vendor_id)
    except (ValueError, TypeError):
        return
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Vendor).where(Vendor.id == vid))
        vendor = result.scalar_one_or_none()
        if not vendor:
            return
        from app.services.vendor_lifecycle_emails import (
            send_vendor_submitted_vendor_email,
            send_vendor_submitted_admin_email,
        )
        if vendor.primary_email:
            await send_vendor_submitted_vendor_email(vendor)
        await send_vendor_submitted_admin_email(db, vendor)


# Register handlers
event_emitter.on("vendor.registered", on_vendor_registered)
event_emitter.on("vendor.approved", on_vendor_approved)
event_emitter.on("vendor.rejected", on_vendor_rejected)
event_emitter.on("vendor.submitted_for_review", on_vendor_submitted_for_review)
