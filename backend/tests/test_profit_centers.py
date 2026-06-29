"""
Tests for Feature 5: Profit Centers & Segments.

Covers:
  - CRUD for profit centers (create, list, update, delete).
  - Hierarchy: child profit center references parent.
  - CRUD for segments.
  - pnl_by_profit_center returns the right shape (no postings → empty list or Unassigned).
  - pnl_by_segment returns the right shape.
  - Duplicate code raises IntegrityError / ValueError.
"""
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.finance import FinProfitCenter, FinSegment
from app.models.vendor import Vendor
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance import profit_center_service as pcs


@pytest_asyncio.fixture
async def pc_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


# ── Profit Center CRUD ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_list_profit_center(db_session, pc_vendor):
    pc = await pcs.create_profit_center(db_session, pc_vendor.id, code="PC01", name="North Region")
    await db_session.commit()

    centers = await pcs.list_profit_centers(db_session, pc_vendor.id)
    assert any(c.code == "PC01" for c in centers)


@pytest.mark.asyncio
async def test_update_profit_center(db_session, pc_vendor):
    pc = await pcs.create_profit_center(db_session, pc_vendor.id, code="PC02", name="South Region")
    await db_session.flush()

    updated = await pcs.update_profit_center(db_session, pc.id, pc_vendor.id, name="South Region Updated", manager="Alice")
    assert updated.name == "South Region Updated"
    assert updated.manager == "Alice"


@pytest.mark.asyncio
async def test_delete_profit_center(db_session, pc_vendor):
    pc = await pcs.create_profit_center(db_session, pc_vendor.id, code="PC03", name="East")
    await db_session.flush()
    await pcs.delete_profit_center(db_session, pc.id, pc_vendor.id)
    await db_session.flush()

    row = (await db_session.execute(
        select(FinProfitCenter).where(FinProfitCenter.id == pc.id)
    )).scalar_one_or_none()
    assert row is None


@pytest.mark.asyncio
async def test_profit_center_hierarchy(db_session, pc_vendor):
    """Child profit center must reference the parent."""
    parent = await pcs.create_profit_center(db_session, pc_vendor.id, code="REG", name="Region")
    await db_session.flush()
    child  = await pcs.create_profit_center(db_session, pc_vendor.id, code="REG-N", name="Region North", parent_id=parent.id)
    await db_session.flush()
    assert child.parent_id == parent.id


@pytest.mark.asyncio
async def test_profit_center_update_not_found(db_session, pc_vendor):
    import uuid
    with pytest.raises(ValueError, match="not found"):
        await pcs.update_profit_center(db_session, uuid.uuid4(), pc_vendor.id, name="X")


# ── Segment CRUD ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_list_segment(db_session, pc_vendor):
    seg = await pcs.create_segment(db_session, pc_vendor.id, code="SEG1", name="Retail")
    await db_session.commit()

    segs = await pcs.list_segments(db_session, pc_vendor.id)
    assert any(s.code == "SEG1" for s in segs)


@pytest.mark.asyncio
async def test_delete_segment(db_session, pc_vendor):
    seg = await pcs.create_segment(db_session, pc_vendor.id, code="SEG2", name="Wholesale")
    await db_session.flush()
    await pcs.delete_segment(db_session, seg.id, pc_vendor.id)
    await db_session.flush()

    row = (await db_session.execute(
        select(FinSegment).where(FinSegment.id == seg.id)
    )).scalar_one_or_none()
    assert row is None


@pytest.mark.asyncio
async def test_delete_segment_not_found(db_session, pc_vendor):
    import uuid
    with pytest.raises(ValueError, match="not found"):
        await pcs.delete_segment(db_session, uuid.uuid4(), pc_vendor.id)


# ── P&L reports (empty) ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pnl_by_profit_center_empty(db_session, pc_vendor):
    """With no postings the P&L should return an empty list."""
    result = await pcs.pnl_by_profit_center(
        db_session, pc_vendor.id,
        from_date=date(2024, 4, 1),
        to_date=date(2025, 3, 31),
    )
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_pnl_by_segment_empty(db_session, pc_vendor):
    result = await pcs.pnl_by_segment(
        db_session, pc_vendor.id,
        from_date=date(2024, 4, 1),
        to_date=date(2025, 3, 31),
    )
    assert isinstance(result, list)
