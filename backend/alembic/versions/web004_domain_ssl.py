"""web004 — custom domain verification + SSL fields

Adds domain_verification_token, domain_verified, domain_ssl_status,
domain_ssl_expires_at to wb_sites.

Revision ID: web004
Revises: web003
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = 'web004'
down_revision = 'web003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('wb_sites', sa.Column('domain_verification_token', sa.String(64), nullable=True))
    op.add_column('wb_sites', sa.Column('domain_verified', sa.Boolean, server_default='false'))
    op.add_column('wb_sites', sa.Column('domain_ssl_status', sa.String(30), nullable=True))
    op.add_column('wb_sites', sa.Column('domain_ssl_expires_at', sa.DateTime, nullable=True))


def downgrade() -> None:
    op.drop_column('wb_sites', 'domain_ssl_expires_at')
    op.drop_column('wb_sites', 'domain_ssl_status')
    op.drop_column('wb_sites', 'domain_verified')
    op.drop_column('wb_sites', 'domain_verification_token')
