"""
Commission engine computation tests (money path).

`CommissionEngine._compute` is the pure payout calculator; `_rule_matches` is
the line filter. We exercise both directly with transient model objects so the
math is verified without persisting the full assignment graph.

Covers: percentage, flat, points, tiered, time-based, cap, floor, payee-share,
split weighting, zero-value skip, and rule matching (applies_to / channel /
min_qty / min_amount).
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.models.commission import (
    CommissionAssignment,
    CommissionPlan,
    CommissionRule,
)
from app.services.commission.engine import CommissionEngine, SaleLineContext


def _ctx(**over):
    base = dict(
        vendor_id=uuid.uuid4(),
        payee_id=uuid.uuid4(),
        source_type="order",
        source_id=uuid.uuid4(),
        source_line_ref="item_0",
        sale_date=date(2026, 6, 1),
        channel="online",
        base_amount=Decimal("1000"),
    )
    base.update(over)
    return SaleLineContext(**base)


def _rule(**over):
    fields = dict(
        id=uuid.uuid4(),
        plan_id=uuid.uuid4(),
        calculation_type="percentage",
        applies_to="all",
        channel="any",
        is_active=True,
    )
    fields.update(over)
    return CommissionRule(**fields)


def _plan():
    return CommissionPlan(id=uuid.uuid4(), priority=10, stackable=False)


def _assignment():
    return CommissionAssignment(id=uuid.uuid4(), is_active=True)


async def _compute(rule, ctx, weight=Decimal("100")):
    engine = CommissionEngine(db=None)  # _compute does not touch db for these calc types
    return await engine._compute(
        rule=rule, assignment=_assignment(), plan=_plan(),
        ctx=ctx, payee_id=ctx.payee_id or uuid.uuid4(), weight_pct=weight,
    )


# ── Calculation types ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_percentage():
    draft = await _compute(_rule(calculation_type="percentage", value_numeric=Decimal("5")), _ctx())
    assert draft.commission_amount == Decimal("50.00")  # 5% of 1000


@pytest.mark.asyncio
async def test_flat():
    draft = await _compute(_rule(calculation_type="flat", value_currency=Decimal("250")), _ctx())
    assert draft.commission_amount == Decimal("250")


@pytest.mark.asyncio
async def test_points():
    draft = await _compute(
        _rule(calculation_type="points", points_per_unit=Decimal("2")),
        _ctx(qty=Decimal("3")),
    )
    assert draft.points_amount == Decimal("6.0000")
    assert draft.commission_amount == Decimal("0")


@pytest.mark.asyncio
async def test_tiered():
    tiers = [
        {"from": 0, "to": 500, "rate": 2},
        {"from": 500, "to": 5000, "rate": 10},
    ]
    draft = await _compute(
        _rule(calculation_type="tiered", tier_table=tiers), _ctx(base_amount=Decimal("1000")),
    )
    assert draft.commission_amount == Decimal("100.00")  # 1000 falls in 10% tier


@pytest.mark.asyncio
async def test_time_based():
    draft = await _compute(
        _rule(calculation_type="time_based", time_rate={"rate_per_hour": 600}),
        _ctx(duration_minutes=90),
    )
    assert draft.commission_amount == Decimal("900.00")  # 1.5h * 600


# ── Cap / floor / share / weighting ──────────────────────────────

@pytest.mark.asyncio
async def test_cap_applied():
    draft = await _compute(
        _rule(calculation_type="percentage", value_numeric=Decimal("50"), cap_amount=Decimal("100")),
        _ctx(),  # 50% of 1000 = 500, capped at 100
    )
    assert draft.commission_amount == Decimal("100")


@pytest.mark.asyncio
async def test_floor_applied():
    draft = await _compute(
        _rule(calculation_type="percentage", value_numeric=Decimal("1"), floor_amount=Decimal("50")),
        _ctx(),  # 1% of 1000 = 10, floored to 50
    )
    assert draft.commission_amount == Decimal("50")


@pytest.mark.asyncio
async def test_payee_share_percent():
    draft = await _compute(
        _rule(calculation_type="percentage", value_numeric=Decimal("10"),
              payee_share_percent=Decimal("50")),
        _ctx(),  # 10% of 1000 = 100, payee gets 50% = 50
    )
    assert draft.commission_amount == Decimal("50.00")


@pytest.mark.asyncio
async def test_split_weighting():
    """A 40% split earner gets commission on 40% of the base."""
    draft = await _compute(
        _rule(calculation_type="percentage", value_numeric=Decimal("10")),
        _ctx(), weight=Decimal("40"),
    )
    # base scaled to 400, 10% = 40
    assert draft.base_amount == Decimal("400")
    assert draft.commission_amount == Decimal("40.00")


@pytest.mark.asyncio
async def test_zero_commission_skipped():
    draft = await _compute(
        _rule(calculation_type="percentage", value_numeric=Decimal("0")), _ctx(),
    )
    assert draft is None


@pytest.mark.asyncio
async def test_unknown_calc_type_skipped():
    draft = await _compute(_rule(calculation_type="bogus"), _ctx())
    assert draft is None


# ── Rule matching ────────────────────────────────────────────────

def test_rule_matches_product_scope():
    engine = CommissionEngine(db=None)
    pid = uuid.uuid4()
    rule = _rule(applies_to="product", product_id=pid)
    assert engine._rule_matches(rule, _ctx(product_id=pid)) is True
    assert engine._rule_matches(rule, _ctx(product_id=uuid.uuid4())) is False
    assert engine._rule_matches(rule, _ctx(product_id=None)) is False


def test_rule_matches_channel():
    engine = CommissionEngine(db=None)
    rule = _rule(channel="pos")
    assert engine._rule_matches(rule, _ctx(channel="pos")) is True
    assert engine._rule_matches(rule, _ctx(channel="online")) is False


def test_rule_matches_min_qty_and_amount():
    engine = CommissionEngine(db=None)
    rule = _rule(min_qty=Decimal("5"), min_amount=Decimal("500"))
    assert engine._rule_matches(rule, _ctx(qty=Decimal("5"), base_amount=Decimal("500"))) is True
    assert engine._rule_matches(rule, _ctx(qty=Decimal("4"), base_amount=Decimal("500"))) is False
    assert engine._rule_matches(rule, _ctx(qty=Decimal("5"), base_amount=Decimal("100"))) is False
