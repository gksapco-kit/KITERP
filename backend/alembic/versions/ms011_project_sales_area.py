"""pm_project: sales_area_id link column

Revision ID: ms011_project_sales_area
Revises: ms010_controlling_area
Create Date: 2026-07-05

Adds nullable sales_area_id to pm_project so projects can be scoped to a
sales area (BU/Branch × Distribution Channel × Division), consistent with
orders, invoices, and bookings.
"""
from alembic import op
import sqlalchemy as sa

revision = 'ms011_project_sales_area'
down_revision = 'ms010_controlling_area'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("ALTER TABLE pm_project ADD COLUMN IF NOT EXISTS sales_area_id UUID"))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_pm_project_sales_area'
            ) THEN
                ALTER TABLE pm_project
                ADD CONSTRAINT fk_pm_project_sales_area
                FOREIGN KEY (sales_area_id) REFERENCES sales_area(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_pm_project_sales_area ON pm_project (vendor_id, sales_area_id)"
    ))


def downgrade():
    op.execute(sa.text("DROP INDEX IF EXISTS ix_pm_project_sales_area"))
    op.execute(sa.text("ALTER TABLE pm_project DROP CONSTRAINT IF EXISTS fk_pm_project_sales_area"))
    op.execute(sa.text("ALTER TABLE pm_project DROP COLUMN IF EXISTS sales_area_id"))
