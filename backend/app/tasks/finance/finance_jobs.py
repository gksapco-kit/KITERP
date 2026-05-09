"""
Finance Celery background jobs.
All tasks use async_to_sync to call the async repository methods.
"""
from __future__ import annotations

import logging
from datetime import date, datetime

from celery import shared_task

log = logging.getLogger(__name__)


def _get_db_session():
    """Get a synchronous SQLAlchemy session for Celery tasks."""
    from app.database import SyncSessionLocal
    return SyncSessionLocal()


# ─────────────────────────────────────────────────────────────────────────────
# 1. Monthly Depreciation Run
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="finance.run_depreciation", bind=True, max_retries=3)
def run_depreciation_task(self):
    """
    Run monthly depreciation for all active assets across all vendors.
    Scheduled: 1st of each month.
    """
    import asyncio
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.finance import FinAsset
    from app.models.vendor import Vendor
    from app.repositories.finance.finance_repo import FinAssetRepo
    from app.services.finance.posting import post_event

    async def _run():
        async with AsyncSessionLocal() as db:
            try:
                r = await db.execute(
                    select(Vendor).where(Vendor.is_active == True)
                )
                vendors = r.scalars().all()
                total_processed = 0
                for vendor in vendors:
                    try:
                        repo = FinAssetRepo(db)
                        assets = await repo.list_assets(vendor.id, status="active")
                        for asset in assets:
                            amount = await repo.calculate_depreciation(asset)
                            if amount > 0:
                                je = await post_event(db, vendor.id, "depreciation", asset.id, {
                                    "amount": float(amount),
                                    "narration": f"Monthly Depreciation: {asset.name}",
                                })
                                await repo.record_depreciation(
                                    vendor.id, asset, amount,
                                    je_id=je.id if je else None
                                )
                                total_processed += 1
                        await db.commit()
                    except Exception:
                        log.exception("Depreciation failed for vendor %s", vendor.id)
                log.info("Depreciation run complete: %d entries created", total_processed)
            except Exception:
                log.exception("Depreciation run failed")

    asyncio.run(_run())


# ─────────────────────────────────────────────────────────────────────────────
# 2. Nightly AR/AP Aging Snapshots
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="finance.snapshot_aging", bind=True, max_retries=3)
def snapshot_aging_task(self):
    """
    Nightly: compute AR and AP aging buckets and cache them.
    Scheduled: daily at 2 AM.
    """
    import asyncio
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.vendor import Vendor
    from app.models.finance import FinArAgingSnapshot, FinApAgingSnapshot
    from app.repositories.finance.finance_repo import FinARRepo, FinAPRepo
    import uuid

    async def _run():
        async with AsyncSessionLocal() as db:
            try:
                r = await db.execute(select(Vendor).where(Vendor.is_active == True))
                vendors = r.scalars().all()
                today = date.today()
                for vendor in vendors:
                    try:
                        # AR
                        ar_buckets = await FinARRepo(db).ar_aging(vendor.id, today)
                        for bucket in ar_buckets:
                            snap = FinArAgingSnapshot(
                                id=uuid.uuid4(),
                                vendor_id=vendor.id,
                                snapshot_date=today,
                                customer_id=bucket.get("customer_id"),
                                current_amt=bucket.get("current", 0),
                                days_1_30=bucket.get("1_30", 0),
                                days_31_60=bucket.get("31_60", 0),
                                days_61_90=bucket.get("61_90", 0),
                                days_90_plus=bucket.get("90_plus", 0),
                                total_outstanding=sum([
                                    bucket.get("current", 0), bucket.get("1_30", 0),
                                    bucket.get("31_60", 0), bucket.get("61_90", 0),
                                    bucket.get("90_plus", 0),
                                ])
                            )
                            db.add(snap)
                        # AP
                        ap_buckets = await FinAPRepo(db).ap_aging(vendor.id, today)
                        for bucket in ap_buckets:
                            snap = FinApAgingSnapshot(
                                id=uuid.uuid4(),
                                vendor_id=vendor.id,
                                snapshot_date=today,
                                supplier_id=bucket.get("supplier_id"),
                                current_amt=bucket.get("current", 0),
                                days_1_30=bucket.get("1_30", 0),
                                days_31_60=bucket.get("31_60", 0),
                                days_61_90=bucket.get("61_90", 0),
                                days_90_plus=bucket.get("90_plus", 0),
                                total_outstanding=sum([
                                    bucket.get("current", 0), bucket.get("1_30", 0),
                                    bucket.get("31_60", 0), bucket.get("61_90", 0),
                                    bucket.get("90_plus", 0),
                                ])
                            )
                            db.add(snap)
                        await db.commit()
                    except Exception:
                        log.exception("Aging snapshot failed for vendor %s", vendor.id)
            except Exception:
                log.exception("Aging snapshot task failed")

    asyncio.run(_run())


