"""pwa001 — platform marketing site page views (kiterp.com)

Revision ID: pwa001
Revises: web011

Idempotent: table may already exist from ensure_* in database.py.
"""
from alembic import op


revision = "pwa001"
down_revision = "web011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS platform_website_page_view (
            id UUID NOT NULL PRIMARY KEY,
            visitor_id VARCHAR(120),
            event_type VARCHAR(60) DEFAULT 'page_view' NOT NULL,
            path VARCHAR(500) DEFAULT '/' NOT NULL,
            payload JSONB DEFAULT '{}',
            occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_platform_pv_occurred "
        "ON platform_website_page_view (occurred_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_platform_pv_path_time "
        "ON platform_website_page_view (path, occurred_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_platform_pv_visitor "
        "ON platform_website_page_view (visitor_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_platform_pv_visitor")
    op.execute("DROP INDEX IF EXISTS ix_platform_pv_path_time")
    op.execute("DROP INDEX IF EXISTS ix_platform_pv_occurred")
    op.execute("DROP TABLE IF EXISTS platform_website_page_view")
