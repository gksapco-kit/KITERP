"""offer template layout + offer template linkage

Revision ID: hr007_offer_template_layout
Revises: po001_production_orders
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "hr007_offer_template_layout"
down_revision: Union[str, None] = "po001_production_orders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hr_offer_letter_template",
        sa.Column("layout", sa.String(30), nullable=False, server_default="standard"),
    )
    op.add_column(
        "hr_offer_letter",
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "hr_offer_letter",
        sa.Column("layout", sa.String(30), nullable=True),
    )
    op.create_foreign_key(
        "fk_offer_letter_template_id",
        "hr_offer_letter",
        "hr_offer_letter_template",
        ["template_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_offer_letter_template_id", "hr_offer_letter", type_="foreignkey")
    op.drop_column("hr_offer_letter", "layout")
    op.drop_column("hr_offer_letter", "template_id")
    op.drop_column("hr_offer_letter_template", "layout")
