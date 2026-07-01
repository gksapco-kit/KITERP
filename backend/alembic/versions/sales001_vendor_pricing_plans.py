"""Add vendor_pricing_plans table for storefront pricing sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales001_vendor_pricing_plans"
down_revision = "web008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_pricing_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("period", sa.String(40), nullable=False, server_default="mo"),
        sa.Column("features", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("cta_label", sa.String(120), nullable=False, server_default="Get started"),
        sa.Column("cta_url", sa.String(500), nullable=False, server_default="/contact"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_pricing_plans_vendor", "vendor_pricing_plans", ["vendor_id"])
    op.create_index(
        "idx_vendor_pricing_plans_vendor_slug",
        "vendor_pricing_plans",
        ["vendor_id", "slug"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("idx_vendor_pricing_plans_vendor_slug", table_name="vendor_pricing_plans")
    op.drop_index("idx_vendor_pricing_plans_vendor", table_name="vendor_pricing_plans")
    op.drop_table("vendor_pricing_plans")
