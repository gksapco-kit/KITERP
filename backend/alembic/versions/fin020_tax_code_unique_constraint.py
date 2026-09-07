"""Unique (case-insensitive) constraint on fin_tax_code(vendor_id, code).

Revision ID: fin020_tax_code_unique_constraint
Revises: fin019_asset_units_of_production
Create Date: 2026-09-07

Changes:
- Deactivates duplicate tax codes (same vendor_id + upper(code)) keeping the
  oldest row per pair so the constraint can be applied without data loss.
- Adds a unique expression index on (vendor_id, upper(code)) which acts as the
  uniqueness guard at the DB layer.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "fin020_tax_code_unique_constraint"
down_revision = "fin019_asset_units_of_production"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: deactivate every duplicate row that would violate the new constraint,
    # keeping the single oldest row (smallest created_at, tie-broken by id) for
    # each (vendor_id, upper(code)) pair.
    conn.execute(text("""
        UPDATE fin_tax_code
        SET    is_active = FALSE
        WHERE  id NOT IN (
            SELECT DISTINCT ON (vendor_id, upper(code))
                   id
            FROM   fin_tax_code
            ORDER  BY vendor_id, upper(code), created_at ASC NULLS LAST, id ASC
        )
    """))

    # Step 2: create a partial unique index covering only active rows.
    # Deactivated duplicates are excluded via WHERE, so they don't violate the constraint.
    op.create_index(
        "uq_fin_tax_code_vendor_code",
        "fin_tax_code",
        [sa.text("vendor_id"), sa.text("upper(code)")],
        unique=True,
        postgresql_using="btree",
        postgresql_where=sa.text("is_active = TRUE"),
    )


def downgrade() -> None:
    op.drop_index("uq_fin_tax_code_vendor_code", table_name="fin_tax_code", if_exists=True)
