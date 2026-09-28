"""Schema enhancement and alignment.

Revision ID: 002_align_data_dictionary
Revises: 001_initial
Create Date: 2026-09-26

Enhances database schema:
- Creates lookup tables: department, location
- Adds permission_level to user_role
- Adds university_id, full_name, department_id to user_account
- Adds asset_tag, mac_address, location_id, department_id, assigned_user_id,
  hardware_specs, installed_at to workstation
- Adds severity, evidence_summary to anomaly_detection
- Adds threat_type, ioc_value, risk_score, mitre_tactic, status to security_event
- Adds workstation_id, acknowledged_by to alert
- Adds alert_id, opened_by, closed_at, resolution_summary to incident
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_align_data_dictionary"
down_revision: str | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- 1. department ---
    op.create_table(
        "department",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), unique=True, nullable=False),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- 2. location ---
    op.create_table(
        "location",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("building", sa.String(80), nullable=False),
        sa.Column("floor", sa.Integer, nullable=True),
        sa.Column("room", sa.String(40), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- 3. user_role additions ---
    op.add_column(
        "user_role",
        sa.Column("permission_level", sa.Integer, server_default="1", nullable=False),
    )

    # --- 4. user_account additions ---
    op.add_column(
        "user_account",
        sa.Column("university_id", sa.String(30), unique=True, nullable=True),
    )
    op.add_column(
        "user_account",
        sa.Column("full_name", sa.String(150), nullable=True),
    )
    op.add_column(
        "user_account",
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("department.id"),
            nullable=True,
        ),
    )

    # --- 5. workstation additions ---
    op.add_column(
        "workstation",
        sa.Column("asset_tag", sa.String(60), unique=True, nullable=True),
    )
    op.add_column(
        "workstation",
        sa.Column("mac_address", sa.String(30), unique=True, nullable=True),
    )
    op.add_column(
        "workstation",
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("location.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "workstation",
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("department.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "workstation",
        sa.Column(
            "assigned_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_account.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "workstation",
        sa.Column("hardware_specs", postgresql.JSON, nullable=True),
    )
    op.add_column(
        "workstation",
        sa.Column("installed_at", sa.Date, nullable=True),
    )
    op.create_index("ix_workstation_asset_tag", "workstation", ["asset_tag"])

    # --- 6. anomaly_detection additions ---
    op.add_column(
        "anomaly_detection",
        sa.Column("severity", sa.String(16), server_default="medium", nullable=False),
    )
    op.add_column(
        "anomaly_detection",
        sa.Column("evidence_summary", sa.Text, nullable=True),
    )
    op.create_index("ix_anomaly_severity", "anomaly_detection", ["severity"])

    # --- 7. security_event additions ---
    op.add_column(
        "security_event",
        sa.Column("threat_type", sa.String(120), nullable=True),
    )
    op.add_column(
        "security_event",
        sa.Column("ioc_value", sa.String(255), nullable=True),
    )
    op.add_column(
        "security_event",
        sa.Column("risk_score", sa.Float, nullable=True),
    )
    op.add_column(
        "security_event",
        sa.Column("mitre_tactic", sa.String(120), nullable=True),
    )
    op.add_column(
        "security_event",
        sa.Column("status", sa.String(32), server_default="new", nullable=False),
    )
    op.create_index("ix_security_event_threat_type", "security_event", ["threat_type"])
    op.create_index("ix_security_event_status", "security_event", ["status"])

    # --- 8. alert additions ---
    op.add_column(
        "alert",
        sa.Column(
            "workstation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workstation.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "alert",
        sa.Column(
            "acknowledged_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_account.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_alert_workstation", "alert", ["workstation_id"])

    # --- 9. incident additions ---
    op.alter_column(
        "incident",
        "incident_number",
        existing_type=sa.String(32),
        type_=sa.String(40),
        existing_nullable=False,
    )
    op.add_column(
        "incident",
        sa.Column(
            "alert_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("alert.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "incident",
        sa.Column(
            "opened_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_account.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "incident",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "incident",
        sa.Column("resolution_summary", sa.Text, nullable=True),
    )
    op.create_index("ix_incident_alert", "incident", ["alert_id"])


def downgrade() -> None:
    # incident
    op.drop_index("ix_incident_alert", table_name="incident")
    op.drop_column("incident", "resolution_summary")
    op.drop_column("incident", "closed_at")
    op.drop_column("incident", "opened_by")
    op.drop_column("incident", "alert_id")
    op.alter_column(
        "incident",
        "incident_number",
        existing_type=sa.String(40),
        type_=sa.String(32),
        existing_nullable=False,
    )

    # alert
    op.drop_index("ix_alert_workstation", table_name="alert")
    op.drop_column("alert", "acknowledged_by")
    op.drop_column("alert", "workstation_id")

    # security_event
    op.drop_index("ix_security_event_status", table_name="security_event")
    op.drop_index("ix_security_event_threat_type", table_name="security_event")
    op.drop_column("security_event", "status")
    op.drop_column("security_event", "mitre_tactic")
    op.drop_column("security_event", "risk_score")
    op.drop_column("security_event", "ioc_value")
    op.drop_column("security_event", "threat_type")

    # anomaly_detection
    op.drop_index("ix_anomaly_severity", table_name="anomaly_detection")
    op.drop_column("anomaly_detection", "evidence_summary")
    op.drop_column("anomaly_detection", "severity")

    # workstation
    op.drop_index("ix_workstation_asset_tag", table_name="workstation")
    op.drop_column("workstation", "installed_at")
    op.drop_column("workstation", "hardware_specs")
    op.drop_column("workstation", "assigned_user_id")
    op.drop_column("workstation", "department_id")
    op.drop_column("workstation", "location_id")
    op.drop_column("workstation", "mac_address")
    op.drop_column("workstation", "asset_tag")

    # user_account
    op.drop_column("user_account", "department_id")
    op.drop_column("user_account", "full_name")
    op.drop_column("user_account", "university_id")

    # user_role
    op.drop_column("user_role", "permission_level")

    # lookup tables
    op.drop_table("location")
    op.drop_table("department")
