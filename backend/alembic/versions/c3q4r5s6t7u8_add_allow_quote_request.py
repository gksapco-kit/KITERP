"""add allow_quote_request column to service

Revision ID: c3q4r5s6t7u8
Depends on: b2p3l4n5o6v7
"""
from alembic import op
import sqlalchemy as sa

revision = "c3q4r5s6t7u8"
down_revision = "b2p3l4n5o6v7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("service", sa.Column("allow_quote_request", sa.Boolean(), server_default="false", nullable=True))


def downgrade():
    op.drop_column("service", "allow_quote_request")
