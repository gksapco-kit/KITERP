"""Add tax_code column to purchase_return_line.

Revision ID: proc022_return_line_tax_code
Revises: proc021_procurement_analytics_indexes
Create Date: 2026-09-08

Changes:
- purchase_return_line.tax_code VARCHAR(20) nullable — stores the FI tax code
  selected by the user (e.g. GST18, IGST12). The CGST/SGST/IGST rate columns
  are derived from this code at save time via _split_line_tax; the column is
  retained for backward compatibility with rows created before this migration.
"""
from alembic import op
import sqlalchemy as sa

revision = "proc022_return_line_tax_code"
down_revision = "proc021_procurement_analytics_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_return_line",
        sa.Column("tax_code", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("purchase_return_line", "tax_code")
