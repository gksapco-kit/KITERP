"""business-unit scope for booking, project (+items), coupon

Revision ID: ms005_bu_scope_more
Revises: ms004_pos_store_scope
Create Date: 2026-06-18

Adds store_id to booking, pm_project and coupon so these records can be
attributed to / scoped by a business unit, plus a JSONB items column on
pm_project to hold catalog products/services associated with a project.

Idempotent: safe when ensure_txn_store_id_columns or ms003 already added store_id.
"""
from alembic import op
import sqlalchemy as sa

revision = 'ms005_bu_scope_more'
down_revision = 'ms004_pos_store_scope'
branch_labels = None
depends_on = None


def _add_column_if_missing(table: str, column_sql: str) -> None:
    op.execute(
        sa.text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column_sql}")
    )


def _create_fk_if_missing(name: str, table: str, column: str) -> None:
    op.execute(
        sa.text(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = '{name}'
                ) THEN
                    ALTER TABLE {table}
                    ADD CONSTRAINT {name}
                    FOREIGN KEY ({column}) REFERENCES store(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """
        )
    )


def _create_index_if_missing(name: str, table: str, columns: str) -> None:
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({columns})"))


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    _add_column_if_missing("booking", "store_id UUID")
    _create_fk_if_missing("fk_booking_store", "booking", "store_id")
    _create_index_if_missing("ix_booking_store", "booking", "store_id")

    _add_column_if_missing("pm_project", "store_id UUID")
    _add_column_if_missing("pm_project", "items JSONB DEFAULT '[]'::jsonb")
    _create_fk_if_missing("fk_pm_project_store", "pm_project", "store_id")
    _create_index_if_missing("ix_pm_project_store", "pm_project", "store_id")

    _add_column_if_missing("coupon", "store_id UUID")
    _create_fk_if_missing("fk_coupon_store", "coupon", "store_id")
    _create_index_if_missing("ix_coupon_store", "coupon", "store_id")


def downgrade():
    op.drop_index('ix_coupon_store', table_name='coupon')
    op.drop_constraint('fk_coupon_store', 'coupon', type_='foreignkey')
    op.drop_column('coupon', 'store_id')

    op.drop_index('ix_pm_project_store', table_name='pm_project')
    op.drop_constraint('fk_pm_project_store', 'pm_project', type_='foreignkey')
    op.drop_column('pm_project', 'items')
    op.drop_column('pm_project', 'store_id')

    op.drop_index('ix_booking_store', table_name='booking')
    op.drop_constraint('fk_booking_store', 'booking', type_='foreignkey')
    op.drop_column('booking', 'store_id')
