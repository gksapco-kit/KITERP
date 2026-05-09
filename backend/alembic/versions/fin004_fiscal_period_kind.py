"""Fiscal period kind (standard vs audit) for GL posting.

Revision ID: fin004_fiscal_period_kind
Revises: fin003_field_rules
"""
from alembic import op

revision = "fin004_fiscal_period_kind"
down_revision = "fin003_field_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE fin_period ADD COLUMN IF NOT EXISTS period_kind VARCHAR(20) NOT NULL DEFAULT 'standard'
    """)
    # Postgres doesn't support IF NOT EXISTS for ADD CONSTRAINT.
    # If the constraint already exists (e.g., migration ran previously), skip.
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'ck_fin_period_kind'
        ) THEN
            ALTER TABLE fin_period
            ADD CONSTRAINT ck_fin_period_kind
            CHECK (period_kind IN ('standard', 'audit'));
        END IF;
    END $$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE fin_period DROP CONSTRAINT IF EXISTS ck_fin_period_kind")
    op.execute("ALTER TABLE fin_period DROP COLUMN IF EXISTS period_kind")
