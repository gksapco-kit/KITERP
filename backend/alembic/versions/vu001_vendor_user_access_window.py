"""vendor_user access window + HR LWD sync fields

Revision ID: vu001_access_window
Revises: vf001_vplat_audit
Create Date: 2026-05-19
"""
from typing import Sequence, Union

from alembic import op

revision: str = "vu001_access_window"
down_revision: Union[str, None] = "vf001_vplat_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""ALTER TABLE vendor_user ADD COLUMN IF NOT EXISTS access_starts_at DATE""")
    op.execute("""ALTER TABLE vendor_user ADD COLUMN IF NOT EXISTS access_ends_at DATE""")
    op.execute("""ALTER TABLE vendor_user ADD COLUMN IF NOT EXISTS access_end_source VARCHAR(20)""")
    op.execute("""ALTER TABLE vendor_user ADD COLUMN IF NOT EXISTS access_sync_note TEXT""")


def downgrade() -> None:
    op.execute("""ALTER TABLE vendor_user DROP COLUMN IF EXISTS access_sync_note""")
    op.execute("""ALTER TABLE vendor_user DROP COLUMN IF EXISTS access_end_source""")
    op.execute("""ALTER TABLE vendor_user DROP COLUMN IF EXISTS access_ends_at""")
    op.execute("""ALTER TABLE vendor_user DROP COLUMN IF EXISTS access_starts_at""")
