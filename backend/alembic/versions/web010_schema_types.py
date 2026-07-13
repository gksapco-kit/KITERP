"""web010 — structured data schema type selectors

Revision ID: web010
Revises: web009
"""
from alembic import op

revision = "web010"
down_revision = "web009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS schema_org_type VARCHAR(30) NOT NULL DEFAULT 'auto'"
    )
    op.execute(
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS schema_type VARCHAR(30) NOT NULL DEFAULT 'auto'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE wb_pages DROP COLUMN IF EXISTS schema_type")
    op.execute("ALTER TABLE wb_sites DROP COLUMN IF EXISTS schema_org_type")
