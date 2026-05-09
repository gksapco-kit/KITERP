"""add variant pricing, uom, discount columns

Revision ID: k2c3d4e5f6g7
Revises: j1b2c3d4e5f6
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "k2c3d4e5f6g7"
down_revision: Union[str, None] = "j1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_COLS = {
    "uom": ("VARCHAR(30)", "'piece'"),
    "currency": ("VARCHAR(3)", "'INR'"),
    "discount_percentage": ("NUMERIC(5,2)", None),
    "discount_amount": ("NUMERIC(12,2)", None),
    "offer_label": ("VARCHAR(100)", None),
    "is_on_sale": ("BOOLEAN", "false"),
    "weight_kg": ("NUMERIC(8,3)", None),
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
