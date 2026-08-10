# app/api/v1/app_builds.py
"""
API endpoints for vendor branded-app builds.
- Admin: trigger builds, list all builds, update build status
- Vendor: view their own app config and build history
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.api.deps import get_current_superuser, get_current_user
from app.models.user import User
from app.schemas.app_build import (
    AppConfigUpdate,
    AppConfigResponse,
    TriggerBuildRequest,
    BuildResponse,
    BuildListResponse,
)
from app.services.app_build_service import AppBuildService

router = APIRouter()


# ── Admin endpoints ──────────────────────────────────────────────────────────

@router.get("/admin/vendors/{vendor_id}/app-config", response_model=AppConfigResponse)
async def admin_get_app_config(
    vendor_id: UUID,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Get a vendor's branded app configuration."""
    service = AppBuildService(db)
    config = await service.get_app_config(vendor_id)
    return AppConfigResponse(**config)


@router.put("/admin/vendors/{vendor_id}/app-config", response_model=AppConfigResponse)
async def admin_update_app_config(
    vendor_id: UUID,
    body: AppConfigUpdate,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Update a vendor's branded app configuration."""
    service = AppBuildService(db)
    config = await service.update_app_config(
        vendor_id, body.model_dump(exclude_none=True)
    )
    return AppConfigResponse(**config)


@router.post(
    "/admin/vendors/{vendor_id}/app-builds",
    response_model=BuildResponse,
    status_code=status.HTTP_201_CREATED,
)
async def admin_trigger_build(
    vendor_id: UUID,
    body: TriggerBuildRequest,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a branded-app build for a vendor (superuser; plan gate skipped)."""
    service = AppBuildService(db)
    try:
        build = await service.trigger_build(
            vendor_id=vendor_id,
            platform=body.platform.value,
            triggered_by=current_user.id,
            require_entitlement=False,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    service.write_vendor_config_to_disk(build.config_snapshot, build.config_snapshot.get("vendorSlug", ""))

    return BuildResponse.from_orm_coerce(build)


@router.get("/admin/app-builds", response_model=BuildListResponse)
async def admin_list_builds(
    vendor_id: Optional[UUID] = None,
    build_status: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """List all app builds, optionally filtered by vendor or status."""
    service = AppBuildService(db)
    items, total = await service.list_builds(vendor_id=vendor_id, status=build_status)
    return BuildListResponse(
        items=[BuildResponse.from_orm_coerce(b) for b in items],
        total=total,
    )


@router.get("/admin/app-builds/{build_id}", response_model=BuildResponse)
async def admin_get_build(
    build_id: UUID,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific build's details."""
    service = AppBuildService(db)
    build = await service.get_build(build_id)
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    return BuildResponse.from_orm_coerce(build)


@router.put("/admin/app-builds/{build_id}/status", response_model=BuildResponse)
async def admin_update_build_status(
    build_id: UUID,
    new_status: str = Query(...),
    eas_build_id_android: Optional[str] = None,
    eas_build_id_ios: Optional[str] = None,
    artifact_url_android: Optional[str] = None,
    artifact_url_ios: Optional[str] = None,
    error_message: Optional[str] = None,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Update a build's status (used by the build script or webhooks)."""
    service = AppBuildService(db)
    try:
        build = await service.update_build_status(
            build_id=build_id,
            status=new_status,
            eas_build_id_android=eas_build_id_android,
            eas_build_id_ios=eas_build_id_ios,
            artifact_url_android=artifact_url_android,
            artifact_url_ios=artifact_url_ios,
            error_message=error_message,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return BuildResponse.from_orm_coerce(build)


# ── Build-script polling endpoint (uses API key, not user auth) ──────────

@router.get("/internal/pending-builds", response_model=BuildListResponse)
async def get_pending_builds(
    api_key: str = Query(..., description="Internal API key for the build runner"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns builds in config_generated status, ready for the build script.
    Protected by a simple API key (set via BUILD_RUNNER_API_KEY env var).
    """
    import os
    expected_key = os.environ.get("BUILD_RUNNER_API_KEY", "")
    if not expected_key or api_key != expected_key:
        raise HTTPException(status_code=403, detail="Invalid API key")

    service = AppBuildService(db)
    items = await service.get_pending_builds()
    return BuildListResponse(
        items=[BuildResponse.from_orm_coerce(b) for b in items],
        total=len(items),
    )
