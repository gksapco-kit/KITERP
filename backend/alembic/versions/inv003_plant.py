"""add plant table and plant_id to storage_location

Revision ID: inv003_plant
Revises: d003_merge_before_plant
Create Date: 2026-06-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'inv003_plant'
down_revision = 'd003_merge_before_plant'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create plant table
    op.create_table(
        'plant',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('address', JSONB(), server_default='{}', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_plant_vendor', 'plant', ['vendor_id'])
    op.create_index('idx_plant_store', 'plant', ['vendor_id', 'store_id'])
    op.create_index('idx_plant_store_code', 'plant', ['store_id', 'code'], unique=True)

    # 2. Add plant_id to storage_location as nullable first
    op.add_column('storage_location', sa.Column('plant_id', UUID(as_uuid=True), nullable=True))

    # 3. Backfill: for each distinct store_id, create a default "Main Plant" and assign it
    op.execute("""
        INSERT INTO plant (id, vendor_id, store_id, name, code, is_active, sort_order)
        SELECT gen_random_uuid(), vendor_id, id, 'Main Plant', 'MAIN', true, 0
        FROM store
        ON CONFLICT DO NOTHING
    """)

    op.execute("""
        UPDATE storage_location sl
        SET plant_id = p.id
        FROM plant p
        WHERE p.store_id = sl.store_id
          AND p.code = 'MAIN'
          AND sl.plant_id IS NULL
    """)

    # 4. Make plant_id NOT NULL and add FK + index
    op.alter_column('storage_location', 'plant_id', nullable=False)
    op.create_foreign_key(
        'fk_storage_location_plant_id',
        'storage_location', 'plant',
        ['plant_id'], ['id'],
        ondelete='CASCADE',
    )
    op.create_index('idx_storage_location_plant', 'storage_location', ['vendor_id', 'plant_id'])


def downgrade():
    op.drop_index('idx_storage_location_plant', table_name='storage_location')
    op.drop_constraint('fk_storage_location_plant_id', 'storage_location', type_='foreignkey')
    op.drop_column('storage_location', 'plant_id')

    op.drop_index('idx_plant_store_code', table_name='plant')
    op.drop_index('idx_plant_store', table_name='plant')
    op.drop_index('idx_plant_vendor', table_name='plant')
    op.drop_table('plant')
