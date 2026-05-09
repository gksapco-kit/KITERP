"""merge_attendance_email_heads

Revision ID: b1c2d3e4f5a7
Revises: a1b2c3d4e5a6, c4d8e1f29a01
Create Date: 2026-04-18 12:30:00.000000

"""
from typing import Sequence, Union

revision: str = 'b1c2d3e4f5a7'
down_revision: Union[str, tuple, None] = ('a1b2c3d4e5a6', 'c4d8e1f29a01')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
