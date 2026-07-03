"""Add vendor_properties table for real-estate listing sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales002_vendor_properties"
down_revision = "sales001_vendor_pricing_plans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_properties",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("beds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("baths", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sqft", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("property_type", sa.String(40), nullable=False, server_default="house"),
        sa.Column("status", sa.String(40), nullable=False, server_default="for-sale"),
        sa.Column("image_url", sa.String(1000), nullable=True),
        sa.Column("gallery", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("agent_name", sa.String(160), nullable=True),
        sa.Column("agent_phone", sa.String(60), nullable=True),
        sa.Column("agent_email", sa.String(200), nullable=True),
        sa.Column("cta_label", sa.String(120), nullable=False, server_default="Schedule tour"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_properties_vendor", "vendor_properties", ["vendor_id"])
    op.create_index(
        "idx_vendor_properties_vendor_slug",
        "vendor_properties",
        ["vendor_id", "slug"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_vendor_properties_vendor_slug", table_name="vendor_properties")
    op.drop_index("idx_vendor_properties_vendor", table_name="vendor_properties")
    op.drop_table("vendor_properties")
