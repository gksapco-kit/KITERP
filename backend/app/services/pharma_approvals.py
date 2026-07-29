"""Scoped approval-policy resolver for the Pharma module (Phase 7a).

Resolution mode: strictest-wins.
When multiple rules match a (vendor, action, context) triple:
  - max(required_approvers) is taken
  - mandatory steps are unioned across all matching rules
  - sequential and forbid_initiator OR together

If no scoped rule matches the context, the default rule (is_default=True) is used.
If no default rule exists in the DB, the legacy settings JSON is used as a last resort,
ensuring zero regression on existing deployments.

Context keys (all optional):
  product_id       — UUID of the product on the batch / inspection / deviation
  group_ids        — list of product-group UUIDs the product belongs to (inc. ancestors)
  plant_id         — UUID of the plant
  store_id         — UUID of the branch; parent store_id is appended automatically
  initiator_id     — VendorUser.id of the action initiator (for forbid_initiator)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_effective_permissions
from app.models.pharma import (
    PharmaApprovalRule, PharmaApprovalRuleStep, PharmaSignerGroupMember, PharmaOrgRegion,
)
from app.models.plant import Plant
from app.models.product_group import ProductGroup, ProductGroupItem
from app.models.store import Store
from app.models.vendor_user import VendorUser
from app.services.pharma_esign import load_pharma_settings, resolve_approver_requirement


_ACTION_SETTINGS_KEY = {
    "batch_release":    "min_approvers_release",
    "bpr_complete":     "min_approvers_bpr_complete",
    "capa_close":       "min_approvers_capa_close",
    "cc_approve":       "min_approvers_cc_approve",
}

_ACTION_DEFAULT_COUNT = {
    "batch_release": 2,
    "bpr_complete":  2,
    "capa_close":    1,
    "cc_approve":    1,
}


@dataclass
class ResolvedStep:
    rule_id: UUID
    level: int
    signer_type: str
    vendor_user_id: Optional[UUID]
    role_slug: Optional[str]
    permission: Optional[str]
    signer_group_id: Optional[UUID]
    meaning: str
    min_signatures: int
    is_mandatory: bool

    def describe(self) -> str:
        if self.signer_type == "user" and self.vendor_user_id:
            return f"user:{self.vendor_user_id}"
        if self.signer_type == "role" and self.role_slug:
            return f"role:{self.role_slug}"
        if self.signer_type == "permission" and self.permission:
            return f"permission:{self.permission}"
        if self.signer_type == "signer_group" and self.signer_group_id:
            return f"signer_group:{self.signer_group_id}"
        return self.signer_type


@dataclass
class ApprovalPolicy:
    """Resolved, enforcement-ready policy for a single (action, context) pair."""
    action: str
    required_approvers: int
    dual_sign: bool
    sequential: bool
    forbid_initiator: bool
    steps: list[ResolvedStep]
    rule_ids: list[UUID]        # all rules that contributed
    source: str                 # "rules" | "legacy_settings"
    snapshot: dict              # serialisable copy for audit record


# ── Context builders ──────────────────────────────────────────────────────────

async def _product_group_chain(db: AsyncSession, vendor_id: UUID, product_id: UUID) -> list[UUID]:
    """Return all group_ids the product belongs to, plus every ancestor group."""
    memberships = (
        await db.execute(
            select(ProductGroupItem.group_id)
            .where(
                ProductGroupItem.product_id == product_id,
                ProductGroupItem.item_type == "product",
            )
        )
    ).scalars().all()
    group_ids: set[UUID] = set(memberships)

    # Walk ancestor chains
    to_visit = list(group_ids)
    while to_visit:
        rows = (
            await db.execute(
                select(ProductGroup.id, ProductGroup.parent_id)
                .where(
                    ProductGroup.vendor_id == vendor_id,
                    ProductGroup.id.in_(to_visit),
                    ProductGroup.parent_id.isnot(None),
                )
            )
        ).all()
        to_visit = []
        for _, parent_id in rows:
            if parent_id and parent_id not in group_ids:
                group_ids.add(parent_id)
                to_visit.append(parent_id)

    return list(group_ids)


async def _store_chain(db: AsyncSession, store_id: UUID) -> list[UUID]:
    """Return [store_id, parent_bu_id] so a BU-level rule matches any of its branches."""
    chain = [store_id]
    row = (
        await db.execute(
            select(Store.parent_id).where(Store.id == store_id)
        )
    ).scalar_one_or_none()
    if row:
        chain.append(row)
    return chain


async def _resolve_region(db: AsyncSession, plant_id: Optional[UUID], store_id: Optional[UUID]) -> Optional[str]:
    """Resolve the track-trace region for a plant/store using PharmaOrgRegion overrides."""
    if plant_id:
        row = (
            await db.execute(
                select(PharmaOrgRegion.track_trace_region)
                .where(PharmaOrgRegion.plant_id == plant_id)
            )
        ).scalar_one_or_none()
        if row:
            return row
    if store_id:
        row = (
            await db.execute(
                select(PharmaOrgRegion.track_trace_region)
                .where(PharmaOrgRegion.store_id == store_id)
            )
        ).scalar_one_or_none()
        if row:
            return row
    return None


async def build_batch_context(
    db: AsyncSession,
    vendor_id: UUID,
    batch,  # GoodsBatch ORM row
) -> dict:
    """Build resolution context from a GoodsBatch."""
    ctx: dict[str, Any] = {}
    if batch.product_id:
        ctx["product_id"] = batch.product_id
        ctx["group_ids"] = await _product_group_chain(db, vendor_id, batch.product_id)
    if batch.plant_id:
        ctx["plant_id"] = batch.plant_id
        # Derive parent store from plant for region lookup
        row = (await db.execute(select(Plant.store_id).where(Plant.id == batch.plant_id))).scalar_one_or_none()
        if row:
            ctx["store_id"] = row
            ctx["store_chain"] = await _store_chain(db, row)
        region = await _resolve_region(db, batch.plant_id, ctx.get("store_id"))
        if region:
            ctx["region"] = region
    return ctx


async def build_entity_context(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    product_id: Optional[UUID] = None,
    plant_id: Optional[UUID] = None,
    store_id: Optional[UUID] = None,
) -> dict:
    """Generic context builder for entities that may not have all dimensions."""
    ctx: dict[str, Any] = {}
    if product_id:
        ctx["product_id"] = product_id
        ctx["group_ids"] = await _product_group_chain(db, vendor_id, product_id)
    if plant_id:
        ctx["plant_id"] = plant_id
    if store_id:
        ctx["store_id"] = store_id
        ctx["store_chain"] = await _store_chain(db, store_id)
    region = await _resolve_region(db, plant_id, store_id)
    if region:
        ctx["region"] = region
    return ctx


# ── Matching ──────────────────────────────────────────────────────────────────

def _today() -> date:
    return date.today()


def _rule_matches(rule: PharmaApprovalRule, ctx: dict) -> bool:
    """Return True when every non-NULL scope column on the rule is satisfied by ctx."""
    today = _today()
    if rule.valid_from and rule.valid_from > today:
        return False
    if rule.valid_to and rule.valid_to < today:
        return False

    if rule.product_id is not None:
        if ctx.get("product_id") != rule.product_id:
            return False

    if rule.product_group_id is not None:
        if rule.product_group_id not in (ctx.get("group_ids") or []):
            return False

    if rule.plant_id is not None:
        if ctx.get("plant_id") != rule.plant_id:
            return False

    if rule.store_id is not None:
        chain = ctx.get("store_chain") or ([ctx["store_id"]] if ctx.get("store_id") else [])
        if rule.store_id not in chain:
            return False

    if rule.region is not None:
        if ctx.get("region") != rule.region:
            return False

    return True


# ── Merge (strictest-wins) ────────────────────────────────────────────────────

def _merge_strictest(
    rules: list[PharmaApprovalRule],
    steps_by_rule: dict[UUID, list[PharmaApprovalRuleStep]],
) -> tuple[int, bool, bool, list[ResolvedStep], list[UUID]]:
    """Return (required_approvers, sequential, forbid_initiator, steps, rule_ids)."""
    required = max(r.required_approvers for r in rules)
    sequential = any(r.sequential for r in rules)
    forbid = any(r.forbid_initiator for r in rules)
    rule_ids = [r.id for r in rules]

    seen: set[tuple] = set()
    merged_steps: list[ResolvedStep] = []
    for rule in rules:
        for s in steps_by_rule.get(rule.id, []):
            key = (
                s.level, s.signer_type,
                str(s.vendor_user_id or ""),
                s.role_slug or "",
                s.permission or "",
                str(s.signer_group_id or ""),
            )
            if key not in seen:
                seen.add(key)
                merged_steps.append(ResolvedStep(
                    rule_id=rule.id,
                    level=s.level,
                    signer_type=s.signer_type,
                    vendor_user_id=s.vendor_user_id,
                    role_slug=s.role_slug,
                    permission=s.permission,
                    signer_group_id=s.signer_group_id,
                    meaning=s.meaning,
                    min_signatures=s.min_signatures,
                    is_mandatory=s.is_mandatory,
                ))

    merged_steps.sort(key=lambda s: s.level)

    # required_approvers must be at least the number of mandatory steps
    mandatory_count = sum(1 for s in merged_steps if s.is_mandatory)
    required = max(required, mandatory_count)

    return required, sequential, forbid, merged_steps, rule_ids


# ── Main resolver ─────────────────────────────────────────────────────────────

async def resolve_approval_policy(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    action: str,
    ctx: Optional[dict] = None,
    settings: Optional[dict] = None,
) -> ApprovalPolicy:
    """Resolve the effective approval policy for (vendor, action, context).

    Falls back to legacy settings JSON if no DB rules exist at all.
    """
    ctx = ctx or {}

    # Load all active rules for this vendor+action
    rules = (
        await db.execute(
            select(PharmaApprovalRule)
            .where(
                PharmaApprovalRule.vendor_id == vendor_id,
                PharmaApprovalRule.action == action,
                PharmaApprovalRule.is_active.is_(True),
            )
            .order_by(PharmaApprovalRule.is_default, PharmaApprovalRule.priority)
        )
    ).scalars().all()

    if not rules:
        return await _legacy_policy(db, vendor_id, action, settings)

    # Match
    matched = [r for r in rules if _rule_matches(r, ctx)]
    if not matched:
        return await _legacy_policy(db, vendor_id, action, settings)

    # If any rule has overrides_default, restrict to those only
    overriding = [r for r in matched if r.overrides_default]
    if overriding:
        matched = overriding

    # Load steps for matched rules
    matched_ids = [r.id for r in matched]
    all_steps = (
        await db.execute(
            select(PharmaApprovalRuleStep)
            .where(PharmaApprovalRuleStep.rule_id.in_(matched_ids))
            .order_by(PharmaApprovalRuleStep.rule_id, PharmaApprovalRuleStep.level)
        )
    ).scalars().all()

    steps_by_rule: dict[UUID, list[PharmaApprovalRuleStep]] = {}
    for s in all_steps:
        steps_by_rule.setdefault(s.rule_id, []).append(s)

    required, sequential, forbid, merged_steps, rule_ids = _merge_strictest(
        matched, steps_by_rule
    )

    snapshot = {
        "action": action,
        "required_approvers": required,
        "sequential": sequential,
        "forbid_initiator": forbid,
        "rule_ids": [str(rid) for rid in rule_ids],
        "source": "rules",
        "steps": [
            {
                "level": s.level,
                "signer_type": s.signer_type,
                "target": s.describe(),
                "meaning": s.meaning,
                "min_signatures": s.min_signatures,
                "is_mandatory": s.is_mandatory,
            }
            for s in merged_steps
        ],
    }

    return ApprovalPolicy(
        action=action,
        required_approvers=required,
        dual_sign=required >= 2,
        sequential=sequential,
        forbid_initiator=forbid,
        steps=merged_steps,
        rule_ids=rule_ids,
        source="rules",
        snapshot=snapshot,
    )


async def _legacy_policy(
    db: AsyncSession,
    vendor_id: UUID,
    action: str,
    settings: Optional[dict],
) -> ApprovalPolicy:
    """Fall back to legacy vendor.settings["pharma"] for zero-regression behaviour."""
    cfg = settings or await load_pharma_settings(db, vendor_id)
    settings_key = _ACTION_SETTINGS_KEY.get(action)
    default_count = _ACTION_DEFAULT_COUNT.get(action, 1)
    if settings_key:
        n, dual = resolve_approver_requirement(cfg, settings_key, default_count)
    else:
        n, dual = default_count, default_count >= 2

    snapshot = {
        "action": action,
        "required_approvers": n,
        "sequential": False,
        "forbid_initiator": True,
        "rule_ids": [],
        "source": "legacy_settings",
        "steps": [],
    }
    return ApprovalPolicy(
        action=action,
        required_approvers=n,
        dual_sign=dual,
        sequential=False,
        forbid_initiator=True,
        steps=[],
        rule_ids=[],
        source="legacy_settings",
        snapshot=snapshot,
    )


# ── Signer eligibility ────────────────────────────────────────────────────────

async def check_signer_eligible(
    db: AsyncSession,
    vu: VendorUser,
    step: ResolvedStep,
) -> bool:
    """Return True when vu satisfies the step's signer requirement."""
    if step.signer_type == "user":
        return step.vendor_user_id is not None and vu.id == step.vendor_user_id

    if step.signer_type == "role":
        return (vu.role or "").lower() == (step.role_slug or "").lower()

    if step.signer_type == "permission":
        if not step.permission:
            return False
        perms = get_effective_permissions(vu)
        return step.permission in perms

    if step.signer_type == "signer_group":
        if not step.signer_group_id:
            return False
        row = (
            await db.execute(
                select(PharmaSignerGroupMember).where(
                    PharmaSignerGroupMember.group_id == step.signer_group_id,
                    PharmaSignerGroupMember.vendor_user_id == vu.id,
                )
            )
        ).scalar_one_or_none()
        return row is not None

    return False


def next_open_step(
    policy: ApprovalPolicy,
    existing_sigs: list[dict],
) -> Optional[ResolvedStep]:
    """Return the first mandatory step not yet satisfied by existing_sigs.

    In parallel mode, returns the first mandatory step whose level hasn't
    reached min_signatures.  In sequential mode, returns the first level with
    any unsatisfied mandatory step.
    """
    if not policy.steps:
        return None

    sigs_at_level: dict[int, int] = {}
    for s in existing_sigs:
        lvl = s.get("level", 1)
        sigs_at_level[lvl] = sigs_at_level.get(lvl, 0) + 1

    if policy.sequential:
        levels_in_order = sorted({s.level for s in policy.steps if s.is_mandatory})
        for lvl in levels_in_order:
            steps_at = [s for s in policy.steps if s.level == lvl and s.is_mandatory]
            needed = sum(s.min_signatures for s in steps_at)
            if sigs_at_level.get(lvl, 0) < needed:
                return steps_at[0]
        return None
    else:
        for step in policy.steps:
            if not step.is_mandatory:
                continue
            if sigs_at_level.get(step.level, 0) < step.min_signatures:
                return step
        return None
