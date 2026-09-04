"""Expose product.material_type and denormalise it onto PR/PO item lines.

Revision ID: proc016_material_type_on_lines
Revises: proc015_doc_org_dimensions
Create Date: 2026-09-03

product.material_type already exists as a raw DB column (mrp003_product_material_type)
but was never mapped in the SQLAlchemy model.  This migration adds nothing to the
product table — it just ensures the column is there so the ORM can read it.

For the approver-matrix resolver we need material_type at the line level without
joining through product every time.  We denormalise it onto:
  purchase_requisition_item.material_type
  purchase_order_item.material_type

Both are backfilled from product.material_type where a product_id is present.
"""
from alembic import op
import sqlalchemy as sa

revision = 'proc016_material_type_on_lines'
down_revision = 'proc015_doc_org_dimensions'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'purchase_requisition_item',
        sa.Column('material_type', sa.String(30), nullable=True),
    )
    op.create_index(
        'ix_pri_material_type',
        'purchase_requisition_item',
        ['material_type'],
    )

    op.add_column(
        'purchase_order_item',
        sa.Column('material_type', sa.String(30), nullable=True),
    )
    op.create_index(
        'ix_poi_material_type',
        'purchase_order_item',
        ['material_type'],
    )

    # Backfill from product.material_type where product_id is set
    op.execute("""
        UPDATE purchase_requisition_item pri
        SET material_type = p.material_type
        FROM product p
        WHERE pri.product_id = p.id
          AND p.material_type IS NOT NULL
    """)

    op.execute("""
        UPDATE purchase_order_item poi
        SET material_type = p.material_type
        FROM product p
        WHERE poi.product_id = p.id
          AND p.material_type IS NOT NULL
    """)


def downgrade():
    op.drop_index('ix_poi_material_type', table_name='purchase_order_item')
    op.drop_column('purchase_order_item', 'material_type')
    op.drop_index('ix_pri_material_type', table_name='purchase_requisition_item')
    op.drop_column('purchase_requisition_item', 'material_type')
