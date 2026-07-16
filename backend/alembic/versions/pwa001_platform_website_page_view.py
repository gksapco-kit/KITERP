"""pwa001 — platform marketing site page views (kiterp.com)

Revision ID: pwa001
Revises: web011
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "pwa001"
down_revision = "web011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_website_page_view",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("visitor_id", sa.String(120), nullable=True),
        sa.Column("event_type", sa.String(60), nullable=False, server_default="page_view"),
        sa.Column("path", sa.String(500), nullable=False, server_default="/"),
        sa.Column("payload", JSONB(), nullable=True, server_default="{}"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_platform_pv_occurred", "platform_website_page_view", ["occurred_at"])
    op.create_index("ix_platform_pv_path_time", "platform_website_page_view", ["path", "occurred_at"])
    op.create_index("ix_platform_pv_visitor", "platform_website_page_view", ["visitor_id"])


def downgrade() -> None:
    op.drop_index("ix_platform_pv_visitor", table_name="platform_website_page_view")
    op.drop_index("ix_platform_pv_path_time", table_name="platform_website_page_view")
    op.drop_index("ix_platform_pv_occurred", table_name="platform_website_page_view")
    op.drop_table("platform_website_page_view")
