# app/middleware/tenant.py
from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.requests import Request
from typing import Optional
import json
from app.config import settings
from app.database import redis_client, AsyncSessionLocal


RESERVED_SUBDOMAINS = {
    "www", "api", "admin", "app", "mail",
    "ftp", "cdn", "static", "assets", "docs",
}


class TenantMiddleware:
    """Pure ASGI middleware — does not use BaseHTTPMiddleware, so it won't
    interfere with CORSMiddleware or streaming responses."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        host = request.headers.get("host", "")
        subdomain = _extract_subdomain(host)
        custom_domain = _extract_custom_domain(host)

        vendor = None
        vendor_id = None

        if subdomain and subdomain.lower() not in RESERVED_SUBDOMAINS:
            try:
                resolved = await _resolve_tenant(subdomain, None)
                if resolved and resolved.get("status") == "approved":
                    vendor = resolved
                    vendor_id = resolved.get("id")
            except Exception:
                pass
        elif custom_domain:
            try:
                resolved = await _resolve_tenant(None, custom_domain)
                if resolved and resolved.get("status") == "approved":
                    vendor = resolved
                    vendor_id = resolved.get("id")
            except Exception:
                pass

        scope.setdefault("state", {})
        scope["state"]["vendor"] = vendor
        scope["state"]["vendor_id"] = vendor_id

        await self.app(scope, receive, send)


def _extract_subdomain(host: str) -> Optional[str]:
    host_without_port = host.split(":")[0]
    base_domain = settings.BASE_DOMAIN
    if host_without_port.endswith(base_domain):
        parts = host_without_port.replace(f".{base_domain}", "").split(".")
        if parts and parts[0]:
            return parts[0]
    return None


_LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "[::1]", "::1"})


def _extract_custom_domain(host: str) -> Optional[str]:
    host_without_port = host.split(":")[0].lower()
    # Path-based /:slug on loopback must not resolve a single custom-domain tenant
    # for every tab (that collapses nursery + sweet-mohona into one vendor).
    if host_without_port in _LOOPBACK_HOSTS:
        return None
    base_domain = settings.BASE_DOMAIN
    if not host_without_port.endswith(base_domain):
        return host_without_port
    return None


async def _resolve_tenant(
    subdomain: Optional[str], custom_domain: Optional[str]
) -> Optional[dict]:
    cache_key = f"tenant:{subdomain or custom_domain}"

    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    try:
        from app.repositories.vendor_repo import VendorRepository

        async with AsyncSessionLocal() as session:
            repo = VendorRepository(session)
            vendor = await repo.find_by_subdomain_or_domain(subdomain, custom_domain)

            if vendor:
                vendor_dict = {
                    "id": str(vendor.id),
                    "slug": vendor.slug,
                    "subdomain": vendor.subdomain,
                    "status": vendor.status,
                    "settings": vendor.settings,
                }

                if redis_client:
                    try:
                        await redis_client.set(
                            cache_key, json.dumps(vendor_dict), ex=300
                        )
                    except Exception:
                        pass

                return vendor_dict
    except Exception:
        pass

    return None


def get_current_vendor(request: Request) -> Optional[dict]:
    return getattr(request.state, "vendor", None)


def get_current_vendor_id(request: Request) -> Optional[str]:
    return getattr(request.state, "vendor_id", None)
