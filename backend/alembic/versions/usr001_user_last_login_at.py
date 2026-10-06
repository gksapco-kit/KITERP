"""Add user.last_login_at for vendor activity on Business Accounts.

Revision ID: usr001_user_last_login_at
Revises: saas001_vendor_plan_billing
Create Date: 2026-10-07

"""
from alembic import op
import sqlalchemy as sa

revision = "usr001_user_last_login_at"
down_revision = "saas001_vendor_plan_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent with startup ensure_user_platform_staff_role_column.
    op.execute('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ')
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_last_login_at ON \"user\" (last_login_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_last_login_at")
    op.drop_column("user", "last_login_at")
