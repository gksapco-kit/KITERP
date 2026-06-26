"""offer template watermark settings

Revision ID: hr008_offer_watermark
Revises: hr007_offer_template_layout
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "hr008_offer_watermark"
down_revision: Union[str, None] = "hr007_offer_template_layout"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hr_offer_letter_template",
        sa.Column("watermark_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "hr_offer_letter_template",
        sa.Column("watermark_text", sa.String(120), nullable=True),
    )
    op.add_column(
        "hr_offer_letter_template",
        sa.Column("watermark_opacity", sa.String(10), nullable=False, server_default="0.12"),
    )
    op.add_column(
        "hr_offer_letter_template",
        sa.Column("watermark_style", sa.String(30), nullable=False, server_default="diagonal_text"),
    )


def downgrade() -> None:
    op.drop_column("hr_offer_letter_template", "watermark_style")
    op.drop_column("hr_offer_letter_template", "watermark_opacity")
    op.drop_column("hr_offer_letter_template", "watermark_text")
    op.drop_column("hr_offer_letter_template", "watermark_enabled")
