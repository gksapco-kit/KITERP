"""blog001 — vendor blog posts table

Revision ID: blog001
Revises: web006
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "blog001"
down_revision = "web006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # Table may already exist if SQLAlchemy auto-created it on app startup
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name='vendor_blog_posts'"
    ))
    if result.fetchone():
        # Ensure unique index exists even if table was auto-created without it
        bind.execute(sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_blog_posts_vendor_slug "
            "ON vendor_blog_posts (vendor_id, slug)"
        ))
        return

    op.create_table(
        "vendor_blog_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("excerpt", sa.String(600), nullable=True),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("cover_url", sa.String(500), nullable=True),
        sa.Column("author_name", sa.String(150), nullable=True),
        sa.Column("author_avatar_url", sa.String(500), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("tags", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("reading_minutes", sa.Integer, nullable=True),
        sa.Column("is_published", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("published_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_vendor_blog_posts_vendor_id", "vendor_blog_posts", ["vendor_id"])
    op.create_index("ix_vendor_blog_posts_slug", "vendor_blog_posts", ["slug"])
    op.create_index(
        "uq_vendor_blog_posts_vendor_slug",
        "vendor_blog_posts",
        ["vendor_id", "slug"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_vendor_blog_posts_vendor_slug", table_name="vendor_blog_posts")
    op.drop_index("ix_vendor_blog_posts_slug", table_name="vendor_blog_posts")
    op.drop_index("ix_vendor_blog_posts_vendor_id", table_name="vendor_blog_posts")
    op.drop_table("vendor_blog_posts")
