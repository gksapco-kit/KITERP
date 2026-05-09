"""merge_product_service_fields_with_pos_fixes

Revision ID: 754f17487775
Revises: 85981fc527cf, b2c3d4e5f6a7
Create Date: 2026-03-12 00:58:46.589353

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '754f17487775'
down_revision: Union[str, None] = ('85981fc527cf', 'b2c3d4e5f6a7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
