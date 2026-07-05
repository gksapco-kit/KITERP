from __future__ import annotations

import uuid as uuid_mod
from datetime import date, datetime, timezone
from decimal import Decimal
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.project import Project, ProjectTask
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.schemas.project import (
    ProjectCreate,
    ProjectOverviewResponse,
    ProjectUpdate,
    TaskCreate,
    TaskReorderItem,
    TaskUpdate,
)


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _next_project_number(self, vendor_id: UUID) -> str:
        stmt = (
            select(func.count())
            .select_from(Project)
            .where(Project.vendor_id == vendor_id)
        )
        count = (await self.db.execute(stmt)).scalar() or 0
        return f"PRJ-{count + 1:04d}"

    async def _get_project(self, vendor_id: UUID, project_id: UUID) -> Project:
        stmt = select(Project).where(
            Project.id == project_id,
            Project.vendor_id == vendor_id,
        )
        project = (await self.db.execute(stmt)).scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project

    async def _resolve_customer_fields(
        self, vendor_id: UUID, customer_id: Optional[UUID], customer_name: Optional[str],
    ) -> tuple[Optional[UUID], Optional[str], Optional[str], Optional[str]]:
        if not customer_id:
            return None, customer_name, None, None
        row = (
            await self.db.execute(
                select(Customer).where(Customer.id == customer_id, Customer.vendor_id == vendor_id)
            )
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=400, detail="Invalid customer for this vendor")
        return row.id, row.full_name or customer_name, row.email, row.phone

    async def _resolve_assignee_name(self, assignee_id: Optional[UUID]) -> Optional[str]:
        if not assignee_id:
            return None
        user = (
            await self.db.execute(select(User).where(User.id == assignee_id))
        ).scalar_one_or_none()
        return (user.full_name or user.email) if user else None

    async def _validate_assignee(self, vendor_id: UUID, assignee_id: Optional[UUID]) -> None:
        if not assignee_id:
            return
        row = (
            await self.db.execute(
                select(VendorUser).where(
                    VendorUser.vendor_id == vendor_id,
                    VendorUser.user_id == assignee_id,
                )
            )
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=400, detail="Assignee must be a team member")

    async def _validate_task_links(
        self,
        vendor_id: UUID,
        project_id: UUID,
        *,
        task_id: Optional[UUID] = None,
        parent_task_id: Optional[UUID] = None,
        linked_task_ids: Optional[list] = None,
    ) -> None:
        if parent_task_id:
            if task_id and parent_task_id == task_id:
                raise HTTPException(status_code=400, detail="Task cannot be its own parent")
            parent = (
                await self.db.execute(
                    select(ProjectTask).where(
                        ProjectTask.id == parent_task_id,
                        ProjectTask.project_id == project_id,
                        ProjectTask.vendor_id == vendor_id,
                    )
                )
            ).scalar_one_or_none()
            if not parent:
                raise HTTPException(status_code=400, detail="Parent task not found in this project")

        if linked_task_ids:
            ids = [UUID(str(x)) for x in linked_task_ids]
            if task_id and task_id in ids:
                raise HTTPException(status_code=400, detail="Task cannot link to itself")
            count = (
                await self.db.execute(
                    select(func.count())
                    .select_from(ProjectTask)
                    .where(
                        ProjectTask.project_id == project_id,
                        ProjectTask.vendor_id == vendor_id,
                        ProjectTask.id.in_(ids),
                    )
                )
            ).scalar() or 0
            if count != len(ids):
                raise HTTPException(status_code=400, detail="One or more linked tasks are invalid")

    async def _get_task(
        self, vendor_id: UUID, project_id: UUID, task_id: UUID,
    ) -> ProjectTask:
        stmt = select(ProjectTask).where(
            ProjectTask.id == task_id,
            ProjectTask.project_id == project_id,
            ProjectTask.vendor_id == vendor_id,
        )
        task = (await self.db.execute(stmt)).scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task

    def _dump_milestones(self, milestones: list | None) -> list:
        if not milestones:
            return []
        out = []
        for m in milestones:
            if hasattr(m, "model_dump"):
                item = m.model_dump()
            else:
                item = dict(m)
            if not item.get("id"):
                item["id"] = str(uuid_mod.uuid4())
            out.append(item)
        return out

    def _dump_checklist(self, checklist: list | None) -> list:
        if not checklist:
            return []
        out = []
        for c in checklist:
            if hasattr(c, "model_dump"):
                item = c.model_dump()
            else:
                item = dict(c)
            if not item.get("id"):
                item["id"] = str(uuid_mod.uuid4())
            out.append(item)
        return out

    async def recalculate_progress(self, project_id: UUID) -> int:
        total_stmt = (
            select(func.count())
            .select_from(ProjectTask)
            .where(ProjectTask.project_id == project_id)
        )
        total = (await self.db.execute(total_stmt)).scalar() or 0

        if total == 0:
            return 0

        done_stmt = (
            select(func.count())
            .select_from(ProjectTask)
            .where(
                ProjectTask.project_id == project_id,
                ProjectTask.status == "done",
            )
        )
        done = (await self.db.execute(done_stmt)).scalar() or 0
        return round(done * 100 / total)

    async def overview(self, vendor_id: UUID) -> ProjectOverviewResponse:
        today = date.today()

        total = (
            await self.db.execute(
                select(func.count()).select_from(Project).where(Project.vendor_id == vendor_id)
            )
        ).scalar() or 0

        status_rows = (
            await self.db.execute(
                select(Project.status, func.count())
                .where(Project.vendor_id == vendor_id)
                .group_by(Project.status)
            )
        ).all()
        by_status = {row[0]: row[1] for row in status_rows}

        overdue = (
            await self.db.execute(
                select(func.count())
                .select_from(Project)
                .where(
                    Project.vendor_id == vendor_id,
                    Project.due_date.isnot(None),
                    Project.due_date < today,
                    Project.status.notin_(["completed", "cancelled"]),
                )
            )
        ).scalar() or 0

        task_total = (
            await self.db.execute(
                select(func.count())
                .select_from(ProjectTask)
                .where(ProjectTask.vendor_id == vendor_id)
            )
        ).scalar() or 0

        task_done = (
            await self.db.execute(
                select(func.count())
                .select_from(ProjectTask)
                .where(
                    ProjectTask.vendor_id == vendor_id,
                    ProjectTask.status == "done",
                )
            )
        ).scalar() or 0

        avg_progress = (
            await self.db.execute(
                select(func.avg(Project.progress_percent)).where(Project.vendor_id == vendor_id)
            )
        ).scalar()

        return ProjectOverviewResponse(
            total_projects=total,
            by_status=by_status,
            active_count=by_status.get("active", 0),
            overdue_count=overdue,
            total_tasks=task_total,
            open_tasks=task_total - task_done,
            completed_tasks=task_done,
            avg_progress=round(float(avg_progress or 0), 1),
        )

    async def list_projects(
        self,
        vendor_id: UUID,
        *,
        page: int = 1,
        size: int = 20,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        store_id: Optional[str] = None,
        sales_area_id: Optional[str] = None,
    ) -> tuple[list[dict], int]:
        conditions = [Project.vendor_id == vendor_id]
        if status_filter:
            conditions.append(Project.status == status_filter)
        if store_id:
            conditions.append(Project.store_id == (store_id if isinstance(store_id, UUID) else UUID(str(store_id))))
        if sales_area_id:
            conditions.append(Project.sales_area_id == (sales_area_id if isinstance(sales_area_id, UUID) else UUID(str(sales_area_id))))
        if search:
            like = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Project.name.ilike(like),
                    Project.project_number.ilike(like),
                    Project.customer_name.ilike(like),
                    Project.description.ilike(like),
                )
            )

        count_stmt = select(func.count()).select_from(Project).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        skip = (page - 1) * size
        stmt = (
            select(Project)
            .where(and_(*conditions))
            .order_by(Project.updated_at.desc())
            .offset(skip)
            .limit(size)
        )
        projects = list((await self.db.execute(stmt)).scalars().all())

        if not projects:
            return [], total

        project_ids = [p.id for p in projects]
        task_counts = (
            await self.db.execute(
                select(
                    ProjectTask.project_id,
                    func.count().label("total"),
                    func.count().filter(ProjectTask.status == "done").label("done"),
                )
                .where(ProjectTask.project_id.in_(project_ids))
                .group_by(ProjectTask.project_id)
            )
        ).all()
        counts_map = {row.project_id: (row.total, row.done) for row in task_counts}

        items = []
        for p in projects:
            tc, dc = counts_map.get(p.id, (0, 0))
            email, phone = await self._customer_contact(vendor_id, p.customer_id)
            items.append(self._project_dict(
                p, task_count=tc, done_task_count=dc,
                customer_email=email, customer_phone=phone,
            ))
        return items, total

    def _project_dict(
        self,
        p: Project,
        *,
        task_count: int = 0,
        done_task_count: int = 0,
        customer_email: Optional[str] = None,
        customer_phone: Optional[str] = None,
    ) -> dict:
        return {
            "id": p.id,
            "vendor_id": p.vendor_id,
            "store_id": p.store_id,
            "sales_area_id": p.sales_area_id,
            "project_number": p.project_number,
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "priority": p.priority,
            "items": p.items or [],
            "customer_id": p.customer_id,
            "customer_name": p.customer_name,
            "customer_email": customer_email,
            "customer_phone": customer_phone,
            "owner_id": p.owner_id,
            "owner_name": p.owner_name,
            "start_date": p.start_date,
            "end_date": p.end_date,
            "due_date": p.due_date,
            "budget": p.budget,
            "currency": p.currency,
            "progress_percent": p.progress_percent or 0,
            "color": p.color,
            "tags": p.tags or [],
            "milestones": p.milestones or [],
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "completed_at": p.completed_at,
            "task_count": task_count,
            "done_task_count": done_task_count,
        }

    async def _customer_contact(self, vendor_id: UUID, customer_id: Optional[UUID]) -> tuple[Optional[str], Optional[str]]:
        if not customer_id:
            return None, None
        row = (
            await self.db.execute(
                select(Customer).where(Customer.id == customer_id, Customer.vendor_id == vendor_id)
            )
        ).scalar_one_or_none()
        if not row:
            return None, None
        return row.email, row.phone

    async def get_project(self, vendor_id: UUID, project_id: UUID) -> dict:
        project = await self._get_project(vendor_id, project_id)
        total_stmt = (
            select(func.count())
            .select_from(ProjectTask)
            .where(ProjectTask.project_id == project_id)
        )
        done_stmt = (
            select(func.count())
            .select_from(ProjectTask)
            .where(
                ProjectTask.project_id == project_id,
                ProjectTask.status == "done",
            )
        )
        task_count = (await self.db.execute(total_stmt)).scalar() or 0
        done_count = (await self.db.execute(done_stmt)).scalar() or 0
        email, phone = await self._customer_contact(vendor_id, project.customer_id)
        return self._project_dict(
            project, task_count=task_count, done_task_count=done_count,
            customer_email=email, customer_phone=phone,
        )

    async def create_project(
        self,
        vendor_id: UUID,
        data: ProjectCreate,
        *,
        default_owner_id: Optional[UUID] = None,
        default_owner_name: Optional[str] = None,
    ) -> dict:
        owner_id = data.owner_id or default_owner_id
        owner_name = data.owner_name or default_owner_name

        cust_id, cust_name, cust_email, cust_phone = await self._resolve_customer_fields(
            vendor_id, data.customer_id, data.customer_name,
        )

        project = Project(
            vendor_id=vendor_id,
            store_id=data.store_id,
            sales_area_id=data.sales_area_id,
            project_number=await self._next_project_number(vendor_id),
            name=data.name,
            description=data.description,
            status=data.status.value if hasattr(data.status, "value") else data.status,
            priority=data.priority.value if hasattr(data.priority, "value") else data.priority,
            customer_id=cust_id,
            customer_name=cust_name,
            owner_id=owner_id,
            owner_name=owner_name,
            start_date=data.start_date,
            end_date=data.end_date,
            due_date=data.due_date,
            budget=Decimal(str(data.budget)) if data.budget is not None else None,
            currency=data.currency or "INR",
            color=data.color,
            tags=data.tags or [],
            milestones=self._dump_milestones(data.milestones),
            items=[i.model_dump() for i in data.items] if data.items else [],
        )
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)
        return self._project_dict(
            project, customer_email=cust_email, customer_phone=cust_phone,
        )

    async def update_project(
        self, vendor_id: UUID, project_id: UUID, data: ProjectUpdate,
    ) -> dict:
        project = await self._get_project(vendor_id, project_id)
        updates = data.model_dump(exclude_unset=True)

        if "status" in updates and updates["status"] is not None:
            updates["status"] = (
                updates["status"].value
                if hasattr(updates["status"], "value")
                else updates["status"]
            )
            if updates["status"] == "completed" and not project.completed_at:
                project.completed_at = datetime.now(timezone.utc)
            elif updates["status"] != "completed":
                project.completed_at = None

        if "priority" in updates and updates["priority"] is not None:
            updates["priority"] = (
                updates["priority"].value
                if hasattr(updates["priority"], "value")
                else updates["priority"]
            )

        if "budget" in updates and updates["budget"] is not None:
            updates["budget"] = Decimal(str(updates["budget"]))

        if "milestones" in updates:
            updates["milestones"] = self._dump_milestones(updates["milestones"])

        if "items" in updates and updates["items"] is not None:
            updates["items"] = [
                it.model_dump() if hasattr(it, "model_dump") else it
                for it in updates["items"]
            ]

        if "customer_id" in updates:
            cust_id, cust_name, _, _ = await self._resolve_customer_fields(
                vendor_id,
                updates.get("customer_id"),
                updates.get("customer_name", project.customer_name),
            )
            updates["customer_id"] = cust_id
            if cust_name:
                updates["customer_name"] = cust_name
            elif updates["customer_id"] is None:
                updates["customer_name"] = updates.get("customer_name")

        if "owner_id" in updates and updates["owner_id"]:
            owner = (
                await self.db.execute(select(User).where(User.id == updates["owner_id"]))
            ).scalar_one_or_none()
            if owner and not updates.get("owner_name"):
                updates["owner_name"] = owner.full_name or owner.email

        for key, value in updates.items():
            setattr(project, key, value)

        await self.db.commit()
        await self.db.refresh(project)
        return await self.get_project(vendor_id, project_id)

    async def delete_project(self, vendor_id: UUID, project_id: UUID) -> None:
        project = await self._get_project(vendor_id, project_id)
        await self.db.delete(project)
        await self.db.commit()

    async def _task_dict(self, t: ProjectTask, *, task_map: Optional[dict] = None) -> dict:
        parent_title = None
        linked_tasks = []
        subtask_count = 0

        if task_map is None:
            rows = (
                await self.db.execute(
                    select(ProjectTask).where(ProjectTask.project_id == t.project_id)
                )
            ).scalars().all()
            task_map = {row.id: row for row in rows}

        if t.parent_task_id and t.parent_task_id in task_map:
            parent_title = task_map[t.parent_task_id].title

        for lid in (t.linked_task_ids or []):
            try:
                uid = UUID(str(lid))
            except (TypeError, ValueError):
                continue
            if uid in task_map:
                lt = task_map[uid]
                linked_tasks.append({
                    "id": lt.id,
                    "title": lt.title,
                    "status": lt.status,
                })

        subtask_count = sum(1 for row in task_map.values() if row.parent_task_id == t.id)

        return {
            "id": t.id,
            "vendor_id": t.vendor_id,
            "project_id": t.project_id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "assignee_id": t.assignee_id,
            "assignee_name": t.assignee_name,
            "parent_task_id": t.parent_task_id,
            "linked_task_ids": [UUID(str(x)) for x in (t.linked_task_ids or [])],
            "parent_title": parent_title,
            "linked_tasks": linked_tasks,
            "subtask_count": subtask_count,
            "due_date": t.due_date,
            "position": t.position,
            "labels": t.labels or [],
            "checklist": t.checklist or [],
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "completed_at": t.completed_at,
        }

    async def list_tasks(self, vendor_id: UUID, project_id: UUID) -> list[dict]:
        await self._get_project(vendor_id, project_id)
        stmt = (
            select(ProjectTask)
            .where(
                ProjectTask.vendor_id == vendor_id,
                ProjectTask.project_id == project_id,
            )
            .order_by(ProjectTask.status, ProjectTask.position, ProjectTask.created_at)
        )
        tasks = list((await self.db.execute(stmt)).scalars().all())
        task_map = {t.id: t for t in tasks}
        out = []
        for t in tasks:
            out.append(await self._task_dict(t, task_map=task_map))
        return out

    async def _next_task_position(self, project_id: UUID, status: str) -> int:
        stmt = (
            select(func.max(ProjectTask.position))
            .where(
                ProjectTask.project_id == project_id,
                ProjectTask.status == status,
            )
        )
        max_pos = (await self.db.execute(stmt)).scalar()
        return (max_pos or -1) + 1

    async def create_task(
        self, vendor_id: UUID, project_id: UUID, data: TaskCreate,
    ) -> dict:
        await self._get_project(vendor_id, project_id)
        await self._validate_assignee(vendor_id, data.assignee_id)
        await self._validate_task_links(
            vendor_id, project_id,
            parent_task_id=data.parent_task_id,
            linked_task_ids=data.linked_task_ids,
        )
        status_val = data.status.value if hasattr(data.status, "value") else data.status
        position = data.position
        if position == 0:
            position = await self._next_task_position(project_id, status_val)

        assignee_name = data.assignee_name or await self._resolve_assignee_name(data.assignee_id)
        linked_ids = [str(x) for x in (data.linked_task_ids or [])]

        task = ProjectTask(
            vendor_id=vendor_id,
            project_id=project_id,
            title=data.title,
            description=data.description,
            status=status_val,
            priority=data.priority.value if hasattr(data.priority, "value") else data.priority,
            assignee_id=data.assignee_id,
            assignee_name=assignee_name,
            parent_task_id=data.parent_task_id,
            linked_task_ids=linked_ids,
            due_date=data.due_date,
            position=position,
            labels=data.labels or [],
            checklist=self._dump_checklist(data.checklist),
            completed_at=datetime.now(timezone.utc) if status_val == "done" else None,
        )
        self.db.add(task)
        await self.db.flush()

        project = await self._get_project(vendor_id, project_id)
        project.progress_percent = await self.recalculate_progress(project_id)

        await self.db.commit()
        await self.db.refresh(task)
        return await self._task_dict(task)

    async def update_task(
        self,
        vendor_id: UUID,
        project_id: UUID,
        task_id: UUID,
        data: TaskUpdate,
    ) -> dict:
        task = await self._get_task(vendor_id, project_id, task_id)
        updates = data.model_dump(exclude_unset=True)

        if "assignee_id" in updates:
            await self._validate_assignee(vendor_id, updates.get("assignee_id"))
            if updates.get("assignee_id") and not updates.get("assignee_name"):
                updates["assignee_name"] = await self._resolve_assignee_name(updates["assignee_id"])
            if updates.get("assignee_id") is None:
                updates["assignee_name"] = None

        parent_id = updates.get("parent_task_id", task.parent_task_id)
        linked_ids = updates.get("linked_task_ids", task.linked_task_ids)
        if "parent_task_id" in updates or "linked_task_ids" in updates:
            await self._validate_task_links(
                vendor_id, project_id, task_id=task_id,
                parent_task_id=parent_id,
                linked_task_ids=linked_ids,
            )
        if "linked_task_ids" in updates and updates["linked_task_ids"] is not None:
            updates["linked_task_ids"] = [str(x) for x in updates["linked_task_ids"]]

        if "status" in updates and updates["status"] is not None:
            updates["status"] = (
                updates["status"].value
                if hasattr(updates["status"], "value")
                else updates["status"]
            )
            if updates["status"] == "done" and not task.completed_at:
                task.completed_at = datetime.now(timezone.utc)
            elif updates["status"] != "done":
                task.completed_at = None

        if "priority" in updates and updates["priority"] is not None:
            updates["priority"] = (
                updates["priority"].value
                if hasattr(updates["priority"], "value")
                else updates["priority"]
            )

        if "checklist" in updates:
            updates["checklist"] = self._dump_checklist(updates["checklist"])

        for key, value in updates.items():
            setattr(task, key, value)

        project = await self._get_project(vendor_id, project_id)
        project.progress_percent = await self.recalculate_progress(project_id)

        await self.db.commit()
        await self.db.refresh(task)
        return await self._task_dict(task)

    async def delete_task(
        self, vendor_id: UUID, project_id: UUID, task_id: UUID,
    ) -> None:
        task = await self._get_task(vendor_id, project_id, task_id)
        await self.db.delete(task)
        await self.db.flush()

        project = await self._get_project(vendor_id, project_id)
        project.progress_percent = await self.recalculate_progress(project_id)

        await self.db.commit()

    async def reorder_tasks(
        self,
        vendor_id: UUID,
        project_id: UUID,
        items: list[TaskReorderItem],
    ) -> list[dict]:
        await self._get_project(vendor_id, project_id)
        task_ids = [item.id for item in items]

        stmt = select(ProjectTask).where(
            ProjectTask.vendor_id == vendor_id,
            ProjectTask.project_id == project_id,
            ProjectTask.id.in_(task_ids),
        )
        tasks = {t.id: t for t in (await self.db.execute(stmt)).scalars().all()}

        if len(tasks) != len(task_ids):
            raise HTTPException(status_code=400, detail="One or more tasks not found")

        for item in items:
            task = tasks[item.id]
            status_val = item.status.value if hasattr(item.status, "value") else item.status
            task.status = status_val
            task.position = item.position
            if status_val == "done" and not task.completed_at:
                task.completed_at = datetime.now(timezone.utc)
            elif status_val != "done":
                task.completed_at = None

        project = await self._get_project(vendor_id, project_id)
        project.progress_percent = await self.recalculate_progress(project_id)

        await self.db.commit()
        return await self.list_tasks(vendor_id, project_id)

    @staticmethod
    def paginate(items: list, total: int, page: int, size: int) -> dict:
        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": ceil(total / size) if total else 0,
        }
