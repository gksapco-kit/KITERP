"""Create procurement_approver_rule matrix table and add source_rule_id to approval steps.

Revision ID: proc017_approver_matrix
Revises: proc016_material_type_on_lines
Create Date: 2026-09-03

procurement_approver_rule stores vendor-scoped rules that map a combination of
document type, org dimensions (company / branch / plant / material type), and
amount band to an ordered chain of approvers (by level).

NULL on any dimension column means "any value" (wildcard).
Exactly one of approver_id or approver_role_id must be non-null per row
(enforced via CHECK constraint).

source_rule_id is added to the three approval-step tables so an audit can show
why a specific person was auto-assigned, and so later matrix edits do not
retroactively change historical documents.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'proc017_approver_matrix'
down_revision = 'proc016_material_type_on_lines'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'procurement_approver_rule',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'),
                  nullable=False),
        # PR | PO | INVOICE
        sa.Column('doc_type', sa.String(10), nullable=False),

        # Dimension filters — NULL means "any"
        sa.Column('company_id',    UUID(as_uuid=True),
                  sa.ForeignKey('fin_company.id', ondelete='CASCADE'), nullable=True),
        sa.Column('branch_id',     UUID(as_uuid=True),
                  sa.ForeignKey('store.id', ondelete='CASCADE'),      nullable=True),
        sa.Column('plant_id',      UUID(as_uuid=True),
                  sa.ForeignKey('plant.id', ondelete='CASCADE'),      nullable=True),
        sa.Column('material_type', sa.String(30), nullable=True),

        # Amount band (inclusive min, exclusive max; NULL = unbounded)
        sa.Column('min_amount', sa.Numeric(14, 2), nullable=True),
        sa.Column('max_amount', sa.Numeric(14, 2), nullable=True),

        # Approval chain: level orders steps within the same rule group.
        # A "rule group" = all rows sharing the same (vendor_id, doc_type,
        # company_id, branch_id, plant_id, material_type, min_amount, max_amount).
        sa.Column('level', sa.Integer, nullable=False, server_default='1'),

        # Exactly one of approver_id / approver_role_id must be set
        sa.Column('approver_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='CASCADE'), nullable=True),
        sa.Column('approver_role_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_role.id', ondelete='CASCADE'), nullable=True),

        # lock_chain=True: matrix approvers are fully locked; no manual additions allowed.
        # lock_chain=False (default): users may add extra approvers above the resolved chain.
        sa.Column('lock_chain', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_active',  sa.Boolean, nullable=False, server_default='true'),

        sa.Column('created_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()')),

        sa.CheckConstraint(
            '(approver_id IS NOT NULL)::int + (approver_role_id IS NOT NULL)::int = 1',
            name='ck_approver_rule_one_target',
        ),
    )

    op.create_index('ix_apr_vendor_doctype',
                    'procurement_approver_rule', ['vendor_id', 'doc_type'])
    op.create_index('ix_apr_company',
                    'procurement_approver_rule', ['vendor_id', 'company_id'])
    op.create_index('ix_apr_branch',
                    'procurement_approver_rule', ['vendor_id', 'branch_id'])
    op.create_index('ix_apr_plant',
                    'procurement_approver_rule', ['vendor_id', 'plant_id'])
    op.create_index('ix_apr_approver',
                    'procurement_approver_rule', ['approver_id'])
    op.create_index('ix_apr_role',
                    'procurement_approver_rule', ['approver_role_id'])

    # ── source_rule_id on approval-step tables ───────────────────────
    # Records which matrix rule row auto-generated this step.  NULL means
    # the step was assigned manually (legacy or override).
    for table in (
        'purchase_order_approval',
        'purchase_requisition_approval',
        'vendor_invoice_approval',
    ):
        op.add_column(table, sa.Column(
            'source_rule_id', UUID(as_uuid=True),
            sa.ForeignKey('procurement_approver_rule.id', ondelete='SET NULL'),
            nullable=True,
        ))


def downgrade():
    for table in (
        'vendor_invoice_approval',
        'purchase_requisition_approval',
        'purchase_order_approval',
    ):
        op.drop_column(table, 'source_rule_id')

    op.drop_index('ix_apr_role',         table_name='procurement_approver_rule')
    op.drop_index('ix_apr_approver',     table_name='procurement_approver_rule')
    op.drop_index('ix_apr_plant',        table_name='procurement_approver_rule')
    op.drop_index('ix_apr_branch',       table_name='procurement_approver_rule')
    op.drop_index('ix_apr_company',      table_name='procurement_approver_rule')
    op.drop_index('ix_apr_vendor_doctype', table_name='procurement_approver_rule')
    op.drop_table('procurement_approver_rule')
