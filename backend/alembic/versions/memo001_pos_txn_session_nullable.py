"""Allow pos_transaction.session_id NULL for credit/debit memos.

Revision ID: memo001_pos_txn_session_nullable
Revises: svc003_service_storefront_labels
Create Date: 2026-07-21

Credit and debit memos are created from Finance without an open till
session, so session_id must be nullable. Register sales/returns still
require a session at the API layer.

Idempotent: may already be applied via ensure_pos_transaction_accounting_columns().
"""
from alembic import op

revision = "memo001_pos_txn_session_nullable"
down_revision = "svc003_service_storefront_labels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE pos_transaction ALTER COLUMN session_id DROP NOT NULL")


def downgrade() -> None:
    # Only re-add NOT NULL if no nulls remain (memos without a till would block).
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pos_transaction WHERE session_id IS NULL
          ) THEN
            ALTER TABLE pos_transaction ALTER COLUMN session_id SET NOT NULL;
          END IF;
        END $$;
        """
    )
