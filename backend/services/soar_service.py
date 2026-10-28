"""
Secure-MaintAI — SOAR Automated Playbook Execution Engine.

Per engineering rules:
- Rule 21: قرارات آلية، محددة، قابلة للتدقيق، ومتحكم بها.
  Playbooks are deterministic, versioned, auditable, permission-controlled,
  independently testable, and idempotent.
- Rule 19: الاحتواء الجراحي دون إعادة تشغيل نظام التشغيل المضيف. سجلات تدقيق شاملة.
  Surgical containment without rebooting the host OS. Full audit trails
  recording operator identity, reason, confidence, evidence, and rollback support.
- Rule 24: Security actions must always generate audit events.
"""

import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.logging import get_logger
from backend.models.alert import Alert
from backend.models.anomaly import AnomalyDetection
from backend.models.incident import Incident
from backend.models.security_event import SecurityEvent
from backend.models.user import UserAccount
from backend.models.workstation import Workstation
from backend.schemas.idp import IdPIdentityContext, IdPWorkstationContext
from backend.services.alert_broadcaster import alert_broadcaster
from backend.services.audit import AuditService
from backend.services.idp_service import idp_service
from security.correlation_engine import CorrelatedIncident, correlation_engine
from security.policy_engine import (
    CONTAINMENT_PLAYBOOKS,
    PROTECTED_MANAGEMENT_PORTS,
    PlaybookId,
    PolicyDecisionType,
    PolicyEvaluationResult,
    policy_engine,
    validate_target_pids,
    validate_target_ports,
)

logger = get_logger("soar_service")


async def _broadcast_soar_alert(alert: Alert) -> None:
    """Safely notify SSE clients of newly dispatched SOAR alert."""
    try:
        await alert_broadcaster.broadcast(
            "ALERT_CREATED",
            {
                "id": str(alert.id),
                "title": alert.title,
                "severity": alert.severity,
                "status": alert.status,
                "workstation_id": str(alert.workstation_id) if alert.workstation_id else None,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
            },
        )
    except Exception as exc:
        logger.warning("sse_alert_broadcast_failed", error=str(exc))


