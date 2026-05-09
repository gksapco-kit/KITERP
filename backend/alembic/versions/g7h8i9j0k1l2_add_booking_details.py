"""add booking details: staff, history, followups, attachments

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "g7h8i9j0k1l2"
down_revision = "f6g7h8i9j0k1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking", sa.Column("assigned_staff_id", UUID(as_uuid=True), nullable=True))
    op.add_column("booking", sa.Column("assigned_staff_name", sa.String(255), nullable=True))
    op.add_column("booking", sa.Column("completed_by_id", UUID(as_uuid=True), nullable=True))
    op.add_column("booking", sa.Column("completed_by_name", sa.String(255), nullable=True))
    op.add_column("booking", sa.Column("delivery_notes", sa.Text(), nullable=True))
    op.add_column("booking", sa.Column("internal_notes", sa.Text(), nullable=True))
    op.add_column("booking", sa.Column("status_history", JSONB, server_default="[]"))
    op.add_column("booking", sa.Column("followups", JSONB, server_default="[]"))
    op.add_column("booking", sa.Column("attachments", JSONB, server_default="[]"))


def downgrade() -> None:
    for col in ["attachments", "followups", "status_history", "internal_notes",
                "delivery_notes", "completed_by_name", "completed_by_id",
                "assigned_staff_name", "assigned_staff_id"]:
        op.drop_column("booking", col)
