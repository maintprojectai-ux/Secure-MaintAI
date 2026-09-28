"""
Integration Tests — Security Events & Correlation API.

Tests:
- Ingestion of normalized security events via POST /api/v1/security/events.
- Automatic Alert generation for HIGH and CRITICAL security events.
- Raw Wazuh alert ingestion via POST /api/v1/security/events/wazuh.
- Batch security event ingestion via POST /api/v1/security/events/batch.
- Filtered query retrieval via GET /api/v1/security/events.
- Multi-source correlation trigger via POST /api/v1/security/correlate/{workstation_id}.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.security_event import SecurityEvent
from backend.models.workstation import Workstation
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_ingest_security_event_persists_record_and_generates_alert(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/security/events with CRITICAL severity should persist event and create an Alert."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="sec-node-01",
            ip_address="10.0.0.15",
            operating_system="Windows Server 2022",
            department="IT",
            lab="DataCenter",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "wazuh",
        "workstation_id": str(ws_id),
        "event_type": "CRYPTOJACKING",
        "severity": "CRITICAL",
        "confidence": 0.95,
        "description": "Suspicious outbound mining pool connection to port 3333",
        "evidence": ["Image: C:\\Temp\\xmrig.exe", "Destination: 198.51.100.25:3333"],
        "raw_event_reference": "wazuh-alert-9912",
    }

    response = await async_client.post("/api/v1/security/events", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["event_type"] == "CRYPTOJACKING"
    assert data["severity"] == "CRITICAL"
    event_id = uuid.UUID(data["id"])

    # Verify database: SecurityEvent and Alert persisted
    async with TestAsyncSession() as session:
        event_res = await session.execute(
            select(SecurityEvent).where(SecurityEvent.id == event_id)
        )
        assert event_res.scalar_one_or_none() is not None

        alert_res = await session.execute(
            select(Alert).where(Alert.source_id == event_id)
        )
        alert = alert_res.scalar_one_or_none()
        assert alert is not None
        assert alert.severity == "CRITICAL"
        assert alert.status == "OPEN"
        assert "CRYPTOJACKING" in alert.title


@pytest.mark.asyncio
async def test_ingest_raw_wazuh_event(
    async_client: AsyncClient,
) -> None:
    """POST /api/v1/security/events/wazuh should parse raw Wazuh alert JSON and persist."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="student-pc-22",
            ip_address="10.0.0.22",
            operating_system="Windows 11",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    raw_wazuh = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "rule": {"id": "100101", "level": 10, "description": "Sysmon - Suspicious Script Host"},
        "data": {
            "win": {
                "system": {"eventID": 1},
                "eventdata": {
                    "image": "C:\\Windows\\System32\\wscript.exe",
                    "commandLine": "wscript.exe C:\\Temp\\payload.vbs",
                },
            }
        },
    }

    response = await async_client.post(
        f"/api/v1/security/events/wazuh?workstation_id={ws_id}",
        json=raw_wazuh,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["source"] == "wazuh"
    assert data["severity"] == "HIGH"
    assert data["workstation_id"] == str(ws_id)


@pytest.mark.asyncio
async def test_query_security_events_with_filters(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """GET /api/v1/security/events should return filtered events."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="query-target",
            ip_address="10.0.0.33",
            operating_system="Linux",
            status="ONLINE",
        )
        session.add(ws)
        # Add 2 events
        e1 = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            source="wazuh",
            workstation_id=ws_id,
            event_type="SUSPICIOUS_PROCESS",
            severity="MEDIUM",
            confidence=0.8,
            description="Process spawned",
        )
        e2 = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            source="network-monitor",
            workstation_id=ws_id,
            event_type="NETWORK_ANOMALY",
            severity="LOW",
            confidence=0.7,
            description="Port access",
        )
        session.add_all([e1, e2])
        await session.commit()

    # Query filtered by severity=MEDIUM
    response = await async_client.get(
        f"/api/v1/security/events?workstation_id={ws_id}&severity=MEDIUM",
        headers=admin_headers,
    )
    assert response.status_code == 200
    events = response.json()
    assert len(events) == 1
    assert events[0]["severity"] == "MEDIUM"


@pytest.mark.asyncio
async def test_trigger_correlation_endpoint(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """POST /api/v1/security/correlate/{workstation_id} should correlate anomalies and security events."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="machine-1-1",
            ip_address="192.168.1.99",
            operating_system="Ubuntu 22.04",
            status="ONLINE",
        )
        session.add(ws)

        anom = AnomalyDetection(
            workstation_id=ws_id,
            timestamp=datetime.now(timezone.utc),
            anomaly_type="TECHNICAL_ANOMALY",
            score=0.95,
            confidence=0.90,
            model_name="model_01_isolation_forest",
            model_version="1.0.0",
            evidence=["High CPU spike detected (99.0%)", "Model 02-A diagnosed 'cpu' fault"],
            status="DETECTED",
        )
        sec = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            source="network-monitor",
            workstation_id=ws_id,
            event_type="CRYPTOJACKING",
            severity="CRITICAL",
            confidence=0.95,
            description="Outbound stratum connection to mining pool",
            evidence=["Matched stratum indicator: port 3333"],
        )
        session.add_all([anom, sec])
        await session.commit()

    response = await async_client.post(
        f"/api/v1/security/correlate/{ws_id}",
        headers=admin_headers,
    )
    assert response.status_code == 200
    incident = response.json()
    assert incident["is_threat"] is True
    assert incident["incident_category"] == "CRYPTOJACKING"
    assert incident["severity"] == "CRITICAL"
    assert incident["recommended_action"] == "SURGICAL_ISOLATION"
    assert len(incident["correlated_anomaly_ids"]) == 1
    assert len(incident["correlated_event_ids"]) == 1
