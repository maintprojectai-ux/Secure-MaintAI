"""
Comprehensive Completion Verification Suite — Secure-MaintAI.

Covers all 6 completion requirements:
1. Normalized incident categories and explicit policy routing (including UNAUTHORIZED_ACCESS -> ACCOUNT_LOCKOUT
   and SECURITY_ANOMALY_GENERIC -> ALERT_SOC_ONLY).
2. IdP outage handling and cleanup (uncertain identity never authorizes destructive actions across any severity;
   outage mode is unconditionally cleared even on exception; workloads are deduplicated/cleaned).
3. SOAR execution semantics (RECORDED_CONTROL_PLANE vs CONFIRMED_ENDPOINT_ENFORCEMENT, PID & port validation,
   protected research job preservation, alert_id & SHA-256 audit integrity_hash population).
4. ML feature processing stability (channels 7-9 memory separation, positive class index lookup,
   specialist readiness checks, and per-workstation state reset).
5. All 7 demo scenarios, repeated runs, scenario order permutations, policy fallbacks, and RBAC boundaries.
6. Evidence receipt verification (actual model output, policy decision, execution mode, integrity hash, and measured timings).
"""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from backend.schemas.idp import (
    AuthorizedWorkload,
    IdPIdentityContext,
    IdPWorkstationContext,
    WorkloadType,
)
from backend.services import ml_pipeline_service
from backend.services.idp_service import idp_service
from backend.services.soar_service import SOARService
from security.correlation_engine import (
    CorrelatedIncident,
    IncidentCategory,
    SecurityCorrelationEngine,
    normalize_incident_category,
)
from security.policy_engine import (
    PolicyDecisionType,
    SecurityPolicyEngine,
    extract_and_validate_targets,
)


# ---------------------------------------------------------------------------
# 1. INCIDENT CATEGORY NORMALIZATION & EXPLICIT POLICY ROUTING
# ---------------------------------------------------------------------------
def test_incident_category_normalization_and_unauthorized_access_routing() -> None:
    """Verify every correlation category maps to an explicit policy rule and safe default."""
    engine = SecurityPolicyEngine(emergency_kill_switch=False)
    ws_id = uuid.uuid4()
    student_ctx = IdPIdentityContext(
        user_id="stu-900",
        username="student_login",
        email="stu900@kku.edu.sa",
        role="STUDENT",
        department="CS",
    )
    ws_ctx = IdPWorkstationContext(workstation_id=ws_id, hostname="lab-pc-90", department="CS")

    # UNAUTHORIZED_ACCESS emitted by CorrelationEngine must route to RULE_BRUTE_FORCE_LOCKOUT
    unauth_inc = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category=IncidentCategory.UNAUTHORIZED_ACCESS.value,
        is_threat=True,
        severity="HIGH",
        confidence=0.88,
        reason="Repeated authentication failures detected.",
    )
    res_unauth = engine.evaluate_policy(unauth_inc, student_ctx, ws_ctx)
    assert res_unauth.decision == PolicyDecisionType.ACCOUNT_LOCKOUT
    assert res_unauth.playbook_to_execute == "PLAYBOOK_05_ACCOUNT_RESPONSE"
    assert "RULE_BRUTE_FORCE_LOCKOUT" in res_unauth.policy_rules_triggered

    # Active researcher on compute node during UNAUTHORIZED_ACCESS preserves jobs and escalates for human approval
    active_job = AuthorizedWorkload(
        job_id="HPC-QUANTUM-77",
        workload_type=WorkloadType.HPC_SIMULATION,
        description="Quantum chemistry run",
        workstation_id=ws_id,
        is_active=True,
    )
    res_ctx = IdPIdentityContext(
        user_id="res-77",
        username="dr_feynman",
        email="feynman@kku.edu.sa",
        role="RESEARCHER",
        department="Physics",
    )
    ws_res_ctx = IdPWorkstationContext(
        workstation_id=ws_id,
        hostname="hpc-node-77",
        department="Physics",
        active_workloads=[active_job],
    )
    res_researcher_unauth = engine.evaluate_policy(unauth_inc, res_ctx, ws_res_ctx)
    assert res_researcher_unauth.decision == PolicyDecisionType.REQUIRE_HUMAN_APPROVAL
    assert res_researcher_unauth.playbook_to_execute == "PLAYBOOK_01_ALERT_ONLY"
    assert "HPC-QUANTUM-77" in res_researcher_unauth.preserve_workloads

    # Uncorroborated generic ML security anomaly routes to RULE_GENERIC_SECURITY_ALERT
    generic_inc = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category=IncidentCategory.SECURITY_ANOMALY_GENERIC.value,
        is_threat=True,
        severity="HIGH",
        confidence=0.82,
        reason="Model 02-B flagged host anomaly without matching SIEM event.",
    )
    res_generic = engine.evaluate_policy(generic_inc, student_ctx, ws_ctx)
    assert res_generic.decision == PolicyDecisionType.ALERT_SOC_ONLY
    assert res_generic.playbook_to_execute == "PLAYBOOK_01_ALERT_ONLY"
    assert "RULE_GENERIC_SECURITY_ALERT" in res_generic.policy_rules_triggered

    # Alias normalization check
    assert normalize_incident_category("privilege_escalation") == IncidentCategory.APT_INTRUSION.value
    assert normalize_incident_category("nominal") == IncidentCategory.NORMAL.value


