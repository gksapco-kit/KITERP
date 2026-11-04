"""Scheduled (background) work for the Real Estate module.

Everything here is idempotent, runs per vendor in its own transaction (one vendor's failure never blocks the
others) and is driven by ``app.tasks.realestate.jobs`` through Celery beat.

Always on (they only correct state that the screens already fix lazily on open):
  * release expired unit blocks, expire finished leases and warranties
  * retry ledger postings that previously failed
  * the daily alert digest (in-app notification when something is critical)

Opt-in per vendor through ``re_setting`` ``auto_billing`` = ``{"rent": true, "maintenance": true}``:
  * bill the current month's rent and society maintenance
"""
from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any, Callable, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import String, cast, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.realestate import operations as O
from app.models.realestate.admin import ReGlFailure, ReIntegration, ReSetting
from app.models.realestate.base import ENC_PREFIX, walk_secrets
from app.models.realestate.core import ReProject

from . import alerts as alerts_svc
from . import booking as booking_svc
from . import finance_bridge
from . import leasing, messaging, postsales, society
from .common import Ctx, notify

log = logging.getLogger(__name__)

MAX_GL_RETRIES = 10  # after this many attempts a failure waits for a person (it stays visible in the issues list)

SessionFactory = Callable[[], Any]


def system_ctx(db: AsyncSession, vendor_id: UUID) -> Ctx:
    return Ctx(db=db, vendor_id=vendor_id, user_id=None, actor_name="System (scheduled)", permissions=frozenset(), role="system")


async def get_setting(db: AsyncSession, vendor_id: UUID, key: str, default: Optional[dict] = None) -> dict:
    row = (await db.execute(select(ReSetting).where(ReSetting.vendor_id == vendor_id, ReSetting.key == key))).scalar_one_or_none()
    return dict(row.value or {}) if row is not None else dict(default or {})


async def vendor_ids(db: AsyncSession) -> list[UUID]:
    """Every vendor that actually uses the module (has a project or has configured an integration)."""
    ids = set((await db.execute(select(ReProject.vendor_id).distinct())).scalars().all())
    ids |= set((await db.execute(select(ReIntegration.vendor_id).distinct())).scalars().all())
    return sorted(ids, key=str)


async def housekeeping(db: AsyncSession, vendor_id: UUID) -> dict:
    return {
        "blocks_released": await booking_svc.release_expired_blocks(db, vendor_id),
        "leases_expired": await leasing.expire_leases(db, vendor_id),
        "warranties_expired": await postsales.expire_warranties(db, vendor_id),
    }


async def encrypt_legacy_secrets(db: AsyncSession, vendor_id: UUID) -> int:
    """Rewrite integration configs saved before encryption-at-rest existed (the column type encrypts on write)."""
    raw = (await db.execute(select(ReIntegration.id, cast(literal_column("re_integration.config"), String)).where(
        ReIntegration.vendor_id == vendor_id))).all()
    stale = []
    for rid, text_value in raw:
        try:
            cfg = json.loads(text_value) if text_value else {}
        except ValueError:
            continue
        plain: list[str] = []

        def _spot(v: str) -> str:
            if not v.startswith(ENC_PREFIX):
                plain.append(v)
            return v

        walk_secrets(cfg, _spot)
        if plain:
            stale.append(rid)
    for rid in stale:
        obj = await db.get(ReIntegration, rid)
        flag_modified(obj, "config")
    return len(stale)


async def retry_gl_failures(db: AsyncSession, vendor_id: UUID) -> dict:
    rows = (await db.execute(select(ReGlFailure).where(
        ReGlFailure.vendor_id == vendor_id, ReGlFailure.status == "open", ReGlFailure.attempts < MAX_GL_RETRIES).limit(200))).scalars().all()
    resolved = 0
    for f in rows:
        if (await finance_bridge.retry_failure(db, f))["status"] == "resolved":
            resolved += 1
    return {"tried": len(rows), "resolved": resolved}


