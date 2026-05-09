"""web006 — builder browser preview snapshots (token + JSON payload)

Revision ID: web006
Revises: web005
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "web006"
down_revision = "web005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wb_builder_previews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("wb_sites.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("preview_token", sa.String(64), nullable=False),
        sa.Column("label", sa.String(200), nullable=True),
        sa.Column("payload", sa.JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_wb_builder_previews_token", "wb_builder_previews", ["preview_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_wb_builder_previews_token", table_name="wb_builder_previews")
    op.drop_table("wb_builder_previews")
