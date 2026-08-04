"""Add product.valuation_method (MAP vs Standard price control).

Revision ID: prod001_valuation_method
Revises: proc001_cs_po_ref
Create Date: 2026-08-04
"""
from alembic import op

revision = "prod001_valuation_method"
down_revision = "proc001_cs_po_ref"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE product
        ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(20) NOT NULL DEFAULT 'moving_average'
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE product DROP COLUMN IF EXISTS valuation_method")
