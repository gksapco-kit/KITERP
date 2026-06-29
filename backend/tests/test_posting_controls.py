"""
Tests for Feature 4: Posting Keys, Field Status Groups, Tolerance Groups.

Covers:
  - Seeding posting keys is idempotent and creates the expected SAP-standard keys.
  - Seeding FSGs creates the expected groups.
  - Seeding the default tolerance group works and is idempotent.
  - Tolerance enforcement blocks over-limit postings.
  - Tolerance enforcement allows within-limit postings.
  - Field Status Group enforcement raises on missing required field.
  - Field Status Group enforcement raises on suppressed field being present.
  - Field Status Group enforcement passes when rules are satisfied.
"""
from decimal import Decimal
from uuid import UUID

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.finance import FinPostingKey, FinFieldStatusGroup, FinFieldStatusRule, FinToleranceGroup
from app.models.vendor import Vendor
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.posting_controls import (
    seed_default_posting_keys,
    seed_default_field_status_groups,
    seed_default_tolerance_group,
    enforce_tolerance,
    enforce_field_status,
    get_field_status_rules,
)


@pytest_asyncio.fixture
async def ctrl_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


# ── Posting Key tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_seed_posting_keys_creates_standard_keys(db_session, ctrl_vendor):
    await seed_default_posting_keys(db_session, ctrl_vendor.id)
    await db_session.commit()

    rows = (await db_session.execute(
        select(FinPostingKey).where(FinPostingKey.vendor_id == ctrl_vendor.id)
    )).scalars().all()
    codes = {r.code for r in rows}
    # Standard SAP GL keys must be present
    for expected in ("40", "50", "01", "31"):
        assert expected in codes, f"Posting key {expected} missing after seeding"


@pytest.mark.asyncio
async def test_seed_posting_keys_idempotent(db_session, ctrl_vendor):
    await seed_default_posting_keys(db_session, ctrl_vendor.id)
    await db_session.commit()
    await seed_default_posting_keys(db_session, ctrl_vendor.id)
    await db_session.commit()

    rows = (await db_session.execute(
        select(FinPostingKey).where(FinPostingKey.vendor_id == ctrl_vendor.id)
    )).scalars().all()
    codes = [r.code for r in rows]
    # No duplicate codes
    assert len(codes) == len(set(codes))


@pytest.mark.asyncio
async def test_posting_key_debit_credit_sides(db_session, ctrl_vendor):
    await seed_default_posting_keys(db_session, ctrl_vendor.id)
    await db_session.flush()

    debit_40 = (await db_session.execute(
        select(FinPostingKey).where(FinPostingKey.vendor_id == ctrl_vendor.id, FinPostingKey.code == "40")
    )).scalar_one()
    credit_50 = (await db_session.execute(
        select(FinPostingKey).where(FinPostingKey.vendor_id == ctrl_vendor.id, FinPostingKey.code == "50")
    )).scalar_one()

    assert debit_40.side == "debit"
    assert credit_50.side == "credit"
    assert debit_40.reversal_key == "50"
    assert credit_50.reversal_key == "40"


# ── Field Status Group tests ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_seed_field_status_groups(db_session, ctrl_vendor):
    mapping = await seed_default_field_status_groups(db_session, ctrl_vendor.id)
    await db_session.commit()

    assert "G001" in mapping
    assert "G002" in mapping
    assert "G006" in mapping


@pytest.mark.asyncio
async def test_fsg_cost_center_required_rule(db_session, ctrl_vendor):
    mapping = await seed_default_field_status_groups(db_session, ctrl_vendor.id)
    await db_session.flush()

    g002_id = mapping["G002"]
    rules = await get_field_status_rules(db_session, g002_id)
    assert rules.get("cost_center") == "required"


@pytest.mark.asyncio
async def test_enforce_field_status_required_missing(db_session, ctrl_vendor):
    """Posting without a required field must raise ValueError."""
    mapping = await seed_default_field_status_groups(db_session, ctrl_vendor.id)
    await db_session.flush()

    g002_id = mapping["G002"]  # cost_center required
    with pytest.raises(ValueError, match="cost_center"):
        await enforce_field_status(db_session, g002_id, {"text": "hello"})


