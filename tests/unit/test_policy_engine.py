"""
Unit Tests — Role-Sensitive Security Policy Engine.

Tests:
- Preservation of legitimate research workloads (Rule 20, Rule 29 Scenario 3).
- Technical hardware degradation maintenance dispatch (Rule 29 Scenario 1).
- Student cryptojacking host isolation (Rule 29 Scenario 2).
- Researcher surgical process containment preserving simulation jobs (Rule 19, 20).
- APT intrusion network isolation (Rule 29 Scenario 4).
- Emergency kill switch activation suppressing destructive action (Rule 19).
- IdP outage fail-soft conservative policy (Rule 18, Rule 29 Scenario 5).
"""

import uuid

import pytest

from backend.schemas.idp import (
    AuthorizedWorkload,
    IdPIdentityContext,
    IdPWorkstationContext,
    WorkloadType,
)
from security.correlation_engine import CorrelatedIncident
from security.policy_engine import (
    PolicyDecisionType,
    SecurityPolicyEngine,
)


@pytest.fixture
def policy_engine_instance() -> SecurityPolicyEngine:
    """Provide a fresh SecurityPolicyEngine instance."""
    engine = SecurityPolicyEngine(emergency_kill_switch=False)
    return engine


def test_benign_research_compute_policy_preserves_workload(
    policy_engine_instance: SecurityPolicyEngine,
) -> None:
    """Authorized research simulation must be allowed without containment (Rule 20, Scenario 3)."""
    ws_id = uuid.uuid4()
    workload = AuthorizedWorkload(
        job_id="HPC-SIM-101",
        workload_type=WorkloadType.HPC_SIMULATION,
        description="Quantum Simulation",
        workstation_id=ws_id,
        is_active=True,
    )
    user_ctx = IdPIdentityContext(
        user_id="res-01",
        username="prof_turing",
        email="turing@kku.edu.sa",
        role="RESEARCHER",
        department="Computer Science",
    )
    ws_ctx = IdPWorkstationContext(
        workstation_id=ws_id,
        hostname="hpc-node-04",
        department="Computer Science",
        lab="AI Cluster",
        active_workloads=[workload],
    )
    incident = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category="BENIGN_HIGH_COMPUTE",
        is_threat=False,
        severity="LOW",
        confidence=0.92,
        recommended_action="SCHEDULE_MAINTENANCE_ADVISORY",
        reason="High CPU sustained with valid compute characteristics.",
    )

    result = policy_engine_instance.evaluate_policy(incident, user_ctx, ws_ctx)
    assert result.decision == PolicyDecisionType.ALLOW_LEGITIMATE_RESEARCH
    assert result.playbook_to_execute == "PLAYBOOK_04_MAINTENANCE"
    assert "HPC-SIM-101" in result.preserve_workloads
    assert len(result.target_pids) == 0


def test_hardware_degradation_maintenance_dispatch(
    policy_engine_instance: SecurityPolicyEngine,
) -> None:
    """Technical faults trigger maintenance without security containment (Rule 29 Scenario 1)."""
    ws_id = uuid.uuid4()
    user_ctx = IdPIdentityContext(
        user_id="user-01",
        username="john_doe",
        email="jdoe@kku.edu.sa",
        role="STUDENT",
        department="Science",
    )
    ws_ctx = IdPWorkstationContext(
        workstation_id=ws_id,
        hostname="lab-pc-10",
        department="Science",
    )
    incident = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category="HARDWARE_DEGRADATION",
        is_threat=False,
        severity="MEDIUM",
        confidence=0.88,
        recommended_action="SCHEDULE_MAINTENANCE_ADVISORY",
        reason="Model 02-A identified memory bus fault and abnormal latency.",
    )

    result = policy_engine_instance.evaluate_policy(incident, user_ctx, ws_ctx)
    assert result.decision == PolicyDecisionType.SCHEDULE_MAINTENANCE
    assert result.playbook_to_execute == "PLAYBOOK_04_MAINTENANCE"


