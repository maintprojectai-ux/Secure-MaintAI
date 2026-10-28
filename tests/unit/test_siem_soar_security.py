"""
Secure-MaintAI — SIEM, SOAR, and Policy Security Integration & Regression Suite.

Verifies:
1. SIEM/XDR event ingestion authentication (X-API-Key / ADMIN token requirement).
2. ADMIN-only RBAC enforcement on policy evaluation and held containment approval.
3. Workstation isolation preservation against agent heartbeat overwrite.
4. Academic port 8888 (Jupyter Lab) non-threat classification.
5. Word-boundary token matching in correlation engine (avoiding false cryptojacking on "cryptography").
6. SOAR alert and incident deduplication within cooldown window.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import TestAsyncSession
from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.security_event import SecurityEvent
from backend.models.workstation import Workstation
from backend.schemas.security_event import SecurityEventType
from backend.services.soar_service import SOARService
from security.adapters.wazuh_adapter import WazuhAdapter
from security.correlation_engine import correlation_engine
from security.policy_engine import (
    IdPIdentityContext,
    IdPWorkstationContext,
    PolicyDecisionType,
    PolicyEvaluationResult,
    policy_engine,
)


@pytest.mark.asyncio
async def test_siem_ingest_requires_authentication(async_client: AsyncClient) -> None:
    """POST /api/v1/security/events without valid API key or ADMIN auth must return 401."""
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "wazuh",
        "event_type": "SUSPICIOUS_PROCESS",
        "severity": "LOW",
        "confidence": 0.5,
        "description": "Test unauthenticated event",
    }
    # 1. No auth headers -> 401
    res_none = await async_client.post("/api/v1/security/events", json=payload)
    assert res_none.status_code == 401
    assert "Unauthorized" in res_none.json()["detail"]

    # 2. Invalid API key -> 401
    res_bad = await async_client.post(
        "/api/v1/security/events",
        json=payload,
        headers={"X-API-Key": "invalid-wrong-key"},
    )
    assert res_bad.status_code == 401

    # 3. Valid API key -> 201
    res_good = await async_client.post(
        "/api/v1/security/events",
        json=payload,
        headers={"X-API-Key": "dev-siem-ingest-key-change-in-prod"},
    )
    assert res_good.status_code == 201


@pytest.mark.asyncio
async def test_policy_evaluate_requires_admin_role(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
    student_headers: dict[str, str],
    researcher_headers: dict[str, str],
) -> None:
    """POST /api/v1/policy/evaluate/{ws} must be restricted strictly to ADMIN."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="lab-ws-101",
            ip_address="10.20.1.101",
            operating_system="Windows 11",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    # 1. Anonymous -> 401
    res_anon = await async_client.post(f"/api/v1/policy/evaluate/{ws_id}")
    assert res_anon.status_code == 401

    # 2. Student -> 403 Forbidden
    res_student = await async_client.post(f"/api/v1/policy/evaluate/{ws_id}", headers=student_headers)
    assert res_student.status_code == 403

    # 3. Researcher -> 403 Forbidden
    res_researcher = await async_client.post(f"/api/v1/policy/evaluate/{ws_id}", headers=researcher_headers)
    assert res_researcher.status_code == 403

    # 4. Admin -> 200 OK
    res_admin = await async_client.post(f"/api/v1/policy/evaluate/{ws_id}", headers=admin_headers)
    assert res_admin.status_code == 200


@pytest.mark.asyncio
async def test_alert_approve_requires_admin_role(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
    student_headers: dict[str, str],
) -> None:
    """POST /api/v1/alerts/{id}/approve must be restricted strictly to ADMIN."""
    alert_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        alert = Alert(
            id=alert_id,
            source_type="HUMAN_INTERVENTION_REQUIRED",
            severity="HIGH",
            status="OPEN",
            title="Held Containment Action",
            description="Exceeded automated boundaries",
            requires_human_intervention=True,
            playbook_initiated="PLAYBOOK_03_SURGICAL_ISOLATION",
        )
        session.add(alert)
        await session.commit()

    # 1. Student -> 403 Forbidden
    res_student = await async_client.post(f"/api/v1/alerts/{alert_id}/approve", headers=student_headers)
    assert res_student.status_code == 403

    # 2. Admin -> 200 OK
    res_admin = await async_client.post(f"/api/v1/alerts/{alert_id}/approve", headers=admin_headers)
    assert res_admin.status_code == 200
    assert res_admin.json()["requires_human_intervention"] is False


