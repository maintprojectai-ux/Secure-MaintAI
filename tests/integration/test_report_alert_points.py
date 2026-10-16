"""
Integration Tests — Four-Point Alert Generation Pipeline.

Verifies end-to-end alert creation and lifecycle for all four report trigger points:
1. Technical Anomaly: Hardware saturation / telemetry ML produces TECHNICAL_ANOMALY alert.
2. Cybersecurity Threat: SIEM/XDR event produces CYBERSECURITY_THREAT alert and triggers SOAR.
3. Predictive Maintenance: Equipment degradation / Playbook 04 produces PREDICTIVE_MAINTENANCE alert with AI recommendation.
4. Human Intervention Required: Events exceeding autonomous AI parameters produce HUMAN_INTERVENTION_REQUIRED alert,
   which is resolved via the POST /api/v1/alerts/{id}/approve authorization flow with audit logging.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from backend.models.audit import AuditLog
from backend.models.workstation import Workstation
from backend.schemas.idp import IdPIdentityContext, IdPWorkstationContext
from backend.services.soar_service import SOARService
from security.correlation_engine import CorrelatedIncident
from security.policy_engine import PolicyDecisionType, PolicyEvaluationResult
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_point_1_technical_anomaly_alert(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Point 1: Telemetry with abnormal system metrics (CPU/RAM/load) is evaluated by ML
    anomaly detection and automatically generates a TECHNICAL_ANOMALY alert with recommendations.
    """
    ws_id = uuid.uuid4()
    agent_id = uuid.uuid4()

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="lab-ws-tech-anomaly-01",
            ip_address="10.10.1.50",
            operating_system="Ubuntu 22.04 LTS",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    # Ingest severe hardware stress telemetry (96% CPU, 95% RAM, high IO & processes)
    telemetry_payload = {
        "agent_id": str(agent_id),
        "workstation_id": str(ws_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "schema_version": "1.0",
        "cpu": {"usage_percent": 96.0},
        "memory": {"usage_percent": 95.0},
        "disk": {"read_bytes_per_sec": 60_000_000.0, "write_bytes_per_sec": 20_000_000.0},
        "network": {"bytes_in_per_sec": 500_000.0, "bytes_out_per_sec": 250_000.0},
        "process_count": 180,
    }

    ingest_res = await async_client.post("/api/v1/telemetry", json=telemetry_payload)
    assert ingest_res.status_code in (200, 201)
    assert ingest_res.json()["status"] == "success"

    # Query alerts for this workstation
    alerts_res = await async_client.get(
        f"/api/v1/alerts?workstation_id={ws_id}&source_type=TECHNICAL_ANOMALY",
        headers=admin_headers,
    )
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1

    alert = alerts[0]
    assert alert["source_type"] == "TECHNICAL_ANOMALY"
    assert alert["severity"] in ("HIGH", "CRITICAL")
    assert alert["status"] == "OPEN"
    assert alert["requires_human_intervention"] is False
    assert alert["recommendation"] is not None
    assert "hardware" in alert["recommendation"].lower() or "processes" in alert["recommendation"].lower()


@pytest.mark.asyncio
async def test_point_2_cybersecurity_threat_alert_and_soar(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Point 2: SIEM/XDR high-severity security telemetry creates a CYBERSECURITY_THREAT alert
    and initiates the relevant SOAR response workflow.
    """
    ws_id = uuid.uuid4()

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="lab-ws-cyber-target-02",
            ip_address="10.10.2.75",
            operating_system="Windows 11 Enterprise",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    # Ingest HIGH severity SIEM event
    siem_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "wazuh-agent",
        "workstation_id": str(ws_id),
        "user_id": str(uuid.uuid4()),
        "event_type": "UNAUTHORIZED_ACCESS",
        "severity": "HIGH",
        "confidence": 0.94,
        "description": "Repetitive failed SSH logins followed by privilege escalation attempt.",
        "evidence": ["Failed password for root", "sudo token acquired without prompt"],
        "correlation_id": str(uuid.uuid4()),
    }

    siem_res = await async_client.post(
        "/api/v1/security/events",
        json=siem_payload,
        headers=admin_headers,
    )
    assert siem_res.status_code == 201

    # Verify CYBERSECURITY_THREAT alert generated
    alerts_res = await async_client.get(
        f"/api/v1/alerts?workstation_id={ws_id}&source_type=CYBERSECURITY_THREAT",
        headers=admin_headers,
    )
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1

    alert = alerts[0]
    assert alert["source_type"] == "CYBERSECURITY_THREAT"
    assert alert["severity"] == "HIGH"
    assert alert["recommendation"] is not None


@pytest.mark.asyncio
async def test_point_3_predictive_maintenance_alert_and_recommendation(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Point 3: Equipment degradation triggers Playbook 04 Maintenance, generating a
    PREDICTIVE_MAINTENANCE alert with AI operational recommendations.
    """
    ws_id = uuid.uuid4()

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="lab-server-maint-03",
            ip_address="10.10.3.10",
            operating_system="Ubuntu 22.04 LTS",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    eval_res = PolicyEvaluationResult(
        workstation_id=ws_id,
        user_context=IdPIdentityContext(
            user_id="u-operator",
            username="it_operator",
            email="operator@kku.edu.sa",
            role="IT_OPERATOR",
            department="Infrastructure",
        ),
        workstation_context=IdPWorkstationContext(
            workstation_id=ws_id,
            hostname="lab-server-maint-03",
            department="Infrastructure",
        ),
        correlated_incident=CorrelatedIncident(
            workstation_id=ws_id,
            incident_category="HARDWARE_DEGRADATION",
            is_threat=False,
            severity="MEDIUM",
            confidence=0.88,
            recommended_action="SCHEDULE_MAINTENANCE",
            reason="Thermal throttling and disk sector reallocations indicate impending hardware degradation.",
        ),
        decision=PolicyDecisionType.SCHEDULE_MAINTENANCE,
        playbook_to_execute="PLAYBOOK_04_MAINTENANCE",
        reason="Predictive maintenance window required for hardware servicing.",
    )

    async with TestAsyncSession() as session:
        soar = SOARService(session)
        receipt = await soar.execute_policy_decision(eval_res, operator="test:maintenance-engine")
        assert receipt.status == "SUCCESS"
        assert receipt.alert_id is not None
        maint_alert_id = receipt.alert_id

    # Verify alert via REST API
    alert_res = await async_client.get(
        f"/api/v1/alerts/{maint_alert_id}",
        headers=admin_headers,
    )
    assert alert_res.status_code == 200
    alert_data = alert_res.json()
    assert alert_data["source_type"] == "PREDICTIVE_MAINTENANCE"
    assert alert_data["playbook_initiated"] == "PLAYBOOK_04_MAINTENANCE"
    assert alert_data["requires_human_intervention"] is False
    assert alert_data["recommendation"] is not None
    assert "maintenance" in alert_data["recommendation"].lower() or "thermal" in alert_data["recommendation"].lower()


@pytest.mark.asyncio
async def test_point_4_human_intervention_required_and_approval(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Point 4: Critical events exceeding autonomous AI parameters (e.g. kill switch active,
    protected researcher workloads requiring approval) generate a HUMAN_INTERVENTION_REQUIRED alert,
    which is then reviewed and authorized via POST /api/v1/alerts/{id}/approve.
    """
    ws_id = uuid.uuid4()

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="research-cluster-node-04",
            ip_address="10.10.4.99",
            operating_system="Red Hat Enterprise Linux 9",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    # Policy evaluation that requires human operator approval
    eval_res = PolicyEvaluationResult(
        workstation_id=ws_id,
        user_context=IdPIdentityContext(
            user_id="u-researcher",
            username="dr_ahmed",
            email="ahmed@kku.edu.sa",
            role="RESEARCHER",
            department="AI Research Lab",
        ),
        workstation_context=IdPWorkstationContext(
            workstation_id=ws_id,
            hostname="research-cluster-node-04",
            department="AI Research Lab",
        ),
        correlated_incident=CorrelatedIncident(
            workstation_id=ws_id,
            incident_category="AMBIGUOUS_COMPUTE_ANOMALY",
            is_threat=True,
            severity="CRITICAL",
            confidence=0.72,
            recommended_action="REQUIRE_HUMAN_APPROVAL",
            reason="High-compute anomaly on active researcher workload requires human authorization to avoid disruptive kill.",
        ),
        decision=PolicyDecisionType.REQUIRE_HUMAN_APPROVAL,
        playbook_to_execute="PLAYBOOK_01_ALERT_ONLY",
        reason="Autonomous action suppressed: human intervention required for researcher node.",
        requires_human_approval=True,
    )

    async with TestAsyncSession() as session:
        soar = SOARService(session)
        receipt = await soar.execute_policy_decision(eval_res, operator="policy-engine:autonomous-boundary")
        assert receipt.status == "SUCCESS"
        assert receipt.alert_id is not None
        human_alert_id = receipt.alert_id

    # 1. Verify alert listed with requires_human_intervention=true filter
    filter_res = await async_client.get(
        "/api/v1/alerts?requires_human_intervention=true",
        headers=admin_headers,
    )
    assert filter_res.status_code == 200
    matched_alerts = [a for a in filter_res.json() if a["id"] == str(human_alert_id)]
    assert len(matched_alerts) == 1

    alert_item = matched_alerts[0]
    assert alert_item["source_type"] == "HUMAN_INTERVENTION_REQUIRED"
    assert alert_item["requires_human_intervention"] is True
    assert alert_item["status"] == "OPEN"

    # 2. Authorize action via approval endpoint
    approve_res = await async_client.post(
        f"/api/v1/alerts/{human_alert_id}/approve",
        json={"notes": "Authorized by Lead SOC Analyst after verifying researcher process tree."},
        headers=admin_headers,
    )
    assert approve_res.status_code == 200
    approved_data = approve_res.json()
    assert approved_data["status"] in ("ACKNOWLEDGED", "CONTAINED")
    assert approved_data["acknowledged_at"] is not None

    # 3. Verify audit log entry was written
    async with TestAsyncSession() as session:
        audit_res = await session.execute(
            select(AuditLog).where(
                AuditLog.action == "alert.human_intervention.approve",
                AuditLog.resource == f"alert:{human_alert_id}",
            )
        )
        audit_entry = audit_res.scalar_one_or_none()
        assert audit_entry is not None
        assert audit_entry.result == "success"
