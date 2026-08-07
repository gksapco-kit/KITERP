"""
Tests for ProjectService — numbering, N+1 fix, progress, tenant isolation,
status-filter validation, and the delete guard for costed projects.
"""
from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import CoManufacturingOrder, CoOrderCostLine
from app.models.finance import FinProject
from app.models.project import Project
from app.models.vendor import Vendor
from app.schemas.project import ProjectCreate, TaskCreate
from app.services.project_service import ProjectService


# ── helpers ──────────────────────────────────────────────────────────────────

def _vendor_id() -> uuid.UUID:
    return uuid.uuid4()


async def _make_vendor(db: AsyncSession) -> Vendor:
    from app.models.vendor import Vendor as V
    v = V(
        id=uuid.uuid4(),
        business_name="Acme",
        display_name="Acme",
        slug=f"acme-{uuid.uuid4().hex[:6]}",
        business_type="retail",
        offering_type="products",
        primary_email="acme@test.com",
        primary_phone="9999999999",
        subdomain=f"acme-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(v)
    await db.flush()
    return v


async def _create_project(db: AsyncSession, vendor_id: uuid.UUID, name: str = "Test") -> dict:
    svc = ProjectService(db)
    data = ProjectCreate(name=name, status="planning", priority="medium")
    return await svc.create_project(vendor_id, data)


# ── project numbering ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_first_project_number(db_session: AsyncSession, test_vendor: Vendor):
    """First project should be PRJ-0001."""
    p = await _create_project(db_session, test_vendor.id)
    assert p["project_number"] == "PRJ-0001"


@pytest.mark.asyncio
async def test_project_number_increments(db_session: AsyncSession, test_vendor: Vendor):
    """Second project should be PRJ-0002, not PRJ-0001."""
    await _create_project(db_session, test_vendor.id, "A")
    p2 = await _create_project(db_session, test_vendor.id, "B")
    assert p2["project_number"] == "PRJ-0002"


@pytest.mark.asyncio
async def test_project_number_tenant_isolated(db_session: AsyncSession):
    """Two different vendors each get their own PRJ-0001."""
    v1 = await _make_vendor(db_session)
    v2 = await _make_vendor(db_session)
    p1 = await _create_project(db_session, v1.id, "Vendor1-Project")
    p2 = await _create_project(db_session, v2.id, "Vendor2-Project")
    assert p1["project_number"] == "PRJ-0001"
    assert p2["project_number"] == "PRJ-0001"


# ── _project_dict completeness ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_project_dict_includes_costing_fields(db_session: AsyncSession, test_vendor: Vendor):
    """create_project response must include company_id, fin_project_id, co_order_id."""
    p = await _create_project(db_session, test_vendor.id)
    assert "company_id" in p
    assert "fin_project_id" in p
    assert "co_order_id" in p
    # All null until costing is enabled.
    assert p["company_id"] is None
    assert p["fin_project_id"] is None
    assert p["co_order_id"] is None


# ── list_projects (N+1 fix and status filter validation) ─────────────────────

@pytest.mark.asyncio
async def test_list_projects_returns_data(db_session: AsyncSession, test_vendor: Vendor):
    await _create_project(db_session, test_vendor.id, "P1")
    await _create_project(db_session, test_vendor.id, "P2")
    svc = ProjectService(db_session)
    items, total = await svc.list_projects(test_vendor.id)
    assert total == 2
    assert len(items) == 2


@pytest.mark.asyncio
async def test_list_projects_status_filter_invalid(db_session: AsyncSession, test_vendor: Vendor):
    from fastapi import HTTPException
    svc = ProjectService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await svc.list_projects(test_vendor.id, status_filter="garbage")
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_list_projects_status_filter_valid(db_session: AsyncSession, test_vendor: Vendor):
    await _create_project(db_session, test_vendor.id, "Active")
    svc = ProjectService(db_session)
    items, total = await svc.list_projects(test_vendor.id, status_filter="planning")
    assert total == 1
    assert items[0]["status"] == "planning"


# ── progress calculation ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_progress_updates_on_task_done(db_session: AsyncSession, test_vendor: Vendor):
    """Completing all tasks must drive progress_percent to 100."""
    p = await _create_project(db_session, test_vendor.id)
    svc = ProjectService(db_session)
    t = await svc.create_task(
        test_vendor.id, uuid.UUID(str(p["id"])),
        TaskCreate(title="Task 1", status="todo", priority="medium"),
    )
    await svc.update_task(
        test_vendor.id, uuid.UUID(str(p["id"])), uuid.UUID(str(t["id"])),
        __import__("app.schemas.project", fromlist=["TaskUpdate"]).TaskUpdate(status="done"),
    )
    refreshed = await svc.get_project(test_vendor.id, uuid.UUID(str(p["id"])))
    assert refreshed["progress_percent"] == 100


# ── tenant isolation ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_projects_tenant_isolated(db_session: AsyncSession, test_vendor: Vendor):
    """Projects from other vendors must not appear in the list."""
    other_vendor = await _make_vendor(db_session)
    await _create_project(db_session, test_vendor.id, "Mine")
    await _create_project(db_session, other_vendor.id, "Theirs")
    svc = ProjectService(db_session)
    items, total = await svc.list_projects(test_vendor.id)
    assert total == 1
    assert items[0]["name"] == "Mine"


# ── delete guard ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_project_with_actuals_blocked(db_session: AsyncSession, test_vendor: Vendor):
    """Deleting a project that has posted cost actuals must raise 400."""
    from fastapi import HTTPException
    from decimal import Decimal as D

    p = await _create_project(db_session, test_vendor.id)
    project_id = uuid.UUID(str(p["id"]))

    # Manually attach a fake CO order so the guard runs.
    co_order = CoManufacturingOrder(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        company_id=uuid.uuid4(),
        order_no="PRJ-0001",
        order_kind="project",
        status="released",
    )
    db_session.add(co_order)
    await db_session.flush()

    cost_line = CoOrderCostLine(
        id=uuid.uuid4(),
        order_id=co_order.id,
        category="material",
        description="Widget",
        uom="piece",
        qty_planned=D("1"),
        qty_actual=D("1"),
        rate_planned=D("100"),
        rate_actual=D("100"),
        amount_planned=D("100"),
        amount_actual=D("100"),  # <— posted actual
        sequence=0,
    )
    db_session.add(cost_line)

    from app.models.project import Project as P
    row = (
        await db_session.execute(__import__("sqlalchemy", fromlist=["select"]).select(P).where(P.id == project_id))
    ).scalar_one()
    row.co_order_id = co_order.id
    await db_session.commit()

    svc = ProjectService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await svc.delete_project(test_vendor.id, project_id)
    assert exc_info.value.status_code == 400
    assert "posted cost actuals" in exc_info.value.detail
