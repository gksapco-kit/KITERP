"""real estate vertical: baseline for the re_* tables

Revision ID: re001_realestate_baseline
Revises: prod010_production_hardening
Create Date: 2026-10-26

Creates every ``re_*`` table that is missing and adds model columns that are missing from existing ones.
Idempotent and additive only - it mirrors ``app.database.ensure_realestate_schema`` (which also runs at
application start-up), so running either, in any order, any number of times, is safe.

Later column renames / type changes / drops must be written as explicit migrations on top of this one.
"""
from alembic import op

revision = "re001_realestate_baseline"
down_revision = "prod010_production_hardening"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    import app.models  # noqa: F401  (vendor / user / finance tables referenced by foreign keys)
    import app.models.realestate  # noqa: F401
    from app.database import Base, realestate_add_missing_columns

    tables = [t for t in Base.metadata.sorted_tables if t.name.startswith("re_")]
    Base.metadata.create_all(bind, tables=tables, checkfirst=True)
    realestate_add_missing_columns(bind, tables)


def downgrade():
    # Deliberately a no-op: dropping the real-estate tables would destroy customer and ledger data.
    pass
