"""Customer deduplication: drop per-vendor unique constraints on email/phone,
add linked_customer_id for grouping duplicate contacts.

Revision ID: cust001_customer_dedup
Revises: fin002_je_enterprise
Create Date: 2026-04-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'cust001_customer_dedup'
down_revision = 'fin002_je_enterprise'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the per-vendor unique partial indexes so the same email/phone can
    # appear more than once within a vendor (customers with different names).
    op.execute("DROP INDEX IF EXISTS ix_customer_vendor_email")
    op.execute("DROP INDEX IF EXISTS ix_customer_vendor_phone")

    # Add linked_customer_id to group related customer records (same real person).
    op.add_column(
        'customer',
        sa.Column(
            'linked_customer_id',
            postgresql.UUID(as_uuid=True),
            nullable=True,
        )
    )

    # Recreate as non-unique indexes so queries by email/phone stay fast.
    op.create_index('ix_customer_email', 'customer', ['email'])
    op.create_index('ix_customer_phone', 'customer', ['phone'])
    op.create_index('ix_customer_linked', 'customer', ['linked_customer_id'])


def downgrade():
    op.drop_index('ix_customer_linked', table_name='customer')
    op.drop_index('ix_customer_phone', table_name='customer')
    op.drop_index('ix_customer_email', table_name='customer')
    op.drop_column('customer', 'linked_customer_id')
    # Restore the original partial unique indexes
    op.execute("""
        CREATE UNIQUE INDEX ix_customer_vendor_email
        ON customer (vendor_id, email)
        WHERE email IS NOT NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX ix_customer_vendor_phone
        ON customer (vendor_id, phone)
        WHERE phone IS NOT NULL
    """)
