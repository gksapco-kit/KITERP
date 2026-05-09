"""add shipping_cost_type to product

Revision ID: o6g7h8i9j0k1
Revises: n5f6g7h8i9j0
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "o6g7h8i9j0k1"
down_revision: Union[str, None] = "n5f6g7h8i9j0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product")}
    if "shipping_cost_type" not in cols:
        op.execute(
            "ALTER TABLE product ADD COLUMN shipping_cost_type VARCHAR(30) DEFAULT 'fixed'"
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product")}
    if "shipping_cost_type" in cols:
        op.drop_column("product", "shipping_cost_type")
