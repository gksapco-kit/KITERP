"""add category hierarchy fields

Revision ID: f1a2b3c4d5e6
Revises: d7e8f9a0b1c2
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "f1a2b3c4d5e6"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vendor_category", sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("vendor_category.id", ondelete="CASCADE"), nullable=True))
    op.add_column("vendor_category", sa.Column("sort_order", sa.Integer(), server_default="0", nullable=True))
    op.add_column("vendor_category", sa.Column("custom_fields", JSONB(), server_default="[]", nullable=True))
    op.create_index("idx_vendor_category_parent", "vendor_category", ["vendor_id", "parent_id"])


def downgrade() -> None:
    op.drop_index("idx_vendor_category_parent", table_name="vendor_category")
    op.drop_column("vendor_category", "custom_fields")
    op.drop_column("vendor_category", "sort_order")
    op.drop_column("vendor_category", "parent_id")
