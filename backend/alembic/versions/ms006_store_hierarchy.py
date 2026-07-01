"""store hierarchy: parent_id + unit_type (Business Unit -> Branch)

Revision ID: ms006_store_hierarchy
Revises: ms005_bu_scope_more
Create Date: 2026-07-01

Adds a self-referential hierarchy to `store`: parent_id=NULL marks a row as a
Business Unit (root); parent_id set marks it as a Branch under that BU.
Existing rows are backfilled to unit_type='business_unit' / parent_id=NULL so
current behaviour (flat list of business units) is unchanged. Branches are
created going forward as ordinary store rows with parent_id set — every
existing store_id FK across the app keeps working unmodified.

Idempotent: safe to re-run; mirrors app.database.ensure_store_hierarchy_columns.
"""
from alembic import op
import sqlalchemy as sa

revision = 'ms006_store_hierarchy'
down_revision = 'ms005_bu_scope_more'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(sa.text("ALTER TABLE store ADD COLUMN IF NOT EXISTS parent_id UUID"))
    op.execute(
        sa.text(
            "ALTER TABLE store ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) "
            "NOT NULL DEFAULT 'business_unit'"
        )
    )

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_store_parent'
                ) THEN
                    ALTER TABLE store
                    ADD CONSTRAINT fk_store_parent
                    FOREIGN KEY (parent_id) REFERENCES store(id) ON DELETE RESTRICT;
                END IF;
            END $$;
            """
        )
    )

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS idx_store_parent ON store (vendor_id, parent_id)"
        )
    )

    # Backfill: rows without an explicit unit_type stay business units.
    op.execute(sa.text("UPDATE store SET unit_type = 'business_unit' WHERE unit_type IS NULL"))


def downgrade():
    op.drop_index('idx_store_parent', table_name='store')
    op.drop_constraint('fk_store_parent', 'store', type_='foreignkey')
    op.drop_column('store', 'unit_type')
    op.drop_column('store', 'parent_id')
