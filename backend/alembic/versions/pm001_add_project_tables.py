"""Add project management tables (pm_project, pm_task).

Revision ID: pm001_add_project_tables
Revises: a8b9c0d1e2f3
Create Date: 2026-06-05

Uses CREATE TABLE IF NOT EXISTS so this migration is safe on databases
where tables were already auto-created at boot.
"""
from alembic import op


revision = "pm001_add_project_tables"
down_revision = "a8b9c0d1e2f3"
branch_labels = None
depends_on = None


DDL_STATEMENTS: list[str] = [
    """CREATE TABLE IF NOT EXISTS pm_project (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        project_number VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'planning',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
        customer_name VARCHAR(255),
        owner_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
        owner_name VARCHAR(255),
        start_date DATE,
        end_date DATE,
        due_date DATE,
        budget NUMERIC(14,2),
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        progress_percent INTEGER NOT NULL DEFAULT 0,
        color VARCHAR(7),
        tags JSONB DEFAULT '[]'::jsonb,
        milestones JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        completed_at TIMESTAMPTZ
    );""",
    "CREATE INDEX IF NOT EXISTS ix_pm_project_vendor_id ON pm_project(vendor_id);",
    "CREATE INDEX IF NOT EXISTS ix_pm_project_vendor_status ON pm_project(vendor_id, status);",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_project_vendor_number ON pm_project(vendor_id, project_number);",
    "CREATE INDEX IF NOT EXISTS ix_pm_project_customer_id ON pm_project(customer_id);",
    "CREATE INDEX IF NOT EXISTS ix_pm_project_owner_id ON pm_project(owner_id);",
    """CREATE TABLE IF NOT EXISTS pm_task (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES pm_project(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'todo',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        assignee_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
        assignee_name VARCHAR(255),
        due_date DATE,
        position INTEGER NOT NULL DEFAULT 0,
        labels JSONB DEFAULT '[]'::jsonb,
        checklist JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        completed_at TIMESTAMPTZ
    );""",
    "CREATE INDEX IF NOT EXISTS ix_pm_task_vendor_id ON pm_task(vendor_id);",
    "CREATE INDEX IF NOT EXISTS ix_pm_task_project_id ON pm_task(project_id);",
    "CREATE INDEX IF NOT EXISTS ix_pm_task_project_status ON pm_task(project_id, status);",
    "CREATE INDEX IF NOT EXISTS ix_pm_task_project_position ON pm_task(project_id, status, position);",
    "ALTER TABLE pm_task ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES pm_task(id) ON DELETE SET NULL;",
    "ALTER TABLE pm_task ADD COLUMN IF NOT EXISTS linked_task_ids JSONB DEFAULT '[]'::jsonb;",
    "CREATE INDEX IF NOT EXISTS ix_pm_task_parent_task_id ON pm_task(parent_task_id);",
]

DROP_TABLES = ["pm_task", "pm_project"]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for stmt in DDL_STATEMENTS:
        op.execute(stmt)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for table in DROP_TABLES:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
