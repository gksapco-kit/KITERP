"""Daily Asset Management sweep: due maintenance -> work orders, expiring warranty / insurance / licences,
overdue returns. Idempotent, per-vendor, and safe to run any number of times a day."""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import AmAsset, AmAssignment, AmCoverage, AmLicense
from app.services.asset_mgmt import maintenance
from app.services.notification_service import NotificationService

log = logging.getLogger(__name__)


async def _coverage_alerts(db: AsyncSession, vendor_id: UUID, notes: NotificationService, today: date) -> int:
    sent = 0
    rows = (await db.execute(
        select(AmCoverage, AmAsset.asset_tag, AmAsset.name).join(AmAsset, AmAsset.id == AmCoverage.asset_id)
        .where(AmCoverage.vendor_id == vendor_id, AmCoverage.is_active.is_(True), AmCoverage.end_date.isnot(None),
               AmAsset.status.notin_(("disposed", "retired")))
    )).all()
    for c, tag, name in rows:
        left = (c.end_date - today).days
        window = c.renewal_alert_days or 30
        first_warning = left <= window and c.last_alerted_on is None
        expiry_day = left <= 0 and (c.last_alerted_on is None or c.last_alerted_on < c.end_date)
        if not (first_warning or expiry_day):
            continue
        kind = {"warranty": "Warranty", "insurance": "Insurance", "amc": "Maintenance contract"}.get(c.coverage_type, "Coverage")
        msg = (f"{kind} for {tag} ({name}) expired on {c.end_date:%d %b %Y}." if left < 0
               else f"{kind} for {tag} ({name}) expires {'today' if left == 0 else f'in {left} day(s)'} ({c.end_date:%d %b %Y}).")
        await notes.notify_hr_event(vendor_id=vendor_id, title=f"{kind} {'expired' if left < 0 else 'expiring'}", message=msg,
                                    notif_type="assets.coverage", reference_id=c.asset_id, reference_type="asset")
        c.last_alerted_on = today
        sent += 1
    return sent


async def _license_alerts(db: AsyncSession, vendor_id: UUID, notes: NotificationService, today: date) -> int:
    sent = 0
    for lic in (await db.execute(select(AmLicense).where(
            AmLicense.vendor_id == vendor_id, AmLicense.is_active.is_(True), AmLicense.expiry_date.isnot(None)))).scalars().all():
        left = (lic.expiry_date - today).days
        window = lic.renewal_alert_days or 30
        first_warning = left <= window and lic.last_alerted_on is None
        expiry_day = left <= 0 and (lic.last_alerted_on is None or lic.last_alerted_on < lic.expiry_date)
        if not (first_warning or expiry_day):
            continue
        msg = (f"Licence '{lic.name}' expired on {lic.expiry_date:%d %b %Y}." if left < 0
               else f"Licence '{lic.name}' expires {'today' if left == 0 else f'in {left} day(s)'} ({lic.expiry_date:%d %b %Y}).")
        await notes.notify_hr_event(vendor_id=vendor_id, title="Licence " + ("expired" if left < 0 else "expiring"), message=msg,
                                    notif_type="assets.license", reference_id=lic.id, reference_type="asset_license")
        lic.last_alerted_on = today
        sent += 1
    return sent


async def vendor_daily(db: AsyncSession, vendor_id: UUID) -> Dict[str, Any]:
    today = date.today()
    notes = NotificationService(db)
    created = await maintenance.generate_due_work_orders(db, vendor_id, lead_days=7)
    if created:
        await notes.notify_hr_event(
            vendor_id=vendor_id, title="Maintenance due",
            message=f"{len(created)} preventive work order(s) were scheduled: " + ", ".join(w.wo_no for w in created[:5])
                    + ("…" if len(created) > 5 else ""),
            notif_type="assets.maintenance", reference_type="asset_work_order")
    cov = await _coverage_alerts(db, vendor_id, notes, today)
    lic = await _license_alerts(db, vendor_id, notes, today)
    overdue = (await db.execute(select(func.count(AmAssignment.id)).where(
        AmAssignment.vendor_id == vendor_id, AmAssignment.returned_at.is_(None),
        AmAssignment.due_back_on.isnot(None), AmAssignment.due_back_on < today))).scalar_one()
    if overdue:
        await notes.notify_hr_event(vendor_id=vendor_id, title="Assets overdue for return",
                                    message=f"{overdue} asset(s) are past their return date.",
                                    notif_type="assets.overdue", reference_type="asset_assignment")
    return {"work_orders_created": len(created), "coverage_alerts": cov, "license_alerts": lic, "overdue_returns": int(overdue)}


async def run_daily(session_factory) -> Dict[str, Any]:
    async with session_factory() as db:
        vendor_ids = set((await db.execute(select(AmAsset.vendor_id).distinct())).scalars().all())
        vendor_ids |= set((await db.execute(select(AmLicense.vendor_id).distinct())).scalars().all())
    results: Dict[str, Any] = {}
    for vid in vendor_ids:
        async with session_factory() as db:
            try:
                results[str(vid)] = await vendor_daily(db, vid)
                await db.commit()
            except Exception as exc:   # one tenant must never stop the sweep
                await db.rollback()
                log.exception("assets.daily failed for vendor %s", vid)
                results[str(vid)] = {"error": str(exc)[:200]}
    return results
