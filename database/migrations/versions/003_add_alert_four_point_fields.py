"""Add four-point alert generation fields.

Revision ID: 003_add_alert_four_point_fields
Revises: 002_align_data_dictionary
Create Date: 2026-10-12

Aligns the alert database schema with the four report trigger points:
- Expands alert.source_type from String(32) to String(64) to support HUMAN_INTERVENTION_REQUIRED.
- Adds alert.requires_human_intervention (Boolean, default False) with an index.
- Adds alert.recommendation (Text, nullable).
- Adds alert.playbook_initiated (String(64), nullable).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "003_add_alert_four_point_fields"
down_revision: str | None = "002_align_data_dictionary"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Expand source_type column length
    op.alter_column(
        "alert",
        "source_type",
        existing_type=sa.String(32),
        type_=sa.String(64),
        existing_nullable=False,
    )

    # 2. Add requires_human_intervention column
    op.add_column(
        "alert",
        sa.Column(
            "requires_human_intervention",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_alert_requires_human_intervention",
        "alert",
        ["requires_human_intervention"],
    )

    # 3. Add recommendation column
    op.add_column(
        "alert",
        sa.Column(
            "recommendation",
            sa.Text(),
            nullable=True,
        ),
    )

    # 4. Add playbook_initiated column
    op.add_column(
        "alert",
        sa.Column(
            "playbook_initiated",
            sa.String(64),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # Drop added columns in reverse order
    op.drop_column("alert", "playbook_initiated")
    op.drop_column("alert", "recommendation")
    op.drop_index("ix_alert_requires_human_intervention", table_name="alert")
    op.drop_column("alert", "requires_human_intervention")

    op.alter_column(
        "alert",
        "source_type",
        existing_type=sa.String(64),
        type_=sa.String(32),
        existing_nullable=False,
    )
