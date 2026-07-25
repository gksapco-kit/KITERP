"""Add internal admin note to career applications.

Revision ID: car003_career_admin_note
Revises: car002_career_photo_url
Create Date: 2026-07-26
"""
from alembic import op

revision = "car003_career_admin_note"
down_revision = "car002_career_photo_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE platform_career_application ADD COLUMN IF NOT EXISTS admin_note TEXT"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE platform_career_application DROP COLUMN IF EXISTS admin_note")
