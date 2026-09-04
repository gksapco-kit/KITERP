"""Extend product/variant costing: add fixed method + cost_price_fixed, cost_source, cost_updated_at.

Revision ID: prod002_cost_method_fixed
Revises: prod001_valuation_method
Create Date: 2026-09-03

Changes:
- product.valuation_method: allow 'standard' in addition to 'moving_average' / 'fixed'
  (old value 'standard_price' is migrated to 'standard')
- product: add cost_price_fixed, cost_source, cost_updated_at
- product_variant: add cost_price_fixed, cost_source, cost_updated_at (inherits method from parent)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TIMESTAMP

revision = "prod002_cost_method_fixed"
down_revision = "prod001_valuation_method"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # ── product ──────────────────────────────────────────────────────────────
    product_cols = {c["name"] for c in insp.get_columns("product")}

    if "cost_price_fixed" not in product_cols:
        op.add_column(
            "product",
            sa.Column("cost_price_fixed", sa.Numeric(12, 2), nullable=True),
        )
    if "cost_source" not in product_cols:
        op.add_column(
            "product",
            sa.Column("cost_source", sa.String(60), nullable=True),
        )
    if "cost_updated_at" not in product_cols:
        op.add_column(
            "product",
            sa.Column(
                "cost_updated_at",
                TIMESTAMP(timezone=True),
                nullable=True,
            ),
        )

    # Migrate old 'standard_price' -> 'standard'
    op.execute(
        """
        UPDATE product
        SET valuation_method = 'standard'
        WHERE valuation_method = 'standard_price'
        """
    )
    # Back-fill cost_price_fixed from cost_price where method is 'fixed'
    # (no existing rows are 'fixed' yet, but run idempotently)
    op.execute(
        """
        UPDATE product
        SET cost_price_fixed = cost_price
        WHERE valuation_method = 'fixed' AND cost_price IS NOT NULL AND cost_price_fixed IS NULL
        """
    )

    # ── product_variant ───────────────────────────────────────────────────────
    variant_cols = {c["name"] for c in insp.get_columns("product_variant")}

    if "cost_price_fixed" not in variant_cols:
        op.add_column(
            "product_variant",
            sa.Column("cost_price_fixed", sa.Numeric(12, 2), nullable=True),
        )
    if "cost_source" not in variant_cols:
        op.add_column(
            "product_variant",
            sa.Column("cost_source", sa.String(60), nullable=True),
        )
    if "cost_updated_at" not in variant_cols:
        op.add_column(
            "product_variant",
            sa.Column(
                "cost_updated_at",
                TIMESTAMP(timezone=True),
                nullable=True,
            ),
        )


def downgrade() -> None:
    for col in ("cost_updated_at", "cost_source", "cost_price_fixed"):
        op.drop_column("product_variant", col)
        op.drop_column("product", col)

    # Restore 'standard' -> 'standard_price'
    op.execute(
        "UPDATE product SET valuation_method = 'standard_price' WHERE valuation_method = 'standard'"
    )
