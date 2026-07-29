"""Pharma batch number models — user-defined numbering patterns.

Revision ID: pharma005_batch_number_models
Revises: pharma004_complaints_and_oos
Create Date: 2026-07-28

New in this migration:
  - pharma_batch_number_model  (user-defined numbering patterns per purpose)
  - pharma_batch_sequence.period_key  (supports yearly/monthly/daily resets)
  - pharma_batch_sequence unique index updated to include period_key
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "pharma005_batch_number_models"
down_revision = "pharma004_complaints_and_oos"
branch_labels = None
depends_on = None

_NULL_UUID = "00000000-0000-0000-0000-000000000000"


def upgrade() -> None:
    # ── 1. pharma_batch_number_model ──────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS pharma_batch_number_model (
            id UUID PRIMARY KEY,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            code VARCHAR(40) NOT NULL,
            label VARCHAR(120) NOT NULL,
            pattern VARCHAR(120) NOT NULL,
            prefix VARCHAR(40) NOT NULL DEFAULT 'B',
            pad_width INTEGER NOT NULL DEFAULT 5,
            reset_period VARCHAR(10) NOT NULL DEFAULT 'never',
            scope VARCHAR(10) NOT NULL DEFAULT 'vendor',
            applies_to TEXT NOT NULL DEFAULT 'manual',
            is_default BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pharma_bnm_code UNIQUE (vendor_id, code)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_bnm_vendor ON pharma_batch_number_model (vendor_id)"
    )

    # ── 2. Add period_key to pharma_batch_sequence ────────────────────────────
    op.execute(
        "ALTER TABLE pharma_batch_sequence "
        "ADD COLUMN IF NOT EXISTS period_key VARCHAR(10) NOT NULL DEFAULT ''"
    )

    # ── 3. Recreate unique index to include period_key ────────────────────────
    # Existing DB uses a UNIQUE INDEX (with COALESCE for nullable FKs), not a
    # table CONSTRAINT — DROP CONSTRAINT fails with UndefinedObjectError.
    op.execute("DROP INDEX IF EXISTS uq_pharma_batch_seq_scope")
    op.execute(f"""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_pharma_batch_seq_scope
        ON pharma_batch_sequence (
            vendor_id,
            COALESCE(plant_id, '{_NULL_UUID}'::uuid),
            COALESCE(product_id, '{_NULL_UUID}'::uuid),
            prefix,
            period_key
        )
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_pharma_batch_seq_scope")
    op.execute(f"""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_pharma_batch_seq_scope
        ON pharma_batch_sequence (
            vendor_id,
            COALESCE(plant_id, '{_NULL_UUID}'::uuid),
            COALESCE(product_id, '{_NULL_UUID}'::uuid),
            prefix
        )
    """)
    op.execute("ALTER TABLE pharma_batch_sequence DROP COLUMN IF EXISTS period_key")
    op.execute("DROP INDEX IF EXISTS ix_pharma_bnm_vendor")
    op.execute("DROP TABLE IF EXISTS pharma_batch_number_model")
