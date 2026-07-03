"""Add vendor_vehicles table for auto inventory / vehicle detail sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales005_vendor_vehicles"
down_revision = "sales004_vendor_fitness_classes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_vehicles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False, server_default="2024"),
        sa.Column("make", sa.String(120), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("trim", sa.String(120), nullable=True),
        sa.Column("condition", sa.String(20), nullable=False, server_default="Used"),
        sa.Column("price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("mileage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fuel", sa.String(20), nullable=False, server_default="Gas"),
        sa.Column("transmission", sa.String(20), nullable=False, server_default="Auto"),
        sa.Column("body_style", sa.String(60), nullable=True),
        sa.Column("exterior_color", sa.String(60), nullable=True),
        sa.Column("image_url", sa.String(1000), nullable=True),
        sa.Column("stock_number", sa.String(80), nullable=True),
        sa.Column("location_note", sa.String(500), nullable=True),
        sa.Column("cta_label", sa.String(120), nullable=False, server_default="Schedule test drive"),
        sa.Column("highlights", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_vehicles_vendor", "vendor_vehicles", ["vendor_id"])
    op.create_index(
        "idx_vendor_vehicles_vendor_slug",
        "vendor_vehicles",
        ["vendor_id", "slug"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_vendor_vehicles_vendor_slug", table_name="vendor_vehicles")
    op.drop_index("idx_vendor_vehicles_vendor", table_name="vendor_vehicles")
    op.drop_table("vendor_vehicles")
