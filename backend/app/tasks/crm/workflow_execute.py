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


def _resolve_context_vars(value: str, context: dict) -> str:
    """Replace {{event.key}} placeholders with values from the event context."""
    if not isinstance(value, str):
        return value
    import re
    def _sub(m: re.Match) -> str:
        key = m.group(1).strip()
        # Support dot-path lookups: event.name → context["name"]
        if key.startswith("event."):
            return str(context.get(key[6:], "") or "")
        return str(context.get(key, "") or "")
    return re.sub(r"\{\{([^}]+)\}\}", _sub, value)


def _resolve_params(params: dict, context: dict) -> dict:
    return {k: _resolve_context_vars(v, context) if isinstance(v, str) else v
            for k, v in params.items()}


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
                    rp = _resolve_params(params, context)
                    outcome["result"] = send_email_now(
                        vendor_id=wf.vendor_id,
                        contact_id=UUID(rp["contact_id"]) if rp.get("contact_id") else None,
                        subject=rp.get("subject", "Notification"),
                        body_html=rp.get("body_html", rp.get("body", "")),
                        to_email=rp.get("to_email") or None,
                    )
                elif action == "send_sms":
                    rp = _resolve_params(params, context)
                    outcome["result"] = send_sms_now(
                        vendor_id=wf.vendor_id,
                        contact_id=UUID(rp["contact_id"]) if rp.get("contact_id") else None,
                        body=rp.get("body", ""),
                        to_phone=rp.get("to_phone") or None,
                    )
                elif action == "create_activity":
                    from app.services.crm.numbering import next_crm_number
                    db.add(CrmActivity(
                        vendor_id=wf.vendor_id,
                        number=await next_crm_number(db, wf.vendor_id, CrmActivity, "TSK", entity_type="activity"),
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
