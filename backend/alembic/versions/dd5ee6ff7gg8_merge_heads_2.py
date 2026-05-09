"""merge heads after cin/company_name migration

Revision ID: dd5ee6ff7gg8
Revises: bb2cc3dd4ee5, c4d5e6f7g8h9
Create Date: 2026-04-14

"""
from alembic import op
import sqlalchemy as sa

revision = "dd5ee6ff7gg8"
down_revision = ("bb2cc3dd4ee5", "c4d5e6f7g8h9")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