@pytest.mark.asyncio
async def test_enforce_field_status_suppressed_present(db_session, ctrl_vendor):
    """Providing a suppressed field must raise ValueError."""
    mapping = await seed_default_field_status_groups(db_session, ctrl_vendor.id)
    await db_session.flush()

    g005_id = mapping["G005"]  # cost_center suppressed
    with pytest.raises(ValueError, match="cost_center"):
        await enforce_field_status(db_session, g005_id, {"cost_center_id": "some-id"})


@pytest.mark.asyncio
async def test_enforce_field_status_passes(db_session, ctrl_vendor):
    """Satisfying FSG rules must not raise."""
    mapping = await seed_default_field_status_groups(db_session, ctrl_vendor.id)
    await db_session.flush()

    g002_id = mapping["G002"]  # cost_center required
    # Should not raise when cost_center is provided
    await enforce_field_status(db_session, g002_id, {"cost_center_id": "cc-abc-123"})


@pytest.mark.asyncio
async def test_enforce_field_status_no_group(db_session, ctrl_vendor):
    """When no FSG is assigned (None), all fields are optional — no error."""
    await enforce_field_status(db_session, None, {})  # must not raise


# ── Tolerance Group tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_seed_tolerance_group_idempotent(db_session, ctrl_vendor):
    id1 = await seed_default_tolerance_group(db_session, ctrl_vendor.id)
    await db_session.commit()
    id2 = await seed_default_tolerance_group(db_session, ctrl_vendor.id)
    await db_session.commit()
    assert id1 == id2


@pytest.mark.asyncio
async def test_tolerance_line_limit_enforced(db_session, ctrl_vendor):
    """A line exceeding max_line_amount must raise ValueError."""
    tg = FinToleranceGroup(
        vendor_id=ctrl_vendor.id,
        code="TEST",
        name="Test tight limit",
        max_line_amount=Decimal("100.00"),
        currency="INR",
    )
    db_session.add(tg)
    await db_session.flush()

    with pytest.raises(ValueError, match="tolerance"):
        await enforce_tolerance(
            db_session, ctrl_vendor.id,
            [{"amount": Decimal("200.00")}],
            user_tolerance_group_id=tg.id,
        )


@pytest.mark.asyncio
async def test_tolerance_document_limit_enforced(db_session, ctrl_vendor):
    """Total document amount exceeding max_document_amount must raise."""
    tg = FinToleranceGroup(
        vendor_id=ctrl_vendor.id,
        code="TESTDOC",
        name="Test doc limit",
        max_document_amount=Decimal("500.00"),
        currency="INR",
    )
    db_session.add(tg)
    await db_session.flush()

    with pytest.raises(ValueError, match="tolerance"):
        await enforce_tolerance(
            db_session, ctrl_vendor.id,
            [{"amount": Decimal("300.00")}, {"amount": Decimal("300.00")}],
            user_tolerance_group_id=tg.id,
        )


@pytest.mark.asyncio
async def test_tolerance_within_limits_ok(db_session, ctrl_vendor):
    """Amounts within tolerance must not raise."""
    tg = FinToleranceGroup(
        vendor_id=ctrl_vendor.id,
        code="TGOK",
        name="Generous limit",
        max_line_amount=Decimal("10000.00"),
        max_document_amount=Decimal("50000.00"),
        currency="INR",
    )
    db_session.add(tg)
    await db_session.flush()

    await enforce_tolerance(
        db_session, ctrl_vendor.id,
        [{"amount": Decimal("500.00")}, {"amount": Decimal("500.00")}],
        user_tolerance_group_id=tg.id,
    )


@pytest.mark.asyncio
async def test_tolerance_no_group_unlimited(db_session, ctrl_vendor):
    """When no tolerance group exists, any amount must be allowed."""
    await enforce_tolerance(
        db_session, ctrl_vendor.id,
        [{"amount": Decimal("9999999.00")}],
        user_tolerance_group_id=None,
    )
