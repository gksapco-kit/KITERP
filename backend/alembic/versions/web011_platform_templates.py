"""web011 — platform-curated website builder templates

Revision ID: web011
Revises: web010

Idempotent: table may already exist from SQLAlchemy create/ensure paths.
"""
from alembic import op


revision = "web011"
down_revision = "web010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS wb_platform_templates (
            id UUID NOT NULL PRIMARY KEY,
            slug VARCHAR(120) NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            thumbnail VARCHAR(500),
            category VARCHAR(80) NOT NULL DEFAULT 'custom',
            tags JSON NOT NULL DEFAULT '[]',
            source_site_id UUID REFERENCES wb_sites(id) ON DELETE SET NULL,
            source_vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL,
            catalog_status VARCHAR(20) NOT NULL DEFAULT 'draft',
            snapshot JSON NOT NULL DEFAULT '{}',
            snapshot_source_updated_at TIMESTAMP WITHOUT TIME ZONE,
            published_at TIMESTAMP WITHOUT TIME ZONE,
            published_by_user_id UUID,
            last_synced_at TIMESTAMP WITHOUT TIME ZONE,
            last_synced_by_user_id UUID,
            deleted_at TIMESTAMP WITHOUT TIME ZONE,
            created_at TIMESTAMP WITHOUT TIME ZONE,
            updated_at TIMESTAMP WITHOUT TIME ZONE
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_wb_platform_templates_slug "
        "ON wb_platform_templates (slug)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wb_platform_templates_source_site_id "
        "ON wb_platform_templates (source_site_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wb_platform_templates_source_vendor_id "
        "ON wb_platform_templates (source_vendor_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wb_platform_templates_catalog_status "
        "ON wb_platform_templates (catalog_status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wb_platform_templates_deleted_at "
        "ON wb_platform_templates (deleted_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_wb_platform_templates_deleted_at")
    op.execute("DROP INDEX IF EXISTS ix_wb_platform_templates_catalog_status")
    op.execute("DROP INDEX IF EXISTS ix_wb_platform_templates_source_vendor_id")
    op.execute("DROP INDEX IF EXISTS ix_wb_platform_templates_source_site_id")
    op.execute("DROP INDEX IF EXISTS ix_wb_platform_templates_slug")
    op.execute("DROP TABLE IF EXISTS wb_platform_templates")
