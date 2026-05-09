"""add pending_email + email change fields to user

Adds three columns to support the self-service email-change flow:
  - pending_email             VARCHAR(255)
  - email_change_code         VARCHAR(6)
  - email_change_expires_at   TIMESTAMPTZ

All operations are wrapped in IF NOT EXISTS / IF EXISTS so the migration
is safe to apply against databases where the columns may already exist
(e.g. dev DBs touched by hand).

Revision ID: c4d8e1f29a01
Revises: b8976eee49a5
Create Date: 2026-04-17 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c4d8e1f29a01'
down_revision: Union[str, None] = 'b8976eee49a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""ALTER TABLE "user" ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255)""")
    op.execute("""ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email_change_code VARCHAR(6)""")
    op.execute("""ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email_change_expires_at TIMESTAMPTZ""")


def downgrade() -> None:
    op.execute("""ALTER TABLE "user" DROP COLUMN IF EXISTS email_change_expires_at""")
    op.execute("""ALTER TABLE "user" DROP COLUMN IF EXISTS email_change_code""")
    op.execute("""ALTER TABLE "user" DROP COLUMN IF EXISTS pending_email""")
