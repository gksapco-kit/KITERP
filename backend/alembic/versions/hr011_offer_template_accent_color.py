"""offer template accent color

Revision ID: hr011_offer_template_accent_color
Revises: hr010_offer_template_logo_shape
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "hr011_offer_template_accent_color"
down_revision: Union[str, None] = "hr010_offer_template_logo_shape"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hr_offer_letter_template",
        sa.Column("accent_color", sa.String(20), nullable=False, server_default="#1a56db"),
    )


def downgrade() -> None:
    op.drop_column("hr_offer_letter_template", "accent_color")
