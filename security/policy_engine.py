"""
Secure-MaintAI — Role-Sensitive Security Policy Engine.

Per engineering rules:
- Rule 16: Required flow is ML Prediction -> Security Correlation -> Identity Context -> Policy Engine -> Authorized Action.
- Rule 19: Surgical isolation with protected processes, protected workloads, emergency kill switch, and rollback.
- Rule 20: Differentiates STUDENT, RESEARCHER contexts.
- Rule 29: Satisfies scenarios for Benign Compute vs Cryptojacking vs Hardware Failure vs IdP Outage.
"""

import re
from datetime import datetime, timezone
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field

from backend.core.logging import get_logger
from backend.schemas.idp import IdPIdentityContext, IdPWorkstationContext, WorkloadType
from security.correlation_engine import (
    CorrelatedIncident,
    IncidentCategory,
    normalize_incident_category,
)

logger = get_logger("policy_engine")

# Rule 19: Protected OS/infrastructure daemons, research binaries, and control-plane ports
PROTECTED_SYSTEM_PID_CEILING: int = 1000
PROTECTED_SYSTEM_PROCESSES: frozenset[str] = frozenset(
    {
        "systemd",
        "init",
        "sshd",
        "postgres",
        "mysqld",
        "secure-maintai-agent",
        "wazuh-agentd",
        "lsass.exe",
        "csrss.exe",
        "services.exe",
        "wininit.exe",
    }
)
PROTECTED_RESEARCH_PROCESSES: frozenset[str] = frozenset(
    {
        "qmcpack",
        "qmcpack_cpu_opt",
        "mpirun",
        "mpiexec",
        "slurmstepd",
        "srun",
        "jupyter-lab",
        "gromacs",
    }
)
PROTECTED_MANAGEMENT_PORTS: frozenset[int] = frozenset({22, 53, 80, 123, 389, 443, 636, 5432, 8000, 8443})

_PID_PATTERN = re.compile(r"\bpid[\s:=]+(\d+)\b", re.IGNORECASE)
_PORT_PATTERN = re.compile(r"(?:\bport[\s:=]+|:)(\d{2,5})\b", re.IGNORECASE)


def validate_target_pids(pids: list[int]) -> tuple[list[int], list[int]]:
    """
    Canonical validator for candidate PIDs before process containment.
    Rejects OS/kernel/init PIDs (<= 1000) and invalid numbers.
    Returns (validated_pids, rejected_pids).
    """
    valid: list[int] = []
    rejected: list[int] = []
    for pid in pids:
        if isinstance(pid, int) and pid > PROTECTED_SYSTEM_PID_CEILING:
            if pid not in valid:
                valid.append(pid)
        else:
            rejected.append(pid)
    return valid, rejected


def validate_target_ports(ports: list[int]) -> tuple[list[int], list[int]]:
    """
    Canonical validator for candidate TCP/UDP ports before socket/port containment.
    Rejects out-of-range ports and protected management/control-plane ports.
    Returns (validated_ports, rejected_ports).
    """
    valid: list[int] = []
    rejected: list[int] = []
    for port in ports:
        if (
            isinstance(port, int)
            and 1 <= port <= 65535
            and port not in PROTECTED_MANAGEMENT_PORTS
        ):
            if port not in valid:
                valid.append(port)
        else:
            rejected.append(port)
    return valid, rejected


def extract_and_validate_targets(
    evidence: list[str],
    preserve_research: bool = False,
) -> tuple[list[int], list[int]]:
    """
    Extract and validate candidate rogue PIDs and network ports from incident evidence.
    Filters out OS/system PIDs (<= 1000), protected system daemons, protected research
    processes (when preserve_research is True), and management/control-plane ports.
    """
    candidate_pids: list[int] = []
    candidate_ports: list[int] = []

    for ev in evidence:
        ev_lower = ev.lower()
        is_protected_sys = any(proc in ev_lower for proc in PROTECTED_SYSTEM_PROCESSES)
        is_protected_res = preserve_research and any(
            proc in ev_lower for proc in PROTECTED_RESEARCH_PROCESSES
        )

        if not is_protected_sys and not is_protected_res:
            for match in _PID_PATTERN.finditer(ev):
                candidate_pids.append(int(match.group(1)))

        for port in (3333, 4444, 5555, 8333, 8008):
            if f":{port}" in ev or f"port {port}" in ev_lower:
                candidate_ports.append(port)

        for port_match in _PORT_PATTERN.finditer(ev):
            candidate_port = int(port_match.group(1))
            if 1024 <= candidate_port <= 65535:
                candidate_ports.append(candidate_port)

    valid_pids, _ = validate_target_pids(candidate_pids)
    valid_ports, _ = validate_target_ports(candidate_ports)
    return valid_pids, valid_ports


