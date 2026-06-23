"""Add marketing template media, channel, schedule fields

Revision ID: crm005_template_media
Revises: crm004_contact_merge
Create Date: 2026-06-24

"""
from alembic import op

revision = "crm005_template_media"
down_revision = "crm004_contact_merge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'email';")
    op.execute("ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS description TEXT;")
    op.execute("ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;")
    op.execute("ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS schedule_start TIMESTAMPTZ;")
    op.execute("ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS schedule_end TIMESTAMPTZ;")
    op.execute("ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;")
    op.execute(
        "UPDATE crm_email_template SET schedule_start = scheduled_at "
        "WHERE schedule_start IS NULL AND scheduled_at IS NOT NULL;"
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("ALTER TABLE crm_email_template DROP COLUMN IF EXISTS schedule_end;")
    op.execute("ALTER TABLE crm_email_template DROP COLUMN IF EXISTS schedule_start;")
    op.execute("ALTER TABLE crm_email_template DROP COLUMN IF EXISTS scheduled_at;")
    op.execute("ALTER TABLE crm_email_template DROP COLUMN IF EXISTS attachments;")
    op.execute("ALTER TABLE crm_email_template DROP COLUMN IF EXISTS description;")
    op.execute("ALTER TABLE crm_email_template DROP COLUMN IF EXISTS channel;")
