# app/api/v1/vendor_roles.py
"""Vendor Role Management API - Create and manage custom roles."""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
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
    # Optionally seed permissions from a built-in role template
    copy_from_builtin: Optional[str] = Field(None, description="Built-in role slug to copy permissions from")


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class UserPermissionOverride(BaseModel):
    """Per-user additive permission overrides stored on vendor_user.permissions."""
    grant: List[str] = Field(default=[], description="Extra permissions to add on top of the role")


# ── Helpers ─────────────────────────────────────────────────────

def _role_to_dict(role: VendorRole, assigned_users: int = 0) -> dict:
    return {
        "id": str(role.id),
        "vendor_id": str(role.vendor_id),
        "name": role.name,
        "slug": role.slug,
        "description": role.description,
        "permissions": role.permissions or [],
        "is_system": role.is_system,
        "is_active": role.is_active,
        "assigned_users": assigned_users,
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None,
    }


def _validate_permissions(perms: List[str]) -> None:
    invalid = [p for p in perms if p not in ALL_PERMISSIONS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions: {', '.join(invalid)}",
        )


# ── Endpoints ───────────────────────────────────────────────────

@router.get("/permissions")
async def list_all_permissions():
    """List all available permissions grouped by module."""
    grouped: dict = {}
    for perm in ALL_PERMISSIONS:
        module, action = perm.split(".", 1)
        if module not in grouped:
            grouped[module] = []
        grouped[module].append({"key": perm, "action": action})
    return JSONResponse({"permissions": grouped, "all": ALL_PERMISSIONS})


@router.get("/defaults")
async def list_default_roles():
    """List built-in system role definitions with their permissions."""
    defaults = [
        {"name": role_name, "permissions": list(perms), "is_system": True}
        for role_name, perms in DEFAULT_ROLE_PERMISSIONS.items()
    ]
    return JSONResponse({"roles": defaults})


@router.get("")
async def list_roles(
    vu: VendorUser = Depends(require_permission("roles.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all custom roles for this vendor, including inactive ones."""
    repo = VendorRoleRepository(db)
    roles = await repo.list_by_vendor(vu.vendor_id, include_inactive=True)
    # Attach assigned-user counts so the UI can show them without extra requests
    result = []
    for role in roles:
        count = await repo.count_assigned_users(vu.vendor_id, role.id)
        result.append(_role_to_dict(role, assigned_users=count))
    return JSONResponse({"roles": result})


@router.post("", status_code=201)
async def create_role(
    data: RoleCreate,
    vu: VendorUser = Depends(require_permission("roles.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new custom role.

    Pass `copy_from_builtin` with a built-in role slug to pre-populate
    permissions from that template (useful for cloning e.g. 'manager').
    Any explicit `permissions` in the payload are merged on top.
    """
    repo = VendorRoleRepository(db)
    slug = slugify(data.name, lowercase=True)

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

    # Seed from built-in template if requested
    base_perms: List[str] = []
    if data.copy_from_builtin:
        base_perms = list(DEFAULT_ROLE_PERMISSIONS.get(data.copy_from_builtin, []))
        if not base_perms and data.copy_from_builtin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Built-in role '{data.copy_from_builtin}' not found.",
            )

    merged = list(dict.fromkeys(base_perms + data.permissions))  # preserve order, deduplicate
    _validate_permissions(merged)

    role = VendorRole(
        vendor_id=vu.vendor_id,
        name=data.name,
        slug=slug,
        description=data.description,
        permissions=merged,
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
    count = await repo.count_assigned_users(vu.vendor_id, role_id)
    return JSONResponse(_role_to_dict(role, assigned_users=count))


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
        _validate_permissions(data.permissions)
        role.permissions = data.permissions
    if data.is_active is not None:
        role.is_active = data.is_active

    await db.commit()
    await db.refresh(role)
    count = await repo.count_assigned_users(vu.vendor_id, role_id)
    return JSONResponse(_role_to_dict(role, assigned_users=count))


@router.delete("/{role_id}")
async def delete_role(
    role_id: UUID,
    vu: VendorUser = Depends(require_permission("roles.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a custom role.

    Raises 400 if any active team members are still assigned to this role.
    Deactivate or reassign them first, or deactivate the role instead.
    """
    repo = VendorRoleRepository(db)
    role = await repo.get_by_vendor_and_id(vu.vendor_id, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted.")

    assigned = await repo.count_assigned_users(vu.vendor_id, role_id)
    if assigned > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete role '{role.name}': {assigned} active team member(s) are still assigned. "
                "Reassign or deactivate them first, or deactivate the role instead."
            ),
        )

    await db.delete(role)
    await db.commit()
    return JSONResponse({"message": "Role deleted"})


@router.get("/{role_id}/assigned-users")
async def list_role_assigned_users(
    role_id: UUID,
    vu: VendorUser = Depends(require_permission("roles.view")),
    db: AsyncSession = Depends(get_db),
):
    """List active team members currently using this custom role."""
    repo = VendorRoleRepository(db)
    role = await repo.get_by_vendor_and_id(vu.vendor_id, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    result = await db.execute(
        select(VendorUser)
        .options(selectinload(VendorUser.user))
        .where(
            and_(
                VendorUser.vendor_id == vu.vendor_id,
                VendorUser.role_id == role_id,
                VendorUser.is_active == True,
            )
        )
    )
    members = result.scalars().all()
    return JSONResponse({
        "role_id": str(role_id),
        "role_name": role.name,
        "members": [
            {
                "vendor_user_id": str(m.id),
                "user_id": str(m.user_id),
                "full_name": m.user.full_name if m.user else None,
                "email": m.user.email if m.user else None,
            }
            for m in members
        ],
    })


# ── Per-user permission overrides ───────────────────────────────

@router.get("/member/{vendor_user_id}/permission-overrides")
async def get_member_permission_overrides(
    vendor_user_id: UUID,
    vu: VendorUser = Depends(require_permission("team.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Return the per-user additive permission overrides for a team member."""
    result = await db.execute(
        select(VendorUser)
        .options(selectinload(VendorUser.custom_role))
        .where(
            and_(VendorUser.vendor_id == vu.vendor_id, VendorUser.id == vendor_user_id)
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    return JSONResponse({
        "vendor_user_id": str(member.id),
        "role": member.role,
        "role_id": str(member.role_id) if member.role_id else None,
        "permission_overrides": member.permissions or [],
    })


@router.put("/member/{vendor_user_id}/permission-overrides")
async def update_member_permission_overrides(
    vendor_user_id: UUID,
    data: UserPermissionOverride,
    vu: VendorUser = Depends(require_permission("team.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Replace the per-user additive permission overrides for a team member.

    These are merged *on top* of whatever the user's role provides.
    Owners cannot have their overrides edited by non-owners.
    """
    result = await db.execute(
        select(VendorUser).where(
            and_(VendorUser.vendor_id == vu.vendor_id, VendorUser.id == vendor_user_id)
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot set permission overrides on owner accounts.")

    _validate_permissions(data.grant)
    member.permissions = data.grant
    await db.commit()

    return JSONResponse({
        "vendor_user_id": str(member.id),
        "permission_overrides": member.permissions or [],
        "message": "Permission overrides updated.",
    })
