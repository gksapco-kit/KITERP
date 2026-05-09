"""Execute workflow steps for a triggered entity."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _run(workflow_id: UUID, entity_type: str, entity_id: UUID, context: dict[str, Any] | None = None) -> dict:
    from app.models.crm import (
        CrmWorkflow, CrmWorkflowRun, CrmActivity, CrmCampaignEnrollment,
    )
    from app.tasks.crm.send_email import send_email_now
    from app.tasks.crm.send_sms import send_sms_now

    context = context or {}
    log_entries: list[dict] = []
    async with AsyncSessionLocal() as db:
        wf_row = await db.execute(select(CrmWorkflow).where(CrmWorkflow.id == workflow_id))
        wf = wf_row.scalar_one_or_none()
        if not wf:
            return {"ok": False, "error": "workflow_not_found"}

        run = CrmWorkflowRun(
            workflow_id=wf.id, vendor_id=wf.vendor_id,
            entity_type=entity_type, entity_id=entity_id, status="running",
        )
        db.add(run)
        await db.flush()

        steps = wf.steps or []
        try:
            for idx, step in enumerate(steps):
                action = step.get("action")
                params = step.get("params", {})
                outcome = {"step": idx, "action": action, "ok": True}

                if action == "send_email":
                    outcome["result"] = send_email_now(
                        vendor_id=wf.vendor_id,
                        contact_id=UUID(params["contact_id"]) if params.get("contact_id") else None,
                        subject=params.get("subject", "Notification"),
                        body_html=params.get("body_html", params.get("body", "")),
                    )
                elif action == "send_sms":
                    outcome["result"] = send_sms_now(
                        vendor_id=wf.vendor_id,
                        contact_id=UUID(params["contact_id"]) if params.get("contact_id") else None,
                        body=params.get("body", ""),
                        to_phone=params.get("to_phone"),
                    )
                elif action == "create_activity":
                    db.add(CrmActivity(
                        vendor_id=wf.vendor_id,
                        owner_id=UUID(params["owner_id"]) if params.get("owner_id") else None,
                        type=params.get("type", "task"),
                        subject=params.get("subject", "Workflow task"),
                        description=params.get("description"),
                        related_type=entity_type,
                        related_id=entity_id,
                    ))
                elif action == "enroll_campaign":
                    db.add(CrmCampaignEnrollment(
                        campaign_id=UUID(params["campaign_id"]),
                        contact_id=UUID(params["contact_id"]) if params.get("contact_id") else entity_id,
                        vendor_id=wf.vendor_id,
                        next_action_at=datetime.now(timezone.utc),
                    ))
                elif action == "webhook":
                    import httpx
                    try:
                        async with httpx.AsyncClient(timeout=10.0) as client:
                            resp = await client.post(params["url"], json={**context, **params.get("payload", {})})
                            outcome["status"] = resp.status_code
                    except Exception as e:
                        outcome["ok"] = False
                        outcome["error"] = str(e)
                else:
                    outcome["ok"] = False
                    outcome["error"] = f"unknown_action:{action}"

                log_entries.append(outcome)

            run.status = "success"
            run.log = log_entries
            run.finished_at = datetime.now(timezone.utc)
            wf.last_run_at = run.finished_at
            wf.run_count = (wf.run_count or 0) + 1
            wf.success_count = (wf.success_count or 0) + 1
        except Exception as e:
            run.status = "failed"
            run.error = str(e)
            run.log = log_entries
            run.finished_at = datetime.now(timezone.utc)
            wf.failure_count = (wf.failure_count or 0) + 1

        await db.commit()
        return {"ok": run.status == "success", "log": log_entries}


def execute_now(workflow_id: UUID, entity_type: str, entity_id: UUID, context: dict | None = None) -> dict:
    return asyncio.run(_run(workflow_id, entity_type, entity_id, context))


if CELERY_AVAILABLE and celery_app is not None:
    @celery_app.task(name="crm.workflow.execute")
    def workflow_execute_task(workflow_id: str, entity_type: str, entity_id: str, context: dict | None = None) -> dict:
        return asyncio.run(_run(UUID(workflow_id), entity_type, UUID(entity_id), context))
else:
    def workflow_execute_task(*args, **kwargs):  # type: ignore[no-redef]
        return execute_now(*args, **kwargs)
