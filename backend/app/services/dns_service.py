"""DNS TXT verification for custom domains."""
from __future__ import annotations

import asyncio
import logging

log = logging.getLogger(__name__)


async def verify_txt_record(hostname: str, expected_value: str) -> bool:
    """Return True if any TXT record on hostname contains expected_value."""
    if not hostname or not expected_value:
        return False

    def _lookup() -> bool:
        try:
            import dns.resolver
        except ImportError:
            log.warning("dnspython not installed — DNS verification unavailable")
            return False
        try:
            answers = dns.resolver.resolve(hostname, "TXT")
            for rdata in answers:
                for chunk in rdata.strings:
                    text = chunk.decode("utf-8", errors="ignore").strip().strip('"')
                    if text == expected_value or expected_value in text:
                        return True
            return False
        except Exception as exc:
            log.info("DNS TXT lookup failed for %s: %s", hostname, exc)
            return False

    return await asyncio.to_thread(_lookup)
