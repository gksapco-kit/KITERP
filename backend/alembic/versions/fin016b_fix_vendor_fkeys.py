"""fin016b – Fix wrong vendor_id foreign keys in fin016 tables

fin016 accidentally referenced store.id instead of vendor.id for the
vendor_id columns of fin_validation_rule, fin_substitution_rule, and
fin_number_range.
"""

from alembic import op

revision = "fin016b_fix_vendor_fkeys"
down_revision = "fin016_validations_subs_numranges"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, constraint in [
        ("fin_validation_rule",   "fin_validation_rule_vendor_id_fkey"),
        ("fin_substitution_rule", "fin_substitution_rule_vendor_id_fkey"),
        ("fin_number_range",      "fin_number_range_vendor_id_fkey"),
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
        ("fin_number_range",      "fin_number_range_vendor_id_fkey"),
        ("fin_substitution_rule", "fin_substitution_rule_vendor_id_fkey"),
        ("fin_validation_rule",   "fin_validation_rule_vendor_id_fkey"),
    ]:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table, "store",
            ["vendor_id"], ["id"],
            ondelete="CASCADE",
        )
