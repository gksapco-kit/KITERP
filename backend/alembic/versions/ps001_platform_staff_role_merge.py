"""Add platform_staff_role to user (merge heads).

Revision ID: ps001_plat_staff
Revises: 639f0d132b44, blog001, cat002, co005, comm005_finance_fiscal_catchup
Create Date: 2026-05-09

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "ps001_plat_staff"
down_revision: Union[str, Sequence[str], None] = (
    "639f0d132b44",
    "blog001",
    "cat002",
    "co005",
    "comm005_finance_fiscal_catchup",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: startup ``ensure_user_platform_staff_role_column`` may already add this column.
    op.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS platform_staff_role VARCHAR(20)'))
    op.execute(
        text(
            'CREATE INDEX IF NOT EXISTS ix_user_platform_staff_role ON "user" (platform_staff_role)'
        )
    )


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS ix_user_platform_staff_role"))
    op.execute(text('ALTER TABLE "user" DROP COLUMN IF EXISTS platform_staff_role'))
