"""Add vendor_courses table for course catalog/detail sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales003_vendor_courses"
down_revision = "sales002_vendor_properties"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("instructor", sa.String(160), nullable=True),
        sa.Column("level", sa.String(20), nullable=False, server_default="Beginner"),
        sa.Column("category", sa.String(120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("duration", sa.String(60), nullable=True),
        sa.Column("lessons", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rating", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("reviews", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("price", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("image_url", sa.String(1000), nullable=True),
        sa.Column("syllabus", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("outcomes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("perks", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("enrolled_label", sa.String(120), nullable=True),
        sa.Column("cta_label", sa.String(120), nullable=False, server_default="Enroll for"),
        sa.Column("preview_cta_label", sa.String(120), nullable=False, server_default="Try free preview"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_courses_vendor", "vendor_courses", ["vendor_id"])
    op.create_index(
        "idx_vendor_courses_vendor_slug",
        "vendor_courses",
        ["vendor_id", "slug"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_vendor_courses_vendor_slug", table_name="vendor_courses")
    op.drop_index("idx_vendor_courses_vendor", table_name="vendor_courses")
    op.drop_table("vendor_courses")
