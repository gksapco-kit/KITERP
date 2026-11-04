"""Approval workflow: rules decide when a document needs sign-off; handlers apply the outcome."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Awaitable, Callable, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select

from app.models.realestate.admin import ReApprovalRequest, ReApprovalRule

from .common import Ctx, D, audit, notify

# entity_type -> async handler(ctx, entity_id, approved: bool, request)
APPROVAL_HANDLERS: dict[str, Callable[[Ctx, UUID, bool, ReApprovalRequest], Awaitable[None]]] = {}


def register_handler(entity_type: str):
    def deco(fn):
        APPROVAL_HANDLERS[entity_type] = fn
        return fn

    return deco


async def matching_rule(ctx: Ctx, entity_type: str, value: Decimal | float | int, field: str = "amount") -> Optional[ReApprovalRule]:
    """First active rule for ``entity_type``/``field`` whose threshold is reached (highest threshold wins)."""
    rules = (
        await ctx.db.execute(
            select(ReApprovalRule)
            .where(
                ReApprovalRule.vendor_id == ctx.vendor_id,
                ReApprovalRule.entity_type == entity_type,
                ReApprovalRule.field == field,
                ReApprovalRule.is_active.is_(True),
            )
            .order_by(ReApprovalRule.min_value.desc())
        )
    ).scalars().all()
    for rule in rules:
        if D(value) >= D(rule.min_value):
            return rule
    return None


async def request_approval(
    ctx: Ctx,
    entity_type: str,
    entity_id: UUID,
    *,
    ref: str,
    value: Decimal | float | int,
    field: str = "amount",
    amount: Decimal | float | int | None = None,
    title: str = "",
    reason: str = "",
) -> Optional[ReApprovalRequest]:
    """Create a pending request when a rule matches; return ``None`` if no approval is needed."""
    rule = await matching_rule(ctx, entity_type, value, field)
    if rule is None:
        return None
    req = ReApprovalRequest(
        id=uuid.uuid4(),
        vendor_id=ctx.vendor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_ref=ref,
        rule_id=rule.id,
        title=title or f"{entity_type} {ref}",
        amount=D(amount if amount is not None else value),
        reason=reason,
        status="pending",
        requested_by_user_id=ctx.user_id,
        requested_by_name=ctx.actor_name,
    )
    ctx.db.add(req)
    await ctx.db.flush()
    await audit(ctx, "approval_request", req.id, "requested", ref=ref, changes={"rule": rule.name})
    await notify(
        ctx.db, ctx.vendor_id, "Approval required",
        f"{req.title} needs approval ({rule.name}).", reference_type="approval", reference_id=req.id,
    )
    return req


async def decide(ctx: Ctx, req: ReApprovalRequest, approved: bool, comments: str = "") -> ReApprovalRequest:
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"Request already {req.status}")
    rule = await ctx.db.get(ReApprovalRule, req.rule_id) if req.rule_id else None
    needed = rule.approver_permission if rule else "realestate.approve"
    if needed not in ctx.permissions:
        raise HTTPException(status_code=403, detail=f"Missing permission: {needed}")
    if req.requested_by_user_id and req.requested_by_user_id == ctx.user_id and "realestate.admin" not in ctx.permissions:
        raise HTTPException(status_code=403, detail="You cannot approve your own request")
    req.status = "approved" if approved else "rejected"
    req.decided_by_user_id = ctx.user_id
    req.decided_by_name = ctx.actor_name
    req.decided_at = datetime.now(timezone.utc)
    req.comments = comments or None
    handler = APPROVAL_HANDLERS.get(req.entity_type)
    if handler:
        await handler(ctx, req.entity_id, approved, req)
    await audit(ctx, "approval_request", req.id, "approved" if approved else "rejected", ref=req.entity_ref or "")
    return req
