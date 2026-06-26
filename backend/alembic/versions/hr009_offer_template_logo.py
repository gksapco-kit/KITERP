"""offer template logo fields

Revision ID: hr009_offer_template_logo
Revises: hr008_offer_watermark
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "hr009_offer_template_logo"
down_revision: Union[str, None] = "hr008_offer_watermark"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hr_offer_letter_template", sa.Column("logo_url", sa.String(500), nullable=True))
    op.add_column(
        "hr_offer_letter_template",
        sa.Column("show_logo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("hr_offer_letter_template", "show_logo")
    op.drop_column("hr_offer_letter_template", "logo_url")