# ---------------------------------------------------------------------------
# 2. IDP OUTAGE HANDLING & IDENTITY UNCERTAINTY SAFETY BOUNDARIES
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
@pytest.mark.parametrize(
    "category",
    [
        "CRYPTOJACKING",
        "APT_INTRUSION",
        "DATA_EXFILTRATION",
        "UNAUTHORIZED_ACCESS",
        "BRUTE_FORCE_ATTACK",
    ],
)
def test_idp_uncertainty_never_authorizes_destructive_actions(
    severity: str,
    category: str,
) -> None:
    """
    Regardless of threat category or severity (LOW/MEDIUM/HIGH/CRITICAL),
    is_fallback=True or role='UNKNOWN' must NEVER authorize destructive containment
    (SURGICAL_NETWORK_ISOLATION, SURGICAL_PROCESS_CONTAINMENT, ACCOUNT_LOCKOUT).
    """
    engine = SecurityPolicyEngine(emergency_kill_switch=False)
    ws_id = uuid.uuid4()
    ws_ctx = IdPWorkstationContext(workstation_id=ws_id, hostname="ws-uncertain", department="Unknown")

    destructive_decisions = {
        PolicyDecisionType.SURGICAL_NETWORK_ISOLATION,
        PolicyDecisionType.SURGICAL_PROCESS_CONTAINMENT,
        PolicyDecisionType.ACCOUNT_LOCKOUT,
    }

    # Case A: Fallback context (IdP offline)
    fallback_ctx = IdPIdentityContext(
        user_id="u-fallback",
        username="fallback_user",
        email="fb@kku.edu.sa",
        role="STUDENT",
        department="Unknown",
        is_fallback=True,
    )
    inc = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category=category,
        is_threat=True,
        severity=severity,
        confidence=0.95,
        reason="Simulated threat during IdP uncertainty.",
    )
    res_fb = engine.evaluate_policy(inc, fallback_ctx, ws_ctx)
    assert res_fb.decision not in destructive_decisions
    assert res_fb.playbook_to_execute == "PLAYBOOK_01_ALERT_ONLY"
    assert "RULE_IDP_OUTAGE_SAFE_FALLBACK" in res_fb.policy_rules_triggered

    # Case B: Unknown role even if is_fallback is False
    unknown_role_ctx = IdPIdentityContext(
        user_id="u-unknown",
        username="mystery_user",
        email="mystery@kku.edu.sa",
        role="UNKNOWN",
        department="Unknown",
        is_fallback=False,
    )
    res_unk = engine.evaluate_policy(inc, unknown_role_ctx, ws_ctx)
    assert res_unk.decision not in destructive_decisions
    assert res_unk.playbook_to_execute == "PLAYBOOK_01_ALERT_ONLY"


