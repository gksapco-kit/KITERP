"""Budget availability control for CO order postings.

When budget lines exist for a category, spend that would push category
actuals above the budgeted amount is rejected. Categories with no budget
lines are unrestricted (planning-only until a budget is entered).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import CoBudgetLine, CoOrderCostLine

# Budget categories (UI / CoBudgetLine) → cost-line categories that consume them.
_COST_LINE_CATEGORIES: dict[str, tuple[str, ...]] = {
    "material": ("material",),
    "labor": ("labor", "activity"),
    "overhead": ("overhead",),
    "other": ("other", "external"),
}


@dataclass(frozen=True)
class BudgetAvailability:
    category: str
    amount_budgeted: Decimal
    amount_actual: Decimal
    posting_amount: Decimal
    available: Decimal
    enforced: bool

    @property
    def would_exceed(self) -> bool:
        if not self.enforced or self.posting_amount <= 0:
            return False
        return self.amount_actual + self.posting_amount > self.amount_budgeted

    def to_detail(self) -> dict:
        proposed = self.amount_actual + self.posting_amount

        def _fmt(value: Decimal) -> str:
            return format(value.quantize(Decimal("0.01")), "f")

        return {
            "code": "BUDGET_EXCEEDED",
            "message": (
                f"{self.category.capitalize()} budget exceeded: "
                f"budgeted {_fmt(self.amount_budgeted)}, "
                f"actual {_fmt(self.amount_actual)}, "
                f"posting {_fmt(self.posting_amount)} would reach {_fmt(proposed)}. "
                f"Available {_fmt(self.available)}."
            ),
            "category": self.category,
            "amount_budgeted": _fmt(self.amount_budgeted),
            "amount_actual": _fmt(self.amount_actual),
            "posting_amount": _fmt(self.posting_amount),
            "available": _fmt(self.available),
        }


class BudgetExceededError(Exception):
    """Raised when a posting would exceed the category budget."""

    def __init__(self, availability: BudgetAvailability):
        self.availability = availability
        super().__init__(availability.to_detail()["message"])


def map_posting_to_budget_category(cost_line_category: str) -> str:
    """Map a cost-line / posting category onto a CoBudgetLine category."""
    key = (cost_line_category or "other").lower()
    if key in _COST_LINE_CATEGORIES:
        return key
    for budget_cat, cost_cats in _COST_LINE_CATEGORIES.items():
        if key in cost_cats:
            return budget_cat
    return "other"


async def get_budget_availability(
    db: AsyncSession,
    order_id: UUID,
    category: str,
    posting_amount: Decimal,
) -> BudgetAvailability:
    """Return availability for a category; does not raise."""
    budget_cat = map_posting_to_budget_category(category)
    posting = Decimal(str(posting_amount or 0))

    budget_rows = (
        await db.execute(
            select(CoBudgetLine.amount_budgeted).where(
                CoBudgetLine.order_id == order_id,
                CoBudgetLine.category == budget_cat,
            )
        )
    ).all()
    amount_budgeted = sum((Decimal(str(r[0] or 0)) for r in budget_rows), Decimal("0"))
    enforced = len(budget_rows) > 0

    cost_cats: Iterable[str] = _COST_LINE_CATEGORIES.get(budget_cat, (budget_cat,))
    actual_rows = (
        await db.execute(
            select(CoOrderCostLine.amount_actual).where(
                CoOrderCostLine.order_id == order_id,
                CoOrderCostLine.category.in_(tuple(cost_cats)),
            )
        )
    ).all()
    amount_actual = sum((Decimal(str(r[0] or 0)) for r in actual_rows), Decimal("0"))
    available = max(Decimal("0"), amount_budgeted - amount_actual) if enforced else Decimal("0")

    return BudgetAvailability(
        category=budget_cat,
        amount_budgeted=amount_budgeted,
        amount_actual=amount_actual,
        posting_amount=posting,
        available=available,
        enforced=enforced,
    )


async def assert_budget_allows(
    db: AsyncSession,
    order_id: UUID,
    category: str,
    posting_amount: Decimal,
) -> BudgetAvailability:
    """
    Enforce category budget when budget lines exist.

    Returns the availability snapshot. Raises BudgetExceededError when the
    posting would push actuals above the budgeted amount.
    """
    availability = await get_budget_availability(db, order_id, category, posting_amount)
    if availability.would_exceed:
        raise BudgetExceededError(availability)
    return availability
