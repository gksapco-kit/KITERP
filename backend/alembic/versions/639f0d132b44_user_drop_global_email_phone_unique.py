"""user_drop_global_email_phone_unique

Allow the same email and/or phone on multiple `user` rows so each vendor can
have their own login identity (team / HR) without colliding globally.

Revision ID: 639f0d132b44
Revises: fin009
Create Date: 2026-05-05 14:41:45.315366

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "639f0d132b44"
down_revision: Union[str, None] = "fin009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # Unique may exist as INDEX (email) or CONSTRAINT (phone) depending on migration history.
    op.execute(sa.text("DROP INDEX IF EXISTS ix_user_email"))
    op.execute(sa.text('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_phone_key'))
    op.execute(sa.text('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS uq_user_phone'))
    op.execute(sa.text('CREATE INDEX IF NOT EXISTS ix_user_email ON "user" (email)'))
    op.execute(sa.text('CREATE INDEX IF NOT EXISTS ix_user_phone ON "user" (phone)'))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(sa.text("DROP INDEX IF EXISTS ix_user_phone"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_user_email"))
    op.create_index("ix_user_email", "user", ["email"], unique=True)
    op.create_unique_constraint("user_phone_key", "user", ["phone"])
