"""
Unit tests for Security Correlation Engine.

Tests:
- Cryptojacking multi-source correlation.
- APT / Lateral movement correlation.
- Benign heavy compute vs attack resolution (Student vs Researcher compute differentiation).
- Technical infrastructure fault correlation.
- Authentication brute force storm correlation.
- Normal operational baseline correlation.
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from backend.models.anomaly import AnomalyDetection
from backend.models.security_event import SecurityEvent
from backend.schemas.security_event import SecurityEventSeverity, SecurityEventType
from security.correlation_engine import SecurityCorrelationEngine


@pytest.fixture
def engine() -> SecurityCorrelationEngine:
    return SecurityCorrelationEngine()


def _make_anomaly(
    ws_id,
    score: float = 0.95,
    anomaly_type: str = "TECHNICAL_ANOMALY",
    evidence: list[str] | None = None,
) -> AnomalyDetection:
    return AnomalyDetection(
        id=uuid4(),
        workstation_id=ws_id,
        timestamp=datetime.now(timezone.utc),
        anomaly_type=anomaly_type,
        score=score,
        confidence=0.90,
        model_name="model_01_isolation_forest",
        model_version="1.0.0",
        evidence=evidence or ["Model 01 anomaly score exceeded threshold."],
        status="DETECTED",
    )


def _make_event(
    ws_id,
    event_type: SecurityEventType = SecurityEventType.SUSPICIOUS_PROCESS,
    severity: SecurityEventSeverity = SecurityEventSeverity.HIGH,
    evidence: list[str] | None = None,
    description: str = "Security event detected",
) -> SecurityEvent:
    return SecurityEvent(
        id=uuid4(),
        timestamp=datetime.now(timezone.utc),
        source="wazuh",
        workstation_id=ws_id,
        event_type=event_type.value,
        severity=severity.value,
        confidence=0.88,
        description=description,
        evidence=evidence or [],
    )


class TestSecurityCorrelationEngine:
    """Test suite for diagnostic multi-signal correlation."""

    def test_correlate_cryptojacking_incident(self, engine: SecurityCorrelationEngine):
        ws_id = uuid4()
        anom = _make_anomaly(ws_id, score=0.98, evidence=["High CPU utilization (99.5%)"])
        sec_event = _make_event(
            ws_id,
            event_type=SecurityEventType.CRYPTOJACKING,
            severity=SecurityEventSeverity.CRITICAL,
            evidence=["Matched stratum/crypto-mining indicator: port 3333", "Image: xmrig.exe"],
            description="Outbound connection to mining pool",
        )

        incident = engine.correlate(ws_id, [anom], [sec_event], workstation_name="lab-pc-01")

        assert incident.is_threat is True
        assert incident.incident_category == "CRYPTOJACKING"
        assert incident.severity == SecurityEventSeverity.CRITICAL
        assert incident.recommended_action == "SURGICAL_ISOLATION"
        assert incident.confidence >= 0.90

    def test_correlate_apt_intrusion_incident(self, engine: SecurityCorrelationEngine):
        ws_id = uuid4()
        anom = _make_anomaly(
            ws_id,
            anomaly_type="SECURITY_ANOMALY",
            evidence=["Model 02-B flagged host cyber attack pattern (threat probability: 94.5%)"],
        )
        sec_event = _make_event(
            ws_id,
            event_type=SecurityEventType.PRIVILEGE_ESCALATION,
            severity=SecurityEventSeverity.HIGH,
            evidence=["TargetFile: lsass.exe", "ProcessTampering detected"],
        )

        incident = engine.correlate(ws_id, [anom], [sec_event], workstation_name="workstation-apt-01")

        assert incident.is_threat is True
        assert incident.incident_category == "APT_INTRUSION"
        assert incident.severity == SecurityEventSeverity.HIGH
        assert incident.recommended_action == "SURGICAL_ISOLATION"

    def test_correlate_benign_high_compute_workload(self, engine: SecurityCorrelationEngine):
        """High CPU on workstation without any malicious security events -> benign compute."""
        ws_id = uuid4()
        anom = _make_anomaly(
            ws_id,
            score=0.92,
            evidence=["Model 02-A diagnosed technical fault 'cpu' with confidence 96.0%"],
        )

        incident = engine.correlate(ws_id, [anom], [], workstation_name="bioinfo-gpu-01")

        assert incident.is_threat is False
        assert incident.incident_category == "BENIGN_HIGH_LOAD"
        assert incident.severity == SecurityEventSeverity.LOW
        assert incident.recommended_action == "PRESERVE_STATE"

    def test_correlate_hardware_degradation_fault(self, engine: SecurityCorrelationEngine):
        """Disk/Network failure without security threats -> maintenance fault."""
        ws_id = uuid4()
        anom = _make_anomaly(
            ws_id,
            evidence=["Model 02-A diagnosed technical fault 'disk' with confidence 99.0%"],
        )

        incident = engine.correlate(ws_id, [anom], [], workstation_name="storage-node-03")

        assert incident.is_threat is False
        assert incident.incident_category == "TECHNICAL_FAULT"
        assert incident.recommended_action == "LOG_MAINTENANCE"

    def test_correlate_unauthorized_auth_storm(self, engine: SecurityCorrelationEngine):
        ws_id = uuid4()
        events = [
            _make_event(
                ws_id,
                event_type=SecurityEventType.AUTHENTICATION_FAILURE,
                severity=SecurityEventSeverity.MEDIUM,
                description=f"Logon failure attempt {i}",
            )
            for i in range(4)
        ]

        incident = engine.correlate(ws_id, [], events, workstation_name="auth-server")

        assert incident.is_threat is True
        assert incident.incident_category == "UNAUTHORIZED_ACCESS"
        assert incident.recommended_action == "ALERT_SOC"

    def test_correlate_normal_baseline(self, engine: SecurityCorrelationEngine):
        ws_id = uuid4()
        incident = engine.correlate(ws_id, [], [], workstation_name="idle-pc-01")

        assert incident.is_threat is False
        assert incident.incident_category == "NORMAL"
        assert incident.recommended_action == "MONITOR"
