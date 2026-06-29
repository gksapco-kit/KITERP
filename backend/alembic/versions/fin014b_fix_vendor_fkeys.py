"""fin014b – Fix wrong vendor_id foreign keys in fin014 tables

fin014 accidentally referenced store.id instead of vendor.id for the
vendor_id columns of fin_profit_center and fin_segment.
"""

from alembic import op

revision = "fin014b_fix_vendor_fkeys"
down_revision = "fin014_profit_centers_segments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, constraint in [
        ("fin_profit_center", "fin_profit_center_vendor_id_fkey"),
        ("fin_segment", "fin_segment_vendor_id_fkey"),
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
        ("fin_segment", "fin_segment_vendor_id_fkey"),
        ("fin_profit_center", "fin_profit_center_vendor_id_fkey"),
    ]:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table, "store",
            ["vendor_id"], ["id"],
            ondelete="CASCADE",
        )
