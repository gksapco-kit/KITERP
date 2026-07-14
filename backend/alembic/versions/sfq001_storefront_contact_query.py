"""Storefront Contact Us query inbox.

Revision ID: sfq001_storefront_contact_query
Revises: cust002_customer_store_scope
Create Date: 2026-07-15

Customers submit name/email/phone/message from the storefront Contact page;
platform admin and vendors review them under Queries.
"""
from alembic import op

revision = "sfq001_storefront_contact_query"
down_revision = "cust002_customer_store_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS storefront_contact_query (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(40),
            message TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            ip_address VARCHAR(64),
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_storefront_contact_query_vendor ON storefront_contact_query(vendor_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_storefront_contact_query_status ON storefront_contact_query(status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_storefront_contact_query_created ON storefront_contact_query(created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS storefront_contact_query")
