# app/services/commission/accrual_writer.py
"""
Persist AccrualDraft objects as CommissionAccrual rows with idempotency.

The unique constraint on (vendor_id, source_type, source_id, source_line_ref, payee_id, rule_id)
prevents duplicate writes on replay/retry.
"""
from __future__ import annotations

import logging
from typing import List
from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commission import CommissionAccrual
from app.services.commission.engine import AccrualDraft

log = logging.getLogger(__name__)


async def write_accruals(
    db: AsyncSession,
    drafts: List[AccrualDraft],
    created_by_id: UUID = None,
    auto_commit: bool = False,
    post_gl: bool = True,
) -> List[CommissionAccrual]:
    """Upsert AccrualDraft rows. Returns the persisted AccrualDraft rows (or empty on conflict).

    When post_gl=True (default), a commission_accrual GL journal entry is posted for each
    saved accrual that has a positive commission_amount.
    """
    if not drafts:
        return []

    saved: List[CommissionAccrual] = []
    for draft in drafts:
        row = CommissionAccrual(
            vendor_id=draft.vendor_id,
            payee_id=draft.payee_id,
            plan_id=draft.plan_id,
            rule_id=draft.rule_id,
            assignment_id=draft.assignment_id,
            source_type=draft.source_type,
            source_id=draft.source_id,
            source_line_ref=draft.source_line_ref,
            sale_date=draft.sale_date,
            store_id=draft.store_id,
            channel=draft.channel,
            base_amount=draft.base_amount,
            calculation_type=draft.calculation_type,
            value_applied=draft.value_applied,
            commission_amount=draft.commission_amount,
            points_amount=draft.points_amount,
            equity_units_amount=draft.equity_units_amount,
            currency=draft.currency,
            status="accrued",
            created_by_id=created_by_id,
        )
        try:
            # Use a savepoint so a unique violation doesn't abort the outer transaction
            async with db.begin_nested():
                db.add(row)
                await db.flush()
            saved.append(row)
        except Exception as exc:
            err = str(exc).lower()
            if "unique" in err or "uq_comm_accrual" in err:
                log.debug(
                    "Commission accrual already exists for %s/%s/%s — skipping",
                    draft.source_type, draft.source_id, draft.source_line_ref,
                )
            else:
                log.warning("Failed to write commission accrual: %s", exc)

    if post_gl and saved:
        from app.services.finance.posting import post_event  # local to avoid circular import
        for row in saved:
            amount = row.commission_amount or 0
            if amount <= 0:
                continue
            try:
                je = await post_event(
                    db, row.vendor_id,
                    "commission_accrual", row.id,
                    {
                        "amount": amount,
                        "payee_id": row.payee_id,
                        "store_id": row.store_id,
                        "currency": row.currency or "INR",
                        "narration": f"Commission accrual [{row.source_type}/{row.source_id}]",
                    },
                    created_by_id=created_by_id,
                )
                if je:
                    row.gl_entry_id = je.id
            except Exception as exc:
                log.warning("GL post failed for accrual %s: %s", row.id, exc)

    if auto_commit:
        await db.commit()

    return saved


async def reverse_accruals(
    db: AsyncSession,
    source_type: str,
    source_id: UUID,
    vendor_id: UUID,
    created_by_id: UUID = None,
    auto_commit: bool = False,
) -> List[CommissionAccrual]:
    """Create reversing accruals for a cancelled/refunded sale source."""
    from sqlalchemy import select, and_

    result = await db.execute(
        select(CommissionAccrual).where(
            and_(
                CommissionAccrual.vendor_id == vendor_id,
                CommissionAccrual.source_type == source_type,
                CommissionAccrual.source_id == source_id,
                CommissionAccrual.status.in_(["accrued", "approved"]),
                CommissionAccrual.reversal_of == None,
            )
        )
    )
    originals = result.scalars().all()

    reversals: List[CommissionAccrual] = []
    for orig in originals:
        reversal = CommissionAccrual(
            vendor_id=orig.vendor_id,
            payee_id=orig.payee_id,
            plan_id=orig.plan_id,
            rule_id=orig.rule_id,
            assignment_id=orig.assignment_id,
            source_type=orig.source_type,
            source_id=orig.source_id,
            source_line_ref=(orig.source_line_ref or "") + "_reversal",
            sale_date=orig.sale_date,
            store_id=orig.store_id,
            channel=orig.channel,
            base_amount=-orig.base_amount,
            calculation_type=orig.calculation_type,
            value_applied=orig.value_applied,
            commission_amount=-orig.commission_amount,
            points_amount=-orig.points_amount,
            equity_units_amount=-orig.equity_units_amount,
            currency=orig.currency,
            status="reversed",
            reversal_of=orig.id,
            created_by_id=created_by_id,
        )
        orig.status = "reversed"
        try:
            async with db.begin_nested():
                db.add(reversal)
                await db.flush()
            reversals.append(reversal)
        except Exception as exc:
            log.warning("Failed to write reversal for accrual %s: %s", orig.id, exc)

    if auto_commit:
        await db.commit()

    return reversals
