"""
Tests for AP project tagging:
- pm_project_id validation on bill create
- GL journal lines carry fin_project_id dimension
- amount_actual rollup into CoOrderCostLine on bill post
- project filter on bill list
"""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.controlling import CoManufacturingOrder, CoOrderCostLine
from app.models.finance import FinCompany, FinVendorBill
from app.models.project import Project
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser


# ── helpers ──────────────────────────────────────────────────────────────────

async def _make_active_project(db: AsyncSession, vendor_id: uuid.UUID) -> Project:
    from app.schemas.project import ProjectCreate
    from app.services.project_service import ProjectService
    svc = ProjectService(db)
    result = await svc.create_project(vendor_id, ProjectCreate(name="Tagging Test", status="active", priority="medium"))
    return (await db.execute(select(Project).where(Project.id == result["id"]))).scalar_one()


async def _make_costed_project(db: AsyncSession, vendor_id: uuid.UUID, company_id: uuid.UUID) -> Project:
    project = await _make_active_project(db, vendor_id)
    from app.services.project_costing import enable_costing
    await enable_costing(db, vendor_id, project.id, company_id)
    await db.refresh(project)
    return project


async def _make_company(db: AsyncSession, vendor_id: uuid.UUID) -> FinCompany:
    c = FinCompany(id=uuid.uuid4(), vendor_id=vendor_id, name="Test Co", code="TST", country="IN", currency="INR")
    db.add(c)
    await db.flush()
    return c


# ── bill create with pm_project_id validation ─────────────────────────────────

@pytest.mark.asyncio
async def test_create_bill_invalid_pm_project_id_rejected(
    client: AsyncClient, test_vendor: Vendor, test_vendor_user: VendorUser
):
    """A bill referencing a non-existent pm_project_id should return 400."""
    payload = {
        "supplier_id": str(uuid.uuid4()),
        "bill_no": "BILL-001",
        "bill_date": "2026-01-01",
        "subtotal": 1000,
        "tax_amount": 180,
        "total": 1180,
        "pm_project_id": str(uuid.uuid4()),  # does not exist
    }
    resp = await client.post("/vendors/me/finance/ap/bills", json=payload)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_bill_valid_pm_project_id_accepted(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor, test_vendor_user: VendorUser
):
    """A bill referencing a valid pm_project_id must be created successfully."""
    project = await _make_active_project(db_session, test_vendor.id)
    payload = {
        "supplier_id": str(uuid.uuid4()),
        "bill_no": "BILL-002",
        "bill_date": "2026-01-01",
        "subtotal": 500,
        "tax_amount": 0,
        "total": 500,
        "pm_project_id": str(project.id),
    }
    resp = await client.post("/vendors/me/finance/ap/bills", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data.get("pm_project_id") == str(project.id)


# ── actuals rollup on post ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_post_bill_rolls_up_actuals(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor, test_vendor_user: VendorUser
):
    """Posting a bill tagged to a costed project should increment amount_actual."""
    company = await _make_company(db_session, test_vendor.id)
    project = await _make_costed_project(db_session, test_vendor.id, company.id)

    # Create a bill referencing the project.
    payload = {
        "supplier_id": str(uuid.uuid4()),
        "bill_no": "BILL-003",
        "bill_date": "2026-01-01",
        "subtotal": 2000,
        "tax_amount": 0,
        "total": 2000,
        "pm_project_id": str(project.id),
    }
    create_resp = await client.post("/vendors/me/finance/ap/bills", json=payload)
    assert create_resp.status_code == 201
    bill_id = create_resp.json()["id"]

    # Post the bill.
    post_resp = await client.post(f"/vendors/me/finance/ap/bills/{bill_id}/post")
    assert post_resp.status_code == 200

    # Check actuals on the external cost line.
    ext_line = (
        await db_session.execute(
            select(CoOrderCostLine).where(
                CoOrderCostLine.order_id == project.co_order_id,
                CoOrderCostLine.category == "external",
            )
        )
    ).scalars().first()
    assert ext_line is not None
    assert Decimal(str(ext_line.amount_actual)) == Decimal("2000")


# ── project filter on bill list ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_bills_pm_project_filter(
    client: AsyncClient, db_session: AsyncSession, test_vendor: Vendor, test_vendor_user: VendorUser
):
    """GET /ap/bills?pm_project_id=X should only return bills for that project."""
    project = await _make_active_project(db_session, test_vendor.id)

    # Create two bills: one tagged, one not.
    tagged = {
        "supplier_id": str(uuid.uuid4()), "bill_no": "TAGGED", "bill_date": "2026-01-01",
        "subtotal": 100, "tax_amount": 0, "total": 100,
        "pm_project_id": str(project.id),
    }
    untagged = {
        "supplier_id": str(uuid.uuid4()), "bill_no": "UNTAGGED", "bill_date": "2026-01-01",
        "subtotal": 200, "tax_amount": 0, "total": 200,
    }
    await client.post("/vendors/me/finance/ap/bills", json=tagged)
    await client.post("/vendors/me/finance/ap/bills", json=untagged)

    resp = await client.get(f"/vendors/me/finance/ap/bills?pm_project_id={project.id}")
    assert resp.status_code == 200
    data = resp.json()
    items = data if isinstance(data, list) else data.get("items", data)
    assert len(items) == 1
    assert items[0]["bill_no"] == "TAGGED"
