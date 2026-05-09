"""add lifecycle columns to product_variant

Revision ID: l3d4e5f6g7h8
Revises: k2c3d4e5f6g7
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "l3d4e5f6g7h8"
down_revision: Union[str, None] = "k2c3d4e5f6g7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_COLS = {
    "expiration_date": ("DATE", None),
    "manufacture_date": ("DATE", None),
    "best_before_date": ("DATE", None),
    "warranty_period_days": ("INTEGER", None),
    "warranty_type": ("VARCHAR(30)", None),
}


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product_variant")}
    for col_name, (col_type, default) in NEW_COLS.items():
        if col_name not in cols:
            default_clause = f" DEFAULT {default}" if default else ""
            op.execute(
                f"ALTER TABLE product_variant ADD COLUMN {col_name} {col_type}{default_clause}"
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product_variant")}
    for col_name in NEW_COLS:
        if col_name in cols:
            op.drop_column("product_variant", col_name)
