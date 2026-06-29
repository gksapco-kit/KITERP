"""fin010 – reconciliation account flag on fin_account

Adds:
  - is_reconciliation_account (bool, default false): marks GL control accounts
    that are exclusively posted to by subledger auto-posting (AR, AP, Asset).
    Manual journal entries are blocked from posting to these accounts.
  - reconciliation_subledger (varchar 30, nullable): which subledger owns this
    account — customer | supplier | asset | bank

Revision ID: fin010_reconciliation_accounts
Revises: fin008_audit_month_split
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "fin010_reconciliation_accounts"
down_revision = "fin008_audit_month_split"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fin_account",
        sa.Column(
            "is_reconciliation_account",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "fin_account",
        sa.Column("reconciliation_subledger", sa.String(30), nullable=True),
    )
    op.create_index(
        "ix_fin_account_recon",
        "fin_account",
        ["vendor_id", "is_reconciliation_account"],
    )

    # Mark the standard seeded accounts that are reconciliation control accounts.
    # We do this by code since these rows were created by the seeder with fixed codes.
    op.execute(
        """
        UPDATE fin_account
           SET is_reconciliation_account = true,
               reconciliation_subledger  = 'customer'
         WHERE code = '1130'
           AND is_system = true
        """
    )
    op.execute(
        """
        UPDATE fin_account
           SET is_reconciliation_account = true,
               reconciliation_subledger  = 'supplier'
         WHERE code = '2110'
           AND is_system = true
        """
    )
    op.execute(
        """
        UPDATE fin_account
           SET is_reconciliation_account = true,
               reconciliation_subledger  = 'asset'
         WHERE code = '1290'
           AND is_system = true
        """
    )


def downgrade() -> None:
    op.drop_index("ix_fin_account_recon", table_name="fin_account")
    op.drop_column("fin_account", "reconciliation_subledger")
    op.drop_column("fin_account", "is_reconciliation_account")
