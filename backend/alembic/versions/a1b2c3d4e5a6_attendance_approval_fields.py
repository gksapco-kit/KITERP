"""attendance_approval_fields

Revision ID: a1b2c3d4e5a6
Revises: b8976eee49a5
Create Date: 2026-04-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5a6'
down_revision: Union[str, None] = 'b8976eee49a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('hr_attendance_record', sa.Column('approval_status', sa.String(20), nullable=True, server_default='pending'))
    op.add_column('hr_attendance_record', sa.Column('approved_by', sa.UUID(as_uuid=True), nullable=True))
    op.add_column('hr_attendance_record', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('hr_attendance_record', sa.Column('rejection_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('hr_attendance_record', 'rejection_reason')
    op.drop_column('hr_attendance_record', 'approved_at')
    op.drop_column('hr_attendance_record', 'approved_by')
    op.drop_column('hr_attendance_record', 'approval_status')
