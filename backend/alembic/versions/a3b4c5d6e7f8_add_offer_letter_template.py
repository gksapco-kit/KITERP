"""add_offer_letter_template

Revision ID: a3b4c5d6e7f8
Revises: b1c2d3e4f5a7
Create Date: 2026-04-18 15:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'b1c2d3e4f5a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'hr_offer_letter_template',
        sa.Column('id',             postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('vendor_id',      postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name',           sa.String(150),                nullable=False),
        sa.Column('description',    sa.String(300),                nullable=True),
        sa.Column('body_html',      sa.Text(),                     nullable=False),
        sa.Column('is_default',     sa.Boolean(),                  nullable=False, server_default='false'),
        sa.Column('designation_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('department_id',  postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('store_id',       postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at',     sa.DateTime(timezone=True),    server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at',     sa.DateTime(timezone=True),    server_default=sa.text('now()'), nullable=True),

        sa.ForeignKeyConstraint(['vendor_id'],      ['vendor.id'],          ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['designation_id'], ['hr_designation.id'],  ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['department_id'],  ['hr_department.id'],   ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['store_id'],       ['store.id'],           ondelete='SET NULL'),
        sa.UniqueConstraint('vendor_id', 'name', name='uq_offer_letter_template_vendor_name'),
    )
    op.create_index('ix_hr_offer_letter_template_vendor_id', 'hr_offer_letter_template', ['vendor_id'])
    op.create_index('ix_offer_letter_template_scope',        'hr_offer_letter_template',
                    ['vendor_id', 'designation_id', 'department_id', 'store_id'])


def downgrade() -> None:
    op.drop_index('ix_offer_letter_template_scope',        table_name='hr_offer_letter_template')
    op.drop_index('ix_hr_offer_letter_template_vendor_id', table_name='hr_offer_letter_template')
    op.drop_table('hr_offer_letter_template')
