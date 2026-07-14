"""web011 — platform-curated website builder templates

Revision ID: web011
Revises: web010
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


revision = "web011"
down_revision = "web010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wb_platform_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("thumbnail", sa.String(500), nullable=True),
        sa.Column("category", sa.String(80), nullable=False, server_default="custom"),
        sa.Column("tags", JSON(), nullable=False, server_default="[]"),
        sa.Column("source_site_id", UUID(as_uuid=True), sa.ForeignKey("wb_sites.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="SET NULL"), nullable=True),
        sa.Column("catalog_status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("snapshot", JSON(), nullable=False, server_default="{}"),
        sa.Column("snapshot_source_updated_at", sa.DateTime(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("published_by_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("last_synced_by_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_wb_platform_templates_slug", "wb_platform_templates", ["slug"], unique=True)
    op.create_index("ix_wb_platform_templates_source_site_id", "wb_platform_templates", ["source_site_id"])
    op.create_index("ix_wb_platform_templates_source_vendor_id", "wb_platform_templates", ["source_vendor_id"])
    op.create_index("ix_wb_platform_templates_catalog_status", "wb_platform_templates", ["catalog_status"])
    op.create_index("ix_wb_platform_templates_deleted_at", "wb_platform_templates", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_wb_platform_templates_deleted_at", table_name="wb_platform_templates")
    op.drop_index("ix_wb_platform_templates_catalog_status", table_name="wb_platform_templates")
    op.drop_index("ix_wb_platform_templates_source_vendor_id", table_name="wb_platform_templates")
    op.drop_index("ix_wb_platform_templates_source_site_id", table_name="wb_platform_templates")
    op.drop_index("ix_wb_platform_templates_slug", table_name="wb_platform_templates")
    op.drop_table("wb_platform_templates")
