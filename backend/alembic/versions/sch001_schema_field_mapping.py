"""schema_field_mapping table for Models UI field wiring

Revision ID: sch001_schema_field_mapping
Revises: store001_add_is_open
Create Date: 2026-06-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "sch001_schema_field_mapping"
down_revision = "store001_add_is_open"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "schema_field_mapping",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("table_name", sa.String(120), nullable=False),
        sa.Column("column_name", sa.String(120), nullable=False),
        sa.Column("ui_label", sa.String(200), nullable=False),
        sa.Column("help_short", sa.Text(), nullable=True),
        sa.Column("help_full", sa.Text(), nullable=True),
        sa.Column("screens", JSONB(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("vendor_id", "table_name", "column_name", name="uq_schema_field_mapping_vendor_col"),
    )
    op.create_index("ix_schema_field_mapping_vendor_id", "schema_field_mapping", ["vendor_id"])
    op.create_index("ix_schema_field_mapping_vendor_table", "schema_field_mapping", ["vendor_id", "table_name"])


def downgrade() -> None:
    op.drop_index("ix_schema_field_mapping_vendor_table", table_name="schema_field_mapping")
    op.drop_index("ix_schema_field_mapping_vendor_id", table_name="schema_field_mapping")
    op.drop_table("schema_field_mapping")
