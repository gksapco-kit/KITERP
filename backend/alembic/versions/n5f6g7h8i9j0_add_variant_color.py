"""add color column to product_variant

Revision ID: n5f6g7h8i9j0
Revises: m4e5f6g7h8i9
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "n5f6g7h8i9j0"
down_revision: Union[str, None] = "m4e5f6g7h8i9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product_variant")}
    if "color" not in cols:
        op.execute("ALTER TABLE product_variant ADD COLUMN color VARCHAR(50)")


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product_variant")}
    if "color" in cols:
        op.drop_column("product_variant", "color")
