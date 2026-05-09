"""cat001 backfill is_visible NULL → True for products and services

Revision ID: cat001
Revises:
Create Date: 2026-04-24

The is_visible column on vendor_products and vendor_services was added with
ORM-only default=True (no server_default), so rows inserted before the column
existed have NULL.  The catalog API now treats NULL as visible, but this
migration backfills those rows to TRUE to keep the data consistent.
"""
from alembic import op

revision = 'cat001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE product SET is_visible = TRUE WHERE is_visible IS NULL"
    )
    op.execute(
        "UPDATE service SET is_visible = TRUE WHERE is_visible IS NULL"
    )


def downgrade():
    pass
