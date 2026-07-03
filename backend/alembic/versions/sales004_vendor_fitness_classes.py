"""Add vendor_fitness_classes table for fitness schedule sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales004_vendor_fitness_classes"
down_revision = "sales003_vendor_courses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_fitness_classes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("instructor", sa.String(160), nullable=True),
        sa.Column("class_type", sa.String(20), nullable=False, server_default="Yoga"),
        sa.Column("duration", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("intensity", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("date", sa.String(60), nullable=True),
        sa.Column("time", sa.String(40), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("booked", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("studio", sa.String(160), nullable=True),
        sa.Column("price", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("cta_label", sa.String(120), nullable=False, server_default="Reserve"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_fitness_classes_vendor", "vendor_fitness_classes", ["vendor_id"])
    op.create_index(
        "idx_vendor_fitness_classes_vendor_slug",
        "vendor_fitness_classes",
        ["vendor_id", "slug"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_vendor_fitness_classes_vendor_slug", table_name="vendor_fitness_classes")
    op.drop_index("idx_vendor_fitness_classes_vendor", table_name="vendor_fitness_classes")
    op.drop_table("vendor_fitness_classes")
