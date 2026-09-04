"""Approver-matrix resolution for procurement documents.

This module is the single place that resolves which approvers should be
assigned to a PR / PO / Invoice based on the vendor's ProcurementApproverRule
matrix.  All three submit paths call `resolve_approvers()` and then persist
the returned chain onto their respective *_approval tables.

Resolution algorithm
--------------------
1. Derive the document's dimension tuple
       (company_id, branch_id, plant_id, material_types)
   where material_types is the *set* of distinct non-null material_type values
   across document lines (PR items / PO items).

2. Filter active rules for (vendor_id, doc_type) where every non-null dimension
   matches the document.  Amount band is also applied if set on the rule.

3. Score each matching rule by specificity so ties are impossible:
       company  → 8 pts
       branch   → 4 pts
       plant    → 2 pts
       material → 1 pt
       bounded amount band → 0.5 pts (fractional to never break integer tie-break)
   A rule with all wildcards scores 0.  Identical scores from different
   dimension combinations cannot occur because the weights are powers of 2.

4. Group rules by their dimension+amount identity and keep only the group that
   contains the highest-scoring individual rule.

5. For each rule in the winning group (ordered by level):
   • If approver_id is set → use directly.
   • If approver_role_id is set → expand to all active VendorUser rows holding
     that role, sorted by user.full_name for determinism.
   • Skip the document's own creator if they appear as an approver
     (self-approval not allowed).
   • Collapse consecutive duplicates so one person doesn't appear twice in a row.

6. Return a ResolvedChain dataclass.  If the chain is empty (no matching rules
   or all resolved users were filtered out) signal that via `matched = False`
   so the caller falls back to manually-assigned approvers / no-approval path.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.procurement_approver_rule import ProcurementApproverRule
from app.models.vendor_user import VendorUser


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

@dataclass
class ResolvedStep:
    """A single resolved approver step in the chain."""
    level: int
    approver_id: UUID
    source_rule_id: UUID  # the ProcurementApproverRule row that produced this step


@dataclass
class ResolvedChain:
    """Result returned by resolve_approvers()."""
    matched: bool                          # False → fall back to manual / no-approval
    lock_chain: bool                       # from the winning rule group
    steps: list[ResolvedStep] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _group_key(rule: ProcurementApproverRule):
    """Tuple that identifies a rule group (same dimensions + amount band)."""
    return (
        rule.doc_type,
        rule.company_id,
        rule.branch_id,
        rule.plant_id,
        rule.material_type,
        rule.min_amount,
        rule.max_amount,
    )


def _specificity(rule: ProcurementApproverRule) -> float:
    """Higher = more specific.  Weights are distinct powers of 2 so no tie is possible."""
    score: float = 0
    if rule.company_id    is not None: score += 8
    if rule.branch_id     is not None: score += 4
    if rule.plant_id      is not None: score += 2
    if rule.material_type is not None: score += 1
    if rule.min_amount is not None or rule.max_amount is not None:
        score += 0.5
    return score


def _rule_matches_doc(
    rule: ProcurementApproverRule,
    company_id:     Optional[UUID],
    branch_id:      Optional[UUID],
    plant_id:       Optional[UUID],
    material_types: set[str],
    amount:         Decimal,
) -> bool:
    """Return True if this rule applies to the given document dimensions."""
    if rule.company_id is not None and rule.company_id != company_id:
        return False
    if rule.branch_id is not None and rule.branch_id != branch_id:
        return False
    if rule.plant_id is not None and rule.plant_id != plant_id:
        return False
    if rule.material_type is not None and rule.material_type not in material_types:
        return False
    if rule.min_amount is not None and amount < rule.min_amount:
        return False
    if rule.max_amount is not None and amount >= rule.max_amount:
        return False
    return True


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def resolve_approvers(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    doc_type: str,          # "PR" | "PO" | "INVOICE"
    company_id:     Optional[UUID] = None,
    branch_id:      Optional[UUID] = None,
    plant_id:       Optional[UUID] = None,
    material_types: Optional[set[str]] = None,
    amount: Decimal = Decimal("0"),
    creator_vendor_user_id: Optional[UUID] = None,  # excluded from self-approval
) -> ResolvedChain:
    """Resolve the approver chain for a document.

    Returns a ResolvedChain.  When matched=False the caller should fall back
    to the manually-assigned approvers already on the document (or route as
    not_required if none exist).
    """
    if material_types is None:
        material_types = set()

    # ── 1. Load active rules for this vendor+doc_type ──────────────
    result = await db.execute(
        select(ProcurementApproverRule)
        .where(
            ProcurementApproverRule.vendor_id == vendor_id,
            ProcurementApproverRule.doc_type  == doc_type,
            ProcurementApproverRule.is_active == True,
        )
        .order_by(ProcurementApproverRule.level)
    )
    all_rules: list[ProcurementApproverRule] = list(result.scalars().all())

    if not all_rules:
        return ResolvedChain(matched=False, lock_chain=False)

    # ── 2. Filter to matching rules ─────────────────────────────────
    matching = [
        r for r in all_rules
        if _rule_matches_doc(r, company_id, branch_id, plant_id, material_types, amount)
    ]

    if not matching:
        return ResolvedChain(matched=False, lock_chain=False)

    # ── 3. Score and select the highest-specificity group ──────────
    best_score  = max(_specificity(r) for r in matching)
    best_group_key = None
    for r in matching:
        if _specificity(r) == best_score:
            best_group_key = _group_key(r)
            break

    winning_rules = [r for r in matching if _group_key(r) == best_group_key]
    winning_rules.sort(key=lambda r: r.level)

    # lock_chain from any row in the group (all rows in a group should agree,
    # but take the most restrictive value just in case)
    lock_chain = any(r.lock_chain for r in winning_rules)

    # ── 4 & 5. Expand rules to concrete approver steps ─────────────
    steps: list[ResolvedStep] = []
    level_counter = 1
    prev_approver_id: Optional[UUID] = None

    for rule in winning_rules:
        if rule.approver_id is not None:
            # Direct user reference
            uid = rule.approver_id
            if uid == creator_vendor_user_id:
                continue  # skip self-approval
            if uid == prev_approver_id:
                continue  # collapse consecutive duplicates
            steps.append(ResolvedStep(
                level=level_counter,
                approver_id=uid,
                source_rule_id=rule.id,
            ))
            prev_approver_id = uid
            level_counter += 1

        elif rule.approver_role_id is not None:
            # Expand role to all active users holding it, sorted for determinism
            role_users_result = await db.execute(
                select(VendorUser)
                .where(
                    VendorUser.vendor_id == vendor_id,
                    VendorUser.role_id   == rule.approver_role_id,
                    VendorUser.is_active == True,
                )
                .order_by(VendorUser.id)
            )
            role_users: list[VendorUser] = list(role_users_result.scalars().all())

            for vu in role_users:
                if vu.id == creator_vendor_user_id:
                    continue
                if vu.id == prev_approver_id:
                    continue
                steps.append(ResolvedStep(
                    level=level_counter,
                    approver_id=vu.id,
                    source_rule_id=rule.id,
                ))
                prev_approver_id = vu.id
                level_counter += 1

    if not steps:
        # All candidates were filtered (self-approval / duplicates)
        return ResolvedChain(matched=False, lock_chain=False)

    return ResolvedChain(matched=True, lock_chain=lock_chain, steps=steps)


async def get_material_types_for_pr(db: AsyncSession, pr_id: UUID) -> set[str]:
    """Return distinct non-null material_type values across PR lines."""
    from app.models.procurement_requisition import PurchaseRequisitionItem
    result = await db.execute(
        select(PurchaseRequisitionItem.material_type)
        .where(
            PurchaseRequisitionItem.requisition_id == pr_id,
            PurchaseRequisitionItem.material_type.isnot(None),
        )
        .distinct()
    )
    return {row[0] for row in result.all()}


async def get_material_types_for_po(db: AsyncSession, po_id: UUID) -> set[str]:
    """Return distinct non-null material_type values across PO lines."""
    from app.models.procurement import PurchaseOrderItem
    result = await db.execute(
        select(PurchaseOrderItem.material_type)
        .where(
            PurchaseOrderItem.purchase_order_id == po_id,
            PurchaseOrderItem.material_type.isnot(None),
        )
        .distinct()
    )
    return {row[0] for row in result.all()}
