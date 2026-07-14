"""Scope customer accounts to a business unit (store_id).

Revision ID: cust002_customer_store_scope
Revises: cfg003_customer_pricing_group
Create Date: 2026-07-14

Each business-unit storefront has its own customer accounts. store_id NULL
keeps legacy vendor-wide rows for shared/global sites with no active BU.
"""
from alembic import op

revision = "cust002_customer_store_scope"
down_revision = "cfg003_customer_pricing_group"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE customer ADD COLUMN IF NOT EXISTS store_id UUID")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_customer_store_id'
            ) THEN
                ALTER TABLE customer
                ADD CONSTRAINT fk_customer_store_id
                FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_customer_store_id ON customer (store_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_customer_vendor_store ON customer (vendor_id, store_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_customer_vendor_store")
    op.execute("DROP INDEX IF EXISTS ix_customer_store_id")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_customer_store_id'
            ) THEN
                ALTER TABLE customer DROP CONSTRAINT fk_customer_store_id;
            END IF;
        END $$;
        """
    )
    op.drop_column("customer", "store_id")
