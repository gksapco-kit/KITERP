"""web008 — soft-delete sites/templates (30-day trash retention)

Revision ID: web008
Revises: web007
"""
from alembic import op

revision = "web008"
down_revision = "web007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    op.execute("CREATE INDEX IF NOT EXISTS ix_wb_sites_deleted_at ON wb_sites(deleted_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_wb_sites_deleted_at")
    op.execute("ALTER TABLE wb_sites DROP COLUMN IF EXISTS deleted_at")
