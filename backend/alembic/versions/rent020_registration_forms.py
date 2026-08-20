"""Rental registration forms (Google Forms-style intake).

Revision ID: rent020_registration_forms
Revises: rent019_period_rates
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "rent020_registration_forms"
down_revision = "rent019_period_rates"
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    insp = sa.inspect(conn)
    return table in insp.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "rental_registration_form"):
        op.create_table(
            "rental_registration_form",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("description", sa.Text()),
            sa.Column("template_key", sa.String(40), server_default="blank"),
            sa.Column("status", sa.String(20), server_default="draft"),
            sa.Column("version", sa.Integer(), server_default="1"),
            sa.Column("fields", JSONB, server_default=sa.text("'[]'::jsonb")),
            sa.Column("theme", JSONB, server_default=sa.text("'{}'::jsonb")),
            sa.Column("use_on_storefront", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("use_on_staff_booking", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_rental_registration_form_vendor", "rental_registration_form", ["vendor_id"])

    if not _table_exists(conn, "rental_registration_submission"):
        op.create_table(
            "rental_registration_submission",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
            sa.Column("form_id", UUID(as_uuid=True), sa.ForeignKey("rental_registration_form.id", ondelete="CASCADE"), nullable=False),
            sa.Column("form_version", sa.Integer(), server_default="1"),
            sa.Column("booking_id", UUID(as_uuid=True), sa.ForeignKey("rental_booking.id", ondelete="SET NULL"), nullable=True),
            sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customer.id", ondelete="SET NULL"), nullable=True),
            sa.Column("customer_name", sa.String(255)),
            sa.Column("channel", sa.String(20), server_default="storefront"),
            sa.Column("answers", JSONB, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_rental_registration_submission_vendor", "rental_registration_submission", ["vendor_id"])
        op.create_index("ix_rental_registration_submission_form", "rental_registration_submission", ["form_id"])
        op.create_index("ix_rental_registration_submission_booking", "rental_registration_submission", ["booking_id"])


def downgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "rental_registration_submission"):
        op.drop_table("rental_registration_submission")
    if _table_exists(conn, "rental_registration_form"):
        op.drop_table("rental_registration_form")
