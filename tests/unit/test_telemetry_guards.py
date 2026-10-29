"""
Unit Tests — Telemetry Alert Guards and Incident-Aware Suppression.

Regression tests for:
1. Acknowledged cyber threat alerts suppress secondary technical failure alerts within cooldown.
2. Isolated workstation status suppresses technical failure alerts.
3. Genuinely distinct security incidents or new threat types remain eligible for alerting.
4. Robust UUID handling across driver representations (str vs UUID).
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from backend.api.v1.telemetry import (
    _get_active_telemetry_suppression_state,
    _should_create_telemetry_alert,
)
from backend.models.alert import Alert
from backend.models.incident import Incident
from backend.models.workstation import Workstation
from backend.schemas.anomaly import AnomalyType
from tests.conftest import TestAsyncSession


def test_should_create_telemetry_alert_suppresses_technical_when_isolated() -> None:
    """Isolated workstation status must suppress technical anomaly alerts."""
    should_alert = _should_create_telemetry_alert(
        anomaly_type=AnomalyType.TECHNICAL_ANOMALY,
        workstation_status="ISOLATED",
        active_sources=set(),
        has_active_threat_incident=False,
    )
    assert should_alert is False


def test_should_create_telemetry_alert_suppresses_technical_when_cyber_threat_active() -> None:
    """Active or acknowledged cyber threat alert suppresses secondary technical anomaly alerts."""
    should_alert = _should_create_telemetry_alert(
        anomaly_type=AnomalyType.TECHNICAL_ANOMALY,
        workstation_status="ONLINE",
        active_sources={"CYBERSECURITY_THREAT"},
        has_active_threat_incident=False,
    )
    assert should_alert is False


def test_should_create_telemetry_alert_suppresses_technical_when_security_incident_active() -> None:
    """Active security threat incident suppresses secondary technical anomaly alerts."""
    should_alert = _should_create_telemetry_alert(
        anomaly_type=AnomalyType.TECHNICAL_ANOMALY,
        workstation_status="ONLINE",
        active_sources=set(),
        has_active_threat_incident=True,
    )
    assert should_alert is False


def test_should_create_telemetry_alert_allows_technical_when_no_active_threat() -> None:
    """Technical anomaly alert is permitted when workstation is ONLINE and no threat active."""
    should_alert = _should_create_telemetry_alert(
        anomaly_type=AnomalyType.TECHNICAL_ANOMALY,
        workstation_status="ONLINE",
        active_sources=set(),
        has_active_threat_incident=False,
    )
    assert should_alert is True


def test_should_create_telemetry_alert_suppresses_technical_when_predictive_maintenance_active() -> None:
    """Active PREDICTIVE_MAINTENANCE alert suppresses secondary technical anomaly alerts."""
    should_alert = _should_create_telemetry_alert(
        anomaly_type=AnomalyType.TECHNICAL_ANOMALY,
        workstation_status="ONLINE",
        active_sources={"PREDICTIVE_MAINTENANCE"},
        has_active_threat_incident=False,
        has_active_maintenance_incident=False,
    )
    assert should_alert is False


def test_should_create_telemetry_alert_suppresses_technical_when_maintenance_incident_active() -> None:
    """Active MAINTENANCE incident suppresses secondary technical anomaly alerts."""
    should_alert = _should_create_telemetry_alert(
        anomaly_type=AnomalyType.TECHNICAL_ANOMALY,
        workstation_status="ONLINE",
        active_sources=set(),
        has_active_threat_incident=False,
        has_active_maintenance_incident=True,
    )
    assert should_alert is False


def test_should_create_telemetry_alert_suppresses_duplicate_technical_within_cooldown() -> None:
    """Technical anomaly alert is suppressed if TECHNICAL_ANOMALY already alerted within cooldown."""
    should_alert = _should_create_telemetry_alert(
        anomaly_type=AnomalyType.TECHNICAL_ANOMALY,
        workstation_status="ONLINE",
        active_sources={"TECHNICAL_ANOMALY"},
        has_active_threat_incident=False,
        has_active_maintenance_incident=False,
    )
    assert should_alert is False


def test_should_create_telemetry_alert_permits_distinct_security_anomaly() -> None:
    """Security anomaly alert is permitted even when maintenance is active."""
    should_alert = _should_create_telemetry_alert(
        anomaly_type=AnomalyType.SECURITY_ANOMALY,
        workstation_status="ONLINE",
        active_sources={"PREDICTIVE_MAINTENANCE"},
        has_active_threat_incident=False,
        has_active_maintenance_incident=True,
    )
    assert should_alert is True


@pytest.mark.asyncio
async def test_get_active_telemetry_suppression_state_with_acknowledged_alert() -> None:
    """Verifies that an ACKNOWLEDGED alert is properly captured in active_sources."""
    ws_id = uuid.uuid4()
    alert_id = uuid.uuid4()

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="test-ws-suppress",
            ip_address="10.10.1.50",
            operating_system="Windows 11",
            status="ISOLATED",
        )
        session.add(ws)
        alert = Alert(
            id=alert_id,
            workstation_id=ws_id,
            source_type="CYBERSECURITY_THREAT",
            severity="CRITICAL",
            status="ACKNOWLEDGED",
            title="Host Surgical Isolation: CRYPTOJACKING",
            description="Unauthorized mining detected.",
            created_at=datetime.now(timezone.utc),
        )
        session.add(alert)
        await session.commit()

    async with TestAsyncSession() as session:
        sources_by_ws, threat_ws_ids, maintenance_ws_ids = await _get_active_telemetry_suppression_state(
            session=session,
            workstation_ids={ws_id},
            cooldown_seconds=300,
        )
        assert str(ws_id) in sources_by_ws
        assert "CYBERSECURITY_THREAT" in sources_by_ws[str(ws_id)]
        assert str(ws_id) not in maintenance_ws_ids


@pytest.mark.asyncio
async def test_get_active_telemetry_suppression_state_with_active_incident() -> None:
    """Verifies that an active SECURITY_THREAT incident is captured in threat_ws_ids."""
    ws_id = uuid.uuid4()
    inc_id = uuid.uuid4()

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="test-ws-inc",
            ip_address="10.10.1.51",
            operating_system="Ubuntu 22.04",
            status="ONLINE",
        )
        session.add(ws)
        inc = Incident(
            id=inc_id,
            incident_number=f"INC-{uuid.uuid4().hex[:6].upper()}",
            severity="CRITICAL",
            category="SECURITY_THREAT",
            workstation_id=ws_id,
            status="CONTAINED",
            title="Surgical Process Containment",
            description="Rogue miner contained.",
            created_at=datetime.now(timezone.utc),
        )
        session.add(inc)
        await session.commit()

    async with TestAsyncSession() as session:
        sources_by_ws, threat_ws_ids, maintenance_ws_ids = await _get_active_telemetry_suppression_state(
            session=session,
            workstation_ids={ws_id},
            cooldown_seconds=300,
        )
        assert str(ws_id) in threat_ws_ids
        assert str(ws_id) not in maintenance_ws_ids


@pytest.mark.asyncio
async def test_get_active_telemetry_suppression_state_with_maintenance_incident() -> None:
    """Verifies that an active MAINTENANCE incident is captured in maintenance_ws_ids."""
    ws_id = uuid.uuid4()
    inc_id = uuid.uuid4()

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="test-ws-maint",
            ip_address="10.10.1.52",
            operating_system="Windows 11",
            status="ONLINE",
        )
        session.add(ws)
        inc = Incident(
            id=inc_id,
            incident_number=f"INC-{uuid.uuid4().hex[:6].upper()}",
            severity="HIGH",
            category="MAINTENANCE",
            workstation_id=ws_id,
            status="OPEN",
            title="Predictive Maintenance Advisory",
            description="Hardware memory stress detected.",
            created_at=datetime.now(timezone.utc),
        )
        session.add(inc)
        await session.commit()

    async with TestAsyncSession() as session:
        sources_by_ws, threat_ws_ids, maintenance_ws_ids = await _get_active_telemetry_suppression_state(
            session=session,
            workstation_ids={ws_id},
            cooldown_seconds=300,
        )
        assert str(ws_id) in maintenance_ws_ids
        assert str(ws_id) not in threat_ws_ids

