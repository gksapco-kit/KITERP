"""
Celery app for background CRM tasks (campaign sends, drip steps, workflow runs,
SLA escalation, AI scoring, journey aggregation).

Run with:
    celery -A app.worker worker -l info
    celery -A app.worker beat -l info

If Celery isn't available or the broker isn't reachable, the helpers in
``app.tasks.crm`` fall back to running synchronously so the rest of the app
still works in dev environments without a Redis broker.
"""
from __future__ import annotations

import os

from app.config import settings

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", settings.REDIS_URL + "/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", settings.REDIS_URL + "/2")

try:
    from celery import Celery  # type: ignore

    celery_app = Celery(
        "kiterp_crm",
        broker=CELERY_BROKER_URL,
        backend=CELERY_RESULT_BACKEND,
        include=[
            "app.tasks.crm.send_email",
            "app.tasks.crm.send_sms",
            "app.tasks.crm.send_whatsapp",
            "app.tasks.crm.drip_step",
            "app.tasks.crm.workflow_execute",
            "app.tasks.crm.sla_escalate",
            "app.tasks.crm.ai_jobs",
            "app.tasks.crm.journey_aggregate",
            # Finance tasks
            "app.tasks.finance.finance_jobs",
            # Website tasks
            "app.tasks.websites.scheduled_publish",
        ],
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
    )

    # Periodic schedule (Celery beat)
    celery_app.conf.beat_schedule = {
        "crm-drip-tick": {
            "task": "crm.drip.tick",
            "schedule": 60.0,  # seconds
        },
        "crm-sla-escalate": {
            "task": "crm.tickets.sla_check",
            "schedule": 300.0,
        },
        "crm-journey-aggregate": {
            "task": "crm.journey.aggregate",
            "schedule": 900.0,
        },
        # Finance periodic jobs
        "finance-depreciation-monthly": {
            "task": "finance.run_depreciation",
            "schedule": 30 * 24 * 3600,  # every ~30 days
        },
        "finance-aging-nightly": {
            "task": "finance.snapshot_aging",
            "schedule": 86400,  # daily
        },
        "finance-recurring-journals-daily": {
            "task": "finance.process_recurring_journals",
            "schedule": 86400,
        },
        "finance-budget-variance-weekly": {
            "task": "finance.refresh_budget_variance",
            "schedule": 7 * 86400,
        },
        "finance-tax-precompute-daily": {
            "task": "finance.precompute_tax_returns",
            "schedule": 86400,
        },
        # Website scheduled-publish: pages marked publish_status='scheduled'
        # with scheduled_publish_at in the past flip to published once a min.
        "websites-scheduled-publish-tick": {
            "task": "websites.scheduled_publish.tick",
            "schedule": 60.0,
        },
    }

    CELERY_AVAILABLE = True
except Exception:  # pragma: no cover - celery not installed or broker not reachable
    celery_app = None
    CELERY_AVAILABLE = False
