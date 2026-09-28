"""Initial schema — Phase 0 foundation tables.

Revision ID: 001_initial
Revises: None
Create Date: 2026-08-24

Creates all foundation tables:
- user_role
- user_account
- workstation
- telemetry_metric
- anomaly_detection
- security_event
- alert
- incident
- audit_log
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- user_role ---
    op.create_table(
        "user_role",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(32), unique=True, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("permissions", postgresql.JSON, nullable=True),
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

    # --- user_account ---
    op.create_table(
        "user_account",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_id", sa.String(256), unique=True, nullable=True),
        sa.Column("username", sa.String(64), unique=True, nullable=False),
        sa.Column("email", sa.String(256), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column(
            "role_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_role.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_login_attempts", sa.Integer, server_default="0"),
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

    # --- workstation ---
    op.create_table(
        "workstation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("hostname", sa.String(255), unique=True, nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), unique=True, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=False),
        sa.Column("operating_system", sa.String(128), nullable=False),
        sa.Column("department", sa.String(128), nullable=True),
        sa.Column("lab", sa.String(128), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="ONLINE"),
        sa.Column("agent_version", sa.String(32), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index("ix_workstation_status", "workstation", ["status"])
    op.create_index("ix_workstation_department", "workstation", ["department"])
    op.create_index("ix_workstation_last_seen", "workstation", ["last_seen_at"])

    # --- telemetry_metric ---
    op.create_table(
        "telemetry_metric",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workstation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workstation.id"),
            nullable=False,
        ),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("schema_version", sa.String(16), nullable=True, server_default="1.0"),
        sa.Column("cpu_usage", sa.Float, nullable=False),
        sa.Column("memory_usage", sa.Float, nullable=False),
        sa.Column("disk_read", sa.Float, nullable=False, server_default="0"),
        sa.Column("disk_write", sa.Float, nullable=False, server_default="0"),
        sa.Column("network_in", sa.Float, nullable=False, server_default="0"),
        sa.Column("network_out", sa.Float, nullable=False, server_default="0"),
        sa.Column("process_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_telemetry_workstation_timestamp",
        "telemetry_metric",
        ["workstation_id", "timestamp"],
    )
    op.create_index("ix_telemetry_timestamp", "telemetry_metric", ["timestamp"])

    # --- anomaly_detection ---
    op.create_table(
        "anomaly_detection",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workstation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workstation.id"),
            nullable=False,
        ),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("anomaly_type", sa.String(32), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("model_name", sa.String(128), nullable=False),
        sa.Column("model_version", sa.String(32), nullable=False),
        sa.Column("features_snapshot", postgresql.JSON, nullable=True),
        sa.Column("evidence", postgresql.JSON, nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="DETECTED"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_anomaly_workstation_timestamp",
        "anomaly_detection",
        ["workstation_id", "timestamp"],
    )
    op.create_index("ix_anomaly_type", "anomaly_detection", ["anomaly_type"])
    op.create_index("ix_anomaly_status", "anomaly_detection", ["status"])

    # --- security_event ---
    op.create_table(
        "security_event",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(128), nullable=False),
        sa.Column(
            "correlated_anomaly_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("anomaly_detection.id"),
            nullable=True,
        ),
        sa.Column(
            "workstation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workstation.id"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_account.id"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("evidence", postgresql.JSON, nullable=True),
        sa.Column("raw_event_reference", sa.String(512), nullable=True),
        sa.Column("correlation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_security_event_timestamp", "security_event", ["timestamp"])
    op.create_index("ix_security_event_severity", "security_event", ["severity"])
    op.create_index("ix_security_event_type", "security_event", ["event_type"])
    op.create_index("ix_security_event_workstation", "security_event", ["workstation_id"])
    op.create_index("ix_security_event_correlation", "security_event", ["correlation_id"])

    # --- alert ---
    op.create_table(
        "alert",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="OPEN"),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index("ix_alert_status", "alert", ["status"])
    op.create_index("ix_alert_severity", "alert", ["severity"])
    op.create_index("ix_alert_created", "alert", ["created_at"])

    # --- incident ---
    op.create_table(
        "incident",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("incident_number", sa.String(32), unique=True, nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column(
            "workstation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workstation.id"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_account.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="OPEN"),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("response_action", sa.Text, nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index("ix_incident_status", "incident", ["status"])
    op.create_index("ix_incident_severity", "incident", ["severity"])
    op.create_index("ix_incident_category", "incident", ["category"])
    op.create_index("ix_incident_workstation", "incident", ["workstation_id"])

    # --- audit_log ---
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor", sa.String(256), nullable=False),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("resource", sa.String(256), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("source_ip", sa.String(45), nullable=True),
        sa.Column("result", sa.String(32), nullable=False),
        sa.Column("correlation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSON, nullable=True),
    )
    op.create_index("ix_audit_log_actor", "audit_log", ["actor"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_timestamp", "audit_log", ["timestamp"])
    op.create_index("ix_audit_log_correlation", "audit_log", ["correlation_id"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("incident")
    op.drop_table("alert")
    op.drop_table("security_event")
    op.drop_table("anomaly_detection")
    op.drop_table("telemetry_metric")
    op.drop_table("workstation")
    op.drop_table("user_account")
    op.drop_table("user_role")
