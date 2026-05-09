"""add return & warranty columns to product_variant

Revision ID: m4e5f6g7h8i9
Revises: l3d4e5f6g7h8
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "m4e5f6g7h8i9"
down_revision: Union[str, None] = "l3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_COLS = {
    "is_returnable": ("BOOLEAN", "true"),
    "return_days": ("INTEGER", None),
    "refund_policy": ("VARCHAR(30)", None),
    "return_policy": ("TEXT", None),
    "return_conditions": ("TEXT", None),
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
