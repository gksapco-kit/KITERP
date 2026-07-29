"""Add ticket-conversion tracking to storefront_contact_query and crm_chat_conversation.

Revision ID: sfq003_query_ticket_actions
Revises: sfq002_query_lead_actions
Create Date: 2026-07-29

Adds:
  storefront_contact_query
    converted_ticket_id  – FK to crm_ticket, set when query is moved-as-ticket
    ticket_converted_at  – timestamp of conversion

  crm_chat_conversation
    converted_ticket_id  – FK to crm_ticket, set when chat is moved-as-ticket
    ticket_converted_at  – timestamp of conversion
"""
from alembic import op

revision = "sfq003_query_ticket_actions"
down_revision = "sfq002_query_lead_actions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE storefront_contact_query
            ADD COLUMN IF NOT EXISTS converted_ticket_id UUID REFERENCES crm_ticket(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS ticket_converted_at TIMESTAMPTZ
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_scq_converted_ticket ON storefront_contact_query(converted_ticket_id)"
    )

    op.execute("""
        ALTER TABLE crm_chat_conversation
            ADD COLUMN IF NOT EXISTS converted_ticket_id UUID REFERENCES crm_ticket(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS ticket_converted_at TIMESTAMPTZ
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_crm_chat_conv_ticket ON crm_chat_conversation(converted_ticket_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_crm_chat_conv_ticket")
    op.execute("""
        ALTER TABLE crm_chat_conversation
            DROP COLUMN IF EXISTS converted_ticket_id,
            DROP COLUMN IF EXISTS ticket_converted_at
    """)
    op.execute("DROP INDEX IF EXISTS ix_scq_converted_ticket")
    op.execute("""
        ALTER TABLE storefront_contact_query
            DROP COLUMN IF EXISTS converted_ticket_id,
            DROP COLUMN IF EXISTS ticket_converted_at
    """)
