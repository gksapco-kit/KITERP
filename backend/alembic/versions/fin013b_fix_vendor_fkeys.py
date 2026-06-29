"""fin013b – Fix wrong vendor_id foreign keys in fin013 tables

fin013 accidentally referenced store.id instead of vendor.id for the
vendor_id columns of fin_posting_key, fin_field_status_group, and
fin_tolerance_group.
"""

from alembic import op

revision = "fin013b_fix_vendor_fkeys"
down_revision = "fin013_posting_keys_fsgs_tolerances"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, constraint in [
        ("fin_posting_key", "fin_posting_key_vendor_id_fkey"),
        ("fin_field_status_group", "fin_field_status_group_vendor_id_fkey"),
        ("fin_tolerance_group", "fin_tolerance_group_vendor_id_fkey"),
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
        ("fin_tolerance_group", "fin_tolerance_group_vendor_id_fkey"),
        ("fin_field_status_group", "fin_field_status_group_vendor_id_fkey"),
        ("fin_posting_key", "fin_posting_key_vendor_id_fkey"),
    ]:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table, "store",
            ["vendor_id"], ["id"],
            ondelete="CASCADE",
        )