@pytest.mark.asyncio
async def test_agent_heartbeat_preserves_isolated_status(async_client: AsyncClient) -> None:
    """Agent heartbeats must never overwrite an active ISOLATED state to ONLINE."""
    ws_id = uuid.uuid4()
    agent_id = uuid.uuid4()

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            agent_id=agent_id,
            hostname="isolated-endpoint",
            ip_address="10.20.1.55",
            operating_system="Linux",
            status="ISOLATED",
        )
        session.add(ws)
        await session.commit()

    # Agent reports periodic ping with nominal status="ONLINE"
    hb_payload = {
        "agent_id": str(agent_id),
        "status": "ONLINE",
        "agent_version": "1.0.0",
        "metrics_summary": {"cpu_percent": 15.0, "memory_percent": 30.0},
    }
    res = await async_client.post("/api/v1/agents/heartbeat", json=hb_payload)
    assert res.status_code == 200

    # Verify status in DB remains ISOLATED
    async with TestAsyncSession() as session:
        ws_updated = await session.get(Workstation, ws_id)
        assert ws_updated is not None
        assert ws_updated.status == "ISOLATED"


def test_wazuh_adapter_jupyter_port_8888_is_not_cryptojacking() -> None:
    """Port 8888 (Jupyter Lab) without mining indicators must not be flagged as cryptojacking."""
    adapter = WazuhAdapter()
    jupyter_raw = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "rule": {"id": "100200", "level": 4, "description": "Sysmon - Network connection detected"},
        "data": {
            "win": {
                "system": {"eventID": 3},
                "eventdata": {
                    "image": "C:\\Python311\\python.exe",
                    "commandLine": "python.exe -m jupyterlab --ip=0.0.0.0 --port=8888",
                    "destinationPort": 8888,
                },
            }
        },
    }
    parsed = adapter.parse_event(jupyter_raw)
    assert parsed is not None
    # Must NOT be cryptojacking
    assert parsed.event_type != SecurityEventType.CRYPTOJACKING
    assert parsed.event_type == SecurityEventType.NETWORK_ANOMALY


def test_correlation_engine_word_boundary_avoids_false_cryptojacking() -> None:
    """Security events mentioning 'cryptography library' must not trigger cryptojacking correlation."""
    ws_id = uuid.uuid4()
    benign_sec = SecurityEvent(
        timestamp=datetime.now(timezone.utc),
        source="wazuh",
        workstation_id=ws_id,
        event_type="PACKAGE_INSTALL",
        severity="LOW",
        confidence=0.5,
        description="Installed python cryptography library for HTTPS service",
        evidence=["pip install cryptography"],
    )
    incident = correlation_engine.correlate_workstation(
        workstation_id=ws_id,
        anomalies=[],
        security_events=[benign_sec],
        workstation_name="research-node-01",
    )
    assert incident.is_threat is False
    assert incident.incident_category != "CRYPTOJACKING"


@pytest.mark.asyncio
async def test_soar_alert_deduplication_within_cooldown() -> None:
    """SOAR engine must deduplicate identical active alerts for the same host within cooldown."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="dedup-node-01",
            ip_address="10.20.1.77",
            operating_system="Linux",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    async with TestAsyncSession() as session:
        soar = SOARService(session)
        eval_res = PolicyEvaluationResult(
            workstation_id=ws_id,
            user_context=IdPIdentityContext(
                user_id="s-1", username="student1", email="s1@kku.edu.sa", role="STUDENT", department="CS"
            ),
            workstation_context=IdPWorkstationContext(workstation_id=ws_id, hostname="dedup-node-01", department="CS"),
            correlated_incident=correlation_engine.correlate_workstation(
                workstation_id=ws_id,
                anomalies=[
                    AnomalyDetection(
                        workstation_id=ws_id,
                        anomaly_type="TECHNICAL_ANOMALY",
                        score=0.90,
                        confidence=0.90,
                        model_name="m1",
                        model_version="1",
                    )
                ],
                security_events=[
                    SecurityEvent(
                        workstation_id=ws_id,
                        event_type="CRYPTOJACKING",
                        severity="CRITICAL",
                        confidence=0.95,
                        description="Mining pool connection to port 3333",
                        evidence=["Matched stratum indicator: port 3333"],
                    )
                ],
                workstation_name="dedup-node-01",
            ),
            decision=PolicyDecisionType.SURGICAL_NETWORK_ISOLATION,
            playbook_to_execute="PLAYBOOK_03_SURGICAL_ISOLATION",
            reason="Cryptojacking detected on student desktop.",
        )

        # 1. First execution creates incident and alert
        res_1 = await soar.execute_policy_decision(eval_res)
        await session.commit()
        assert res_1.incident_id is not None
        assert res_1.alert_id is not None

        # 2. Second execution within cooldown reuses the existing incident and alert
        res_2 = await soar.execute_policy_decision(eval_res)
        await session.commit()
        assert res_2.incident_id == res_1.incident_id
        assert res_2.alert_id == res_1.alert_id
