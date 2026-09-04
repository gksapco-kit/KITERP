"""Extend material_valuation.valuation_method to accept 'standard' (third value).

Revision ID: mv001_valuation_method_standard
Revises: prod002_cost_method_fixed
Create Date: 2026-09-03

The column is VARCHAR(20) with a CHECK-free default; the new value fits within 20 chars.
Existing 'standard_price' rows are migrated to 'standard' in sync with prod002.
"""

from alembic import op

revision = "mv001_valuation_method_standard"
down_revision = "prod002_cost_method_fixed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE material_valuation
        SET valuation_method = 'standard'
        WHERE valuation_method = 'standard_price'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE material_valuation
        SET valuation_method = 'standard_price'
        WHERE valuation_method = 'standard'
        """
    )
