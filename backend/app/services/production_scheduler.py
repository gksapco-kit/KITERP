"""Scheduled production housekeeping: a daily attention digest per vendor.

The digest is a single in-app notification (at most one per vendor per day) listing

* live orders past their deadline / target date,
* live orders due within :data:`DUE_SOON_DAYS` days,
* error-level findings of the ledger reconciliation (:mod:`production_reconcile`).

It only reports. Repairs stay a deliberate manager action (``POST /production/reconciliation/repair``),
because they change posted stock.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.production import ProductionOrder
from app.services.production_lifecycle import TERMINAL_STATUSES
from app.services.production_reconcile import find_issues

log = logging.getLogger(__name__)

DUE_SOON_DAYS = 3
DIGEST_REFERENCE = "production_digest"
SessionFactory = Callable[[], Any]


async def vendor_ids(db: AsyncSession) -> list[UUID]:
    """Vendors that have at least one production order."""
    return sorted(set((await db.execute(select(ProductionOrder.vendor_id).distinct())).scalars().all()), key=str)


async def attention_summary(db: AsyncSession, vendor_id: UUID, today: Optional[date] = None) -> dict[str, Any]:
    today = today or date.today()
    soon = today + timedelta(days=DUE_SOON_DAYS)
    orders = (await db.execute(
        select(ProductionOrder).where(
            ProductionOrder.vendor_id == vendor_id,
            ProductionOrder.status.notin_(tuple(TERMINAL_STATUSES)),
            ProductionOrder.status != "draft",
        )
    )).scalars().all()
    overdue, due_soon = [], []
    for o in orders:
        due = o.delivery_deadline or o.target_date
        if due is None:
            continue
        if due < today:
            overdue.append({"ref": o.ref, "days_late": (today - due).days})
        elif due <= soon:
            due_soon.append({"ref": o.ref, "due": due.isoformat()})
    overdue.sort(key=lambda r: -r["days_late"])
    errors = [i for i in await find_issues(db, vendor_id) if i["severity"] == "error"]
    return {"overdue": overdue, "due_soon": due_soon, "reconciliation_errors": errors}


def _message(s: dict[str, Any]) -> str:
    parts = []
    if s["overdue"]:
        worst = ", ".join(f"{o['ref']} ({o['days_late']}d)" for o in s["overdue"][:3])
        parts.append(f"{len(s['overdue'])} overdue: {worst}")
    if s["due_soon"]:
        parts.append(f"{len(s['due_soon'])} due within {DUE_SOON_DAYS} days")
    if s["reconciliation_errors"]:
        parts.append(f"{len(s['reconciliation_errors'])} stock/ledger mismatch(es) to review")
    return "; ".join(parts)


async def send_digest(db: AsyncSession, vendor_id: UUID, today: Optional[date] = None) -> dict[str, Any]:
    summary = await attention_summary(db, vendor_id, today)
    counts = {
        "overdue": len(summary["overdue"]), "due_soon": len(summary["due_soon"]),
        "reconciliation_errors": len(summary["reconciliation_errors"]),
    }
    if not any(counts.values()):
        return {"sent": False, **counts}

    since = datetime.now(timezone.utc) - timedelta(hours=20)
    already = (await db.execute(
        select(Notification.id).where(
            Notification.vendor_id == vendor_id, Notification.reference_type == DIGEST_REFERENCE,
            Notification.created_at >= since,
        ).limit(1)
    )).first()
    if already:
        return {"sent": False, "reason": "already sent today", **counts}

    from app.services.notification_service import NotificationService

    await NotificationService(db).notify_hr_event(
        vendor_id=vendor_id, title="Production: orders need attention", message=_message(summary),
        notif_type="production", reference_type=DIGEST_REFERENCE,
    )
    return {"sent": True, **counts}


async def run_daily(session_factory: SessionFactory, today: Optional[date] = None) -> dict[str, dict[str, Any]]:
    """Send the digest for every vendor; one vendor's failure never stops the rest."""
    async with session_factory() as db:
        ids = await vendor_ids(db)
    results: dict[str, dict[str, Any]] = {}
    for vid in ids:
        async with session_factory() as db:
            try:
                results[str(vid)] = await send_digest(db, vid, today)
                await db.commit()
            except Exception as exc:  # noqa: BLE001 - isolate tenants
                await db.rollback()
                log.exception("production daily job failed for vendor %s", vid)
                results[str(vid)] = {"error": str(exc)[:300]}
    return results
