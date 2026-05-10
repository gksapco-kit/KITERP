"""Platform support staff audit log.

Revision ID: ps003_audit
Revises: rm001_vendor_rm
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = "ps003_audit"
down_revision: Union[str, None] = "rm001_vendor_rm"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "platform_staff_audit_log",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "subject_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("detail", JSONB, nullable=True),
        sa.Column("ip", sa.String(50), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("request_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_platform_staff_audit_log_subject_user_id",
        "platform_staff_audit_log",
        ["subject_user_id"],
    )
    op.create_index(
        "ix_platform_staff_audit_log_actor_user_id",
        "platform_staff_audit_log",
        ["actor_user_id"],
    )
    op.create_index(
        "ix_platform_staff_audit_subject_created",
        "platform_staff_audit_log",
        ["subject_user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_platform_staff_audit_subject_created", table_name="platform_staff_audit_log")
    op.drop_index("ix_platform_staff_audit_log_actor_user_id", table_name="platform_staff_audit_log")
    op.drop_index("ix_platform_staff_audit_log_subject_user_id", table_name="platform_staff_audit_log")
    op.drop_table("platform_staff_audit_log")
