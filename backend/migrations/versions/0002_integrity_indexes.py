"""Add database uniqueness guarantees.

Revision ID: 0002_integrity_indexes
Revises: 0001_initial_schema
"""
from alembic import op
from sqlalchemy import text
from sqlalchemy.schema import CreateIndex, DropIndex

from backend.models import Base

revision = "0002_integrity_indexes"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None

DUPLICATE_CHECKS = {
    "recipe_ingredients": ("recipe_id", "ingredient_id"),
    "user_inventory": ("user_id", "ingredient_id"),
    "user_active_goals": ("user_id", "recipe_id"),
    "user_unlocked_recipes": ("user_id", "recipe_id"),
    "anomaly_votes": ("anomaly_id", "user_id"),
}
NEW_UNIQUE_INDEXES = (
    ("recipe_ingredients", "uq_recipe_ingredient"),
    ("user_inventory", "uq_user_inventory"),
    ("user_active_goals", "uq_user_active_goal"),
    ("user_unlocked_recipes", "uq_user_unlocked_recipe"),
    ("anomalies", "uq_anomaly_submitter_name"),
    ("anomaly_votes", "uq_anomaly_vote"),
)


def upgrade() -> None:
    connection = op.get_bind()
    for table, columns in DUPLICATE_CHECKS.items():
        grouped_columns = ", ".join(columns)
        duplicate = connection.execute(
            text(
                f"SELECT {grouped_columns} FROM {table} "
                f"GROUP BY {grouped_columns} HAVING COUNT(*) > 1 LIMIT 1"
            )
        ).first()
        if duplicate:
            raise RuntimeError(
                f"Cannot add unique index for {table}: duplicate key {tuple(duplicate)}. "
                "Deduplicate this data, then rerun the migration."
            )

    duplicate_anomaly = connection.execute(
        text(
            "SELECT submitter_user_id, lower(scraped_name) FROM anomalies "
            "WHERE submitter_user_id IS NOT NULL "
            "GROUP BY submitter_user_id, lower(scraped_name) "
            "HAVING COUNT(*) > 1 LIMIT 1"
        )
    ).first()
    if duplicate_anomaly:
        raise RuntimeError(
            "Cannot add anomaly submission uniqueness index: duplicate normalized submissions "
            f"for {tuple(duplicate_anomaly)}. Deduplicate this data, then rerun the migration."
        )

    for table_name, index_name in NEW_UNIQUE_INDEXES:
        index = next(
            (
                candidate
                for candidate in Base.metadata.tables[table_name].indexes
                if candidate.name == index_name
            ),
            None,
        )
        if index is None:
            raise RuntimeError(f"Expected unique index {index_name} is missing from model metadata")
        connection.execute(CreateIndex(index, if_not_exists=True))


def downgrade() -> None:
    connection = op.get_bind()
    for table_name, index_name in NEW_UNIQUE_INDEXES:
        index = next(
            (
                candidate
                for candidate in Base.metadata.tables[table_name].indexes
                if candidate.name == index_name
            ),
            None,
        )
        if index is None:
            raise RuntimeError(f"Expected unique index {index_name} is missing from model metadata")
        connection.execute(DropIndex(index, if_exists=True))
