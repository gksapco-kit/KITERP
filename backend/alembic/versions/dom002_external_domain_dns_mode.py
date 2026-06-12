"""dom002 — external domain DNS management mode on vendor

Adds ``external_domain_dns_mode`` so a vendor can choose to either manage the
DNS records themselves (``self_managed``) or request KIT ERP to configure DNS
on their behalf via delegated registrar access (``kit_assisted``).

Revision ID: dom002_ext_domain_dns
Revises: p001_phase1_gaps
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'dom002_ext_domain_dns'
down_revision = 'p001_phase1_gaps'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'vendor',
        sa.Column('external_domain_dns_mode', sa.String(20), server_default='kit_assisted', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('vendor', 'external_domain_dns_mode')
