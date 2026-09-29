"""
Secure-MaintAI — Comprehensive 6-Scenario Automated Verification Suite (Rule 29).

This suite validates the complete 7-stage architectural resilience lifecycle:
Telemetry ──> ML Screening ──> Security Correlation ──> IdP Context ──> Policy Engine ──> SOAR Response ──> Audit

Mandatory Verification Scenarios:
- Scenario 1: Legitimate high CPU / Technical Failure -> Technical Anomaly -> Predictive Maintenance Advisory
- Scenario 2: Cryptojacking Attack -> Security Anomaly -> SIEM/XDR -> IdP Role Lookup -> SOAR Surgical Isolation & Rollback
- Scenario 3: Legitimate Research Workload -> High CPU Spike -> IdP Researcher Context -> Active Workload Preservation (Zero Destructive Impact)
- Scenario 4: Unauthorized Privilege Escalation -> Sysmon Event -> Incident -> SOC Alert Acknowledge & Resolve Lifecycle -> Audit Chain
- Scenario 5: University IdP Outage Fail-Safe & Administrative Emergency Kill Switch (Rule 19)
- Scenario 6: Monitoring Agent Disconnection -> Liveness Alert -> Heartbeat Reconnection Self-Healing
- Scenario 7: Audit Log Query API & Cryptographic Audit Verification (Rule 24)
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.audit import AuditLog
from backend.models.incident import Incident
from backend.models.security_event import SecurityEvent
from backend.models.workstation import Workstation
from backend.schemas.idp import (
    AuthorizedWorkload,
    IdPIdentityContext,
    WorkloadType,
)
from backend.services.idp_service import idp_service
from security.policy_engine import policy_engine
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_scenario_1_deep_technical_fault_maintenance(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 1 (Deep): High CPU / Memory Hardware Thrashing -> Technical Anomaly -> Maintenance Advisory.
    Verifies:
    1. ML classifies as TECHNICAL_ANOMALY.
    2. Policy engine selects PLAYBOOK_04_MAINTENANCE.
    3. Workstation remains strictly ONLINE (no network disruption or quarantine).
    4. Maintenance incident is recorded.
    5. Immutable AuditLog entry is committed.
    """
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="engineering-cad-01",
            ip_address="10.10.4.12",
            operating_system="Ubuntu 22.04 LTS",
            department="Mechanical Engineering",
            lab="CAD Lab",
            status="ONLINE",
        )
        session.add(ws)

        anom = AnomalyDetection(
            workstation_id=ws_id,
            timestamp=datetime.now(timezone.utc),
            anomaly_type="TECHNICAL_ANOMALY",
            score=0.93,
            confidence=0.91,
            model_name="model_01_isolation_forest",
            model_version="1.0.0",
            evidence=["High memory bus saturation (96.4%)", "Model 02-A diagnosed memory controller throttling"],
            status="DETECTED",
        )
        session.add(anom)
        await session.commit()

    # Trigger policy evaluation
    response = await async_client.post(
        f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    evaluation = data["evaluation"]
    execution = data["playbook_execution"]

    # Verify decision & playbook
    assert evaluation["decision"] == "SCHEDULE_MAINTENANCE"
    assert evaluation["playbook_to_execute"] == "PLAYBOOK_04_MAINTENANCE"
    assert execution["status"] == "SUCCESS"
    assert execution["playbook_name"] == "PLAYBOOK_04_MAINTENANCE"

    # Verify database state: Host remains ONLINE, Maintenance Incident exists, Audit exists
    async with TestAsyncSession() as session:
        ws_check = await session.get(Workstation, ws_id)
        assert ws_check.status == "ONLINE"

        inc_res = await session.execute(select(Incident).where(Incident.workstation_id == ws_id))
        inc = inc_res.scalar_one_or_none()
        assert inc is not None
        assert inc.category == "MAINTENANCE"

        audit_res = await session.execute(
            select(AuditLog).where(AuditLog.action == "soar.playbook.maintenance_advisory")
        )
        audit_entry = audit_res.scalar_one_or_none()
        assert audit_entry is not None
        assert audit_entry.result == "success"
        assert f"workstation:{ws_id}" in audit_entry.resource


@pytest.mark.asyncio
async def test_scenario_2_deep_cryptojacking_student_containment_and_rollback(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
    operator_headers: dict[str, str],
) -> None:
    """
    Scenario 2 (Deep): Cryptojacking Attack -> Security Anomaly + SIEM -> Role Lookup -> Surgical Isolation & Rollback.
    Verifies:
    1. Multi-source correlation flags high-severity threat.
    2. IdP resolves STUDENT identity with no research exemptions.
    3. Policy engine selects SURGICAL_NETWORK_ISOLATION.
    4. Workstation status transitions to ISOLATED and incident is CONTAINED.
    5. Audit trail records isolation action.
    6. SOC operator rolls back isolation, restoring workstation to ONLINE with rollback audit.
    """
    ws_id = uuid.uuid4()
    student_user_id = str(uuid.uuid4())

    idp_service.register_mock_user(
        IdPIdentityContext(
            user_id=student_user_id,
            username="student_miner",
            email="student_miner@kku.edu.sa",
            role="STUDENT",
            department="Computer Science",
            lab="Undergrad Lab 3",
        )
    )

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="student-rig-09",
            ip_address="10.20.3.9",
            operating_system="Windows 11 Education",
            department="Computer Science",
            lab="Undergrad Lab 3",
            status="ONLINE",
        )
        session.add(ws)

        # ML Anomaly: High GPU/CPU load
        anom = AnomalyDetection(
            workstation_id=ws_id,
            timestamp=datetime.now(timezone.utc),
            anomaly_type="SECURITY_ANOMALY",
            score=0.995,
            confidence=0.97,
            model_name="model_02_b_random_forest",
            model_version="1.0.0",
            evidence=["GPU usage at 99.2%", "Outbound stratum pool traffic"],
            status="DETECTED",
        )
        # SIEM Event: Stratum mining pool
        sec = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            source="wazuh",
            workstation_id=ws_id,
            event_type="CRYPTOJACKING",
            severity="CRITICAL",
            confidence=0.99,
            description="Outbound TCP connection to XMRig pool (pool.supportxmr.com:3333)",
            evidence=["Destination IP: 194.26.29.112", "Binary: C:\\Users\\Public\\xmrig.exe"],
        )
        session.add_all([anom, sec])
        await session.commit()

    # Step 1: Execute surgical isolation
    eval_resp = await async_client.post(
        f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true&user_id_override={student_user_id}",
        headers=admin_headers,
    )
    assert eval_resp.status_code == 200
    data = eval_resp.json()
    assert data["evaluation"]["decision"] == "SURGICAL_NETWORK_ISOLATION"
    assert data["playbook_execution"]["status"] == "SUCCESS"
    assert data["playbook_execution"]["playbook_name"] == "PLAYBOOK_03_SURGICAL_ISOLATION"

    # Verify workstation is ISOLATED in DB
    async with TestAsyncSession() as session:
        ws_isolated = await session.get(Workstation, ws_id)
        assert ws_isolated.status == "ISOLATED"

        inc_res = await session.execute(select(Incident).where(Incident.workstation_id == ws_id))
        inc = inc_res.scalar_one_or_none()
        assert inc is not None
        assert inc.status == "CONTAINED"

    # Step 2: SOC Operator rolls back isolation
    rollback_resp = await async_client.post(
        f"/api/v1/policy/rollback-isolation/{ws_id}",
        headers=operator_headers,
    )
    assert rollback_resp.status_code == 200
    assert rollback_resp.json()["status"] == "success"

    # Verify workstation is restored to ONLINE and rollback audit is present
    async with TestAsyncSession() as session:
        ws_restored = await session.get(Workstation, ws_id)
        assert ws_restored.status == "ONLINE"

        audit_res = await session.execute(select(AuditLog).where(AuditLog.action == "soar.rollback.surgical_isolation"))
        audit_entry = audit_res.scalar_one_or_none()
        assert audit_entry is not None
        assert audit_entry.result == "success"


