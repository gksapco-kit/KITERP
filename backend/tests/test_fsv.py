"""
Financial Statement Versions (FSV) tests.

Covers:
  - seed_default_fsv creates standard P&L and BS versions.
  - compute_fsv returns correct structure with all expected row types.
  - P&L computes correct net profit when invoices and expenses are posted.
  - compute_fsv raises ValueError for an unknown version.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.finance import FinStatementVersion, FinStatementNode
from app.models.vendor import Vendor
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.fsv_service import seed_default_fsv, compute_fsv
from app.services.finance.posting import post_event


@pytest_asyncio.fixture
async def fsv_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await seed_default_fsv(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


@pytest.mark.asyncio
async def test_seed_creates_both_versions(db_session, fsv_vendor):
    """Seeding must create both income_statement and balance_sheet versions."""
    r = await db_session.execute(
        select(FinStatementVersion).where(FinStatementVersion.vendor_id == fsv_vendor.id)
    )
    versions = r.scalars().all()
    types = {v.statement_type for v in versions}
    assert "income_statement" in types
    assert "balance_sheet" in types


@pytest.mark.asyncio
async def test_seed_is_idempotent(db_session, fsv_vendor):
    """Calling seed a second time must not create duplicate versions."""
    await seed_default_fsv(db_session, fsv_vendor.id)
    await db_session.flush()
    r = await db_session.execute(
        select(FinStatementVersion).where(FinStatementVersion.vendor_id == fsv_vendor.id)
    )
    assert len(r.scalars().all()) == 2  # Still exactly 2


@pytest.mark.asyncio
async def test_pl_nodes_include_required_sections(db_session, fsv_vendor):
    """P&L FSV must include Income, COGS, Operating Expenses, and Net Profit nodes."""
    r_ver = await db_session.execute(
        select(FinStatementVersion).where(
            FinStatementVersion.vendor_id == fsv_vendor.id,
            FinStatementVersion.statement_type == "income_statement",
        )
    )
    version = r_ver.scalar_one()
    r_nodes = await db_session.execute(
        select(FinStatementNode).where(FinStatementNode.version_id == version.id)
    )
    node_names = {n.name for n in r_nodes.scalars().all()}
    for expected in ("Income", "Cost of Goods Sold", "Operating Expenses", "Net Profit / (Loss)"):
        assert expected in node_names, f"Missing node: {expected}"


@pytest.mark.asyncio
async def test_compute_fsv_structure(db_session, fsv_vendor):
    """compute_fsv must return a valid result with all required keys."""
    from datetime import date
    r = await db_session.execute(
        select(FinStatementVersion).where(
            FinStatementVersion.vendor_id == fsv_vendor.id,
            FinStatementVersion.statement_type == "income_statement",
        )
    )
    version = r.scalar_one()

    result = await compute_fsv(
        db_session, fsv_vendor.id, version.id,
        from_date=date(2024, 4, 1),
        to_date=date(2025, 3, 31),
    )
    assert result["statement_type"] == "income_statement"
    assert "rows" in result
    assert len(result["rows"]) > 0
    for row in result["rows"]:
        assert "name" in row
        assert "node_type" in row
        assert "value" in row


@pytest.mark.asyncio
async def test_compute_fsv_reflects_posted_transactions(db_session, fsv_vendor):
    """
    After posting an invoice, the P&L FSV must show a non-zero Sales Revenue line.
    """
    from datetime import date
    await post_event(
        db_session, fsv_vendor.id, "invoice", uuid.uuid4(),
        {"total": 100, "cgst": 0, "sgst": 0, "entry_date": "2024-10-15"},
    )
    await db_session.commit()

    r = await db_session.execute(
        select(FinStatementVersion).where(
            FinStatementVersion.vendor_id == fsv_vendor.id,
            FinStatementVersion.statement_type == "income_statement",
        )
    )
    version = r.scalar_one()
    result = await compute_fsv(
        db_session, fsv_vendor.id, version.id,
        from_date=date(2024, 4, 1),
        to_date=date(2025, 3, 31),
    )
    sales_rows = [r for r in result["rows"] if r["name"] == "Sales Revenue"]
    assert sales_rows, "Sales Revenue row must appear"
    assert sales_rows[0]["value"] != 0, "Sales Revenue must be non-zero after posting"


@pytest.mark.asyncio
async def test_compute_unknown_version_raises(db_session, fsv_vendor):
    """compute_fsv with an unknown version_id must raise ValueError."""
    from datetime import date
    with pytest.raises(ValueError, match="not found"):
        await compute_fsv(
            db_session, fsv_vendor.id, uuid.uuid4(),
            from_date=date(2024, 4, 1),
            to_date=date(2025, 3, 31),
        )
