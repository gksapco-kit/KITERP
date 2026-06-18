# app/api/v1/vendor_projects.py
from __future__ import annotations

from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, require_permission
from app.database import get_db
from app.models.customer import Customer
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectOverviewResponse,
    ProjectResponse,
    ProjectUpdate,
    TaskCreate,
    TaskReorderRequest,
    TaskResponse,
    TaskUpdate,
)
from app.services.project_service import ProjectService

router = APIRouter()


async def _validate_customer(
    db: AsyncSession, vendor_id: UUID, customer_id: Optional[UUID],
) -> None:
    if not customer_id:
        return
    r = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.vendor_id == vendor_id)
    )
    if not r.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invalid customer for this vendor")


@router.get("/overview", response_model=ProjectOverviewResponse)
async def project_overview(
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    return await ProjectService(db).overview(vu.vendor_id)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    store_id: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = ProjectService(db)
    items, total = await svc.list_projects(
        vu.vendor_id, page=page, size=size, status_filter=status, search=search, store_id=store_id,
    )
    return {
        "items": [ProjectResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": ceil(total / size) if total else 0,
    }


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _validate_customer(db, vu.vendor_id, data.customer_id)
    result = await ProjectService(db).create_project(
        vu.vendor_id,
        data,
        default_owner_id=current_user.id,
        default_owner_name=current_user.full_name or current_user.email,
    )
    return ProjectResponse.model_validate(result)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    result = await ProjectService(db).get_project(vu.vendor_id, project_id)
    return ProjectResponse.model_validate(result)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    if data.customer_id is not None:
        await _validate_customer(db, vu.vendor_id, data.customer_id)
    result = await ProjectService(db).update_project(vu.vendor_id, project_id, data)
    return ProjectResponse.model_validate(result)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    await ProjectService(db).delete_project(vu.vendor_id, project_id)
    return None


@router.get("/{project_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await ProjectService(db).list_tasks(vu.vendor_id, project_id)
    return [TaskResponse.model_validate(i) for i in items]


@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: UUID,
    data: TaskCreate,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await ProjectService(db).create_task(vu.vendor_id, project_id, data)
    return TaskResponse.model_validate(result)


@router.put("/{project_id}/tasks/reorder", response_model=list[TaskResponse])
async def reorder_tasks(
    project_id: UUID,
    data: TaskReorderRequest,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    items = await ProjectService(db).reorder_tasks(
        vu.vendor_id, project_id, data.items,
    )
    return [TaskResponse.model_validate(i) for i in items]


@router.put("/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: UUID,
    task_id: UUID,
    data: TaskUpdate,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await ProjectService(db).update_task(
        vu.vendor_id, project_id, task_id, data,
    )
    return TaskResponse.model_validate(result)


@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    project_id: UUID,
    task_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    await ProjectService(db).delete_task(vu.vendor_id, project_id, task_id)
    return None
