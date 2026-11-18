"""Add video_url to hr_training_program for program intro/overview video.

Revision ID: hr012_training_program_video_url
Revises: hr011_offer_template_accent_color
Create Date: 2026-11-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "hr012_training_program_video_url"
down_revision: Union[str, None] = "hr011_offer_template_accent_color"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "hr_training_program", "video_url"):
        op.add_column(
            "hr_training_program",
            sa.Column("video_url", sa.String(500), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "hr_training_program", "video_url"):
        op.drop_column("hr_training_program", "video_url")
