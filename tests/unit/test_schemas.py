"""
Unit Tests — Domain Schema Validation.

Tests that all Pydantic domain contracts:
1. Accept valid data.
2. Reject invalid data with proper errors.
3. Enforce field constraints (min/max, ranges, enums).
"""

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from backend.schemas.alert import AlertCreate, AlertSeverity, AlertSourceType
from backend.schemas.anomaly import AnomalyCreate, AnomalyType
from backend.schemas.audit import AuditLogCreate
from backend.schemas.health import HealthResponse
from backend.schemas.incident import IncidentCategory, IncidentCreate, IncidentSeverity
from backend.schemas.security_event import (
    SecurityEventCreate,
    SecurityEventSeverity,
    SecurityEventType,
)
from backend.schemas.telemetry import (
    TelemetryCreate,
)
from backend.schemas.user import RoleEnum, UserCreate
from backend.schemas.workstation import WorkstationCreate, WorkstationStatus

# ============================================================================
# User Schemas
# ============================================================================


class TestUserCreate:
    """Tests for the UserCreate schema."""

    def test_valid_user(self) -> None:
        user = UserCreate(
            username="testuser",
            email="test@example.com",
            password="SecurePassword123!",
            role=RoleEnum.STUDENT,
        )
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.role == RoleEnum.STUDENT

    def test_short_username_rejected(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                username="ab",  # min_length=3
                email="test@example.com",
                password="SecurePassword123!",
            )

    def test_short_password_rejected(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                username="testuser",
                email="test@example.com",
                password="short",  # min_length=12
            )

    def test_invalid_email_rejected(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                username="testuser",
                email="not-an-email",
                password="SecurePassword123!",
            )

    def test_default_role_is_student(self) -> None:
        user = UserCreate(
            username="testuser",
            email="test@example.com",
            password="SecurePassword123!",
        )
        assert user.role == RoleEnum.STUDENT


class TestRoleEnum:
    """Tests for the RoleEnum values."""

    def test_all_roles_defined(self) -> None:
        assert RoleEnum.ADMIN == "ADMIN"
        assert RoleEnum.IT_OPERATOR == "IT_OPERATOR"
        assert RoleEnum.RESEARCHER == "RESEARCHER"
        assert RoleEnum.STUDENT == "STUDENT"

    def test_role_count(self) -> None:
        assert len(RoleEnum) == 4


# ============================================================================
# Telemetry Schemas
# ============================================================================


class TestTelemetryCreate:
    """Tests for the TelemetryCreate schema."""

    def _valid_telemetry(self, **overrides) -> dict:
        base = {
            "agent_id": str(uuid.uuid4()),
            "workstation_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "schema_version": "1.0",
            "cpu": {"usage_percent": 45.5},
            "memory": {"usage_percent": 60.0},
            "disk": {"read_bytes_per_sec": 1000.0, "write_bytes_per_sec": 500.0},
            "network": {"bytes_in_per_sec": 2000.0, "bytes_out_per_sec": 1000.0},
            "process_count": 120,
        }
        base.update(overrides)
        return base

    def test_valid_telemetry(self) -> None:
        data = self._valid_telemetry()
        telemetry = TelemetryCreate(**data)
        assert telemetry.cpu.usage_percent == 45.5
        assert telemetry.schema_version == "1.0"

    def test_cpu_over_100_rejected(self) -> None:
        with pytest.raises(ValidationError):
            data = self._valid_telemetry(cpu={"usage_percent": 150.0})
            TelemetryCreate(**data)

    def test_cpu_negative_rejected(self) -> None:
        with pytest.raises(ValidationError):
            data = self._valid_telemetry(cpu={"usage_percent": -1.0})
            TelemetryCreate(**data)

    def test_negative_process_count_rejected(self) -> None:
        with pytest.raises(ValidationError):
            data = self._valid_telemetry(process_count=-5)
            TelemetryCreate(**data)

    def test_invalid_schema_version_rejected(self) -> None:
        with pytest.raises(ValidationError):
            data = self._valid_telemetry(schema_version="abc")
            TelemetryCreate(**data)

    def test_missing_required_field_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TelemetryCreate(
                agent_id=str(uuid.uuid4()),
                # missing other required fields
            )


# ============================================================================
# Anomaly Schemas
# ============================================================================


