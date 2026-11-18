"""asset management module: am_* tables

Revision ID: am001_asset_management
Revises: hr012_training_program_video_url
Create Date: 2026-11-18

Creates every ``am_*`` table that is missing and adds model columns that are missing from existing ones.
Idempotent and additive only - it mirrors ``app.database.ensure_asset_mgmt_schema`` (which also runs at
application start-up), so running either, in any order, any number of times, is safe.

Existing Finance fixed assets are NOT copied automatically; use "Import from Finance" in the module
(``POST /vendors/me/assets/finance/import``), which is idempotent and tenant-scoped.
"""
from alembic import op

revision = "am001_asset_management"
down_revision = "hr012_training_program_video_url"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    import app.models  # noqa: F401  (vendor / hr / finance tables referenced by foreign keys)
    import app.models.asset_mgmt  # noqa: F401
    from app.database import Base, realestate_add_missing_columns

    tables = [t for t in Base.metadata.sorted_tables if t.name.startswith("am_")]
    Base.metadata.create_all(bind, tables=tables, checkfirst=True)
    realestate_add_missing_columns(bind, tables)


def downgrade():
    # Deliberately a no-op: dropping the asset tables would destroy custody, audit and maintenance history.
    pass
