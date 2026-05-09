"""add target_type and target_category to upsell_mapping

Revision ID: q8i9j0k1l2m3
Revises: p7h8i9j0k1l2
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'q8i9j0k1l2m3'
down_revision: Union[str, None] = 'p7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if "upsell_mapping" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("upsell_mapping")}

    if "target_type" not in cols:
        op.execute("ALTER TABLE upsell_mapping ADD COLUMN target_type VARCHAR(20) NOT NULL DEFAULT 'product'")
    if "target_category" not in cols:
        op.execute("ALTER TABLE upsell_mapping ADD COLUMN target_category VARCHAR(100)")

    op.execute("ALTER TABLE upsell_mapping ALTER COLUMN target_product_id DROP NOT NULL")
    op.execute("ALTER TABLE upsell_mapping DROP CONSTRAINT IF EXISTS uq_upsell_src_tgt_type")
    op.execute("CREATE INDEX IF NOT EXISTS idx_upsell_category ON upsell_mapping(vendor_id, target_category)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_upsell_category")
    op.execute("ALTER TABLE upsell_mapping DROP COLUMN IF EXISTS target_category")
    op.execute("ALTER TABLE upsell_mapping DROP COLUMN IF EXISTS target_type")
