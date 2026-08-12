# app/api/deps.py
from typing import Optional, Tuple, List
from uuid import UUID
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.vendor_user import VendorUser
from app.core.security import decode_token
from app.repositories.user_repo import UserRepository
from app.repositories.customer_repo import CustomerRepository
from app.repositories.vendor_user_repo import VendorUserRepository
from app.middleware.tenant import get_current_vendor_id as get_tenant_vendor_id
from app.models.vendor_role import DEFAULT_ROLE_PERMISSIONS
from app.utils.vendor_storefront import vendor_live_on_storefront

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    try:
        uid = UUID(str(user_id))
    except (ValueError, TypeError):
        return None

    repo = UserRepository(db)
    return await repo.get_by_id(uid)


async def get_current_active_user(
    current_user: Optional[User] = Depends(get_current_user),
) -> User:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
        )

    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user


async def get_current_platform_staff(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Superuser or platform support — can use vendor directory / read-only admin tasks."""
    from app.utils.platform_staff import has_platform_staff_access

    if not has_platform_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform access required",
        )
    return current_user


# ── Vendor Role Dependencies ─────────────────────────────────────


def preferred_vendor_id_from_request(request: Request) -> Optional[UUID]:
    raw = request.headers.get("x-vendor-id")
    if not raw or not str(raw).strip():
        return None
    try:
        return UUID(str(raw).strip())
    except (ValueError, TypeError):
        return None


async def get_current_vendor_user(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> VendorUser:
    """Vendor membership for dashboard APIs; respects ``X-Vendor-Id`` when the user has multiple tenants."""
    repo = VendorUserRepository(db)
    pref = preferred_vendor_id_from_request(request)
    if pref is not None:
        vu = await repo.get_user_with_role(pref, current_user.id)
        if vu:
            return vu

    vu = await repo.get_by_user_id(current_user.id)
    if vu:
        return vu

    from app.repositories.vendor_repo import VendorRepository

    vendor_repo = VendorRepository(db)
    vendor = await vendor_repo.get_by_user_id(current_user.id, preferred_vendor_id=pref)
    if vendor:
        vu = VendorUser(
            vendor_id=vendor.id,
            user_id=current_user.id,
            role="owner",
            permissions=[],
            is_active=True,
        )
        db.add(vu)
        await db.commit()
        await db.refresh(vu)
        return vu

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not a member of any vendor.",
    )


async def resolve_dashboard_vendor(
    db: AsyncSession,
    current_user: User,
    preferred_vendor_id: Optional[UUID] = None,
):
    """Resolve vendor for vendor-dashboard APIs (membership, then platform staff + X-Vendor-Id)."""
    from app.models.vendor import Vendor
    from app.services.vendor_service import VendorService
    from app.utils.platform_staff import has_platform_staff_access
    from app.utils.platform_vendor_access import ensure_vendor_visible_to_platform_staff

    service = VendorService(db)
    vendor = await service.get_by_user_id(current_user.id, preferred_vendor_id=preferred_vendor_id)
    if vendor:
        return vendor

    if preferred_vendor_id is not None and has_platform_staff_access(current_user):
        vendor = await service.get_by_id(preferred_vendor_id)
        if vendor:
            await ensure_vendor_visible_to_platform_staff(current_user, vendor, db)
            return vendor

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No vendor found for this user",
    )


async def get_current_vendor_id(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """Resolve vendor UUID for ``/vendors/me/*`` routers (owner or team; prefers ``X-Vendor-Id``)."""
    pref = preferred_vendor_id_from_request(request)
    vendor = await resolve_dashboard_vendor(db, current_user, preferred_vendor_id=pref)
    return vendor.id


def normalized_vendor_role(vendor_user: VendorUser) -> str:
    """ORM `role` should never be NULL; normalize legacy/bad rows so API handlers don't 500."""
    r = vendor_user.role
    if r is None or not str(r).strip():
        return "staff"
    return str(r).strip()


def vendor_member_role_display_name(vendor_user: VendorUser) -> str:
    """Human-readable role label for vendor_user payloads (safe if role is missing)."""
    role = normalized_vendor_role(vendor_user)
    if role == "platform_staff":
        return "Platform support"
    if role == "custom":
        cr = getattr(vendor_user, "custom_role", None)
        if cr is not None and getattr(cr, "name", None):
            return str(cr.name)
        return "Custom"
    return role.capitalize()


def get_effective_permissions(vendor_user: VendorUser) -> List[str]:
    """Compute the effective permissions for a vendor user.

    Custom-role base permissions are resolved only when the role is active.
    An inactive custom role falls back to the 'staff' baseline so access is
    revoked without needing to touch the individual membership row.
    Per-user additive overrides in vendor_user.permissions are always applied
    on top of the base set.
    """
    role = normalized_vendor_role(vendor_user)

    # System role permissions
    if role in DEFAULT_ROLE_PERMISSIONS:
        base_perms = set(DEFAULT_ROLE_PERMISSIONS[role])
    elif role == "custom" and vendor_user.custom_role:
        custom_role = vendor_user.custom_role
        if getattr(custom_role, "is_active", True):
            base_perms = set(custom_role.permissions or [])
        else:
            # Deactivated custom role → minimal safe fallback
            base_perms = set(DEFAULT_ROLE_PERMISSIONS.get("staff", []))
    else:
        base_perms = set(DEFAULT_ROLE_PERMISSIONS.get("staff", []))

    # Merge any per-user additive override permissions
    if vendor_user.permissions:
        base_perms.update(vendor_user.permissions)

    return list(base_perms)


def require_permission(*permissions: str):
    """
    Dependency factory: ensures the current vendor user has ALL of the listed permissions.
    Usage: Depends(require_permission("products.create", "products.edit"))
    """
    async def _check(
        vendor_user: VendorUser = Depends(get_current_vendor_user),
    ) -> VendorUser:
        effective = get_effective_permissions(vendor_user)
        missing = [p for p in permissions if p not in effective]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(missing)}",
            )
        return vendor_user
    return _check


def require_any_permission(*permissions: str):
    """
    Dependency factory: ensures the current vendor user has AT LEAST ONE of
    the listed permissions.  Use for endpoints accessible by multiple roles.
    Usage: Depends(require_any_permission("finance.edit", "projects.costing.post"))
    """
    async def _check(
        vendor_user: VendorUser = Depends(get_current_vendor_user),
    ) -> VendorUser:
        effective = get_effective_permissions(vendor_user)
        if not any(p in effective for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(permissions)}",
            )
        return vendor_user
    return _check


def require_store_hr_permission(*permissions: str):
    """ESS portal: same permission check as vendor central, using store HR JWT session."""

    async def _check(
        vendor_user: VendorUser = Depends(get_current_store_hr_vendor_user),
    ) -> VendorUser:
        effective = get_effective_permissions(vendor_user)
        missing = [p for p in permissions if p not in effective]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(missing)}",
            )
        return vendor_user

    return _check


def require_role(*roles: str):
    """
    Dependency factory: ensures the current vendor user has one of the listed roles.
    Usage: Depends(require_role("owner", "admin"))
    """
    async def _check(
        vendor_user: VendorUser = Depends(get_current_vendor_user),
    ) -> VendorUser:
        if normalized_vendor_role(vendor_user) not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of: {', '.join(roles)}",
            )
        return vendor_user
    return _check


# ── Customer dependencies (business front) ──────────────────────────

async def get_store_vendor_id(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """
    Resolve vendor ID from multiple sources (SaaS model):
    1. Tenant middleware (subdomain / custom domain)
    2. X-Vendor-Slug header — matches URL /store/{slug}/…; wins over stale X-Vendor-Id from localStorage
    3. X-Vendor-Id header (mobile apps and callers that only have UUID)
    """
    # 1. From tenant middleware (subdomain resolution)
    vendor_id = get_tenant_vendor_id(request)
    if vendor_id:
        return UUID(vendor_id)

    # 2. Slug before ID: path-based business front sends both headers; a leftover X-Vendor-Id from another
    #    tab/store must not override the slug the user opened (fixes HR login “no employee profile”).
    vendor_slug = request.headers.get("x-vendor-slug")
    if vendor_slug:
        from app.repositories.vendor_repo import VendorRepository
        repo = VendorRepository(db)
        vendor = await repo.find_by_slug(vendor_slug.strip())
        if vendor and vendor_live_on_storefront(vendor.status):
            return vendor.id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor '{vendor_slug}' not found or not active.",
        )

    header_id = request.headers.get("x-vendor-id")
    if header_id:
        return UUID(header_id)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Vendor context not found. Use subdomain, X-Vendor-Id, or X-Vendor-Slug header.",
    )


async def get_store_hr_vendor_id(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """
    Vendor scope for business front employee HR (login + authenticated /store/hr/*).
    Slug before X-Vendor-Id (see get_store_vendor_id). Slug lookup does **not** require
    business front-live status — otherwise login succeeds but GET /store/hr/me fails and the UI
    bounces back to an empty login form.
    """
    vendor_id = get_tenant_vendor_id(request)
    if vendor_id:
        return UUID(vendor_id)

    vendor_slug = request.headers.get("x-vendor-slug")
    if vendor_slug:
        from app.repositories.vendor_repo import VendorRepository

        repo = VendorRepository(db)
        vendor = await repo.find_by_slug_ci(vendor_slug.strip())
        if vendor:
            return vendor.id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No vendor found for slug '{vendor_slug}'.",
        )

    header_id = request.headers.get("x-vendor-id")
    if header_id:
        return UUID(header_id)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Vendor context not found. Use subdomain, X-Vendor-Id, or X-Vendor-Slug header.",
    )


async def get_current_store_hr_vendor_user(
    ctx_vendor_id: UUID = Depends(get_store_hr_vendor_id),
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> VendorUser:
    """
    VendorUser for business front employee HR (JWT from POST /store/hr/login).
    Not a customer session — uses role store_hr_employee and vendor_user_id in the token.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("role") != "store_hr_employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not an employee HR session",
        )
    vendor_user_id = payload.get("vendor_user_id")
    vid = payload.get("vendor_id")
    if not vendor_user_id or not vid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    if UUID(str(vid)) != ctx_vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token does not match this store",
        )
    repo = VendorUserRepository(db)
    vu = await repo.get_with_details(UUID(str(vendor_user_id)))
    if not vu or not vu.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Employee access inactive")
    if vu.vendor_id != ctx_vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vendor mismatch")
    return vu


async def resolve_storefront_store_id(
    request: Request,
    vendor_id: UUID,
    db: AsyncSession,
) -> Optional[UUID]:
    """
    Resolve the active business unit for storefront customer auth.

    Call this directly from async code (no FastAPI Depends). For route
    injection use get_storefront_store_id instead.

    Sources (first match wins):
    1. X-Store-Id header (UUID)
    2. X-Branch header (store code or UUID)
    3. ?branch= / ?store_id= query params
    """
    from app.services.catalog_store_scope import resolve_store_id

    header_store = (request.headers.get("x-store-id") or "").strip() or None
    header_branch = (request.headers.get("x-branch") or "").strip() or None
    query_store = (request.query_params.get("store_id") or "").strip() or None
    query_branch = (request.query_params.get("branch") or "").strip() or None

    return await resolve_store_id(
        db,
        vendor_id,
        store_id=header_store or query_store,
        branch=header_branch or query_branch,
    )


async def get_storefront_store_id(
    request: Request,
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
) -> Optional[UUID]:
    """FastAPI dependency wrapper around resolve_storefront_store_id."""
    return await resolve_storefront_store_id(request, vendor_id, db)


async def get_current_customer(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[Customer]:
    if not token:
        return None

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None

    if payload.get("role") != "customer":
        return None

    customer_id = payload.get("sub")
    vendor_id = payload.get("vendor_id")
    if not customer_id or not vendor_id:
        return None

    # Reject tokens issued for a different vendor than the current storefront.
    try:
        ctx_vendor_id = await get_store_vendor_id(request, db)
    except HTTPException:
        return None
    if UUID(str(vendor_id)) != ctx_vendor_id:
        return None

    repo = CustomerRepository(db)
    customer = await repo.get_by_vendor_and_id(UUID(vendor_id), UUID(customer_id))
    if not customer:
        return None

    # Reject only when the request supplies a BU *and* it differs from the customer's BU.
    # A missing X-Store-Id / X-Branch (browser before branches load) must not 401.
    try:
        ctx_store_id = await resolve_storefront_store_id(request, ctx_vendor_id, db)
    except HTTPException:
        ctx_store_id = None
    token_store = payload.get("store_id")
    token_store_id = UUID(str(token_store)) if token_store else None
    customer_store_id = customer.store_id
    # Both sides must declare a BU for a mismatch to be meaningful.
    if ctx_store_id is not None and customer_store_id is not None and ctx_store_id != customer_store_id:
        return None
    if token_store_id is not None and customer_store_id is not None and token_store_id != customer_store_id:
        return None

    return customer


async def get_current_active_customer(
    customer: Optional[Customer] = Depends(get_current_customer),
) -> Customer:
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled",
        )
    return customer
