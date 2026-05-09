# app/services/commission/payout_service.py
"""Payout run management: build, approve, mark paid."""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, and_, func as sqlfunc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commission import (
    CommissionAccrual, CommissionPayoutRun, CommissionPayoutItem, CommissionApprovalLog,
)

log = logging.getLogger(__name__)


class PayoutService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _next_run_no(self, vendor_id: UUID) -> str:
        result = await self.db.execute(
            select(sqlfunc.count()).select_from(CommissionPayoutRun).where(
                CommissionPayoutRun.vendor_id == vendor_id
            )
        )
        count = result.scalar() or 0
        return f"CPR-{count + 1:05d}"

    async def build_run(
        self,
        vendor_id: UUID,
        period_start: Optional[date],
        period_end: Optional[date],
        payee_ids: Optional[list] = None,
        payment_method: str = "bank_transfer",
        notes: str = None,
        created_by_id: UUID = None,
    ) -> CommissionPayoutRun:
        """Aggregate approved accruals into a new payout run."""
        conditions = [
            CommissionAccrual.vendor_id == vendor_id,
            CommissionAccrual.status == "approved",
            CommissionAccrual.payout_item_id == None,
        ]
        if period_start:
            conditions.append(CommissionAccrual.sale_date >= period_start)
        if period_end:
            conditions.append(CommissionAccrual.sale_date <= period_end)
        if payee_ids:
            conditions.append(CommissionAccrual.payee_id.in_([UUID(p) for p in payee_ids]))

        result = await self.db.execute(
            select(CommissionAccrual).where(and_(*conditions))
        )
        accruals = result.scalars().all()
        if not accruals:
            raise ValueError("No approved accruals found for the given filters")

        run_no = await self._next_run_no(vendor_id)
        run = CommissionPayoutRun(
            vendor_id=vendor_id,
            run_no=run_no,
            period_start=period_start,
            period_end=period_end,
            status="open",
            payment_method=payment_method,
            notes=notes,
            created_by_id=created_by_id,
        )
        self.db.add(run)
        await self.db.flush()

        # Group by payee
        payee_map: dict[UUID, dict] = {}
        for acc in accruals:
            pid = acc.payee_id
            if pid not in payee_map:
                payee_map[pid] = {"amount": Decimal("0"), "points": Decimal("0"), "equity": Decimal("0"), "count": 0}
            payee_map[pid]["amount"] += acc.commission_amount or 0
            payee_map[pid]["points"] += acc.points_amount or 0
            payee_map[pid]["equity"] += acc.equity_units_amount or 0
            payee_map[pid]["count"] += 1

        total_amount = Decimal("0")
        total_points = Decimal("0")
        items_created: dict[UUID, CommissionPayoutItem] = {}

        for pid, totals in payee_map.items():
            item = CommissionPayoutItem(
                run_id=run.id,
                payee_id=pid,
                total_amount=totals["amount"],
                total_points=totals["points"],
                total_equity=totals["equity"],
                accrual_count=totals["count"],
                status="pending",
            )
            self.db.add(item)
            await self.db.flush()
            items_created[pid] = item
            total_amount += totals["amount"]
            total_points += totals["points"]

        # Link accruals to payout items
        for acc in accruals:
            acc.payout_item_id = items_created[acc.payee_id].id
            acc.status = "paid"  # lock into this run

        run.total_amount = total_amount
        run.total_points = total_points
        run.payee_count = len(payee_map)

        await self.db.commit()
        await self.db.refresh(run)
        return run

    async def approve_run(
        self, vendor_id: UUID, run_id: UUID, actor_id: UUID, notes: str = None
    ) -> CommissionPayoutRun:
        run = await self._get_run(vendor_id, run_id)
        if run.status != "open":
            raise ValueError(f"Run is {run.status}, cannot approve")
        run.status = "approved"
        run.approved_by_id = actor_id
        run.approved_at = datetime.now(timezone.utc)
        self._log(vendor_id, "payout_run", run_id, "approved", actor_id, notes)
        await self.db.commit()
        await self.db.refresh(run)
        return run

    async def pay_run(
        self, vendor_id: UUID, run_id: UUID, actor_id: UUID, notes: str = None
    ) -> CommissionPayoutRun:
        from app.services.finance.posting import post_event  # local import avoids circular

        run = await self._get_run(vendor_id, run_id)
        if run.status != "approved":
            raise ValueError(f"Run is {run.status}, must be approved before paying")
        run.status = "paid"
        run.paid_at = datetime.now(timezone.utc)
        # Mark payout items paid and post GL entries per payee
        result = await self.db.execute(
            select(CommissionPayoutItem).where(CommissionPayoutItem.run_id == run_id)
        )
        for item in result.scalars().all():
            item.status = "paid"
            item.paid_at = run.paid_at
            if item.total_amount and item.total_amount > 0:
                try:
                    je = await post_event(
                        self.db, vendor_id,
                        "commission_payment", item.id,
                        {
                            "amount": item.total_amount,
                            "payee_id": item.payee_id,
                            "currency": run.currency if hasattr(run, "currency") else "INR",
                            "narration": f"Commission Payment - Run {run.run_no}",
                        },
                        created_by_id=actor_id,
                    )
                    if je:
                        item.gl_entry_id = je.id
                except Exception as exc:
                    log.warning("GL post failed for payout item %s: %s", item.id, exc)
        self._log(vendor_id, "payout_run", run_id, "paid", actor_id, notes)
        await self.db.commit()
        await self.db.refresh(run)
        return run

    async def cancel_run(
        self, vendor_id: UUID, run_id: UUID, actor_id: UUID, notes: str = None
    ) -> CommissionPayoutRun:
        run = await self._get_run(vendor_id, run_id)
        if run.status == "paid":
            raise ValueError("Cannot cancel a paid run")
        # Restore accruals to approved status
        result = await self.db.execute(
            select(CommissionAccrual).where(
                and_(
                    CommissionAccrual.vendor_id == vendor_id,
                    CommissionAccrual.payout_item_id.in_(
                        select(CommissionPayoutItem.id).where(CommissionPayoutItem.run_id == run_id)
                    ),
                )
            )
        )
        for acc in result.scalars().all():
            acc.status = "approved"
            acc.payout_item_id = None
        run.status = "cancelled"
        self._log(vendor_id, "payout_run", run_id, "cancelled", actor_id, notes)
        await self.db.commit()
        await self.db.refresh(run)
        return run

    def _log(self, vendor_id, entity_type, entity_id, action, actor_id, notes):
        self.db.add(CommissionApprovalLog(
            vendor_id=vendor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            notes=notes,
        ))

    async def _get_run(self, vendor_id: UUID, run_id: UUID) -> CommissionPayoutRun:
        result = await self.db.execute(
            select(CommissionPayoutRun).where(
                and_(CommissionPayoutRun.id == run_id, CommissionPayoutRun.vendor_id == vendor_id)
            )
        )
        run = result.scalar_one_or_none()
        if not run:
            raise ValueError("Payout run not found")
        return run
