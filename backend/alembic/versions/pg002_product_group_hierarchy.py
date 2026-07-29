"""Product Group Hierarchy: add parent_id, code, level, path columns to product_group table.

Revision ID: pg002_product_group_hierarchy
Revises: pg001_product_groups
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "pg002_product_group_hierarchy"
down_revision = "pg001_product_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add hierarchy columns to product_group
    op.add_column("product_group", sa.Column("parent_id", UUID(as_uuid=True), nullable=True))
    op.add_column("product_group", sa.Column("code", sa.String(30), nullable=True))
    op.add_column("product_group", sa.Column("level", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("product_group", sa.Column("path", sa.String(2000), nullable=False, server_default=""))

    # Self-referential FK: RESTRICT on delete so we can't orphan children
    op.create_foreign_key(
        "fk_product_group_parent",
        "product_group", "product_group",
        ["parent_id"], ["id"],
        ondelete="RESTRICT",
    )

    # Indexes for hierarchy queries
    op.create_index("idx_product_group_parent", "product_group", ["vendor_id", "parent_id"])
    op.create_index("idx_product_group_path", "product_group", ["vendor_id", "path"])

    # Back-fill path = slug for all existing rows (they're all roots)
    op.execute(
        "UPDATE product_group SET path = slug, level = 0 WHERE path = '' OR path IS NULL"
    )


def downgrade() -> None:
    op.drop_index("idx_product_group_path", table_name="product_group")
    op.drop_index("idx_product_group_parent", table_name="product_group")
    op.drop_constraint("fk_product_group_parent", "product_group", type_="foreignkey")
    op.drop_column("product_group", "path")
    op.drop_column("product_group", "level")
    op.drop_column("product_group", "code")
    op.drop_column("product_group", "parent_id")
