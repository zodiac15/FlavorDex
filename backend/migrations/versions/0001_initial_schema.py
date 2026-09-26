"""Create missing application tables.

Revision ID: 0001_initial_schema
Revises:
"""
from alembic import op

from backend.models import Base

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    # This bootstrap revision may run against an existing, unversioned database.
    # Dropping metadata here could delete tables and data that predate Alembic.
    pass
