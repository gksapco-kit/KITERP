"""add custom_fields to crm_activity

Revision ID: crm002_activity_custom_fields
Revises: c001_tier_c_plus
Create Date: 2026-06-06

"""
from alembic import op

revision = "crm002_activity_custom_fields"
down_revision = "c001_tier_c_plus"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute(
        "ALTER TABLE crm_activity ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;"
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("ALTER TABLE crm_activity DROP COLUMN IF EXISTS custom_fields;")
