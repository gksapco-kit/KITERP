"""Add platform_staff_role to user (merge heads).

Revision ID: ps001_plat_staff
Revises: 639f0d132b44, blog001, cat002, co005, comm005_finance_fiscal_catchup
Create Date: 2026-05-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ps001_plat_staff"
down_revision: Union[str, Sequence[str], None] = (
    "639f0d132b44",
    "blog001",
    "cat002",
    "co005",
    "comm005_finance_fiscal_catchup",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("platform_staff_role", sa.String(length=20), nullable=True),
    )
    op.create_index(
        "ix_user_platform_staff_role",
        "user",
        ["platform_staff_role"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_user_platform_staff_role", table_name="user")
    op.drop_column("user", "platform_staff_role")