class PolicyDecisionType(str, Enum):
    """Authorized policy outcomes determined by the policy engine."""

    ALLOW_LEGITIMATE_RESEARCH = "ALLOW_LEGITIMATE_RESEARCH"
    SCHEDULE_MAINTENANCE = "SCHEDULE_MAINTENANCE"
    ALERT_SOC_ONLY = "ALERT_SOC_ONLY"
    SURGICAL_PROCESS_CONTAINMENT = "SURGICAL_PROCESS_CONTAINMENT"
    SURGICAL_NETWORK_ISOLATION = "SURGICAL_NETWORK_ISOLATION"
    ACCOUNT_LOCKOUT = "ACCOUNT_LOCKOUT"
    REQUIRE_HUMAN_APPROVAL = "REQUIRE_HUMAN_APPROVAL"
    MAINTAIN_NORMAL_STATE = "MAINTAIN_NORMAL_STATE"


class PlaybookId(str, Enum):
    """Canonical SOAR playbook identifiers mapped by the policy engine."""

    PLAYBOOK_00_NO_ACTION = "PLAYBOOK_00_NO_ACTION"
    PLAYBOOK_01_ALERT_ONLY = "PLAYBOOK_01_ALERT_ONLY"
    PLAYBOOK_02_PROCESS_CONTAINMENT = "PLAYBOOK_02_PROCESS_CONTAINMENT"
    PLAYBOOK_03_SURGICAL_ISOLATION = "PLAYBOOK_03_SURGICAL_ISOLATION"
    PLAYBOOK_04_MAINTENANCE = "PLAYBOOK_04_MAINTENANCE"
    PLAYBOOK_05_ACCOUNT_RESPONSE = "PLAYBOOK_05_ACCOUNT_RESPONSE"


DECISION_TO_PLAYBOOK: dict[PolicyDecisionType, PlaybookId] = {
    PolicyDecisionType.MAINTAIN_NORMAL_STATE: PlaybookId.PLAYBOOK_00_NO_ACTION,
    PolicyDecisionType.ALERT_SOC_ONLY: PlaybookId.PLAYBOOK_01_ALERT_ONLY,
    PolicyDecisionType.REQUIRE_HUMAN_APPROVAL: PlaybookId.PLAYBOOK_01_ALERT_ONLY,
    PolicyDecisionType.SURGICAL_PROCESS_CONTAINMENT: PlaybookId.PLAYBOOK_02_PROCESS_CONTAINMENT,
    PolicyDecisionType.SURGICAL_NETWORK_ISOLATION: PlaybookId.PLAYBOOK_03_SURGICAL_ISOLATION,
    PolicyDecisionType.ALLOW_LEGITIMATE_RESEARCH: PlaybookId.PLAYBOOK_04_MAINTENANCE,
    PolicyDecisionType.SCHEDULE_MAINTENANCE: PlaybookId.PLAYBOOK_04_MAINTENANCE,
    PolicyDecisionType.ACCOUNT_LOCKOUT: PlaybookId.PLAYBOOK_05_ACCOUNT_RESPONSE,
}

CONTAINMENT_PLAYBOOKS: frozenset[str] = frozenset(
    {
        PlaybookId.PLAYBOOK_02_PROCESS_CONTAINMENT.value,
        PlaybookId.PLAYBOOK_03_SURGICAL_ISOLATION.value,
    }
)


