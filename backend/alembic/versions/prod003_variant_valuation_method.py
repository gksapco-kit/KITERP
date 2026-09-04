"""Add product_variant.valuation_method (nullable — null means inherit from parent product).

Revision ID: prod003_variant_valuation_method
Revises: prod002_cost_method_fixed
Create Date: 2026-09-03

NULL  = inherit the parent product's valuation_method at resolve-time.
Set   = this variant uses its own method (moving_average | fixed | standard).
"""

from alembic import op
import sqlalchemy as sa

revision = "prod003_variant_valuation_method"
down_revision = "prod002_cost_method_fixed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    variant_cols = {c["name"] for c in insp.get_columns("product_variant")}

    if "valuation_method" not in variant_cols:
        op.add_column(
            "product_variant",
            sa.Column("valuation_method", sa.String(20), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("product_variant", "valuation_method")
