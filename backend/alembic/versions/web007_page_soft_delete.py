"""web007 — soft-delete pages (7-day trash retention)

Revision ID: web007
Revises: web006
"""
from alembic import op
import sqlalchemy as sa

revision = "web007"
down_revision = "web006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    op.execute("CREATE INDEX IF NOT EXISTS ix_wb_pages_deleted_at ON wb_pages(deleted_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_wb_pages_deleted_at")
    op.execute("ALTER TABLE wb_pages DROP COLUMN IF EXISTS deleted_at")
