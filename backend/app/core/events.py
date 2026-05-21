# app/core/events.py
from typing import Callable, Dict, List, Any
import asyncio
import logging

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


# Register default event handlers
async def on_vendor_registered(data: dict):
    """Handle vendor registration event."""
    logger.info(f"Vendor registered: {data.get('vendor_id')}")
    # TODO: Send welcome email, notify admin, etc.


async def on_vendor_approved(data: dict):
    """Handle vendor approval event."""
    logger.info(f"Vendor approved: {data.get('vendor_id')}")
    # TODO: Send approval email, activate business front, etc.


async def on_vendor_rejected(data: dict):
    """Handle vendor rejection event."""
    logger.info(f"Vendor rejected: {data.get('vendor_id')}")
    # TODO: Send rejection email with reason


async def on_vendor_submitted_for_review(data: dict):
    """Handle vendor submission for review."""
    logger.info(f"Vendor submitted for review: {data.get('vendor_id')}")
    # TODO: Notify admin


# Register handlers
event_emitter.on("vendor.registered", on_vendor_registered)
event_emitter.on("vendor.approved", on_vendor_approved)
event_emitter.on("vendor.rejected", on_vendor_rejected)
event_emitter.on("vendor.submitted_for_review", on_vendor_submitted_for_review)
