# app/services/commission/engine.py
"""
Commission Engine — pure rule evaluator.

Given a SaleLineContext it:
1. Finds active CommissionAssignments for the payee/store/channel
2. Resolves the linked CommissionPlan (ordered by priority)
3. Evaluates each CommissionRule against the context
4. Returns a list of AccrualDraft objects ready to be persisted
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, and_, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commission import (
    CommissionAssignment, CommissionPlan, CommissionRule, CommissionAccrual,
)

log = logging.getLogger(__name__)


@dataclass
class SaleLineContext:
    vendor_id: UUID
    payee_id: Optional[UUID]          # header-level default earner
    source_type: str                   # order | pos | booking
    source_id: UUID
    source_line_ref: str               # e.g. "item_0"
    sale_date: date
    channel: str                       # online | pos | booking
    base_amount: Decimal               # pre-tax line amount
    qty: Decimal = Decimal("1")
    uom: Optional[str] = None
    product_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    store_id: Optional[UUID] = None
    customer_group: Optional[str] = None
    event_tag: Optional[str] = None
    team_id: Optional[UUID] = None
    duration_minutes: Optional[int] = None  # for time_based rules
    # Per-line override splits: [{payee_id, weight_percent}]
    payee_splits: List[dict] = field(default_factory=list)


@dataclass
class AccrualDraft:
    vendor_id: UUID
    payee_id: UUID
    plan_id: UUID
    rule_id: UUID
    assignment_id: UUID
    source_type: str
    source_id: UUID
    source_line_ref: str
    sale_date: date
    store_id: Optional[UUID]
    channel: str
    base_amount: Decimal
    calculation_type: str
    value_applied: Optional[Decimal]
    commission_amount: Decimal
    points_amount: Decimal = Decimal("0")
    equity_units_amount: Decimal = Decimal("0")
    currency: str = "INR"


class CommissionEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def evaluate(self, ctx: SaleLineContext) -> List[AccrualDraft]:
        """Return a list of AccrualDraft for a single sale line."""
        if ctx.base_amount <= 0:
            return []

        # Determine which payees to evaluate (splits override header)
        if ctx.payee_splits:
            payee_weights = [(UUID(s["payee_id"]), Decimal(str(s.get("weight_percent", 100)))) for s in ctx.payee_splits]
        elif ctx.payee_id:
            payee_weights = [(ctx.payee_id, Decimal("100"))]
        else:
            # No payee attached — no commissions to compute
            return []

        drafts: List[AccrualDraft] = []

        for payee_id, weight_pct in payee_weights:
            payee_drafts = await self._evaluate_for_payee(ctx, payee_id, weight_pct)
            drafts.extend(payee_drafts)

        return drafts

    async def _evaluate_for_payee(
        self, ctx: SaleLineContext, payee_id: UUID, weight_pct: Decimal
    ) -> List[AccrualDraft]:
        # Load active assignments for this payee (scoped to vendor + optional store/team)
        conditions = [
            CommissionAssignment.vendor_id == ctx.vendor_id,
            CommissionAssignment.payee_id == payee_id,
            CommissionAssignment.is_active == True,
        ]
        today = ctx.sale_date
        # Date scope filters (null = open-ended)
        conditions.append(
            (CommissionAssignment.valid_from == None) | (CommissionAssignment.valid_from <= today)
        )
        conditions.append(
            (CommissionAssignment.valid_to == None) | (CommissionAssignment.valid_to >= today)
        )
        if ctx.store_id:
            conditions.append(
                (CommissionAssignment.store_id == None) | (CommissionAssignment.store_id == ctx.store_id)
            )

        result = await self.db.execute(
            select(CommissionAssignment).where(and_(*conditions))
        )
        assignments = result.scalars().all()
        if not assignments:
            return []

        # Collect plans, sorted by priority asc (lower = higher priority)
        plan_ids = list({a.plan_id for a in assignments})
        plan_result = await self.db.execute(
            select(CommissionPlan).where(
                and_(
                    CommissionPlan.id.in_(plan_ids),
                    CommissionPlan.status == "active",
                )
            ).order_by(CommissionPlan.priority.asc())
        )
        plans = plan_result.scalars().all()

        # Filter plans by effective dates
        active_plans = [
            p for p in plans
            if (p.effective_from is None or p.effective_from <= today)
            and (p.effective_to is None or p.effective_to >= today)
        ]

        drafts: List[AccrualDraft] = []
        fired = False

        for plan in active_plans:
            if fired and not plan.stackable:
                break

            # Find assignment for this plan
            assignment = next((a for a in assignments if a.plan_id == plan.id), None)
            if not assignment:
                continue

            # Load rules for this plan (already ordered by priority asc)
            rules_result = await self.db.execute(
                select(CommissionRule).where(
                    and_(
                        CommissionRule.plan_id == plan.id,
                        CommissionRule.is_active == True,
                    )
                ).order_by(CommissionRule.priority.asc())
            )
            rules = rules_result.scalars().all()

            for rule in rules:
                if not self._rule_matches(rule, ctx):
                    continue

                # Compute the commission
                draft = await self._compute(
                    rule=rule,
                    assignment=assignment,
                    plan=plan,
                    ctx=ctx,
                    payee_id=payee_id,
                    weight_pct=weight_pct,
                )
                if draft is not None:
                    drafts.append(draft)
                    fired = True
                    # Only fire one rule per plan (unless stackable plan)
                    break

        return drafts

    def _rule_matches(self, rule: CommissionRule, ctx: SaleLineContext) -> bool:
        """Return True when all match conditions on the rule pass."""
        # applies_to — explicit product / service / category (wildcard when rule.*_id is NULL)
        if rule.applies_to == "product":
            if ctx.product_id is None:
                return False
            if rule.product_id is not None and ctx.product_id != rule.product_id:
                return False
        elif rule.applies_to == "service":
            if ctx.service_id is None:
                return False
            if rule.service_id is not None and ctx.service_id != rule.service_id:
                return False
        elif rule.applies_to == "category":
            if ctx.category_id is None:
                return False
            if rule.category_id is not None and ctx.category_id != rule.category_id:
                return False

        # channel
        if rule.channel and rule.channel != "any" and rule.channel != ctx.channel:
            return False

        # store — only enforce when the sale line has store context; POS often has no store on session
        if rule.store_id and ctx.store_id is not None and rule.store_id != ctx.store_id:
            return False

        # uom
        if rule.uom and rule.uom != ctx.uom:
            return False

        # customer group
        if rule.customer_group and rule.customer_group != ctx.customer_group:
            return False

        # event tag
        if rule.event_tag and rule.event_tag != ctx.event_tag:
            return False

        # min qty / min amount
        if rule.min_qty is not None and ctx.qty < Decimal(str(rule.min_qty)):
            return False
        if rule.min_amount is not None and ctx.base_amount < Decimal(str(rule.min_amount)):
            return False

        return True

    async def _compute(
        self,
        rule: CommissionRule,
        assignment: CommissionAssignment,
        plan: CommissionPlan,
        ctx: SaleLineContext,
        payee_id: UUID,
        weight_pct: Decimal,
    ) -> Optional[AccrualDraft]:
        calc = rule.calculation_type
        base = ctx.base_amount * (weight_pct / Decimal("100"))

        commission = Decimal("0")
        points = Decimal("0")
        equity = Decimal("0")
        value_applied = None

        if calc == "percentage":
            rate = Decimal(str(rule.value_numeric or 0))
            commission = (base * rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            value_applied = rate

        elif calc == "flat":
            flat = Decimal(str(rule.value_currency or 0))
            commission = flat * (weight_pct / Decimal("100"))
            value_applied = flat

        elif calc == "points":
            pts_rate = Decimal(str(rule.points_per_unit or 0))
            points = (ctx.qty * pts_rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            commission = Decimal("0")
            value_applied = pts_rate

        elif calc == "equity":
            eq_units = Decimal(str(rule.equity_units or 0))
            equity = eq_units * (weight_pct / Decimal("100"))
            commission = Decimal("0")
            value_applied = eq_units

        elif calc == "tiered":
            commission = await self._tiered(rule, ctx, base)
            value_applied = None

        elif calc == "time_based":
            commission = self._time_based(rule, ctx, weight_pct)
            value_applied = None

        elif calc == "revenue_based":
            # Commission = configured % of revenue when revenue threshold is met
            period_revenue = await self._period_revenue(rule, ctx)
            if rule.revenue_threshold and period_revenue < Decimal(str(rule.revenue_threshold)):
                return None
            rate = Decimal(str(rule.value_numeric or 0))
            commission = (base * rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            value_applied = rate

        elif calc == "count_based":
            period_count = await self._period_count(rule, ctx)
            if rule.count_threshold and period_count < rule.count_threshold:
                return None
            rate = Decimal(str(rule.value_numeric or 0))
            commission = (base * rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            value_applied = rate

        else:
            log.warning("Unknown calculation_type '%s', skipping", calc)
            return None

        # Apply cap / floor
        if rule.cap_amount and commission > Decimal(str(rule.cap_amount)):
            commission = Decimal(str(rule.cap_amount))
        if rule.floor_amount and commission < Decimal(str(rule.floor_amount)):
            commission = Decimal(str(rule.floor_amount))

        # Apply payee share
        if rule.payee_share_percent:
            share = Decimal(str(rule.payee_share_percent)) / Decimal("100")
            commission = (commission * share).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Skip zero-value accruals
        if commission == 0 and points == 0 and equity == 0:
            return None

        return AccrualDraft(
            vendor_id=ctx.vendor_id,
            payee_id=payee_id,
            plan_id=plan.id,
            rule_id=rule.id,
            assignment_id=assignment.id,
            source_type=ctx.source_type,
            source_id=ctx.source_id,
            source_line_ref=ctx.source_line_ref,
            sale_date=ctx.sale_date,
            store_id=ctx.store_id,
            channel=ctx.channel,
            base_amount=base,
            calculation_type=calc,
            value_applied=value_applied,
            commission_amount=commission,
            points_amount=points,
            equity_units_amount=equity,
        )

    async def _tiered(self, rule: CommissionRule, ctx: SaleLineContext, base: Decimal) -> Decimal:
        """Apply tier_table [{from, to, rate, flat}] to base_amount."""
        tiers = rule.tier_table or []
        amount = float(base)
        commission = Decimal("0")
        for tier in sorted(tiers, key=lambda t: t.get("from", 0)):
            tier_from = tier.get("from", 0)
            tier_to = tier.get("to")
            rate = tier.get("rate", 0)
            flat = tier.get("flat", 0)
            if amount >= tier_from and (tier_to is None or amount < tier_to):
                if rate:
                    commission = (base * Decimal(str(rate)) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                elif flat:
                    commission = Decimal(str(flat))
                break
        return commission

    def _time_based(self, rule: CommissionRule, ctx: SaleLineContext, weight_pct: Decimal) -> Decimal:
        """rate_per_hour x hours (derived from duration_minutes)."""
        time_cfg = rule.time_rate or {}
        rate_per_hour = Decimal(str(time_cfg.get("rate_per_hour", 0)))
        if not rate_per_hour or not ctx.duration_minutes:
            return Decimal("0")
        hours = Decimal(str(ctx.duration_minutes)) / Decimal("60")
        commission = (rate_per_hour * hours * (weight_pct / Decimal("100"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        return commission

    async def _period_revenue(self, rule: CommissionRule, ctx: SaleLineContext) -> Decimal:
        """Sum of commission base_amount in the current period for this payee+rule."""
        period = rule.period or "month"
        date_trunc = f"date_trunc('{period}', sale_date)"
        result = await self.db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(CommissionAccrual.base_amount), 0)).where(
                and_(
                    CommissionAccrual.vendor_id == ctx.vendor_id,
                    CommissionAccrual.rule_id == rule.id,
                    CommissionAccrual.source_type == ctx.source_type,
                )
            )
        )
        return Decimal(str(result.scalar_one() or 0))

    async def _period_count(self, rule: CommissionRule, ctx: SaleLineContext) -> int:
        """Count distinct sales in the current period for this payee+rule."""
        result = await self.db.execute(
            select(sqlfunc.count(CommissionAccrual.id.distinct())).where(
                and_(
                    CommissionAccrual.vendor_id == ctx.vendor_id,
                    CommissionAccrual.rule_id == rule.id,
                )
            )
        )
        return result.scalar_one() or 0
