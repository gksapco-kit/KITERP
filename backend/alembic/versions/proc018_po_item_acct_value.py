"""Add account_assignment_value column to purchase_order_item.

Revision ID: proc018_po_item_acct_value
Revises: proc017_approver_matrix
Create Date: 2026-09-03

Stores the actual cost-centre code / WBS element / asset number / GL account
entered on a PO line alongside the existing account_assignment category.
"""

from alembic import op
import sqlalchemy as sa

revision = "proc018_po_item_acct_value"
down_revision = "proc017_approver_matrix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_order_item",
        sa.Column("account_assignment_value", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("purchase_order_item", "account_assignment_value")
