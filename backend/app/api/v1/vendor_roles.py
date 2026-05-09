# app/api/v1/vendor_roles.py
"""Vendor Role Management API - Create and manage custom roles."""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from slugify import slugify

from app.database import get_db
from app.models.vendor_user import VendorUser
from app.models.vendor_role import VendorRole, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS
from app.api.deps import get_current_vendor_user, require_permission
from app.repositories.vendor_role_repo import VendorRoleRepository

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    permissions: List[str] = Field(default=[])


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


# ── Helpers ─────────────────────────────────────────────────────

def _role_to_dict(role: VendorRole) -> dict:
    return {
        "id": str(role.id),
        "vendor_id": str(role.vendor_id),
        "name": role.name,
        "slug": role.slug,
        "description": role.description,
        "permissions": role.permissions or [],
        "is_system": role.is_system,
        "is_active": role.is_active,
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None,
    }


# ── Endpoints ───────────────────────────────────────────────────

@router.get("/permissions")
async def list_all_permissions():
    """List all available permissions that can be assigned to roles."""
    grouped = {}
    for perm in ALL_PERMISSIONS:
        module, action = perm.split(".", 1)
        if module not in grouped:
            grouped[module] = []
        grouped[module].append({"key": perm, "action": action})
    return JSONResponse({"permissions": grouped, "all": ALL_PERMISSIONS})


@router.get("/defaults")
async def list_default_roles():
    """List built-in system role definitions with their permissions."""
    defaults = []
    for role_name, perms in DEFAULT_ROLE_PERMISSIONS.items():
        defaults.append({
            "name": role_name,
            "permissions": perms,
            "is_system": True,
        })
    return JSONResponse({"roles": defaults})


@router.get("")
async def list_roles(
    vu: VendorUser = Depends(require_permission("roles.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all custom roles for this vendor."""
    repo = VendorRoleRepository(db)
    roles = await repo.list_by_vendor(vu.vendor_id, include_inactive=True)
    return JSONResponse({"roles": [_role_to_dict(r) for r in roles]})


@router.post("", status_code=201)
async def create_role(
    data: RoleCreate,
    vu: VendorUser = Depends(require_permission("roles.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new custom role."""
    repo = VendorRoleRepository(db)
    slug = slugify(data.name, lowercase=True)

    # Prevent name collisions with system roles
    if slug in DEFAULT_ROLE_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{data.name}' conflicts with a built-in role name.",
        )

    if await repo.slug_exists(vu.vendor_id, slug):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A role with name '{data.name}' already exists.",
        )

    # Validate permissions
    invalid = [p for p in data.permissions if p not in ALL_PERMISSIONS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions: {', '.join(invalid)}",
        )

    role = VendorRole(
        vendor_id=vu.vendor_id,
        name=data.name,
        slug=slug,
        description=data.description,
        permissions=data.permissions,
        is_system=False,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)

    return JSONResponse(status_code=201, content=_role_to_dict(role))


@router.get("/{role_id}")
async def get_role(
    role_id: UUID,
    vu: VendorUser = Depends(require_permission("roles.view")),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific custom role."""
    repo = VendorRoleRepository(db)
    role = await repo.get_by_vendor_and_id(vu.vendor_id, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return JSONResponse(_role_to_dict(role))


@router.put("/{role_id}")
async def update_role(
    role_id: UUID,
    data: RoleUpdate,
    vu: VendorUser = Depends(require_permission("roles.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Update a custom role. System roles cannot be modified."""
    repo = VendorRoleRepository(db)
    role = await repo.get_by_vendor_and_id(vu.vendor_id, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be modified.")

    if data.name is not None:
        new_slug = slugify(data.name, lowercase=True)
        if new_slug in DEFAULT_ROLE_PERMISSIONS:
            raise HTTPException(status_code=400, detail=f"'{data.name}' conflicts with a built-in role.")
        if await repo.slug_exists(vu.vendor_id, new_slug, exclude_id=role_id):
            raise HTTPException(status_code=400, detail=f"A role named '{data.name}' already exists.")
        role.name = data.name
        role.slug = new_slug

    if data.description is not None:
        role.description = data.description
    if data.permissions is not None:
        invalid = [p for p in data.permissions if p not in ALL_PERMISSIONS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid permissions: {', '.join(invalid)}")
        role.permissions = data.permissions
    if data.is_active is not None:
        role.is_active = data.is_active

    await db.commit()
    await db.refresh(role)
    return JSONResponse(_role_to_dict(role))


@router.delete("/{role_id}")
async def delete_role(
    role_id: UUID,
    vu: VendorUser = Depends(require_permission("roles.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom role. System roles cannot be deleted."""
    repo = VendorRoleRepository(db)
    role = await repo.get_by_vendor_and_id(vu.vendor_id, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted.")

    await db.delete(role)
    await db.commit()
    return JSONResponse({"message": "Role deleted"})
