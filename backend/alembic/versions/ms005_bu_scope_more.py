"""business-unit scope for booking, project (+items), coupon

Revision ID: ms005_bu_scope_more
Revises: ms004_pos_store_scope
Create Date: 2026-06-18

Adds store_id to booking, pm_project and coupon so these records can be
attributed to / scoped by a business unit, plus a JSONB items column on
pm_project to hold catalog products/services associated with a project.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'ms005_bu_scope_more'
down_revision = 'ms004_pos_store_scope'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('booking', sa.Column('store_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_booking_store', 'booking', 'store', ['store_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_booking_store', 'booking', ['store_id'])

    op.add_column('pm_project', sa.Column('store_id', UUID(as_uuid=True), nullable=True))
    op.add_column('pm_project', sa.Column('items', JSONB(), nullable=True, server_default='[]'))
    op.create_foreign_key('fk_pm_project_store', 'pm_project', 'store', ['store_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_pm_project_store', 'pm_project', ['store_id'])

    op.add_column('coupon', sa.Column('store_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_coupon_store', 'coupon', 'store', ['store_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_coupon_store', 'coupon', ['store_id'])


def downgrade():
    op.drop_index('ix_coupon_store', table_name='coupon')
    op.drop_constraint('fk_coupon_store', 'coupon', type_='foreignkey')
    op.drop_column('coupon', 'store_id')

    op.drop_index('ix_pm_project_store', table_name='pm_project')
    op.drop_constraint('fk_pm_project_store', 'pm_project', type_='foreignkey')
    op.drop_column('pm_project', 'items')
    op.drop_column('pm_project', 'store_id')

    op.drop_index('ix_booking_store', table_name='booking')
    op.drop_constraint('fk_booking_store', 'booking', type_='foreignkey')
    op.drop_column('booking', 'store_id')
