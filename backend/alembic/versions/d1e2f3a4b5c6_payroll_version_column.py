"""payroll_version_column

Revision ID: d1e2f3a4b5c6
Revises: a3b4c5d6e7f8
Create Date: 2026-04-18 20:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add version column with default 1
    op.add_column('hr_payroll_run', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))

    # Drop the old unique constraint (vendor_id, month, year)
    op.drop_constraint('uq_payroll_vendor_month_year', 'hr_payroll_run', type_='unique')

    # Create new unique constraint including version
    op.create_unique_constraint(
        'uq_payroll_vendor_month_year_version',
        'hr_payroll_run',
        ['vendor_id', 'month', 'year', 'version']
    )


def downgrade() -> None:
    op.drop_constraint('uq_payroll_vendor_month_year_version', 'hr_payroll_run', type_='unique')
    op.create_unique_constraint('uq_payroll_vendor_month_year', 'hr_payroll_run', ['vendor_id', 'month', 'year'])
    op.drop_column('hr_payroll_run', 'version')
