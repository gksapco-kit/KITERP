"""fin017b – Fix wrong foreign keys in fin_split_rule and fin_journal_split_item

fin017 accidentally referenced store.id instead of vendor.id for split rule
vendor_id, and store.id instead of fin_cost_center.id for split item cost_center_id.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin017b_fix_split_rule_fkeys"
down_revision = "fin017_document_splitting"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Fix fin_split_rule.vendor_id → vendor.id ─────────────────────────────
    op.drop_constraint("fin_split_rule_vendor_id_fkey", "fin_split_rule", type_="foreignkey")
    op.create_foreign_key(
        "fin_split_rule_vendor_id_fkey",
        "fin_split_rule", "vendor",
        ["vendor_id"], ["id"],
        ondelete="CASCADE",
    )

    # ── Fix fin_journal_split_item.cost_center_id → fin_cost_center.id ───────
    op.drop_constraint("fin_journal_split_item_cost_center_id_fkey", "fin_journal_split_item", type_="foreignkey")
    op.create_foreign_key(
        "fin_journal_split_item_cost_center_id_fkey",
        "fin_journal_split_item", "fin_cost_center",
        ["cost_center_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Restore the (wrong) original references
    op.drop_constraint("fin_journal_split_item_cost_center_id_fkey", "fin_journal_split_item", type_="foreignkey")
    op.create_foreign_key(
        "fin_journal_split_item_cost_center_id_fkey",
        "fin_journal_split_item", "store",
        ["cost_center_id"], ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint("fin_split_rule_vendor_id_fkey", "fin_split_rule", type_="foreignkey")
    op.create_foreign_key(
        "fin_split_rule_vendor_id_fkey",
        "fin_split_rule", "store",
        ["vendor_id"], ["id"],
        ondelete="CASCADE",
    )
