"""Add vendor_booking_resources table for Resource Picker sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales010_vendor_booking_resources"
down_revision = "sales009_vendor_booking_wizard_steps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_booking_resources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("resource_type", sa.String(60), nullable=False, server_default="room"),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("features", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("price_per_hour", sa.Float(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_booking_resources_vendor", "vendor_booking_resources", ["vendor_id"])


def downgrade() -> None:
    op.drop_index("idx_vendor_booking_resources_vendor", table_name="vendor_booking_resources")
    op.drop_table("vendor_booking_resources")
