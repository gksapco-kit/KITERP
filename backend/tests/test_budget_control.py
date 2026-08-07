"""Tests for CO / project budget availability hard-stop on postings."""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import CoBudgetLine, CoManufacturingOrder, CoOrderCostLine
from app.models.finance import FinCompany
from app.models.vendor import Vendor
from app.services.controlling.budget_control import (
    BudgetExceededError,
    assert_budget_allows,
    get_budget_availability,
)


async def _vendor(db: AsyncSession) -> Vendor:
    v = Vendor(
        id=uuid.uuid4(),
        business_name="Budget Co",
        display_name="Budget Co",
        slug=f"budget-{uuid.uuid4().hex[:6]}",
        business_type="retail",
        offering_type="services",
        primary_email="b@b.com",
        primary_phone="9999999999",
        subdomain=f"budget-{uuid.uuid4().hex[:6]}",
        status="active",
    )
    db.add(v)
    await db.flush()
    return v


async def _company(db: AsyncSession, vendor_id: uuid.UUID) -> FinCompany:
    c = FinCompany(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        name="Budget Ltd",
        code="BDG",
        country="IN",
        currency="INR",
    )
    db.add(c)
    await db.flush()
    return c


async def _order(db: AsyncSession, vendor_id: uuid.UUID, company_id: uuid.UUID) -> CoManufacturingOrder:
    order = CoManufacturingOrder(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=company_id,
        order_no=f"PRJ-{uuid.uuid4().hex[:6]}",
        title="Budget Test Order",
        order_kind="project",
        status="released",
    )
    db.add(order)
    await db.flush()
    return order


async def _budget(
    db: AsyncSession,
    vendor_id: uuid.UUID,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
    category: str,
    amount: Decimal,
) -> CoBudgetLine:
    bl = CoBudgetLine(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=company_id,
        order_id=order_id,
        budget_type="original",
        category=category,
        amount_budgeted=amount,
        currency="INR",
    )
    db.add(bl)
    await db.flush()
    return bl


async def _cost_line(
    db: AsyncSession,
    order_id: uuid.UUID,
    category: str,
    amount_actual: Decimal,
) -> CoOrderCostLine:
    ln = CoOrderCostLine(
        id=uuid.uuid4(),
        order_id=order_id,
        category=category,
        description="line",
        uom="piece",
        qty_planned=Decimal("1"),
        qty_actual=Decimal("0"),
        rate_planned=Decimal("0"),
        rate_actual=Decimal("0"),
        amount_planned=Decimal("0"),
        amount_actual=amount_actual,
        sequence=10,
    )
    db.add(ln)
    await db.flush()
    return ln


@pytest.mark.asyncio
async def test_no_budget_lines_allows_any_posting(db_session: AsyncSession):
    vendor = await _vendor(db_session)
    company = await _company(db_session, vendor.id)
    order = await _order(db_session, vendor.id, company.id)

    avail = await assert_budget_allows(db_session, order.id, "material", Decimal("19000"))
    assert avail.enforced is False
    assert avail.would_exceed is False


@pytest.mark.asyncio
async def test_material_issue_within_budget_allowed(db_session: AsyncSession):
    vendor = await _vendor(db_session)
    company = await _company(db_session, vendor.id)
    order = await _order(db_session, vendor.id, company.id)
    await _budget(db_session, vendor.id, company.id, order.id, "material", Decimal("1200"))
    await _cost_line(db_session, order.id, "material", Decimal("100"))

    avail = await assert_budget_allows(db_session, order.id, "material", Decimal("1100"))
    assert avail.enforced is True
    assert avail.available == Decimal("1100")


@pytest.mark.asyncio
async def test_material_issue_over_budget_blocked(db_session: AsyncSession):
    vendor = await _vendor(db_session)
    company = await _company(db_session, vendor.id)
    order = await _order(db_session, vendor.id, company.id)
    await _budget(db_session, vendor.id, company.id, order.id, "material", Decimal("1200"))
    await _cost_line(db_session, order.id, "material", Decimal("0"))

    with pytest.raises(BudgetExceededError) as ei:
        await assert_budget_allows(db_session, order.id, "material", Decimal("19000"))

    detail = ei.value.availability.to_detail()
    assert detail["code"] == "BUDGET_EXCEEDED"
    assert detail["category"] == "material"
    assert detail["amount_budgeted"] == "1200.00"
    assert "exceeded" in detail["message"].lower()


@pytest.mark.asyncio
async def test_component_return_negative_delta_not_blocked(db_session: AsyncSession):
    """Returns reduce spend; availability helper is only called with positive deltas in APIs,
    but zero/negative posting amounts must never raise."""
    vendor = await _vendor(db_session)
    company = await _company(db_session, vendor.id)
    order = await _order(db_session, vendor.id, company.id)
    await _budget(db_session, vendor.id, company.id, order.id, "material", Decimal("100"))
    await _cost_line(db_session, order.id, "material", Decimal("100"))

    avail = await assert_budget_allows(db_session, order.id, "material", Decimal("0"))
    assert avail.would_exceed is False


@pytest.mark.asyncio
async def test_labor_budget_consumes_activity_cost_lines(db_session: AsyncSession):
    vendor = await _vendor(db_session)
    company = await _company(db_session, vendor.id)
    order = await _order(db_session, vendor.id, company.id)
    await _budget(db_session, vendor.id, company.id, order.id, "labor", Decimal("500"))
    await _cost_line(db_session, order.id, "activity", Decimal("400"))

    avail = await get_budget_availability(db_session, order.id, "labor", Decimal("50"))
    assert avail.amount_actual == Decimal("400")
    assert avail.available == Decimal("100")

    with pytest.raises(BudgetExceededError):
        await assert_budget_allows(db_session, order.id, "labor", Decimal("150"))


@pytest.mark.asyncio
async def test_budget_lines_sum_across_types(db_session: AsyncSession):
    vendor = await _vendor(db_session)
    company = await _company(db_session, vendor.id)
    order = await _order(db_session, vendor.id, company.id)
    await _budget(db_session, vendor.id, company.id, order.id, "material", Decimal("1000"))
    bl2 = await _budget(db_session, vendor.id, company.id, order.id, "material", Decimal("200"))
    bl2.budget_type = "supplement"
    await db_session.flush()

    avail = await get_budget_availability(db_session, order.id, "material", Decimal("1100"))
    assert avail.amount_budgeted == Decimal("1200")
    assert avail.would_exceed is False