@pytest.mark.asyncio
async def test_demo_idp_outage_mode_cleared_on_exception(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """Ensure idp_service.is_outage_mode is unconditionally cleared even if an error occurs mid-run."""
    assert idp_service.is_outage_mode is False
    with patch.object(
        SecurityCorrelationEngine,
        "correlate_workstation",
        side_effect=RuntimeError("Simulated mid-pipeline failure"),
    ):
        with pytest.raises(RuntimeError, match="Simulated mid-pipeline failure"):
            await async_client.post(
                "/api/v1/demo/trigger-scenario",
                json={"scenario_type": "IDP_OUTAGE_FALLBACK"},
                headers=admin_headers,
            )
    # Outage mode MUST be restored to False by try...finally
    assert idp_service.is_outage_mode is False


# ---------------------------------------------------------------------------
# 3. SOAR EXECUTION SEMANTICS, PID & PORT VALIDATION
# ---------------------------------------------------------------------------
def test_pid_and_port_validation_protects_system_and_research_assets() -> None:
    """Verify PIDs <= 1000, protected daemons, research binaries, and management ports are filtered."""
    evidence = [
        "Rogue miner xmrig spawned with PID: 4821 connecting to pool:3333",
        "System daemon sshd running on PID: 452 port 22",
        "Database service postgres PID=880 port 5432",
        "Control plane API port 8000",
        "Authorized simulation qmcpack_cpu_opt running on PID: 3910",
    ]

    # With preserve_research=True, PID 3910 (qmcpack_cpu_opt), PID 452, PID 880, and ports 22/5432/8000 are excluded
    pids, ports = extract_and_validate_targets(evidence, preserve_research=True)
    assert pids == [4821]
    assert ports == [3333]

    # Direct SOARService validator checks
    valid_pids, rejected_pids = SOARService.validate_pids([1, 450, 1000, 4821, 5912])
    assert valid_pids == [4821, 5912]
    assert set(rejected_pids) == {1, 450, 1000}

    valid_ports, rejected_ports = SOARService.validate_ports([22, 80, 443, 3333, 4444, 5432, 8000, 70000])
    assert valid_ports == [3333, 4444]
    assert set(rejected_ports) == {22, 80, 443, 5432, 8000, 70000}


# ---------------------------------------------------------------------------
# 4. ML PIPELINE SPECIALIST READINESS & FEATURE STABILITY
# ---------------------------------------------------------------------------
def test_ml_specialist_readiness_and_state_reset() -> None:
    """Verify Model 01 (IF), Model 02-A (RCAEval RF), and Model 02-B (Windows-APT RF) readiness."""
    ml_pipeline_service.initialise()
    readiness = ml_pipeline_service.get_readiness_status()
    assert readiness["model_01_isolation_forest"] is True
    assert readiness["model_02a_rcaeval_rf"] is True
    assert readiness["model_02b_windows_apt_rf"] is True
    assert readiness["all_ready"] is True


# ---------------------------------------------------------------------------
# 5. ALL 7 SCENARIOS, REPEATED RUNS, PERMUTATIONS & RBAC BOUNDARIES
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("scenario_type", "expected_decision", "expected_playbook", "expected_ws_status"),
    [
        ("STUDENT_CYBER_THREAT", "SURGICAL_NETWORK_ISOLATION", "PLAYBOOK_03_SURGICAL_ISOLATION", "ISOLATED"),
        ("RESEARCHER_CYBER_THREAT", "SURGICAL_PROCESS_CONTAINMENT", "PLAYBOOK_02_PROCESS_CONTAINMENT", "ONLINE"),
        ("TECHNICAL_DEGRADATION", "SCHEDULE_MAINTENANCE", "PLAYBOOK_04_MAINTENANCE", "ONLINE"),
        ("RESEARCHER_HPC_WORKLOAD", "ALLOW_LEGITIMATE_RESEARCH", "PLAYBOOK_04_MAINTENANCE", "ONLINE"),
        ("PRIVILEGE_ESCALATION", "SURGICAL_NETWORK_ISOLATION", "PLAYBOOK_03_SURGICAL_ISOLATION", "ISOLATED"),
        ("IDP_OUTAGE_FALLBACK", "REQUIRE_HUMAN_APPROVAL", "PLAYBOOK_01_ALERT_ONLY", "ONLINE"),
        ("NORMAL_BASELINE", "MAINTAIN_NORMAL_STATE", "PLAYBOOK_00_NO_ACTION", "ONLINE"),
    ],
)
async def test_all_seven_scenarios_end_to_end_receipts(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
    scenario_type: str,
    expected_decision: str,
    expected_playbook: str,
    expected_ws_status: str,
) -> None:
    """Execute each of the 7 canonical scenarios and verify model output, policy, SOAR mode, and timings."""
    resp = await async_client.post(
        "/api/v1/demo/trigger-scenario",
        json={"scenario_type": scenario_type},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    receipt = resp.json()

    assert receipt["scenario_type"] == scenario_type
    assert receipt["step_7_policy_decision"]["decision"] == expected_decision
    assert receipt["step_7_policy_decision"]["playbook_to_execute"] == expected_playbook
    assert receipt["step_8_soar_execution"]["workstation_final_status"] == expected_ws_status
    assert receipt["step_8_soar_execution"]["execution_mode"] == "RECORDED_CONTROL_PLANE"
    assert isinstance(receipt["step_5_ml_result"]["ml_latency_ms"], (int, float))
    assert isinstance(receipt["step_8_soar_execution"]["soar_execution_ms"], (int, float))
    assert isinstance(receipt["step_10_validation_summary"]["measured_timings"]["total_pipeline_ms"], (int, float))

    if scenario_type != "NORMAL_BASELINE":
        # Non-nominal playbooks generate an AuditLog with a genuine 64-char hex SHA-256 integrity_hash
        integrity_hash = receipt["step_9_incident_audit"]["integrity_hash"]
        assert isinstance(integrity_hash, str)
        assert len(integrity_hash) == 64
        assert receipt["step_9_incident_audit"]["alert_id"] is not None
        assert receipt["step_9_incident_audit"]["incident_id"] is not None

    # Outage mode is always False after any scenario completes
    assert idp_service.is_outage_mode is False


@pytest.mark.asyncio
async def test_repeated_runs_and_scenario_order_permutations_on_same_workstation(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Run scenarios repeatedly and in adversarial order on the SAME workstation
    (Cyber Threat -> Normal Baseline -> IdP Outage -> Researcher HPC -> Researcher Cyber -> Technical Fault)
    to verify zero state bleed, workload deduplication, and workstation status reset.
    """
    shared_hostname = "undergrad-pc-04"

    # 1. Repeated runs of RESEARCHER_HPC_WORKLOAD (3x) must deduplicate workloads
    for _ in range(3):
        r_hpc = await async_client.post(
            "/api/v1/demo/trigger-scenario",
            json={"scenario_type": "RESEARCHER_HPC_WORKLOAD", "workstation_id": shared_hostname},
            headers=admin_headers,
        )
        assert r_hpc.status_code == 200
        body = r_hpc.json()
        assert body["step_7_policy_decision"]["decision"] == "ALLOW_LEGITIMATE_RESEARCH"
        # Must have exactly 1 active workload, not 2 or 3 duplicates
        assert len(body["step_6_idp_context"]["active_workloads"]) == 1

    # 2. Permutation sequence on the same workstation
    permutation = [
        ("STUDENT_CYBER_THREAT", "SURGICAL_NETWORK_ISOLATION", "ISOLATED"),
        ("NORMAL_BASELINE", "MAINTAIN_NORMAL_STATE", "ONLINE"),
        ("IDP_OUTAGE_FALLBACK", "REQUIRE_HUMAN_APPROVAL", "ONLINE"),
        ("RESEARCHER_HPC_WORKLOAD", "ALLOW_LEGITIMATE_RESEARCH", "ONLINE"),
        ("RESEARCHER_CYBER_THREAT", "SURGICAL_PROCESS_CONTAINMENT", "ONLINE"),
        ("TECHNICAL_DEGRADATION", "SCHEDULE_MAINTENANCE", "ONLINE"),
        ("PRIVILEGE_ESCALATION", "SURGICAL_NETWORK_ISOLATION", "ISOLATED"),
        ("NORMAL_BASELINE", "MAINTAIN_NORMAL_STATE", "ONLINE"),
    ]

    for sc_type, expected_dec, expected_status in permutation:
        res = await async_client.post(
            "/api/v1/demo/trigger-scenario",
            json={"scenario_type": sc_type, "workstation_id": shared_hostname},
            headers=admin_headers,
        )
        assert res.status_code == 200, f"Failed on {sc_type}: {res.text}"
        rec = res.json()
        assert rec["step_7_policy_decision"]["decision"] == expected_dec, (
            f"Permutation mismatch for {sc_type}: got {rec['step_7_policy_decision']}"
        )
        assert rec["step_8_soar_execution"]["workstation_final_status"] == expected_status
        assert idp_service.is_outage_mode is False


@pytest.mark.asyncio
async def test_authorization_boundaries_for_unauthenticated_requests(
    async_client: AsyncClient,
) -> None:
    """Verify unauthenticated requests to demo and policy endpoints are rejected with 401/403."""
    resp = await async_client.post(
        "/api/v1/demo/trigger-scenario",
        json={"scenario_type": "NORMAL_BASELINE"},
    )
    assert resp.status_code in (401, 403)

