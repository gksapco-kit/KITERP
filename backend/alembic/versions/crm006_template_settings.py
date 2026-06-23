"""Add marketing template CTA/footer settings

Revision ID: crm006_template_settings
Revises: crm005_template_media
Create Date: 2026-06-24

"""
from alembic import op

revision = "crm006_template_settings"
down_revision = "crm005_template_media"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("ALTER TABLE crm_email_template DROP COLUMN IF EXISTS settings;")
