"""Add passport photo URL to career applications.

Revision ID: car002_career_photo_url
Revises: car001_platform_career_application
Create Date: 2026-07-18
"""
from alembic import op

revision = "car002_career_photo_url"
down_revision = "car001_platform_career_application"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE platform_career_application ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500)"
    )
    op.execute(
        "ALTER TABLE platform_career_application ADD COLUMN IF NOT EXISTS photo_filename VARCHAR(255)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE platform_career_application DROP COLUMN IF EXISTS photo_filename")
    op.execute("ALTER TABLE platform_career_application DROP COLUMN IF EXISTS photo_url")
