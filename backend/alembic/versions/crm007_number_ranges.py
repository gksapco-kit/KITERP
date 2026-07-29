"""CRM number ranges for leads and related entities.

Revision ID: crm007_number_ranges
Revises: sfq002_query_lead_actions
Create Date: 2026-07-28
"""
from alembic import op

revision = "crm007_number_ranges"
down_revision = "sfq002_query_lead_actions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS crm_number_range (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            entity_type VARCHAR(40) NOT NULL,
            name VARCHAR(120) NOT NULL,
            prefix VARCHAR(20) NOT NULL DEFAULT 'LED',
            number_from INTEGER NOT NULL DEFAULT 1,
            number_to INTEGER NOT NULL DEFAULT 999999,
            current_number INTEGER NOT NULL DEFAULT 1,
            pad_width INTEGER NOT NULL DEFAULT 6,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_crm_nr_vendor_entity UNIQUE (vendor_id, entity_type)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_crm_nr_vendor_entity ON crm_number_range(vendor_id, entity_type)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS crm_number_range")
