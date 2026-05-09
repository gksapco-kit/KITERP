"""Vendor relationship manager assignment + vendor RM queries.

Revision ID: rm001_vendor_rm
Revises: ps002_job_mgr
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "rm001_vendor_rm"
down_revision: Union[str, None] = "ps002_job_mgr"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            """
            ALTER TABLE vendor
            ADD COLUMN IF NOT EXISTS relationship_manager_user_id UUID
            REFERENCES "user"(id) ON DELETE SET NULL;
            """
        )
    )
    op.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_vendor_relationship_manager_user "
            "ON vendor (relationship_manager_user_id);"
        )
    )
    op.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS vendor_rm_query (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
                created_by_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                subject VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
            """
        )
    )
    op.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_vendor_rm_query_vendor ON vendor_rm_query(vendor_id);"
        )
    )
    op.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_vendor_rm_query_status ON vendor_rm_query(status);"
        )
    )


def downgrade() -> None:
    op.execute(text("DROP TABLE IF EXISTS vendor_rm_query"))
    op.execute(text("DROP INDEX IF EXISTS ix_vendor_relationship_manager_user"))
    op.execute(text("ALTER TABLE vendor DROP COLUMN IF EXISTS relationship_manager_user_id"))