class PolicyEvaluationResult(BaseModel):
    """Formal policy decision generated by the policy engine."""

    workstation_id: UUID
    user_context: IdPIdentityContext
    workstation_context: IdPWorkstationContext
    correlated_incident: CorrelatedIncident
    decision: PolicyDecisionType
    playbook_to_execute: str
    target_pids: list[int] = Field(default_factory=list)
    target_ports: list[int] = Field(default_factory=list)
    preserve_workloads: list[str] = Field(
        default_factory=list,
        description="Protected research job IDs or processes exempt from termination.",
    )
    requires_human_approval: bool = False
    reason: str
    policy_rules_triggered: list[str] = Field(default_factory=list)
    kill_switch_active: bool = False
    evaluated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SecurityPolicyEngine:
    """
    Evaluates correlation results against university identity context,
    enforcing role-sensitive surgical policies and fail-safe boundaries.
    """

    def __init__(self, emergency_kill_switch: bool = False) -> None:
        self._kill_switch: bool = emergency_kill_switch

    def set_emergency_kill_switch(self, active: bool) -> None:
        """
        Emergency kill switch (Rule 19): When active, all automated containment
        and isolation actions are immediately suppressed to prevent accidental disruption.
        """
        self._kill_switch = active
        logger.warning("emergency_kill_switch_toggled", active=active)

    @property
    def is_kill_switch_active(self) -> bool:
        return self._kill_switch

    def evaluate_policy(
        self,
        incident: CorrelatedIncident,
        user_context: IdPIdentityContext,
        ws_context: IdPWorkstationContext,
    ) -> PolicyEvaluationResult:
        """
        Evaluate correlation findings against user role, environment type,
        and registered workloads.
        """
        rules_triggered: list[str] = []
        preserve_workloads: list[str] = []
        requires_human_approval: bool = False

        user_role = (user_context.role or "").strip().upper()
        has_active_research = any(
            w.is_active and w.workload_type in (WorkloadType.HPC_SIMULATION, WorkloadType.MODEL_TRAINING)
            for w in ws_context.active_workloads
        )
        active_workload_ids = [w.job_id for w in ws_context.active_workloads if w.is_active]

        target_pids, target_ports = extract_and_validate_targets(
            incident.evidence,
            preserve_research=(user_role == "RESEARCHER" or has_active_research),
        )
        category = normalize_incident_category(incident.incident_category)

        # -------------------------------------------------------------
        # 1. EMERGENCY KILL SWITCH CHECK (Rule 19)
        # -------------------------------------------------------------
        if self._kill_switch:
            rules_triggered.append("RULE_KILL_SWITCH_ACTIVE")
            decision = PolicyDecisionType.ALERT_SOC_ONLY
            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=[],
                target_ports=target_ports,
                preserve_workloads=active_workload_ids,
                requires_human_approval=True,
                reason="Emergency kill switch is active. Automated destructive containment is suppressed; alert routed to SOC.",
                policy_rules_triggered=rules_triggered,
                kill_switch_active=True,
            )

        # -------------------------------------------------------------
        # 2. IdP OUTAGE / UNCERTAIN IDENTITY SAFE FALLBACK CHECK (Rule 18, 25, Rule 29 Scenario 5)
        #    Identity uncertainty MUST NEVER authorize destructive actions across any severity.
        # -------------------------------------------------------------
        is_uncertain_identity = (
            user_context.is_fallback
            or user_role in ("UNKNOWN", "UNVERIFIED", "")
        )
        if is_uncertain_identity and incident.is_threat:
            rules_triggered.append("RULE_IDP_OUTAGE_SAFE_FALLBACK")
            sev_str = str(
                incident.severity.value if hasattr(incident.severity, "value") else incident.severity
            ).upper()
            requires_human_approval = sev_str in ("HIGH", "CRITICAL")
            decision = (
                PolicyDecisionType.REQUIRE_HUMAN_APPROVAL
                if requires_human_approval
                else PolicyDecisionType.ALERT_SOC_ONLY
            )
            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=[],
                target_ports=target_ports,
                preserve_workloads=active_workload_ids,
                requires_human_approval=requires_human_approval,
                reason=(
                    "Identity provider is unreachable or identity context is unverified. Operating under "
                    "conservative fail-soft policy: automated destructive containment suppressed."
                ),
                policy_rules_triggered=rules_triggered,
            )

        # -------------------------------------------------------------
        # 3. BENIGN HIGH COMPUTE / RESEARCH SIMULATION (Rule 20, Rule 29 Scenario 3)
        # -------------------------------------------------------------
        if (
            category in (IncidentCategory.BENIGN_HIGH_COMPUTE.value, IncidentCategory.BENIGN_HIGH_LOAD.value)
            or (has_active_research and not incident.is_threat)
        ):
            rules_triggered.append("RULE_BENIGN_RESEARCH_COMPUTE")
            preserve_workloads = list(active_workload_ids)
            decision = PolicyDecisionType.ALLOW_LEGITIMATE_RESEARCH

            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=[],
                target_ports=[],
                preserve_workloads=preserve_workloads,
                requires_human_approval=False,
                reason=(
                    f"Workload authorized under {user_role} context ({ws_context.lab or 'Research'}). "
                    "High resource utilization validated as legitimate compute; containment suppressed."
                ),
                policy_rules_triggered=rules_triggered,
            )

        # -------------------------------------------------------------
        # 4. NOMINAL OPERATIONAL BASELINE (Rule 29 Scenario: Baseline Stream)
        # -------------------------------------------------------------
        if category == IncidentCategory.NORMAL.value and not incident.is_threat:
            rules_triggered.append("RULE_NOMINAL_BASELINE_MONITOR")
            decision = PolicyDecisionType.MAINTAIN_NORMAL_STATE
            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=[],
                target_ports=[],
                preserve_workloads=active_workload_ids,
                requires_human_approval=False,
                reason="Nominal operational telemetry. Host operating within established baseline; continuous passive monitoring maintained.",
                policy_rules_triggered=rules_triggered,
            )

        # -------------------------------------------------------------
        # 5. HARDWARE DEGRADATION / TECHNICAL FAILURE (Rule 29 Scenario 1)
        # -------------------------------------------------------------
        if category in (IncidentCategory.HARDWARE_DEGRADATION.value, IncidentCategory.TECHNICAL_FAULT.value):
            rules_triggered.append("RULE_TECHNICAL_MAINTENANCE")
            decision = PolicyDecisionType.SCHEDULE_MAINTENANCE
            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=[],
                target_ports=[],
                preserve_workloads=active_workload_ids,
                requires_human_approval=False,
                reason="Technical performance degradation or hardware fault diagnosed. Maintenance advisory dispatched without security isolation.",
                policy_rules_triggered=rules_triggered,
            )

        # -------------------------------------------------------------
        # 6. CRYPTOJACKING DETECTION — ROLE-SENSITIVE RESOLUTION (Rule 20, Rule 29 Scenario 2 & 3)
        # -------------------------------------------------------------
        if category == IncidentCategory.CRYPTOJACKING.value:
            if user_role == "RESEARCHER" or has_active_research:
                # Researcher context: Surgical targeting only (terminate miner, preserve research workload)
                rules_triggered.append("RULE_RESEARCHER_SURGICAL_CONTAINMENT")
                preserve_workloads = list(active_workload_ids)
                decision = PolicyDecisionType.SURGICAL_PROCESS_CONTAINMENT

                return PolicyEvaluationResult(
                    workstation_id=incident.workstation_id,
                    user_context=user_context,
                    workstation_context=ws_context,
                    correlated_incident=incident,
                    decision=decision,
                    playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                    target_pids=target_pids,
                    target_ports=target_ports,
                    preserve_workloads=preserve_workloads,
                    requires_human_approval=False,
                    reason=(
                        "Cryptojacking detected on Researcher workstation. Executing surgical process "
                        f"containment and port blocking to terminate miner while preserving active research jobs {preserve_workloads}."
                    ),
                    policy_rules_triggered=rules_triggered,
                )
            else:
                # Student / Generic Lab PC: Swift surgical isolation
                rules_triggered.append("RULE_STUDENT_CRYPTOJACKING_ISOLATION")
                decision = PolicyDecisionType.SURGICAL_NETWORK_ISOLATION
                return PolicyEvaluationResult(
                    workstation_id=incident.workstation_id,
                    user_context=user_context,
                    workstation_context=ws_context,
                    correlated_incident=incident,
                    decision=decision,
                    playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                    target_pids=target_pids,
                    target_ports=target_ports,
                    preserve_workloads=[],
                    requires_human_approval=False,
                    reason="Unauthorized cryptojacking mining activity confirmed on standard workstation. Authorizing surgical network isolation.",
                    policy_rules_triggered=rules_triggered,
                )

        # -------------------------------------------------------------
        # 7. APT INTRUSION / PRIVILEGE ESCALATION / DATA EXFILTRATION (Rule 29 Scenario 4)
        # -------------------------------------------------------------
        if category in (IncidentCategory.APT_INTRUSION.value, IncidentCategory.DATA_EXFILTRATION.value):
            rules_triggered.append("RULE_APT_SURGICAL_ISOLATION")
            decision = PolicyDecisionType.SURGICAL_NETWORK_ISOLATION
            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=target_pids,
                target_ports=target_ports,
                preserve_workloads=active_workload_ids,
                requires_human_approval=False,
                reason="Severe security threat (APT intrusion / credential dumping / unauthorized exfiltration). Authorizing immediate host containment.",
                policy_rules_triggered=rules_triggered,
            )

        # -------------------------------------------------------------
        # 8. BRUTE FORCE / UNAUTHORIZED ACCESS
        # -------------------------------------------------------------
        if category in (
            IncidentCategory.BRUTE_FORCE_ATTACK.value,
            IncidentCategory.UNAUTHORIZED_ACCESS.value,
        ):
            if has_active_research and user_role == "RESEARCHER":
                rules_triggered.append("RULE_RESEARCHER_UNAUTHORIZED_APPROVAL")
                decision = PolicyDecisionType.REQUIRE_HUMAN_APPROVAL
                return PolicyEvaluationResult(
                    workstation_id=incident.workstation_id,
                    user_context=user_context,
                    workstation_context=ws_context,
                    correlated_incident=incident,
                    decision=decision,
                    playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                    target_pids=[],
                    target_ports=target_ports,
                    preserve_workloads=active_workload_ids,
                    requires_human_approval=True,
                    reason=(
                        "Unauthorized access attempt on active Researcher compute node. "
                        f"Preserving running jobs {active_workload_ids} and escalating account lockout for SOC approval."
                    ),
                    policy_rules_triggered=rules_triggered,
                )

            rules_triggered.append("RULE_BRUTE_FORCE_LOCKOUT")
            decision = PolicyDecisionType.ACCOUNT_LOCKOUT
            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=[],
                target_ports=[],
                preserve_workloads=[],
                requires_human_approval=False,
                reason="Multiple authentication failures or unauthorized access signature detected. Authorizing temporary account lockout.",
                policy_rules_triggered=rules_triggered,
            )

        # -------------------------------------------------------------
        # 9. GENERIC ML SECURITY ANOMALY (Uncorroborated by specific SIEM rule)
        # -------------------------------------------------------------
        if category == IncidentCategory.SECURITY_ANOMALY_GENERIC.value:
            rules_triggered.append("RULE_GENERIC_SECURITY_ALERT")
            decision = PolicyDecisionType.ALERT_SOC_ONLY
            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=target_pids,
                target_ports=target_ports,
                preserve_workloads=active_workload_ids,
                requires_human_approval=False,
                reason="Uncorroborated ML security anomaly flagged for SOC triage without automated destructive action.",
                policy_rules_triggered=rules_triggered,
            )

        # -------------------------------------------------------------
        # 10. SAFE DEFAULT FALLBACK POLICY (Rule 18, 25)
        # -------------------------------------------------------------
        if is_uncertain_identity:
            rules_triggered.append("RULE_IDP_OUTAGE_SAFE_FALLBACK")
            sev_str = str(
                incident.severity.value if hasattr(incident.severity, "value") else incident.severity
            ).upper()
            requires_human_approval = sev_str in ("HIGH", "CRITICAL")
            decision = (
                PolicyDecisionType.REQUIRE_HUMAN_APPROVAL
                if requires_human_approval
                else PolicyDecisionType.ALERT_SOC_ONLY
            )
            return PolicyEvaluationResult(
                workstation_id=incident.workstation_id,
                user_context=user_context,
                workstation_context=ws_context,
                correlated_incident=incident,
                decision=decision,
                playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
                target_pids=[],
                target_ports=target_ports,
                preserve_workloads=active_workload_ids,
                requires_human_approval=requires_human_approval,
                reason="Identity provider is unreachable. Operating under conservative fail-soft policy: high-risk containment queued for human SOC approval.",
                policy_rules_triggered=rules_triggered,
            )

        rules_triggered.append("RULE_DEFAULT_ALERT")
        decision = PolicyDecisionType.ALERT_SOC_ONLY
        return PolicyEvaluationResult(
            workstation_id=incident.workstation_id,
            user_context=user_context,
            workstation_context=ws_context,
            correlated_incident=incident,
            decision=decision,
            playbook_to_execute=DECISION_TO_PLAYBOOK[decision].value,
            target_pids=target_pids,
            target_ports=target_ports,
            preserve_workloads=active_workload_ids,
            requires_human_approval=False,
            reason=f"Security event category '{incident.incident_category}' logged for SOC review.",
            policy_rules_triggered=rules_triggered,
        )


# Global singleton instance
policy_engine = SecurityPolicyEngine()

