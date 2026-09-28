"""
End-to-End Regression Test Suite — Mandatory Verification Scenarios (Rule 29).

This suite validates the complete 7-stage architectural resilience lifecycle:
Telemetry ──> ML Screening ──> Security Correlation ──> IdP Context ──> Policy Engine ──> SOAR Response ──> Audit

Mandatory Scenarios:
- Scenario 1: Legitimate high CPU -> technical anomaly -> maintenance response.
- Scenario 2: Cryptojacking -> security anomaly -> SIEM/XDR -> role lookup -> SOAR -> containment.
- Scenario 3: Legitimate research workload -> high CPU -> Researcher context -> no destructive containment.
- Scenario 4: Unauthorized activity -> security event -> incident -> response.
- Scenario 5: IdP unavailable -> safe fallback.
- Scenario 6: Agent offline -> offline alert.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.incident import Incident
from backend.models.security_event import SecurityEvent
from backend.models.workstation import Workstation
from backend.schemas.idp import (
    AuthorizedWorkload,
    IdPIdentityContext,
    IdPWorkstationContext,
    WorkloadType,
)
from backend.services.idp_service import idp_service
from security.policy_engine import policy_engine
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_scenario_1_technical_fault_maintenance_response(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 1: Legitimate high CPU / Memory fault -> technical anomaly -> maintenance response.
    No security containment is triggered; a maintenance advisory is generated.
    """
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="lab-server-12",
            ip_address="10.10.1.12",
            operating_system="Ubuntu 22.04",
            department="Engineering",
            lab="Fluid Mechanics Lab",
            status="ONLINE",
        )
        session.add(ws)

        # 1. Ingest technical anomaly from ML runtime
        anom = AnomalyDetection(
            workstation_id=ws_id,
            timestamp=datetime.now(timezone.utc),
            anomaly_type="TECHNICAL_ANOMALY",
            score=0.91,
            confidence=0.88,
            model_name="model_01_isolation_forest",
            model_version="1.0.0",
            evidence=["High memory bus latency (98.2%)", "Model 02-A classified memory thrashing"],
            status="DETECTED",
        )
        session.add(anom)
        await session.commit()

    # 2. Trigger policy evaluation
    response = await async_client.post(
        f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    evaluation = data["evaluation"]
    execution = data["playbook_execution"]

    # Verify technical maintenance decision & execution
    assert evaluation["decision"] == "SCHEDULE_MAINTENANCE"
    assert evaluation["playbook_to_execute"] == "PLAYBOOK_04_MAINTENANCE"
    assert execution["status"] == "SUCCESS"
    assert execution["playbook_name"] == "PLAYBOOK_04_MAINTENANCE"

    # Workstation must remain ONLINE without containment
    async with TestAsyncSession() as session:
        ws_check = await session.get(Workstation, ws_id)
        assert ws_check.status == "ONLINE"

        # Verify Maintenance Incident created
        inc_res = await session.execute(
            select(Incident).where(Incident.workstation_id == ws_id)
        )
        inc = inc_res.scalar_one_or_none()
        assert inc is not None
        assert inc.category == "MAINTENANCE"


@pytest.mark.asyncio
async def test_scenario_2_cryptojacking_student_containment(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 2: Cryptojacking -> security anomaly -> SIEM/XDR -> role lookup -> SOAR -> containment.
    Student workstation infected with miner is surgically network-isolated.
    """
    ws_id = uuid.uuid4()
    student_user_id = str(uuid.uuid4())

    # Register student context in IdP
    idp_service.register_mock_user(
        IdPIdentityContext(
            user_id=student_user_id,
            username="student_attacker",
            email="student_attacker@kku.edu.sa",
            role="STUDENT",
            department="Computer Science",
            lab="Undergrad Lab 1",
        )
    )

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="undergrad-pc-04",
            ip_address="10.20.1.4",
            operating_system="Windows 11",
            department="Computer Science",
            lab="Undergrad Lab 1",
            status="ONLINE",
        )
        session.add(ws)

        # ML Anomaly: High CPU Spike
        anom = AnomalyDetection(
            workstation_id=ws_id,
            timestamp=datetime.now(timezone.utc),
            anomaly_type="SECURITY_ANOMALY",
            score=0.99,
            confidence=0.96,
            model_name="model_01_isolation_forest",
            model_version="1.0.0",
            evidence=["High CPU utilization (100.0%)"],
            status="DETECTED",
        )
        # SIEM / Network Security Event: Stratum Port 3333
        sec = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            source="network-monitor",
            workstation_id=ws_id,
            event_type="CRYPTOJACKING",
            severity="CRITICAL",
            confidence=0.98,
            description="Outbound stratum connection to monero mining pool",
            evidence=["Destination port: 3333", "Binary: C:\\Temp\\xmrig.exe"],
        )
        session.add_all([anom, sec])
        await session.commit()

    # Trigger policy evaluation with student user override
    response = await async_client.post(
        f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true&user_id_override={student_user_id}",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    evaluation = data["evaluation"]
    execution = data["playbook_execution"]

    # Verify surgical network isolation
    assert evaluation["decision"] == "SURGICAL_NETWORK_ISOLATION"
    assert evaluation["playbook_to_execute"] == "PLAYBOOK_03_SURGICAL_ISOLATION"
    assert execution["status"] == "SUCCESS"
    assert execution["playbook_name"] == "PLAYBOOK_03_SURGICAL_ISOLATION"

    # Workstation must now be ISOLATED
    async with TestAsyncSession() as session:
        ws_check = await session.get(Workstation, ws_id)
        assert ws_check.status == "ISOLATED"

        # Verify Security Incident created in CONTAINED state
        inc_res = await session.execute(
            select(Incident).where(Incident.workstation_id == ws_id)
        )
        inc = inc_res.scalar_one_or_none()
        assert inc is not None
        assert inc.category == "SECURITY_THREAT"
        assert inc.status == "CONTAINED"


@pytest.mark.asyncio
async def test_scenario_3_legitimate_research_workload_no_destructive_containment(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 3: Legitimate research workload -> high CPU -> Researcher context -> no destructive containment.
    Preserves active simulation jobs without interrupting research compute.
    """
    ws_id = uuid.uuid4()
    researcher_user_id = str(uuid.uuid4())

    # Register active HPC job
    hpc_workload = AuthorizedWorkload(
        job_id="QUANTUM-SIM-772",
        workload_type=WorkloadType.HPC_SIMULATION,
        description="Quantum Lattice Simulation",
        workstation_id=ws_id,
        is_active=True,
    )
    idp_service.register_workload(hpc_workload)

    # Register Researcher profile
    idp_service.register_mock_user(
        IdPIdentityContext(
            user_id=researcher_user_id,
            username="prof_albert",
            email="albert@kku.edu.sa",
            role="RESEARCHER",
            department="Physics",
            lab="Quantum Computing Lab",
            active_workloads=[hpc_workload],
        )
    )

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="quantum-node-01",
            ip_address="10.30.1.1",
            operating_system="Ubuntu 22.04",
            department="Physics",
            lab="Quantum Computing Lab",
            status="ONLINE",
        )
        session.add(ws)

        # ML Anomaly: High CPU (99%) from heavy simulation
        anom = AnomalyDetection(
            workstation_id=ws_id,
            timestamp=datetime.now(timezone.utc),
            anomaly_type="TECHNICAL_ANOMALY",
            score=0.96,
            confidence=0.90,
            model_name="model_01_isolation_forest",
            model_version="1.0.0",
            evidence=["Sustained compute spike across all 64 cores"],
            status="DETECTED",
        )
        session.add(anom)
        await session.commit()

    # Trigger policy evaluation
    response = await async_client.post(
        f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true&user_id_override={researcher_user_id}",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    evaluation = data["evaluation"]
    execution = data["playbook_execution"]

    # Verify that research compute is explicitly ALLOWED without destructive containment
    assert evaluation["decision"] == "ALLOW_LEGITIMATE_RESEARCH"
    assert "QUANTUM-SIM-772" in evaluation["preserve_workloads"]
    assert execution["status"] == "SUCCESS"

    # Workstation remains ONLINE
    async with TestAsyncSession() as session:
        ws_check = await session.get(Workstation, ws_id)
        assert ws_check.status == "ONLINE"


@pytest.mark.asyncio
async def test_scenario_4_unauthorized_activity_incident_response(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 4: Unauthorized activity (LSASS dumping / APT) -> security event -> incident -> response.
    """
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="admin-jumphost-01",
            ip_address="10.50.1.1",
            operating_system="Windows Server 2022",
            department="IT",
            lab="DataCenter",
            status="ONLINE",
        )
        session.add(ws)

        sec = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            source="wazuh",
            workstation_id=ws_id,
            event_type="PRIVILEGE_ESCALATION",
            severity="CRITICAL",
            confidence=0.99,
            description="Sysmon EventID 10: LSASS memory access by unauthorized binary",
            evidence=["SourceImage: C:\\Temp\\mimikatz.exe", "TargetImage: C:\\Windows\\System32\\lsass.exe"],
        )
        session.add(sec)
        await session.commit()

    response = await async_client.post(
        f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    evaluation = data["evaluation"]
    execution = data["playbook_execution"]

    assert evaluation["decision"] == "SURGICAL_NETWORK_ISOLATION"
    assert execution["playbook_name"] == "PLAYBOOK_03_SURGICAL_ISOLATION"
    assert execution["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_scenario_5_idp_unavailable_safe_fallback(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 5: IdP unavailable -> safe fail-soft fallback.
    High-risk containment actions require human SOC approval when IdP context is missing.
    """
    idp_service.set_outage_mode(True)
    ws_id = uuid.uuid4()

    try:
        async with TestAsyncSession() as session:
            ws = Workstation(
                id=ws_id,
                hostname="mystery-node-55",
                ip_address="10.99.1.55",
                operating_system="Linux",
                status="ONLINE",
            )
            session.add(ws)

            sec = SecurityEvent(
                timestamp=datetime.now(timezone.utc),
                source="network-monitor",
                workstation_id=ws_id,
                event_type="UNAUTHORIZED_ACCESS",
                severity="HIGH",
                confidence=0.82,
                description="Suspicious port scanning activity",
            )
            session.add(sec)
            await session.commit()

        response = await async_client.post(
            f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        evaluation = data["evaluation"]

        # Safe fallback: requires human approval instead of executing destructive unverified containment
        assert evaluation["decision"] == "REQUIRE_HUMAN_APPROVAL"
        assert evaluation["requires_human_approval"] is True
        assert evaluation["user_context"]["is_fallback"] is True
    finally:
        idp_service.set_outage_mode(False)


@pytest.mark.asyncio
async def test_scenario_6_agent_offline_alert(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 6: Agent offline -> liveness check transitions status and generates offline alert.
    """
    ws_id = uuid.uuid4()
    old_time = datetime.now(timezone.utc) - timedelta(seconds=300)

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="silent-agent-pc",
            ip_address="10.88.1.88",
            operating_system="Windows 10",
            status="ONLINE",
            last_seen_at=old_time,
        )
        session.add(ws)
        await session.commit()

    # Trigger liveness check
    response = await async_client.post(
        "/api/v1/agents/check-liveness?threshold_seconds=120",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["offline_count"] >= 1
    assert "silent-agent-pc" in data["affected_workstations"]

    # Verify workstation is now OFFLINE and Alert created
    async with TestAsyncSession() as session:
        ws_check = await session.get(Workstation, ws_id)
        assert ws_check.status == "OFFLINE"

        alert_res = await session.execute(
            select(Alert).where(Alert.source_id == ws_id)
        )
        alert = alert_res.scalar_one_or_none()
        assert alert is not None
        assert alert.source_type == "AGENT_HEALTH"
        assert "silent-agent-pc" in alert.title
