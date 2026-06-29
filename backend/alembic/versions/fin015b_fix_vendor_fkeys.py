"""fin015b – Fix wrong vendor_id foreign keys in fin015 tables

fin015 accidentally referenced store.id instead of vendor.id for the
vendor_id columns of fin_fx_reval_run and fin_balance_carryforward.
"""

from alembic import op

revision = "fin015b_fix_vendor_fkeys"
down_revision = "fin015_fx_reval_carry_forward"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, constraint in [
        ("fin_fx_reval_run", "fin_fx_reval_run_vendor_id_fkey"),
        ("fin_balance_carryforward", "fin_balance_carryforward_vendor_id_fkey"),
    ]:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table, "vendor",
            ["vendor_id"], ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    for table, constraint in [
        ("fin_balance_carryforward", "fin_balance_carryforward_vendor_id_fkey"),
        ("fin_fx_reval_run", "fin_fx_reval_run_vendor_id_fkey"),
    ]:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table, "store",
            ["vendor_id"], ["id"],
            ondelete="CASCADE",
        )
