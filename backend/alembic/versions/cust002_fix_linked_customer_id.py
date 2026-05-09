"""Ensure linked_customer_id column actually exists on the customer table.

The previous migration (cust001) may have applied partially when index
creation conflicted with pre-existing indexes.  This migration is idempotent —
it uses raw SQL so it is safe to re-run.

Revision ID: cust002_fix_linked_customer_id
Revises: cust001_customer_dedup
Create Date: 2026-04-21
"""

from alembic import op

revision = 'cust002_fix_linked_customer_id'
down_revision = 'cust001_customer_dedup'
branch_labels = None
depends_on = None


def upgrade():
    # Add the column only if it doesn't already exist (fully idempotent)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'customer'
                  AND column_name = 'linked_customer_id'
            ) THEN
                ALTER TABLE customer ADD COLUMN linked_customer_id UUID;
            END IF;
        END$$;
    """)

    # Drop any leftover per-vendor unique indexes (safe if already dropped)
    op.execute("DROP INDEX IF EXISTS ix_customer_vendor_email")
    op.execute("DROP INDEX IF EXISTS ix_customer_vendor_phone")

    # Create non-unique indexes only if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_customer_email ON customer (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_customer_phone ON customer (phone)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_customer_linked ON customer (linked_customer_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_customer_linked")
    op.execute("ALTER TABLE customer DROP COLUMN IF EXISTS linked_customer_id")
