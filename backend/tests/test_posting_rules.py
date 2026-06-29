"""
Tests for Feature 7: Validation rules, Substitution rules, Number ranges.

Covers:
  - Validation rule CRUD.
  - run_validations raises when check fails.
  - run_validations skips when prerequisite not met.
  - Substitution rule CRUD.
  - apply_substitutions modifies field when prerequisite met.
  - apply_substitutions leaves field unchanged when prerequisite not met.
  - Number range seed and idempotency.
  - next_document_number increments correctly.
  - next_document_number raises when exhausted.
  - next_document_number raises when no range configured.
"""
import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.vendor import Vendor
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance import rules_service as rs
from app.models.finance import FinNumberRange


@pytest_asyncio.fixture
async def rules_vendor(db_session, test_vendor: Vendor) -> Vendor:
    await seed_default_coa(db_session, test_vendor.id)
    await seed_default_fiscal_year(db_session, test_vendor.id)
    await db_session.commit()
    return test_vendor


# ── Validation Rule tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_list_validation_rule(db_session, rules_vendor):
    rule = await rs.create_validation_rule(
        db_session, rules_vendor.id,
        name="Balance check",
        check_expr="total_debit == total_credit",
        error_message="Debit must equal credit",
    )
    await db_session.flush()

    rules = await rs.list_validation_rules(db_session, rules_vendor.id)
    assert any(r.name == "Balance check" for r in rules)


@pytest.mark.asyncio
async def test_run_validations_fails_check(db_session, rules_vendor):
    await rs.create_validation_rule(
        db_session, rules_vendor.id,
        name="No zero postings",
        check_expr="total_debit > 0",
        error_message="Total debit must be positive",
        call_point="document",
    )
    await db_session.flush()

    with pytest.raises(ValueError, match="Total debit must be positive"):
        await rs.run_validations(db_session, rules_vendor.id, "document", {"total_debit": 0, "total_credit": 0})


@pytest.mark.asyncio
async def test_run_validations_passes_when_ok(db_session, rules_vendor):
    await rs.create_validation_rule(
        db_session, rules_vendor.id,
        name="Positive check",
        check_expr="total_debit > 0",
        error_message="Must be positive",
        call_point="document",
    )
    await db_session.flush()

    await rs.run_validations(db_session, rules_vendor.id, "document", {"total_debit": 100, "total_credit": 100})


@pytest.mark.asyncio
async def test_run_validations_skips_when_prereq_false(db_session, rules_vendor):
    """Rule with prerequisite that is False must be skipped even if check would fail."""
    await rs.create_validation_rule(
        db_session, rules_vendor.id,
        name="Conditional check",
        prerequisite_expr="is_intercompany == True",
        check_expr="False",  # Would always fail if reached
        error_message="Should not appear",
        call_point="document",
    )
    await db_session.flush()

    # is_intercompany not True → prereq fails → rule skipped → no error
    await rs.run_validations(db_session, rules_vendor.id, "document", {"is_intercompany": False})


@pytest.mark.asyncio
async def test_delete_validation_rule(db_session, rules_vendor):
    rule = await rs.create_validation_rule(
        db_session, rules_vendor.id,
        name="To delete", check_expr="True", error_message="x"
    )
    await db_session.flush()
    await rs.delete_validation_rule(db_session, rule.id, rules_vendor.id)
    await db_session.flush()

    rules = await rs.list_validation_rules(db_session, rules_vendor.id)
    assert all(r.name != "To delete" for r in rules)


# ── Substitution Rule tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_apply_substitutions_sets_field(db_session, rules_vendor):
    await rs.create_substitution_rule(
        db_session, rules_vendor.id,
        name="Default CC",
        call_point="line",
        prerequisite_expr="cost_center_id is None",
        target_field="cost_center_id",
        substitution_expr='"default-cc"',
    )
    await db_session.flush()

    result = await rs.apply_substitutions(
        db_session, rules_vendor.id, "line", {"cost_center_id": None}
    )
    assert result["cost_center_id"] == "default-cc"


@pytest.mark.asyncio
async def test_apply_substitutions_skips_when_prereq_false(db_session, rules_vendor):
    await rs.create_substitution_rule(
        db_session, rules_vendor.id,
        name="Cond sub",
        call_point="line",
        prerequisite_expr="cost_center_id is None",
        target_field="cost_center_id",
        substitution_expr='"default-cc"',
    )
    await db_session.flush()

    result = await rs.apply_substitutions(
        db_session, rules_vendor.id, "line", {"cost_center_id": "existing-cc"}
    )
    assert result["cost_center_id"] == "existing-cc"


# ── Number Range tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_seed_number_ranges(db_session, rules_vendor):
    created = await rs.seed_default_number_ranges(db_session, rules_vendor.id, 2024)
    await db_session.commit()

    doc_types = {nr.document_type for nr in created}
    assert "SA" in doc_types
    assert "DR" in doc_types


@pytest.mark.asyncio
async def test_seed_number_ranges_idempotent(db_session, rules_vendor):
    await rs.seed_default_number_ranges(db_session, rules_vendor.id, 2024)
    await db_session.commit()
    await rs.seed_default_number_ranges(db_session, rules_vendor.id, 2024)
    await db_session.commit()

    rows = (await db_session.execute(
        select(FinNumberRange).where(
            FinNumberRange.vendor_id == rules_vendor.id,
            FinNumberRange.fiscal_year == 2024,
        )
    )).scalars().all()
    doc_types = [r.document_type for r in rows]
    assert len(doc_types) == len(set(doc_types))


@pytest.mark.asyncio
async def test_next_document_number_increments(db_session, rules_vendor):
    await rs.seed_default_number_ranges(db_session, rules_vendor.id, 2024)
    await db_session.flush()

    doc1 = await rs.next_document_number(db_session, rules_vendor.id, "SA", 2024)
    doc2 = await rs.next_document_number(db_session, rules_vendor.id, "SA", 2024)
    # Numbers must be sequential
    assert int(doc1) + 1 == int(doc2)


@pytest.mark.asyncio
async def test_next_document_number_no_range_raises(db_session, rules_vendor):
    with pytest.raises(ValueError, match="No number range"):
        await rs.next_document_number(db_session, rules_vendor.id, "XX", 2024)


@pytest.mark.asyncio
async def test_next_document_number_exhausted(db_session, rules_vendor):
    """When current_number > number_to the range is exhausted."""
    from app.models.finance import FinNumberRange
    nr = FinNumberRange(
        vendor_id=rules_vendor.id,
        document_type="ZZ",
        fiscal_year=2024,
        number_from=1,
        number_to=2,
        current_number=3,   # already beyond to
    )
    db_session.add(nr)
    await db_session.flush()

    with pytest.raises(ValueError, match="exhausted"):
        await rs.next_document_number(db_session, rules_vendor.id, "ZZ", 2024)
