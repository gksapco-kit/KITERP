"""pm003: add pm_project_id to fin_vendor_bill/line and GL dimensions to bill line

Revision ID: pm003_ap_project_tagging
Revises: pm002_project_costing_bridge
Create Date: 2026-08-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "pm003_ap_project_tagging"
down_revision = "pm002_project_costing_bridge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── fin_vendor_bill header ──────────────────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE fin_vendor_bill
            ADD COLUMN IF NOT EXISTS pm_project_id UUID REFERENCES pm_project(id) ON DELETE SET NULL;
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_fvb_pm_project ON fin_vendor_bill(pm_project_id)
            WHERE pm_project_id IS NOT NULL;
    """))

    # ── fin_vendor_bill_line — GL dimension columns ─────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE fin_vendor_bill_line
            ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS fin_project_id  UUID REFERENCES fin_project(id)    ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS pm_project_id   UUID REFERENCES pm_project(id)     ON DELETE SET NULL;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_fvb_pm_project;"))
    conn.execute(sa.text("ALTER TABLE fin_vendor_bill DROP COLUMN IF EXISTS pm_project_id;"))
    conn.execute(sa.text("""
        ALTER TABLE fin_vendor_bill_line
            DROP COLUMN IF EXISTS cost_center_id,
            DROP COLUMN IF EXISTS fin_project_id,
            DROP COLUMN IF EXISTS pm_project_id;
    """))
