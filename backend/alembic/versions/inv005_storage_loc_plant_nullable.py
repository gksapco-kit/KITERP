"""Allow storage_location.plant_id NULL so locations can sit under a branch.

Revision ID: inv005_storage_loc_plant_nullable
Revises: car002_career_photo_url
Create Date: 2026-07-21

Storage locations may belong to a plant OR a branch (store child).
When scoped to a branch only, plant_id is omitted.
"""
from alembic import op

revision = "inv005_storage_loc_plant_nullable"
down_revision = "car002_career_photo_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE storage_location ALTER COLUMN plant_id DROP NOT NULL")


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM storage_location WHERE plant_id IS NULL
          ) THEN
            ALTER TABLE storage_location ALTER COLUMN plant_id SET NOT NULL;
          END IF;
        END $$;
        """
    )
