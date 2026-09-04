"""Add service_id to purchase_order_item and make product_id nullable.

Revision ID: proc019_po_item_service_id
Revises: proc018_po_item_acct_value
Create Date: 2026-09-03

Changes:
- purchase_order_item.product_id: NOT NULL -> nullable
- purchase_order_item.service_id: new nullable FK -> service.id (ON DELETE RESTRICT)
- CHECK constraint: at least one of product_id / service_id must be set
- Index on service_id
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "proc019_po_item_service_id"
down_revision = "proc018_po_item_acct_value"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("purchase_order_item")}

    # 1. Make product_id nullable
    op.execute(
        """
        ALTER TABLE purchase_order_item
        ALTER COLUMN product_id DROP NOT NULL
        """
    )

    # 2. Add service_id column
    if "service_id" not in cols:
        op.add_column(
            "purchase_order_item",
            sa.Column(
                "service_id",
                UUID(as_uuid=True),
                sa.ForeignKey("service.id", ondelete="RESTRICT"),
                nullable=True,
            ),
        )
        op.create_index(
            "ix_poi_service",
            "purchase_order_item",
            ["service_id"],
            postgresql_where=sa.text("service_id IS NOT NULL"),
        )

    # 3. CHECK: at least one of product_id / service_id must be non-null
    constraints = {c["name"] for c in insp.get_check_constraints("purchase_order_item")}
    if "ck_poi_product_or_service" not in constraints:
        op.execute(
            """
            ALTER TABLE purchase_order_item
            ADD CONSTRAINT ck_poi_product_or_service
            CHECK (product_id IS NOT NULL OR service_id IS NOT NULL)
            """
        )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE purchase_order_item DROP CONSTRAINT IF EXISTS ck_poi_product_or_service"
    )
    op.drop_index("ix_poi_service", table_name="purchase_order_item")
    op.drop_column("purchase_order_item", "service_id")
    op.execute(
        "ALTER TABLE purchase_order_item ALTER COLUMN product_id SET NOT NULL"
    )