async def auto_billing(db: AsyncSession, vendor_id: UUID, today: date) -> dict:
    cfg = await get_setting(db, vendor_id, "auto_billing")
    out: dict[str, Any] = {"rent_invoices": 0, "maintenance_bills": 0}
    ctx = system_ctx(db, vendor_id)
    if cfg.get("rent"):
        res = await leasing.bill_month(ctx, today)
        out["rent_invoices"] = len(res["created"])
    if cfg.get("maintenance"):
        plans = (await db.execute(select(O.ReMaintenancePlan).where(
            O.ReMaintenancePlan.vendor_id == vendor_id, O.ReMaintenancePlan.is_active.is_(True)))).scalars().all()
        for plan in plans:
            try:
                async with db.begin_nested():
                    res = await society.generate_bills(ctx, plan, today)
                out["maintenance_bills"] += len(res["created"])
            except HTTPException as exc:  # e.g. a quarterly plan outside its billing month: not an error
                log.info("maintenance billing skipped for plan %s: %s", plan.id, exc.detail)
    return out


async def alert_digest(db: AsyncSession, vendor_id: UUID) -> dict:
    cfg = await get_setting(db, vendor_id, "alert_digest", {"enabled": True})
    if not cfg.get("enabled", True):
        return {"sent": False}
    items = await alerts_svc.collect(system_ctx(db, vendor_id))
    critical = [a for a in items if a["severity"] == "critical"]
    if not critical:
        return {"sent": False, "critical": 0, "total": len(items)}
    top = "; ".join(a["title"] for a in critical[:3])
    await notify(db, vendor_id, "Real estate: items need attention",
                 f"{len(critical)} critical and {len(items) - len(critical)} other alerts. Most urgent: {top}")
    return {"sent": True, "critical": len(critical), "total": len(items)}


async def run_for_vendor(db: AsyncSession, vendor_id: UUID, today: Optional[date] = None) -> dict:
    today = today or date.today()
    report: dict[str, Any] = {}
    report["housekeeping"] = await housekeeping(db, vendor_id)
    report["secrets_encrypted"] = await encrypt_legacy_secrets(db, vendor_id)
    report["gl_retry"] = await retry_gl_failures(db, vendor_id)
    report["billing"] = await auto_billing(db, vendor_id, today)
    report["reminders"] = await messaging.send_overdue_reminders(db, vendor_id, today)
    report["outbox"] = await messaging.dispatch_queued(db, vendor_id)
    report["digest"] = await alert_digest(db, vendor_id)
    return report


async def run_daily(session_factory: SessionFactory, today: Optional[date] = None) -> dict[str, Any]:
    """Run the daily jobs for every real-estate vendor. Returns ``{vendor_id: report | {"error": ...}}``."""
    async with session_factory() as db:
        vendors = await vendor_ids(db)
    results: dict[str, Any] = {}
    for vid in vendors:
        async with session_factory() as db:
            try:
                results[str(vid)] = await run_for_vendor(db, vid, today)
                await db.commit()
            except Exception as exc:  # isolate: one vendor's problem must not stop the others
                await db.rollback()
                log.exception("Real-estate daily job failed for vendor %s", vid)
                results[str(vid)] = {"error": str(exc)[:300]}
    return results


async def run_outbox(session_factory: SessionFactory) -> dict[str, Any]:
    """Deliver queued customer emails / SMS for every vendor that has any (runs every minute)."""
    from app.models.realestate.core import ReCommunication

    async with session_factory() as db:
        vendors = list((await db.execute(select(ReCommunication.vendor_id).where(ReCommunication.status == "queued").distinct())).scalars().all())
    results: dict[str, Any] = {}
    for vid in vendors:
        async with session_factory() as db:
            try:
                results[str(vid)] = await messaging.dispatch_queued(db, vid)
                await db.commit()
            except Exception as exc:
                await db.rollback()
                log.exception("Real-estate outbox failed for vendor %s", vid)
                results[str(vid)] = {"error": str(exc)[:300]}
    return results