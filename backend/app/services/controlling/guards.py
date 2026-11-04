"""State guards for Controlling orders and cost versions.

Rules
-----
* An order's structure (header, cost lines, operations, budgets) is editable only while it is
  ``draft`` / ``released`` / ``in_progress`` **and** nothing has been posted to the GL for it,
  it is not a mirror of a Production order, and it is not covered by a posted variance run.
* Actuals (component movements, activity confirmations) are accepted only on ``released`` /
  ``in_progress`` orders that are still editable.
* Finished-goods receipts are also accepted after completion (they feed COGS) until the order
  is closed / cancelled.
* Product cost versions are editable only in ``draft``.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import CoManufacturingOrder, CoProductCostVersion
from app.services.controlling.settlement import order_in_posted_variance_run

EDITABLE_STATUSES = ("draft", "released", "in_progress")
ACTUALS_STATUSES = ("released", "in_progress")
RECEIPT_STATUSES = ("released", "in_progress", "completed")


class StateError(ValueError):
    """Raised when an operation is not allowed in the document's current state (HTTP 409)."""


def is_mirror_order(order: CoManufacturingOrder) -> bool:
    return (order.ref_doc_type or "") == "production_order"


async def assert_order_editable(db: AsyncSession, order: CoManufacturingOrder, what: str = "order") -> None:
    if is_mirror_order(order):
        raise StateError(
            f"Order {order.order_no} mirrors a Production order and is read-only here — change the production order instead."
        )
    if (order.status or "draft") not in EDITABLE_STATUSES:
        raise StateError(f"Order {order.order_no} is {order.status}; its {what} can no longer be changed.")
    if order.production_completion_journal_id:
        raise StateError(
            f"Production completion is posted for order {order.order_no}; reverse the posting before changing its {what}."
        )
    if await order_in_posted_variance_run(db, order.id):
        raise StateError(f"Order {order.order_no} is covered by a posted variance run and is locked.")


async def assert_order_accepts_actuals(db: AsyncSession, order: CoManufacturingOrder) -> None:
    if (order.status or "draft") not in ACTUALS_STATUSES:
        raise StateError(
            f"Order {order.order_no} is {order.status}; actuals can only be booked on released / in-progress orders."
        )
    await assert_order_editable(db, order, "actuals")


async def assert_order_accepts_receipt(db: AsyncSession, order: CoManufacturingOrder) -> None:
    if is_mirror_order(order):
        raise StateError(f"Order {order.order_no} mirrors a Production order; receipts are managed by Production.")
    if (order.status or "draft") not in RECEIPT_STATUSES:
        raise StateError(f"Order {order.order_no} is {order.status}; goods receipts need a released / in-progress / completed order.")
    if await order_in_posted_variance_run(db, order.id):
        raise StateError(f"Order {order.order_no} is covered by a posted variance run and is locked.")


def assert_version_editable(ver: CoProductCostVersion, what: str = "lines") -> None:
    if (ver.status or "draft") != "draft":
        raise StateError(
            f"Cost version is {ver.status}; only draft versions can have their {what} changed. "
            "Create a new version to revise the standard."
        )
