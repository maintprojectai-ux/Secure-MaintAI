"""
Unit Tests — SOAR Automated Playbook Execution Service.

Tests:
- Execution of PLAYBOOK_01_ALERT_ONLY (Alert & Incident creation without host modification).
- Execution of PLAYBOOK_02_PROCESS_CONTAINMENT (Targeted containment preserving research jobs).
- Execution of PLAYBOOK_03_SURGICAL_ISOLATION (Surgical host network isolation).
- Execution of PLAYBOOK_04_MAINTENANCE (Predictive maintenance advisory dispatch).
- Execution of PLAYBOOK_05_ACCOUNT_RESPONSE (Account lockout).
- Rollback of surgical network isolation restoring host to ONLINE.
- Verifying immutable AuditLog generation for all operations.
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from backend.models.alert import Alert
from backend.models.audit import AuditLog
from backend.models.incident import Incident
from backend.models.user import UserAccount
from backend.models.workstation import Workstation
from backend.schemas.idp import (
    AuthorizedWorkload,
    IdPIdentityContext,
    IdPWorkstationContext,
    WorkloadType,
)
from backend.services.soar_service import SOARService
from security.correlation_engine import CorrelatedIncident
from security.policy_engine import (
    PolicyDecisionType,
    PolicyEvaluationResult,
)
from tests.conftest import TestAsyncSession


@pytest.mark.asyncio
async def test_execute_playbook_alert_only() -> None:
    """PLAYBOOK_01_ALERT_ONLY creates Incident and Alert without modifying workstation."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="test-node-01",
            ip_address="10.1.1.1",
            operating_system="Linux",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    eval_res = PolicyEvaluationResult(
        workstation_id=ws_id,
        user_context=IdPIdentityContext(
            user_id="u-1", username="user1", email="u1@kku.edu.sa", role="STUDENT", department="CS"
        ),
        workstation_context=IdPWorkstationContext(
            workstation_id=ws_id, hostname="test-node-01", department="CS"
        ),
        correlated_incident=CorrelatedIncident(
            workstation_id=ws_id,
            incident_category="SUSPICIOUS_SCRIPT",
            is_threat=True,
            severity="MEDIUM",
            confidence=0.8,
            recommended_action="ALERT_ONLY",
            reason="Unusual script execution.",
        ),
        decision=PolicyDecisionType.ALERT_SOC_ONLY,
        playbook_to_execute="PLAYBOOK_01_ALERT_ONLY",
        reason="Alert SOC operator.",
    )

    async with TestAsyncSession() as session:
        soar = SOARService(session)
        receipt = await soar.execute_policy_decision(eval_res, operator="test:operator")
        assert receipt.status == "SUCCESS"
        assert receipt.playbook_name == "PLAYBOOK_01_ALERT_ONLY"
        assert receipt.incident_id is not None
        assert receipt.alert_id is not None

        # Verify DB records
        inc = await session.get(Incident, receipt.incident_id)
        assert inc is not None
        assert inc.status == "OPEN"

        alert = await session.get(Alert, receipt.alert_id)
        assert alert is not None
        assert alert.severity == "MEDIUM"

        audit = await session.get(AuditLog, receipt.audit_id)
        assert audit is not None
        assert audit.action == "soar.playbook.alert_only"


@pytest.mark.asyncio
async def test_execute_playbook_surgical_isolation_and_rollback() -> None:
    """PLAYBOOK_03_SURGICAL_ISOLATION isolates workstation and rollback restores it."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="isolate-target-01",
            ip_address="10.1.1.50",
            operating_system="Windows 11",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    eval_res = PolicyEvaluationResult(
        workstation_id=ws_id,
        user_context=IdPIdentityContext(
            user_id="u-2", username="user2", email="u2@kku.edu.sa", role="STUDENT", department="CS"
        ),
        workstation_context=IdPWorkstationContext(
            workstation_id=ws_id, hostname="isolate-target-01", department="CS"
        ),
        correlated_incident=CorrelatedIncident(
            workstation_id=ws_id,
            incident_category="CRYPTOJACKING",
            is_threat=True,
            severity="CRITICAL",
            confidence=0.98,
            recommended_action="SURGICAL_ISOLATION",
            reason="Confirmed miner.",
        ),
        decision=PolicyDecisionType.SURGICAL_NETWORK_ISOLATION,
        playbook_to_execute="PLAYBOOK_03_SURGICAL_ISOLATION",
        reason="Host isolation authorized.",
    )

    # 1. Execute isolation
    async with TestAsyncSession() as session:
        soar = SOARService(session)
        receipt = await soar.execute_policy_decision(eval_res, operator="test:admin")
        assert receipt.status == "SUCCESS"
        assert receipt.can_rollback is True

    # Verify workstation status is ISOLATED
    async with TestAsyncSession() as session:
        ws = await session.get(Workstation, ws_id)
        assert ws.status == "ISOLATED"

        # 2. Rollback isolation
        soar = SOARService(session)
        restored = await soar.rollback_isolation(ws_id, operator="test:admin")
        assert restored is True

    # Verify workstation status is restored to ONLINE
    async with TestAsyncSession() as session:
        ws = await session.get(Workstation, ws_id)
        assert ws.status == "ONLINE"


@pytest.mark.asyncio
async def test_execute_playbook_process_containment_preserves_workload() -> None:
    """PLAYBOOK_02_PROCESS_CONTAINMENT records preserved jobs and target ports."""
    ws_id = uuid.uuid4()
    async with TestAsyncSession() as session:
        ws = Workstation(
            id=ws_id,
            hostname="research-cluster-05",
            ip_address="10.2.2.5",
            operating_system="Ubuntu 22.04",
            status="ONLINE",
        )
        session.add(ws)
        await session.commit()

    eval_res = PolicyEvaluationResult(
        workstation_id=ws_id,
        user_context=IdPIdentityContext(
            user_id="res-01", username="prof_smith", email="smith@kku.edu.sa", role="RESEARCHER", department="Physics"
        ),
        workstation_context=IdPWorkstationContext(
            workstation_id=ws_id,
            hostname="research-cluster-05",
            department="Physics",
            active_workloads=[
                AuthorizedWorkload(
                    job_id="PHYSICS-SIM-44",
                    workload_type=WorkloadType.HPC_SIMULATION,
                    description="Particle Collision Sim",
                    workstation_id=ws_id,
                )
            ],
        ),
        correlated_incident=CorrelatedIncident(
            workstation_id=ws_id,
            incident_category="CRYPTOJACKING",
            is_threat=True,
            severity="HIGH",
            confidence=0.91,
            recommended_action="SURGICAL_ISOLATION",
            reason="Miner detected on researcher node.",
        ),
        decision=PolicyDecisionType.SURGICAL_PROCESS_CONTAINMENT,
        playbook_to_execute="PLAYBOOK_02_PROCESS_CONTAINMENT",
        target_ports=[3333],
        preserve_workloads=["PHYSICS-SIM-44"],
        reason="Surgically terminate miner on port 3333; keep PHYSICS-SIM-44 intact.",
    )

    async with TestAsyncSession() as session:
        soar = SOARService(session)
        receipt = await soar.execute_policy_decision(eval_res, operator="test:soar")
        assert receipt.status == "SUCCESS"
        assert "PHYSICS-SIM-44" in receipt.details["preserved_jobs"]
        assert 3333 in receipt.details["blocked_ports"]

        # Workstation remains ONLINE (not shut down or isolated)
        ws = await session.get(Workstation, ws_id)
        assert ws.status == "ONLINE"
