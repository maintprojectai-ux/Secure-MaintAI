"""
Integration Tests — Incidents, Alerts, and Policy Evaluation APIs.

Tests:
- Incidents listing, retrieval, status lifecycle transitions.
- Alerts listing, manual creation, acknowledgement, and resolution.
- End-to-end policy evaluation triggering SOAR execution on an infected workstation.
- Toggling emergency kill switch (Admin RBAC required).
- Rolling back surgical isolation.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.incident import Incident
from backend.models.security_event import SecurityEvent
from backend.models.workstation import Workstation
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_incidents_lifecycle_api(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Test incident creation, querying, and status progression via REST API."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="incident-target-01",
            ip_address="10.5.5.1",
            operating_system="Windows 11",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    # 1. Create incident manually
    payload = {
        "severity": "HIGH",
        "category": "SECURITY_THREAT",
        "workstation_id": str(ws_id),
        "title": "Suspicious PowerShell Ingestion",
        "description": "Obfuscated script executed from %TEMP%",
        "response_action": "Quarantine file",
    }
    create_res = await async_client.post(
        "/api/v1/incidents",
        json=payload,
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    inc_data = create_res.json()
    assert inc_data["status"] == "OPEN"
    incident_id = inc_data["id"]

    # 2. Query incidents list
    list_res = await async_client.get(
        f"/api/v1/incidents?workstation_id={ws_id}&severity=HIGH",
        headers=admin_headers,
    )
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert items[0]["id"] == incident_id

    # 3. Update status to INVESTIGATING
    patch_res = await async_client.patch(
        f"/api/v1/incidents/{incident_id}/status?new_status=INVESTIGATING",
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "INVESTIGATING"

    # 4. Resolve incident
    resolve_res = await async_client.patch(
        f"/api/v1/incidents/{incident_id}/status?new_status=RESOLVED",
        headers=admin_headers,
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"
    assert resolve_res.json()["resolved_at"] is not None


@pytest.mark.asyncio
async def test_alerts_lifecycle_api(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Test alert creation, querying, acknowledgement, and resolution."""
    # 1. Create alert
    payload = {
        "source_type": "SECURITY_EVENT",
        "severity": "CRITICAL",
        "title": "Ransomware Canary Triggered",
        "description": "Honeytoken file modified in shared drive",
    }
    create_res = await async_client.post(
        "/api/v1/alerts",
        json=payload,
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    alert_id = create_res.json()["id"]

    # 2. Acknowledge alert
    ack_res = await async_client.patch(
        f"/api/v1/alerts/{alert_id}/acknowledge",
        headers=admin_headers,
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"
    assert ack_res.json()["acknowledged_at"] is not None

    # 3. Resolve alert
    res_res = await async_client.patch(
        f"/api/v1/alerts/{alert_id}/resolve",
        headers=admin_headers,
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"
    assert res_res.json()["resolved_at"] is not None


@pytest.mark.asyncio
async def test_evaluate_policy_endpoint_executes_soar(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """POST /api/v1/policy/evaluate/{workstation_id} correlates, evaluates policy, and runs SOAR."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="student-node-99",
            ip_address="10.8.8.8",
            operating_system="Windows 11",
            status="ONLINE",
        )
        session.add(ws)

        anom = AnomalyDetection(
            workstation_id=ws_id,
            timestamp=datetime.now(timezone.utc),
            anomaly_type="SECURITY_ANOMALY",
            score=0.98,
            confidence=0.95,
            model_name="model_01_isolation_forest",
            model_version="1.0.0",
            evidence=["High CPU spike"],
            status="DETECTED",
        )
        sec = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            source="network-monitor",
            workstation_id=ws_id,
            event_type="CRYPTOJACKING",
            severity="CRITICAL",
            confidence=0.97,
            description="Outbound stratum connection to mining pool",
            evidence=["Matched stratum indicator: port 3333"],
        )
        session.add_all([anom, sec])
        await session.commit()

    # Trigger policy evaluation with auto_execute=True
    response = await async_client.post(
        f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    evaluation = data["evaluation"]
    execution = data["playbook_execution"]

    assert evaluation["decision"] == "SURGICAL_NETWORK_ISOLATION"
    assert evaluation["playbook_to_execute"] == "PLAYBOOK_03_SURGICAL_ISOLATION"
    assert execution is not None
    assert execution["status"] == "SUCCESS"
    assert execution["playbook_name"] == "PLAYBOOK_03_SURGICAL_ISOLATION"

    # Workstation should now be in ISOLATED state
    async with TestAsyncSession() as session:
        ws = await session.get(Workstation, ws_id)
        assert ws.status == "ISOLATED"

    # Rollback surgical isolation
    rollback_res = await async_client.post(
        f"/api/v1/policy/rollback-isolation/{ws_id}",
        headers=admin_headers,
    )
    assert rollback_res.status_code == 200

    # Workstation should be back ONLINE
    async with TestAsyncSession() as session:
        ws = await session.get(Workstation, ws_id)
        assert ws.status == "ONLINE"


@pytest.mark.asyncio
async def test_kill_switch_api_toggle(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """POST /api/v1/policy/kill-switch allows Admin to toggle the kill switch."""
    # Activate kill switch
    res1 = await async_client.post(
        "/api/v1/policy/kill-switch",
        json={"active": True, "reason": "Scheduled SOC maintenance window"},
        headers=admin_headers,
    )
    assert res1.status_code == 200
    assert res1.json()["kill_switch_active"] is True

    # Deactivate kill switch
    res2 = await async_client.post(
        "/api/v1/policy/kill-switch",
        json={"active": False, "reason": "Maintenance window complete"},
        headers=admin_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["kill_switch_active"] is False
