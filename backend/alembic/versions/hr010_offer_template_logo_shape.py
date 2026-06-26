"""offer template logo shape

Revision ID: hr010_offer_template_logo_shape
Revises: hr009_offer_template_logo
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "hr010_offer_template_logo_shape"
down_revision: Union[str, None] = "hr009_offer_template_logo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hr_offer_letter_template",
        sa.Column("logo_shape", sa.String(20), nullable=False, server_default="rounded"),
    )


def downgrade() -> None:
    op.drop_column("hr_offer_letter_template", "logo_shape")