# ─────────────────────────────────────────────────────────────────────────────
# 3. Recurring Journal Processing
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="finance.process_recurring_journals", bind=True, max_retries=3)
def process_recurring_journals_task(self):
    """
    Daily: check recurring journal templates and create new JEs if due.
    """
    import asyncio
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.finance import FinRecurringTemplate
    from app.services.finance.posting import post_event
    import uuid

    async def _run():
        async with AsyncSessionLocal() as db:
            today = date.today()
            try:
                r = await db.execute(
                    select(FinRecurringTemplate).where(
                        FinRecurringTemplate.is_active == True,
                        FinRecurringTemplate.next_run_date <= today,
                    )
                )
                templates = r.scalars().all()
                for tmpl in templates:
                    try:
                        await post_event(db, tmpl.vendor_id, "manual", uuid.uuid4(), {
                            "lines": tmpl.template_lines or [],
                            "narration": f"Recurring: {tmpl.name}",
                            "entry_date": today,
                        })
                        # Advance next_run_date
                        from dateutil.relativedelta import relativedelta
                        freq_map = {
                            "daily": relativedelta(days=1),
                            "weekly": relativedelta(weeks=1),
                            "monthly": relativedelta(months=1),
                            "quarterly": relativedelta(months=3),
                            "yearly": relativedelta(years=1),
                        }
                        delta = freq_map.get(tmpl.frequency, relativedelta(months=1))
                        tmpl.next_run_date = (tmpl.next_run_date or today) + delta
                        if tmpl.end_date and tmpl.next_run_date > tmpl.end_date:
                            tmpl.is_active = False
                        await db.commit()
                        log.info("Processed recurring journal template %s", tmpl.id)
                    except Exception:
                        log.exception("Failed to process recurring template %s", tmpl.id)
            except Exception:
                log.exception("Recurring journal task failed")

    asyncio.run(_run())


# ─────────────────────────────────────────────────────────────────────────────
# 4. Period Close
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="finance.close_period", bind=True)
def close_period_task(self, vendor_id: str, period_id: str, closed_by_id: str):
    """
    Close a specific period (locks JEs for that period).
    Called explicitly by the user via API or scheduled at month-end.
    """
    import asyncio
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.finance import FinPeriod
    import uuid

    async def _run():
        async with AsyncSessionLocal() as db:
            try:
                r = await db.execute(
                    select(FinPeriod).where(
                        FinPeriod.id == uuid.UUID(period_id),
                        FinPeriod.vendor_id == uuid.UUID(vendor_id),
                    )
                )
                period = r.scalar_one_or_none()
                if period and period.status == "open":
                    from app.repositories.finance.finance_repo import FinCOARepo
                    await FinCOARepo(db).close_period(period, uuid.UUID(closed_by_id))
                    await db.commit()
                    log.info("Period %s closed for vendor %s", period_id, vendor_id)
            except Exception:
                log.exception("Period close failed for period %s", period_id)

    asyncio.run(_run())


# ─────────────────────────────────────────────────────────────────────────────
# 5. Tax Return Pre-computation
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="finance.precompute_tax_returns", bind=True, max_retries=2)
def precompute_tax_returns_task(self):
    """
    Monthly: pre-compute GSTR1 and GSTR3B for open tax returns near their due date.
    """
    import asyncio
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.finance import FinTaxReturn
    from app.repositories.finance.finance_repo import FinTaxRepo

    async def _run():
        async with AsyncSessionLocal() as db:
            today = date.today()
            try:
                r = await db.execute(
                    select(FinTaxReturn).where(
                        FinTaxReturn.status.in_(["draft"]),
                        FinTaxReturn.due_date.isnot(None),
                    )
                )
                returns = r.scalars().all()
                repo = FinTaxRepo(db)
                for tr in returns:
                    # Pre-compute if due within 7 days
                    if tr.due_date and (tr.due_date - today).days <= 7:
                        try:
                            if tr.return_type == "GSTR1":
                                computed = await repo.compute_gstr1(
                                    tr.vendor_id, tr.period_start, tr.period_end)
                            elif tr.return_type == "GSTR3B":
                                computed = await repo.compute_gstr3b(
                                    tr.vendor_id, tr.period_start, tr.period_end)
                            else:
                                continue
                            await repo.update_return(tr, {
                                "status": "computed",
                                "computed_json": computed,
                                "net_payable": computed.get("net_payable", 0),
                            })
                            await db.commit()
                            log.info("Pre-computed tax return %s", tr.id)
                        except Exception:
                            log.exception("Failed to pre-compute tax return %s", tr.id)
            except Exception:
                log.exception("Tax precompute task failed")

    asyncio.run(_run())


# ─────────────────────────────────────────────────────────────────────────────
# 6. Budget Variance Refresh
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(name="finance.refresh_budget_variance", bind=True)
def refresh_budget_variance_task(self):
    """Weekly: log budget vs actual variance summary."""
    import asyncio
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.finance import FinBudget
    from app.repositories.finance.finance_repo import FinBudgetRepo

    async def _run():
        async with AsyncSessionLocal() as db:
            try:
                r = await db.execute(
                    select(FinBudget).where(FinBudget.status == "active")
                )
                budgets = r.scalars().all()
                repo = FinBudgetRepo(db)
                for b in budgets:
                    variance = await repo.budget_variance(b.vendor_id, b.id)
                    log.info("Budget %s variance computed: %d lines", b.id, len(variance))
            except Exception:
                log.exception("Budget variance refresh failed")

    asyncio.run(_run())
