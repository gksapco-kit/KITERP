"""Add lead-conversion + reply tracking to contact queries and chat conversations.

Revision ID: sfq002_query_lead_actions
Revises: merge001_pg002_pharma005
Create Date: 2026-07-28

Adds:
  storefront_contact_query
    converted_lead_id  – FK to crm_lead, set when query is moved-as-lead
    converted_at       – timestamp of conversion
    last_reply_at      – timestamp of most recent outbound reply
    reply_count        – total outbound replies sent from Queries page

  crm_chat_conversation
    converted_lead_id  – FK to crm_lead, set when chat is moved-as-lead
    converted_at       – timestamp of conversion
"""
from alembic import op

revision = "sfq002_query_lead_actions"
down_revision = "merge001_pg002_pharma005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE storefront_contact_query
            ADD COLUMN IF NOT EXISTS converted_lead_id UUID REFERENCES crm_lead(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_scq_converted_lead ON storefront_contact_query(converted_lead_id)"
    )

    op.execute("""
        ALTER TABLE crm_chat_conversation
            ADD COLUMN IF NOT EXISTS converted_lead_id UUID REFERENCES crm_lead(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_crm_chat_conv_lead ON crm_chat_conversation(converted_lead_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_crm_chat_conv_lead")
    op.execute("""
        ALTER TABLE crm_chat_conversation
            DROP COLUMN IF EXISTS converted_lead_id,
            DROP COLUMN IF EXISTS converted_at
    """)
    op.execute("DROP INDEX IF EXISTS ix_scq_converted_lead")
    op.execute("""
        ALTER TABLE storefront_contact_query
            DROP COLUMN IF EXISTS converted_lead_id,
            DROP COLUMN IF EXISTS converted_at,
            DROP COLUMN IF EXISTS last_reply_at,
            DROP COLUMN IF EXISTS reply_count
    """)
