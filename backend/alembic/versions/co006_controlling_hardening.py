"""co006 - controlling hardening: gapless numbering, settlement integrity, variance-run coverage

Adds
  * co_number_sequence           gapless per-vendor counters (MO numbers, goods-movement documents)
  * co_variance_run_order        orders covered by a variance run
  * co_manufacturing_order.qty_cogs_posted
  * co_cost_booking.status
  * co_gl_mapping.absorption_account_id / post_wip_to_gl
  * integrity constraints (non-negative quantities, 1-12 months, unique goods-movement document no.)
  * supporting indexes for the list / report endpoints

Revision ID: co006
Revises: co005
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "co006"
down_revision = "co005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "co_number_sequence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seq_key", sa.String(40), nullable=False),
        sa.Column("last_value", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("vendor_id", "seq_key", name="uq_co_number_sequence_vendor_key"),
    )
    op.create_index("ix_co_number_sequence_vendor_id", "co_number_sequence", ["vendor_id"])

    # Seed the goods-movement counter from the highest existing GMnnnnnn document number so that
    # new documents never collide with legacy ones.
    op.execute(
        """
        INSERT INTO co_number_sequence (id, vendor_id, seq_key, last_value)
        SELECT gen_random_uuid(), vendor_id, 'goods_movement',
               MAX(CAST(SUBSTRING(document_no FROM 3) AS INTEGER))
        FROM co_goods_movement
        WHERE document_no ~ '^GM[0-9]+$'
        GROUP BY vendor_id
        """
    )

    op.create_table(
        "co_variance_run_order",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("co_variance_run.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("co_manufacturing_order.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("planned", sa.Numeric(18, 4), server_default="0"),
        sa.Column("actual", sa.Numeric(18, 4), server_default="0"),
        sa.Column("variance", sa.Numeric(18, 4), server_default="0"),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.UniqueConstraint("run_id", "order_id", name="uq_co_vro_run_order"),
    )
    op.create_index("ix_co_variance_run_order_run_id", "co_variance_run_order", ["run_id"])
    op.create_index("ix_co_variance_run_order_order_id", "co_variance_run_order", ["order_id"])
    op.create_index("ix_co_variance_run_order_vendor_id", "co_variance_run_order", ["vendor_id"])
    op.create_index("ix_co_vro_order_active", "co_variance_run_order", ["order_id", "active"])

    op.add_column(
        "co_manufacturing_order",
        sa.Column("qty_cogs_posted", sa.Numeric(18, 4), nullable=False, server_default="0"),
    )
    # Orders whose COGS was already posted under the old all-or-nothing rule.
    op.execute(
        """
        UPDATE co_manufacturing_order
           SET qty_cogs_posted = COALESCE(qty_delivered, 0)
         WHERE cogs_issue_journal_id IS NOT NULL
        """
    )

    op.add_column("co_cost_booking", sa.Column("status", sa.String(20), nullable=False, server_default="posted"))
    op.add_column(
        "co_gl_mapping",
        sa.Column("absorption_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("fin_account.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("co_gl_mapping", sa.Column("post_wip_to_gl", sa.Boolean, nullable=False, server_default="false"))

    # -- Integrity constraints (NOT VALID: enforced for new rows without failing on legacy data) --
    op.execute("ALTER TABLE co_manufacturing_order ADD CONSTRAINT ck_co_mo_qty_nonneg CHECK (qty_planned >= 0 AND qty_delivered >= 0) NOT VALID")
    op.execute("ALTER TABLE co_goods_movement ADD CONSTRAINT ck_co_gm_qty_nonneg CHECK (qty >= 0) NOT VALID")
    op.execute("ALTER TABLE co_activity_confirmation ADD CONSTRAINT ck_co_ac_hours_nonneg CHECK (hours_confirmed >= 0 AND rate_per_hour >= 0) NOT VALID")
    op.execute("ALTER TABLE co_cost_allocation ADD CONSTRAINT ck_co_ca_month CHECK (period_month BETWEEN 1 AND 12) NOT VALID")
    op.execute("ALTER TABLE co_variance_run ADD CONSTRAINT ck_co_vr_month CHECK (period_month BETWEEN 1 AND 12) NOT VALID")
    op.create_index(
        "uq_co_gm_vendor_document_no",
        "co_goods_movement",
        ["vendor_id", "document_no"],
        unique=True,
        postgresql_where=sa.text("document_no IS NOT NULL"),
    )

    # -- Supporting indexes ---------------------------------------------------
    # co_goods_movement.movement_type: descriptive codes (previously applied by startup SQL)
    op.execute("ALTER TABLE co_goods_movement ALTER COLUMN movement_type TYPE VARCHAR(30)")
    for old, new in (("261", "component_issue"), ("262", "component_return"),
                     ("101", "fg_receipt"), ("102", "fg_receipt_reversal")):
        op.execute(f"UPDATE co_goods_movement SET movement_type = '{new}' WHERE movement_type = '{old}'")

    # co_order_operation.work_center_id pointed at fin_cost_center; it is a work centre
    op.execute(
        """
        DO $$
        DECLARE c text;
        BEGIN
            FOR c IN
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'co_order_operation'::regclass AND contype = 'f'
                  AND confrelid = 'fin_cost_center'::regclass
            LOOP
                EXECUTE format('ALTER TABLE co_order_operation DROP CONSTRAINT %I', c);
            END LOOP;
        END $$;
        """
    )
    op.execute(
        "UPDATE co_order_operation SET work_center_id = NULL "
        "WHERE work_center_id IS NOT NULL AND work_center_id NOT IN (SELECT id FROM co_work_center)"
    )
    op.create_foreign_key(
        "fk_co_order_operation_work_center", "co_order_operation", "co_work_center",
        ["work_center_id"], ["id"], ondelete="SET NULL",
    )

    op.create_index("ix_co_mo_vendor_company_created", "co_manufacturing_order", ["vendor_id", "company_id", "created_at"])
    op.create_index("ix_co_cb_vendor_company", "co_cost_booking", ["vendor_id", "company_id", "entry_date"])
    op.create_index("ix_co_ocl_order_category", "co_order_cost_line", ["order_id", "category"])


def downgrade():
    op.drop_constraint("fk_co_order_operation_work_center", "co_order_operation", type_="foreignkey")
    op.execute("UPDATE co_order_operation SET work_center_id = NULL")
    op.create_foreign_key(
        "co_order_operation_work_center_id_fkey", "co_order_operation", "fin_cost_center",
        ["work_center_id"], ["id"], ondelete="SET NULL",
    )
    op.drop_index("ix_co_ocl_order_category", table_name="co_order_cost_line")
    op.drop_index("ix_co_cb_vendor_company", table_name="co_cost_booking")
    op.drop_index("ix_co_mo_vendor_company_created", table_name="co_manufacturing_order")
    op.drop_index("uq_co_gm_vendor_document_no", table_name="co_goods_movement")
    op.drop_constraint("ck_co_vr_month", "co_variance_run", type_="check")
    op.drop_constraint("ck_co_ca_month", "co_cost_allocation", type_="check")
    op.drop_constraint("ck_co_ac_hours_nonneg", "co_activity_confirmation", type_="check")
    op.drop_constraint("ck_co_gm_qty_nonneg", "co_goods_movement", type_="check")
    op.drop_constraint("ck_co_mo_qty_nonneg", "co_manufacturing_order", type_="check")
    op.drop_column("co_gl_mapping", "post_wip_to_gl")
    op.drop_column("co_gl_mapping", "absorption_account_id")
    op.drop_column("co_cost_booking", "status")
    op.drop_column("co_manufacturing_order", "qty_cogs_posted")
    op.drop_table("co_variance_run_order")
    op.drop_table("co_number_sequence")