def test_student_cryptojacking_triggers_host_isolation(
    policy_engine_instance: SecurityPolicyEngine,
) -> None:
    """Cryptojacking on a student PC triggers swift surgical host isolation (Scenario 2)."""
    ws_id = uuid.uuid4()
    user_ctx = IdPIdentityContext(
        user_id="stu-22",
        username="student_bob",
        email="bob@kku.edu.sa",
        role="STUDENT",
        department="Engineering",
    )
    ws_ctx = IdPWorkstationContext(
        workstation_id=ws_id,
        hostname="student-pc-09",
        department="Engineering",
    )
    incident = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category="CRYPTOJACKING",
        is_threat=True,
        severity="CRITICAL",
        confidence=0.95,
        recommended_action="SURGICAL_ISOLATION",
        reason="Stratum mining pool connection on port 3333 detected.",
        evidence=["Outbound traffic to pool.monero.org:3333"],
    )

    result = policy_engine_instance.evaluate_policy(incident, user_ctx, ws_ctx)
    assert result.decision == PolicyDecisionType.SURGICAL_NETWORK_ISOLATION
    assert result.playbook_to_execute == "PLAYBOOK_03_SURGICAL_ISOLATION"
    assert 3333 in result.target_ports


def test_researcher_cryptojacking_executes_surgical_process_containment(
    policy_engine_instance: SecurityPolicyEngine,
) -> None:
    """Cryptojacking on Researcher workstation terminates miner while preserving research job (Rule 19, 20)."""
    ws_id = uuid.uuid4()
    active_job = AuthorizedWorkload(
        job_id="GENOME-SEQ-88",
        workload_type=WorkloadType.HPC_SIMULATION,
        description="Genomic Sequence Analysis",
        workstation_id=ws_id,
        is_active=True,
    )
    user_ctx = IdPIdentityContext(
        user_id="res-99",
        username="dr_watson",
        email="watson@kku.edu.sa",
        role="RESEARCHER",
        department="Biology",
    )
    ws_ctx = IdPWorkstationContext(
        workstation_id=ws_id,
        hostname="bio-server-01",
        department="Biology",
        lab="Genomics Lab",
        active_workloads=[active_job],
    )
    incident = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category="CRYPTOJACKING",
        is_threat=True,
        severity="CRITICAL",
        confidence=0.96,
        recommended_action="SURGICAL_ISOLATION",
        reason="Rogue miner process attempting outbound stratum connection on port 4444.",
        evidence=["Destination port 4444 matched mining signature."],
    )

    result = policy_engine_instance.evaluate_policy(incident, user_ctx, ws_ctx)
    # Must use surgical process containment, preserving GENOME-SEQ-88
    assert result.decision == PolicyDecisionType.SURGICAL_PROCESS_CONTAINMENT
    assert result.playbook_to_execute == "PLAYBOOK_02_PROCESS_CONTAINMENT"
    assert "GENOME-SEQ-88" in result.preserve_workloads
    assert 4444 in result.target_ports


def test_emergency_kill_switch_suppresses_containment(
    policy_engine_instance: SecurityPolicyEngine,
) -> None:
    """Emergency kill switch forces non-destructive SOC alert only (Rule 19)."""
    policy_engine_instance.set_emergency_kill_switch(True)
    ws_id = uuid.uuid4()
    user_ctx = IdPIdentityContext(
        user_id="stu-01",
        username="user1",
        email="u1@kku.edu.sa",
        role="STUDENT",
        department="CS",
    )
    ws_ctx = IdPWorkstationContext(
        workstation_id=ws_id,
        hostname="ws-01",
        department="CS",
    )
    incident = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category="APT_INTRUSION",
        is_threat=True,
        severity="CRITICAL",
        confidence=0.99,
        recommended_action="SURGICAL_ISOLATION",
        reason="Credential dumping detected.",
    )

    result = policy_engine_instance.evaluate_policy(incident, user_ctx, ws_ctx)
    assert result.decision == PolicyDecisionType.ALERT_SOC_ONLY
    assert result.playbook_to_execute == "PLAYBOOK_01_ALERT_ONLY"
    assert result.kill_switch_active is True
    assert result.requires_human_approval is True


def test_idp_outage_fallback_policy(
    policy_engine_instance: SecurityPolicyEngine,
) -> None:
    """When IdP is in outage fallback, high-severity events require human confirmation (Scenario 5)."""
    ws_id = uuid.uuid4()
    fallback_user_ctx = IdPIdentityContext(
        user_id="user-fallback",
        username="user_fallback",
        email="fallback@kku.edu.sa",
        role="STUDENT",
        department="Unknown",
        is_fallback=True,
    )
    ws_ctx = IdPWorkstationContext(
        workstation_id=ws_id,
        hostname="ws-fallback",
        department="Unknown",
    )
    incident = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category="SUSPICIOUS_ACTIVITY",
        is_threat=True,
        severity="HIGH",
        confidence=0.85,
        recommended_action="ALERT_ONLY",
        reason="Unusual activity logged.",
    )

    result = policy_engine_instance.evaluate_policy(incident, fallback_user_ctx, ws_ctx)
    assert result.decision == PolicyDecisionType.REQUIRE_HUMAN_APPROVAL
    assert result.requires_human_approval is True


