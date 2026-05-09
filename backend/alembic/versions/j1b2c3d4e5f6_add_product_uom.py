"""add product uom column

Revision ID: j1b2c3d4e5f6
Revises: i0a1b2c3d4e5
Create Date: 2026-04-07
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "j1b2c3d4e5f6"
down_revision: Union[str, None] = "i0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product")}
    if "uom" not in cols:
        op.add_column(
            "product",
            sa.Column("uom", sa.String(30), server_default="piece", nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product")}
    if "uom" in cols:
        op.drop_column("product", "uom")
