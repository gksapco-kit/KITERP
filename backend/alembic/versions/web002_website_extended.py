"""web002 website extended — multi-lang, multi-currency, redirects, location

Revision ID: web002
Revises: web001
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'web002'
down_revision = 'web001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend wb_sites with i18n, currency, location ──────────────────────────
    op.add_column('wb_sites', sa.Column('language', sa.String(10), nullable=True, server_default='en'))
    op.add_column('wb_sites', sa.Column('languages_enabled', sa.JSON, nullable=False, server_default='["en"]'))
    op.add_column('wb_sites', sa.Column('currency', sa.String(10), nullable=True, server_default='USD'))
    op.add_column('wb_sites', sa.Column('currencies_enabled', sa.JSON, nullable=False, server_default='["USD"]'))
    op.add_column('wb_sites', sa.Column('location', sa.String(200), nullable=True))
    op.add_column('wb_sites', sa.Column('timezone', sa.String(100), nullable=True, server_default='UTC'))
    op.add_column('wb_sites', sa.Column('currency_symbol', sa.String(10), nullable=True, server_default='$'))
    op.add_column('wb_sites', sa.Column('currency_position', sa.String(10), nullable=True, server_default='before'))  # before|after
    op.add_column('wb_sites', sa.Column('headless_enabled', sa.Boolean, server_default='false'))
    op.add_column('wb_sites', sa.Column('headless_token', sa.String(64), nullable=True))

    # ── Redirects table ────────────────────────────────────────────────────────
    op.create_table(
        'wb_redirects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_sites.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('from_path', sa.String(500), nullable=False),
        sa.Column('to_path', sa.String(500), nullable=False),
        sa.Column('status_code', sa.Integer, nullable=False, server_default='301'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('hit_count', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('wb_redirects')
    op.drop_column('wb_sites', 'headless_token')
    op.drop_column('wb_sites', 'headless_enabled')
    op.drop_column('wb_sites', 'currency_position')
    op.drop_column('wb_sites', 'currency_symbol')
    op.drop_column('wb_sites', 'timezone')
    op.drop_column('wb_sites', 'location')
    op.drop_column('wb_sites', 'currencies_enabled')
    op.drop_column('wb_sites', 'currency')
    op.drop_column('wb_sites', 'languages_enabled')
    op.drop_column('wb_sites', 'language')