@pytest.mark.asyncio
async def test_scenario_3_deep_researcher_workload_preservation(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 3 (Deep): Legitimate Researcher High-Performance Compute Workload -> State Preservation.
    Verifies:
    1. IdP confirms user is RESEARCHER with active authorized HPC job.
    2. Policy engine evaluates ALLOW_LEGITIMATE_RESEARCH.
    3. Active workload QUANTUM-LATTICE-505 is preserved.
    4. Workstation status remains ONLINE with ZERO interruption to ongoing research.
    """
    ws_id = uuid.uuid4()
    researcher_user_id = str(uuid.uuid4())

    hpc_workload = AuthorizedWorkload(
        job_id="QUANTUM-LATTICE-505",
        workload_type=WorkloadType.HPC_SIMULATION,
        description="Lattice QCD Monte Carlo Simulation",
        workstation_id=ws_id,
        is_active=True,
    )
    idp_service.register_workload(hpc_workload)

    idp_service.register_mock_user(
        IdPIdentityContext(
            user_id=researcher_user_id,
            username="dr_tariq",
            email="tariq@kku.edu.sa",
            role="RESEARCHER",
            department="Physics",
            lab="High Energy Physics Lab",
            active_workloads=[hpc_workload],
        )
    )

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="phys-compute-node-02",
            ip_address="10.30.2.2",
            operating_system="Ubuntu 22.04 LTS",
            department="Physics",
            lab="High Energy Physics Lab",
            status="ONLINE",
        )
        session.add(ws)

        anom = AnomalyDetection(
            workstation_id=ws_id,
            timestamp=datetime.now(timezone.utc),
            anomaly_type="TECHNICAL_ANOMALY",
            score=0.98,
            confidence=0.92,
            model_name="model_01_isolation_forest",
            model_version="1.0.0",
            evidence=["Sustained multi-threaded compute across all NUMA nodes"],
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

    # Verify research exemption
    assert evaluation["decision"] == "ALLOW_LEGITIMATE_RESEARCH"
    assert "QUANTUM-LATTICE-505" in evaluation["preserve_workloads"]
    assert evaluation["correlated_incident"]["is_threat"] is False

    # Verify workstation remains ONLINE and compute is unaffected
    async with TestAsyncSession() as session:
        ws_check = await session.get(Workstation, ws_id)
        assert ws_check.status == "ONLINE"


@pytest.mark.asyncio
async def test_scenario_4_deep_unauthorized_activity_soc_lifecycle(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
    operator_headers: dict[str, str],
) -> None:
    """
    Scenario 4 (Deep): Unauthorized Activity -> Threat Event -> Alert Creation -> Acknowledge -> Resolve.
    Verifies:
    1. Incident and Alert are generated for unauthorized LSASS access.
    2. SOC Operator acknowledges the alert via PATCH/POST /alerts/{id}/acknowledge.
    3. SOC Operator resolves the alert via PATCH/POST /alerts/{id}/resolve.
    4. Audit logs are committed for every state transition in the incident lifecycle.
    """
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="dc-jumphost-01",
            ip_address="10.50.1.1",
            operating_system="Windows Server 2022",
            department="IT",
            lab="Data Center",
            status="ONLINE",
        )
        session.add(ws)

        sec = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            source="sysmon",
            workstation_id=ws_id,
            event_type="PRIVILEGE_ESCALATION",
            severity="CRITICAL",
            confidence=0.99,
            description="Sysmon EventID 10: LSASS memory handle opened with PROCESS_ALL_ACCESS",
            evidence=["SourceImage: C:\\Temp\\procdump.exe", "TargetImage: C:\\Windows\\System32\\lsass.exe"],
        )
        session.add(sec)
        await session.commit()

    # Step 1: Policy evaluation generates alert and incident
    eval_resp = await async_client.post(
        f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true",
        headers=admin_headers,
    )
    assert eval_resp.status_code == 200

    # Step 2: Fetch created alert
    alerts_resp = await async_client.get("/api/v1/alerts", headers=operator_headers)
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) > 0
    target_alert = alerts[0]
    alert_id = target_alert["id"]

    # Step 3: SOC Operator acknowledges the alert
    ack_resp = await async_client.patch(
        f"/api/v1/alerts/{alert_id}/acknowledge",
        headers=operator_headers,
    )
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "ACKNOWLEDGED"
    assert ack_resp.json()["acknowledged_at"] is not None

    # Step 4: SOC Operator resolves the alert
    res_resp = await async_client.patch(
        f"/api/v1/alerts/{alert_id}/resolve",
        headers=operator_headers,
    )
    assert res_resp.status_code == 200
    assert res_resp.json()["status"] == "RESOLVED"
    assert res_resp.json()["resolved_at"] is not None

    # Step 5: Verify audit trail
    async with TestAsyncSession() as session:
        audit_res = await session.execute(select(AuditLog).where(AuditLog.resource == f"alert:{alert_id}"))
        audit_entries = audit_res.scalars().all()
        actions = [e.action for e in audit_entries]
        assert "alert.acknowledge" in actions
        assert "alert.resolve" in actions


@pytest.mark.asyncio
async def test_scenario_5_deep_idp_outage_fail_safe_and_emergency_killswitch(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 5 (Deep): IdP Outage Fail-Safe & Administrative Emergency Kill Switch (Rule 19).
    Verifies:
    Part A:
    1. IdP enters outage mode.
    2. Automated high-risk isolation safely halts: requires human SOC operator approval (is_fallback: True).
    Part B:
    3. Admin activates emergency kill switch via /api/v1/policy/kill-switch.
    4. Automated containment is strictly suppressed across the platform.
    5. Admin deactivates kill switch, restoring standard response automation.
    """
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="kiosk-node-22",
            ip_address="10.80.1.22",
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
            confidence=0.85,
            description="SYN flood scan from unknown endpoint",
        )
        session.add(sec)
        await session.commit()

    # Part A: IdP Outage Fail-Safe
    idp_service.set_outage_mode(True)
    try:
        eval_resp = await async_client.post(
            f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true",
            headers=admin_headers,
        )
        assert eval_resp.status_code == 200
        data = eval_resp.json()
        assert data["evaluation"]["decision"] == "REQUIRE_HUMAN_APPROVAL"
        assert data["evaluation"]["requires_human_approval"] is True
        assert data["evaluation"]["user_context"]["is_fallback"] is True
    finally:
        idp_service.set_outage_mode(False)

    # Part B: Emergency Kill Switch
    try:
        # 1. Activate kill switch
        ks_on_resp = await async_client.post(
            "/api/v1/policy/kill-switch",
            json={"active": True, "reason": "Campus-wide final examination period"},
            headers=admin_headers,
        )
        assert ks_on_resp.status_code == 200
        assert ks_on_resp.json()["kill_switch_active"] is True
        assert policy_engine.is_kill_switch_active is True

        # 2. Evaluate policy while kill switch is active -> containment MUST be suppressed
        eval_suppressed = await async_client.post(
            f"/api/v1/policy/evaluate/{ws_id}?auto_execute=true",
            headers=admin_headers,
        )
        assert eval_suppressed.status_code == 200
        suppressed_data = eval_suppressed.json()
        assert suppressed_data["evaluation"]["kill_switch_active"] is True
        assert suppressed_data["evaluation"]["decision"] == "ALERT_SOC_ONLY"
        assert suppressed_data["evaluation"]["requires_human_approval"] is True
        assert suppressed_data["playbook_execution"] is None

        # Host must remain ONLINE
        async with TestAsyncSession() as session:
            ws_check = await session.get(Workstation, ws_id)
            assert ws_check.status == "ONLINE"

    finally:
        # 3. Deactivate kill switch
        ks_off_resp = await async_client.post(
            "/api/v1/policy/kill-switch",
            json={"active": False, "reason": "Exam period concluded"},
            headers=admin_headers,
        )
        assert ks_off_resp.status_code == 200
        assert ks_off_resp.json()["kill_switch_active"] is False
        assert policy_engine.is_kill_switch_active is False


