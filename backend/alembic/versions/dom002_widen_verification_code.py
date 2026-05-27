"""dom002 — widen user.verification_code from VARCHAR(6) to VARCHAR(64)

The domain-deactivation OTP flow stores a prefixed value like "domain-off:123456"
which exceeds the old 6-character limit.

Revision ID: dom002_widen_verif_code
Revises: dom001_ext_domain
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa

revision = 'dom002_widen_verif_code'
down_revision = 'dom001_ext_domain'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'user',
        'verification_code',
        existing_type=sa.String(6),
        type_=sa.String(64),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'user',
        'verification_code',
        existing_type=sa.String(64),
        type_=sa.String(6),
        existing_nullable=True,
    )
