"""Platform support staff job role and manager assignment.

Revision ID: ps002_job_mgr
Revises: ps001_plat_staff
Create Date: 2026-05-09

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "ps002_job_mgr"
down_revision: Union[str, Sequence[str], None] = "ps001_plat_staff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: ``ensure_user_platform_staff_role_column`` (app lifespan) may create these first.
    op.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS platform_staff_job_role VARCHAR(32)'))
    op.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS platform_staff_manager_id UUID'))
    op.execute(
        text(
            'CREATE INDEX IF NOT EXISTS ix_user_platform_staff_job_role ON "user" (platform_staff_job_role)'
        )
    )
    op.execute(
        text(
            'CREATE INDEX IF NOT EXISTS ix_user_platform_staff_manager_id ON "user" (platform_staff_manager_id)'
        )
    )
    op.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_platform_staff_manager_id_user'
              ) THEN
                ALTER TABLE "user"
                ADD CONSTRAINT fk_user_platform_staff_manager_id_user
                FOREIGN KEY (platform_staff_manager_id) REFERENCES "user"(id) ON DELETE SET NULL;
              END IF;
            END $$;
            """
        )
    )
    op.execute(
        text(
            """
            UPDATE "user"
            SET platform_staff_job_role = 'consulting'
            WHERE platform_staff_role = 'support'
              AND platform_staff_job_role IS NULL
            """
        )
    )


def downgrade() -> None:
    op.execute(text('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS fk_user_platform_staff_manager_id_user'))
    op.execute(text("DROP INDEX IF EXISTS ix_user_platform_staff_manager_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_user_platform_staff_job_role"))
    op.execute(text('ALTER TABLE "user" DROP COLUMN IF EXISTS platform_staff_manager_id'))
    op.execute(text('ALTER TABLE "user" DROP COLUMN IF EXISTS platform_staff_job_role'))