def test_choose_playbook(policy_engine_instance: SecurityPolicyEngine) -> None:
    """
    Playbook selection: Evaluate role-sensitive response across student, researcher, technical, and emergency contexts.
    Test Input: Incident category + User Role (Student, Researcher, Hardware Fault, Emergency Kill Switch).
    Expected Result: Deterministic selection of Playbook 01 to 04 matching security policy rules.
    """
    ws_id = uuid.uuid4()

    # 1. Student Cyber Threat -> Playbook 03 (Surgical Host Isolation)
    student_ctx = IdPIdentityContext(
        user_id="stu-101",
        username="student_alex",
        email="alex@kku.edu.sa",
        role="STUDENT",
        department="Computer Engineering",
    )
    ws_ctx = IdPWorkstationContext(workstation_id=ws_id, hostname="lab-pc-15", department="Engineering")
    cyber_incident = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category="CRYPTOJACKING",
        is_threat=True,
        severity="CRITICAL",
        confidence=0.95,
        recommended_action="SURGICAL_ISOLATION",
        reason="Cryptomining signature detected.",
    )
    res_student = policy_engine_instance.evaluate_policy(cyber_incident, student_ctx, ws_ctx)
    print(f"\n[Playbook Selection] Student Cyber Threat: playbook={res_student.playbook_to_execute}, decision={res_student.decision}")
    assert res_student.playbook_to_execute == "PLAYBOOK_03_SURGICAL_ISOLATION"
    # 2. Researcher Cyber Threat with Active HPC Job -> Playbook 02 (Process Containment Preserving Research)
    active_job = AuthorizedWorkload(
        job_id="HPC-SIM-500",
        workload_type=WorkloadType.HPC_SIMULATION,
        description="Quantum Simulation",
        workstation_id=ws_id,
        is_active=True,
    )
    researcher_ctx = IdPIdentityContext(
        user_id="res-202",
        username="dr_watson",
        email="watson@kku.edu.sa",
        role="RESEARCHER",
        department="Physics",
    )
    ws_researcher_ctx = IdPWorkstationContext(
        workstation_id=ws_id,
        hostname="hpc-node-08",
        department="Physics",
        active_workloads=[active_job],
    )
    res_researcher = policy_engine_instance.evaluate_policy(cyber_incident, researcher_ctx, ws_researcher_ctx)
    print(f"[Playbook Selection] Researcher Cyber Threat: playbook={res_researcher.playbook_to_execute}, preserved={res_researcher.preserve_workloads}")
    assert res_researcher.playbook_to_execute == "PLAYBOOK_02_PROCESS_CONTAINMENT"
    assert "HPC-SIM-500" in res_researcher.preserve_workloads
    # 3. Technical Hardware Degradation -> Playbook 04 (Maintenance Dispatch)
    tech_incident = CorrelatedIncident(
        workstation_id=ws_id,
        incident_category="HARDWARE_DEGRADATION",
        is_threat=False,
        severity="MEDIUM",
        confidence=0.88,
        recommended_action="SCHEDULE_MAINTENANCE_ADVISORY",
        reason="Memory bus error detected.",
    )
    res_tech = policy_engine_instance.evaluate_policy(tech_incident, student_ctx, ws_ctx)
    print(f"[Playbook Selection] Technical Degradation: playbook={res_tech.playbook_to_execute}, decision={res_tech.decision}")
    assert res_tech.playbook_to_execute == "PLAYBOOK_04_MAINTENANCE"
    # 4. Emergency Kill Switch Active -> Playbook 01 (Alert Only, No Containment)
    policy_engine_instance.set_emergency_kill_switch(True)
    try:
        res_kill_switch = policy_engine_instance.evaluate_policy(cyber_incident, student_ctx, ws_ctx)
        print(f"[Playbook Selection] Emergency Kill Switch: playbook={res_kill_switch.playbook_to_execute}, human_approval={res_kill_switch.requires_human_approval}")
        assert res_kill_switch.playbook_to_execute == "PLAYBOOK_01_ALERT_ONLY"
        assert res_kill_switch.requires_human_approval is True
    finally:
        policy_engine_instance.set_emergency_kill_switch(False)