class PlaybookExecutionResult(BaseModel):
    """Execution receipt returned after executing a SOAR playbook."""

    playbook_name: str
    playbook_version: str
    workstation_id: UUID
    status: str = Field(..., description="'SUCCESS', 'FAILED', 'SUPPRESSED', 'SKIPPED', 'NOMINAL'")
    execution_mode: str = Field(
        default="RECORDED_CONTROL_PLANE",
        description="'RECORDED_CONTROL_PLANE' (persisted in control plane / awaiting agent ACK) vs 'CONFIRMED_ENDPOINT_ENFORCEMENT'",
    )
    action_taken: str
    incident_id: UUID | None = None
    alert_id: UUID | None = None
    audit_id: UUID | None = None
    audit_integrity_hash: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    can_rollback: bool = True
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SOARService:
    """
    Orchestration service executing versioned SOAR playbooks based on
    policy engine authorization decisions.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._audit = AuditService(session)

    @staticmethod
    def validate_pids(pids: list[int]) -> tuple[list[int], list[int]]:
        """Delegate PID validation to the canonical validator in security.policy_engine."""
        return validate_target_pids(pids)

    @staticmethod
    def validate_ports(ports: list[int]) -> tuple[list[int], list[int]]:
        """Delegate port validation to the canonical validator in security.policy_engine."""
        return validate_target_ports(ports)

    @staticmethod
    def resolve_human_intervention_status(playbook_initiated: str | None) -> str:
        """Determine post-approval alert status based on canonical containment playbooks."""
        if playbook_initiated in CONTAINMENT_PLAYBOOKS:
            return "CONTAINED"
        return "ACKNOWLEDGED"

    async def evaluate_and_execute(
        self,
        workstation_id: UUID,
        anomalies: Sequence[AnomalyDetection],
        security_events: Sequence[SecurityEvent],
        target_user_id: UUID | str,
        workstation_name: str | None = None,
        auto_execute: bool = True,
        skip_if_human_approval: bool = False,
        operator: str = "system:soar-engine",
        endpoint_confirmed: bool = False,
    ) -> tuple[
        CorrelatedIncident,
        IdPIdentityContext,
        IdPWorkstationContext,
        PolicyEvaluationResult,
        PlaybookExecutionResult | None,
    ]:
        """
        Execute the unified 4-stage Resilience Decision Pipeline:
        1. Multi-source correlation (ML anomalies + SIEM security events)
        2. University IdP identity & active research workload resolution
        3. Role-sensitive Security Policy Engine evaluation
        4. Authorized SOAR Playbook execution
        """
        incident = correlation_engine.correlate_workstation(
            workstation_id=workstation_id,
            anomalies=anomalies,
            security_events=security_events,
            workstation_name=workstation_name,
        )
        user_context = await idp_service.get_user_context(target_user_id, session=self._session)
        ws_context = await idp_service.get_workstation_context(workstation_id, session=self._session)
        evaluation = policy_engine.evaluate_policy(
            incident=incident,
            user_context=user_context,
            ws_context=ws_context,
        )

        playbook_res: PlaybookExecutionResult | None = None
        should_execute = auto_execute and not (
            skip_if_human_approval and evaluation.requires_human_approval
        )
        if should_execute:
            playbook_res = await self.execute_policy_decision(
                evaluation=evaluation,
                operator=operator,
                endpoint_confirmed=endpoint_confirmed,
            )

        return incident, user_context, ws_context, evaluation, playbook_res

    async def execute_policy_decision(
        self,
        evaluation: PolicyEvaluationResult,
        operator: str = "system:soar-engine",
        endpoint_confirmed: bool = False,
    ) -> PlaybookExecutionResult:
        """
        Dispatch and execute the authorized SOAR playbook for a policy evaluation result.
        """
        playbook = evaluation.playbook_to_execute
        exec_mode = (
            "CONFIRMED_ENDPOINT_ENFORCEMENT"
            if endpoint_confirmed
            else "RECORDED_CONTROL_PLANE"
        )

        if evaluation.kill_switch_active:
            return await self._execute_playbook_alert_only(
                evaluation,
                operator=operator,
                suppression_reason="EMERGENCY_KILL_SWITCH_ACTIVE",
                execution_mode=exec_mode,
            )

        if (
            playbook in (PlaybookId.PLAYBOOK_00_NO_ACTION.value, "NONE")
            or evaluation.decision == PolicyDecisionType.MAINTAIN_NORMAL_STATE
        ):
            return PlaybookExecutionResult(
                playbook_name=PlaybookId.PLAYBOOK_00_NO_ACTION.value,
                playbook_version="1.0.0",
                workstation_id=evaluation.workstation_id,
                status="NOMINAL",
                execution_mode=exec_mode,
                action_taken="Continuous passive monitoring maintained. No incident, alert, or containment actions required.",
                incident_id=None,
                alert_id=None,
                audit_id=None,
                audit_integrity_hash=None,
                details={"preserved_jobs": list(evaluation.preserve_workloads)},
                can_rollback=False,
            )

        if playbook == PlaybookId.PLAYBOOK_01_ALERT_ONLY.value:
            return await self._execute_playbook_alert_only(
                evaluation, operator=operator, execution_mode=exec_mode
            )
        elif playbook == PlaybookId.PLAYBOOK_02_PROCESS_CONTAINMENT.value:
            return await self._execute_playbook_process_containment(
                evaluation, operator=operator, execution_mode=exec_mode
            )
        elif playbook == PlaybookId.PLAYBOOK_03_SURGICAL_ISOLATION.value:
            return await self._execute_playbook_surgical_isolation(
                evaluation, operator=operator, execution_mode=exec_mode
            )
        elif playbook == PlaybookId.PLAYBOOK_04_MAINTENANCE.value:
            return await self._execute_playbook_maintenance(
                evaluation, operator=operator, execution_mode=exec_mode
            )
        elif playbook == PlaybookId.PLAYBOOK_05_ACCOUNT_RESPONSE.value:
            return await self._execute_playbook_account_response(
                evaluation, operator=operator, execution_mode=exec_mode
            )
        else:
            return await self._execute_playbook_alert_only(
                evaluation, operator=operator, execution_mode=exec_mode
            )

    async def _find_active_cooldown_incident_alert(
        self,
        workstation_id: UUID,
        category: str,
        cooldown_seconds: int = 300,
    ) -> tuple[Incident, Alert] | None:
        """
        Deduplication and rate-limiting guard (Rules 19 & 21).
        Finds existing active OPEN or CONTAINED alert and incident for the same
        workstation and category within the cooldown window to prevent alert flooding.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=cooldown_seconds)
        stmt = (
            select(Alert)
            .where(
                Alert.workstation_id == workstation_id,
                Alert.status.in_(["OPEN", "CONTAINED", "MONITORED", "ACKNOWLEDGED"]),
                Alert.created_at >= cutoff,
            )
            .order_by(Alert.created_at.desc())
        )
        res = await self._session.execute(stmt)
        for alert in res.scalars().all():
            if alert.source_id:
                inc_res = await self._session.execute(
                    select(Incident).where(Incident.id == alert.source_id)
                )
                inc = inc_res.scalar_one_or_none()
                if inc and inc.category == category and inc.status not in ["RESOLVED", "CLOSED"]:
                    return inc, alert
        return None

    async def _execute_playbook_alert_only(
        self,
        eval_res: PolicyEvaluationResult,
        operator: str,
        suppression_reason: str | None = None,
        execution_mode: str = "RECORDED_CONTROL_PLANE",
    ) -> PlaybookExecutionResult:
        """Playbook 1: Alert Only (v1.0.0). Creates Incident & Alert without host modification."""
        category = "SECURITY_THREAT" if eval_res.correlated_incident.is_threat else "TECHNICAL_FAILURE"
        is_human_intervention = eval_res.requires_human_approval or bool(suppression_reason)
        existing = await self._find_active_cooldown_incident_alert(eval_res.workstation_id, category)

        if existing:
            inc, alert = existing
            logger.info("soar_service: deduplicated active incident %s for workstation %s", inc.incident_number, eval_res.workstation_id)
        else:
            inc_num = f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            inc = Incident(
                incident_number=inc_num,
                severity=eval_res.correlated_incident.severity,
                category=category,
                workstation_id=eval_res.workstation_id,
                status="OPEN",
                title=f"Alert: {eval_res.correlated_incident.incident_category}",
                description=eval_res.reason,
                response_action=f"PLAYBOOK_01_ALERT_ONLY (Suppression: {suppression_reason})"
                if suppression_reason
                else "PLAYBOOK_01_ALERT_ONLY",
            )
            self._session.add(inc)
            await self._session.flush()

            source_type = (
                "HUMAN_INTERVENTION_REQUIRED"
                if is_human_intervention
                else "CYBERSECURITY_THREAT"
                if eval_res.correlated_incident.is_threat
                else "TECHNICAL_ANOMALY"
            )
            title = (
                f"Human Intervention Required: {eval_res.correlated_incident.incident_category}"
                if is_human_intervention
                else f"Cybersecurity Threat: {eval_res.correlated_incident.incident_category}"
                if eval_res.correlated_incident.is_threat
                else f"Technical Anomaly: {eval_res.correlated_incident.incident_category}"
            )
            recommendation = (
                "Action halted: Requires manual SOC authorization to execute containment."
                if is_human_intervention
                else "Investigate threat telemetry and monitor endpoint activity."
            )

            alert = Alert(
                source_type=source_type,
                source_id=inc.id,
                workstation_id=eval_res.workstation_id,
                severity=eval_res.correlated_incident.severity,
                status="OPEN",
                title=title,
                description=eval_res.reason,
                requires_human_intervention=is_human_intervention,
                recommendation=recommendation,
                playbook_initiated="PLAYBOOK_01_ALERT_ONLY",
            )
            self._session.add(alert)
            await self._session.flush()

        audit_entry = await self._audit.log(
            actor=operator,
            action="soar.playbook.alert_only",
            resource=f"workstation:{eval_res.workstation_id}",
            result="success",
            metadata_={
                "incident_id": str(inc.id),
                "alert_id": str(alert.id),
                "category": eval_res.correlated_incident.incident_category,
                "suppression_reason": suppression_reason,
                "execution_mode": execution_mode,
            },
        )
        await self._session.commit()
        await _broadcast_soar_alert(alert)

        return PlaybookExecutionResult(
            playbook_name="PLAYBOOK_01_ALERT_ONLY",
            playbook_version="1.0.0",
            workstation_id=eval_res.workstation_id,
            status="SUCCESS" if not suppression_reason else "SUPPRESSED",
            execution_mode=execution_mode,
            action_taken="Dispatched SOC alert notification without host disruption.",
            incident_id=inc.id,
            alert_id=alert.id,
            audit_id=audit_entry.id,
            audit_integrity_hash=audit_entry.integrity_hash,
            details={
                "requires_human_approval": is_human_intervention,
                "preserved_jobs": list(eval_res.preserve_workloads),
            },
            can_rollback=False,
        )

    async def _execute_playbook_process_containment(
        self,
        eval_res: PolicyEvaluationResult,
        operator: str,
        execution_mode: str = "RECORDED_CONTROL_PLANE",
    ) -> PlaybookExecutionResult:
        """
        Playbook 2: Targeted Process Containment (v1.0.0).
        Terminates specific rogue miner/malware processes without terminating protected research jobs.
        """
        valid_pids, rejected_pids = self.validate_pids(eval_res.target_pids)
        valid_ports, rejected_ports = self.validate_ports(eval_res.target_ports)

        existing = await self._find_active_cooldown_incident_alert(eval_res.workstation_id, "SECURITY_THREAT")
        if existing:
            inc, alert = existing
            inc_id = inc.id
            alert_id = alert.id
            logger.info("soar_service: deduplicated active incident %s for workstation %s", inc.incident_number, eval_res.workstation_id)
        else:
            inc_id = uuid.uuid4()
            inc_num = f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            inc = Incident(
                id=inc_id,
                incident_number=inc_num,
                severity=eval_res.correlated_incident.severity,
                category="SECURITY_THREAT",
                workstation_id=eval_res.workstation_id,
                status="CONTAINED",
                title=f"Surgical Containment: {eval_res.correlated_incident.incident_category}",
                description=eval_res.reason,
                response_action=(
                    f"[{execution_mode}] Surgically blocked ports {valid_ports} and targeted rogue PIDs {valid_pids} "
                    f"while protecting active research workloads: {eval_res.preserve_workloads}"
                ),
            )
            self._session.add(inc)

            alert_id = uuid.uuid4()
            alert = Alert(
                id=alert_id,
                source_type="CYBERSECURITY_THREAT",
                source_id=inc_id,
                workstation_id=eval_res.workstation_id,
                severity=eval_res.correlated_incident.severity,
                status="OPEN",
                title=f"Surgical Process Containment: {eval_res.correlated_incident.incident_category}",
                description=eval_res.reason,
                requires_human_intervention=False,
                recommendation=f"Offending sockets/pids contained. Research workloads {eval_res.preserve_workloads} preserved.",
                playbook_initiated="PLAYBOOK_02_PROCESS_CONTAINMENT",
            )
            self._session.add(alert)

        audit_entry = await self._audit.log(
            actor=operator,
            action="soar.playbook.process_containment",
            resource=f"workstation:{eval_res.workstation_id}",
            result="success",
            metadata_={
                "incident_id": str(inc_id),
                "alert_id": str(alert_id),
                "target_ports": valid_ports,
                "rejected_ports": rejected_ports,
                "target_pids": valid_pids,
                "rejected_pids": rejected_pids,
                "preserved_workloads": eval_res.preserve_workloads,
                "role": eval_res.user_context.role,
                "execution_mode": execution_mode,
            },
        )
        await self._session.commit()
        await _broadcast_soar_alert(alert)

        return PlaybookExecutionResult(
            playbook_name="PLAYBOOK_02_PROCESS_CONTAINMENT",
            playbook_version="1.0.0",
            workstation_id=eval_res.workstation_id,
            status="SUCCESS",
            execution_mode=execution_mode,
            action_taken=(
                f"Surgically contained unauthorized process/ports {valid_ports} "
                f"while keeping research jobs {eval_res.preserve_workloads} uninterrupted."
            ),
            incident_id=inc.id,
            alert_id=alert.id,
            audit_id=audit_entry.id,
            audit_integrity_hash=audit_entry.integrity_hash,
            details={
                "preserved_jobs": eval_res.preserve_workloads,
                "blocked_ports": valid_ports,
                "rejected_ports": rejected_ports,
                "terminated_pids": valid_pids,
                "rejected_pids": rejected_pids,
                "execution_mode": execution_mode,
            },
            can_rollback=True,
        )

    async def _execute_playbook_surgical_isolation(
        self,
        eval_res: PolicyEvaluationResult,
        operator: str,
        execution_mode: str = "RECORDED_CONTROL_PLANE",
    ) -> PlaybookExecutionResult:
        """
        Playbook 3: Surgical Network Isolation (v1.0.0).
        Isolates the endpoint network to prevent lateral movement or C2 exfiltration
        without rebooting or terminating the host OS (Rule 19).
        """
        valid_pids, rejected_pids = self.validate_pids(eval_res.target_pids)
        valid_ports, rejected_ports = self.validate_ports(eval_res.target_ports)

        # Update workstation status to ISOLATED
        ws_res = await self._session.execute(select(Workstation).where(Workstation.id == eval_res.workstation_id))
        ws = ws_res.scalar_one_or_none()
        if ws is not None:
            ws.status = "ISOLATED"

        existing = await self._find_active_cooldown_incident_alert(eval_res.workstation_id, "SECURITY_THREAT")
        if existing:
            inc, alert = existing
            inc_id = inc.id
            alert_id = alert.id
            logger.info("soar_service: deduplicated active incident %s for workstation %s", inc.incident_number, eval_res.workstation_id)
        else:
            inc_id = uuid.uuid4()
            inc_num = f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            inc = Incident(
                id=inc_id,
                incident_number=inc_num,
                severity=eval_res.correlated_incident.severity,
                category="SECURITY_THREAT",
                workstation_id=eval_res.workstation_id,
                status="CONTAINED",
                title=f"Host Surgical Isolation: {eval_res.correlated_incident.incident_category}",
                description=eval_res.reason,
                response_action="Surgical host network isolation applied. Host remains online; telemetry channel preserved.",
            )
            self._session.add(inc)

            alert_id = uuid.uuid4()
            alert = Alert(
                id=alert_id,
                source_type="CYBERSECURITY_THREAT",
                source_id=inc_id,
                workstation_id=eval_res.workstation_id,
                severity=eval_res.correlated_incident.severity,
                status="OPEN",
                title=f"Host Surgical Isolation: {eval_res.correlated_incident.incident_category}",
                description=eval_res.reason,
                requires_human_intervention=False,
                recommendation="Host network isolated. Review telemetry and perform malware eradication before reconnecting.",
                playbook_initiated="PLAYBOOK_03_SURGICAL_ISOLATION",
            )
            self._session.add(alert)

        audit_entry = await self._audit.log(
            actor=operator,
            action="soar.playbook.surgical_isolation",
            resource=f"workstation:{eval_res.workstation_id}",
            result="success",
            metadata_={
                "incident_id": str(inc_id),
                "alert_id": str(alert_id),
                "category": eval_res.correlated_incident.incident_category,
                "evidence": eval_res.correlated_incident.evidence,
                "role": eval_res.user_context.role,
                "isolation_mode": "SURGICAL_NETWORK_DROP",
                "blocked_ports": valid_ports,
                "rejected_ports": rejected_ports,
                "target_pids": valid_pids,
                "rejected_pids": rejected_pids,
                "execution_mode": execution_mode,
            },
        )
        await self._session.commit()
        await _broadcast_soar_alert(alert)

        return PlaybookExecutionResult(
            playbook_name="PLAYBOOK_03_SURGICAL_ISOLATION",
            playbook_version="1.0.0",
            workstation_id=eval_res.workstation_id,
            status="SUCCESS",
            execution_mode=execution_mode,
            action_taken="Applied surgical network isolation rules to host. Management agent telemetry remains active.",
            incident_id=inc.id,
            alert_id=alert.id,
            audit_id=audit_entry.id,
            audit_integrity_hash=audit_entry.integrity_hash,
            details={
                "blocked_ports": valid_ports,
                "rejected_ports": rejected_ports,
                "terminated_pids": valid_pids,
                "rejected_pids": rejected_pids,
                "preserved_management_ports": sorted(PROTECTED_MANAGEMENT_PORTS),
                "execution_mode": execution_mode,
            },
            can_rollback=True,
        )

    async def _execute_playbook_maintenance(
        self,
        eval_res: PolicyEvaluationResult,
        operator: str,
        execution_mode: str = "RECORDED_CONTROL_PLANE",
    ) -> PlaybookExecutionResult:
        """
        Playbook 4: Predictive Maintenance & Authorized Compute Advisory (v1.0.0).
        Dispatches hardware/performance maintenance ticket for technical faults (Scenario 1)
        or records authorized research compute preservation without false fault alerts (Scenario 3).
        """
        is_research_allow = eval_res.decision == PolicyDecisionType.ALLOW_LEGITIMATE_RESEARCH
        inc_num = f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        inc_title = (
            f"Authorized Research Compute: {eval_res.correlated_incident.incident_category}"
            if is_research_allow
            else f"Maintenance Advisory: {eval_res.correlated_incident.incident_category}"
        )
        inc_action = (
            f"Verified authorized research jobs {eval_res.preserve_workloads}; compute state preserved without containment."
            if is_research_allow
            else "Dispatched hardware inspection / predictive maintenance ticket."
        )

        inc_id = uuid.uuid4()
        inc = Incident(
            id=inc_id,
            incident_number=inc_num,
            severity=eval_res.correlated_incident.severity,
            category="MAINTENANCE",
            workstation_id=eval_res.workstation_id,
            status="RESOLVED" if is_research_allow else "OPEN",
            title=inc_title,
            description=eval_res.reason,
            response_action=inc_action,
        )
        self._session.add(inc)

        alert_id = uuid.uuid4()
        alert_title = (
            f"Authorized Research Workload Preserved: {eval_res.correlated_incident.incident_category}"
            if is_research_allow
            else f"Predictive Maintenance: {eval_res.correlated_incident.incident_category}"
        )
        alert_rec = (
            f"Authorized research compute verified ({eval_res.preserve_workloads}). State preserved without containment or service interruption."
            if is_research_allow
            else "Hardware degradation or technical fault diagnosed. Technician inspection and maintenance servicing recommended."
        )

        alert = Alert(
            id=alert_id,
            source_type="PREDICTIVE_MAINTENANCE",
            source_id=inc_id,
            workstation_id=eval_res.workstation_id,
            severity=eval_res.correlated_incident.severity,
            status="RESOLVED" if is_research_allow else "OPEN",
            title=alert_title,
            description=eval_res.reason,
            requires_human_intervention=False,
            recommendation=alert_rec,
            playbook_initiated="PLAYBOOK_04_MAINTENANCE",
        )
        self._session.add(alert)

        audit_entry = await self._audit.log(
            actor=operator,
            action="soar.playbook.research_workload_preserved" if is_research_allow else "soar.playbook.maintenance_advisory",
            resource=f"workstation:{eval_res.workstation_id}",
            result="success",
            metadata_={
                "incident_id": str(inc_id),
                "alert_id": str(alert_id),
                "category": eval_res.correlated_incident.incident_category,
                "decision": eval_res.decision.value,
                "preserved_workloads": eval_res.preserve_workloads,
                "reason": eval_res.reason,
                "execution_mode": execution_mode,
            },
        )
        await self._session.commit()
        await _broadcast_soar_alert(alert)

        action_msg = (
            f"Verified authorized research workload {eval_res.preserve_workloads}. Active compute state preserved without containment."
            if is_research_allow
            else "Logged maintenance ticket. Active compute workloads preserved without containment."
        )

        return PlaybookExecutionResult(
            playbook_name="PLAYBOOK_04_MAINTENANCE",
            playbook_version="1.0.0",
            workstation_id=eval_res.workstation_id,
            status="SUCCESS",
            execution_mode=execution_mode,
            action_taken=action_msg,
            incident_id=inc.id,
            alert_id=alert.id,
            audit_id=audit_entry.id,
            audit_integrity_hash=audit_entry.integrity_hash,
            details={
                "preserved_jobs": list(eval_res.preserve_workloads),
                "is_authorized_research": is_research_allow,
                "execution_mode": execution_mode,
            },
            can_rollback=False,
        )

    async def _execute_playbook_account_response(
        self,
        eval_res: PolicyEvaluationResult,
        operator: str,
        execution_mode: str = "RECORDED_CONTROL_PLANE",
    ) -> PlaybookExecutionResult:
        """
        Playbook 5: Account Lockout & Credential Revocation (v1.0.0).
        """
        # If user_id exists in user table, update status to locked
        user_id_str = eval_res.user_context.user_id
        try:
            user_uuid = UUID(user_id_str)
            res = await self._session.execute(select(UserAccount).where(UserAccount.id == user_uuid))
            usr = res.scalar_one_or_none()
            if usr is not None:
                usr.status = "locked"
        except (ValueError, TypeError):
            pass

        inc_num = f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        inc = Incident(
            incident_number=inc_num,
            severity=eval_res.correlated_incident.severity,
            category="POLICY_VIOLATION",
            workstation_id=eval_res.workstation_id,
            status="CONTAINED",
            title=f"Account Response: {eval_res.user_context.username}",
            description=eval_res.reason,
            response_action="Locked user account and revoked active session tokens.",
        )
        self._session.add(inc)
        await self._session.flush()

        alert = Alert(
            source_type="CYBERSECURITY_THREAT",
            source_id=inc.id,
            workstation_id=eval_res.workstation_id,
            severity=eval_res.correlated_incident.severity,
            status="OPEN",
            title=f"Account Response: {eval_res.user_context.username}",
            description=eval_res.reason,
            requires_human_intervention=False,
            recommendation="User credentials locked. Reset user password and verify session integrity.",
            playbook_initiated="PLAYBOOK_05_ACCOUNT_RESPONSE",
        )
        self._session.add(alert)
        await self._session.flush()

        audit_entry = await self._audit.log(
            actor=operator,
            action="soar.playbook.account_response",
            resource=f"user:{eval_res.user_context.user_id}",
            result="success",
            metadata_={
                "incident_id": str(inc.id),
                "alert_id": str(alert.id),
                "username": eval_res.user_context.username,
                "role": eval_res.user_context.role,
                "execution_mode": execution_mode,
            },
        )
        await self._session.commit()
        await _broadcast_soar_alert(alert)

        return PlaybookExecutionResult(
            playbook_name="PLAYBOOK_05_ACCOUNT_RESPONSE",
            playbook_version="1.0.0",
            workstation_id=eval_res.workstation_id,
            status="SUCCESS",
            execution_mode=execution_mode,
            action_taken=f"Locked account for user {eval_res.user_context.username}.",
            incident_id=inc.id,
            alert_id=alert.id,
            audit_id=audit_entry.id,
            audit_integrity_hash=audit_entry.integrity_hash,
            details={
                "locked_username": eval_res.user_context.username,
                "execution_mode": execution_mode,
            },
            can_rollback=True,
        )

    async def rollback_isolation(
        self,
        workstation_id: UUID,
        operator: str,
    ) -> bool:
        """
        Rollback surgical isolation: restores workstation status to ONLINE and logs audit trail.
        """
        res = await self._session.execute(select(Workstation).where(Workstation.id == workstation_id))
        ws = res.scalar_one_or_none()
        if ws is None:
            return False

        ws.status = "ONLINE"
        await self._audit.log(
            actor=operator,
            action="soar.rollback.surgical_isolation",
            resource=f"workstation:{workstation_id}",
            result="success",
            metadata_={"restored_status": "ONLINE"},
        )
        await self._session.commit()
        logger.info("surgical_isolation_rolled_back", workstation_id=str(workstation_id))
        return True

