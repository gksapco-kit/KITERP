"""fin025 - backfill journal entry company_id from the tenant's default business unit

post_event now always stamps company_id (default company when the caller gives none), but
older rows were written with NULL. Report filters by company_id would silently drop them.
Only tenants that have exactly one default, active company are touched; multi-company tenants
with ambiguous history are left as-is (NULL = "all business units").

Revision ID: fin025_company_backfill
Revises: fin024_bill_gst_tds
Create Date: 2026-10-27
"""
from __future__ import annotations

from alembic import op

revision = "fin025_company_backfill"
down_revision = "fin024_bill_gst_tds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE fin_journal_entry je
           SET company_id = d.company_id
          FROM (
                SELECT vendor_id, MIN(id::text)::uuid AS company_id
                  FROM fin_company
                 WHERE is_default = TRUE AND is_active = TRUE
              GROUP BY vendor_id
                HAVING COUNT(*) = 1
          ) d
         WHERE je.vendor_id = d.vendor_id
           AND je.company_id IS NULL
    """)


def downgrade() -> None:
    # data backfill is intentionally not reversed
    pass
