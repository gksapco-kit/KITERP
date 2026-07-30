"""Backfill custom role permissions after RBAC catalog expansion.

Adds the new granular permissions introduced in the RBAC expansion to any
existing custom vendor roles that held the parent permission:

  procurement.manage  → also receives the 4 SoD split permissions
  pharma.manage       → also receives pharma.quality.manage + pharma.deviation.manage
  inventory.view or
  procurement.view    → also receives masterdata.view
  orders.view         → also receives quotations.view
  orders.manage       → also receives quotations.manage
  finance.view        → also receives controlling.view
  settings.edit       → also receives system.modules + documents.templates.manage

The backfill is idempotent — it only adds missing permissions; existing ones
are never removed or duplicated.

Revision ID: rbac001_backfill
Revises: ps003_audit
"""

from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "rbac001_backfill"
down_revision: Union[str, None] = "ps003_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Mapping: if the role has ANY of the trigger permissions, add the extra permissions
BACKFILL_RULES: list[tuple[list[str], list[str]]] = [
    # Procurement SoD split
    (
        ["procurement.manage"],
        [
            "procurement.requisition.approve",
            "procurement.po.approve",
            "procurement.gr.post",
            "procurement.invoice.verify",
        ],
    ),
    # Pharma quality gates
    (
        ["pharma.manage"],
        ["pharma.quality.manage", "pharma.deviation.manage"],
    ),
    # Master data access (plants, storage locations, suppliers)
    (
        ["inventory.view", "procurement.view"],
        ["masterdata.view"],
    ),
    # Quotations (new namespace) — reads follow orders
    (
        ["orders.view"],
        ["quotations.view"],
    ),
    (
        ["orders.manage"],
        ["quotations.manage"],
    ),
    # Controlling (CO) view access follows finance view
    (
        ["finance.view"],
        ["controlling.view"],
    ),
    # System administration: module settings + document templates
    (
        ["settings.edit"],
        ["system.modules", "documents.templates.manage"],
    ),
]


def _backfill_row(existing_perms: list[str]) -> list[str]:
    """Return the updated permission list for a single custom role row."""
    result = set(existing_perms)
    for triggers, additions in BACKFILL_RULES:
        if any(t in result for t in triggers):
            result.update(additions)
    return sorted(result)


def upgrade() -> None:
    conn = op.get_bind()

    rows = conn.execute(
        sa.text("SELECT id, permissions FROM vendor_role WHERE is_system = false")
    ).fetchall()

    for row in rows:
        role_id = row[0]
        raw_perms = row[1]
        if raw_perms is None:
            continue

        if isinstance(raw_perms, str):
            existing = json.loads(raw_perms)
        else:
            existing = list(raw_perms)

        updated = _backfill_row(existing)

        if set(updated) != set(existing):
            conn.execute(
                sa.text(
                    "UPDATE vendor_role SET permissions = :perms::jsonb WHERE id = :id"
                ),
                {"perms": json.dumps(updated), "id": str(role_id)},
            )

    conn.execute(sa.text("COMMIT"))


def downgrade() -> None:
    # The backfill is additive-only. A downgrade would need to know which
    # permissions were already present before the migration, which we don't
    # track. Treat this as irreversible; run a new migration to remove
    # specific permissions if needed.
    pass
