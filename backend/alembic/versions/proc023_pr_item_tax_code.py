"""Add tax_code column to purchase_requisition_item.

Revision ID: proc023_pr_item_tax_code
Revises: proc022_return_line_tax_code
Create Date: 2026-09-08

Changes:
- purchase_requisition_item.tax_code VARCHAR(20) nullable — stores the FI tax
  code chosen by the requester (e.g. GST18, IGST12). The value is carried into
  the PO on PR→PO conversion so the PO tax engine can split it into
  CGST/SGST/IGST amounts automatically.
"""
from alembic import op
import sqlalchemy as sa

revision = "proc023_pr_item_tax_code"
down_revision = "proc022_return_line_tax_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_requisition_item",
        sa.Column("tax_code", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("purchase_requisition_item", "tax_code")
