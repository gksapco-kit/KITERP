"""web009 — per-page SEO: focus keyword, noindex, OG overrides, canonical

Revision ID: web009
Revises: web008
"""
from alembic import op

revision = "web009"
down_revision = "web008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS focus_keyword VARCHAR(100)")
    op.execute("ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS seo_keywords VARCHAR(500)")
    op.execute("ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS noindex BOOLEAN NOT NULL DEFAULT false")
    op.execute("ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS og_title VARCHAR(200)")
    op.execute("ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS og_description TEXT")
    op.execute("ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(500)")


def downgrade() -> None:
    op.execute("ALTER TABLE wb_pages DROP COLUMN IF EXISTS canonical_url")
    op.execute("ALTER TABLE wb_pages DROP COLUMN IF EXISTS og_description")
    op.execute("ALTER TABLE wb_pages DROP COLUMN IF EXISTS og_title")
    op.execute("ALTER TABLE wb_pages DROP COLUMN IF EXISTS noindex")
    op.execute("ALTER TABLE wb_pages DROP COLUMN IF EXISTS seo_keywords")
    op.execute("ALTER TABLE wb_pages DROP COLUMN IF EXISTS focus_keyword")
