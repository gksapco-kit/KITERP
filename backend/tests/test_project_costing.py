"""
Tests for project_costing.py — enable_costing idempotency, cost-line seeding,
GL settlement lines, and resync_cost_lines.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.controlling import CoManufacturingOrder, CoOrderCostLine
from app.models.finance import FinCompany, FinProject
from app.models.project import Project
from app.models.vendor import Vendor
from app.schemas.project import ProjectCreate
from app.services.project_service import ProjectService
from app.services.project_costing import enable_costing, get_costing_status, resync_cost_lines, sync_co_order


# ── helpers ──────────────────────────────────────────────────────────────────

async def _make_vendor(db: AsyncSession) -> Vendor:
    from app.models.vendor import Vendor as V
    v = V(
        id=uuid.uuid4(),
        business_name="Costing Co",
        display_name="Costing Co",
        slug=f"costing-{uuid.uuid4().hex[:6]}",
        business_type="retail",
        offering_type="services",
        primary_email="c@c.com",
        primary_phone="8888888888",
        subdomain=f"costing-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(v)
    await db.flush()
    return v


async def _make_company(db: AsyncSession, vendor_id: uuid.UUID) -> FinCompany:
    company = FinCompany(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        name="Acme Ltd",
        code="ACM",
        country="IN",
        currency="INR",
    )
    db.add(company)
    await db.flush()
    return company


async def _create_project(
    db: AsyncSession, vendor_id: uuid.UUID, items: list | None = None
) -> Project:
    svc = ProjectService(db)
    data = ProjectCreate(
        name="Construction Phase 1",
        status="active",
        priority="high",
        items=items or [],
    )
    result = await svc.create_project(vendor_id, data)
    row = (
        await db.execute(select(Project).where(Project.id == result["id"]))
    ).scalar_one()
    return row


# ── enable_costing ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_enable_costing_creates_fin_project_and_co_order(db_session: AsyncSession):
    vendor = await _make_vendor(db_session)
    company = await _make_company(db_session, vendor.id)
    project = await _create_project(db_session, vendor.id)

    updated = await enable_costing(db_session, vendor.id, project.id, company.id)

    assert updated.fin_project_id is not None
    assert updated.co_order_id is not None
    assert updated.company_id == company.id


@pytest.mark.asyncio
async def test_enable_costing_is_idempotent(db_session: AsyncSession):
    """Calling enable_costing twice must not create duplicate records."""
    vendor = await _make_vendor(db_session)
    company = await _make_company(db_session, vendor.id)
    project = await _create_project(db_session, vendor.id)

    first = await enable_costing(db_session, vendor.id, project.id, company.id)
    second = await enable_costing(db_session, vendor.id, project.id, company.id)

    assert first.co_order_id == second.co_order_id
    assert first.fin_project_id == second.fin_project_id

    # Only one CoManufacturingOrder should exist for this project.
    count = (
        await db_session.execute(
            select(CoManufacturingOrder).where(
                CoManufacturingOrder.ref_doc_id == project.id
            )
        )
    ).scalars().all()
    assert len(count) == 1


@pytest.mark.asyncio
async def test_enable_costing_seeds_cost_lines_from_items(db_session: AsyncSession):
    """Catalog items on the project should each produce a cost line."""
    vendor = await _make_vendor(db_session)
    company = await _make_company(db_session, vendor.id)
    items = [
        {"name": "Labour", "item_type": "service", "price": 500},
        {"name": "Materials", "item_type": "service", "price": 1200},
    ]
    project = await _create_project(db_session, vendor.id, items=items)
    updated = await enable_costing(db_session, vendor.id, project.id, company.id)

    lines = (
        await db_session.execute(
            select(CoOrderCostLine).where(CoOrderCostLine.order_id == updated.co_order_id)
        )
    ).scalars().all()
    assert len(lines) == 2
    amounts = {ln.description: ln.amount_planned for ln in lines}
    assert amounts["Labour"] == Decimal("500")
    assert amounts["Materials"] == Decimal("1200")


@pytest.mark.asyncio
async def test_get_costing_status_no_costing(db_session: AsyncSession):
    vendor = await _make_vendor(db_session)
    project = await _create_project(db_session, vendor.id)
    status = await get_costing_status(db_session, vendor.id, project.id)
    assert status["costing_enabled"] is False
    assert status["co_order_id"] is None


@pytest.mark.asyncio
async def test_get_costing_status_with_costing(db_session: AsyncSession):
    vendor = await _make_vendor(db_session)
    company = await _make_company(db_session, vendor.id)
    project = await _create_project(db_session, vendor.id)
    await enable_costing(db_session, vendor.id, project.id, company.id)
    status = await get_costing_status(db_session, vendor.id, project.id)
    assert status["costing_enabled"] is True
    assert status["co_order_id"] is not None


# ── sync_co_order ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_co_order_propagates_name_change(db_session: AsyncSession):
    """Updating the project name should sync to CoManufacturingOrder and FinProject."""
    from app.schemas.project import ProjectUpdate
    vendor = await _make_vendor(db_session)
    company = await _make_company(db_session, vendor.id)
    project = await _create_project(db_session, vendor.id)
    await enable_costing(db_session, vendor.id, project.id, company.id)

    svc = ProjectService(db_session)
    await svc.update_project(vendor.id, project.id, ProjectUpdate(name="Updated Name"))

    # Verify CO order title
    row = await db_session.execute(
        select(CoManufacturingOrder).where(CoManufacturingOrder.ref_doc_id == project.id)
    )
    order = row.scalar_one()
    assert order.title == "Updated Name"


# ── resync_cost_lines ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_resync_adds_new_items(db_session: AsyncSession):
    """Adding an item after costing is enabled should create a new cost line."""
    from app.schemas.project import ProjectUpdate
    vendor = await _make_vendor(db_session)
    company = await _make_company(db_session, vendor.id)
    project = await _create_project(db_session, vendor.id)
    await enable_costing(db_session, vendor.id, project.id, company.id)

    svc = ProjectService(db_session)
    await svc.update_project(
        vendor.id, project.id,
        ProjectUpdate(items=[{"name": "New Service", "item_type": "service", "price": 750}]),
    )

    await db_session.refresh(project)
    lines = (
        await db_session.execute(
            select(CoOrderCostLine).where(CoOrderCostLine.order_id == project.co_order_id)
        )
    ).scalars().all()
    assert any(ln.description == "New Service" for ln in lines)


@pytest.mark.asyncio
async def test_resync_does_not_delete_lines_with_actuals(db_session: AsyncSession):
    """A line with amount_actual > 0 must survive even if its item is removed."""
    from app.schemas.project import ProjectUpdate
    vendor = await _make_vendor(db_session)
    company = await _make_company(db_session, vendor.id)
    items = [{"name": "Widget", "item_type": "service", "price": 100}]
    project = await _create_project(db_session, vendor.id, items=items)
    await enable_costing(db_session, vendor.id, project.id, company.id)

    # Simulate a posted actual on the seeded line.
    all_lines = (
        await db_session.execute(
            select(CoOrderCostLine).where(CoOrderCostLine.order_id == project.co_order_id)
        )
    ).scalars().all()
    for ln in all_lines:
        ln.amount_actual = Decimal("100")
    await db_session.flush()

    # Remove the item via update.
    svc = ProjectService(db_session)
    await svc.update_project(vendor.id, project.id, ProjectUpdate(items=[]))

    await db_session.refresh(project)
    remaining = (
        await db_session.execute(
            select(CoOrderCostLine).where(
                CoOrderCostLine.order_id == project.co_order_id,
                CoOrderCostLine.description == "Widget",
            )
        )
    ).scalars().all()
    assert len(remaining) == 1, "Line with actuals must not be deleted"
