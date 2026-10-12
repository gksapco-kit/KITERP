"""Drop the unused invoice_template table (only when it is empty).

Invoice, quotation and POS document settings live in ``vendor.settings`` JSON
(``invoice_settings`` / ``quotation_settings`` / ``pos_receipt_settings``). The
``invoice_template`` table was created by h9b0c1d2e3f4 but nothing in the app reads or
writes it any more (its API was removed).

Safety: the table is dropped only if it exists AND has no rows. If it holds data, the
migration logs a warning and leaves it in place, so a deploy never destroys data and never
fails because of this table. Inspect and export such rows by hand, then drop it manually.

Revision ID: inv001_drop_unused_invoice_template
Revises: usr001_user_last_login_at
Create Date: 2026-10-12

"""
import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "inv001_drop_unused_invoice_template"
down_revision = "usr001_user_last_login_at"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("invoice_template"):
        return
    rows = bind.execute(sa.text("SELECT count(*) FROM invoice_template")).scalar() or 0
    if rows:
        log.warning(
            "invoice_template has %s row(s); leaving the table in place. "
            "Review/export the data, then run: DROP TABLE invoice_template;",
            rows,
        )
        return
    op.drop_table("invoice_template")


def downgrade() -> None:
    # Recreate the empty table exactly as h9b0c1d2e3f4 defined it (idempotent).
    if sa.inspect(op.get_bind()).has_table("invoice_template"):
        return
    op.create_table(
        "invoice_template",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("sections", JSONB, nullable=True),
        sa.Column("bank_details", JSONB, nullable=True),
        sa.Column("signature_url", sa.Text(), nullable=True),
        sa.Column("header_text", sa.Text(), nullable=True),
        sa.Column("footer_text", sa.Text(), nullable=True),
        sa.Column("terms_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