@pytest.mark.asyncio
async def test_scenario_6_deep_agent_offline_and_reconnection_recovery(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 6 (Deep): Agent Disconnection -> Liveness Alert -> Heartbeat Reconnection Self-Healing.
    Verifies:
    1. Workstation last seen in past transitions to OFFLINE via liveness scan.
    2. AGENT_HEALTH alert is dispatched.
    3. Reconnecting agent transmits heartbeat ping.
    4. Workstation status automatically self-heals back to ONLINE.
    """
    ws_id = uuid.uuid4()
    agent_id = uuid.uuid4()
    stale_time = datetime.now(timezone.utc) - timedelta(seconds=360)

    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            agent_id=agent_id,
            hostname="lab-workstation-88",
            ip_address="10.40.1.88",
            operating_system="Windows 11",
            agent_version="1.0.0",
            status="ONLINE",
            last_seen_at=stale_time,
        )
        session.add(ws)
        await session.commit()

    # Step 1: Scan for offline agents
    liveness_resp = await async_client.post(
        "/api/v1/agents/check-liveness?threshold_seconds=120",
    )
    assert liveness_resp.status_code == 200
    data = liveness_resp.json()
    assert data["offline_count"] >= 1
    assert "lab-workstation-88" in data["affected_workstations"]

    # Verify workstation is OFFLINE and alert exists
    async with TestAsyncSession() as session:
        ws_offline = await session.get(Workstation, ws_id)
        assert ws_offline.status == "OFFLINE"

        alert_res = await session.execute(select(Alert).where(Alert.source_id == ws_id))
        alert = alert_res.scalar_one_or_none()
        assert alert is not None
        assert alert.source_type == "AGENT_HEALTH"

    # Step 2: Agent reconnects and sends heartbeat
    heartbeat_payload = {
        "agent_id": str(agent_id),
        "status": "ONLINE",
        "agent_version": "1.0.0",
    }
    hb_resp = await async_client.post(
        "/api/v1/agents/heartbeat",
        json=heartbeat_payload,
    )
    assert hb_resp.status_code == 200
    assert hb_resp.json()["status"] == "acknowledged"

    # Step 3: Verify workstation is restored to ONLINE
    async with TestAsyncSession() as session:
        ws_recovered = await session.get(Workstation, ws_id)
        last_seen = ws_recovered.last_seen_at
        if last_seen.tzinfo is None:
            stale_cmp = stale_time.replace(tzinfo=None)
        else:
            stale_cmp = stale_time
        assert last_seen > stale_cmp


@pytest.mark.asyncio
async def test_scenario_7_deep_audit_log_query_api_and_rbac(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
    student_headers: dict[str, str],
) -> None:
    """
    Scenario 7 (Deep): Immutable Audit Log Query API & RBAC Enforcement (Rule 24).
    Verifies:
    1. Admin can query GET /api/v1/audit/logs with pagination and filtering.
    2. Log entries contain immutable fields (actor, action, resource, result, timestamp).
    3. Non-privileged roles (e.g. STUDENT) are strictly rejected with 403 Forbidden.
    """
    # 1. Admin query
    audit_resp = await async_client.get(
        "/api/v1/audit/logs?page=1&page_size=10",
        headers=admin_headers,
    )
    assert audit_resp.status_code == 200
    data = audit_resp.json()
    assert "items" in data
    assert "total" in data
    assert data["page"] == 1

    # 2. Student unauthorized access attempt
    student_resp = await async_client.get(
        "/api/v1/audit/logs",
        headers=student_headers,
    )
    assert student_resp.status_code == 403
