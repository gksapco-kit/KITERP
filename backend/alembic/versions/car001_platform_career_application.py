"""Platform Careers applications (student CV submissions).

Revision ID: car001_platform_career_application
Revises: sfq001_storefront_contact_query
Create Date: 2026-07-18
"""
from alembic import op

revision = "car001_platform_career_application"
down_revision = "sfq001_storefront_contact_query"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS platform_career_application (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(40),
            college VARCHAR(255),
            course VARCHAR(255),
            graduation_year INTEGER,
            city VARCHAR(120),
            linkedin_url VARCHAR(500),
            cover_note TEXT,
            cv_url VARCHAR(500) NOT NULL,
            cv_filename VARCHAR(255),
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            ip_address VARCHAR(64),
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_platform_career_application_status ON platform_career_application(status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_platform_career_application_created ON platform_career_application(created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_platform_career_application_email ON platform_career_application(email)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS platform_career_application")
