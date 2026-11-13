"""fin026 – FI Document Types master

Creates fin_document_type (SAP OBA7 equivalent) so tenants can maintain
document type codes (SA, DR, KR, …) used by journals and number ranges.

Revision ID: fin026_document_types
Revises: fin025_company_backfill
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin026_document_types"
down_revision = "fin025_company_backfill"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fin_document_type",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(4), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("number_range_prefix", sa.String(10), nullable=True),
        sa.Column("reversal_doc_type", sa.String(4), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("sort_order", sa.Integer, server_default="10", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "code", name="uq_fin_doc_type_vendor_code"),
    )
    op.create_index("ix_fin_document_type_vendor_id", "fin_document_type", ["vendor_id"])


def downgrade() -> None:
    op.drop_index("ix_fin_document_type_vendor_id", table_name="fin_document_type")
    op.drop_table("fin_document_type")
