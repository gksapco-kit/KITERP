"""dom001 — external domain & registrar access fields on vendor

Adds fields for a vendor to register their external domain and grant
KIT ERP team delegated access for DNS / domain maintenance.

Revision ID: dom001_ext_domain
Revises: vf001_vplat_audit
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'dom001_ext_domain'
down_revision = 'vf001_vplat_audit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('vendor', sa.Column('external_domain_enabled',    sa.Boolean,      server_default='false', nullable=False))
    op.add_column('vendor', sa.Column('external_domain_name',       sa.String(255),  nullable=True))
    op.add_column('vendor', sa.Column('external_domain_registrar',  sa.String(60),   nullable=True))
    op.add_column('vendor', sa.Column('external_domain_reg_email',  sa.String(255),  nullable=True))
    op.add_column('vendor', sa.Column('external_domain_holder',     sa.String(255),  nullable=True))
    op.add_column('vendor', sa.Column('external_domain_expiry',     sa.Date,         nullable=True))
    op.add_column('vendor', sa.Column('external_domain_access_status', sa.String(30), server_default='not_requested', nullable=False))
    op.add_column('vendor', sa.Column('external_domain_recovery_contact', sa.String(255), nullable=True))
    op.add_column('vendor', sa.Column('external_domain_notes',      sa.Text,         nullable=True))
    op.add_column('vendor', sa.Column('external_domain_access_requested_at', sa.DateTime, nullable=True))
    op.add_column('vendor', sa.Column('external_domain_access_granted_at',   sa.DateTime, nullable=True))


def downgrade() -> None:
    for col in [
        'external_domain_access_granted_at',
        'external_domain_access_requested_at',
        'external_domain_notes',
        'external_domain_recovery_contact',
        'external_domain_access_status',
        'external_domain_expiry',
        'external_domain_holder',
        'external_domain_reg_email',
        'external_domain_registrar',
        'external_domain_name',
        'external_domain_enabled',
    ]:
        op.drop_column('vendor', col)
