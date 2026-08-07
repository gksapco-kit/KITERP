"""pm002 – link pm_project to fin_project and co_manufacturing_order for planning/actuals/settlement.

Revision ID: pm002_project_costing_bridge
Revises: pm001_add_project_tables
Create Date: 2026-08-07
"""
from alembic import op
import sqlalchemy as sa


revision = "pm002_project_costing_bridge"
down_revision = "pm001_add_project_tables"
branch_labels = None
depends_on = None


def upgrade():
    # company that "owns" this project in the GL / CO world
    op.execute(sa.text(
        "ALTER TABLE pm_project ADD COLUMN IF NOT EXISTS company_id UUID"
    ))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_pm_project_company'
            ) THEN
                ALTER TABLE pm_project
                ADD CONSTRAINT fk_pm_project_company
                FOREIGN KEY (company_id) REFERENCES fin_company(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_pm_project_company ON pm_project (vendor_id, company_id)"
    ))

    # mirror record in fin_project (WBS dimension for GL journal lines)
    op.execute(sa.text(
        "ALTER TABLE pm_project ADD COLUMN IF NOT EXISTS fin_project_id UUID"
    ))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_pm_project_fin_project'
            ) THEN
                ALTER TABLE pm_project
                ADD CONSTRAINT fk_pm_project_fin_project
                FOREIGN KEY (fin_project_id) REFERENCES fin_project(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))

    # the CO project order that carries plan, actual, and settlement
    op.execute(sa.text(
        "ALTER TABLE pm_project ADD COLUMN IF NOT EXISTS co_order_id UUID"
    ))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_pm_project_co_order'
            ) THEN
                ALTER TABLE pm_project
                ADD CONSTRAINT fk_pm_project_co_order
                FOREIGN KEY (co_order_id) REFERENCES co_manufacturing_order(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))


def downgrade():
    op.execute(sa.text("DROP INDEX IF EXISTS ix_pm_project_company"))
    op.execute(sa.text("ALTER TABLE pm_project DROP CONSTRAINT IF EXISTS fk_pm_project_co_order"))
    op.execute(sa.text("ALTER TABLE pm_project DROP CONSTRAINT IF EXISTS fk_pm_project_fin_project"))
    op.execute(sa.text("ALTER TABLE pm_project DROP CONSTRAINT IF EXISTS fk_pm_project_company"))
    op.execute(sa.text("ALTER TABLE pm_project DROP COLUMN IF EXISTS co_order_id"))
    op.execute(sa.text("ALTER TABLE pm_project DROP COLUMN IF EXISTS fin_project_id"))
    op.execute(sa.text("ALTER TABLE pm_project DROP COLUMN IF EXISTS company_id"))
