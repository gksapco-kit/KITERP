"""add uom_quantity to service_plan

Revision ID: svc001_plan_uom_quantity
Revises: var001_max_qty_per_order
Create Date: 2026-09-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "svc001_plan_uom_quantity"
down_revision: Union[str, Sequence[str], None] = "var001_max_qty_per_order"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("service_plan")}
    if "uom_quantity" not in cols:
        op.add_column(
            "service_plan",
            sa.Column("uom_quantity", sa.Numeric(12, 3), nullable=True, server_default="1"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("service_plan")}
    if "uom_quantity" in cols:
        op.drop_column("service_plan", "uom_quantity")
