"""Add vendor_events table for ticket picker sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales006_vendor_events"
down_revision = "sales005_vendor_vehicles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("tagline", sa.String(500), nullable=True),
        sa.Column("image_url", sa.String(1000), nullable=True),
        sa.Column("event_date", sa.String(20), nullable=True),
        sa.Column("doors_time", sa.String(10), nullable=True),
        sa.Column("start_time", sa.String(10), nullable=True),
        sa.Column("venue", sa.String(255), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("age_note", sa.String(255), nullable=True),
        sa.Column("order_title", sa.String(120), nullable=False, server_default="Your order"),
        sa.Column("seating_title", sa.String(120), nullable=False, server_default="Seating chart"),
        sa.Column("show_seating", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("max_per_order", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("cta_label", sa.String(120), nullable=False, server_default="Continue to checkout"),
        sa.Column("tiers", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_events_vendor", "vendor_events", ["vendor_id"])
    op.create_index(
        "idx_vendor_events_vendor_slug",
        "vendor_events",
        ["vendor_id", "slug"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_vendor_events_vendor_slug", table_name="vendor_events")
    op.drop_index("idx_vendor_events_vendor", table_name="vendor_events")
    op.drop_table("vendor_events")
