"""add max_quantity_per_order to product_variant and service_plan

Revision ID: var001_max_qty_per_order
Revises: ms011_project_sales_area, rmenu001_restaurant_menu_tables, sales013_vendor_event_venue_capacity
Create Date: 2026-07-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "var001_max_qty_per_order"
down_revision: Union[str, Sequence[str], None] = (
    "ms011_project_sales_area",
    "rmenu001_restaurant_menu_tables",
    "sales013_vendor_event_venue_capacity",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("product_variant", "service_plan")


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    for table in TABLES:
        cols = {c["name"] for c in insp.get_columns(table)}
        if "max_quantity_per_order" not in cols:
            op.add_column(table, sa.Column("max_quantity_per_order", sa.Integer(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    for table in TABLES:
        cols = {c["name"] for c in insp.get_columns(table)}
        if "max_quantity_per_order" in cols:
            op.drop_column(table, "max_quantity_per_order")
