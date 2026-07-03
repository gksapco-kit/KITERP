"""Add vendor_testimonials table for curated testimonial sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales008_vendor_testimonials"
down_revision = "sales007_vendor_recurring_plans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_testimonials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(160), nullable=True),
        sa.Column("company", sa.String(160), nullable=True),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("avatar_url", sa.String(1000), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_testimonials_vendor", "vendor_testimonials", ["vendor_id"])


def downgrade() -> None:
    op.drop_index("idx_vendor_testimonials_vendor", table_name="vendor_testimonials")
    op.drop_table("vendor_testimonials")