class TestAnomalyCreate:
    """Tests for the AnomalyCreate schema."""

    def test_valid_anomaly(self) -> None:
        anomaly = AnomalyCreate(
            workstation_id=uuid.uuid4(),
            timestamp=datetime.now(timezone.utc),
            anomaly_type=AnomalyType.TECHNICAL_ANOMALY,
            score=0.85,
            confidence=0.92,
            model_name="isolation-forest",
            model_version="1.0",
            evidence=["CPU sustained above 95%"],
        )
        assert anomaly.anomaly_type == AnomalyType.TECHNICAL_ANOMALY
        assert anomaly.score == 0.85

    def test_score_out_of_range_rejected(self) -> None:
        with pytest.raises(ValidationError):
            AnomalyCreate(
                workstation_id=uuid.uuid4(),
                timestamp=datetime.now(timezone.utc),
                anomaly_type=AnomalyType.NORMAL,
                score=1.5,  # max=1.0
                confidence=0.5,
                model_name="test",
                model_version="1.0",
            )

    def test_all_anomaly_types(self) -> None:
        assert AnomalyType.NORMAL == "NORMAL"
        assert AnomalyType.TECHNICAL_ANOMALY == "TECHNICAL_ANOMALY"
        assert AnomalyType.SECURITY_ANOMALY == "SECURITY_ANOMALY"


# ============================================================================
# Security Event Schemas
# ============================================================================


class TestSecurityEventCreate:
    """Tests for the SecurityEventCreate schema."""

    def test_valid_security_event(self) -> None:
        event = SecurityEventCreate(
            timestamp=datetime.now(timezone.utc),
            source="ml-engine",
            event_type=SecurityEventType.CRYPTOJACKING,
            severity=SecurityEventSeverity.HIGH,
            confidence=0.94,
            description="Suspected cryptojacking activity detected",
        )
        assert event.event_type == SecurityEventType.CRYPTOJACKING
        assert event.severity == SecurityEventSeverity.HIGH

    def test_confidence_out_of_range_rejected(self) -> None:
        with pytest.raises(ValidationError):
            SecurityEventCreate(
                timestamp=datetime.now(timezone.utc),
                source="test",
                event_type=SecurityEventType.OTHER,
                severity=SecurityEventSeverity.LOW,
                confidence=2.0,  # max=1.0
                description="test",
            )


# ============================================================================
# Alert Schemas
# ============================================================================


class TestAlertCreate:
    """Tests for the AlertCreate schema."""

    def test_valid_alert(self) -> None:
        alert = AlertCreate(
            source_type=AlertSourceType.ANOMALY_DETECTION,
            severity=AlertSeverity.HIGH,
            title="High CPU anomaly detected",
            description="Workstation WS-001 shows sustained high CPU usage.",
        )
        assert alert.severity == AlertSeverity.HIGH
        assert alert.title == "High CPU anomaly detected"

    def test_empty_title_rejected(self) -> None:
        with pytest.raises(ValidationError):
            AlertCreate(
                source_type=AlertSourceType.SYSTEM,
                severity=AlertSeverity.LOW,
                title="",  # min_length=1
                description="test",
            )


# ============================================================================
# Incident Schemas
# ============================================================================


class TestIncidentCreate:
    """Tests for the IncidentCreate schema."""

    def test_valid_incident(self) -> None:
        incident = IncidentCreate(
            severity=IncidentSeverity.CRITICAL,
            category=IncidentCategory.SECURITY_THREAT,
            title="Cryptojacking incident",
            description="Mining process detected on WS-001",
        )
        assert incident.category == IncidentCategory.SECURITY_THREAT


# ============================================================================
# Audit Log Schemas
# ============================================================================


class TestAuditLogCreate:
    """Tests for the AuditLogCreate schema."""

    def test_valid_audit_log(self) -> None:
        log = AuditLogCreate(
            actor="user:admin-001",
            action="user.login",
            resource="user:admin-001",
            result="success",
            source_ip="192.168.1.100",
        )
        assert log.action == "user.login"
        assert log.result == "success"


# ============================================================================
# Workstation Schemas
# ============================================================================


class TestWorkstationCreate:
    """Tests for the WorkstationCreate schema."""

    def test_valid_workstation(self) -> None:
        ws = WorkstationCreate(
            hostname="lab-ws-001",
            ip_address="10.0.1.50",
            operating_system="Ubuntu 22.04 LTS",
            department="Computer Science",
            lab="AI Research Lab",
        )
        assert ws.hostname == "lab-ws-001"

    def test_all_statuses(self) -> None:
        statuses = [s.value for s in WorkstationStatus]
        assert "ONLINE" in statuses
        assert "OFFLINE" in statuses
        assert "MAINTENANCE" in statuses
        assert "COMPROMISED" in statuses
        assert "DECOMMISSIONED" in statuses


# ============================================================================
# Health Schemas
# ============================================================================


class TestHealthResponse:
    """Tests for the HealthResponse schema."""

    def test_valid_health(self) -> None:
        health = HealthResponse(
            status="healthy",
            version="0.1.0",
            environment="test",
            timestamp=datetime.now(timezone.utc),
        )
        assert health.status == "healthy"
