"""Normalize and match custom / external domain hostnames."""
from __future__ import annotations

from typing import List, Optional, Set


def normalize_hostname(raw: Optional[str]) -> str:
    """Strip scheme, path, port, trailing dot; lowercase."""
    if not raw:
        return ""
    host = raw.strip().lower()
    host = host.replace("https://", "").replace("http://", "")
    host = host.split("/")[0]
    host = host.split(":")[0]
    return host.rstrip(".")


def strip_www(host: str) -> str:
    h = normalize_hostname(host)
    return h[4:] if h.startswith("www.") else h


def host_lookup_candidates(raw: Optional[str]) -> List[str]:
    """Apex + www variants for DNS / DB matching."""
    host = normalize_hostname(raw)
    if not host:
        return []
    apex = strip_www(host)
    out: List[str] = []
    seen: Set[str] = set()
    for candidate in (host, apex, f"www.{apex}"):
        if candidate and candidate not in seen:
            seen.add(candidate)
            out.append(candidate)
    return out


def is_platform_hostname(host: str, base_domain: str) -> bool:
    """True for the marketing site and *.base_domain vendor subdomains."""
    h = normalize_hostname(host)
    base = (base_domain or "kiterp.com").strip().lower().rstrip(".")
    if not h:
        return True
    if h in {"localhost", "127.0.0.1", "[::1]", "::1"}:
        return True
    if h == base or h == f"www.{base}":
        return True
    if h.endswith(f".{base}"):
        return True
    return False


def sync_vendor_custom_domain_from_external(vendor) -> bool:
    """
    Keep Vendor.custom_domain / domain_verified in sync with external_domain_*.

    Returns True when fields changed.
    """
    status = (getattr(vendor, "external_domain_access_status", None) or "").strip().lower()
    name = strip_www(getattr(vendor, "external_domain_name", None) or "")
    changed = False

    if status == "active" and name:
        if getattr(vendor, "custom_domain", None) != name:
            vendor.custom_domain = name
            changed = True
        if not getattr(vendor, "domain_verified", False):
            vendor.domain_verified = True
            changed = True
        return changed

    current = strip_www(getattr(vendor, "custom_domain", None) or "")
    if status in {"revoked", "not_requested"} and current and (not name or current == name):
        if vendor.custom_domain is not None:
            vendor.custom_domain = None
            changed = True
        if getattr(vendor, "domain_verified", False):
            vendor.domain_verified = False
            changed = True
    return changed
