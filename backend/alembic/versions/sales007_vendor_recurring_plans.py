"""Add vendor_recurring_plans table for recurring booking sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales007_vendor_recurring_plans"
down_revision = "sales006_vendor_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_recurring_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("image_url", sa.String(1000), nullable=True),
        sa.Column("start_date", sa.String(20), nullable=True),
        sa.Column("start_time", sa.String(10), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("price_per_session", sa.Float(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("default_session_count", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("min_sessions", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("max_sessions", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("show_upcoming", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cta_label", sa.String(120), nullable=False, server_default="Confirm series"),
        sa.Column("presets", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_recurring_plans_vendor", "vendor_recurring_plans", ["vendor_id"])
    op.create_index(
        "idx_vendor_recurring_plans_vendor_slug",
        "vendor_recurring_plans",
        ["vendor_id", "slug"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_vendor_recurring_plans_vendor_slug", table_name="vendor_recurring_plans")
    op.drop_index("idx_vendor_recurring_plans_vendor", table_name="vendor_recurring_plans")
    op.drop_table("vendor_recurring_plans")
