"""Soft-delete for CRM leads.

Revision ID: crm008_lead_soft_delete
Revises: crm007_number_ranges
Create Date: 2026-08-20
"""
from alembic import op

revision = "crm008_lead_soft_delete"
down_revision = "crm007_number_ranges"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE crm_lead ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_crm_lead_vendor_deleted ON crm_lead(vendor_id, deleted_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_crm_lead_vendor_deleted")
    op.execute("ALTER TABLE crm_lead DROP COLUMN IF EXISTS deleted_at")
